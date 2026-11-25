/**
 * POS counter UPI payments through Razorpay QR codes.
 *
 * The cashier's screen shows a single-use, fixed-amount UPI QR created on the merchant's Razorpay
 * account. The customer scans it with any UPI app; Razorpay captures the payment automatically.
 * The POS checkout only records a UPI sale after it has verified with Razorpay that this QR has a
 * captured payment for exactly the bill amount (see verifyPosUpiQrPayment).
 *
 * Uses the same Razorpay keys as online payments (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET, chosen
 * by RAZORPAY_LIVE_MODE at startup).
 */
import Razorpay from "razorpay";

export class PosUpiQrError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "PosUpiQrError";
  }
}

/** Minimal client surface used here; injectable so tests never call Razorpay. */
export interface PosQrClient {
  create(params: Record<string, unknown>): Promise<any>;
  fetch(qrCodeId: string): Promise<any>;
  fetchAllPayments(qrCodeId: string): Promise<any>;
  close(qrCodeId: string): Promise<any>;
}

let injectedClient: PosQrClient | null = null;
/** Test hook: replace the Razorpay client (pass null to restore). */
export const setPosQrClientForTests = (client: PosQrClient | null) => {
  injectedClient = client;
};

const getClient = (): PosQrClient => {
  if (injectedClient) return injectedClient;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new PosUpiQrError(503, "Razorpay is not configured on the server, so UPI QR payments are unavailable.");
  }
  const razorpay: any = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return {
    create: (params) => razorpay.qrCode.create(params),
    fetch: (id) => razorpay.qrCode.fetch(id),
    fetchAllPayments: (id) => razorpay.qrCode.fetchAllPayments(id),
    close: (id) => razorpay.qrCode.close(id),
  };
};

const toPaise = (rupees: number) => Math.round(Number(rupees) * 100);
const QR_ID_PATTERN = /^qr_[A-Za-z0-9]+$/;
const QR_LIFETIME_SECONDS = 15 * 60;
const MAX_POS_UPI_AMOUNT = 200000; // ₹2,00,000 safety cap for a single counter sale

const assertQrId = (qrCodeId: string) => {
  if (!QR_ID_PATTERN.test(String(qrCodeId || ""))) throw new PosUpiQrError(400, "Invalid UPI QR reference.");
};

const razorpayMessage = (error: any) =>
  error?.error?.description || error?.description || error?.message || "Razorpay request failed";

/** Creates a single-use QR for exactly `amount` rupees. */
export async function createPosUpiQr(amount: number, options: { businessName?: string; createdBy?: string } = {}) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 1 || value > MAX_POS_UPI_AMOUNT) {
    throw new PosUpiQrError(400, `UPI amount must be between ₹1 and ₹${MAX_POS_UPI_AMOUNT}.`);
  }
  const closeBy = Math.floor(Date.now() / 1000) + QR_LIFETIME_SECONDS;
  try {
    const qr = await getClient().create({
      type: "upi_qr",
      name: String(options.businessName || "Olovely POS").slice(0, 40),
      usage: "single_use",
      fixed_amount: true,
      payment_amount: toPaise(value),
      description: `POS counter sale ₹${value.toFixed(2)}`,
      close_by: closeBy,
      notes: { source: "POS", ...(options.createdBy ? { createdBy: String(options.createdBy) } : {}) },
    });
    return {
      qrCodeId: String(qr.id),
      imageUrl: String(qr.image_url || ""),
      amount: value,
      closeBy: new Date(closeBy * 1000).toISOString(),
    };
  } catch (error: any) {
    if (error instanceof PosUpiQrError) throw error;
    throw new PosUpiQrError(502, `Could not create the UPI QR: ${razorpayMessage(error)}`);
  }
}

/** Current state of a POS QR: whether a payment has been captured, and for how much. */
export async function getPosUpiQrStatus(qrCodeId: string) {
  assertQrId(qrCodeId);
  try {
    const client = getClient();
    const [qr, paymentList] = await Promise.all([client.fetch(qrCodeId), client.fetchAllPayments(qrCodeId)]);
    const captured = (paymentList?.items || []).filter((p: any) => p?.status === "captured");
    const payment = captured[0];
    return {
      qrCodeId,
      qrStatus: String(qr?.status || ""),
      fixedAmount: Number(qr?.payment_amount || 0) / 100,
      isPos: qr?.notes?.source === "POS",
      paid: Boolean(payment),
      paymentId: payment ? String(payment.id) : undefined,
      amountPaid: payment ? Number(payment.amount) / 100 : 0,
      capturedPayments: captured.length,
      // Razorpay closes a single-use QR the moment it is paid ("paid"), often a few seconds before
      // the payment shows as captured. The POS must keep waiting then, not treat the QR as expired.
      closeReason: String(qr?.close_reason || ""),
      paymentsReceived: Number(qr?.payments_count_received || 0) + (paymentList?.items?.length || 0) > 0,
    };
  } catch (error: any) {
    if (error instanceof PosUpiQrError) throw error;
    throw new PosUpiQrError(502, `Could not check the UPI payment: ${razorpayMessage(error)}`);
  }
}

/** Cancels an unpaid QR so it can no longer be paid. Already closed/paid QRs are fine. */
export async function closePosUpiQr(qrCodeId: string) {
  assertQrId(qrCodeId);
  try {
    await getClient().close(qrCodeId);
    return { closed: true };
  } catch (error: any) {
    const message = razorpayMessage(error);
    if (/closed/i.test(message)) return { closed: true };
    throw new PosUpiQrError(502, `Could not cancel the UPI QR: ${message}`);
  }
}

/**
 * Checkout guard: the QR must be a POS QR with exactly one captured payment. Returns the payment.
 * The amount is compared with the server-calculated bill by the caller.
 */
export async function verifyPosUpiQrPayment(qrCodeId: string) {
  const status = await getPosUpiQrStatus(qrCodeId);
  if (!status.isPos) throw new PosUpiQrError(400, "This QR was not created by the POS terminal.");
  if (!status.paid || !status.paymentId) throw new PosUpiQrError(409, "UPI payment has not been received yet.");
  if (status.capturedPayments > 1) {
    throw new PosUpiQrError(409, "This QR received more than one payment. Resolve it in the Razorpay dashboard.");
  }
  return { paymentId: status.paymentId, amountPaid: status.amountPaid };
}

export const posAmountsMatch = (a: number, b: number) => toPaise(a) === toPaise(b);
