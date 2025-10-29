// src/shared/api.ts
import axios, {
  AxiosError,
  type AxiosRequestHeaders,
  type InternalAxiosRequestConfig,
} from "axios";

const instance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
  withCredentials: false,
});

// 401 토큰 만료 에러 응답 형태(프로젝트에 맞게 필요시 확장)
type TokenErrorBody = {
  code?: string; // "token_not_valid"
  messages?: Array<{ token_class?: "AccessToken" | "RefreshToken" | string }>;
};

// retry 플래그를 추가한 요청 타입
type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

const PUBLIC_PATHS = [
  "/api/auth/signup/",
  "/api/auth/login/",
  "/api/auth/refresh/",
];

/* -------------------- Request interceptor -------------------- */
instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken = localStorage.getItem("access");

  const headers = (config.headers ?? {}) as AxiosRequestHeaders;

  const isPublic = PUBLIC_PATHS.some((path) =>
    (config.url ?? "").includes(path)
  );
  if (!isPublic && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  config.headers = headers;
  return config;
});

/* -------------------- Response interceptor ------------------- */
instance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<TokenErrorBody>) => {
    const original = error.config as RetriableRequest | undefined;
    if (!original) return Promise.reject(error);

    const body = error.response?.data;
    const isTokenExpired =
      error.response?.status === 401 &&
      body?.code === "token_not_valid" &&
      (body.messages ?? []).some((m) => m.token_class === "AccessToken");

    if (isTokenExpired && !original._retry) {
      original._retry = true;

      try {
        const refresh = localStorage.getItem("refresh");
        if (!refresh) throw new Error("No refresh token");

        const res = await axios.post<{ access: string }>(
          `${import.meta.env.VITE_BASE_URL}/api/auth/refresh/`,
          { refresh },
          { withCredentials: false }
        );

        const newAccess = res.data.access;
        localStorage.setItem("access", newAccess);

        const headers = (original.headers ?? {}) as AxiosRequestHeaders;
        headers.Authorization = `Bearer ${newAccess}`;
        original.headers = headers;

        return instance(original);
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

/* -------------------- Helpers -------------------- */
export const postResponse = async <TRequest, TResponse>(
  url: string,
  body: TRequest
): Promise<TResponse | null> => {
  try {
    const res = await instance.post<TResponse>(url, body);
    return res.data;
  } catch (e: unknown) {
    console.error("POST 요청 실패:", e);
    return null;
  }
};

export const postNoResponse = async <TRequest>(
  url: string,
  body: TRequest
): Promise<boolean> => {
  try {
    await instance.post<void>(url, body);
    return true;
  } catch (e: unknown) {
    console.error("POST(무응답) 실패:", e);
    return false;
  }
};

export const getResponse = async <T>(url: string): Promise<T | null> => {
  try {
    const res = await instance.get<T>(url);
    return res.data;
  } catch (e: unknown) {
    console.error("GET 요청 실패:", e);
    return null;
  }
};

export default instance;
