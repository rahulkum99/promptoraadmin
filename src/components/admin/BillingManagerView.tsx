import React, { useState } from "react";
import {
  extractRtkError,
  useCreateCreditPackageMutation,
  useCreatePricingRuleMutation,
  useDeleteCreditPackageMutation,
  useDeletePricingRuleMutation,
  useGetCreditPackagesQuery,
  useGetCreditPurchasesQuery,
  useGetCreditTransactionsQuery,
  useGetPricingRulesQuery,
  useUpdateCreditPackageMutation,
  useUpdatePricingRuleMutation,
} from "@/store/adminuserApi";
import type { AdminCreditPackage, AdminCreditPricingRule } from "@/types/adminuser";

export default function BillingManagerView() {
  const [subTab, setSubTab] = useState<
    "packages" | "pricing" | "purchases" | "transactions"
  >("packages");

  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Package create state
  const [pkgName, setPkgName] = useState<string>("");
  const [pkgDesc, setPkgDesc] = useState<string>("");
  const [pkgPrice, setPkgPrice] = useState<string>("9.99");
  const [pkgCurrency, setPkgCurrency] = useState<string>("USD");
  const [pkgCredits, setPkgCredits] = useState<number>(100);
  const [pkgAdFreeDays, setPkgAdFreeDays] = useState<number>(30);
  const [pkgSortOrder, setPkgSortOrder] = useState<number>(1);

  // Pricing rule create state
  const [ruleModel, setRuleModel] = useState<string>("gpt-image-1");
  const [ruleQuality, setRuleQuality] = useState<string>("high");
  const [ruleSize, setRuleSize] = useState<string>("1024x1536");
  const [ruleCredits, setRuleCredits] = useState<number>(8);

  const [editingRule, setEditingRule] = useState<AdminCreditPricingRule | null>(
    null
  );
  const [editRuleModel, setEditRuleModel] = useState<string>("");
  const [editRuleQuality, setEditRuleQuality] = useState<string>("");
  const [editRuleSize, setEditRuleSize] = useState<string>("");
  const [editRuleCredits, setEditRuleCredits] = useState<number>(1);
  const [editRuleActive, setEditRuleActive] = useState<boolean>(true);

  // Filters
  const [reconciliationOnly, setReconciliationOnly] = useState<boolean>(false);
  const [txTypeFilter, setTxTypeFilter] = useState<string>("");

  // RTK Queries
  const { data: pkgRes } = useGetCreditPackagesQuery(undefined, {
    skip: subTab !== "packages",
  });
  const { data: pricingRes } = useGetPricingRulesQuery(undefined, {
    skip: subTab !== "pricing",
  });
  const { data: purchaseRes } = useGetCreditPurchasesQuery(
    {
      reconciliation_required: reconciliationOnly ? "true" : undefined,
    },
    { skip: subTab !== "purchases" }
  );
  const { data: txRes } = useGetCreditTransactionsQuery(
    {
      transaction_type: txTypeFilter || undefined,
    },
    { skip: subTab !== "transactions" }
  );

  // RTK Mutations
  const [createPackage] = useCreateCreditPackageMutation();
  const [updatePackage] = useUpdateCreditPackageMutation();
  const [deletePackage] = useDeleteCreditPackageMutation();
  const [createRule] = useCreatePricingRuleMutation();
  const [updateRule, { isLoading: isUpdatingRule }] =
    useUpdatePricingRuleMutation();
  const [deleteRule] = useDeletePricingRuleMutation();

  const packages = pkgRes?.data ?? [];
  const pricingRules = pricingRes?.data ?? [];
  const purchases = purchaseRes?.data ?? [];
  const transactions = txRes?.data ?? [];

  async function handleCreatePackage(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await createPackage({
        name: pkgName,
        description: pkgDesc,
        price: pkgPrice,
        currency: pkgCurrency,
        total_credits: pkgCredits,
        ad_free_days: pkgAdFreeDays,
        is_active: true,
        sort_order: pkgSortOrder,
      }).unwrap();
      setFeedback(`Created package "${res.data.name}".`);
      setPkgName("");
      setPkgDesc("");
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleTogglePackage(pkg: AdminCreditPackage) {
    setError(null);
    try {
      await updatePackage({
        packageId: pkg.id,
        data: { is_active: !pkg.is_active },
      }).unwrap();
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleDeletePackage(pkg: AdminCreditPackage) {
    if (!window.confirm(`Delete credit package "${pkg.name}"?`)) return;
    setError(null);
    try {
      await deletePackage(pkg.id).unwrap();
      setFeedback("Package deleted.");
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createRule({
        model_name: ruleModel,
        quality: ruleQuality,
        size: ruleSize,
        credits_required: ruleCredits,
        is_active: true,
      }).unwrap();
      setFeedback("Pricing rule created.");
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  function openEditRule(rule: AdminCreditPricingRule) {
    setEditingRule(rule);
    setEditRuleModel(rule.model_name);
    setEditRuleQuality(rule.quality);
    setEditRuleSize(rule.size);
    setEditRuleCredits(rule.credits_required);
    setEditRuleActive(rule.is_active);
  }

  async function handleSaveRule(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRule) return;
    setError(null);
    try {
      await updateRule({
        ruleId: editingRule.id,
        data: {
          model_name: editRuleModel,
          quality: editRuleQuality,
          size: editRuleSize,
          credits_required: editRuleCredits,
          is_active: editRuleActive,
        },
      }).unwrap();
      setFeedback("Pricing rule updated.");
      setEditingRule(null);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleToggleRule(rule: AdminCreditPricingRule) {
    setError(null);
    try {
      await updateRule({
        ruleId: rule.id,
        data: { is_active: !rule.is_active },
      }).unwrap();
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleDeleteRule(ruleId: string) {
    if (!window.confirm("Delete this pricing rule?")) return;
    setError(null);
    try {
      await deleteRule(ruleId).unwrap();
      setFeedback("Pricing rule deleted.");
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  return (
    <div className="section-stack">
      <div className="section-header-bar">
        <div>
          <h1 className="section-title">Billing, Credit Packages & Ledger</h1>
          <p className="section-subtitle">
            Manage credit bundles, generation pricing rules, purchases, and
            credit ledger entries via RTK Query
          </p>
        </div>
        <div className="tab-pills">
          <button
            type="button"
            className={`tab-pill ${subTab === "packages" ? "active" : ""}`}
            onClick={() => setSubTab("packages")}
          >
            Credit Packages
          </button>
          <button
            type="button"
            className={`tab-pill ${subTab === "pricing" ? "active" : ""}`}
            onClick={() => setSubTab("pricing")}
          >
            Pricing Rules
          </button>
          <button
            type="button"
            className={`tab-pill ${subTab === "purchases" ? "active" : ""}`}
            onClick={() => setSubTab("purchases")}
          >
            Purchases
          </button>
          <button
            type="button"
            className={`tab-pill ${subTab === "transactions" ? "active" : ""}`}
            onClick={() => setSubTab("transactions")}
          >
            Credit Ledger
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {feedback && <div className="alert alert-success">{feedback}</div>}

      {subTab === "packages" && (
        <div className="split-grid">
          <form onSubmit={handleCreatePackage} className="admin-card admin-form">
            <h3 className="admin-card-title">Create Credit Package</h3>
            <div>
              <label className="form-label">Package Name *</label>
              <input
                type="text"
                value={pkgName}
                onChange={(e) => setPkgName(e.target.value)}
                placeholder="Pro Creator Pack"
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="form-label">Description</label>
              <input
                type="text"
                value={pkgDesc}
                onChange={(e) => setPkgDesc(e.target.value)}
                placeholder="100 AI generation credits + 30 days ad-free"
                className="form-input"
              />
            </div>
            <div className="form-grid-2">
              <div>
                <label className="form-label">Price *</label>
                <input
                  type="text"
                  value={pkgPrice}
                  onChange={(e) => setPkgPrice(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Currency *</label>
                <input
                  type="text"
                  value={pkgCurrency}
                  onChange={(e) => setPkgCurrency(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
            </div>
            <div className="form-grid-3">
              <div>
                <label className="form-label">Total Credits *</label>
                <input
                  type="number"
                  min={1}
                  value={pkgCredits}
                  onChange={(e) => setPkgCredits(Number(e.target.value))}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Ad-Free Days</label>
                <input
                  type="number"
                  min={0}
                  value={pkgAdFreeDays}
                  onChange={(e) => setPkgAdFreeDays(Number(e.target.value))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Sort Order</label>
                <input
                  type="number"
                  value={pkgSortOrder}
                  onChange={(e) => setPkgSortOrder(Number(e.target.value))}
                  className="form-input"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              Create Package
            </button>
          </form>

          <div className="admin-card table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Price</th>
                  <th>Credits / Ad-Free</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td>
                      <div className="row-title">{pkg.name}</div>
                      <div className="row-sub">
                        <code>{pkg.slug}</code>
                      </div>
                    </td>
                    <td>
                      <strong>
                        {pkg.currency} {pkg.price}
                      </strong>
                    </td>
                    <td>
                      {pkg.total_credits} credits • {pkg.ad_free_days}d ad-free
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          pkg.is_active ? "badge-published" : "badge-archived"
                        }`}
                      >
                        {pkg.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          type="button"
                          onClick={() => void handleTogglePackage(pkg)}
                          className="btn btn-secondary btn-xs"
                        >
                          {pkg.is_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeletePackage(pkg)}
                          className="btn btn-danger btn-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "pricing" && (
        <div className="split-grid">
          <form onSubmit={handleCreateRule} className="admin-card admin-form">
            <h3 className="admin-card-title">
              Create Image Credit Pricing Rule
            </h3>
            <div>
              <label className="form-label">Model Name *</label>
              <input
                type="text"
                value={ruleModel}
                onChange={(e) => setRuleModel(e.target.value)}
                placeholder="gpt-image-1"
                className="form-input"
                required
              />
            </div>
            <div className="form-grid-2">
              <div>
                <label className="form-label">Quality *</label>
                <input
                  type="text"
                  value={ruleQuality}
                  onChange={(e) => setRuleQuality(e.target.value)}
                  placeholder="low | medium | high"
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Size *</label>
                <input
                  type="text"
                  value={ruleSize}
                  onChange={(e) => setRuleSize(e.target.value)}
                  placeholder="1024x1024"
                  className="form-input"
                  required
                />
              </div>
            </div>
            <div>
              <label className="form-label">Credits Required *</label>
              <input
                type="number"
                min={1}
                value={ruleCredits}
                onChange={(e) => setRuleCredits(Number(e.target.value))}
                className="form-input"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Save Pricing Rule
            </button>
          </form>

          <div className="admin-card table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Quality</th>
                  <th>Size</th>
                  <th>Credits Cost</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pricingRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <code>{rule.model_name}</code>
                    </td>
                    <td>{rule.quality}</td>
                    <td>{rule.size}</td>
                    <td>
                      <strong>{rule.credits_required} credits</strong>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          rule.is_active ? "badge-published" : "badge-archived"
                        }`}
                      >
                        {rule.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          type="button"
                          onClick={() => openEditRule(rule)}
                          className="btn btn-secondary btn-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleRule(rule)}
                          className="btn btn-secondary btn-xs"
                        >
                          {rule.is_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRule(rule.id)}
                          className="btn btn-danger btn-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "purchases" && (
        <div className="admin-card table-container">
          <div className="card-Search-bar">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={reconciliationOnly}
                onChange={(e) => setReconciliationOnly(e.target.checked)}
              />
              <span>Show only orders requiring refund reconciliation</span>
            </label>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Package</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Provider Order ID</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No purchase records found.
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p.id}>
                    <td>{p.user_email}</td>
                    <td>
                      {p.package_name_snapshot} ({p.purchased_credits_snapshot}{" "}
                      cr)
                    </td>
                    <td>
                      {p.currency} {p.amount_snapshot}
                    </td>
                    <td>
                      <span className={`badge badge-${p.status}`}>
                        {p.status}
                      </span>
                      {p.refund_reconciliation_required && (
                        <span className="badge badge-rejected">Reconcile!</span>
                      )}
                    </td>
                    <td>
                      <code>{p.provider_order_id || "—"}</code>
                    </td>
                    <td>{new Date(p.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {subTab === "transactions" && (
        <div className="admin-card table-container">
          <div className="card-Search-bar">
            <input
              type="text"
              value={txTypeFilter}
              onChange={(e) => setTxTypeFilter(e.target.value)}
              placeholder="Filter transaction_type (e.g. admin_adjustment, purchase, generation_debit)..."
              className="form-input"
            />
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Type</th>
                <th>Delta</th>
                <th>Balance After</th>
                <th>Reason / Description</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No credit ledger entries found.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.user_email}</td>
                    <td>
                      <code>{tx.transaction_type}</code>
                    </td>
                    <td>
                      <strong
                        className={
                          tx.credits >= 0 ? "text-success" : "text-danger"
                        }
                      >
                        {tx.credits >= 0 ? `+${tx.credits}` : tx.credits}
                      </strong>
                    </td>
                    <td>{tx.balance_after}</td>
                    <td>{tx.description || "—"}</td>
                    <td>{new Date(tx.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingRule && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <h3 className="admin-card-title">Edit Pricing Rule</h3>
                <p className="admin-card-subtitle">
                  <code>
                    PATCH /api/v1/adminuser/billing/pricing-rules/
                    {editingRule.id}/
                  </code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="btn btn-secondary btn-xs"
              >
                Close ✕
              </button>
            </div>
            <form onSubmit={handleSaveRule} className="admin-form">
              <div>
                <label className="form-label">Model Name *</label>
                <input
                  type="text"
                  value={editRuleModel}
                  onChange={(e) => setEditRuleModel(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Quality *</label>
                  <input
                    type="text"
                    value={editRuleQuality}
                    onChange={(e) => setEditRuleQuality(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Size *</label>
                  <input
                    type="text"
                    value={editRuleSize}
                    onChange={(e) => setEditRuleSize(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Credits Required *</label>
                <input
                  type="number"
                  min={1}
                  value={editRuleCredits}
                  onChange={(e) => setEditRuleCredits(Number(e.target.value))}
                  className="form-input"
                  required
                />
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={editRuleActive}
                  onChange={(e) => setEditRuleActive(e.target.checked)}
                />
                <span>Active</span>
              </label>
              <button
                type="submit"
                disabled={isUpdatingRule}
                className="btn btn-primary"
              >
                {isUpdatingRule ? "Saving..." : "Save Pricing Rule"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
