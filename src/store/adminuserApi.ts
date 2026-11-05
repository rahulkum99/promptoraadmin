import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import {
  ACCESS_TOKEN_KEY,
  clearCredentials,
  getDefaultApiOrigin,
  REFRESH_TOKEN_KEY,
  setCredentials,
  type AuthState,
} from "@/store/authSlice";
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

type RootStateWithAuth = {
  auth: AuthState;
};

/**
 * Single-flight mutex promise so concurrent 401 requests or React StrictMode
 * double-invocations never call `/auth/token/refresh/` twice with the same
 * single-use refresh token (which fails when ROTATE_REFRESH_TOKENS +
 * BLACKLIST_AFTER_ROTATION are enabled on the Django backend).
 */
let activeRefreshPromise: Promise<{ access: string; refresh?: string } | null> | null =
  null;

export async function refreshTokensSingleFlight(
  apiOrigin: string,
  refreshToken: string
): Promise<{ access: string; refresh?: string } | null> {
  if (!refreshToken) return null;
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const cleanOrigin = apiOrigin.replace(/\/+$/, "");
      const res = await fetch(
        `${cleanOrigin}/api/v1/adminuser/auth/token/refresh/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: refreshToken }),
        }
      );

      let payload: Record<string, unknown> = {};
      try {
        payload = (await res.json()) as Record<string, unknown>;
      } catch {
        payload = {};
      }

      if (!res.ok || payload.success === false) {
        return null;
      }

      // Support both Promptora envelope `{ success: true, data: { access, refresh } }`
      // and raw SimpleJWT `{ access, refresh }`
      const dataObj =
        payload.data && typeof payload.data === "object"
          ? (payload.data as Record<string, unknown>)
          : payload;

      const nextAccess =
        typeof dataObj.access === "string" ? dataObj.access : "";
      const nextRefresh =
        typeof dataObj.refresh === "string" ? dataObj.refresh : undefined;

      if (!nextAccess) return null;
      return { access: nextAccess, refresh: nextRefresh };
    } catch {
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

const dynamicRawBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const state = api.getState() as RootStateWithAuth;
  const origin = state?.auth?.apiOrigin || getDefaultApiOrigin();
  const baseUrl = `${origin.replace(/\/+$/, "")}/api/v1/adminuser/`;

  const rawBaseQuery = fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers, { getState }) => {
      const currentState = getState() as RootStateWithAuth;
      const token =
        currentState?.auth?.accessToken ||
        (typeof window !== "undefined"
          ? window.localStorage.getItem(ACCESS_TOKEN_KEY)
          : "");
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  });

  return rawBaseQuery(args, api, extraOptions);
};

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await dynamicRawBaseQuery(args, api, extraOptions);

  // Determine the request path to avoid infinite refresh loops on login/refresh endpoints
  const requestUrl = typeof args === "string" ? args : args.url;
  const isAuthEndpoint =
    requestUrl.includes("login/") || requestUrl.includes("auth/token/refresh/");

  if (result.error && result.error.status === 401 && !isAuthEndpoint) {
    const state = api.getState() as RootStateWithAuth;
    const refreshToken =
      state?.auth?.refreshToken ||
      (typeof window !== "undefined"
        ? window.localStorage.getItem(REFRESH_TOKEN_KEY) || ""
        : "");
    const apiOrigin = state?.auth?.apiOrigin || getDefaultApiOrigin();

    if (refreshToken) {
      const refreshed = await refreshTokensSingleFlight(apiOrigin, refreshToken);
      if (refreshed?.access) {
        api.dispatch(
          setCredentials({
            access: refreshed.access,
            refresh: refreshed.refresh,
          })
        );
        // Retry the original request with the newly stored access token
        result = await dynamicRawBaseQuery(args, api, extraOptions);
      } else {
        api.dispatch(clearCredentials());
      }
    } else {
      api.dispatch(clearCredentials());
    }
  }

  return result;
};

/** Helper to extract a clean error message and field errors from an RTK Query error */
export function extractRtkError(err: unknown): {
  message: string;
  fieldErrors: Record<string, string[]> | null;
} {
  if (!err || typeof err !== "object") {
    return { message: "Request failed.", fieldErrors: null };
  }
  const errObj = err as {
    status?: number | string;
    data?: {
      message?: string;
      detail?: string;
      errors?: Record<string, string[]>;
    };
    error?: string;
    message?: string;
  };
  if (errObj.data && typeof errObj.data === "object") {
    const message =
      errObj.data.message ||
      errObj.data.detail ||
      `API Error (${errObj.status ?? "unknown"})`;
    const fieldErrors =
      errObj.data.errors && typeof errObj.data.errors === "object"
        ? errObj.data.errors
        : null;
    return { message, fieldErrors };
  }
  return {
    message: errObj.error || errObj.message || "Admin API request failed.",
    fieldErrors: null,
  };
}

function cleanParams(
  params?: Record<string, string | number | boolean | undefined | null>
): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      out[k] = v;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export const adminUserApi = createApi({
  reducerPath: "adminUserApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Me",
    "Dashboard",
    "Settings",
    "Prompts",
    "Categories",
    "Tags",
    "WeeklyThemes",
    "Users",
    "Creators",
    "Packages",
    "PricingRules",
    "Purchases",
    "Transactions",
    "Generations",
    "Blog",
  ],
  endpoints: (builder) => ({
    // -----------------------------------------------------------------------
    // 1. Staff Authentication & Profile
    // -----------------------------------------------------------------------
    loginStaff: builder.mutation<
      ApiSuccess<AdminLoginResponse>,
      { email: string; password: string }
    >({
      query: (credentials) => ({
        url: "login/",
        method: "POST",
        body: credentials,
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            setCredentials({
              access: data.data.tokens.access,
              refresh: data.data.tokens.refresh,
              user: data.data.user,
            })
          );
        } catch {
          // Handled by caller
        }
      },
      invalidatesTags: ["Me", "Dashboard"],
    }),

    logoutStaff: builder.mutation<ApiSuccess<null>, { refresh: string }>({
      query: ({ refresh }) => ({
        url: "auth/logout/",
        method: "POST",
        body: { refresh },
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(clearCredentials());
        }
      },
    }),

    getAdminMe: builder.query<ApiSuccess<AdminStaffUser>, void>({
      query: () => "me/",
      providesTags: ["Me"],
    }),

    updateAdminMe: builder.mutation<
      ApiSuccess<AdminStaffUser>,
      {
        display_name?: string;
        bio?: string;
        hide_mature?: boolean;
        avatar?: File | null;
      }
    >({
      query: (payload) => {
        const formData = new FormData();
        if (payload.display_name !== undefined) {
          formData.append("display_name", payload.display_name);
        }
        if (payload.bio !== undefined) {
          formData.append("bio", payload.bio);
        }
        if (payload.hide_mature !== undefined) {
          formData.append("hide_mature", String(payload.hide_mature));
        }
        if (payload.avatar) {
          formData.append("avatar", payload.avatar);
        }
        return {
          url: "me/",
          method: "PATCH",
          body: formData,
        };
      },
      invalidatesTags: ["Me"],
    }),

    // -----------------------------------------------------------------------
    // 2. Dashboard Analytics
    // -----------------------------------------------------------------------
    getDashboardAnalytics: builder.query<
      ApiSuccess<AdminDashboardAnalytics>,
      void
    >({
      query: () => "dashboard/",
      providesTags: ["Dashboard"],
    }),

    getAdminSettings: builder.query<ApiSuccess<PlatformSettings>, void>({
      query: () => "settings/",
      providesTags: ["Settings"],
    }),

    updateAdminSettings: builder.mutation<
      ApiSuccess<PlatformSettings>,
      PlatformSettingsPatch
    >({
      query: (data) => ({
        url: "settings/",
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["Settings"],
    }),

    // -----------------------------------------------------------------------
    // 3. Prompts Upload (JSON + Image), Bulk Upload, CRUD & Moderation
    // -----------------------------------------------------------------------
    uploadPromptFromJsonAndImage: builder.mutation<
      ApiSuccess<AdminPrompt>,
      {
        promptJson: PromptJsonPayload | string;
        previewImage?: File | null;
        additionalImages?: File[];
        updateExisting?: boolean;
      }
    >({
      query: (params) => {
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
        return {
          url: "prompts/upload/",
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: ["Prompts", "Categories", "Tags", "Dashboard"],
    }),

    uploadPromptFromFormFields: builder.mutation<
      ApiSuccess<AdminPrompt>,
      {
        fields: PromptJsonPayload;
        previewImage?: File | null;
        additionalImages?: File[];
        updateExisting?: boolean;
      }
    >({
      query: (params) => {
        const formData = new FormData();
        const { fields } = params;
        formData.append("title", fields.title);
        if (fields.slug) formData.append("slug", fields.slug);
        if (fields.description) formData.append("description", fields.description);
        formData.append("prompt_text", fields.prompt_text);
        if (fields.negative_prompt) {
          formData.append("negative_prompt", fields.negative_prompt);
        }
        formData.append("category", fields.category);
        if (fields.tags?.length) {
          formData.append("tags", JSON.stringify(fields.tags));
        }
        if (fields.aspect_ratio) {
          formData.append("aspect_ratio", fields.aspect_ratio);
        }
        if (fields.ai_tool) formData.append("ai_tool", fields.ai_tool);
        if (fields.generation_settings) {
          formData.append(
            "generation_settings",
            JSON.stringify(fields.generation_settings)
          );
        }
        if (fields.is_featured !== undefined) {
          formData.append("is_featured", String(fields.is_featured));
        }
        if (fields.is_premium !== undefined) {
          formData.append("is_premium", String(fields.is_premium));
        }
        if (fields.is_mature !== undefined) {
          formData.append("is_mature", String(fields.is_mature));
        }
        if (fields.is_private !== undefined) {
          formData.append("is_private", String(fields.is_private));
        }
        if (fields.status) formData.append("status", fields.status);
        if (fields.moderation_notes) {
          formData.append("moderation_notes", fields.moderation_notes);
        }
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
        return {
          url: "prompts/upload/",
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: ["Prompts", "Categories", "Tags", "Dashboard"],
    }),

    bulkUploadPrompts: builder.mutation<
      ApiSuccess<AdminPrompt[]>,
      {
        promptsJson: PromptJsonPayload[] | string;
        images?: File[];
        updateExisting?: boolean;
      }
    >({
      query: (params) => {
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
        return {
          url: "prompts/bulk-upload/",
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: ["Prompts", "Categories", "Tags", "Dashboard"],
    }),

    bulkPromptAction: builder.mutation<
      ApiSuccess<{ action: string; affected_count: number }>,
      { promptIds: string[]; action: BulkPromptActionType }
    >({
      query: ({ promptIds, action }) => ({
        url: "prompts/bulk-action/",
        method: "POST",
        body: { prompt_ids: promptIds, action },
      }),
      invalidatesTags: ["Prompts", "Dashboard"],
    }),

    getAdminPrompts: builder.query<
      ApiSuccess<AdminPrompt[]>,
      | {
          page?: number;
          status?: string;
          category?: string;
          search?: string;
          featured?: boolean | string;
          premium?: boolean | string;
          is_private?: boolean | string;
          ordering?: string;
        }
      | undefined
    >({
      query: (filters) => ({
        url: "prompts/",
        params: cleanParams(filters),
      }),
      providesTags: ["Prompts"],
    }),

    getAdminPromptBySlug: builder.query<ApiSuccess<AdminPrompt>, string>({
      query: (slug) => `prompts/${encodeURIComponent(slug)}/`,
      providesTags: ["Prompts"],
    }),

    updateAdminPromptBySlug: builder.mutation<
      ApiSuccess<AdminPrompt>,
      {
        slug: string;
        promptJson?: Partial<PromptJsonPayload> | string;
        previewImage?: File | null;
      }
    >({
      query: (params) => {
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
        return {
          url: `prompts/${encodeURIComponent(params.slug)}/`,
          method: "PATCH",
          body: formData,
        };
      },
      invalidatesTags: ["Prompts", "Categories", "Tags", "Dashboard"],
    }),

    deleteAdminPromptBySlug: builder.mutation<ApiSuccess<null>, string>({
      query: (slug) => ({
        url: `prompts/${encodeURIComponent(slug)}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["Prompts", "Dashboard"],
    }),

    uploadAdminPromptImage: builder.mutation<
      ApiSuccess<AdminPromptImage>,
      { promptId: string; imageFile: File }
    >({
      query: ({ promptId, imageFile }) => {
        const formData = new FormData();
        formData.append("image", imageFile);
        return {
          url: `prompts/${promptId}/images/`,
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: ["Prompts"],
    }),

    deleteAdminPromptImage: builder.mutation<
      ApiSuccess<null>,
      { promptId: string; imageId: string }
    >({
      query: ({ promptId, imageId }) => ({
        url: `prompts/${promptId}/images/${imageId}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["Prompts"],
    }),

    approveAdminPrompt: builder.mutation<ApiSuccess<AdminPrompt>, string>({
      query: (promptId) => ({
        url: `prompts/${promptId}/approve/`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: ["Prompts", "Dashboard"],
    }),

    rejectAdminPrompt: builder.mutation<
      ApiSuccess<AdminPrompt>,
      { promptId: string; reason: string }
    >({
      query: ({ promptId, reason }) => ({
        url: `prompts/${promptId}/reject/`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: ["Prompts", "Dashboard"],
    }),

    // -----------------------------------------------------------------------
    // 4. Categories, Tags & Weekly Themes
    // -----------------------------------------------------------------------
    getAdminCategories: builder.query<
      ApiSuccess<AdminCategory[]>,
      { is_active?: string; page?: number } | undefined
    >({
      query: (params) => ({
        url: "categories/",
        params: cleanParams(params),
      }),
      providesTags: ["Categories"],
    }),

    getAdminCategoryBySlug: builder.query<ApiSuccess<AdminCategory>, string>({
      query: (slug) => `categories/${encodeURIComponent(slug)}/`,
      providesTags: ["Categories"],
    }),

    createAdminCategory: builder.mutation<
      ApiSuccess<AdminCategory>,
      {
        name: string;
        slug?: string;
        description?: string;
        is_active?: boolean;
        display_order?: number;
        thumbnail?: File | null;
      }
    >({
      query: (data) => {
        const formData = new FormData();
        formData.append("name", data.name);
        if (data.slug) formData.append("slug", data.slug);
        if (data.description !== undefined) {
          formData.append("description", data.description);
        }
        if (data.is_active !== undefined) {
          formData.append("is_active", String(data.is_active));
        }
        if (data.display_order !== undefined) {
          formData.append("display_order", String(data.display_order));
        }
        if (data.thumbnail) formData.append("thumbnail", data.thumbnail);
        return {
          url: "categories/",
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: ["Categories", "Dashboard"],
    }),

    updateAdminCategory: builder.mutation<
      ApiSuccess<AdminCategory>,
      {
        slug: string;
        data: {
          name?: string;
          slug?: string;
          description?: string;
          is_active?: boolean;
          display_order?: number;
          thumbnail?: File | null;
        };
      }
    >({
      query: ({ slug, data }) => {
        const formData = new FormData();
        if (data.name !== undefined) formData.append("name", data.name);
        if (data.slug !== undefined) formData.append("slug", data.slug);
        if (data.description !== undefined) {
          formData.append("description", data.description);
        }
        if (data.is_active !== undefined) {
          formData.append("is_active", String(data.is_active));
        }
        if (data.display_order !== undefined) {
          formData.append("display_order", String(data.display_order));
        }
        if (data.thumbnail) formData.append("thumbnail", data.thumbnail);
        return {
          url: `categories/${encodeURIComponent(slug)}/`,
          method: "PATCH",
          body: formData,
        };
      },
      invalidatesTags: ["Categories", "Dashboard"],
    }),

    deleteAdminCategory: builder.mutation<ApiSuccess<null>, string>({
      query: (slug) => ({
        url: `categories/${encodeURIComponent(slug)}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["Categories", "Dashboard"],
    }),

    getAdminTags: builder.query<
      ApiSuccess<AdminTag[]>,
      { search?: string; page?: number } | undefined
    >({
      query: (params) => ({
        url: "tags/",
        params: cleanParams(params),
      }),
      providesTags: ["Tags"],
    }),

    createAdminTag: builder.mutation<
      ApiSuccess<AdminTag>,
      { name: string; slug?: string }
    >({
      query: (data) => ({
        url: "tags/",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Tags", "Dashboard"],
    }),

    updateAdminTag: builder.mutation<
      ApiSuccess<AdminTag>,
      { slug: string; data: { name?: string; slug?: string } }
    >({
      query: ({ slug, data }) => ({
        url: `tags/${encodeURIComponent(slug)}/`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["Tags"],
    }),

    deleteAdminTag: builder.mutation<ApiSuccess<null>, string>({
      query: (slug) => ({
        url: `tags/${encodeURIComponent(slug)}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["Tags", "Dashboard"],
    }),

    getAdminWeeklyThemes: builder.query<
      ApiSuccess<AdminWeeklyTheme[]>,
      { page?: number } | undefined
    >({
      query: (params) => ({
        url: "weekly-themes/",
        params: cleanParams(params),
      }),
      providesTags: ["WeeklyThemes"],
    }),

    createAdminWeeklyTheme: builder.mutation<
      ApiSuccess<AdminWeeklyTheme>,
      {
        category_id?: string | null;
        tag_id?: string | null;
        starts_on: string;
        ends_on: string;
      }
    >({
      query: (data) => ({
        url: "weekly-themes/",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["WeeklyThemes"],
    }),

    deleteAdminWeeklyTheme: builder.mutation<ApiSuccess<null>, string>({
      query: (themeId) => ({
        url: `weekly-themes/${themeId}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["WeeklyThemes"],
    }),

    // -----------------------------------------------------------------------
    // 5. Users, Staff Roles & Creators
    // -----------------------------------------------------------------------
    getAdminUsers: builder.query<
      ApiSuccess<AdminUser[]>,
      | {
          page?: number;
          role?: string;
          is_staff?: string;
          is_active?: string;
          search?: string;
        }
      | undefined
    >({
      query: (params) => ({
        url: "users/",
        params: cleanParams(params),
      }),
      providesTags: ["Users"],
    }),

    getAdminUserDetail: builder.query<ApiSuccess<AdminUser>, string>({
      query: (userId) => `users/${userId}/`,
      providesTags: ["Users"],
    }),

    createAdminUser: builder.mutation<
      ApiSuccess<AdminUser>,
      {
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
    >({
      query: (data) => ({
        url: "users/",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Users", "Dashboard"],
    }),

    updateAdminUser: builder.mutation<
      ApiSuccess<AdminUser>,
      {
        userId: string;
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
        };
      }
    >({
      query: ({ userId, data }) => ({
        url: `users/${userId}/`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["Users", "Dashboard"],
    }),

    adjustUserCredits: builder.mutation<
      ApiSuccess<AdminCreditTransaction>,
      {
        userId: string;
        creditsDelta: number;
        reason: string;
        referenceId?: string;
      }
    >({
      query: ({ userId, creditsDelta, reason, referenceId }) => ({
        url: `users/${userId}/credits/adjust/`,
        method: "POST",
        body: {
          credits_delta: creditsDelta,
          reason,
          reference_id: referenceId || "",
        },
      }),
      invalidatesTags: ["Users", "Transactions", "Dashboard"],
    }),

    extendUserEntitlement: builder.mutation<
      ApiSuccess<Record<string, unknown>>,
      { userId: string; days: number }
    >({
      query: ({ userId, days }) => ({
        url: `users/${userId}/entitlement/extend/`,
        method: "POST",
        body: { days },
      }),
      invalidatesTags: ["Users"],
    }),

    getAdminCreators: builder.query<
      ApiSuccess<AdminCreatorProfile[]>,
      { page?: number; status?: string; search?: string } | undefined
    >({
      query: (params) => ({
        url: "creators/",
        params: cleanParams(params),
      }),
      providesTags: ["Creators"],
    }),

    approveAdminCreator: builder.mutation<
      ApiSuccess<AdminCreatorProfile>,
      string
    >({
      query: (userId) => ({
        url: `creators/${userId}/approve/`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: ["Creators", "Users", "Dashboard"],
    }),

    rejectAdminCreator: builder.mutation<
      ApiSuccess<AdminCreatorProfile>,
      { userId: string; reviewNotes: string }
    >({
      query: ({ userId, reviewNotes }) => ({
        url: `creators/${userId}/reject/`,
        method: "POST",
        body: { review_notes: reviewNotes },
      }),
      invalidatesTags: ["Creators", "Users", "Dashboard"],
    }),

    suspendAdminCreator: builder.mutation<
      ApiSuccess<AdminCreatorProfile>,
      { userId: string; reviewNotes: string }
    >({
      query: ({ userId, reviewNotes }) => ({
        url: `creators/${userId}/suspend/`,
        method: "POST",
        body: { review_notes: reviewNotes },
      }),
      invalidatesTags: ["Creators", "Users", "Dashboard"],
    }),

    // -----------------------------------------------------------------------
    // 6. Billing, Credit Packages, Pricing Rules & Ledger
    // -----------------------------------------------------------------------
    getCreditPackages: builder.query<ApiSuccess<AdminCreditPackage[]>, void>({
      query: () => "billing/packages/",
      providesTags: ["Packages"],
    }),

    createCreditPackage: builder.mutation<
      ApiSuccess<AdminCreditPackage>,
      Omit<AdminCreditPackage, "id" | "slug"> & { slug?: string }
    >({
      query: (data) => ({
        url: "billing/packages/",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Packages"],
    }),

    updateCreditPackage: builder.mutation<
      ApiSuccess<AdminCreditPackage>,
      { packageId: string; data: Partial<Omit<AdminCreditPackage, "id">> }
    >({
      query: ({ packageId, data }) => ({
        url: `billing/packages/${packageId}/`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["Packages"],
    }),

    deleteCreditPackage: builder.mutation<ApiSuccess<null>, string>({
      query: (packageId) => ({
        url: `billing/packages/${packageId}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["Packages"],
    }),

    getPricingRules: builder.query<ApiSuccess<AdminCreditPricingRule[]>, void>({
      query: () => "billing/pricing-rules/",
      providesTags: ["PricingRules"],
    }),

    createPricingRule: builder.mutation<
      ApiSuccess<AdminCreditPricingRule>,
      {
        model_name: string;
        quality: string;
        size: string;
        credits_required: number;
        is_active?: boolean;
      }
    >({
      query: (data) => ({
        url: "billing/pricing-rules/",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["PricingRules"],
    }),

    updatePricingRule: builder.mutation<
      ApiSuccess<AdminCreditPricingRule>,
      {
        ruleId: string;
        data: Partial<{
          model_name: string;
          quality: string;
          size: string;
          credits_required: number;
          is_active: boolean;
        }>;
      }
    >({
      query: ({ ruleId, data }) => ({
        url: `billing/pricing-rules/${ruleId}/`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["PricingRules"],
    }),

    deletePricingRule: builder.mutation<ApiSuccess<null>, string>({
      query: (ruleId) => ({
        url: `billing/pricing-rules/${ruleId}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["PricingRules"],
    }),

    getCreditPurchases: builder.query<
      ApiSuccess<AdminCreditPurchase[]>,
      | {
          page?: number;
          status?: string;
          user_id?: string;
          reconciliation_required?: string;
        }
      | undefined
    >({
      query: (params) => ({
        url: "billing/purchases/",
        params: cleanParams(params),
      }),
      providesTags: ["Purchases"],
    }),

    getCreditTransactions: builder.query<
      ApiSuccess<AdminCreditTransaction[]>,
      | {
          page?: number;
          transaction_type?: string;
          user_id?: string;
        }
      | undefined
    >({
      query: (params) => ({
        url: "billing/transactions/",
        params: cleanParams(params),
      }),
      providesTags: ["Transactions"],
    }),

    // -----------------------------------------------------------------------
    // 7. Generations Monitor, Blog CRUD & Push Broadcasts
    // -----------------------------------------------------------------------
    getAdminGenerations: builder.query<
      ApiSuccess<AdminGeneration[]>,
      | {
          page?: number;
          status?: string;
          provider?: string;
          user_id?: string;
        }
      | undefined
    >({
      query: (params) => ({
        url: "generations/",
        params: cleanParams(params),
      }),
      providesTags: ["Generations"],
    }),

    cancelAdminGeneration: builder.mutation<
      ApiSuccess<AdminGeneration>,
      { generationId: string; reason: string }
    >({
      query: ({ generationId, reason }) => ({
        url: `generations/${generationId}/cancel/`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: ["Generations", "Users", "Transactions", "Dashboard"],
    }),

    getAdminBlogPosts: builder.query<
      ApiSuccess<AdminBlogPost[]>,
      | {
          page?: number;
          status?: string;
          search?: string;
          ordering?: string;
        }
      | undefined
    >({
      query: (params) => ({
        url: "blog/",
        params: cleanParams(params),
      }),
      providesTags: ["Blog"],
    }),

    getAdminBlogPostBySlug: builder.query<ApiSuccess<AdminBlogPost>, string>({
      query: (slug) => `blog/${encodeURIComponent(slug)}/`,
      providesTags: ["Blog"],
    }),

    createAdminBlogPost: builder.mutation<
      ApiSuccess<AdminBlogPost>,
      {
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
    >({
      query: (data) => {
        const formData = new FormData();
        formData.append("title", data.title);
        if (data.slug) formData.append("slug", data.slug);
        if (data.excerpt !== undefined) formData.append("excerpt", data.excerpt);
        formData.append("content", data.content);
        if (data.cover_image) formData.append("cover_image", data.cover_image);
        if (data.cover_image_alt) {
          formData.append("cover_image_alt", data.cover_image_alt);
        }
        if (data.category_id) formData.append("category_id", data.category_id);
        if (data.tags?.length) {
          for (const tag of data.tags) {
            formData.append("tags", tag);
          }
        }
        if (data.status) formData.append("status", data.status);
        if (data.is_featured !== undefined) {
          formData.append("is_featured", String(data.is_featured));
        }
        if (data.meta_title) formData.append("meta_title", data.meta_title);
        if (data.meta_description) {
          formData.append("meta_description", data.meta_description);
        }
        if (data.meta_keywords) {
          formData.append("meta_keywords", data.meta_keywords);
        }
        if (data.canonical_url) {
          formData.append("canonical_url", data.canonical_url);
        }
        if (data.is_indexed !== undefined) {
          formData.append("is_indexed", String(data.is_indexed));
        }
        return {
          url: "blog/",
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: ["Blog", "Dashboard"],
    }),

    updateAdminBlogPost: builder.mutation<
      ApiSuccess<AdminBlogPost>,
      {
        slug: string;
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
        }>;
      }
    >({
      query: ({ slug, data }) => {
        const formData = new FormData();
        if (data.title !== undefined) formData.append("title", data.title);
        if (data.slug !== undefined) formData.append("slug", data.slug);
        if (data.excerpt !== undefined) formData.append("excerpt", data.excerpt);
        if (data.content !== undefined) formData.append("content", data.content);
        if (data.cover_image) formData.append("cover_image", data.cover_image);
        if (data.cover_image_alt !== undefined) {
          formData.append("cover_image_alt", data.cover_image_alt);
        }
        if (data.category_id !== undefined) {
          formData.append("category_id", data.category_id);
        }
        if (data.tags !== undefined) {
          for (const tag of data.tags) {
            formData.append("tags", tag);
          }
        }
        if (data.status !== undefined) formData.append("status", data.status);
        if (data.is_featured !== undefined) {
          formData.append("is_featured", String(data.is_featured));
        }
        if (data.meta_title !== undefined) {
          formData.append("meta_title", data.meta_title);
        }
        if (data.meta_description !== undefined) {
          formData.append("meta_description", data.meta_description);
        }
        if (data.meta_keywords !== undefined) {
          formData.append("meta_keywords", data.meta_keywords);
        }
        if (data.canonical_url !== undefined) {
          formData.append("canonical_url", data.canonical_url);
        }
        if (data.is_indexed !== undefined) {
          formData.append("is_indexed", String(data.is_indexed));
        }
        return {
          url: `blog/${encodeURIComponent(slug)}/`,
          method: "PATCH",
          body: formData,
        };
      },
      invalidatesTags: ["Blog", "Dashboard"],
    }),

    deleteAdminBlogPost: builder.mutation<ApiSuccess<null>, string>({
      query: (slug) => ({
        url: `blog/${encodeURIComponent(slug)}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["Blog", "Dashboard"],
    }),

    broadcastAdminNotification: builder.mutation<
      ApiSuccess<AdminBroadcastResult>,
      AdminBroadcastRequest
    >({
      query: (payload) => ({
        url: "notifications/broadcast/",
        method: "POST",
        body: sanitizeBroadcastRequest(payload),
      }),
    }),
  }),
});

export const {
  useLoginStaffMutation,
  useLogoutStaffMutation,
  useGetAdminMeQuery,
  useUpdateAdminMeMutation,
  useGetDashboardAnalyticsQuery,
  useGetAdminSettingsQuery,
  useUpdateAdminSettingsMutation,
  useUploadPromptFromJsonAndImageMutation,
  useUploadPromptFromFormFieldsMutation,
  useBulkUploadPromptsMutation,
  useBulkPromptActionMutation,
  useGetAdminPromptsQuery,
  useGetAdminPromptBySlugQuery,
  useLazyGetAdminPromptBySlugQuery,
  useUpdateAdminPromptBySlugMutation,
  useDeleteAdminPromptBySlugMutation,
  useUploadAdminPromptImageMutation,
  useDeleteAdminPromptImageMutation,
  useApproveAdminPromptMutation,
  useRejectAdminPromptMutation,
  useGetAdminCategoriesQuery,
  useGetAdminCategoryBySlugQuery,
  useLazyGetAdminCategoryBySlugQuery,
  useCreateAdminCategoryMutation,
  useUpdateAdminCategoryMutation,
  useDeleteAdminCategoryMutation,
  useGetAdminTagsQuery,
  useCreateAdminTagMutation,
  useUpdateAdminTagMutation,
  useDeleteAdminTagMutation,
  useGetAdminWeeklyThemesQuery,
  useCreateAdminWeeklyThemeMutation,
  useDeleteAdminWeeklyThemeMutation,
  useGetAdminUsersQuery,
  useGetAdminUserDetailQuery,
  useLazyGetAdminUserDetailQuery,
  useCreateAdminUserMutation,
  useUpdateAdminUserMutation,
  useAdjustUserCreditsMutation,
  useExtendUserEntitlementMutation,
  useGetAdminCreatorsQuery,
  useApproveAdminCreatorMutation,
  useRejectAdminCreatorMutation,
  useSuspendAdminCreatorMutation,
  useGetCreditPackagesQuery,
  useCreateCreditPackageMutation,
  useUpdateCreditPackageMutation,
  useDeleteCreditPackageMutation,
  useGetPricingRulesQuery,
  useCreatePricingRuleMutation,
  useUpdatePricingRuleMutation,
  useDeletePricingRuleMutation,
  useGetCreditPurchasesQuery,
  useGetCreditTransactionsQuery,
  useGetAdminGenerationsQuery,
  useCancelAdminGenerationMutation,
  useGetAdminBlogPostsQuery,
  useGetAdminBlogPostBySlugQuery,
  useLazyGetAdminBlogPostBySlugQuery,
  useCreateAdminBlogPostMutation,
  useUpdateAdminBlogPostMutation,
  useDeleteAdminBlogPostMutation,
  useBroadcastAdminNotificationMutation,
} = adminUserApi;
