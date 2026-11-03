import React, { useState } from "react";
import BillingManagerView from "@/components/admin/BillingManagerView";
import CatalogManagerView from "@/components/admin/CatalogManagerView";
import DashboardView from "@/components/admin/DashboardView";
import OperationsView from "@/components/admin/OperationsView";
import PromptJsonUploader from "@/components/admin/PromptJsonUploader";
import PromptsManagerView from "@/components/admin/PromptsManagerView";
import SettingsView from "@/components/admin/SettingsView";
import UsersCreatorsView from "@/components/admin/UsersCreatorsView";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  extractRtkError,
  useGetAdminMeQuery,
  useLoginStaffMutation,
  useLogoutStaffMutation,
  useUpdateAdminMeMutation,
} from "@/store/adminuserApi";
import { clearCredentials, setApiOriginState } from "@/store/authSlice";
import "./App.css";

type AdminNavTab =
  | "dashboard"
  | "settings"
  | "upload"
  | "prompts"
  | "catalog"
  | "users"
  | "creators"
  | "billing"
  | "generations"
  | "blog"
  | "notifications";

export function App() {
  const dispatch = useAppDispatch();
  const { accessToken, refreshToken, staffUser: cachedUser, apiOrigin } =
    useAppSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState<AdminNavTab>("upload");

  // Login form state
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [apiBaseInput, setApiBaseInput] = useState<string>(apiOrigin);
  const [authError, setAuthError] = useState<string | null>(null);

  // Staff profile edit modal
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [profileDisplayName, setProfileDisplayName] = useState<string>("");
  const [profileBio, setProfileBio] = useState<string>("");
  const [profileAvatar, setProfileAvatar] = useState<File | null>(null);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);

  // RTK Query hooks
  const { data: meRes } = useGetAdminMeQuery(undefined, {
    skip: !accessToken,
  });
  const [loginStaff, { isLoading: authLoading }] = useLoginStaffMutation();
  const [logoutStaff] = useLogoutStaffMutation();
  const [updateAdminMe, { isLoading: isSavingProfile }] =
    useUpdateAdminMeMutation();

  const staffUser = meRes?.data ?? cachedUser;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    dispatch(setApiOriginState(apiBaseInput));

    try {
      await loginStaff({
        email: loginEmail,
        password: loginPassword,
      }).unwrap();
    } catch (err) {
      setAuthError(extractRtkError(err).message || "Staff login failed.");
    }
  }

  async function handleLogout() {
    if (accessToken && refreshToken) {
      try {
        await logoutStaff({ refresh: refreshToken }).unwrap();
        return;
      } catch {
        // Fallback to clearing local Redux credentials
      }
    }
    dispatch(clearCredentials());
  }

  function openProfileModal() {
    setProfileDisplayName(staffUser?.display_name || "");
    setProfileBio(staffUser?.bio || "");
    setProfileAvatar(null);
    setProfileFeedback(null);
    setShowProfileModal(true);
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileFeedback(null);
    try {
      await updateAdminMe({
        display_name: profileDisplayName,
        bio: profileBio,
        avatar: profileAvatar,
      }).unwrap();
      setProfileFeedback("Profile updated successfully.");
    } catch (err) {
      setProfileFeedback(`Error: ${extractRtkError(err).message}`);
    }
  }

  if (!accessToken) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-brand">
            <span className="brand-badge">PROMPTORA</span>
            <h1>AdminUser Portal</h1>
            <p>
              Staff Authentication • <code>POST /api/v1/adminuser/login/</code>
            </p>
          </div>

          {authError && <div className="alert alert-error">{authError}</div>}

          <form onSubmit={handleLogin} className="admin-form">
            <div>
              <label className="form-label">Backend API Base URL</label>
              <input
                type="url"
                value={apiBaseInput}
                onChange={(e) => setApiBaseInput(e.target.value)}
                placeholder="https://api.prompivora.com"
                className="form-input font-mono"
                required
              />
            </div>

            <div>
              <label className="form-label">Staff Email *</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@promptora.com"
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">Password *</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                className="form-input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="btn btn-primary btn-block"
            >
              {authLoading ? "Signing in to Admin Portal..." : "Sign In as Staff"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <span className="brand-badge">PROMPTORA</span>
          <div className="sidebar-title">AdminUser Portal</div>
          <div className="sidebar-api-url">{apiOrigin}</div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-label">Overview & Prompts</div>
          <button
            type="button"
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <span>📊 Dashboard Analytics</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <span>⚙️ Platform Settings</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            <span>🚀 Upload Prompt (JSON + Img)</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === "prompts" ? "active" : ""}`}
            onClick={() => setActiveTab("prompts")}
          >
            <span>🖼️ Prompts & Moderation</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === "catalog" ? "active" : ""}`}
            onClick={() => setActiveTab("catalog")}
          >
            <span>🏷️ Categories, Tags & Themes</span>
          </button>

          <div className="nav-group-label">Accounts & Revenue</div>
          <button
            type="button"
            className={`nav-item ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <span>👥 Users, Staff & Wallets</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === "creators" ? "active" : ""}`}
            onClick={() => setActiveTab("creators")}
          >
            <span>✨ Creator Applications</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === "billing" ? "active" : ""}`}
            onClick={() => setActiveTab("billing")}
          >
            <span>💳 Billing & Pricing Rules</span>
          </button>

          <div className="nav-group-label">Platform Operations</div>
          <button
            type="button"
            className={`nav-item ${activeTab === "generations" ? "active" : ""}`}
            onClick={() => setActiveTab("generations")}
          >
            <span>⚡ Generations Monitor</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === "blog" ? "active" : ""}`}
            onClick={() => setActiveTab("blog")}
          >
            <span>📝 SEO Blog CMS</span>
          </button>
          <button
            type="button"
            className={`nav-item ${
              activeTab === "notifications" ? "active" : ""
            }`}
            onClick={() => setActiveTab("notifications")}
          >
            <span>📣 Push Broadcasts</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="staff-profile-summary">
            <div className="staff-name">
              {staffUser?.display_name || staffUser?.email || "Staff Admin"}
            </div>
            <div className="staff-role">
              {staffUser?.is_superuser
                ? "Superuser"
                : staffUser?.is_staff
                ? "Staff"
                : "Prompt Manager"}
            </div>
          </div>
          <div className="btn-group">
            <button
              type="button"
              onClick={openProfileModal}
              className="btn btn-secondary btn-xs"
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="btn btn-danger btn-xs"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        {activeTab === "dashboard" && (
          <DashboardView
            onNavigate={(tab) => setActiveTab(tab as AdminNavTab)}
          />
        )}

        {activeTab === "settings" && <SettingsView />}

        {activeTab === "upload" && <PromptJsonUploader />}

        {activeTab === "prompts" && (
          <PromptsManagerView onOpenUploader={() => setActiveTab("upload")} />
        )}

        {activeTab === "catalog" && <CatalogManagerView />}

        {activeTab === "users" && (
          <UsersCreatorsView key="users-tab" initialTab="users" />
        )}

        {activeTab === "creators" && (
          <UsersCreatorsView key="creators-tab" initialTab="creators" />
        )}

        {activeTab === "billing" && <BillingManagerView />}

        {activeTab === "generations" && (
          <OperationsView key="gen-tab" initialTab="generations" />
        )}

        {activeTab === "blog" && (
          <OperationsView key="blog-tab" initialTab="blog" />
        )}

        {activeTab === "notifications" && (
          <OperationsView key="notif-tab" initialTab="notifications" />
        )}
      </main>

      {showProfileModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <h3 className="admin-card-title">
                  Staff Profile & API Settings
                </h3>
                <p className="admin-card-subtitle">
                  <code>PATCH /api/v1/adminuser/me/</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="btn btn-secondary btn-xs"
              >
                Close ✕
              </button>
            </div>

            {profileFeedback && (
              <div className="alert alert-success">{profileFeedback}</div>
            )}

            <form onSubmit={handleUpdateProfile} className="admin-form">
              <div>
                <label className="form-label">Display Name</label>
                <input
                  type="text"
                  value={profileDisplayName}
                  onChange={(e) => setProfileDisplayName(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Bio</label>
                <textarea
                  rows={3}
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  className="form-textarea"
                />
              </div>
              <div>
                <label className="form-label">Avatar Image</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    setProfileAvatar(e.target.files?.[0] || null)
                  }
                  className="form-file-input"
                />
              </div>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="btn btn-primary"
              >
                {isSavingProfile ? "Saving..." : "Save Profile"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
