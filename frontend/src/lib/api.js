// Centralised axios client with auth token injection and refresh handling.
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BASE_URL}/api`;
export const API_V1 = `${BASE_URL}/api/v1`;

const TOKEN_KEY = 'krishisetu_access_token';
const REFRESH_KEY = 'krishisetu_refresh_token';

export function getToken() {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY);
}
export function getRefreshToken() {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(REFRESH_KEY);
}
export function setTokens(access, refresh) {
  if (access) window.localStorage.setItem(TOKEN_KEY, access);
  if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearTokens() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

const api = axios.create({
  baseURL: API_V1,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && getRefreshToken()) {
      original._retry = true;
      try {
        refreshing = refreshing || axios.post(`${API_V1}/auth/refresh`, { refreshToken: getRefreshToken() });
        const { data } = await refreshing;
        refreshing = null;
        setTokens(data.accessToken, null);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return axios(original);
      } catch {
        refreshing = null;
        clearTokens();
      }
    }
    return Promise.reject(error);
  }
);

// Legacy API (anonymous) — for the demo landing view
export const legacyApi = axios.create({ baseURL: API_BASE });

export default api;
