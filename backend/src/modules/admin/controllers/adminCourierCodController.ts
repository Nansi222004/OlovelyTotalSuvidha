import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import {
  getCourierCodSummary,
  listCourierCodSettlements,
  listCourierCodRemittances,
  verifyCourierCodRemittance,
  cancelCourierCodSettlement,
} from "../../../services/courierCodService";

/** GET /admin/courier-cod/summary — B-4 finance view */
export const getSummary = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: await getCourierCodSummary() });
});

/** GET /admin/courier-cod/settlements?status=PENDING_REMITTANCE|REMITTED|CANCELLED&page=&limit= */
export const getSettlements = asyncHandler(async (req: Request, res: Response) => {
  const { status, page = "1", limit = "50" } = req.query as any;
  const data = await listCourierCodSettlements(status, Math.max(1, Number(page)), Math.min(200, Number(limit) || 50));
  res.status(200).json({ success: true, data });
});

/** GET /admin/courier-cod/remittances */
export const getRemittances = asyncHandler(async (req: Request, res: Response) => {
  const { page = "1", limit = "50" } = req.query as any;
  const data = await listCourierCodRemittances(Math.max(1, Number(page)), Math.min(200, Number(limit) || 50));
  res.status(200).json({ success: true, data });
});

/**
 * POST /admin/courier-cod/remittances
 * body: { reference, remittanceDate, amountReceived, courierCharges?, orderIds[], notes?, provider? }
 * Credits sellers (through escrow) ONLY for the listed orders, after amounts reconcile.
 */
export const createRemittance = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req as any).user?.userId;
  try {
    const data = await verifyCourierCodRemittance({ ...req.body, adminId });
    res.status(201).json({ success: true, message: "Remittance verified and settled", data });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e?.message || "Remittance verification failed" });
  }
});

/** POST /admin/courier-cod/settlements/:orderId/cancel  body: { note } — RTO / never collected */
export const cancelSettlement = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req as any).user?.userId;
  const note = String(req.body?.note || "").trim();
  if (!note) return res.status(400).json({ success: false, message: "A note (e.g. RTO reference) is required" });
  try {
    const data = await cancelCourierCodSettlement(req.params.orderId, adminId, note);
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e?.message || "Cancel failed" });
  }
});
