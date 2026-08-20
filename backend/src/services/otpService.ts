import axios from "axios";
import Otp from "../models/Otp";

const SMS_INDIA_HUB_API_URL =
  "http://cloud.smsindiahub.in/vendorsms/pushsms.aspx";
const API_TIMEOUT = 30000;

const DEBUG_SMS = process.env.DEBUG_SMS === "true";
function debugLog(label: string, data: Record<string, unknown>): void {
  if (DEBUG_SMS || process.env.NODE_ENV !== "production") {
    console.log(`[SMS DEBUG] ${label}`, JSON.stringify(data, null, 2));
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
    process.env.SMS_INDIA_HUB_OTP_TEMPLATE?.trim()
  );
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
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
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
  const otpTrimmed = String(otp).trim().replace(/\s/g, "");
  const template =
    customTemplate ||
    getDltTemplateText() ||
    "Welcome to the {APP_NAME} powered by Appzeto. Your OTP for registration is {OTP}.";

  return template
    .replace(/\{APP_NAME\}/g, appName)
    .replace(/\{OTP\}/g, otpTrimmed)
    .trim();
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
  if (!username || !password || !senderId) {
    throw new Error(
      "SMS India HUB credentials missing. Set SMS_INDIA_HUB_USERNAME, SMS_INDIA_HUB_PASSWORD (or API_KEY), SMS_INDIA_HUB_SENDER_ID.",
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
      gwid: "2",
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
    axios.get<SmsIndiaHubResponse | string>(SMS_INDIA_HUB_API_URL, {
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
    url: SMS_INDIA_HUB_API_URL,
    user: username,
    sid: senderId,
    msisdn,
    DLT_TE_ID: params.DLT_TE_ID || "(not set)",
    EntityId: params.EntityId || "(not set)",
    msg: message,
    auth: initialAuth,
  });

  console.log("--- SMS India HUB Debug ---");
  console.log("Provider: SMS_INDIA_HUB");
  console.log("Auth Mode:", initialAuth);
  console.log("Template ID:", params.DLT_TE_ID);
  console.log("Entity ID (PE ID):", params.EntityId);
  console.log("Message Content:", params.msg);
  console.log("Sender ID:", params.sid);
  console.log("Mobile:", params.msisdn);
  console.log("--------------------------");

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

  const isDltError = (d: any) =>
    (typeof d === "object" && d && String(d.ErrorCode) === "006") ||
    (typeof d === "string" && d.toLowerCase().includes("006"));

  const isSuccess = (d: any) =>
    (typeof d === "object" &&
      d &&
      (String(d.ErrorCode) === "000" ||
        d.JobId ||
        (Array.isArray(d.MessageData) && d.MessageData.length > 0))) ||
    (typeof d === "string" &&
      d.toLowerCase().includes("jobid") &&
      !d.toLowerCase().includes("failed"));

  // Fallback if DLT template error 006 occurs: try combinations of gwid and dlt parameter names
  if (isDltError(data)) {
    console.warn(
      "[SMS India HUB] DLT Error 006 encountered. Attempting gateway route and DLT parameter fallbacks...",
    );
    const gwidCandidates = ["1", "3", "2"];
    const dltKeyCandidates = ["DLT_TE_ID", "templateid", "tempid", "none"];

    for (const gw of gwidCandidates) {
      for (const dltKey of dltKeyCandidates) {
        const testParams: Record<string, string> = { ...params, gwid: gw };
        delete testParams.DLT_TE_ID;
        delete testParams.templateid;
        delete testParams.tempid;

        if (dltKey !== "none" && getSmsDltTemplateId()) {
          testParams[dltKey] = getSmsDltTemplateId()!;
        }

        debugLog("SMS India HUB 006 fallback try", { gwid: gw, dltKey });
        const res = await doRequest(testParams);
        if (isSuccess(res.data)) {
          console.log(
            `[SMS India HUB] SUCCESS! Gateway matched with gwid=${gw}, dltKey=${dltKey}`,
          );
          data = res.data;
          break;
        }
      }
      if (isSuccess(data)) break;
    }
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

  try {
    await sendSmsViaApi(mobile, primaryMessage);
    return;
  } catch (err: any) {
    const isDltError =
      err.message?.includes("006") ||
      err.message?.includes("Invalid DLT template") ||
      err.message?.includes("template text");

    if (!isDltError) {
      throw err;
    }

    console.warn(
      "[SMS India HUB] DLT template mismatch on primary message. Trying candidate DLT template variations...",
    );

    const candidateAppNames = [
      "OLOVELY",
      "Olovely",
      "Olovely Total Suvidha",
      "DHAKADSNAZZY",
      "Dhakad Snazzy",
      "Kosil",
      "DhakadSnazzy",
      "dhakadsnazzy",
      "DHAKAD SNAZZY",
      "Appzeto",
      "Dhakad",
      "Snazzy",
    ];

    const candidateTemplates = [
      // Exact Portal Template with .BGADEC
      "Welcome to the {APP_NAME} powered by Appzeto.Your OTP for registration is {OTP}.BGADEC",
      "Welcome to the {APP_NAME} powered by Appzeto. Your OTP for registration is {OTP}.BGADEC",
      "Welcome to the {APP_NAME} powered by Appzeto.Your OTP for registration is {OTP}",
      "Welcome to the {APP_NAME} powered by Appzeto. Your OTP for registration is {OTP}.",
      "Welcome to the {APP_NAME} powered by SMSINDIAHUB. Your OTP for registration is {OTP}.",
    ];

    let lastError = err;

    // First try all candidate app names with exact portal template
    for (const appNameVar of candidateAppNames) {
      const candMsg = `Welcome to the ${appNameVar} powered by Appzeto.Your OTP for registration is ${otp}.BGADEC`;
      if (candMsg === primaryMessage) continue;
      try {
        console.log(`[SMS India HUB] Trying candidate message: "${candMsg}"`);
        await sendSmsViaApi(mobile, candMsg);
        console.log(
          `[SMS India HUB] SUCCESS! Matched DLT template message: "${candMsg}"`,
        );
        return;
      } catch (candErr: any) {
        lastError = candErr;
      }
    }

    // Next try generic candidate templates
    for (const candTemplate of candidateTemplates) {
      const candMsg = buildOtpMessage(otp, candTemplate);
      if (candMsg === primaryMessage) continue;
      try {
        console.log(`[SMS India HUB] Trying candidate template: "${candMsg}"`);
        await sendSmsViaApi(mobile, candMsg);
        console.log(
          `[SMS India HUB] SUCCESS! Matched DLT template: "${candMsg}"`,
        );
        return;
      } catch (candErr: any) {
        lastError = candErr;
      }
    }
    throw lastError;
  }
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
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes expiry
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

/**
 * Check if special bypass should be used (normalized comparison)
 */
function isSpecialBypass(mobile: string): boolean {
  const digits = mobile.replace(/\D/g, "");
  return (
    digits === "9111966732" || // existing special test number
    digits === "11966732" || // legacy variant
    digits === "6268423926" // requested default OTP number
  );
}

/**
 * Check if mock mode should be used (credentials read at runtime)
 */
function isMockMode(): boolean {
  if (process.env.USE_MOCK_OTP === "true") return true;
  return !getSmsAuthPassword() || !getSmsSenderId();
}

/**
 * Check if developer bypass OTP
 */
function isDeveloperBypass(otp: string): boolean {
  return (
    (process.env.NODE_ENV !== "production" ||
      process.env.USE_MOCK_OTP === "true") &&
    (otp === "999999" || otp === "9999" || otp === process.env.DEFAULT_OTP)
  );
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
    isMockMode: isMockMode(),
    isSpecialBypass: isSpecialBypass(mobileStr),
  });

  try {
    const otp = generateOTP(4);

    // Special number bypass
    if (isSpecialBypass(mobileStr)) {
      const specialOtp = "1234";
      await saveOtpToDb(mobileStr, specialOtp, userType);
      return {
        success: true,
        sessionId: "DB_VERIFIED_" + mobileStr,
        message: "OTP sent successfully",
      };
    }

    // Mock mode
    if (isMockMode()) {
      await saveOtpToDb(mobileStr, otp, userType);
      if (process.env.NODE_ENV !== "production" || DEBUG_SMS) {
        console.log(`[SMS] Mock OTP for ${mobileStr}: ${otp}`);
      }
      return {
        success: true,
        sessionId: "MOCK_SESSION_" + mobileStr,
        message: "OTP sent successfully",
      };
    }

    // Real mode - deliver via configured provider; rollback saved OTP if send fails
    const normalizedMobile10 = normalizeMobileTo10(mobileStr);
    await saveOtpToDb(mobileStr, otp, userType);
    if (process.env.NODE_ENV !== "production" || DEBUG_SMS) {
      console.log(`🔑 [SMS DEBUG] Generated OTP for ${mobileStr}: ${otp}`);
    }
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
      mobile: mobileStr,
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
  if (isDeveloperBypass(otpInput)) {
    return true;
  }

  // Normalize OTP input (remove spaces, ensure it's a string)
  const normalizedOtp = String(otpInput).trim().replace(/\s/g, "");

  if (!normalizedOtp || normalizedOtp.length !== 4) {
    console.error("OTP verification failed - invalid OTP format:", {
      otpInput,
      normalizedOtp,
      length: normalizedOtp.length,
    });
    return false;
  }

  let targetMobile = mobile;
  if (!targetMobile && sessionId) {
    if (sessionId.startsWith("DB_VERIFIED_")) {
      targetMobile = sessionId.replace("DB_VERIFIED_", "");
    } else if (sessionId.startsWith("MOCK_SESSION_")) {
      targetMobile = sessionId.replace("MOCK_SESSION_", "");
    } else if (sessionId.startsWith("OTP_SESSION_")) {
      targetMobile = sessionId.replace("OTP_SESSION_", "");
    }
  }

  if (!targetMobile) {
    console.error("OTP verification failed - no mobile number:", {
      sessionId,
      mobile,
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
    const otp = generateOTP(4);

    // Special number bypass
    if (isSpecialBypass(mobile)) {
      const specialOtp = "1234";
      await saveOtpToDb(mobile, specialOtp, userType);
      return {
        success: true,
        message: "OTP sent successfully",
      };
    }

    // Mock mode
    if (isMockMode()) {
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
      mobile,
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
  if (isDeveloperBypass(otpInput)) {
    return true;
  }

  // Normalize OTP input (remove spaces, ensure it's a string)
  const normalizedOtp = String(otpInput).trim().replace(/\s/g, "");

  if (!normalizedOtp || normalizedOtp.length !== 4) {
    console.error("OTP verification failed - invalid OTP format:", {
      otpInput,
      normalizedOtp,
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
