import React, { useState } from "react";
import {
  extractRtkError,
  useCancelAdminGenerationMutation,
  useCreateAdminBlogPostMutation,
  useDeleteAdminBlogPostMutation,
  useGetAdminBlogPostsQuery,
  useGetAdminGenerationsQuery,
  useLazyGetAdminBlogPostBySlugQuery,
  useUpdateAdminBlogPostMutation,
} from "@/store/adminuserApi";
import type { AdminBlogPost, AdminGeneration } from "@/types/adminuser";

type Props = {
  initialTab?: "generations" | "blog";
};

export default function OperationsView({ initialTab = "generations" }: Props) {
  const [subTab, setSubTab] = useState<"generations" | "blog">(initialTab);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Generation filters
  const [genStatus, setGenStatus] = useState<string>("");
  const [genProvider, setGenProvider] = useState<string>("");

  // Blog create state
  const [blogTitle, setBlogTitle] = useState<string>("");
  const [blogSlug, setBlogSlug] = useState<string>("");
  const [blogExcerpt, setBlogExcerpt] = useState<string>("");
  const [blogContent, setBlogContent] = useState<string>("");
  const [blogStatus, setBlogStatus] = useState<
    "draft" | "published" | "archived"
  >("published");
  const [blogTags, setBlogTags] = useState<string>("");
  const [blogMetaTitle, setBlogMetaTitle] = useState<string>("");
  const [blogMetaDesc, setBlogMetaDesc] = useState<string>("");
  const [blogCover, setBlogCover] = useState<File | null>(null);

  const [editingPost, setEditingPost] = useState<AdminBlogPost | null>(null);
  const [editBlogTitle, setEditBlogTitle] = useState<string>("");
  const [editBlogSlug, setEditBlogSlug] = useState<string>("");
  const [editBlogExcerpt, setEditBlogExcerpt] = useState<string>("");
  const [editBlogContent, setEditBlogContent] = useState<string>("");
  const [editBlogStatus, setEditBlogStatus] = useState<
    "draft" | "published" | "archived"
  >("published");
  const [editBlogTags, setEditBlogTags] = useState<string>("");
  const [editBlogMetaTitle, setEditBlogMetaTitle] = useState<string>("");
  const [editBlogMetaDesc, setEditBlogMetaDesc] = useState<string>("");
  const [editBlogCover, setEditBlogCover] = useState<File | null>(null);

  // RTK Queries
  const {
    data: genRes,
    isLoading: isLoadingGen,
    refetch: refetchGenerations,
  } = useGetAdminGenerationsQuery(
    {
      status: genStatus || undefined,
      provider: genProvider || undefined,
    },
    { skip: subTab !== "generations" }
  );

  const { data: blogRes } = useGetAdminBlogPostsQuery(undefined, {
    skip: subTab !== "blog",
  });

  // RTK Mutations
  const [cancelGeneration] = useCancelAdminGenerationMutation();
  const [createBlogPost] = useCreateAdminBlogPostMutation();
  const [updateBlogPost, { isLoading: isUpdatingBlog }] =
    useUpdateAdminBlogPostMutation();
  const [deleteBlogPost] = useDeleteAdminBlogPostMutation();
  const [fetchBlogBySlug] = useLazyGetAdminBlogPostBySlugQuery();

  const generations = genRes?.data ?? [];
  const blogPosts = blogRes?.data ?? [];

  async function handleCancelGeneration(gen: AdminGeneration) {
    const reason = window.prompt(
      "Cancel stuck generation and refund reserved credits. Reason:",
      "Stuck provider job cancelled by admin"
    );
    if (reason === null) return;
    setError(null);
    try {
      await cancelGeneration({ generationId: gen.id, reason }).unwrap();
      setFeedback(
        `Cancelled generation ${gen.id} and refunded reserved credits.`
      );
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleCreateBlog(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await createBlogPost({
        title: blogTitle,
        slug: blogSlug || undefined,
        excerpt: blogExcerpt,
        content: blogContent,
        status: blogStatus,
        tags: blogTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        meta_title: blogMetaTitle || undefined,
        meta_description: blogMetaDesc || undefined,
        cover_image: blogCover,
      }).unwrap();
      setFeedback(`Blog post "${res.data.title}" created.`);
      setBlogTitle("");
      setBlogSlug("");
      setBlogExcerpt("");
      setBlogContent("");
      setBlogCover(null);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  function populateBlogEdit(post: AdminBlogPost) {
    setEditingPost(post);
    setEditBlogTitle(post.title);
    setEditBlogSlug(post.slug);
    setEditBlogExcerpt(post.excerpt || "");
    setEditBlogContent(post.content || "");
    setEditBlogStatus(post.status);
    setEditBlogTags(post.tags?.map((t) => t.name).join(", ") || "");
    setEditBlogMetaTitle(post.meta_title || post.seo?.meta_title || "");
    setEditBlogMetaDesc(post.meta_description || post.seo?.meta_description || "");
    setEditBlogCover(null);
  }

  async function openEditBlog(post: AdminBlogPost) {
    setError(null);
    populateBlogEdit(post);
    try {
      const detail = await fetchBlogBySlug(post.slug).unwrap();
      populateBlogEdit(detail.data);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleSaveBlog(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPost) return;
    setError(null);
    try {
      const res = await updateBlogPost({
        slug: editingPost.slug,
        data: {
          title: editBlogTitle,
          slug: editBlogSlug || undefined,
          excerpt: editBlogExcerpt,
          content: editBlogContent,
          status: editBlogStatus,
          tags: editBlogTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          meta_title: editBlogMetaTitle || undefined,
          meta_description: editBlogMetaDesc || undefined,
          cover_image: editBlogCover,
        },
      }).unwrap();
      setFeedback(`Blog post "${res.data.title}" updated.`);
      setEditingPost(null);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleDeleteBlog(post: AdminBlogPost) {
    if (!window.confirm(`Delete blog post "${post.title}"?`)) return;
    setError(null);
    try {
      await deleteBlogPost(post.slug).unwrap();
      setFeedback("Blog post deleted.");
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  return (
    <div className="section-stack">
      <div className="section-header-bar">
        <div>
          <h1 className="section-title">Generations & SEO Blog</h1>
          <p className="section-subtitle">
            Monitor AI image generations and publish SEO blog posts via RTK Query
          </p>
        </div>
        <div className="tab-pills">
          <button
            type="button"
            className={`tab-pill ${subTab === "generations" ? "active" : ""}`}
            onClick={() => setSubTab("generations")}
          >
            Generations Monitor
          </button>
          <button
            type="button"
            className={`tab-pill ${subTab === "blog" ? "active" : ""}`}
            onClick={() => setSubTab("blog")}
          >
            SEO Blog CMS
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {feedback && <div className="alert alert-success">{feedback}</div>}

      {subTab === "generations" && (
        <>
          <div className="admin-card filter-toolbar">
            <select
              value={genStatus}
              onChange={(e) => setGenStatus(e.target.value)}
              className="form-select"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input
              type="text"
              value={genProvider}
              onChange={(e) => setGenProvider(e.target.value)}
              placeholder="Filter provider (e.g. openai, demo)..."
              className="form-input"
            />
            <button
              type="button"
              onClick={() => void refetchGenerations()}
              className="btn btn-secondary"
            >
              Refresh Queue
            </button>
          </div>

          <div className="admin-card table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Output</th>
                  <th>User & Model</th>
                  <th>Prompt</th>
                  <th>Credits</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingGen ? (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      Loading generations...
                    </td>
                  </tr>
                ) : generations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      No generations found.
                    </td>
                  </tr>
                ) : (
                  generations.map((gen) => (
                    <tr key={gen.id}>
                      <td>
                        {gen.image_url ? (
                          <img
                            src={gen.image_url}
                            alt=""
                            className="table-thumb"
                          />
                        ) : (
                          <div className="table-thumb-placeholder">Queue</div>
                        )}
                      </td>
                      <td>
                        <div className="row-title">{gen.user_email}</div>
                        <div className="row-sub">
                          <code>{gen.provider}</code> /{" "}
                          <code>{gen.model}</code> ({gen.quality})
                        </div>
                      </td>
                      <td>
                        <div className="prompt-snippet">{gen.prompt_text}</div>
                        {gen.error_message && (
                          <div className="field-error-text">
                            {gen.error_message}
                          </div>
                        )}
                      </td>
                      <td>
                        Req: {gen.credits_required} | Used:{" "}
                        {gen.credits_consumed}
                        {gen.credits_released > 0 && (
                          <div className="row-sub">
                            Refunded: {gen.credits_released}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${gen.status}`}>
                          {gen.status}
                        </span>
                      </td>
                      <td>
                        {(gen.status === "pending" ||
                          gen.status === "processing") && (
                          <button
                            type="button"
                            onClick={() => void handleCancelGeneration(gen)}
                            className="btn btn-danger btn-xs"
                          >
                            Cancel & Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {subTab === "blog" && (
        <div className="split-grid">
          <form onSubmit={handleCreateBlog} className="admin-card admin-form">
            <h3 className="admin-card-title">Create SEO Blog Post</h3>
            <div>
              <label className="form-label">Title *</label>
              <input
                type="text"
                value={blogTitle}
                onChange={(e) => setBlogTitle(e.target.value)}
                placeholder="How to Craft Photorealistic Portrait Prompts"
                className="form-input"
                required
              />
            </div>
            <div className="form-grid-2">
              <div>
                <label className="form-label">Slug (optional)</label>
                <input
                  type="text"
                  value={blogSlug}
                  onChange={(e) => setBlogSlug(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select
                  value={blogStatus}
                  onChange={(e) =>
                    setBlogStatus(
                      e.target.value as "draft" | "published" | "archived"
                    )
                  }
                  className="form-select"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div>
              <label className="form-label">Excerpt</label>
              <textarea
                rows={2}
                value={blogExcerpt}
                onChange={(e) => setBlogExcerpt(e.target.value)}
                className="form-textarea"
              />
            </div>
            <div>
              <label className="form-label">Content (Markdown / HTML) *</label>
              <textarea
                rows={6}
                value={blogContent}
                onChange={(e) => setBlogContent(e.target.value)}
                className="form-textarea"
                required
              />
            </div>
            <div className="form-grid-2">
              <div>
                <label className="form-label">SEO Meta Title</label>
                <input
                  type="text"
                  value={blogMetaTitle}
                  onChange={(e) => setBlogMetaTitle(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={blogTags}
                  onChange={(e) => setBlogTags(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
            <div>
              <label className="form-label">SEO Meta Description</label>
              <input
                type="text"
                value={blogMetaDesc}
                onChange={(e) => setBlogMetaDesc(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Cover Image</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setBlogCover(e.target.files?.[0] || null)}
                className="form-file-input"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Publish Blog Post
            </button>
          </form>

          <div className="admin-card table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Post Title</th>
                  <th>Status</th>
                  <th>Views</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {blogPosts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <div className="row-title">{post.title}</div>
                      <div className="row-sub">
                        <code>/blog/{post.slug}</code>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${post.status}`}>
                        {post.status}
                      </span>
                    </td>
                    <td>{post.view_count}</td>
                    <td>
                      <div className="btn-group">
                        <button
                          type="button"
                          onClick={() => void openEditBlog(post)}
                          className="btn btn-secondary btn-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteBlog(post)}
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

      {editingPost && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <h3 className="admin-card-title">
                  Edit Blog Post: {editingPost.title}
                </h3>
                <p className="admin-card-subtitle">
                  <code>PATCH /api/v1/adminuser/blog/{editingPost.slug}/</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="btn btn-secondary btn-xs"
              >
                Close ✕
              </button>
            </div>
            <form onSubmit={handleSaveBlog} className="admin-form">
              <div>
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  value={editBlogTitle}
                  onChange={(e) => setEditBlogTitle(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Slug</label>
                  <input
                    type="text"
                    value={editBlogSlug}
                    onChange={(e) => setEditBlogSlug(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select
                    value={editBlogStatus}
                    onChange={(e) =>
                      setEditBlogStatus(
                        e.target.value as "draft" | "published" | "archived"
                      )
                    }
                    className="form-select"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Excerpt</label>
                <textarea
                  rows={2}
                  value={editBlogExcerpt}
                  onChange={(e) => setEditBlogExcerpt(e.target.value)}
                  className="form-textarea"
                />
              </div>
              <div>
                <label className="form-label">Content *</label>
                <textarea
                  rows={8}
                  value={editBlogContent}
                  onChange={(e) => setEditBlogContent(e.target.value)}
                  className="form-textarea"
                  required
                />
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">SEO Meta Title</label>
                  <input
                    type="text"
                    value={editBlogMetaTitle}
                    onChange={(e) => setEditBlogMetaTitle(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={editBlogTags}
                    onChange={(e) => setEditBlogTags(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">SEO Meta Description</label>
                <input
                  type="text"
                  value={editBlogMetaDesc}
                  onChange={(e) => setEditBlogMetaDesc(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Replace Cover Image</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    setEditBlogCover(e.target.files?.[0] || null)
                  }
                  className="form-file-input"
                />
              </div>
              <button
                type="submit"
                disabled={isUpdatingBlog}
                className="btn btn-primary"
              >
                {isUpdatingBlog ? "Saving..." : "Save Blog Post"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
