import { Navigate, Outlet } from "react-router-dom";

const GuestLayout = () => {
  const accessToken = localStorage.getItem("access");

  if (accessToken) {
    // TODO: 로그인 상태라면 어디로 보내줄지
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default GuestLayout;
