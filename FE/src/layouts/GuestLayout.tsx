import { Navigate, Outlet } from "react-router-dom";

const GuestLayout = () => {
  const accessToken = localStorage.getItem("access");

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default GuestLayout;
