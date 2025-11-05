import { createBrowserRouter } from "react-router-dom";
import DefaultLayout from "@layouts/DefaultLayout";
import GuestLayout from "@layouts/GuestLayout";

import Login from "@pages/auth/Login";

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
import FoldersRoute from "./FoldersRoute";

const router = createBrowserRouter([
  {
    path: "/",
    element: <DefaultLayout />,
    children: [
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
      {
        // element: <PrivateRoute />,
        children: [
          {
            path: "/",
            element: <FoldersRoute />, // ✅ 홈
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
