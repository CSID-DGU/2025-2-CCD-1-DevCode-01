import toast from "react-hot-toast";
import { Navigate, Outlet } from "react-router-dom";

const PrivateRoute = () => {
  const accessToken = localStorage.getItem("access");

  if (!accessToken) {
    toast.error("로그인이 필요합니다.");
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;
