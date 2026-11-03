import {
  extractRtkError,
  useGetDashboardAnalyticsQuery,
} from "@/store/adminuserApi";

type Props = {
  onNavigate: (tab: string) => void;
};

export default function DashboardView({ onNavigate }: Props) {
  const {
    data: res,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetDashboardAnalyticsQuery();

  const analytics = res?.data;
  const errorMsg = error ? extractRtkError(error).message : null;

  return (
    <div className="section-stack">
      <div className="section-header-bar">
        <div>
          <h1 className="section-title">Platform Analytics Overview</h1>
          <p className="section-subtitle">
            Real-time metrics via RTK Query (
            <code>GET /api/v1/adminuser/dashboard/</code>)
          </p>
        </div>
        <div className="btn-group">
          <button
            type="button"
            onClick={() => onNavigate("upload")}
            className="btn btn-primary"
          >
            + Upload Prompt JSON
          </button>
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            className="btn btn-secondary"
          >
            Platform Settings
          </button>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isLoading || isFetching}
            className="btn btn-secondary"
          >
            {isFetching ? "Refreshing..." : "Refresh Stats"}
          </button>
        </div>
      </div>

      {errorMsg && <div className="alert alert-error">{errorMsg}</div>}

      {analytics && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card" onClick={() => onNavigate("users")}>
              <span className="kpi-label">Total Users</span>
              <div className="kpi-value">
                {analytics.users.total.toLocaleString()}
              </div>
              <div className="kpi-foot">
                <span className="badge badge-published">
                  {analytics.users.active} active
                </span>
                <span>+{analytics.users.new_last_7_days} last 7d</span>
              </div>
            </div>

            <div className="kpi-card" onClick={() => onNavigate("prompts")}>
              <span className="kpi-label">Total Prompts</span>
              <div className="kpi-value">
                {analytics.prompts.total.toLocaleString()}
              </div>
              <div className="kpi-foot">
                <span className="badge badge-published">
                  {analytics.prompts.published} published
                </span>
                {analytics.prompts.pending > 0 && (
                  <span className="badge badge-pending">
                    {analytics.prompts.pending} pending
                  </span>
                )}
              </div>
            </div>

            <div className="kpi-card" onClick={() => onNavigate("creators")}>
              <span className="kpi-label">Creators</span>
              <div className="kpi-value">
                {analytics.users.creators.total.toLocaleString()}
              </div>
              <div className="kpi-foot">
                <span className="badge badge-published">
                  {analytics.users.creators.approved} approved
                </span>
                {analytics.users.creators.pending > 0 && (
                  <span className="badge badge-pending">
                    {analytics.users.creators.pending} pending review
                  </span>
                )}
              </div>
            </div>

            <div className="kpi-card" onClick={() => onNavigate("generations")}>
              <span className="kpi-label">AI Generations</span>
              <div className="kpi-value">
                {analytics.generations.total.toLocaleString()}
              </div>
              <div className="kpi-foot">
                <span className="badge badge-published">
                  {analytics.generations.completed} completed
                </span>
                <span>
                  {analytics.generations.pending +
                    analytics.generations.processing}{" "}
                  in queue
                </span>
              </div>
            </div>
          </div>

          <div className="dashboard-detail-grid">
            <div className="admin-card">
              <h3 className="admin-card-title">Prompts & Engagement</h3>
              <div className="stat-list">
                <div className="stat-row">
                  <span>Published / Pending / Draft</span>
                  <strong>
                    {analytics.prompts.published} / {analytics.prompts.pending} /{" "}
                    {analytics.prompts.draft}
                  </strong>
                </div>
                <div className="stat-row">
                  <span>Featured / Premium / Mature</span>
                  <strong>
                    {analytics.prompts.featured} / {analytics.prompts.premium} /{" "}
                    {analytics.prompts.mature}
                  </strong>
                </div>
                <div className="stat-row">
                  <span>Total Views</span>
                  <strong>
                    {analytics.prompts.total_views.toLocaleString()}
                  </strong>
                </div>
                <div className="stat-row">
                  <span>Total Copies</span>
                  <strong>
                    {analytics.prompts.total_copies.toLocaleString()}
                  </strong>
                </div>
                <div className="stat-row">
                  <span>Total Favorites / Worked Votes</span>
                  <strong>
                    {analytics.prompts.total_favorites.toLocaleString()} /{" "}
                    {analytics.prompts.total_worked_votes.toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            <div className="admin-card">
              <h3 className="admin-card-title">Billing & Wallet Credits</h3>
              <div className="stat-list">
                <div className="stat-row">
                  <span>Paid Orders / Total Orders</span>
                  <strong>
                    {analytics.billing.paid_orders} /{" "}
                    {analytics.billing.total_orders}
                  </strong>
                </div>
                <div className="stat-row">
                  <span>Refunded / Reconciliation Needed</span>
                  <strong>
                    {analytics.billing.refunded_orders} /{" "}
                    <span
                      className={
                        analytics.billing.reconciliation_required > 0
                          ? "text-danger"
                          : ""
                      }
                    >
                      {analytics.billing.reconciliation_required}
                    </span>
                  </strong>
                </div>
                <div className="stat-row">
                  <span>Revenue by Currency</span>
                  <strong>
                    {Object.entries(analytics.billing.revenue_by_currency)
                      .length > 0
                      ? Object.entries(analytics.billing.revenue_by_currency)
                          .map(([curr, amt]) => `${curr}: ${amt}`)
                          .join(" | ")
                      : "0.00"}
                  </strong>
                </div>
                <div className="stat-row">
                  <span>Available / Reserved Credits</span>
                  <strong>
                    {analytics.billing.credits.available.toLocaleString()} /{" "}
                    {analytics.billing.credits.reserved.toLocaleString()}
                  </strong>
                </div>
                <div className="stat-row">
                  <span>Purchased / Used Credits</span>
                  <strong>
                    {analytics.billing.credits.purchased.toLocaleString()} /{" "}
                    {analytics.billing.credits.used.toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            <div className="admin-card">
              <h3 className="admin-card-title">Catalog, Blog & Staff</h3>
              <div className="stat-list">
                <div className="stat-row">
                  <span>Active / Total Categories</span>
                  <strong>
                    {analytics.content.categories_active} /{" "}
                    {analytics.content.categories_total}
                  </strong>
                </div>
                <div className="stat-row">
                  <span>Total Tags</span>
                  <strong>
                    {analytics.content.tags_total.toLocaleString()}
                  </strong>
                </div>
                <div className="stat-row">
                  <span>Blog Posts (Published / Draft)</span>
                  <strong>
                    {analytics.content.blog_posts.published} /{" "}
                    {analytics.content.blog_posts.draft} (Total:{" "}
                    {analytics.content.blog_posts.total})
                  </strong>
                </div>
                <div className="stat-row">
                  <span>Staff Accounts</span>
                  <strong>{analytics.users.staff}</strong>
                </div>
                <div className="stat-row">
                  <span>New Users (Last 30 Days)</span>
                  <strong>+{analytics.users.new_last_30_days}</strong>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
