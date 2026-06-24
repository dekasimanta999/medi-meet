import { Navigate, Outlet } from "react-router";

export const AdminRoute = () => {
  const userStr = localStorage.getItem("userInfo") || sessionStorage.getItem("userInfo");
  const userInfo = userStr ? JSON.parse(userStr) : null;

  // Only allow access if user is logged in AND isAdmin is true
  return userInfo && userInfo.isAdmin ? <Outlet /> : <Navigate to="/" replace />;
};