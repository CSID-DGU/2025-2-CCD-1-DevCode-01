//TODO: 플젝 api DTO에 맞게 수정 필요
import axios, { AxiosError } from "axios";

const instance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
  withCredentials: false,
});

// 요청 인터셉터
instance.interceptors.request.use((config) => {
  const access_token = localStorage.getItem("access");

  // 인증이 필요 없는 URL이면 Authorization 헤더 제거
  const publicPaths = ["/api/auth/signup/", "/api/auth/login/"];
  const isPublicPath = publicPaths.some((path) => config.url?.includes(path));

  if (!isPublicPath && access_token) {
    config.headers["Authorization"] = `Bearer ${access_token}`;
  }

  return config;
});

// 토큰 만료 시 리프레시 & 재요청
instance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const errorData = error.response?.data as any;
    const isTokenExpired =
      error.response?.status === 401 &&
      errorData?.code === "token_not_valid" &&
      errorData?.messages?.some(
        (msg: any) => msg.token_class === "AccessToken"
      );

    if (isTokenExpired && !(originalRequest as any)._retry) {
      (originalRequest as any)._retry = true;

      try {
        const refreshToken = localStorage.getItem("refresh");
        if (!refreshToken) throw new Error("No refresh token");

        const res = await axios.post(
          `${import.meta.env.VITE_BASE_URL}/api/auth/refresh/`,
          {
            refresh: refreshToken,
          }
        );

        const newAccessToken = res.data.access;
        localStorage.setItem("access", newAccessToken);

        // 기존 요청에 새 토큰 붙여 재시도
        originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
        return instance(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// POST 요청
export const postResponse = async <TRequest, TResponse>(
  url: string,
  body: TRequest
): Promise<TResponse | null> => {
  try {
    const response = await instance.post<TResponse>(url, body);
    return response.data;
  } catch (error) {
    console.error("POST 요청 실패:", error);
    return null;
  }
};

// GET 요청
export const getResponse = async <T>(url: string): Promise<T | null> => {
  try {
    const response = await instance.get(url);
    return response.data;
  } catch (error) {
    console.error("GET 요청 실패:", error);
    return null;
  }
};

export default instance;
