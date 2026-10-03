import axios from "axios";
import { randomInt } from "crypto";
import Otp from "../models/Otp";

const API_TIMEOUT = 30000;
const DEFAULT_TEST_OTP = "9999";

function isDefaultOtpMode(): boolean {
  return String(process.env.USE_DEFAULT_OTP).trim().toLowerCase() === "true";
}

function isSmsDebugEnabled(): boolean {
  return process.env.DEBUG_SMS === "true";
}

function getSmsApiUrl(): string | undefined {
  return process.env.SMS_INDIA_HUB_URL?.trim();
}

function sanitizeDebugData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      /otp|msg|message|mobile|msisdn|password|api.?key|token|raw/i.test(key)
        ? "[REDACTED]"
        : value,
    ]),
  );
}

function debugLog(label: string, data: Record<string, unknown>): void {
  if (isSmsDebugEnabled()) {
    console.log(
      `[SMS DEBUG] ${label}`,
      JSON.stringify(sanitizeDebugData(data), null, 2),
    );
  }
}

function getSmsApiKey(): string | undefined {
  return process.env.SMS_INDIA_HUB_API_KEY?.trim();
}

/**
 * SMS India HUB `password` param:
 * - Prefer panel password when set (this account rejects API key as password)
 * - Else fall back to API key
 * Override with SMS_INDIA_HUB_AUTH=api_key to force API key as password.
 */
function getSmsAuthPassword(): string | undefined {
  if (process.env.SMS_INDIA_HUB_AUTH === "api_key") {
    return getSmsApiKey() || process.env.SMS_INDIA_HUB_PASSWORD?.trim();
  }
  return process.env.SMS_INDIA_HUB_PASSWORD?.trim() || getSmsApiKey();
}

function getSmsSenderId(): string | undefined {
  return process.env.SMS_INDIA_HUB_SENDER_ID?.trim();
}

function getSmsDltTemplateId(): string | undefined {
  return process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID?.trim();
}

function getSmsUsername(): string {
  return (
    process.env.SMS_INDIA_HUB_USERNAME?.trim() ||
    process.env.APP_NAME?.trim() ||
    "OLOVELY"
  );
}

function getDltTemplateText(): string | undefined {
  return (
    process.env.SMS_INDIA_HUB_DLT_TEMPLATE_TEXT?.trim() ||
    process.env.SMS_INDIA_HUB_TEMPLATE_TEXT?.trim() ||
    process.env.SMS_INDIA_HUB_OTP_TEMPLATE?.trim()
  );
}

function getOtpExpiryMinutes(): number {
  const configured = Number(process.env.OTP_EXPIRY_MINUTES);
  return Number.isInteger(configured) && configured > 0 ? configured : 10;
}

/**
 * Interface for OTP Response
 */
interface OtpResponse {
  success: boolean;
  sessionId?: string;
  message: string;
}

/**
 * SMS India HUB API Response Interface
 */
interface SmsIndiaHubResponse {
  ErrorCode?: string;
  ErrorMessage?: string;
  JobId?: string;
  MessageId?: string;
  MessageData?: Array<{
    Number: string;
    MessageId: string;
    Message: string;
  }>;
}

type UserType = "Customer" | "Delivery" | "Seller" | "Admin";

/**
 * Generate numeric OTP
 */
function generateOTP(length: number = 4): string {
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += randomInt(0, 10).toString();
  }
  return otp;
}

/**
 * Normalize mobile to 10 digits for DB storage (schema allows only 10 digits).
 * Strips non-digits and removes leading 91 if present.
 */
function normalizeMobileTo10(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 10) {
    return digits;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Normalize mobile number for SMS API per official docs:
 * "msisdn: Single mobile number or multiple... (10 digits or +91)"
 * Examples use 919898xxxxxx (91 + 10 digits, no plus sign). No spaces.
 */
function normalizeMobileNumber(mobile: string): string {
  const digitsOnly = String(mobile).replace(/\D/g, "");
  let msisdn: string;
  if (digitsOnly.length === 10 && !digitsOnly.startsWith("0")) {
    msisdn = "91" + digitsOnly;
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    msisdn = digitsOnly;
  } else {
    throw new Error(
      `Invalid mobile number. Use 10-digit Indian number (e.g. 9755620716). Got: ${mobile}`,
    );
  }
  return msisdn.trim();
}

/**
 * Build DLT-compliant message. Must match approved template exactly.
 * Template: Welcome to the ##var## powered by Appzeto.Your OTP for registration is ##var##.BGADEC
 */
function buildOtpMessage(otp: string, customTemplate?: string): string {
  const appName = (
    process.env.SMS_INDIA_HUB_OTP_APP_NAME?.trim() ||
    process.env.APP_NAME?.trim() ||
    getSmsUsername() ||
    "Olovely Total Suvidha"
  ).trim();
  const poweredBy = process.env.SMS_INDIA_HUB_POWERED_BY?.trim();
  if (!poweredBy) {
    throw new Error(
      "SMS India HUB configuration missing. Set SMS_INDIA_HUB_POWERED_BY for the approved DLT template.",
    );
  }
  const otpTrimmed = String(otp).trim().replace(/\s/g, "");
  const template =
    customTemplate ||
    getDltTemplateText() ||
    "Welcome to the {APP_NAME} powered by Appzeto. Your OTP for registration is {OTP}.";

  const dltValues = [appName, poweredBy, otpTrimmed];
  let dltValueIndex = 0;
  const rendered = template
    .replace(/##var##/gi, () => dltValues[dltValueIndex++] || "")
    .replace(/\{APP_NAME\}/g, appName)
    .replace(/\{POWERED_BY\}/g, poweredBy)
    .replace(/\{OTP\}/g, otpTrimmed)
    .trim();

  if (/##var##|\{APP_NAME\}|\{POWERED_BY\}|\{OTP\}/i.test(rendered)) {
    throw new Error("SMS India HUB template contains unresolved placeholders.");
  }

  return rendered;
}

/**
 * Parse and handle SMS India HUB API response.
 */
function handleSmsResponse(
  responseData: SmsIndiaHubResponse | string | null | undefined,
): void {
  if (responseData == null) {
    throw new Error("Invalid SMS gateway response: empty body");
  }

  if (typeof responseData === "string") {
    const s = responseData.trim();
    const failedMatch = s.match(/^Failed#\s*(.*)$/i);
    if (failedMatch) {
      const reason = (failedMatch[1] || s).trim();
      const reasonLower = reason.toLowerCase();
      if (reasonLower.includes("invalid login")) {
        throw new Error(
          "SMS India HUB: Invalid login. Use SMS_INDIA_HUB_API_KEY as API password (default), or set SMS_INDIA_HUB_AUTH=panel_password with SMS_INDIA_HUB_PASSWORD.",
        );
      }
      if (reasonLower.includes("sender")) {
        throw new Error(
          `SMS India HUB: Sender ID not valid (${reason}). Check SMS_INDIA_HUB_SENDER_ID.`,
        );
      }
      throw new Error(`SMS India HUB: ${reason}`);
    }
    if (s.toLowerCase().includes("invalid login")) {
      throw new Error(
        "SMS India HUB: Invalid login. Check SMS_INDIA_HUB_API_KEY / password.",
      );
    }
    throw new Error(
      `SMS India HUB: Unexpected response: ${s.substring(0, 120)}`,
    );
  }

  const errorCode = String(responseData.ErrorCode || "");
  const errorMsg = responseData.ErrorMessage || "";

  if (
    errorCode === "000" ||
    errorMsg === "Done" ||
    (responseData.JobId && String(responseData.JobId).trim() !== "") ||
    (Array.isArray(responseData.MessageData) &&
      responseData.MessageData.length > 0)
  ) {
    return;
  }

  if (errorCode || errorMsg) {
    switch (errorCode) {
      case "001":
        throw new Error("SMS India HUB: Account details cannot be blank.");
      case "006":
        throw new Error(
          `SMS India HUB: Invalid DLT template (006): ${errorMsg || "template mismatch"}. Message must match approved template exactly.`,
        );
      case "007":
        throw new Error("SMS India HUB: Invalid username or password/API key.");
      case "015":
        throw new Error("SMS India HUB: Invalid Sender ID.");
      case "021":
        throw new Error("SMS India HUB: Insufficient credits.");
      case "024":
        throw new Error(
          `SMS India HUB: Invalid template or template mismatch (024): ${errorMsg}`,
        );
      default:
        throw new Error(
          `SMS India HUB API Error (Code: ${errorCode}): ${errorMsg}`,
        );
    }
  }
}

/**
 * Send SMS via SMS India HUB — official pushsms.aspx:
 * user + password + msisdn + sid + msg + fl=0 + gwid=2 + DLT_TE_ID + EntityId
 */
async function sendSmsViaApi(mobile: string, message: string): Promise<void> {
  const username = getSmsUsername();
  const password = getSmsAuthPassword();
  const senderId = getSmsSenderId();
  const apiKey = getSmsApiKey();
  const apiUrl = getSmsApiUrl();
  if (!apiUrl || !username || !password || !senderId) {
    throw new Error(
      "SMS India HUB configuration missing. Set SMS_INDIA_HUB_URL, SMS_INDIA_HUB_USERNAME, SMS_INDIA_HUB_PASSWORD (or API_KEY), and SMS_INDIA_HUB_SENDER_ID.",
    );
  }

  const msisdn = normalizeMobileNumber(mobile);

  const buildParams = (auth: "password" | "APIKey"): Record<string, string> => {
    const params: Record<string, string> = {
      user: username,
      msisdn,
      sid: senderId,
      msg: message,
      fl: "0",
      gwid: process.env.SMS_INDIA_HUB_GWID?.trim() || "2",
    };
    if (auth === "APIKey") {
      params.APIKey = apiKey || password;
    } else {
      params.password = password;
    }

    const dltId = getSmsDltTemplateId();
    if (dltId && process.env.SMS_INDIA_HUB_SKIP_DLT_TE_ID !== "true") {
      params.templateid = dltId;
      params.DLT_TE_ID = dltId;
    }
    const entityId = process.env.SMS_INDIA_HUB_ENTITY_ID?.trim();
    if (entityId) {
      params.EntityId = entityId;
      params.entityid = entityId;
    }
    return params;
  };

  const doRequest = (params: Record<string, string>) =>
    axios.get<SmsIndiaHubResponse | string>(apiUrl, {
      params,
      timeout: API_TIMEOUT,
      validateStatus: () => true,
    });

  const preferApiKey =
    process.env.SMS_INDIA_HUB_USE_APIKEY === "true" ||
    process.env.SMS_INDIA_HUB_AUTH === "api_key";
  const initialAuth: "password" | "APIKey" =
    preferApiKey && apiKey ? "APIKey" : "password";

  let params = buildParams(initialAuth);

  debugLog("SMS India HUB request", {
    url: apiUrl,
    user: username,
    sid: senderId,
    msisdn,
    DLT_TE_ID: params.DLT_TE_ID || "(not set)",
    EntityId: params.EntityId || "(not set)",
    msg: message,
    auth: initialAuth,
  });

  let response = await doRequest(params);
  let data = response.data;

  const isInvalidLogin =
    (typeof data === "string" &&
      (data.toLowerCase().includes("invalid login") ||
        data.startsWith("Failed#"))) ||
    (typeof data === "object" &&
      data &&
      String((data as SmsIndiaHubResponse).ErrorCode) === "007");

  // Fallback to alternate auth method if invalid login
  if (isInvalidLogin) {
    const fallbackAuth = initialAuth === "APIKey" ? "password" : "APIKey";
    debugLog(`SMS India HUB retry with ${fallbackAuth}`, {});
    params = buildParams(fallbackAuth);
    response = await doRequest(params);
    data = response.data;
  }

  debugLog("SMS India HUB response", {
    status: response.status,
    raw: data,
  });

  handleSmsResponse(data);
}

async function deliverOtp(mobile: string, otp: string): Promise<void> {
  const primaryMessage = buildOtpMessage(otp);
  debugLog("deliverOtp provider", {
    provider: "SMS_INDIA_HUB",
    msgPreview: primaryMessage.slice(0, 80),
  });

  await sendSmsViaApi(mobile, primaryMessage);
}

/**
 * Save OTP to database (mobile must be normalized to 10 digits for schema)
 */
async function saveOtpToDb(
  mobile: string,
  otp: string,
  userType: UserType,
): Promise<void> {
  const normalizedMobile = normalizeMobileTo10(mobile);
  if (normalizedMobile.length !== 10) {
    throw new Error(
      `Invalid mobile for DB: expected 10 digits, got ${normalizedMobile.length}`,
    );
  }

  await Otp.deleteMany({ mobile: normalizedMobile, userType });
  await Otp.create({
    mobile: normalizedMobile,
    otp: otp.trim(),
    userType,
    expiresAt: new Date(Date.now() + getOtpExpiryMinutes() * 60 * 1000),
  });
}

/**
 * Verify OTP from database
 */
async function verifyOtpFromDb(
  mobile: string,
  otp: string,
  userType: UserType,
): Promise<boolean> {
  const normalizedMobile = normalizeMobileTo10(mobile);

  const record = await Otp.findOne({
    mobile: normalizedMobile,
    userType,
    otp: otp.trim(),
  });

  if (!record) {
    const count = await Otp.countDocuments({
      mobile: normalizedMobile,
      userType,
    });
    console.error("OTP verification failed - record not found:", {
      mobile: normalizedMobile,
      userType,
      existingRecordsCount: count,
    });
    return false;
  }

  if (record.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: record._id });
    console.error("OTP verification failed - expired:", {
      mobile: normalizedMobile,
      expiresAt: record.expiresAt,
      now: new Date(),
    });
    return false;
  }

  await Otp.deleteOne({ _id: record._id });
  return true;
}

function isDefaultOtpBypass(otp: string): boolean {
  return isDefaultOtpMode() && String(otp).trim() === DEFAULT_TEST_OTP;
}

// ==========================================
// SMS OTP (Customer / Delivery)
// ==========================================

export async function sendSmsOtp(
  mobile: string,
  userType: "Customer" | "Delivery" = "Delivery",
): Promise<OtpResponse> {
  const mobileStr = String(mobile ?? "").trim();
  debugLog("sendSmsOtp called", {
    mobile: mobileStr,
    mobileLength: mobileStr.length,
    userType,
    isDefaultOtpMode: isDefaultOtpMode(),
  });

  try {
    const defaultMode = isDefaultOtpMode();
    const otp = defaultMode ? DEFAULT_TEST_OTP : generateOTP(4);

    if (defaultMode) {
      await saveOtpToDb(mobileStr, otp, userType);
      return {
        success: true,
        sessionId: "DEFAULT_OTP_SESSION_" + mobileStr,
        message: "OTP sent successfully",
      };
    }

    // Real mode - deliver via configured provider; rollback saved OTP if send fails
    const normalizedMobile10 = normalizeMobileTo10(mobileStr);
    await saveOtpToDb(mobileStr, otp, userType);
    debugLog("Real OTP generated", { mobile: mobileStr, otp });
    try {
      await deliverOtp(mobileStr, otp);
    } catch (sendErr) {
      await Otp.deleteMany({ mobile: normalizedMobile10, userType });
      throw sendErr;
    }

    return {
      success: true,
      sessionId: "OTP_SESSION_" + normalizedMobile10,
      message: "OTP sent successfully",
    };
  } catch (error: any) {
    const errorMessage =
      error.message || "Failed to send OTP. Please try again.";
    console.error("SMS OTP Error (sendSmsOtp):", {
      error: errorMessage,
      mobile: "[REDACTED]",
      userType,
    });
    throw new Error(errorMessage);
  }
}

export async function verifySmsOtp(
  sessionId: string,
  otpInput: string,
  mobile?: string,
  userType: "Customer" | "Delivery" = "Delivery",
): Promise<boolean> {
  if (isDefaultOtpBypass(otpInput)) {
    return true;
  }

  // Normalize OTP input (remove spaces, ensure it's a string)
  const normalizedOtp = String(otpInput).trim().replace(/\s/g, "");

  if (!normalizedOtp || normalizedOtp.length !== 4) {
    console.error("OTP verification failed - invalid OTP format:", {
      otpInput: "[REDACTED]",
      normalizedOtp: "[REDACTED]",
      length: normalizedOtp.length,
    });
    return false;
  }

  let targetMobile = mobile;
  if (!targetMobile && sessionId) {
    if (sessionId.startsWith("DB_VERIFIED_")) {
      targetMobile = sessionId.replace("DB_VERIFIED_", "");
    } else if (sessionId.startsWith("DEFAULT_OTP_SESSION_")) {
      targetMobile = sessionId.replace("DEFAULT_OTP_SESSION_", "");
    } else if (sessionId.startsWith("OTP_SESSION_")) {
      targetMobile = sessionId.replace("OTP_SESSION_", "");
    }
  }

  if (!targetMobile) {
    console.error("OTP verification failed - no mobile number:", {
      sessionId,
      mobile: "[REDACTED]",
      userType,
    });
    return false;
  }

  const normalizedMobile = normalizeMobileTo10(targetMobile);

  if (normalizedMobile.length !== 10) {
    console.error("OTP verification failed - invalid mobile format:", {
      original: targetMobile,
      normalized: normalizedMobile,
      length: normalizedMobile.length,
    });
    return false;
  }

  return verifyOtpFromDb(normalizedMobile, normalizedOtp, userType);
}

// ==========================================
// SMS OTP (Seller / Admin)
// ==========================================

export async function sendOTP(
  mobile: string,
  userType: "Seller" | "Admin" | "Customer" | "Delivery",
  _isLogin: boolean = true,
): Promise<OtpResponse> {
  try {
    const defaultMode = isDefaultOtpMode();
    const otp = defaultMode ? DEFAULT_TEST_OTP : generateOTP(4);

    if (defaultMode) {
      await saveOtpToDb(mobile, otp, userType);
      return {
        success: true,
        message: "OTP sent successfully",
      };
    }

    // Real mode - deliver via configured provider; rollback saved OTP if send fails
    const normalizedMobile10 = normalizeMobileTo10(mobile);
    await saveOtpToDb(mobile, otp, userType);
    try {
      await deliverOtp(mobile, otp);
    } catch (sendErr) {
      await Otp.deleteMany({ mobile: normalizedMobile10, userType });
      throw sendErr;
    }

    return {
      success: true,
      message: "OTP sent successfully",
    };
  } catch (error: any) {
    const errorMessage =
      error.message || "Failed to send OTP. Please try again.";
    console.error("SMS OTP Error (sendOTP):", {
      error: errorMessage,
      mobile: "[REDACTED]",
      userType,
    });
    throw new Error(errorMessage);
  }
}

export async function verifyOTP(
  mobile: string,
  otpInput: string,
  userType: "Seller" | "Admin" | "Customer" | "Delivery",
): Promise<boolean> {
  if (isDefaultOtpBypass(otpInput)) {
    return true;
  }

  // Normalize OTP input (remove spaces, ensure it's a string)
  const normalizedOtp = String(otpInput).trim().replace(/\s/g, "");

  if (!normalizedOtp || normalizedOtp.length !== 4) {
    console.error("OTP verification failed - invalid OTP format:", {
      otpInput: "[REDACTED]",
      normalizedOtp: "[REDACTED]",
      length: normalizedOtp.length,
    });
    return false;
  }

  const normalizedMobile = normalizeMobileTo10(mobile);

  if (normalizedMobile.length !== 10) {
    console.error("OTP verification failed - invalid mobile format:", {
      original: mobile,
      normalized: normalizedMobile,
      length: normalizedMobile.length,
    });
    return false;
  }

  return verifyOtpFromDb(normalizedMobile, normalizedOtp, userType);
}
