// src/app/router.tsx
import { createBrowserRouter } from "react-router-dom";

// layouts
import DefaultLayout from "@layouts/DefaultLayout";
// import PrivateRoute from "@layouts/PrivateLayout";
import GuestLayout from "@layouts/GuestLayout";

// pages (예시)
import Login from "@pages/auth/Login";
import Folders from "@pages/folders/Folders";
import PreClass from "@pages/class/Pre";
import LiveClass from "@pages/class/Live";
import PostClass from "@pages/class/Post";
import Exam from "@pages/exam/Exam";

import type { NavMeta } from "@widgets/Nav/types";
import SignupShell from "@pages/auth/SignupShell";
import Step1Role from "@pages/auth/steps/Step1Role";
import Step2Access from "@pages/auth/steps/Step2Access";
import Step3TTS from "@pages/auth/steps/Step3TTS";
import Step4Credentials from "@pages/auth/steps/Step4Credentials";

const router = createBrowserRouter([
  {
    path: "/",
    element: <DefaultLayout />,
    children: [
      // 비로그인(게스트)
      {
        element: <GuestLayout />,
        children: [
          {
            path: "/login",
            element: <Login />,
            handle: {
              nav: { variant: "auth", title: "캠퍼스 메이트" } as NavMeta,
            },
          },
          {
            path: "/signup",
            element: <SignupShell />,
            children: [
              { index: true, element: <Step1Role /> },
              { path: "1", element: <Step1Role /> },
              { path: "2", element: <Step2Access /> },
              { path: "3", element: <Step3TTS /> },
              { path: "4", element: <Step4Credentials /> },
            ],
          },
        ],
      },
      // 로그인 필요(프라이빗)
      {
        // element: <PrivateRoute />,
        children: [
          {
            path: "/",
            element: <Folders />,
            handle: { nav: { variant: "folder" } as NavMeta },
          },
          {
            path: "/class/:courseId/pre",
            element: <PreClass />,
            handle: {
              nav: {
                variant: "pre",
                title: ({ courseId }) => `${courseId} - 수업 전`,
              } as NavMeta,
            },
          },
          {
            path: "/class/:courseId/live",
            element: <LiveClass />,
            handle: {
              nav: {
                variant: "live",
                title: ({ courseId }) => `${courseId} - 수업 중`,
              } as NavMeta,
            },
          },
          {
            path: "/class/:courseId/post",
            element: <PostClass />,
            handle: {
              nav: {
                variant: "post",
                title: ({ courseId }) => `${courseId} - 수업 후`,
              } as NavMeta,
            },
          },
          {
            path: "/exam",
            element: <Exam />,
            handle: { nav: { variant: "exam", title: "시험" } as NavMeta },
          },
        ],
      },
    ],
  },
]);

export default router;
