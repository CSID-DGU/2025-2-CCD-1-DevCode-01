import { createBrowserRouter } from "react-router-dom";

//layouts
import DefaultLayout from "@layouts/DefaultLayout";
import PrivateRoute from "@layouts/PrivateLayout";
import GuestLayout from "@layouts/GuestLayout";

//TODO: 플젝에 따라 다르게 설정 필요
const router = createBrowserRouter([
  {
    path: "/",
    element: <DefaultLayout />,
    children: [
      {
        element: <GuestLayout />,
        children: [],
      },
      {
        element: <PrivateRoute />,
        children: [],
      },
    ],
  },
]);

export default router;
