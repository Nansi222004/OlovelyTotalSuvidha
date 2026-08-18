import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SellerUnderReview from "../modules/seller/pages/SellerUnderReview";
import DeliveryUnderReview from "../modules/delivery/pages/DeliveryUnderReview";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  requiredUserType?: "Admin" | "Seller" | "Customer" | "Delivery";
  redirectTo?: string;
  allowUnapproved?: boolean;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requiredUserType,
  redirectTo = "/login",
  allowUnapproved = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, token } = useAuth();
  const location = useLocation();

  // Check authentication
  if (!isAuthenticated || !token) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check user type if required
  if (requiredUserType && user) {
    // Check userType or role field
    // Admin users have role: "Admin" or "Super Admin"
    // For Admin userType check, we need to verify the user is an admin
    const userType = (user as any).userType || (user as any).role;

    // For Admin routes, check if role is "Admin" or "Super Admin"
    if (requiredUserType === "Admin") {
      const isAdmin = userType === "Admin" || userType === "Super Admin";
      if (!isAdmin) {
        return <Navigate to="/admin/login" state={{ from: location }} replace />;
      }
    } else if (userType && userType !== requiredUserType) {
      return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }
  }

  // Check role if required (for Admin users)
  if (requiredRole && user) {
    const userRole = (user as any).role;
    if (!userRole || userRole !== requiredRole) {
      return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }
  }

  // Check approval/activation status for operational routes
  if (!allowUnapproved && user) {
    if (requiredUserType === "Seller" || (user as any).userType === "Seller") {
      const status = (user as any).status;
      if (status === "Pending" || status === "Rejected" || status !== "Approved") {
        return <SellerUnderReview />;
      }
    } else if (requiredUserType === "Delivery" || (user as any).userType === "Delivery") {
      const status = (user as any).status;
      if (status === "Inactive" || status === "Pending" || status !== "Active") {
        return <DeliveryUnderReview />;
      }
    }
  }

  return <>{children}</>;
}
