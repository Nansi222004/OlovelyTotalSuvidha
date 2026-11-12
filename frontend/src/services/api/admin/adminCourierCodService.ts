import api from "../config";

/** B-4: Shiprocket (courier) COD settlement — admin finance API */
export interface CourierCodSummary {
  codCollectedByCourier: number;
  codPendingFromCourier: number;
  pendingOrders: number;
  codRemittedGross: number;
  amountReceived: number;
  courierCharges: number;
  remittanceBatches: number;
  sellerPayablePending: number;
  sellerPayableRemitted: number;
  platformEarningRemitted: number;
  platformEarningPending: number;
  cancelledOrders: number;
}

export interface CourierCodSettlementRow {
  _id: string;
  order: string;
  orderNumber: string;
  awbCodes: string[];
  codAmount: number;
  sellerPayable: number;
  platformEarning: number;
  status: "PENDING_REMITTANCE" | "REMITTED" | "CANCELLED";
  deliveredAt?: string;
  remittance?: { _id: string; reference: string; remittanceDate: string };
  remittedAt?: string;
  history: { action: string; at: string; note?: string }[];
}

export interface CourierCodRemittanceRow {
  _id: string;
  provider: string;
  reference: string;
  remittanceDate: string;
  grossCodAmount: number;
  courierCharges: number;
  amountReceived: number;
  lines: { order: string; orderNumber: string; codAmount: number }[];
  notes?: string;
  createdAt: string;
}

export const getCourierCodSummary = async () =>
  (await api.get<{ success: boolean; data: CourierCodSummary }>("/admin/courier-cod/summary")).data;

export const getCourierCodSettlements = async (status?: string, page = 1, limit = 100) =>
  (
    await api.get<{ success: boolean; data: { rows: CourierCodSettlementRow[]; total: number } }>(
      "/admin/courier-cod/settlements",
      { params: { status, page, limit } },
    )
  ).data;

export const getCourierCodRemittances = async (page = 1, limit = 50) =>
  (
    await api.get<{ success: boolean; data: { rows: CourierCodRemittanceRow[]; total: number } }>(
      "/admin/courier-cod/remittances",
      { params: { page, limit } },
    )
  ).data;

export const verifyCourierCodRemittance = async (body: {
  reference: string;
  remittanceDate: string;
  amountReceived: number;
  courierCharges: number;
  orderIds: string[];
  notes?: string;
}) => (await api.post("/admin/courier-cod/remittances", body)).data;

export const cancelCourierCodSettlement = async (orderId: string, note: string) =>
  (await api.post(`/admin/courier-cod/settlements/${orderId}/cancel`, { note })).data;
