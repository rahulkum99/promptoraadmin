import React, { useState } from "react";
import {
  extractRtkError,
  useCreateAdminCategoryMutation,
  useCreateAdminTagMutation,
  useCreateAdminWeeklyThemeMutation,
  useDeleteAdminCategoryMutation,
  useDeleteAdminTagMutation,
  useDeleteAdminWeeklyThemeMutation,
  useGetAdminCategoriesQuery,
  useGetAdminTagsQuery,
  useGetAdminWeeklyThemesQuery,
  useLazyGetAdminCategoryBySlugQuery,
  useUpdateAdminCategoryMutation,
  useUpdateAdminTagMutation,
} from "@/store/adminuserApi";
import type { AdminCategory, AdminTag } from "@/types/adminuser";

export default function CatalogManagerView() {
  const [subTab, setSubTab] = useState<"categories" | "tags" | "themes">(
    "categories"
  );
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Category form state
  const [catName, setCatName] = useState<string>("");
  const [catSlug, setCatSlug] = useState<string>("");
  const [catDesc, setCatDesc] = useState<string>("");
  const [catOrder, setCatOrder] = useState<number>(0);
  const [catActive, setCatActive] = useState<boolean>(true);
  const [catThumb, setCatThumb] = useState<File | null>(null);

  // Tag form state
  const [tagSearch, setTagSearch] = useState<string>("");
  const [tagName, setTagName] = useState<string>("");
  const [tagSlug, setTagSlug] = useState<string>("");

  // Weekly theme form state
  const [themeCategoryId, setThemeCategoryId] = useState<string>("");
  const [themeTagId, setThemeTagId] = useState<string>("");
  const [themeStartsOn, setThemeStartsOn] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [themeEndsOn, setThemeEndsOn] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  });

  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(
    null
  );
  const [editCatName, setEditCatName] = useState<string>("");
  const [editCatSlug, setEditCatSlug] = useState<string>("");
  const [editCatDesc, setEditCatDesc] = useState<string>("");
  const [editCatOrder, setEditCatOrder] = useState<number>(0);
  const [editCatActive, setEditCatActive] = useState<boolean>(true);
  const [editCatThumb, setEditCatThumb] = useState<File | null>(null);

  // RTK Queries
  const { data: catRes } = useGetAdminCategoriesQuery(undefined);
  const { data: tagRes } = useGetAdminTagsQuery({
    search: tagSearch || undefined,
  });
  const { data: themeRes } = useGetAdminWeeklyThemesQuery(undefined);

  // RTK Mutations
  const [createCategory, { isLoading: isCreatingCat }] =
    useCreateAdminCategoryMutation();
  const [updateCategory, { isLoading: isUpdatingCat }] =
    useUpdateAdminCategoryMutation();
  const [deleteCategory] = useDeleteAdminCategoryMutation();
  const [fetchCategoryBySlug] = useLazyGetAdminCategoryBySlugQuery();

  const [createTag] = useCreateAdminTagMutation();
  const [updateTag] = useUpdateAdminTagMutation();
  const [deleteTag] = useDeleteAdminTagMutation();

  const [createWeeklyTheme] = useCreateAdminWeeklyThemeMutation();
  const [deleteWeeklyTheme] = useDeleteAdminWeeklyThemeMutation();

  const categories = catRes?.data ?? [];
  const tags = tagRes?.data ?? [];
  const themes = themeRes?.data ?? [];

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    try {
      const res = await createCategory({
        name: catName,
        slug: catSlug || undefined,
        description: catDesc,
        display_order: catOrder,
        is_active: catActive,
        thumbnail: catThumb,
      }).unwrap();
      setFeedback(`Category "${res.data.name}" created.`);
      setCatName("");
      setCatSlug("");
      setCatDesc("");
      setCatOrder(0);
      setCatThumb(null);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleToggleCategoryActive(cat: AdminCategory) {
    setError(null);
    try {
      await updateCategory({
        slug: cat.slug,
        data: { is_active: !cat.is_active },
      }).unwrap();
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function openEditCategory(cat: AdminCategory) {
    setError(null);
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setEditCatSlug(cat.slug);
    setEditCatDesc(cat.description || "");
    setEditCatOrder(cat.display_order);
    setEditCatActive(cat.is_active);
    setEditCatThumb(null);
    try {
      const detail = await fetchCategoryBySlug(cat.slug).unwrap();
      const next = detail.data;
      setEditingCategory(next);
      setEditCatName(next.name);
      setEditCatSlug(next.slug);
      setEditCatDesc(next.description || "");
      setEditCatOrder(next.display_order);
      setEditCatActive(next.is_active);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCategory) return;
    setError(null);
    setFeedback(null);
    try {
      const res = await updateCategory({
        slug: editingCategory.slug,
        data: {
          name: editCatName,
          slug: editCatSlug || undefined,
          description: editCatDesc,
          display_order: editCatOrder,
          is_active: editCatActive,
          thumbnail: editCatThumb,
        },
      }).unwrap();
      setFeedback(`Category "${res.data.name}" updated.`);
      setEditingCategory(null);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleDeleteCategory(cat: AdminCategory) {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    setError(null);
    try {
      await deleteCategory(cat.slug).unwrap();
      setFeedback(`Category "${cat.name}" deleted.`);
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    try {
      const res = await createTag({
        name: tagName,
        slug: tagSlug || undefined,
      }).unwrap();
      setFeedback(`Tag "${res.data.name}" (${res.data.slug}) created.`);
      setTagName("");
      setTagSlug("");
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleRenameTag(tag: AdminTag) {
    const nextName = window.prompt("Rename tag:", tag.name);
    if (!nextName || nextName.trim() === tag.name) return;
    setError(null);
    try {
      await updateTag({
        slug: tag.slug,
        data: { name: nextName.trim() },
      }).unwrap();
      setFeedback("Tag renamed.");
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleDeleteTag(tag: AdminTag) {
    if (!window.confirm(`Delete tag "${tag.name}"?`)) return;
    setError(null);
    try {
      await deleteTag(tag.slug).unwrap();
      setFeedback("Tag deleted.");
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleCreateTheme(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    try {
      await createWeeklyTheme({
        category_id: themeCategoryId || null,
        tag_id: themeTagId || null,
        starts_on: themeStartsOn,
        ends_on: themeEndsOn,
      }).unwrap();
      setFeedback("7-Day Weekly Theme created.");
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  async function handleDeleteTheme(themeId: string) {
    if (!window.confirm("Delete this weekly theme?")) return;
    setError(null);
    try {
      await deleteWeeklyTheme(themeId).unwrap();
      setFeedback("Weekly theme deleted.");
    } catch (err) {
      setError(extractRtkError(err).message);
    }
  }

  return (
    <div className="section-stack">
      <div className="section-header-bar">
        <div>
          <h1 className="section-title">Catalog Manager</h1>
          <p className="section-subtitle">
            Manage Categories, Tags, and 7-Day Weekly Themes via RTK Query
          </p>
        </div>
        <div className="tab-pills">
          <button
            type="button"
            className={`tab-pill ${subTab === "categories" ? "active" : ""}`}
            onClick={() => setSubTab("categories")}
          >
            Categories ({categories.length})
          </button>
          <button
            type="button"
            className={`tab-pill ${subTab === "tags" ? "active" : ""}`}
            onClick={() => setSubTab("tags")}
          >
            Tags ({tags.length})
          </button>
          <button
            type="button"
            className={`tab-pill ${subTab === "themes" ? "active" : ""}`}
            onClick={() => setSubTab("themes")}
          >
            Weekly Themes ({themes.length})
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {feedback && <div className="alert alert-success">{feedback}</div>}

      {subTab === "categories" && (
        <div className="split-grid">
          <form
            onSubmit={handleCreateCategory}
            className="admin-card admin-form"
          >
            <h3 className="admin-card-title">Create Category</h3>
            <div>
              <label className="form-label">Name *</label>
              <input
                type="text"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Realistic Female Portrait Photography"
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="form-label">Slug (optional)</label>
              <input
                type="text"
                value={catSlug}
                onChange={(e) => setCatSlug(e.target.value)}
                placeholder="realistic-female-portrait-photography"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea
                rows={3}
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                className="form-textarea"
              />
            </div>
            <div className="form-grid-2">
              <div>
                <label className="form-label">Display Order</label>
                <input
                  type="number"
                  min={0}
                  value={catOrder}
                  onChange={(e) => setCatOrder(Number(e.target.value))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Thumbnail Image</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setCatThumb(e.target.files?.[0] || null)}
                  className="form-file-input"
                />
              </div>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={catActive}
                onChange={(e) => setCatActive(e.target.checked)}
              />
              <span>Active in public catalog</span>
            </label>
            <button
              type="submit"
              disabled={isCreatingCat}
              className="btn btn-primary"
            >
              {isCreatingCat ? "Creating..." : "Create Category"}
            </button>
          </form>

          <div className="admin-card table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td>#{cat.display_order}</td>
                    <td>
                      <div className="row-title">{cat.name}</div>
                      <div className="row-sub">
                        <code>{cat.slug}</code>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          cat.is_active ? "badge-published" : "badge-archived"
                        }`}
                      >
                        {cat.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          type="button"
                          onClick={() => void openEditCategory(cat)}
                          className="btn btn-secondary btn-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleCategoryActive(cat)}
                          className="btn btn-secondary btn-xs"
                        >
                          {cat.is_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteCategory(cat)}
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

      {subTab === "tags" && (
        <div className="split-grid">
          <form onSubmit={handleCreateTag} className="admin-card admin-form">
            <h3 className="admin-card-title">Create Tag</h3>
            <div>
              <label className="form-label">Tag Name *</label>
              <input
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="teal-lehenga"
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="form-label">Slug (optional)</label>
              <input
                type="text"
                value={tagSlug}
                onChange={(e) => setTagSlug(e.target.value)}
                placeholder="teal-lehenga"
                className="form-input"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Create Tag
            </button>
          </form>

          <div className="admin-card table-container">
            <div className="card-Search-bar">
              <input
                type="search"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="Filter tags..."
                className="form-input"
              />
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => (
                  <tr key={tag.id}>
                    <td className="row-title">{tag.name}</td>
                    <td>
                      <code>#{tag.slug}</code>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          type="button"
                          onClick={() => void handleRenameTag(tag)}
                          className="btn btn-secondary btn-xs"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteTag(tag)}
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

      {subTab === "themes" && (
        <div className="split-grid">
          <form onSubmit={handleCreateTheme} className="admin-card admin-form">
            <h3 className="admin-card-title">Create 7-Day Weekly Theme</h3>
            <div>
              <label className="form-label">
                Category (optional if Tag chosen)
              </label>
              <select
                value={themeCategoryId}
                onChange={(e) => setThemeCategoryId(e.target.value)}
                className="form-select"
              >
                <option value="">— Select Category —</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">
                Tag (optional if Category chosen)
              </label>
              <select
                value={themeTagId}
                onChange={(e) => setThemeTagId(e.target.value)}
                className="form-select"
              >
                <option value="">— Select Tag —</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name} (#{tag.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-grid-2">
              <div>
                <label className="form-label">Starts On *</label>
                <input
                  type="date"
                  value={themeStartsOn}
                  onChange={(e) => setThemeStartsOn(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Ends On (7-day window) *</label>
                <input
                  type="date"
                  value={themeEndsOn}
                  onChange={(e) => setThemeEndsOn(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              Create Weekly Theme
            </button>
          </form>

          <div className="admin-card table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Target Category / Tag</th>
                  <th>Date Window</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {themes.map((theme) => (
                  <tr key={theme.id}>
                    <td>
                      {theme.category && (
                        <span className="badge badge-info">
                          Category: {theme.category.name}
                        </span>
                      )}{" "}
                      {theme.tag && (
                        <span className="badge badge-featured">
                          Tag: #{theme.tag.slug}
                        </span>
                      )}
                    </td>
                    <td>
                      <code>{theme.starts_on}</code> →{" "}
                      <code>{theme.ends_on}</code>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => void handleDeleteTheme(theme.id)}
                        className="btn btn-danger btn-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingCategory && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <h3 className="admin-card-title">
                  Edit Category: {editingCategory.name}
                </h3>
                <p className="admin-card-subtitle">
                  <code>
                    PATCH /api/v1/adminuser/categories/{editingCategory.slug}/
                  </code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="btn btn-secondary btn-xs"
              >
                Close ✕
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="admin-form">
              <div>
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Slug</label>
                <input
                  type="text"
                  value={editCatSlug}
                  onChange={(e) => setEditCatSlug(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea
                  rows={3}
                  value={editCatDesc}
                  onChange={(e) => setEditCatDesc(e.target.value)}
                  className="form-textarea"
                />
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="form-label">Display Order</label>
                  <input
                    type="number"
                    min={0}
                    value={editCatOrder}
                    onChange={(e) => setEditCatOrder(Number(e.target.value))}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">
                    Replace Thumbnail (optional)
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) =>
                      setEditCatThumb(e.target.files?.[0] || null)
                    }
                    className="form-file-input"
                  />
                </div>
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={editCatActive}
                  onChange={(e) => setEditCatActive(e.target.checked)}
                />
                <span>Active in public catalog</span>
              </label>
              <button
                type="submit"
                disabled={isUpdatingCat}
                className="btn btn-primary"
              >
                {isUpdatingCat ? "Saving..." : "Save Category"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
