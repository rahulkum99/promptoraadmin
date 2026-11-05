import { useMemo, useState, type FormEvent } from "react";
import {
  extractRtkError,
  useBroadcastAdminNotificationMutation,
} from "@/store/adminuserApi";
import type {
  AdminBroadcastRequest,
  AdminBroadcastResult,
  BroadcastAudienceTarget,
  NotificationCategory,
  NotificationType,
} from "@/types/adminuser";
import {
  DEFAULT_NOTIFICATION_CATEGORY,
  sanitizeBroadcastRequest,
} from "@/types/adminuser";

const TITLE_MAX = 160;
const BODY_MAX = 280;

type BroadcastPreset = {
  id: string;
  label: string;
  title: string;
  body: string;
  notification_type: NotificationType;
  image_url?: string;
  deep_link?: string;
  target?: BroadcastAudienceTarget;
  payloadJson?: string;
};

const PRESETS: BroadcastPreset[] = [
  {
    id: "generation_completed",
    label: "Generation ready",
    title: "Your AI image is ready!",
    body: "Your AI image is ready! Open Promptora to view it.",
    notification_type: "generation_completed",
    image_url: "https://cdn.example.com/ready.jpg",
    deep_link: "/history/GENERATION_ID",
    payloadJson: '{\n  "generation_id": "GENERATION_ID"\n}',
  },
  {
    id: "credits",
    label: "Bonus credits",
    title: "Bonus credits",
    body: "Your 5 bonus credits have been added.",
    notification_type: "credits",
    deep_link: "/credits",
    target: "all",
  },
  {
    id: "promotional",
    label: "Promotional",
    title: "Premium fashion",
    body: "Explore our latest premium fashion prompts!",
    notification_type: "promotional",
    image_url: "https://cdn.example.com/fashion.jpg",
    deep_link: "/prompts?featured=true",
    target: "all",
  },
  {
    id: "engagement",
    label: "Engagement",
    title: "Today's trending prompts",
    body: "Discover today's trending AI prompts.",
    notification_type: "engagement",
    deep_link: "/prompts/trending",
    target: "all",
  },
];

const TYPE_OPTIONS: Array<{
  value: NotificationType;
  label: string;
  hint: string;
}> = [
  {
    value: "promotional",
    label: "Promotional",
    hint: "Marketing. Product and campaign announcements.",
  },
  {
    value: "engagement",
    label: "Engagement",
    hint: "Marketing. Trending prompts, weekly themes, re-engagement.",
  },
  {
    value: "generation_completed",
    label: "Generation completed",
    hint: "Transactional. Image-ready notices for a specific user.",
  },
  {
    value: "credits",
    label: "Credits",
    hint: "Transactional. Wallet grants, purchases, and bonuses.",
  },
  {
    value: "admin_announcement",
    label: "Admin announcement",
    hint: "Marketing. Platform-wide staff announcements.",
  },
];

function parseUserIds(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

function parsePayloadJson(
  raw: string
): { payload?: Record<string, string>; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { payload: undefined, error: null };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "Payload must be a JSON object of string values." };
    }
    const entries = Object.entries(parsed as Record<string, unknown>);
    const payload: Record<string, string> = {};
    for (const [key, value] of entries) {
      if (typeof value !== "string") {
        return {
          error: `Payload value for "${key}" must be a string.`,
        };
      }
      payload[key] = value;
    }
    return { payload, error: null };
  } catch (err) {
    return { error: (err as Error).message || "Invalid JSON." };
  }
}

export default function NotificationsView() {
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [notificationType, setNotificationType] =
    useState<NotificationType>("promotional");
  const [categoryOverride, setCategoryOverride] = useState<
    "" | NotificationCategory
  >("");
  const [target, setTarget] = useState<BroadcastAudienceTarget>("all");
  const [userIdsRaw, setUserIdsRaw] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [deepLink, setDeepLink] = useState<string>("");
  const [payloadJson, setPayloadJson] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminBroadcastResult | null>(null);

  const [broadcastNotification, { isLoading: isBroadcasting }] =
    useBroadcastAdminNotificationMutation();

  const userIds = useMemo(() => parseUserIds(userIdsRaw), [userIdsRaw]);
  const targetingSelectedUsers = userIds.length > 0;
  const payloadParse = useMemo(() => parsePayloadJson(payloadJson), [payloadJson]);
  const resolvedCategory =
    categoryOverride || DEFAULT_NOTIFICATION_CATEGORY[notificationType];
  const typeHint =
    TYPE_OPTIONS.find((option) => option.value === notificationType)?.hint ??
    "";

  const imageUrlError =
    imageUrl.trim() && !/^https:\/\//i.test(imageUrl.trim())
      ? "Image URL must be a public https:// address."
      : null;

  function applyPreset(preset: BroadcastPreset) {
    setTitle(preset.title);
    setBody(preset.body);
    setNotificationType(preset.notification_type);
    setCategoryOverride("");
    setTarget(preset.target ?? "all");
    setUserIdsRaw("");
    setImageUrl(preset.image_url ?? "");
    setDeepLink(preset.deep_link ?? "");
    setPayloadJson(preset.payloadJson ?? "");
    setError(null);
    setResult(null);
  }

  function resetComposer() {
    setTitle("");
    setBody("");
    setNotificationType("promotional");
    setCategoryOverride("");
    setTarget("all");
    setUserIdsRaw("");
    setImageUrl("");
    setDeepLink("");
    setPayloadJson("");
  }

  function buildRequest(): AdminBroadcastRequest | null {
    if (!title.trim()) {
      setError("Please enter a notification title.");
      return null;
    }
    if (!body.trim()) {
      setError("Please enter a notification body.");
      return null;
    }
    if (payloadParse.error) {
      setError(`Payload JSON error: ${payloadParse.error}`);
      return null;
    }
    if (imageUrlError) {
      setError(imageUrlError);
      return null;
    }

    return sanitizeBroadcastRequest({
      title,
      body,
      notification_type: notificationType,
      category: categoryOverride || undefined,
      image_url: imageUrl,
      deep_link: deepLink,
      target: targetingSelectedUsers ? undefined : target,
      user_ids: targetingSelectedUsers ? userIds : undefined,
      payload: payloadParse.payload,
    });
  }

  async function handleBroadcast(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const request = buildRequest();
    if (!request) return;

    const audienceLabel = targetingSelectedUsers
      ? `${userIds.length} selected user${userIds.length === 1 ? "" : "s"}`
      : target === "all"
        ? "all active users"
        : target === "creators"
          ? "approved creators"
          : "staff and admins";

    const confirmed = window.confirm(
      `Send this ${notificationType.replaceAll("_", " ")} notification to ${audienceLabel}?\n\n"${request.title}"\n\nBroadcasts cannot be recalled.`
    );
    if (!confirmed) return;

    try {
      const res = await broadcastNotification(request).unwrap();
      setResult(res.data);
      resetComposer();
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  return (
    <div className="section-stack">
      <div className="section-header-bar">
        <div>
          <h1 className="section-title">Push & Inbox Broadcasts</h1>
          <p className="section-subtitle">
            Staff write the exact title and body. This is the only path that
            writes an inbox row or sends Firebase push (
            <code>POST /api/v1/adminuser/notifications/broadcast/</code>)
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="alert alert-success">
          <div className="alert-title">
            Broadcast sent to {result.recipient_count.toLocaleString()} recipient
            {result.recipient_count === 1 ? "" : "s"}
          </div>
          <p className="alert-meta">
            Target: {result.target.replaceAll("_", " ")} · Type:{" "}
            {result.notification_type.replaceAll("_", " ")} · Category:{" "}
            {result.category}
          </p>
          <p className="alert-meta">
            “{result.title}” — {result.body}
          </p>
        </div>
      )}

      <div className="admin-card">
        <div className="form-row-between">
          <div>
            <h3 className="admin-card-title">Load a product template</h3>
            <p className="admin-card-subtitle">
              Fills title, body, type, and optional deep link. Edit before
              sending — the backend does not wrap or rewrite copy.
            </p>
          </div>
        </div>
        <div className="btn-group notif-preset-row">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`btn btn-xs ${
                notificationType === preset.notification_type &&
                title === preset.title
                  ? "btn-primary"
                  : "btn-secondary"
              }`}
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleBroadcast} className="admin-card admin-form">
        <h3 className="admin-card-title">Custom notification composer</h3>
        <p className="admin-card-subtitle">
          Title is the push heading and inbox title. Body is the push text and
          inbox subtitle.
        </p>

        <div>
          <div className="form-row-between">
            <label className="form-label">Title *</label>
            <span className="char-count">
              {title.length}/{TITLE_MAX}
            </span>
          </div>
          <input
            type="text"
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Your AI image is ready!"
            className="form-input"
            required
          />
        </div>

        <div>
          <div className="form-row-between">
            <label className="form-label">Body *</label>
            <span className="char-count">
              {body.length}/{BODY_MAX}
            </span>
          </div>
          <textarea
            rows={4}
            maxLength={BODY_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Your AI image is ready! Open Promptora to view it."
            className="form-textarea"
            required
          />
        </div>

        <div className="form-grid-2">
          <div>
            <label className="form-label">Notification type</label>
            <select
              value={notificationType}
              onChange={(e) =>
                setNotificationType(e.target.value as NotificationType)
              }
              className="form-select"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="form-hint">{typeHint}</p>
          </div>
          <div>
            <label className="form-label">Category</label>
            <select
              value={categoryOverride}
              onChange={(e) =>
                setCategoryOverride(e.target.value as "" | NotificationCategory)
              }
              className="form-select"
            >
              <option value="">
                Auto from type ({resolvedCategory})
              </option>
              <option value="transactional">Transactional</option>
              <option value="marketing">Marketing</option>
            </select>
            <p className="form-hint">
              Leave on Auto unless you need to override the type default.
            </p>
          </div>
        </div>

        <div className="form-grid-2">
          <div>
            <label className="form-label">Audience target</label>
            <select
              value={target}
              disabled={targetingSelectedUsers}
              onChange={(e) =>
                setTarget(e.target.value as BroadcastAudienceTarget)
              }
              className="form-select"
            >
              <option value="all">All active users (all)</option>
              <option value="creators">Approved creators (creators)</option>
              <option value="staff">Staff and admins (staff)</option>
            </select>
            <p className="form-hint">
              {targetingSelectedUsers
                ? "Ignored while specific user UUIDs are set."
                : "Used when user UUIDs are left blank."}
            </p>
          </div>
          <div>
            <label className="form-label">Specific user UUIDs (optional)</label>
            <textarea
              rows={3}
              value={userIdsRaw}
              onChange={(e) => setUserIdsRaw(e.target.value)}
              placeholder="Comma or newline separated Promptora user UUIDs"
              className="form-textarea font-mono"
            />
            <p className="form-hint">
              {targetingSelectedUsers
                ? `${userIds.length} user ID${userIds.length === 1 ? "" : "s"} will be sent. Target group is ignored.`
                : "Leave blank to use the audience target above."}
            </p>
          </div>
        </div>

        <div className="form-grid-2">
          <div>
            <label className="form-label">Image URL (optional)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://cdn.example.com/ready.jpg"
              className="form-input font-mono"
            />
            {imageUrlError ? (
              <p className="field-error-text">{imageUrlError}</p>
            ) : (
              <p className="form-hint">
                Public https image for Android/iOS rich push and inbox thumbnail.
              </p>
            )}
          </div>
          <div>
            <label className="form-label">Deep link (optional)</label>
            <input
              type="text"
              value={deepLink}
              onChange={(e) => setDeepLink(e.target.value)}
              placeholder="/prompts?featured=true"
              className="form-input font-mono"
            />
            <p className="form-hint">
              App path opened on tap, e.g. /history/GENERATION_ID.
            </p>
          </div>
        </div>

        <div>
          <label className="form-label">Payload JSON (optional)</label>
          <textarea
            rows={5}
            value={payloadJson}
            onChange={(e) => setPayloadJson(e.target.value)}
            placeholder={'{\n  "generation_id": "GENERATION_ID"\n}'}
            className="form-textarea font-mono"
          />
          {payloadParse.error ? (
            <p className="field-error-text">JSON error: {payloadParse.error}</p>
          ) : (
            <p className="form-hint">
              Extra string fields the app reads (generation_id, prompt_slug, …).
            </p>
          )}
        </div>

        <div className="parsed-preview-box notif-preview">
          <div className="parsed-preview-header">Live push preview</div>
          <div className="notif-preview-card">
            {imageUrl.trim() && !imageUrlError ? (
              <div className="notif-preview-thumb">{imageUrl.trim()}</div>
            ) : null}
            <div className="notif-preview-copy">
              <div className="notif-preview-app">Promptora</div>
              <div className="notif-preview-title">
                {title.trim() || "Notification title"}
              </div>
              <div className="notif-preview-body">
                {body.trim() || "Notification body"}
              </div>
            </div>
          </div>
          <div className="parsed-preview-grid notif-preview-meta">
            <div>
              <span className="muted-label">Type</span>{" "}
              {notificationType.replaceAll("_", " ")}
            </div>
            <div>
              <span className="muted-label">Category</span> {resolvedCategory}
            </div>
            <div>
              <span className="muted-label">Audience</span>{" "}
              {targetingSelectedUsers
                ? `${userIds.length} selected user${userIds.length === 1 ? "" : "s"}`
                : target}
            </div>
            <div>
              <span className="muted-label">Deep link</span>{" "}
              {deepLink.trim() || "—"}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            disabled={isBroadcasting || !!payloadParse.error || !!imageUrlError}
            className="btn btn-primary"
          >
            {isBroadcasting ? "Sending broadcast..." : "Send Broadcast Now"}
          </button>
        </div>
      </form>
    </div>
  );
}
