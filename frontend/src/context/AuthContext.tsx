import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  getAuthToken,
  removeAuthToken,
  setAuthToken,
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
  // Initialize state synchronously from localStorage
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const storedToken = getAuthToken();
    const storedUser = localStorage.getItem("userData");
    return !!(storedToken && storedUser);
  });

  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem("userData");
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        const inferredUserType = inferLegacyUserType(userData);
        if (inferredUserType && !userData.userType) {
          userData.userType = inferredUserType;
        }
        return userData;
      } catch (error) {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return getAuthToken();
  });

  // Effect to sync state if localStorage changes externally or on mount validation
  useEffect(() => {
    const storedToken = getAuthToken();
    const storedUser = localStorage.getItem("userData");

    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        const inferredUserType = inferLegacyUserType(userData);
        if (inferredUserType && !userData.userType) {
          userData.userType = inferredUserType;
          localStorage.setItem("userData", JSON.stringify(userData));
        }
        // Only update if state doesn't match to avoid loops
        if (!isAuthenticated || token !== storedToken || JSON.stringify(user) !== JSON.stringify(userData)) {
          setToken(storedToken);
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (error) {
        removeAuthToken();
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
      }
    } else if (isAuthenticated) {
      // Logged out
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  const login = (newToken: string, userData: User) => {
    setToken(newToken);
    setUser(userData);
    setIsAuthenticated(true);
    setAuthToken(newToken);
    localStorage.setItem("userData", JSON.stringify(userData));

    // Register FCM token for push notifications after successful login
    import("../services/pushNotificationService").then(({ registerFCMToken }) => {
      registerFCMToken(true)
        .then(() => {
          // Send test notification after successful token registration
          const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

          fetch(`${apiUrl}/fcm-tokens/test`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${newToken}`,
              'Content-Type': 'application/json'
            }
          })
            .then(response => response.json())
            .then(data => {
              console.log('✅ Test notification sent:', data);
              if (data.success) {
                console.log(`📬 Notification sent to ${data.details?.totalTokens} device(s)`);
              }
            })
            .catch(error => {
              console.error('❌ Failed to send test notification:', error);
            });
        })
        .catch((error) => {
          console.error("Failed to register FCM token:", error);
        });
    });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    removeAuthToken();

    // Remove FCM token on logout
    import("../services/pushNotificationService").then(({ removeFCMToken }) => {
      removeFCMToken().catch((error) => {
        console.error("Failed to remove FCM token:", error);
      });
    });
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    localStorage.setItem("userData", JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        token,
        login,
        logout,
        updateUser,
      }}>
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
