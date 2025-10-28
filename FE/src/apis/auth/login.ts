import { postResponse } from "@apis/instance";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

export const loginApi = async (data: LoginRequest) => {
  const res = await postResponse<LoginRequest, LoginResponse>(
    "/api/auth/login/",
    data
  );
  return res;
};
