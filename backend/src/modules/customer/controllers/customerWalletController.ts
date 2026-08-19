import { Request, Response } from "express";
import { getWalletBalance, getWalletTransactions } from "../../../services/walletManagementService";

/**
 * Get customer wallet balance
 */
export const getCustomerWalletBalance = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const balance = await getWalletBalance(userId, "CUSTOMER");

    return res.status(200).json({
      success: true,
      message: "Customer wallet balance fetched successfully",
      data: { balance },
    });
  } catch (error: any) {
    console.error("Error getting customer wallet balance:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get customer wallet balance",
    });
  }
};

/**
 * Get customer wallet transactions
 */
export const getCustomerWalletTransactions = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { page = 1, limit = 20 } = req.query;

    const result = await getWalletTransactions(
      userId,
      "CUSTOMER",
      Number(page),
      Number(limit)
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error getting customer wallet transactions:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get customer wallet transactions",
    });
  }
};
