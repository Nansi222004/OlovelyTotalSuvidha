import Customer from "../models/Customer";
import Category from "../models/Category";
import SubCategory from "../models/SubCategory";
import Product from "../models/Product";
import Order from "../models/Order";
import {
  getFinanceKpis,
  getDailyNetSales,
  istDayRange,
  istStartOfDay,
  istStartOfMonth,
  qualifyingOrderMatch,
  IST_TZ,
} from "./financeKpiService";
// import OrderItem from "../models/OrderItem";
// import Seller from "../models/Seller";

export interface DashboardStats {
  totalUser: number;
  totalCategory: number;
  totalSubcategory: number;
  totalProduct: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  soldOutProducts: number;
  lowStockProducts: number;
  totalRevenue: number;
  avgCompletedOrderValue: number;
}

export interface SalesData {
  date: string;
  value: number;
}

export interface TopSeller {
  sellerId: string;
  sellerName: string;
  storeName: string;
  totalRevenue: number;
  totalOrders: number;
}

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const [
      totalUser,
      parentCategoryCount,
      childCategoryCount,
      legacySubcategoryCount,
      totalProduct,
      totalOrders,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      revenueData,
      avgOrderValue,
      activeProducts,
    ] = await Promise.all([
      Customer.countDocuments({ status: "Active" }),
      Category.countDocuments({ parentId: null }),
      Category.countDocuments({ parentId: { $ne: null } }),
      SubCategory.countDocuments(),
      Product.countDocuments({ status: "Active" }),
      Order.countDocuments({ status: { $ne: "Pending" } }),
      Order.countDocuments({ status: "Delivered" }),
      Order.countDocuments({
        status: { $in: ["Received", "Accepted", "Processed", "Shipped", "Out for Delivery", "Out For Delivery"] },
      }),
      Order.countDocuments({ status: "Cancelled" }),
      Order.aggregate([
        { $match: { status: "Delivered", paymentStatus: "Paid" } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$total", 0] } } } },
      ]),
      Order.aggregate([
        { $match: { status: "Delivered", paymentStatus: "Paid" } },
        { $group: { _id: null, avg: { $avg: { $ifNull: ["$total", 0] } } } },
      ]),
      Product.find({ status: "Active" }).select("stock variations").lean(),
    ]);

    const totalCategory = parentCategoryCount || 0;
    const totalSubcategory = (childCategoryCount || 0) + (legacySubcategoryCount || 0);

    let soldOutProducts = 0;
    let lowStockProducts = 0;

    (activeProducts || []).forEach((product: any) => {
      let isSoldOut = true;
      let isLowStock = false;

      if (product.variations && product.variations.length > 0) {
        product.variations.forEach((v: any) => {
          const stock = v.stock || 0;
          if (stock > 0) isSoldOut = false;
          if (stock > 0 && stock < 10) isLowStock = true;
        });
      } else {
        const stock = product.stock || 0;
        if (stock > 0) isSoldOut = false;
        if (stock > 0 && stock < 10) isLowStock = true;
      }

      if (isSoldOut) soldOutProducts++;
      else if (isLowStock) lowStockProducts++;
    });

    // B-6: "Total Revenue" on the dashboard = Net sales (merchandise after platform coupons and
    // return refunds) of qualifying orders. Previously Σ order.total of Delivered+Paid orders,
    // which mixed in fees/shipping/tips and ignored returns.
    void revenueData;
    const totalRevenue = (await getFinanceKpis()).netSales;
    const avgCompletedOrderValue = avgOrderValue[0]?.avg || 0;

    return {
      totalUser: totalUser || 0,
      totalCategory,
      totalSubcategory,
      totalProduct: totalProduct || 0,
      totalOrders: totalOrders || 0,
      completedOrders: completedOrders || 0,
      pendingOrders: pendingOrders || 0,
      cancelledOrders: cancelledOrders || 0,
      soldOutProducts,
      lowStockProducts,
      totalRevenue: totalRevenue || 0,
      avgCompletedOrderValue: Math.round((avgCompletedOrderValue || 0) * 100) / 100,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    throw error;
  }
};

/**
 * Get sales analytics data for charts
 */
export const getSalesAnalytics = async (
  period: "day" | "week" | "month" | "year" = "month"
): Promise<{ thisPeriod: SalesData[]; lastPeriod: SalesData[] }> => {
  try {
    // B-6: IST (Asia/Kolkata) boundaries regardless of server time zone
    const now = new Date();
    let startDate: Date;
    let lastPeriodStart: Date;
    let groupFormat: string;

    switch (period) {
      case "day":
        startDate = istStartOfDay(now, -7);
        lastPeriodStart = istStartOfDay(now, -14);
        groupFormat = "%Y-%m-%d";
        break;
      case "week":
        startDate = istStartOfMonth(now, -1);
        lastPeriodStart = istStartOfMonth(now, -2);
        groupFormat = "%Y-%U";
        break;
      case "month":
        startDate = istStartOfMonth(now, -11);
        lastPeriodStart = istStartOfMonth(now, -23);
        groupFormat = "%Y-%m";
        break;
      case "year":
      default: {
        const istYear = new Date(now.getTime() + 330 * 60000).getUTCFullYear();
        startDate = new Date(Date.UTC(istYear - 4, 0, 1) - 330 * 60000);
        lastPeriodStart = new Date(Date.UTC(istYear - 9, 0, 1) - 330 * 60000);
        groupFormat = "%Y";
        break;
      }
    }
    const netMerch = { $subtract: [{ $ifNull: ["$subtotal", 0] }, { $ifNull: ["$discount", 0] }] };

    const [thisPeriodData, lastPeriodData] = await Promise.all([
      Order.aggregate([
        { $match: qualifyingOrderMatch({ from: startDate }) },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: "$orderDate", timezone: IST_TZ } },
            total: { $sum: netMerch },
          },
        },
        { $sort: { _id: 1 } },
      ]).catch(() => []),
      Order.aggregate([
        { $match: qualifyingOrderMatch({ from: lastPeriodStart, to: startDate }) },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: "$orderDate", timezone: IST_TZ } },
            total: { $sum: netMerch },
          },
        },
        { $sort: { _id: 1 } },
      ]).catch(() => []),
    ]);

    const thisPeriod = (thisPeriodData || []).map((item) => ({
      date: item._id || "",
      value: item.total || 0,
    }));

    const lastPeriod = (lastPeriodData || []).map((item) => ({
      date: item._id || "",
      value: item.total || 0,
    }));

    return { thisPeriod, lastPeriod };
  } catch (error) {
    console.error("Error fetching sales analytics:", error);
    return { thisPeriod: [], lastPeriod: [] };
  }
};

/**
 * Get order analytics (order counts by period)
 */
export const getOrderAnalytics = async (
  period: "day" | "month" = "month"
): Promise<{ thisPeriod: SalesData[]; lastPeriod: SalesData[] }> => {
  try {
    // B-6: IST wall-clock (shift +05:30, then read UTC fields) so grouping never depends on server TZ
    const IST = 330 * 60 * 1000;
    const now = new Date(Date.now() + IST);
    let startDate: Date;
    let lastPeriodStart: Date;

    if (period === "day") {
      // Current month's daily data
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - IST);
      lastPeriodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1) - IST);
    } else {
      // Yearly monthly data
      startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1) - IST);
      lastPeriodStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1) - IST);
    }

    // Get all orders for the period
    const [thisPeriodOrders, lastPeriodOrders] = await Promise.all([
      Order.find({
        orderDate: { $gte: startDate },
        status: { $nin: ["Pending", "Cancelled", "Rejected"] },
      })
        .select("orderDate")
        .lean()
        .catch(() => []),
      Order.find({
        orderDate: { $gte: lastPeriodStart, $lt: startDate },
        status: { $nin: ["Pending", "Cancelled", "Rejected"] },
      })
        .select("orderDate")
        .lean()
        .catch(() => []),
    ]);

    let thisPeriod: SalesData[] = [];
    let lastPeriod: SalesData[] = [];

    if (period === "day") {
      // Daily data for current month
      const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
      const daysLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).getUTCDate();

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const currentMonthName = monthNames[now.getUTCMonth()];
      const lastMonthName = monthNames[(now.getUTCMonth() - 1 + 12) % 12];

      // Count orders by day for current month
      const currentMonthCounts: { [key: number]: number } = {};
      thisPeriodOrders.forEach((order: any) => {
        const orderDate = new Date(new Date(order.orderDate).getTime() + IST);
        if (orderDate.getUTCMonth() === now.getUTCMonth() && orderDate.getUTCFullYear() === now.getUTCFullYear()) {
          const day = orderDate.getUTCDate();
          currentMonthCounts[day] = (currentMonthCounts[day] || 0) + 1;
        }
      });

      // Fill current month
      thisPeriod = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        return {
          date: `${String(day).padStart(2, "0")}-${currentMonthName}`,
          value: currentMonthCounts[day] || 0,
        };
      });

      // Count orders by day for last month
      const lastMonthCounts: { [key: number]: number } = {};
      lastPeriodOrders.forEach((order: any) => {
        const orderDate = new Date(new Date(order.orderDate).getTime() + IST);
        const lastMonth = (now.getUTCMonth() - 1 + 12) % 12;
        const lastMonthYear = lastMonth === 11 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
        if (orderDate.getUTCMonth() === lastMonth && orderDate.getUTCFullYear() === lastMonthYear) {
          const day = orderDate.getUTCDate();
          lastMonthCounts[day] = (lastMonthCounts[day] || 0) + 1;
        }
      });

      // Fill last month
      lastPeriod = Array.from({ length: daysLastMonth }, (_, i) => {
        const day = i + 1;
        return {
          date: `${String(day).padStart(2, "0")}-${lastMonthName}`,
          value: lastMonthCounts[day] || 0,
        };
      });
    } else {
      // Monthly data for current year
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

      // Count orders by month for current year
      const currentYearCounts: { [key: number]: number } = {};
      thisPeriodOrders.forEach((order: any) => {
        const orderDate = new Date(new Date(order.orderDate).getTime() + IST);
        if (orderDate.getUTCFullYear() === now.getUTCFullYear()) {
          const month = orderDate.getUTCMonth();
          currentYearCounts[month] = (currentYearCounts[month] || 0) + 1;
        }
      });

      // Fill current year
      thisPeriod = monthNames.map((month, index) => ({
        date: month,
        value: currentYearCounts[index] || 0,
      }));

      // Count orders by month for last year
      const lastYearCounts: { [key: number]: number } = {};
      lastPeriodOrders.forEach((order: any) => {
        const orderDate = new Date(new Date(order.orderDate).getTime() + IST);
        if (orderDate.getUTCFullYear() === now.getUTCFullYear() - 1) {
          const month = orderDate.getUTCMonth();
          lastYearCounts[month] = (lastYearCounts[month] || 0) + 1;
        }
      });

      // Fill last year
      lastPeriod = monthNames.map((month, index) => ({
        date: month,
        value: lastYearCounts[index] || 0,
      }));
    }

    return { thisPeriod, lastPeriod };
  } catch (error) {
    console.error("Error fetching order analytics:", error);
    return { thisPeriod: [], lastPeriod: [] };
  }
};

/**
 * Get today's sales total and comparison with last week same day
 */
export const getTodaySales = async (): Promise<{ salesToday: number; salesLastWeekSameDay: number }> => {
  // B-6: IST calendar day; qualifying orders only (no Pending/Cancelled/Rejected);
  // value = net merchandise (items not cancelled − platform coupon), same basis as Net sales.
  try {
    const today = istDayRange(new Date(), 0);
    const lastWeek = istDayRange(new Date(), -7);
    const [t, l] = await Promise.all([
      getDailyNetSales(today.start, today.end),
      getDailyNetSales(lastWeek.start, lastWeek.end),
    ]);
    return {
      salesToday: t.reduce((a, r) => a + r.value, 0),
      salesLastWeekSameDay: l.reduce((a, r) => a + r.value, 0),
    };
  } catch (error) {
    console.error("Error fetching today's sales:", error);
    return { salesToday: 0, salesLastWeekSameDay: 0 };
  }
};

/**
 * Get top sellers by revenue
 */
export const getTopSellers = async (
  limit: number = 10
): Promise<TopSeller[]> => {
  try {
    const topSellers = await Order.aggregate([
      {
        $match: {
          status: "Delivered",
          paymentStatus: "Paid",
        },
      },
      {
        $unwind: "$items",
      },
      {
        $lookup: {
          from: "orderitems",
          localField: "items",
          foreignField: "_id",
          as: "orderItem",
        },
      },
      {
        $unwind: {
          path: "$orderItem",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: {
            seller: "$orderItem.seller",
            orderId: "$_id",
          },
          totalRevenue: { $sum: "$orderItem.total" },
        },
      },
      {
        $group: {
          _id: "$_id.seller",
          totalRevenue: { $sum: "$totalRevenue" },
          totalOrders: { $sum: 1 },
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: "sellers",
          localField: "_id",
          foreignField: "_id",
          as: "seller",
        },
      },
      {
        $unwind: {
          path: "$seller",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          sellerId: { $toString: "$_id" },
          sellerName: "$seller.sellerName",
          storeName: "$seller.storeName",
          totalRevenue: { $ifNull: ["$totalRevenue", 0] },
          totalOrders: { $ifNull: ["$totalOrders", 0] },
        },
      },
    ]);

    return topSellers || [];
  } catch (error) {
    console.error("Error fetching top sellers:", error);
    return [];
  }
};

/**
 * Get recent orders
 */
export const getRecentOrders = async (limit: number = 10) => {
  try {
    const orders = await Order.find({ status: { $ne: "Pending" } })
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile")
      .sort({ orderDate: -1 })
      .limit(limit)
      .lean();

    return orders.map((order: any) => ({
      id: order._id.toString(),
      orderNumber: order.orderNumber || order._id.toString(),
      customerName: order.customerName || (order.customer?.name || "Unknown"),
      orderDate: order.orderDate || order.createdAt,
      status: order.status || "Received",
      amount: order.total || 0,
      deliveryBoy: order.deliveryBoy
        ? {
          name: (order.deliveryBoy as any).name || "Unknown",
          mobile: (order.deliveryBoy as any).mobile || "",
        }
        : null,
    }));
  } catch (error) {
    console.error("Error fetching recent orders:", error);
    return [];
  }
};

/**
 * Get sales by location
 */
export const getSalesByLocation = async () => {
  try {
    const salesByLocation = await Order.aggregate([
      {
        $match: {
          status: "Delivered",
          paymentStatus: "Paid",
        },
      },
      {
        $group: {
          _id: "$deliveryAddress.city",
          amount: { $sum: { $ifNull: ["$total", 0] } },
        },
      },
      {
        $sort: { amount: -1 },
      },
      {
        $project: {
          location: { $ifNull: ["$_id", "Unknown"] },
          amount: { $ifNull: ["$amount", 0] },
        },
      },
    ]);

    return salesByLocation || [];
  } catch (error) {
    console.error("Error fetching sales by location:", error);
    return [];
  }
};
