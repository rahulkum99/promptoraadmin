import {
  ACCESS_TOKEN_KEY,
  clearCredentials,
  REFRESH_TOKEN_KEY,
  setApiOriginState,
  setCredentials,
  STORAGE_BASE_URL_KEY,
} from "@/store/authSlice";
import { refreshTokensSingleFlight } from "@/store/adminuserApi";
import { store } from "@/store";
import type {
  AdminBlogPost,
  AdminBroadcastRequest,
  AdminBroadcastResult,
  AdminCategory,
  AdminCreatorProfile,
  AdminCreditPackage,
  AdminCreditPricingRule,
  AdminCreditPurchase,
  AdminCreditTransaction,
  AdminDashboardAnalytics,
  AdminGeneration,
  AdminLoginResponse,
  AdminPrompt,
  AdminPromptImage,
  AdminStaffUser,
  AdminTag,
  AdminUser,
  AdminWeeklyTheme,
  ApiSuccess,
  BulkPromptActionType,
  PlatformSettings,
  PlatformSettingsPatch,
  PromptJsonPayload,
} from "@/types/adminuser";
import { sanitizeBroadcastRequest } from "@/types/adminuser";

export function getApiOrigin(): string {
  const fromStore = store.getState()?.auth?.apiOrigin;
  if (fromStore) return fromStore.replace(/\/+$/, "");
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

export function setApiOrigin(origin: string): void {
  store.dispatch(setApiOriginState(origin));
}

function getApiBase(): string {
  return `${getApiOrigin()}/api/v1/adminuser`;
}

export type AdminApiError = Error & {
  status?: number;
  errors?: Record<string, string[]>;
};

/**
 * Wrapper around fetch that automatically refreshes expired JWT access tokens on 401
 * using the single-flight refresh mutex and syncs new access & rotated refresh tokens
 * into Redux + localStorage before retrying the request.
 */
async function fetchWithAuthRetry(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const currentAccess =
    store.getState()?.auth?.accessToken ||
    (typeof window !== "undefined"
      ? window.localStorage.getItem(ACCESS_TOKEN_KEY) || ""
      : "");
  if (currentAccess && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${currentAccess}`);
  }

  let res = await fetch(url, { ...init, headers });

  if (
    res.status === 401 &&
    !url.includes("/login/") &&
    !url.includes("/auth/token/refresh/")
  ) {
    const refreshToken =
      store.getState()?.auth?.refreshToken ||
      (typeof window !== "undefined"
        ? window.localStorage.getItem(REFRESH_TOKEN_KEY) || ""
        : "");
    if (refreshToken) {
      const refreshed = await refreshTokensSingleFlight(
        getApiOrigin(),
        refreshToken
      );
      if (refreshed?.access) {
        store.dispatch(
          setCredentials({
            access: refreshed.access,
            refresh: refreshed.refresh,
          })
        );
        const retryHeaders = new Headers(init.headers);
        retryHeaders.set("Authorization", `Bearer ${refreshed.access}`);
        res = await fetch(url, { ...init, headers: retryHeaders });
      } else {
        store.dispatch(clearCredentials());
      }
    } else {
      store.dispatch(clearCredentials());
    }
  }

  return res;
}

async function handleResponse<T>(res: Response): Promise<ApiSuccess<T>> {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  if (!res.ok || payload.success === false) {
    const message =
      (typeof payload.message === "string" && payload.message) ||
      (typeof payload.detail === "string" && payload.detail) ||
      `Admin API request failed (${res.status})`;
    const error = new Error(message) as AdminApiError;
    error.status = res.status;
    if (payload.errors && typeof payload.errors === "object") {
      error.errors = payload.errors as Record<string, string[]>;
    }
    throw error;
  }
  return payload as unknown as ApiSuccess<T>;
}

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      sp.set(key, String(val));
    }
  }
  const str = sp.toString();
  return str ? `?${str}` : "";
}

// ---------------------------------------------------------------------------
// 1. Staff Authentication & Profile
// ---------------------------------------------------------------------------

export async function loginAdminStaff(email: string, password: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<AdminLoginResponse>(res);
}

export async function refreshAdminToken(refresh: string) {
  const refreshed = await refreshTokensSingleFlight(getApiOrigin(), refresh);
  if (!refreshed?.access) {
    const err = new Error("Invalid refresh token.") as AdminApiError;
    err.status = 401;
    throw err;
  }
  store.dispatch(
    setCredentials({
      access: refreshed.access,
      refresh: refreshed.refresh,
    })
  );
  return {
    success: true as const,
    message: "Token refreshed.",
    data: refreshed,
  };
}

export async function logoutAdminStaff(accessToken: string, refresh: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/auth/logout/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh }),
  });
  return handleResponse<null>(res);
}

export async function fetchAdminMe(accessToken: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/me/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminStaffUser>(res);
}

export async function updateAdminMe(
  accessToken: string,
  payload: { display_name?: string; bio?: string; hide_mature?: boolean; avatar?: File | null }
) {
  const formData = new FormData();
  if (payload.display_name !== undefined) formData.append("display_name", payload.display_name);
  if (payload.bio !== undefined) formData.append("bio", payload.bio);
  if (payload.hide_mature !== undefined) formData.append("hide_mature", String(payload.hide_mature));
  if (payload.avatar) formData.append("avatar", payload.avatar);

  const res = await fetchWithAuthRetry(`${getApiBase()}/me/`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  return handleResponse<AdminStaffUser>(res);
}

// ---------------------------------------------------------------------------
// 2. Dashboard Analytics
// ---------------------------------------------------------------------------

export async function fetchAdminDashboard(accessToken: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/dashboard/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminDashboardAnalytics>(res);
}

export async function fetchAdminSettings(accessToken: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/settings/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<PlatformSettings>(res);
}

export async function updateAdminSettings(
  accessToken: string,
  data: PlatformSettingsPatch
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/settings/`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<PlatformSettings>(res);
}

// ---------------------------------------------------------------------------
// 3. Prompt Upload (JSON + Image), Bulk Upload, CRUD & Moderation
// ---------------------------------------------------------------------------

/**
 * Mode A: Upload Prompt via JSON Object (`prompt_json`) + Preview Image (Multipart)
 * IMPORTANT: Do NOT set Content-Type manually when sending FormData;
 * the browser automatically sets `multipart/form-data; boundary=...`.
 */
export async function uploadPromptFromJsonAndImage(params: {
  accessToken: string;
  promptJson: PromptJsonPayload | string;
  previewImage?: File | null;
  additionalImages?: File[];
  updateExisting?: boolean;
}) {
  const formData = new FormData();

  const jsonString =
    typeof params.promptJson === "string"
      ? params.promptJson
      : JSON.stringify(params.promptJson);

  formData.append("prompt_json", jsonString);

  if (params.previewImage) {
    formData.append("preview_image", params.previewImage);
  }

  if (params.additionalImages?.length) {
    for (const file of params.additionalImages) {
      formData.append("additional_images", file);
    }
  }

  if (params.updateExisting !== undefined) {
    formData.append("update_existing", String(params.updateExisting));
  }

  const res = await fetchWithAuthRetry(`${getApiBase()}/prompts/upload/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: formData,
  });

  return handleResponse<AdminPrompt>(res);
}

/**
 * Mode B: Upload Prompt via Individual Form Fields + Image File
 */
export async function uploadPromptFromFormFields(params: {
  accessToken: string;
  fields: PromptJsonPayload;
  previewImage?: File | null;
  additionalImages?: File[];
  updateExisting?: boolean;
}) {
  const formData = new FormData();
  const { fields } = params;

  formData.append("title", fields.title);
  if (fields.slug) formData.append("slug", fields.slug);
  if (fields.description) formData.append("description", fields.description);
  formData.append("prompt_text", fields.prompt_text);
  if (fields.negative_prompt) formData.append("negative_prompt", fields.negative_prompt);
  formData.append("category", fields.category);
  if (fields.tags?.length) formData.append("tags", JSON.stringify(fields.tags));
  if (fields.aspect_ratio) formData.append("aspect_ratio", fields.aspect_ratio);
  if (fields.ai_tool) formData.append("ai_tool", fields.ai_tool);
  if (fields.generation_settings) {
    formData.append("generation_settings", JSON.stringify(fields.generation_settings));
  }
  if (fields.is_featured !== undefined) formData.append("is_featured", String(fields.is_featured));
  if (fields.is_premium !== undefined) formData.append("is_premium", String(fields.is_premium));
  if (fields.is_mature !== undefined) formData.append("is_mature", String(fields.is_mature));
  if (fields.is_private !== undefined) formData.append("is_private", String(fields.is_private));
  if (fields.status) formData.append("status", fields.status);
  if (fields.moderation_notes) formData.append("moderation_notes", fields.moderation_notes);
  if (fields.popularity_score !== undefined) {
    formData.append("popularity_score", String(fields.popularity_score));
  }
  if (params.updateExisting !== undefined) {
    formData.append("update_existing", String(params.updateExisting));
  }
  if (params.previewImage) {
    formData.append("preview_image", params.previewImage);
  }
  if (params.additionalImages?.length) {
    for (const file of params.additionalImages) {
      formData.append("additional_images", file);
    }
  }

  const res = await fetchWithAuthRetry(`${getApiBase()}/prompts/upload/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.accessToken}` },
    body: formData,
  });

  return handleResponse<AdminPrompt>(res);
}

/**
 * Bulk Upload Multiple Prompts from a JSON Array + Optional Mapped Images
 */
export async function bulkUploadPrompts(params: {
  accessToken: string;
  promptsJson: PromptJsonPayload[] | string;
  images?: File[];
  updateExisting?: boolean;
}) {
  const formData = new FormData();
  const jsonString =
    typeof params.promptsJson === "string"
      ? params.promptsJson
      : JSON.stringify(params.promptsJson);

  formData.append("prompts", jsonString);
  formData.append("update_existing", String(params.updateExisting ?? true));

  if (params.images?.length) {
    for (const file of params.images) {
      formData.append("images", file);
    }
  }

  const res = await fetchWithAuthRetry(`${getApiBase()}/prompts/bulk-upload/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.accessToken}` },
    body: formData,
  });

  return handleResponse<AdminPrompt[]>(res);
}

export async function bulkPromptAction(params: {
  accessToken: string;
  promptIds: string[];
  action: BulkPromptActionType;
}) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/prompts/bulk-action/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt_ids: params.promptIds,
      action: params.action,
    }),
  });
  return handleResponse<{ action: string; affected_count: number }>(res);
}

export async function fetchAdminPrompts(
  accessToken: string,
  filters?: {
    page?: number;
    status?: string;
    category?: string;
    search?: string;
    featured?: boolean | string;
    premium?: boolean | string;
    is_private?: boolean | string;
    ordering?: string;
  }
) {
  const query = buildQuery(filters);
  const res = await fetchWithAuthRetry(`${getApiBase()}/prompts/${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminPrompt[]>(res);
}

export async function fetchAdminPromptBySlug(accessToken: string, slug: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/prompts/${encodeURIComponent(slug)}/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminPrompt>(res);
}

export async function updateAdminPromptBySlug(params: {
  accessToken: string;
  slug: string;
  promptJson?: Partial<PromptJsonPayload> | string;
  previewImage?: File | null;
}) {
  const formData = new FormData();
  if (params.promptJson !== undefined) {
    const jsonStr =
      typeof params.promptJson === "string"
        ? params.promptJson
        : JSON.stringify(params.promptJson);
    formData.append("prompt_json", jsonStr);
  }
  if (params.previewImage) {
    formData.append("preview_image", params.previewImage);
  }

  const res = await fetchWithAuthRetry(`${getApiBase()}/prompts/${encodeURIComponent(params.slug)}/`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${params.accessToken}` },
    body: formData,
  });
  return handleResponse<AdminPrompt>(res);
}

export async function deleteAdminPromptBySlug(accessToken: string, slug: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/prompts/${encodeURIComponent(slug)}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handleResponse<null>(res);
}

export async function uploadAdminPromptImage(
  accessToken: string,
  promptId: string,
  imageFile: File
) {
  const formData = new FormData();
  formData.append("image", imageFile);

  const res = await fetchWithAuthRetry(`${getApiBase()}/prompts/${promptId}/images/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  return handleResponse<AdminPromptImage>(res);
}

export async function deleteAdminPromptImage(
  accessToken: string,
  promptId: string,
  imageId: string
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/prompts/${promptId}/images/${imageId}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handleResponse<null>(res);
}

export async function approveAdminPrompt(accessToken: string, promptId: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/prompts/${promptId}/approve/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  return handleResponse<AdminPrompt>(res);
}

export async function rejectAdminPrompt(
  accessToken: string,
  promptId: string,
  reason: string
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/prompts/${promptId}/reject/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });
  return handleResponse<AdminPrompt>(res);
}

// ---------------------------------------------------------------------------
// 4. Categories, Tags & Weekly Themes
// ---------------------------------------------------------------------------

export async function fetchAdminCategories(
  accessToken: string,
  params?: { is_active?: string; page?: number }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/categories/${buildQuery(params)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminCategory[]>(res);
}

export async function fetchAdminCategoryBySlug(accessToken: string, slug: string) {
  const res = await fetchWithAuthRetry(
    `${getApiBase()}/categories/${encodeURIComponent(slug)}/`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );
  return handleResponse<AdminCategory>(res);
}

export async function createAdminCategory(
  accessToken: string,
  data: {
    name: string;
    slug?: string;
    description?: string;
    is_active?: boolean;
    display_order?: number;
    thumbnail?: File | null;
  }
) {
  const formData = new FormData();
  formData.append("name", data.name);
  if (data.slug) formData.append("slug", data.slug);
  if (data.description !== undefined) formData.append("description", data.description);
  if (data.is_active !== undefined) formData.append("is_active", String(data.is_active));
  if (data.display_order !== undefined) formData.append("display_order", String(data.display_order));
  if (data.thumbnail) formData.append("thumbnail", data.thumbnail);

  const res = await fetchWithAuthRetry(`${getApiBase()}/categories/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  return handleResponse<AdminCategory>(res);
}

export async function updateAdminCategory(
  accessToken: string,
  slug: string,
  data: {
    name?: string;
    slug?: string;
    description?: string;
    is_active?: boolean;
    display_order?: number;
    thumbnail?: File | null;
  }
) {
  const formData = new FormData();
  if (data.name !== undefined) formData.append("name", data.name);
  if (data.slug !== undefined) formData.append("slug", data.slug);
  if (data.description !== undefined) formData.append("description", data.description);
  if (data.is_active !== undefined) formData.append("is_active", String(data.is_active));
  if (data.display_order !== undefined) formData.append("display_order", String(data.display_order));
  if (data.thumbnail) formData.append("thumbnail", data.thumbnail);

  const res = await fetchWithAuthRetry(`${getApiBase()}/categories/${encodeURIComponent(slug)}/`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  return handleResponse<AdminCategory>(res);
}

export async function deleteAdminCategory(accessToken: string, slug: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/categories/${encodeURIComponent(slug)}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handleResponse<null>(res);
}

export async function fetchAdminTags(
  accessToken: string,
  params?: { search?: string; page?: number }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/tags/${buildQuery(params)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminTag[]>(res);
}

export async function createAdminTag(
  accessToken: string,
  data: { name: string; slug?: string }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/tags/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<AdminTag>(res);
}

export async function updateAdminTag(
  accessToken: string,
  slug: string,
  data: { name?: string; slug?: string }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/tags/${encodeURIComponent(slug)}/`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<AdminTag>(res);
}

export async function deleteAdminTag(accessToken: string, slug: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/tags/${encodeURIComponent(slug)}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handleResponse<null>(res);
}

export async function fetchAdminWeeklyThemes(accessToken: string, params?: { page?: number }) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/weekly-themes/${buildQuery(params)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminWeeklyTheme[]>(res);
}

export async function createAdminWeeklyTheme(
  accessToken: string,
  data: {
    category_id?: string | null;
    tag_id?: string | null;
    starts_on: string;
    ends_on: string;
  }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/weekly-themes/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<AdminWeeklyTheme>(res);
}

export async function deleteAdminWeeklyTheme(accessToken: string, themeId: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/weekly-themes/${themeId}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handleResponse<null>(res);
}

// ---------------------------------------------------------------------------
// 5. Users, Staff Roles & Creators
// ---------------------------------------------------------------------------

export async function fetchAdminUsers(
  accessToken: string,
  params?: {
    page?: number;
    role?: string;
    is_staff?: string;
    is_active?: string;
    search?: string;
  }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/users/${buildQuery(params)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminUser[]>(res);
}

export async function createAdminUser(
  accessToken: string,
  data: {
    email: string;
    password?: string;
    display_name: string;
    bio?: string;
    role?: "user" | "creator" | "admin";
    is_staff?: boolean;
    is_superuser?: boolean;
    is_prompt_manager?: boolean;
    is_active?: boolean;
    email_verified?: boolean;
  }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/users/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<AdminUser>(res);
}

export async function fetchAdminUserDetail(accessToken: string, userId: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/users/${userId}/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminUser>(res);
}

export async function updateAdminUser(
  accessToken: string,
  userId: string,
  data: {
    display_name?: string;
    bio?: string;
    password?: string;
    role?: "user" | "creator" | "admin";
    is_staff?: boolean;
    is_superuser?: boolean;
    is_prompt_manager?: boolean;
    is_active?: boolean;
    email_verified?: boolean;
    hide_mature?: boolean;
  }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/users/${userId}/`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<AdminUser>(res);
}

export async function adjustUserCredits(params: {
  accessToken: string;
  userId: string;
  creditsDelta: number;
  reason: string;
  referenceId?: string;
}) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/users/${params.userId}/credits/adjust/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      credits_delta: params.creditsDelta,
      reason: params.reason,
      reference_id: params.referenceId || "",
    }),
  });
  return handleResponse<AdminCreditTransaction>(res);
}

export async function extendUserEntitlement(params: {
  accessToken: string;
  userId: string;
  days: number;
}) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/users/${params.userId}/entitlement/extend/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ days: params.days }),
  });
  return handleResponse<Record<string, unknown>>(res);
}

export async function fetchAdminCreators(
  accessToken: string,
  params?: { page?: number; status?: string; search?: string }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/creators/${buildQuery(params)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminCreatorProfile[]>(res);
}

export async function approveAdminCreator(accessToken: string, userId: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/creators/${userId}/approve/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  return handleResponse<AdminCreatorProfile>(res);
}

export async function rejectAdminCreator(
  accessToken: string,
  userId: string,
  reviewNotes: string
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/creators/${userId}/reject/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ review_notes: reviewNotes }),
  });
  return handleResponse<AdminCreatorProfile>(res);
}

export async function suspendAdminCreator(
  accessToken: string,
  userId: string,
  reviewNotes: string
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/creators/${userId}/suspend/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ review_notes: reviewNotes }),
  });
  return handleResponse<AdminCreatorProfile>(res);
}

// ---------------------------------------------------------------------------
// 6. Billing, Credit Packages, Pricing Rules & Ledger
// ---------------------------------------------------------------------------

export async function fetchCreditPackages(accessToken: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/billing/packages/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminCreditPackage[]>(res);
}

export async function createCreditPackage(
  accessToken: string,
  data: Omit<AdminCreditPackage, "id" | "slug"> & { slug?: string }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/billing/packages/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<AdminCreditPackage>(res);
}

export async function updateCreditPackage(
  accessToken: string,
  packageId: string,
  data: Partial<Omit<AdminCreditPackage, "id">>
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/billing/packages/${packageId}/`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<AdminCreditPackage>(res);
}

export async function deleteCreditPackage(accessToken: string, packageId: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/billing/packages/${packageId}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handleResponse<null>(res);
}

export async function fetchPricingRules(accessToken: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/billing/pricing-rules/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminCreditPricingRule[]>(res);
}

export async function createPricingRule(
  accessToken: string,
  data: {
    model_name: string;
    quality: string;
    size: string;
    credits_required: number;
    is_active?: boolean;
  }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/billing/pricing-rules/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<AdminCreditPricingRule>(res);
}

export async function updatePricingRule(
  accessToken: string,
  ruleId: string,
  data: Partial<{
    model_name: string;
    quality: string;
    size: string;
    credits_required: number;
    is_active: boolean;
  }>
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/billing/pricing-rules/${ruleId}/`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<AdminCreditPricingRule>(res);
}

export async function deletePricingRule(accessToken: string, ruleId: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/billing/pricing-rules/${ruleId}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handleResponse<null>(res);
}

export async function fetchCreditPurchases(
  accessToken: string,
  params?: {
    page?: number;
    status?: string;
    user_id?: string;
    reconciliation_required?: string;
  }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/billing/purchases/${buildQuery(params)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminCreditPurchase[]>(res);
}

export async function fetchCreditTransactions(
  accessToken: string,
  params?: {
    page?: number;
    transaction_type?: string;
    user_id?: string;
  }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/billing/transactions/${buildQuery(params)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminCreditTransaction[]>(res);
}

// ---------------------------------------------------------------------------
// 7. Generations Monitor, Blog CRUD & Push Broadcasts
// ---------------------------------------------------------------------------

export async function fetchAdminGenerations(
  accessToken: string,
  params?: {
    page?: number;
    status?: string;
    provider?: string;
    user_id?: string;
  }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/generations/${buildQuery(params)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminGeneration[]>(res);
}

export async function cancelAdminGeneration(
  accessToken: string,
  generationId: string,
  reason: string
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/generations/${generationId}/cancel/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });
  return handleResponse<AdminGeneration>(res);
}

export async function fetchAdminBlogPosts(
  accessToken: string,
  params?: {
    page?: number;
    status?: string;
    search?: string;
    ordering?: string;
  }
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/blog/${buildQuery(params)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminBlogPost[]>(res);
}

export async function fetchAdminBlogPostBySlug(accessToken: string, slug: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/blog/${encodeURIComponent(slug)}/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return handleResponse<AdminBlogPost>(res);
}

export async function createAdminBlogPost(
  accessToken: string,
  data: {
    title: string;
    slug?: string;
    excerpt?: string;
    content: string;
    cover_image?: File | null;
    cover_image_alt?: string;
    category_id?: string;
    tags?: string[];
    status?: "draft" | "published" | "archived";
    is_featured?: boolean;
    meta_title?: string;
    meta_description?: string;
    meta_keywords?: string;
    canonical_url?: string;
    is_indexed?: boolean;
  }
) {
  const formData = new FormData();
  formData.append("title", data.title);
  if (data.slug) formData.append("slug", data.slug);
  if (data.excerpt !== undefined) formData.append("excerpt", data.excerpt);
  formData.append("content", data.content);
  if (data.cover_image) formData.append("cover_image", data.cover_image);
  if (data.cover_image_alt) formData.append("cover_image_alt", data.cover_image_alt);
  if (data.category_id) formData.append("category_id", data.category_id);
  if (data.tags?.length) {
    for (const tag of data.tags) {
      formData.append("tags", tag);
    }
  }
  if (data.status) formData.append("status", data.status);
  if (data.is_featured !== undefined) formData.append("is_featured", String(data.is_featured));
  if (data.meta_title) formData.append("meta_title", data.meta_title);
  if (data.meta_description) formData.append("meta_description", data.meta_description);
  if (data.meta_keywords) formData.append("meta_keywords", data.meta_keywords);
  if (data.canonical_url) formData.append("canonical_url", data.canonical_url);
  if (data.is_indexed !== undefined) formData.append("is_indexed", String(data.is_indexed));

  const res = await fetchWithAuthRetry(`${getApiBase()}/blog/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  return handleResponse<AdminBlogPost>(res);
}

export async function updateAdminBlogPost(
  accessToken: string,
  slug: string,
  data: Partial<{
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    cover_image: File | null;
    cover_image_alt: string;
    category_id: string;
    tags: string[];
    status: "draft" | "published" | "archived";
    is_featured: boolean;
    meta_title: string;
    meta_description: string;
    meta_keywords: string;
    canonical_url: string;
    is_indexed: boolean;
  }>
) {
  const formData = new FormData();
  if (data.title !== undefined) formData.append("title", data.title);
  if (data.slug !== undefined) formData.append("slug", data.slug);
  if (data.excerpt !== undefined) formData.append("excerpt", data.excerpt);
  if (data.content !== undefined) formData.append("content", data.content);
  if (data.cover_image) formData.append("cover_image", data.cover_image);
  if (data.cover_image_alt !== undefined) formData.append("cover_image_alt", data.cover_image_alt);
  if (data.category_id !== undefined) formData.append("category_id", data.category_id);
  if (data.tags !== undefined) {
    for (const tag of data.tags) {
      formData.append("tags", tag);
    }
  }
  if (data.status !== undefined) formData.append("status", data.status);
  if (data.is_featured !== undefined) formData.append("is_featured", String(data.is_featured));
  if (data.meta_title !== undefined) formData.append("meta_title", data.meta_title);
  if (data.meta_description !== undefined) formData.append("meta_description", data.meta_description);
  if (data.meta_keywords !== undefined) formData.append("meta_keywords", data.meta_keywords);
  if (data.canonical_url !== undefined) formData.append("canonical_url", data.canonical_url);
  if (data.is_indexed !== undefined) formData.append("is_indexed", String(data.is_indexed));

  const res = await fetchWithAuthRetry(`${getApiBase()}/blog/${encodeURIComponent(slug)}/`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  return handleResponse<AdminBlogPost>(res);
}

export async function deleteAdminBlogPost(accessToken: string, slug: string) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/blog/${encodeURIComponent(slug)}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handleResponse<null>(res);
}

export async function broadcastAdminNotification(
  accessToken: string,
  payload: AdminBroadcastRequest
) {
  const res = await fetchWithAuthRetry(`${getApiBase()}/notifications/broadcast/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sanitizeBroadcastRequest(payload)),
  });
  return handleResponse<AdminBroadcastResult>(res);
}
