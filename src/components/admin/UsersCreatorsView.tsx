import React, { useState } from "react";
import {
  extractRtkError,
  useAdjustUserCreditsMutation,
  useApproveAdminCreatorMutation,
  useCreateAdminUserMutation,
  useExtendUserEntitlementMutation,
  useGetAdminCreatorsQuery,
  useGetAdminUserDetailQuery,
  useGetAdminUsersQuery,
  useRejectAdminCreatorMutation,
  useSuspendAdminCreatorMutation,
  useUpdateAdminUserMutation,
} from "@/store/adminuserApi";
import type { AdminCreatorProfile, AdminUser } from "@/types/adminuser";

type Props = {
  initialTab?: "users" | "creators";
};

export default function UsersCreatorsView({ initialTab = "users" }: Props) {
  const [subTab, setSubTab] = useState<"users" | "creators">(initialTab);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // User filters
  const [userSearch, setUserSearch] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [staffFilter, setStaffFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  // Creator filters
  const [creatorStatusFilter, setCreatorStatusFilter] = useState<string>("");
  const [creatorSearch, setCreatorSearch] = useState<string>("");

  // Create Staff / User modal
  const [showCreateUserModal, setShowCreateUserModal] =
    useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>("");
  const [newDisplayName, setNewDisplayName] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [newRole, setNewRole] = useState<"user" | "creator" | "admin">("user");
  const [newIsStaff, setNewIsStaff] = useState<boolean>(true);
  const [newIsPromptManager, setNewIsPromptManager] = useState<boolean>(true);

  // Wallet Adjust Modal
  const [creditTargetUser, setCreditTargetUser] = useState<AdminUser | null>(
    null
  );
  const [creditsDelta, setCreditsDelta] = useState<number>(50);
  const [creditReason, setCreditReason] = useState<string>(
    "Admin promotional grant"
  );
  const [adFreeDays, setAdFreeDays] = useState<number>(30);

  // RTK Queries
  const {
    data: usersRes,
    isLoading: isLoadingUsers,
    refetch: refetchUsers,
  } = useGetAdminUsersQuery(
    {
      search: userSearch.trim() || undefined,
      role: roleFilter || undefined,
      is_staff: staffFilter || undefined,
      is_active: activeFilter || undefined,
    },
    { skip: subTab !== "users" }
  );

  const { data: userDetailRes, isLoading: isLoadingUserDetail } =
    useGetAdminUserDetailQuery(detailUserId ?? "", {
      skip: !detailUserId,
    });

  const {
    data: creatorsRes,
    isLoading: isLoadingCreators,
    refetch: refetchCreators,
  } = useGetAdminCreatorsQuery(
    {
      status: creatorStatusFilter || undefined,
      search: creatorSearch.trim() || undefined,
    },
    { skip: subTab !== "creators" }
  );

  // RTK Mutations
  const [createUser] = useCreateAdminUserMutation();
  const [updateUser] = useUpdateAdminUserMutation();
  const [adjustCredits] = useAdjustUserCreditsMutation();
  const [extendEntitlement] = useExtendUserEntitlementMutation();
  const [approveCreator] = useApproveAdminCreatorMutation();
  const [rejectCreator] = useRejectAdminCreatorMutation();
  const [suspendCreator] = useSuspendAdminCreatorMutation();

  const users = usersRes?.data ?? [];
  const creators = creatorsRes?.data ?? [];

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    try {
      const res = await createUser({
        email: newEmail,
        display_name: newDisplayName,
        password: newPassword || undefined,
        role: newRole,
        is_staff: newIsStaff,
        is_prompt_manager: newIsPromptManager,
        is_active: true,
        email_verified: true,
      }).unwrap();
      setFeedback(`Created user ${res.data.email}.`);
      setShowCreateUserModal(false);
      setNewEmail("");
      setNewDisplayName("");
      setNewPassword("");
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleToggleUserFlag(
    user: AdminUser,
    field: "is_staff" | "is_prompt_manager" | "is_active"
  ) {
    setError(null);
    try {
      await updateUser({
        userId: user.id,
        data: { [field]: !user[field] },
      }).unwrap();
      setFeedback(`Updated ${field} for ${user.email}.`);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleAdjustCredits(e: React.FormEvent) {
    e.preventDefault();
    if (!creditTargetUser) return;
    setError(null);
    try {
      const res = await adjustCredits({
        userId: creditTargetUser.id,
        creditsDelta,
        reason: creditReason,
      }).unwrap();
      setFeedback(
        `Adjusted credits for ${creditTargetUser.email} by ${creditsDelta}. New balance: ${res.data.balance_after}`
      );
      setCreditTargetUser(null);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleExtendEntitlement() {
    if (!creditTargetUser) return;
    setError(null);
    try {
      await extendEntitlement({
        userId: creditTargetUser.id,
        days: adFreeDays,
      }).unwrap();
      setFeedback(
        `Extended ad-free entitlement for ${creditTargetUser.email} by ${adFreeDays} days.`
      );
      setCreditTargetUser(null);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleApproveCreator(creator: AdminCreatorProfile) {
    setError(null);
    try {
      await approveCreator(creator.user_id).unwrap();
      setFeedback(
        `Approved creator ${creator.display_name} (${creator.email}).`
      );
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleRejectCreator(creator: AdminCreatorProfile) {
    const notes = window.prompt(
      "Enter review notes for rejection:",
      "Incomplete portfolio"
    );
    if (!notes) return;
    setError(null);
    try {
      await rejectCreator({
        userId: creator.user_id,
        reviewNotes: notes,
      }).unwrap();
      setFeedback(`Rejected creator ${creator.email}.`);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleSuspendCreator(creator: AdminCreatorProfile) {
    const notes = window.prompt(
      "Enter suspension reason:",
      "Policy violation under investigation"
    );
    if (!notes) return;
    setError(null);
    try {
      await suspendCreator({
        userId: creator.user_id,
        reviewNotes: notes,
      }).unwrap();
      setFeedback(`Suspended creator ${creator.email}.`);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  return (
    <div className="section-stack">
      <div className="section-header-bar">
        <div>
          <h1 className="section-title">Users, Staff Roles & Creators</h1>
          <p className="section-subtitle">
            Manage accounts, staff permissions, wallet credit balances, and
            creator applications via RTK Query
          </p>
        </div>
        <div className="btn-group">
          <div className="tab-pills">
            <button
              type="button"
              className={`tab-pill ${subTab === "users" ? "active" : ""}`}
              onClick={() => setSubTab("users")}
            >
              Users & Staff
            </button>
            <button
              type="button"
              className={`tab-pill ${subTab === "creators" ? "active" : ""}`}
              onClick={() => setSubTab("creators")}
            >
              Creator Applications
            </button>
          </div>
          {subTab === "users" && (
            <button
              type="button"
              onClick={() => setShowCreateUserModal(true)}
              className="btn btn-primary"
            >
              + Create User / Staff
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {feedback && <div className="alert alert-success">{feedback}</div>}

      {subTab === "users" && (
        <>
          <div className="admin-card filter-toolbar">
            <input
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search email or display name..."
              className="form-input"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="form-select"
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="creator">Creator</option>
              <option value="admin">Admin</option>
            </select>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="form-select"
            >
              <option value="">Staff: Any</option>
              <option value="true">Staff Only</option>
              <option value="false">Non-Staff</option>
            </select>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="form-select"
            >
              <option value="">Active: Any</option>
              <option value="true">Active Only</option>
              <option value="false">Disabled Only</option>
            </select>
            <button
              type="button"
              onClick={() => void refetchUsers()}
              className="btn btn-secondary"
            >
              Refresh
            </button>
          </div>

          <div className="admin-card table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Roles & Flags</th>
                  <th>Wallet Credits</th>
                  <th>Ad-Free Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingUsers ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      Loading users...
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="row-title">
                          {u.display_name || "Unnamed"}
                        </div>
                        <div className="row-sub">{u.email}</div>
                      </td>
                      <td>
                        <span className="badge badge-info">{u.role}</span>{" "}
                        {u.is_staff && (
                          <span className="badge badge-featured">Staff</span>
                        )}{" "}
                        {u.is_prompt_manager && (
                          <span className="badge badge-premium">
                            Prompt Mgr
                          </span>
                        )}{" "}
                        {!u.is_active && (
                          <span className="badge badge-rejected">Disabled</span>
                        )}
                      </td>
                      <td>
                        <div>
                          Available:{" "}
                          <strong>{u.wallet?.available_credits ?? 0}</strong>
                        </div>
                        <div className="row-sub">
                          Used: {u.wallet?.total_used_credits ?? 0} | Reserved:{" "}
                          {u.wallet?.reserved_credits ?? 0}
                        </div>
                      </td>
                      <td>
                        {u.wallet?.is_ad_free ? (
                          <span className="badge badge-published">
                            Ad-Free until{" "}
                            {u.wallet.ad_free_until
                              ? new Date(
                                  u.wallet.ad_free_until
                                ).toLocaleDateString()
                              : ""}
                          </span>
                        ) : (
                          <span className="row-sub">Standard</span>
                        )}
                      </td>
                      <td>
                        <div className="btn-group">
                          <button
                            type="button"
                            onClick={() => setDetailUserId(u.id)}
                            className="btn btn-secondary btn-xs"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => setCreditTargetUser(u)}
                            className="btn btn-primary btn-xs"
                          >
                            Wallet / Credits
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleToggleUserFlag(u, "is_staff")
                            }
                            className="btn btn-secondary btn-xs"
                          >
                            {u.is_staff ? "Revoke Staff" : "Make Staff"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleToggleUserFlag(u, "is_prompt_manager")
                            }
                            className="btn btn-secondary btn-xs"
                          >
                            {u.is_prompt_manager ? "Revoke PM" : "Make PM"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleToggleUserFlag(u, "is_active")
                            }
                            className="btn btn-danger btn-xs"
                          >
                            {u.is_active ? "Suspend" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {subTab === "creators" && (
        <>
          <div className="admin-card filter-toolbar">
            <input
              type="search"
              value={creatorSearch}
              onChange={(e) => setCreatorSearch(e.target.value)}
              placeholder="Search creator email or name..."
              className="form-input"
            />
            <select
              value={creatorStatusFilter}
              onChange={(e) => setCreatorStatusFilter(e.target.value)}
              className="form-select"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
            <button
              type="button"
              onClick={() => void refetchCreators()}
              className="btn btn-secondary"
            >
              Refresh
            </button>
          </div>

          <div className="admin-card table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Status</th>
                  <th>Application & Review Notes</th>
                  <th>Followers</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingCreators ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      Loading creators...
                    </td>
                  </tr>
                ) : creators.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      No creator applications found.
                    </td>
                  </tr>
                ) : (
                  creators.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="row-title">{c.display_name}</div>
                        <div className="row-sub">{c.email}</div>
                      </td>
                      <td>
                        <span className={`badge badge-${c.status}`}>
                          {c.status}
                        </span>
                      </td>
                      <td>
                        <div className="row-sub">
                          <strong>Note:</strong> {c.application_note || "—"}
                        </div>
                        {c.review_notes && (
                          <div className="row-sub">
                            <strong>Review:</strong> {c.review_notes}
                          </div>
                        )}
                      </td>
                      <td>{c.follower_count}</td>
                      <td>
                        <div className="btn-group">
                          {c.status !== "approved" && (
                            <button
                              type="button"
                              onClick={() => void handleApproveCreator(c)}
                              className="btn btn-primary btn-xs"
                            >
                              Approve
                            </button>
                          )}
                          {c.status !== "rejected" && (
                            <button
                              type="button"
                              onClick={() => void handleRejectCreator(c)}
                              className="btn btn-danger btn-xs"
                            >
                              Reject
                            </button>
                          )}
                          {c.status === "approved" && (
                            <button
                              type="button"
                              onClick={() => void handleSuspendCreator(c)}
                              className="btn btn-danger btn-xs"
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showCreateUserModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="modal-header">
              <h3 className="admin-card-title">Create User / Staff Account</h3>
              <button
                type="button"
                onClick={() => setShowCreateUserModal(false)}
                className="btn btn-secondary btn-xs"
              >
                Close ✕
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="admin-form">
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Display Name *</label>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Password (min 8 chars)</label>
                  <input
                    type="password"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) =>
                      setNewRole(
                        e.target.value as "user" | "creator" | "admin"
                      )
                    }
                    className="form-select"
                  >
                    <option value="user">User</option>
                    <option value="creator">Creator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="checkbox-group-inline">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={newIsStaff}
                    onChange={(e) => setNewIsStaff(e.target.checked)}
                  />
                  <span>
                    Grant Staff Access (<code>is_staff</code>)
                  </span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={newIsPromptManager}
                    onChange={(e) => setNewIsPromptManager(e.target.checked)}
                  />
                  <span>
                    Grant Prompt Manager Access (
                    <code>is_prompt_manager</code>)
                  </span>
                </label>
              </div>
              <button type="submit" className="btn btn-primary">
                Create Account
              </button>
            </form>
          </div>
        </div>
      )}

      {detailUserId && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <h3 className="admin-card-title">User Detail</h3>
                <p className="admin-card-subtitle">
                  <code>GET /api/v1/adminuser/users/{detailUserId}/</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailUserId(null)}
                className="btn btn-secondary btn-xs"
              >
                Close ✕
              </button>
            </div>
            {isLoadingUserDetail || !userDetailRes?.data ? (
              <p className="row-sub">Loading user detail...</p>
            ) : (
              <>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span>Display Name</span>
                    <strong>
                      {userDetailRes.data.display_name || "Unnamed"}
                    </strong>
                  </div>
                  <div className="detail-item">
                    <span>Email</span>
                    <strong>{userDetailRes.data.email}</strong>
                  </div>
                  <div className="detail-item">
                    <span>Role</span>
                    <strong>{userDetailRes.data.role}</strong>
                  </div>
                  <div className="detail-item">
                    <span>Creator Status</span>
                    <strong>{userDetailRes.data.creator_status || "—"}</strong>
                  </div>
                  <div className="detail-item">
                    <span>Staff / Prompt Manager</span>
                    <strong>
                      {userDetailRes.data.is_staff ? "Staff" : "No"} /{" "}
                      {userDetailRes.data.is_prompt_manager ? "PM" : "No"}
                    </strong>
                  </div>
                  <div className="detail-item">
                    <span>Active / Verified</span>
                    <strong>
                      {userDetailRes.data.is_active ? "Active" : "Disabled"} /{" "}
                      {userDetailRes.data.email_verified
                        ? "Verified"
                        : "Unverified"}
                    </strong>
                  </div>
                  <div className="detail-item">
                    <span>Available Credits</span>
                    <strong>
                      {userDetailRes.data.wallet?.available_credits ?? 0}
                    </strong>
                  </div>
                  <div className="detail-item">
                    <span>Reserved / Used</span>
                    <strong>
                      {userDetailRes.data.wallet?.reserved_credits ?? 0} /{" "}
                      {userDetailRes.data.wallet?.total_used_credits ?? 0}
                    </strong>
                  </div>
                  <div className="detail-item">
                    <span>Ad-Free</span>
                    <strong>
                      {userDetailRes.data.wallet?.is_ad_free
                        ? `Until ${
                            userDetailRes.data.wallet.ad_free_until
                              ? new Date(
                                  userDetailRes.data.wallet.ad_free_until
                                ).toLocaleDateString()
                              : "—"
                          }`
                        : "No"}
                    </strong>
                  </div>
                  <div className="detail-item">
                    <span>Joined</span>
                    <strong>
                      {new Date(
                        userDetailRes.data.date_joined
                      ).toLocaleString()}
                    </strong>
                  </div>
                </div>
                {userDetailRes.data.bio && (
                  <p className="admin-card-subtitle">{userDetailRes.data.bio}</p>
                )}
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setCreditTargetUser(userDetailRes.data);
                      setDetailUserId(null);
                    }}
                  >
                    Adjust Wallet
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {creditTargetUser && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <h3 className="admin-card-title">
                  Wallet & Entitlement: {creditTargetUser.display_name}
                </h3>
                <p className="admin-card-subtitle">
                  Current Available Credits:{" "}
                  <strong>
                    {creditTargetUser.wallet?.available_credits ?? 0}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreditTargetUser(null)}
                className="btn btn-secondary btn-xs"
              >
                Close ✕
              </button>
            </div>

            <form onSubmit={handleAdjustCredits} className="admin-form">
              <div className="form-grid-2">
                <div>
                  <label className="form-label">
                    Credits Delta (+ to grant, - to deduct) *
                  </label>
                  <input
                    type="number"
                    value={creditsDelta}
                    onChange={(e) => setCreditsDelta(Number(e.target.value))}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Adjustment Reason *</label>
                  <input
                    type="text"
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                Apply Credit Adjustment
              </button>
            </form>

            <hr className="divider" />

            <div className="admin-form">
              <label className="form-label">
                Extend Ad-Free Entitlement (Days)
              </label>
              <div className="btn-group">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={adFreeDays}
                  onChange={(e) => setAdFreeDays(Number(e.target.value))}
                  className="form-input"
                />
                <button
                  type="button"
                  onClick={() => void handleExtendEntitlement()}
                  className="btn btn-secondary"
                >
                  Extend Ad-Free Days
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
