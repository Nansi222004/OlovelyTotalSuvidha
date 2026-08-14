import {
  useState,
  ReactNode,
  useEffect,
} from "react";
import { useAuth } from "./AuthContext";
import { Order } from "../types/order";
import { createOrder, getMyOrders } from "../services/api/customerOrderService";
import { OrdersContext } from "./ordersContext.types";

// Type for API response order (with _id from MongoDB)
interface ApiOrder {
  _id?: string;
  id?: string;
  items: Order['items'];
  totalItems: number;
  subtotal: number;
  fees: Order['fees'];
  totalAmount: number;
  address: Order['address'];
  status: Order['status'];
  paymentMethod?: string;
  createdAt: string;
  [key: string]: unknown; // Allow additional properties
}

// Type for API response
interface OrdersApiResponse {
  success: boolean;
  data?: ApiOrder[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

// Type for error response
interface ApiError {
  response?: {
    data?: {
      message?: string;
      details?: unknown;
    };
  };
  message?: string;
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const { isAuthenticated, user, updateUser } = useAuth();

  const fetchOrders = async () => {
    // Ensure userType is set - if user is authenticated but userType is missing, assume Customer
    // This handles cases where user was logged in before userType was added to the login flow
    const userType =
      user?.userType || (isAuthenticated && user ? "Customer" : undefined);

    if (!isAuthenticated || userType !== "Customer") {
      setLoading(false);
      return;
    }

    try {
      const response = await getMyOrders() as OrdersApiResponse;
      if (response && response.data) {
        const orders: Order[] = response.data.map((o: ApiOrder) => ({
          ...o,
          id: o.id || o._id || '',
        } as Order));
        setOrders(orders);
      }
    } catch (error) {
      console.error("Failed to fetch orders", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Ensure userType is set in user object if missing (for backward compatibility)
    if (isAuthenticated && user && !user.userType) {
      const updatedUser = { ...user, userType: "Customer" as const };
      updateUser(updatedUser);
    }

    if (isAuthenticated) {
      fetchOrders();
    } else {
      setOrders([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.userType, user?.id]);

  const addOrder = async (order: Order): Promise<string | undefined> => {
    try {
      // Construct payload
      const payload = {
        address: {
          address: order.address.street || order.address.address || "",
          city: order.address.city,
          state: order.address.state || "",
          pincode: order.address.pincode,
          landmark: order.address.landmark || "",
          latitude: order.address.latitude ?? 0,
          longitude: order.address.longitude ?? 0,
        },
        paymentMethod: order.paymentMethod || "COD",
        items: order.items.map((item) => ({
          product: {
            id: item.product.id || (item.product as { _id?: string })._id || '',
          },
          quantity: item.quantity,
          variant: item.variant, // Pass variant if available
        })),
        fees: {
          deliveryFee: order.fees?.deliveryFee || 0,
          platformFee: order.fees?.platformFee || 0,
        },
        deliveryOption: order.deliveryOption,
        couponCode: order.couponCode,
        tipAmount: order.tipAmount,
        giftPackaging: order.giftPackaging,
      };

      const response = await createOrder(payload);
      await fetchOrders();

      // Return the created order ID from response
      if (response && response.data) {
        const orderData = response.data as { _id?: string; id?: string };
        return orderData._id || orderData.id;
      }
      return undefined;
    } catch (error: unknown) {
      console.error("Failed to create order", error);
      // Extract and log the actual error message from the backend
      const apiError = error as ApiError;
      if (apiError.response?.data) {
        console.error("Backend error details:", apiError.response.data);
        const errorMessage = apiError.response.data.message || apiError.message || 'Failed to create order';
        const errorDetails = apiError.response.data.details;
        if (errorDetails) {
          console.error("Validation details:", errorDetails);
        }
        // Re-throw with more details
        const enhancedError = new Error(errorMessage) as Error & { details?: unknown };
        enhancedError.details = errorDetails;
        throw enhancedError;
      }
      throw error;
    }
  };

  const getOrderById = (id: string): Order | undefined => {
    return orders.find((order) => order.id === id);
  };

  const fetchOrderById = async (id: string): Promise<Order | undefined> => {
    try {
      const { getOrderById: apiGetOrderById } = await import(
        "../services/api/customerOrderService"
      );
      const response = await apiGetOrderById(id);
      if (response && response.data) {
        const mappedOrder = {
          ...response.data,
          id: response.data._id || response.data.id,
        };
        // Optionally update the orders list
        setOrders((prev) => {
          if (prev.find((o) => o.id === mappedOrder.id)) return prev;
          return [...prev, mappedOrder];
        });
        return mappedOrder;
      }
    } catch (error) {
      console.error("Failed to fetch order by id", error);
    }
    return undefined;
  };

  const updateOrderStatus = async (id: string, status: Order["status"]) => {
    // This is likely for cancellation if allowed
    setOrders((prevOrders) =>
      prevOrders.map((order) =>
        order.id === id ? { ...order, status } : order
      )
    );
    // Call API if exists
  };

  return (
    <OrdersContext.Provider
      value={{
        orders,
        addOrder,
        getOrderById,
        fetchOrderById,
        updateOrderStatus,
        loading,
      }}>
      {children}
    </OrdersContext.Provider>
  );
}
