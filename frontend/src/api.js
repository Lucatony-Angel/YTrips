// Central axios instance used everywhere in the app. Two interceptors do the
// heavy lifting: one attaches the JWT to every request, the other redirects
// to /login automatically if the server says the token is expired or invalid.
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// attach jwt
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };
