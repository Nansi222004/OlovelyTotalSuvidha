import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import {
  getDashboardStats,
  getSalesAnalytics,
  getOrderAnalytics,
  getTodaySales,
  getTopSellers,
  getRecentOrders,
  getSalesByLocation,
} from "../../../services/dashboardService";

/**
 * Get dashboard statistics
 */
export const getDashboardStatsController = asyncHandler(
  async (_req: Request, res: Response) => {
    const stats = await getDashboardStats();

    return res.status(200).json({
      success: true,
      message: "Dashboard stats fetched successfully",
      data: stats,
    });
  }
);

/**
 * Get sales analytics data
 */
export const getSalesAnalyticsController = asyncHandler(
  async (req: Request, res: Response) => {
    const { period } = req.query;
    const validPeriods = ["day", "week", "month", "year"];
    const analyticsPeriod = validPeriods.includes(period as string)
      ? (period as "day" | "week" | "month" | "year")
      : "month";

    const analytics = await getSalesAnalytics(analyticsPeriod);

    return res.status(200).json({
      success: true,
      message: "Sales analytics fetched successfully",
      data: analytics,
    });
  }
);

/**
 * Get top sellers
 */
export const getTopSellersController = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const topSellers = await getTopSellers(limit);

    return res.status(200).json({
      success: true,
      message: "Top sellers fetched successfully",
      data: topSellers,
    });
  }
);

/**
 * Get recent orders
 */
export const getRecentOrdersController = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const orders = await getRecentOrders(limit);

    return res.status(200).json({
      success: true,
      message: "Recent orders fetched successfully",
      data: orders,
    });
  }
);

/**
 * Get sales by location
 */
export const getSalesByLocationController = asyncHandler(
  async (_req: Request, res: Response) => {
    const salesByLocation = await getSalesByLocation();

    return res.status(200).json({
      success: true,
      message: "Sales by location fetched successfully",
      data: salesByLocation,
    });
  }
);

/**
 * Get today's sales
 */
export const getTodaySalesController = asyncHandler(
  async (_req: Request, res: Response) => {
    const todaySales = await getTodaySales();
    return res.status(200).json({
      success: true,
      message: "Today's sales fetched successfully",
      data: todaySales,
    });
  }
);

/**
 * Get order analytics data
 */
export const getOrderAnalyticsController = asyncHandler(
  async (req: Request, res: Response) => {
    const { period } = req.query;
    const validPeriods = ["day", "month"];
    const analyticsPeriod = validPeriods.includes(period as string)
      ? (period as "day" | "month")
      : "month";

    const analytics = await getOrderAnalytics(analyticsPeriod);

    return res.status(200).json({
      success: true,
      message: "Order analytics fetched successfully",
      data: analytics,
    });
  }
);
