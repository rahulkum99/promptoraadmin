import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AdminStaffUser } from "@/types/adminuser";

export const ACCESS_TOKEN_KEY = "promptora_admin_access_token";
export const REFRESH_TOKEN_KEY = "promptora_admin_refresh_token";
export const STORAGE_BASE_URL_KEY = "promptora_admin_api_base_url";

export function getDefaultApiOrigin(): string {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(STORAGE_BASE_URL_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, "");
    }
  }
  const envUrl =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    (import.meta.env.NEXT_PUBLIC_API_BASE_URL as string | undefined) ||
    "http://127.0.0.1:8000";
  return envUrl.replace(/\/+$/, "");
}

export type AuthState = {
  accessToken: string;
  refreshToken: string;
  staffUser: AdminStaffUser | null;
  apiOrigin: string;
};

const initialState: AuthState = {
  accessToken:
    typeof window !== "undefined"
      ? window.localStorage.getItem(ACCESS_TOKEN_KEY) || ""
      : "",
  refreshToken:
    typeof window !== "undefined"
      ? window.localStorage.getItem(REFRESH_TOKEN_KEY) || ""
      : "",
  staffUser: null,
  apiOrigin: getDefaultApiOrigin(),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{
        access: string;
        refresh?: string;
        user?: AdminStaffUser | null;
      }>
    ) {
      const { access, refresh, user } = action.payload;
      state.accessToken = access;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
      }
      if (refresh) {
        state.refreshToken = refresh;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
        }
      }
      if (user !== undefined) {
        state.staffUser = user;
      }
    },
    setStaffUser(state, action: PayloadAction<AdminStaffUser | null>) {
      state.staffUser = action.payload;
    },
    setApiOriginState(state, action: PayloadAction<string>) {
      const cleaned = action.payload.trim().replace(/\/+$/, "");
      state.apiOrigin = cleaned || getDefaultApiOrigin();
      if (typeof window !== "undefined") {
        if (cleaned) {
          window.localStorage.setItem(STORAGE_BASE_URL_KEY, cleaned);
        } else {
          window.localStorage.removeItem(STORAGE_BASE_URL_KEY);
        }
      }
    },
    clearCredentials(state) {
      state.accessToken = "";
      state.refreshToken = "";
      state.staffUser = null;
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    },
  },
});

export const {
  setCredentials,
  setStaffUser,
  setApiOriginState,
  clearCredentials,
} = authSlice.actions;

export default authSlice.reducer;
