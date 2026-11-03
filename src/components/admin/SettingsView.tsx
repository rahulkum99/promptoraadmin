import { useState } from "react";
import {
  extractRtkError,
  useGetAdminSettingsQuery,
  useUpdateAdminSettingsMutation,
} from "@/store/adminuserApi";
import type { PlatformSettingsPatch } from "@/types/adminuser";

type VisibilityFlag = keyof PlatformSettingsPatch;

export default function SettingsView() {
  const {
    data: res,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetAdminSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] =
    useUpdateAdminSettingsMutation();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingFlag, setPendingFlag] = useState<VisibilityFlag | null>(null);

  const settings = res?.data;
  const errorMsg = saveError || (error ? extractRtkError(error).message : null);

  async function handleToggle(flag: VisibilityFlag) {
    if (!settings) return;
    setSaveError(null);
    setPendingFlag(flag);
    try {
      await updateSettings({
        [flag]: !settings[flag],
      }).unwrap();
    } catch (err) {
      setSaveError(extractRtkError(err).message);
    } finally {
      setPendingFlag(null);
    }
  }

  return (
    <div className="section-stack">
      <div className="section-header-bar">
        <div>
          <h1 className="section-title">Platform Settings</h1>
          <p className="section-subtitle">
            Two independent premium-visibility switches (
            <code>GET/PATCH /api/v1/adminuser/settings/</code>)
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isLoading || isFetching}
          className="btn btn-secondary"
        >
          {isFetching ? "Refreshing..." : "Refresh Settings"}
        </button>
      </div>

      {errorMsg && <div className="alert alert-error">{errorMsg}</div>}

      <div className="admin-card settings-card">
        <h3 className="admin-card-title">Premium Prompt Visibility</h3>
        <p className="admin-card-subtitle">
          Guests stay locked. Owners and staff always see premium text. An
          expired paid user follows the free-user toggle.
        </p>

        {isLoading && !settings ? (
          <p className="row-sub">Loading platform flags...</p>
        ) : settings ? (
          <>
            <label className="settings-toggle-row">
              <input
                type="checkbox"
                checked={Boolean(settings.paid_users_can_view_premium)}
                disabled={isSaving}
                onChange={() => void handleToggle("paid_users_can_view_premium")}
              />
              <div>
                <strong>Paid users can view premium prompt text</strong>
                <div className="row-sub">
                  Default ON. Paid ad-free users can see premium text until ads
                  resume.
                </div>
                <div className="row-sub">
                  Current value:{" "}
                  <span
                    className={`badge ${
                      settings.paid_users_can_view_premium
                        ? "badge-published"
                        : "badge-archived"
                    }`}
                  >
                    {settings.paid_users_can_view_premium
                      ? "Enabled"
                      : "Disabled"}
                  </span>
                  {pendingFlag === "paid_users_can_view_premium"
                    ? " • Saving..."
                    : ""}
                </div>
              </div>
            </label>

            <label className="settings-toggle-row">
              <input
                type="checkbox"
                checked={Boolean(settings.free_users_can_view_premium)}
                disabled={isSaving}
                onChange={() => void handleToggle("free_users_can_view_premium")}
              />
              <div>
                <strong>Free users can view premium prompt text</strong>
                <div className="row-sub">
                  Default OFF. Free logged-in users can see premium text when
                  this is enabled.
                </div>
                <div className="row-sub">
                  Current value:{" "}
                  <span
                    className={`badge ${
                      settings.free_users_can_view_premium
                        ? "badge-published"
                        : "badge-archived"
                    }`}
                  >
                    {settings.free_users_can_view_premium
                      ? "Enabled"
                      : "Disabled"}
                  </span>
                  {pendingFlag === "free_users_can_view_premium"
                    ? " • Saving..."
                    : ""}
                </div>
              </div>
            </label>

            <div className="stat-list">
              <div className="stat-row">
                <span>Last updated</span>
                <strong>
                  {settings.updated_at
                    ? new Date(settings.updated_at).toLocaleString()
                    : "—"}
                </strong>
              </div>
              <div className="stat-row">
                <span>Updated by</span>
                <strong>{settings.updated_by_email || "—"}</strong>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
