import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import {
  getAuthToken,
  getStoredUserData,
  removeAuthToken,
  setAuthToken,
  getPanelFromContext,
  clearCustomerSession,
  clearDeliverySession,
  clearSellerSession,
} from "../services/api/config";

interface User {
  id: string;
  userType?: "Admin" | "Seller" | "Customer" | "Delivery";
  [key: string]: any;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  updateUser: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const inferLegacyUserType = (
  userData: Record<string, any>,
): User["userType"] | undefined => {
  if (!userData || typeof userData !== "object") {
    return undefined;
  }

  if (userData.userType) {
    return userData.userType;
  }

  if (userData.role === "Admin" || userData.role === "Super Admin") {
    return "Admin";
  }

  if (userData.storeName || userData.sellerName) {
    return "Seller";
  }

  if (
    userData.mobile &&
    userData.city &&
    userData.status &&
    !userData.phone &&
    !userData.storeName &&
    !userData.sellerName &&
    !userData.role
  ) {
    return "Delivery";
  }

  if (userData.phone || userData.walletAmount !== undefined || userData.refCode) {
    return "Customer";
  }

  return undefined;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const currentPanel = getPanelFromContext(undefined, typeof window !== "undefined" ? window.location.pathname : "");

  // Initialize state synchronously from role-isolated localStorage
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const storedToken = getAuthToken(currentPanel);
    const storedUser = getStoredUserData(currentPanel);
    return !!(storedToken && storedUser);
  });

  const [user, setUser] = useState<User | null>(() => {
    const storedUser = getStoredUserData(currentPanel);
    if (storedUser) {
      const inferredUserType = inferLegacyUserType(storedUser);
      if (inferredUserType && !storedUser.userType) {
        storedUser.userType = inferredUserType;
      }
      return storedUser;
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return getAuthToken(currentPanel);
  });

  // Effect to sync state if localStorage changes externally or on mount validation
  useEffect(() => {
    const panel = getPanelFromContext(user?.userType, window.location.pathname);
    const storedToken = getAuthToken(panel);
    const storedUser = getStoredUserData(panel);

    if (storedToken && storedUser) {
      const inferredUserType = inferLegacyUserType(storedUser);
      if (inferredUserType && !storedUser.userType) {
        storedUser.userType = inferredUserType;
      }

      if (!isAuthenticated || token !== storedToken || JSON.stringify(user) !== JSON.stringify(storedUser)) {
        setToken(storedToken);
        setUser(storedUser);
        setIsAuthenticated(true);
      }

      // Ensure FCM token is registered with backend
      import("../services/pushNotificationService").then(({ registerFCMToken }) => {
        registerFCMToken(true).catch(() => {});
      });
    } else if (isAuthenticated && !storedToken) {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  }, [currentPanel]);

  // Synchronize state when custom customer-logged-out event is dispatched (e.g. from Axios interceptor)
  useEffect(() => {
    const handleCustomerLoggedOut = () => {
      const panel = getPanelFromContext(userRef.current?.userType, window.location.pathname);
      if (panel === "customer" || userRef.current?.userType === "Customer") {
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
      }
    };

    window.addEventListener("olovely:customer-logged-out", handleCustomerLoggedOut);
    return () => {
      window.removeEventListener("olovely:customer-logged-out", handleCustomerLoggedOut);
    };
  }, []);

  // Synchronize state when custom delivery-logged-out event is dispatched (e.g. from Axios interceptor)
  useEffect(() => {
    const handleDeliveryLoggedOut = () => {
      const panel = getPanelFromContext(userRef.current?.userType, window.location.pathname);
      if (panel === "delivery" || userRef.current?.userType === "Delivery") {
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
      }
    };

    window.addEventListener("olovely:delivery-logged-out", handleDeliveryLoggedOut);
    return () => {
      window.removeEventListener("olovely:delivery-logged-out", handleDeliveryLoggedOut);
    };
  }, []);

  // Synchronize state when custom seller-logged-out event is dispatched (e.g. from Axios interceptor)
  useEffect(() => {
    const handleSellerLoggedOut = () => {
      const panel = getPanelFromContext(userRef.current?.userType, window.location.pathname);
      if (panel === "seller" || userRef.current?.userType === "Seller") {
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
      }
    };

    window.addEventListener("olovely:seller-logged-out", handleSellerLoggedOut);
    return () => {
      window.removeEventListener("olovely:seller-logged-out", handleSellerLoggedOut);
    };
  }, []);

  // Startup validation: If an old customer session is present on app startup,
  // validate against backend so deleted customers are immediately cleared and redirected to login.
  useEffect(() => {
    let isMounted = true;
    const currentToken = getAuthToken("customer");
    const currentUser = getStoredUserData("customer");
    const isCustomer =
      currentUser &&
      (currentUser.userType === "Customer" ||
        inferLegacyUserType(currentUser) === "Customer");

    if (currentToken && isCustomer) {
      import("../services/api/customerService").then(({ getProfile }) => {
        if (!isMounted) return;
        getProfile()
          .then((res) => {
            if (!isMounted) return;
            if (res && res.success && res.data) {
              const full = {
                ...currentUser,
                ...res.data,
                userType: "Customer",
              };
              setUser(full);
            }
          })
          .catch((err) => {
            if (!isMounted) return;
            const status = err.response?.status;
            const code = err.response?.data?.code;
            if (status === 401 || code === "CUSTOMER_DELETED") {
              clearCustomerSession({
                sessionExpiredMessage: "Your account is no longer available. Please log in again.",
              });
              setToken(null);
              setUser(null);
              setIsAuthenticated(false);
              if (
                typeof window !== "undefined" &&
                !window.location.pathname.includes("/login") &&
                !window.location.pathname.includes("/signup")
              ) {
                window.location.href = "/login";
              }
            }
          });
      });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Startup validation: If an old delivery partner session is present on app startup,
  // validate against backend so deleted delivery partners are immediately cleared and redirected to login.
  useEffect(() => {
    let isMounted = true;
    const currentToken = getAuthToken("delivery");
    const currentUser = getStoredUserData("delivery");
    const isDelivery =
      currentUser &&
      (currentUser.userType === "Delivery" ||
        inferLegacyUserType(currentUser) === "Delivery");

    if (currentToken && isDelivery) {
      import("../services/api/delivery/deliveryService").then(({ getDeliveryProfile }) => {
        if (!isMounted) return;
        getDeliveryProfile()
          .then((data) => {
            if (!isMounted) return;
            if (data) {
              const full = {
                ...currentUser,
                ...data,
                userType: "Delivery",
              };
              setUser(full);
            }
          })
          .catch((err) => {
            if (!isMounted) return;
            const status = err.response?.status;
            const code = err.response?.data?.code || err.code;
            if (status === 401 || code === "DELIVERY_PARTNER_DELETED") {
              clearDeliverySession({
                sessionExpiredMessage: "Your delivery partner account is no longer available. Please log in again.",
              });
              setToken(null);
              setUser(null);
              setIsAuthenticated(false);
              if (
                typeof window !== "undefined" &&
                !window.location.pathname.includes("/delivery/login") &&
                !window.location.pathname.includes("/delivery/signup")
              ) {
                window.location.href = "/delivery/login";
              }
            }
          });
      });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;

  const login = useCallback((newToken: string, userData: User) => {
    const inferredType = inferLegacyUserType(userData);
    const userType = userData.userType || inferredType;
    const fullUser = { ...userData, ...(userType && { userType }) };

    setToken(newToken);
    setUser(fullUser);
    setIsAuthenticated(true);
    setAuthToken(newToken, userType, fullUser);

    // Register FCM token for push notifications after successful login (silently)
    import("../services/pushNotificationService").then(({ registerFCMToken }) => {
      registerFCMToken(true).catch((error) => {
        console.error("Failed to register FCM token:", error);
      });
    });
  }, []);

  const logout = useCallback(() => {
    const currentUser = userRef.current;
    const currentToken = tokenRef.current;
    const userType = currentUser?.userType || getPanelFromContext(undefined, window.location.pathname);
    const currentAuthToken = currentToken || getAuthToken(userType);

    // Remove FCM token association from backend on logout before clearing auth
    if (currentAuthToken) {
      import("../services/pushNotificationService").then(({ removeFCMToken }) => {
        removeFCMToken(userType, currentAuthToken).catch((error) => {
          console.error("Failed to remove FCM token on logout:", error);
        });
      });
    }

    setToken(null);
    setUser(null);
    setIsAuthenticated(false);

    if (userType === "Customer" || (!currentUser?.userType && getPanelFromContext(undefined, window.location.pathname) === "customer")) {
      clearCustomerSession();
    } else if (userType === "Delivery" || (!currentUser?.userType && getPanelFromContext(undefined, window.location.pathname) === "delivery")) {
      clearDeliverySession();
    } else if (userType === "Seller" || (!currentUser?.userType && getPanelFromContext(undefined, window.location.pathname) === "seller")) {
      clearSellerSession();
    } else {
      removeAuthToken(userType);
    }
  }, []);

  const updateUser = useCallback((userData: User) => {
    const currentUser = userRef.current;
    const userType = userData.userType || currentUser?.userType || inferLegacyUserType(userData);
    const fullUser = { ...userData, ...(userType && { userType }) };

    // Prevent redundant state updates and re-renders if user object is unchanged
    if (JSON.stringify(currentUser) !== JSON.stringify(fullUser)) {
      setUser(fullUser);
      setAuthToken(tokenRef.current || getAuthToken(userType) || '', userType, fullUser);
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      isAuthenticated,
      user,
      token,
      login,
      logout,
      updateUser,
    }),
    [isAuthenticated, user, token, login, logout, updateUser]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

