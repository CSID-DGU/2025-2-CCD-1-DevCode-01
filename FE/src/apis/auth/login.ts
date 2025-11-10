import { postResponse } from "@apis/instance";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  role: "student" | "helper" | string;
  font: number;
  high_contrast: boolean;
  username: string;
  message?: string;
}

export const loginApi = async (data: LoginRequest) => {
  const res = await postResponse<LoginRequest, LoginResponse>(
    "/auth/login/",
    data
  );
  return res;
};
