export type ApiMeta = {
  page: number;
  page_size: number;
  total: number;
};

export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
  meta?: ApiMeta;
};

export type AdminStaffUser = {
  id: string;
  email: string;
  display_name: string;
  avatar: string | null;
  bio: string;
  role: "user" | "creator" | "admin";
  api_role: "user" | "creator" | "admin";
  is_staff: boolean;
  is_superuser: boolean;
  is_prompt_manager: boolean;
  is_active: boolean;
  can_manage_prompts: boolean;
  is_marketplace_admin: boolean;
  creator_status: "pending" | "approved" | "rejected" | "suspended" | null;
  hide_mature: boolean;
  email_verified: boolean;
  date_joined: string;
  updated_at: string;
};

export type AdminLoginResponse = {
  user: AdminStaffUser;
  tokens: {
    access: string;
    refresh: string;
  };
};

export type PlatformSettings = {
  paid_users_can_view_premium: boolean;
  free_users_can_view_premium: boolean;
  updated_at: string;
  updated_by_email: string | null;
};

export type PlatformSettingsPatch = Partial<
  Pick<
    PlatformSettings,
    "paid_users_can_view_premium" | "free_users_can_view_premium"
  >
>;

export type AspectRatioChoice =
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "3:2"
  | "2:3";

export type PromptStatusChoice =
  | "draft"
  | "pending"
  | "published"
  | "rejected"
  | "archived";

export type PromptJsonPayload = {
  title: string;
  slug?: string;
  description?: string;
  prompt_text: string;
  negative_prompt?: string;
  category: string; // Category name, slug, or UUID (auto-created if missing)
  tags?: string[]; // Tag names or slugs (auto-created if missing)
  aspect_ratio?: AspectRatioChoice;
  ai_tool?: string;
  generation_settings?: Record<string, unknown>;
  is_featured?: boolean;
  is_premium?: boolean;
  is_mature?: boolean;
  is_private?: boolean;
  status?: PromptStatusChoice;
  moderation_notes?: string;
  popularity_score?: number;
  image?: string; // Optional image filename key for bulk uploads
};

export type AdminPromptImage = {
  id: string;
  image: string;
  position: number;
  created_at: string;
};

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  thumbnail: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

export type AdminTag = {
  id: string;
  name: string;
  slug: string;
};

export type AdminWeeklyTheme = {
  id: string;
  category: AdminCategory | null;
  tag: AdminTag | null;
  starts_on: string;
  ends_on: string;
  created_at: string;
};

export type AdminPrompt = {
  id: string;
  title: string;
  slug: string;
  description: string;
  prompt_text: string | null;
  negative_prompt: string | null;
  category: AdminCategory;
  tags: AdminTag[];
  preview_image: string | null;
  additional_images: AdminPromptImage[];
  aspect_ratio: string;
  ai_tool: string;
  generation_settings: Record<string, unknown>;
  creator: {
    id: string;
    display_name: string;
    avatar: string | null;
  } | null;
  creator_email: string | null;
  status: PromptStatusChoice;
  is_featured: boolean;
  is_premium: boolean;
  is_mature: boolean;
  is_private: boolean;
  is_locked: boolean;
  copy_count: number;
  worked_count: number;
  view_count: number;
  favorite_count: number;
  rejection_reason: string;
  moderation_notes: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BulkPromptActionType =
  | "publish"
  | "archive"
  | "feature"
  | "unfeature"
  | "mark_premium"
  | "unmark_premium"
  | "delete";

export type AdminDashboardAnalytics = {
  users: {
    total: number;
    active: number;
    staff: number;
    new_last_7_days: number;
    new_last_30_days: number;
    creators: {
      total: number;
      approved: number;
      pending: number;
      rejected: number;
      suspended: number;
    };
  };
  prompts: {
    total: number;
    published: number;
    pending: number;
    draft: number;
    rejected: number;
    archived: number;
    featured: number;
    premium: number;
    mature: number;
    total_views: number;
    total_copies: number;
    total_favorites: number;
    total_worked_votes: number;
  };
  generations: {
    total: number;
    completed: number;
    pending: number;
    processing: number;
    failed: number;
    cancelled: number;
  };
  billing: {
    total_orders: number;
    paid_orders: number;
    refunded_orders: number;
    reconciliation_required: number;
    revenue_by_currency: Record<string, string>;
    credits: {
      available: number;
      reserved: number;
      purchased: number;
      used: number;
    };
  };
  content: {
    categories_total: number;
    categories_active: number;
    tags_total: number;
    blog_posts: {
      total: number;
      published: number;
      draft: number;
      archived: number;
    };
  };
};

export type AdminUserWalletSummary = {
  available_credits: number;
  reserved_credits: number;
  total_purchased_credits: number;
  total_used_credits: number;
  is_ad_free: boolean;
  ad_free_until: string | null;
  show_ads: boolean;
};

export type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  avatar: string | null;
  bio: string;
  role: "user" | "creator" | "admin";
  api_role: "user" | "creator" | "admin";
  is_staff: boolean;
  is_superuser: boolean;
  is_prompt_manager: boolean;
  is_active: boolean;
  email_verified: boolean;
  hide_mature: boolean;
  creator_status: "pending" | "approved" | "rejected" | "suspended" | null;
  wallet: AdminUserWalletSummary;
  date_joined: string;
  updated_at: string;
};

export type AdminCreatorProfile = {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  application_note: string;
  review_notes: string;
  follower_count: number;
  applied_at: string;
  reviewed_at: string | null;
};

export type AdminCreditPackage = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  currency: string;
  total_credits: number;
  ad_free_days: number;
  is_active: boolean;
  sort_order: number;
};

export type AdminCreditPricingRule = {
  id: string;
  model_name: string;
  quality: string;
  size: string;
  credits_required: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminCreditPurchase = {
  id: string;
  user: string;
  user_email: string;
  package: string | null;
  package_name_snapshot: string;
  purchased_credits_snapshot: number;
  ad_free_days_snapshot: number;
  amount_snapshot: string;
  currency: string;
  payment_provider: string;
  provider_order_id: string;
  provider_payment_id: string;
  status: string;
  refunded_credits: number;
  refund_reconciliation_required: boolean;
  reconciliation_notes: string;
  credits_granted_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export type AdminCreditTransaction = {
  id: string;
  user: string;
  user_email: string;
  wallet: string;
  purchase: string | null;
  generation: string | null;
  transaction_type: string;
  credits: number;
  balance_after: number;
  reference_id: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AdminGeneratedImage = {
  id: string;
  url: string;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
  created_at: string;
};

export type AdminGeneration = {
  id: string;
  user_id: string;
  user_email: string;
  source_prompt: string | null;
  prompt: string;
  prompt_text: string;
  negative_prompt: string;
  provider: string;
  model: string;
  quality: string;
  width: number;
  height: number;
  credits_required: number;
  credits_consumed: number;
  credits_released: number;
  aspect_ratio: string;
  parameters: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  error_code: string;
  error_message: string;
  external_request_id: string;
  is_demo: boolean;
  has_reference_image: boolean;
  image_url: string | null;
  cost_metadata: Record<string, unknown>;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  images: AdminGeneratedImage[];
};

export type AdminBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string | null;
  cover_image_alt: string;
  category: AdminCategory | null;
  tags: AdminTag[];
  author: {
    id: string;
    display_name: string;
    avatar: string | null;
  } | null;
  author_email: string | null;
  status: "draft" | "published" | "archived";
  is_featured: boolean;
  reading_time_minutes: number;
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  canonical_url: string;
  og_image: string | null;
  is_indexed: boolean;
  seo: {
    meta_title: string;
    meta_description: string;
    meta_keywords: string;
    canonical_url: string;
    og_image: string | null;
    robots: string;
    is_indexed: boolean;
  };
};

export type NotificationType =
  | "generation_completed"
  | "credits"
  | "promotional"
  | "engagement"
  | "admin_announcement";

export type NotificationCategory = "transactional" | "marketing";

export type BroadcastAudienceTarget = "all" | "creators" | "staff";

export type AdminBroadcastRequest = {
  title: string;
  body: string;
  notification_type?: NotificationType;
  category?: NotificationCategory;
  image_url?: string;
  deep_link?: string;
  target?: BroadcastAudienceTarget;
  user_ids?: string[];
  payload?: Record<string, string>;
};

export type BroadcastNotificationPayload = AdminBroadcastRequest;

export type AdminBroadcastResult = {
  recipient_count: number;
  target: BroadcastAudienceTarget | "selected_users";
  notification_type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  image_url: string;
  deep_link: string;
};

export const DEFAULT_NOTIFICATION_CATEGORY: Record<
  NotificationType,
  NotificationCategory
> = {
  generation_completed: "transactional",
  credits: "transactional",
  promotional: "marketing",
  engagement: "marketing",
  admin_announcement: "marketing",
};

/** Drop blank optional fields so the backend can fill defaults. */
export function sanitizeBroadcastRequest(
  req: AdminBroadcastRequest
): AdminBroadcastRequest {
  const body: AdminBroadcastRequest = {
    title: req.title.trim(),
    body: req.body.trim(),
  };

  if (req.notification_type) {
    body.notification_type = req.notification_type;
  }
  if (req.category) {
    body.category = req.category;
  }

  const imageUrl = req.image_url?.trim();
  if (imageUrl) body.image_url = imageUrl;

  const deepLink = req.deep_link?.trim();
  if (deepLink) body.deep_link = deepLink;

  const payloadEntries = Object.entries(req.payload ?? {}).filter(
    ([key, value]) => key.trim() && value.trim()
  );
  if (payloadEntries.length > 0) {
    body.payload = Object.fromEntries(payloadEntries);
  }

  const userIds = (req.user_ids ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  if (userIds.length > 0) {
    body.user_ids = userIds;
  } else if (req.target) {
    body.target = req.target;
  }

  return body;
}
