import React, { useState } from "react";
import {
  extractRtkError,
  useApproveAdminPromptMutation,
  useBulkPromptActionMutation,
  useDeleteAdminPromptBySlugMutation,
  useDeleteAdminPromptImageMutation,
  useGetAdminCategoriesQuery,
  useGetAdminPromptsQuery,
  useLazyGetAdminPromptBySlugQuery,
  useRejectAdminPromptMutation,
  useUpdateAdminPromptBySlugMutation,
  useUploadAdminPromptImageMutation,
} from "@/store/adminuserApi";
import type { AdminPrompt, BulkPromptActionType } from "@/types/adminuser";

type Props = {
  onOpenUploader: () => void;
};

export default function PromptsManagerView({ onOpenUploader }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Filters
  const [page, setPage] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [featuredFilter, setFeaturedFilter] = useState<string>("");
  const [premiumFilter, setPremiumFilter] = useState<string>("");
  const [privateFilter, setPrivateFilter] = useState<string>("");
  const [ordering, setOrdering] = useState<string>("-created_at");

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionType, setBulkActionType] =
    useState<BulkPromptActionType>("publish");

  // Edit / Detail Drawer state
  const [editingPrompt, setEditingPrompt] = useState<AdminPrompt | null>(null);
  const [editJsonText, setEditJsonText] = useState<string>("");
  const [editPreviewFile, setEditPreviewFile] = useState<File | null>(null);
  const [extraImageFile, setExtraImageFile] = useState<File | null>(null);
  const [copyingPromptId, setCopyingPromptId] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  const {
    data: res,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useGetAdminPromptsQuery({
    page,
    status: statusFilter || undefined,
    search: search.trim() || undefined,
    category: categoryFilter || undefined,
    featured: featuredFilter || undefined,
    premium: premiumFilter || undefined,
    is_private: privateFilter || undefined,
    ordering,
  });

  const { data: catRes } = useGetAdminCategoriesQuery({ is_active: "true" });
  const [fetchPromptBySlug] = useLazyGetAdminPromptBySlugQuery();

  const [bulkPromptAction] = useBulkPromptActionMutation();
  const [approvePrompt] = useApproveAdminPromptMutation();
  const [rejectPrompt] = useRejectAdminPromptMutation();
  const [deletePrompt] = useDeleteAdminPromptBySlugMutation();
  const [updatePrompt, { isLoading: isSavingEdit }] =
    useUpdateAdminPromptBySlugMutation();
  const [uploadExtraImage, { isLoading: isUploadingExtra }] =
    useUploadAdminPromptImageMutation();
  const [deleteExtraImage] = useDeleteAdminPromptImageMutation();

  const prompts = res?.data ?? [];
  const categories = catRes?.data ?? [];
  const meta = res?.meta;
  const displayError =
    error || (queryError ? extractRtkError(queryError).message : null);

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === prompts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(prompts.map((p) => p.id));
    }
  }

  async function handleRunBulkAction() {
    if (selectedIds.length === 0) return;
    if (
      bulkActionType === "delete" &&
      !window.confirm(`Delete ${selectedIds.length} selected prompt(s)?`)
    ) {
      return;
    }
    setError(null);
    setFeedback(null);
    try {
      const result = await bulkPromptAction({
        promptIds: selectedIds,
        action: bulkActionType,
      }).unwrap();
      setFeedback(
        `Bulk action '${result.data.action}' affected ${result.data.affected_count} prompt(s).`
      );
      setSelectedIds([]);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleApprove(prompt: AdminPrompt) {
    setError(null);
    try {
      await approvePrompt(prompt.id).unwrap();
      setFeedback(`Approved prompt "${prompt.title}".`);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleReject(prompt: AdminPrompt) {
    const reason = window.prompt(
      "Enter rejection reason:",
      "Does not meet quality standards"
    );
    if (!reason) return;
    setError(null);
    try {
      await rejectPrompt({ promptId: prompt.id, reason }).unwrap();
      setFeedback(`Rejected prompt "${prompt.title}".`);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  function formatPromptCopyText(prompt: AdminPrompt): string {
    const promptText = (prompt.prompt_text || "").trim();
    const negativePrompt = (prompt.negative_prompt || "").trim();
    if (promptText && negativePrompt) {
      return `${promptText}\n\nNegative prompt:\n${negativePrompt}`;
    }
    return promptText || negativePrompt;
  }

  async function writeClipboard(text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // Fall through to execCommand when Clipboard API is blocked.
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  }

  async function handleCopyPrompt(prompt: AdminPrompt) {
    setError(null);
    setCopyingPromptId(prompt.id);
    try {
      let source = prompt;
      if (!prompt.prompt_text?.trim() || prompt.negative_prompt == null) {
        const detail = await fetchPromptBySlug(prompt.slug).unwrap();
        source = detail.data;
      }
      const text = formatPromptCopyText(source);
      if (!text) {
        setError(
          `No prompt text or negative prompt available for "${prompt.title}".`
        );
        return;
      }
      await writeClipboard(text);
      setCopiedPromptId(prompt.id);
      setFeedback(
        `Copied prompt text and negative prompt for "${prompt.title}".`
      );
      window.setTimeout(() => {
        setCopiedPromptId((current) =>
          current === prompt.id ? null : current
        );
      }, 2000);
    } catch (err) {
      setError(extractRtkError(err).message || "Could not copy prompt.");
    } finally {
      setCopyingPromptId(null);
    }
  }

  async function handleDelete(prompt: AdminPrompt) {
    if (!window.confirm(`Delete prompt "${prompt.title}" (${prompt.slug})?`)) {
      return;
    }
    setError(null);
    try {
      await deletePrompt(prompt.slug).unwrap();
      setFeedback(`Deleted prompt "${prompt.title}".`);
      if (editingPrompt?.id === prompt.id) setEditingPrompt(null);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  function populateEditForm(prompt: AdminPrompt) {
    setEditingPrompt(prompt);
    setEditPreviewFile(null);
    setExtraImageFile(null);
    setEditJsonText(
      JSON.stringify(
        {
          title: prompt.title,
          slug: prompt.slug,
          description: prompt.description,
          prompt_text: prompt.prompt_text || "",
          negative_prompt: prompt.negative_prompt || "",
          category: prompt.category?.name || "",
          tags: prompt.tags.map((t) => t.name),
          aspect_ratio: prompt.aspect_ratio,
          ai_tool: prompt.ai_tool,
          generation_settings: prompt.generation_settings || {},
          is_featured: prompt.is_featured,
          is_premium: prompt.is_premium,
          is_mature: prompt.is_mature,
          is_private: prompt.is_private,
          status: prompt.status,
          moderation_notes: prompt.moderation_notes || "",
        },
        null,
        2
      )
    );
  }

  async function openEditModal(prompt: AdminPrompt) {
    populateEditForm(prompt);
    try {
      const detail = await fetchPromptBySlug(prompt.slug).unwrap();
      populateEditForm(detail.data);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPrompt) return;
    setError(null);
    try {
      const updated = await updatePrompt({
        slug: editingPrompt.slug,
        promptJson: editJsonText,
        previewImage: editPreviewFile,
      }).unwrap();
      setEditingPrompt(updated.data);
      setFeedback(`Updated prompt "${updated.data.title}".`);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleUploadExtraImage() {
    if (!editingPrompt || !extraImageFile) return;
    setError(null);
    try {
      const imgRes = await uploadExtraImage({
        promptId: editingPrompt.id,
        imageFile: extraImageFile,
      }).unwrap();
      setEditingPrompt({
        ...editingPrompt,
        additional_images: [...editingPrompt.additional_images, imgRes.data],
      });
      setExtraImageFile(null);
      setFeedback("Additional image uploaded.");
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleRemoveExtraImage(imageId: string) {
    if (!editingPrompt) return;
    setError(null);
    try {
      await deleteExtraImage({
        promptId: editingPrompt.id,
        imageId,
      }).unwrap();
      setEditingPrompt({
        ...editingPrompt,
        additional_images: editingPrompt.additional_images.filter(
          (img) => img.id !== imageId
        ),
      });
      setFeedback("Removed additional image.");
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  return (
    <div className="section-stack">
      <div className="section-header-bar">
        <div>
          <h1 className="section-title">Prompts Management & Moderation</h1>
          <p className="section-subtitle">
            Browse, filter, bulk-update, moderate, or edit JSON payloads for all
            prompts via RTK Query.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenUploader}
          className="btn btn-primary"
        >
          + Upload Prompt JSON + Image
        </button>
      </div>

      {displayError && <div className="alert alert-error">{displayError}</div>}
      {feedback && <div className="alert alert-success">{feedback}</div>}

      <div className="admin-card filter-toolbar">
        <input
          type="search"
          placeholder="Search title, slug, prompt text..."
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="form-input"
        />

        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="form-select"
        >
          <option value="">All Statuses</option>
          <option value="published">Published</option>
          <option value="pending">Pending Review</option>
          <option value="draft">Draft</option>
          <option value="rejected">Rejected</option>
          <option value="archived">Archived</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => {
            setPage(1);
            setCategoryFilter(e.target.value);
          }}
          className="form-select"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>

        <select
          value={featuredFilter}
          onChange={(e) => {
            setPage(1);
            setFeaturedFilter(e.target.value);
          }}
          className="form-select"
        >
          <option value="">Featured: Any</option>
          <option value="true">Featured Only</option>
          <option value="false">Non-Featured</option>
        </select>

        <select
          value={premiumFilter}
          onChange={(e) => {
            setPage(1);
            setPremiumFilter(e.target.value);
          }}
          className="form-select"
        >
          <option value="">Tier: Any</option>
          <option value="true">Premium Only</option>
          <option value="false">Free Only</option>
        </select>

        <select
          value={privateFilter}
          onChange={(e) => {
            setPage(1);
            setPrivateFilter(e.target.value);
          }}
          className="form-select"
        >
          <option value="">Visibility: Any</option>
          <option value="true">Private Only</option>
          <option value="false">Public Only</option>
        </select>

        <select
          value={ordering}
          onChange={(e) => setOrdering(e.target.value)}
          className="form-select"
        >
          <option value="-created_at">Newest First</option>
          <option value="created_at">Oldest First</option>
          <option value="-popularity_score">Top Popularity</option>
          <option value="-copy_count">Most Copied</option>
          <option value="-view_count">Most Viewed</option>
        </select>

        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="btn btn-secondary"
        >
          {isFetching ? "Syncing..." : "Refresh"}
        </button>
      </div>

      {selectedIds.length > 0 && (
        <div className="bulk-action-bar">
          <span>
            <strong>{selectedIds.length}</strong> prompt(s) selected
          </span>
          <div className="btn-group">
            <select
              value={bulkActionType}
              onChange={(e) =>
                setBulkActionType(e.target.value as BulkPromptActionType)
              }
              className="form-select"
            >
              <option value="publish">Publish</option>
              <option value="archive">Archive</option>
              <option value="feature">Feature</option>
              <option value="unfeature">Unfeature</option>
              <option value="mark_premium">Mark Premium</option>
              <option value="unmark_premium">Unmark Premium</option>
              <option value="delete">Delete</option>
            </select>
            <button
              type="button"
              onClick={() => void handleRunBulkAction()}
              className="btn btn-primary btn-xs"
            >
              Apply Bulk Action
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="btn btn-secondary btn-xs"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="admin-card table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={
                    prompts.length > 0 && selectedIds.length === prompts.length
                  }
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Preview</th>
              <th>Prompt Title & Slug</th>
              <th>Category & Tags</th>
              <th>Status & Flags</th>
              <th>Engagement</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="empty-cell">
                  Loading prompts...
                </td>
              </tr>
            ) : prompts.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-cell">
                  No prompts match the current filters.
                </td>
              </tr>
            ) : (
              prompts.map((prompt) => (
                <tr key={prompt.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(prompt.id)}
                      onChange={() => toggleSelect(prompt.id)}
                    />
                  </td>
                  <td>
                    {prompt.preview_image ? (
                      <img
                        src={prompt.preview_image}
                        alt={prompt.title}
                        className="table-thumb"
                      />
                    ) : (
                      <div className="table-thumb-placeholder">No Img</div>
                    )}
                  </td>
                  <td>
                    <div className="row-title">{prompt.title}</div>
                    <div className="row-sub">
                      <code>{prompt.slug}</code> • {prompt.ai_tool || "AI"} (
                      {prompt.aspect_ratio})
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {prompt.category?.name || "Uncategorized"}
                    </span>
                    <div className="tag-Wrap">
                      {prompt.tags.slice(0, 4).map((t) => (
                        <span key={t.id} className="tag-chip">
                          #{t.slug}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${prompt.status}`}>
                      {prompt.status}
                    </span>
                    <div className="flag-badges">
                      {prompt.is_featured && (
                        <span className="badge badge-featured">Featured</span>
                      )}
                      {prompt.is_premium && (
                        <span className="badge badge-premium">Premium</span>
                      )}
                      {prompt.is_mature && <span className="badge">18+</span>}
                      {prompt.is_private && (
                        <span className="badge badge-archived">Private</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="row-sub">
                      Views: <strong>{prompt.view_count}</strong> | Copies:{" "}
                      <strong>{prompt.copy_count}</strong>
                    </div>
                    <div className="row-sub">
                      Favs: <strong>{prompt.favorite_count}</strong> | Worked:{" "}
                      <strong>{prompt.worked_count}</strong>
                    </div>
                  </td>
                  <td>
                    <div className="btn-group">
                      <button
                        type="button"
                        onClick={() => void handleCopyPrompt(prompt)}
                        disabled={copyingPromptId === prompt.id}
                        className="btn btn-secondary btn-xs"
                      >
                        {copyingPromptId === prompt.id
                          ? "Copying..."
                          : copiedPromptId === prompt.id
                            ? "Copied"
                            : "Copy Prompt"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(prompt)}
                        className="btn btn-secondary btn-xs"
                      >
                        Edit JSON
                      </button>
                      {prompt.status === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleApprove(prompt)}
                            className="btn btn-primary btn-xs"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReject(prompt)}
                            className="btn btn-danger btn-xs"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDelete(prompt)}
                        className="btn btn-danger btn-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {meta && (
          <div className="pagination-bar">
            <span>
              Page {meta.page} • Showing {prompts.length} of {meta.total} total
              prompts
            </span>
            <div className="btn-group">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-secondary btn-xs"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page * meta.page_size >= meta.total}
                onClick={() => setPage((p) => p + 1)}
                className="btn btn-secondary btn-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {editingPrompt && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <h3 className="admin-card-title">
                  Edit Prompt: {editingPrompt.title}
                </h3>
                <p className="admin-card-subtitle">
                  <code>
                    PATCH /api/v1/adminuser/prompts/{editingPrompt.slug}/
                  </code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPrompt(null)}
                className="btn btn-secondary btn-xs"
              >
                Close ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="admin-form">
              <label className="form-label">Prompt JSON Payload</label>
              <textarea
                rows={12}
                value={editJsonText}
                onChange={(e) => setEditJsonText(e.target.value)}
                className="form-textarea font-mono"
              />

              <div className="form-grid-2">
                <div className="file-upload-box">
                  <label className="form-label">
                    Replace Main Preview Image
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) =>
                      setEditPreviewFile(e.target.files?.[0] || null)
                    }
                    className="form-file-input"
                  />
                </div>

                <div className="file-upload-box">
                  <label className="form-label">
                    Add Extra Image (max 8,{" "}
                    <code>POST /prompts/{editingPrompt.id}/images/</code>)
                  </label>
                  <div className="btn-group">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) =>
                        setExtraImageFile(e.target.files?.[0] || null)
                      }
                      className="form-file-input"
                    />
                    <button
                      type="button"
                      disabled={
                        !extraImageFile ||
                        isSavingEdit ||
                        isUploadingExtra ||
                        (editingPrompt.additional_images?.length ?? 0) >= 8
                      }
                      onClick={() => void handleUploadExtraImage()}
                      className="btn btn-secondary btn-xs"
                    >
                      {isUploadingExtra ? "Uploading..." : "Upload Extra"}
                    </button>
                  </div>
                </div>
              </div>

              {editingPrompt.additional_images?.length > 0 && (
                <div>
                  <label className="form-label">
                    Existing Additional Images
                  </label>
                  <div className="extra-images-strip">
                    {editingPrompt.additional_images.map((img) => (
                      <div key={img.id} className="extra-image-card">
                        <img src={img.image} alt="" className="table-thumb" />
                        <button
                          type="button"
                          onClick={() => void handleRemoveExtraImage(img.id)}
                          className="btn btn-danger btn-xs"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="btn btn-primary"
                >
                  {isSavingEdit ? "Saving..." : "Save Prompt Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
