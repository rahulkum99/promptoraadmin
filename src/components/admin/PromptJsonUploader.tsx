import React, { useState } from "react";
import {
  extractRtkError,
  useBulkUploadPromptsMutation,
  useUploadPromptFromFormFieldsMutation,
  useUploadPromptFromJsonAndImageMutation,
} from "@/store/adminuserApi";
import type {
  AdminPrompt,
  AspectRatioChoice,
  PromptJsonPayload,
  PromptStatusChoice,
} from "@/types/adminuser";

type Props = {
  onSuccess?: (prompt: AdminPrompt) => void;
  onBulkSuccess?: (prompts: AdminPrompt[]) => void;
};

const SAMPLE_JSON = `{
  "title": "Ultra-Realistic Teal Sequin Lehenga Portrait in a Warm Luxury Bedroom",
  "slug": "ultra-realistic-teal-sequin-lehenga-portrait-warm-luxury-bedroom",
  "description": "Generate an ultra-realistic festive Indian fashion portrait featuring a teal sequin lehenga in a warm luxury bedroom setting.",
  "prompt_text": "Create an ultra-high-definition, photorealistic vertical fashion portrait of a graceful model wearing a richly embroidered teal sequin lehenga in a warm, softly lit luxury bedroom with golden ambient lighting, shallow depth of field, and crisp fabric textures.",
  "negative_prompt": "different person, inconsistent facial identity, blurry, watermark, logo, low resolution, deformed hands",
  "category": "Realistic Female Portrait Photography",
  "tags": [
    "realistic-female-portrait",
    "teal-lehenga",
    "indian-festive-fashion",
    "sequined-outfit",
    "luxury-bedroom",
    "photorealistic"
  ],
  "aspect_ratio": "9:16",
  "ai_tool": "GPT Image 1",
  "generation_settings": {
    "style": "ultra-realistic editorial fashion photography",
    "quality": "high",
    "resolution_target": "ultra-HD",
    "iso": 200,
    "shutter_speed": "1/160"
  },
  "is_featured": true,
  "is_premium": true,
  "is_mature": false,
  "status": "published"
}`;

const SAMPLE_BULK_JSON = `[
  {
    "title": "Ultra-Realistic Teal Sequin Lehenga Portrait in a Warm Luxury Bedroom",
    "slug": "ultra-realistic-teal-sequin-lehenga-portrait-warm-luxury-bedroom",
    "description": "Festive Indian fashion portrait in a warm luxury bedroom.",
    "prompt_text": "Create an ultra-high-definition, photorealistic vertical fashion portrait in a teal sequin lehenga...",
    "negative_prompt": "blurry, watermark, logo",
    "category": "Realistic Female Portrait Photography",
    "tags": ["realistic-female-portrait", "teal-lehenga", "photorealistic"],
    "aspect_ratio": "9:16",
    "ai_tool": "GPT Image 1",
    "is_featured": true,
    "is_premium": true,
    "status": "published"
  },
  {
    "title": "Cinematic Neon Rain Cyberpunk Alleyway",
    "slug": "cinematic-neon-rain-cyberpunk-alleyway",
    "description": "Moody futuristic street scene with wet neon reflections.",
    "prompt_text": "Wide-angle cinematic shot of a rain-slicked Tokyo cyberpunk alleyway illuminated by holographic kanji signs...",
    "negative_prompt": "bright daylight, cartoon, low detail",
    "category": "Cyberpunk & Sci-Fi",
    "tags": ["cyberpunk", "neon-rain", "cinematic", "sci-fi"],
    "aspect_ratio": "16:9",
    "ai_tool": "Midjourney v6",
    "is_featured": false,
    "is_premium": false,
    "status": "published"
  }
]`;

export default function PromptJsonUploader({
  onSuccess,
  onBulkSuccess,
}: Props) {
  const [uploadMode, setUploadMode] = useState<"json" | "form" | "bulk">("json");

  // RTK Query Mutations
  const [uploadFromJson, { isLoading: isUploadingJson }] =
    useUploadPromptFromJsonAndImageMutation();
  const [uploadFromForm, { isLoading: isUploadingForm }] =
    useUploadPromptFromFormFieldsMutation();
  const [bulkUpload, { isLoading: isUploadingBulk }] =
    useBulkUploadPromptsMutation();

  const loading = isUploadingJson || isUploadingForm || isUploadingBulk;

  // Mode A: Single JSON + Image state
  const [jsonText, setJsonText] = useState<string>(SAMPLE_JSON);
  const [previewImage, setPreviewImage] = useState<File | null>(null);
  const [additionalImages, setAdditionalImages] = useState<File[]>([]);
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);

  // Mode B: Individual Form Fields state
  const [formTitle, setFormTitle] = useState<string>("");
  const [formSlug, setFormSlug] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formPromptText, setFormPromptText] = useState<string>("");
  const [formNegativePrompt, setFormNegativePrompt] = useState<string>("");
  const [formCategory, setFormCategory] = useState<string>("");
  const [formTags, setFormTags] = useState<string>("");
  const [formAspectRatio, setFormAspectRatio] = useState<AspectRatioChoice>("9:16");
  const [formAiTool, setFormAiTool] = useState<string>("GPT Image 1");
  const [formSettingsText, setFormSettingsText] = useState<string>(
    '{\n  "quality": "high"\n}'
  );
  const [formStatus, setFormStatus] = useState<PromptStatusChoice>("published");
  const [formFeatured, setFormFeatured] = useState<boolean>(false);
  const [formPremium, setFormPremium] = useState<boolean>(false);
  const [formMature, setFormMature] = useState<boolean>(false);
  const [formPrivate, setFormPrivate] = useState<boolean>(false);

  // Bulk Upload state
  const [bulkJsonText, setBulkJsonText] = useState<string>(SAMPLE_BULK_JSON);
  const [bulkImages, setBulkImages] = useState<File[]>([]);
  const [bulkUpdateExisting, setBulkUpdateExisting] = useState<boolean>(true);

  // Feedback state
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(
    null
  );
  const [uploadedPrompt, setUploadedPrompt] = useState<AdminPrompt | null>(null);
  const [uploadedBulkPrompts, setUploadedBulkPrompts] = useState<
    AdminPrompt[] | null
  >(null);

  let parsedPreview: PromptJsonPayload | null = null;
  let jsonParseError: string | null = null;
  if (uploadMode === "json" && jsonText.trim()) {
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        parsedPreview = parsed as PromptJsonPayload;
      } else {
        jsonParseError = "Top-level JSON value must be a single object.";
      }
    } catch (e) {
      jsonParseError = (e as Error).message;
    }
  }

  let parsedBulkPreview: PromptJsonPayload[] | null = null;
  let bulkParseError: string | null = null;
  if (uploadMode === "bulk" && bulkJsonText.trim()) {
    try {
      const parsed = JSON.parse(bulkJsonText);
      if (Array.isArray(parsed)) {
        parsedBulkPreview = parsed as PromptJsonPayload[];
      } else {
        bulkParseError = "Bulk upload requires a JSON array of prompt objects.";
      }
    } catch (e) {
      bulkParseError = (e as Error).message;
    }
  }

  async function handleJsonSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors(null);
    setUploadedPrompt(null);
    setUploadedBulkPrompts(null);

    if (!jsonText.trim()) {
      setError("Please paste a prompt JSON object.");
      return;
    }
    if (jsonParseError) {
      setError(`Invalid JSON syntax: ${jsonParseError}`);
      return;
    }

    try {
      const response = await uploadFromJson({
        promptJson: jsonText,
        previewImage,
        additionalImages,
        updateExisting,
      }).unwrap();
      setUploadedPrompt(response.data);
      onSuccess?.(response.data);
    } catch (err: unknown) {
      const parsedErr = extractRtkError(err);
      setError(parsedErr.message);
      setFieldErrors(parsedErr.fieldErrors);
    }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors(null);
    setUploadedPrompt(null);
    setUploadedBulkPrompts(null);

    let generationSettings: Record<string, unknown> = {};
    if (formSettingsText.trim()) {
      try {
        generationSettings = JSON.parse(formSettingsText) as Record<
          string,
          unknown
        >;
      } catch (err) {
        setError(`Invalid generation_settings JSON: ${(err as Error).message}`);
        return;
      }
    }

    const tags = formTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const response = await uploadFromForm({
        fields: {
          title: formTitle,
          slug: formSlug || undefined,
          description: formDescription,
          prompt_text: formPromptText,
          negative_prompt: formNegativePrompt,
          category: formCategory,
          tags,
          aspect_ratio: formAspectRatio,
          ai_tool: formAiTool,
          generation_settings: generationSettings,
          status: formStatus,
          is_featured: formFeatured,
          is_premium: formPremium,
          is_mature: formMature,
          is_private: formPrivate,
        },
        previewImage,
        additionalImages,
        updateExisting,
      }).unwrap();
      setUploadedPrompt(response.data);
      onSuccess?.(response.data);
    } catch (err: unknown) {
      const parsedErr = extractRtkError(err);
      setError(parsedErr.message);
      setFieldErrors(parsedErr.fieldErrors);
    }
  }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors(null);
    setUploadedPrompt(null);
    setUploadedBulkPrompts(null);

    if (!bulkJsonText.trim()) {
      setError("Please paste a JSON array of prompts.");
      return;
    }
    if (bulkParseError) {
      setError(`Invalid Bulk JSON: ${bulkParseError}`);
      return;
    }

    try {
      const response = await bulkUpload({
        promptsJson: bulkJsonText,
        images: bulkImages,
        updateExisting: bulkUpdateExisting,
      }).unwrap();
      setUploadedBulkPrompts(response.data);
      onBulkSuccess?.(response.data);
    } catch (err: unknown) {
      const parsedErr = extractRtkError(err);
      setError(parsedErr.message);
      setFieldErrors(parsedErr.fieldErrors);
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div>
          <h2 className="admin-card-title">Prompt JSON + Image Uploader</h2>
          <p className="admin-card-subtitle">
            Upload single or bulk prompts via RTK Query mutations. Categories and
            tags are automatically matched or created.
          </p>
        </div>
        <div className="tab-pills">
          <button
            type="button"
            className={`tab-pill ${uploadMode === "json" ? "active" : ""}`}
            onClick={() => setUploadMode("json")}
          >
            Mode A: JSON + Image
          </button>
          <button
            type="button"
            className={`tab-pill ${uploadMode === "form" ? "active" : ""}`}
            onClick={() => setUploadMode("form")}
          >
            Mode B: Form Fields
          </button>
          <button
            type="button"
            className={`tab-pill ${uploadMode === "bulk" ? "active" : ""}`}
            onClick={() => setUploadMode("bulk")}
          >
            Bulk Array Upload
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <div className="alert-title">{error}</div>
          {fieldErrors && (
            <ul className="alert-list">
              {Object.entries(fieldErrors).map(([key, msgs]) => (
                <li key={key}>
                  <strong>{key}:</strong>{" "}
                  {Array.isArray(msgs) ? msgs.join(", ") : String(msgs)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {uploadedPrompt && (
        <div className="alert alert-success">
          <div className="alert-title">
            Uploaded: {uploadedPrompt.title}{" "}
            <span className={`badge badge-${uploadedPrompt.status}`}>
              {uploadedPrompt.status}
            </span>
          </div>
          <div className="alert-meta">
            Slug: <code>{uploadedPrompt.slug}</code> | Category:{" "}
            <strong>{uploadedPrompt.category?.name}</strong> | Tags:{" "}
            {uploadedPrompt.tags?.map((t) => t.slug).join(", ") || "none"}
          </div>
        </div>
      )}

      {uploadedBulkPrompts && (
        <div className="alert alert-success">
          <div className="alert-title">
            Successfully uploaded {uploadedBulkPrompts.length} prompt(s)!
          </div>
          <div className="alert-meta">
            {uploadedBulkPrompts.map((p) => p.slug).join(", ")}
          </div>
        </div>
      )}

      {uploadMode === "json" && (
        <form onSubmit={handleJsonSubmit} className="admin-form">
          <div className="form-row-between">
            <label className="form-label">
              Prompt JSON Object (<code>prompt_json</code>) *
            </label>
            <div className="btn-group">
              <button
                type="button"
                onClick={() => setJsonText(SAMPLE_JSON)}
                className="btn btn-secondary btn-xs"
              >
                Load Teal Lehenga Example
              </button>
              <button
                type="button"
                onClick={() => {
                  if (parsedPreview) {
                    setJsonText(JSON.stringify(parsedPreview, null, 2));
                  }
                }}
                className="btn btn-secondary btn-xs"
              >
                Format JSON
              </button>
            </div>
          </div>

          <textarea
            rows={15}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder="Paste prompt JSON object here..."
            className="form-textarea font-mono"
            required
          />
          {jsonParseError && (
            <p className="field-error-text">
              JSON Syntax Error: {jsonParseError}
            </p>
          )}

          {parsedPreview && (
            <div className="parsed-preview-box">
              <div className="parsed-preview-header">
                Live Parsed Metadata Preview
              </div>
              <div className="parsed-preview-grid">
                <div>
                  <span className="muted-label">Title:</span>{" "}
                  <strong>{parsedPreview.title || "—"}</strong>
                </div>
                <div>
                  <span className="muted-label">Slug:</span>{" "}
                  <code>{parsedPreview.slug || "(auto-generated)"}</code>
                </div>
                <div>
                  <span className="muted-label">Category:</span>{" "}
                  <span className="badge badge-info">
                    {parsedPreview.category || "—"}
                  </span>
                </div>
                <div>
                  <span className="muted-label">Aspect Ratio:</span>{" "}
                  <strong>{parsedPreview.aspect_ratio || "1:1"}</strong>
                </div>
                <div>
                  <span className="muted-label">AI Tool:</span>{" "}
                  <strong>{parsedPreview.ai_tool || "—"}</strong>
                </div>
                <div>
                  <span className="muted-label">Status:</span>{" "}
                  <span
                    className={`badge badge-${
                      parsedPreview.status || "published"
                    }`}
                  >
                    {parsedPreview.status || "published"}
                  </span>
                </div>
                <div>
                  <span className="muted-label">Flags:</span>{" "}
                  {parsedPreview.is_featured ? "Featured " : ""}
                  {parsedPreview.is_premium ? "Premium " : ""}
                  {parsedPreview.is_mature ? "Mature " : ""}
                  {!parsedPreview.is_featured &&
                  !parsedPreview.is_premium &&
                  !parsedPreview.is_mature
                    ? "Standard"
                    : ""}
                </div>
                <div>
                  <span className="muted-label">
                    Tags (
                    {Array.isArray(parsedPreview.tags)
                      ? parsedPreview.tags.length
                      : 0}
                    ):
                  </span>{" "}
                  {Array.isArray(parsedPreview.tags)
                    ? parsedPreview.tags.join(", ")
                    : "—"}
                </div>
              </div>
            </div>
          )}

          <div className="form-grid-2">
            <div className="file-upload-box">
              <label className="form-label">
                Main Preview Image (<code>preview_image</code> — .jpg, .png,
                .webp, max 8MB)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setPreviewImage(e.target.files?.[0] || null)}
                className="form-file-input"
              />
              {previewImage && (
                <div className="file-chip">
                  Selected: <strong>{previewImage.name}</strong> (
                  {(previewImage.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            <div className="file-upload-box">
              <label className="form-label">
                Additional Images (<code>additional_images</code> — Optional, up
                to 8)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) =>
                  setAdditionalImages(
                    e.target.files
                      ? Array.from(e.target.files).slice(0, 8)
                      : []
                  )
                }
                className="form-file-input"
              />
              {additionalImages.length > 0 && (
                <div className="file-chip">
                  {additionalImages.length} extra image(s) attached
                  {additionalImages.length >= 8 ? " (max 8)" : ""}
                </div>
              )}
            </div>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
            />
            <span>
              Update existing prompt if a prompt with the same{" "}
              <code>slug</code> already exists (<code>update_existing=true</code>)
            </span>
          </label>

          <div className="form-actions">
            <button
              type="submit"
              disabled={loading || !!jsonParseError}
              className="btn btn-primary"
            >
              {loading ? "Uploading Prompt..." : "Upload & Publish Prompt"}
            </button>
          </div>
        </form>
      )}

      {uploadMode === "form" && (
        <form onSubmit={handleFormSubmit} className="admin-form">
          <div className="form-grid-2">
            <div>
              <label className="form-label">Title *</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Ultra-Realistic Teal Sequin Lehenga Portrait"
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="form-label">
                Slug (optional — auto-generated)
              </label>
              <input
                type="text"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="ultra-realistic-teal-sequin-lehenga"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-grid-3">
            <div>
              <label className="form-label">
                Category (Name, Slug, or UUID) *
              </label>
              <input
                type="text"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="Realistic Female Portrait Photography"
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="form-label">AI Tool</label>
              <input
                type="text"
                value={formAiTool}
                onChange={(e) => setFormAiTool(e.target.value)}
                placeholder="GPT Image 1"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Aspect Ratio</label>
              <select
                value={formAspectRatio}
                onChange={(e) =>
                  setFormAspectRatio(e.target.value as AspectRatioChoice)
                }
                className="form-select"
              >
                <option value="1:1">1:1 (Square)</option>
                <option value="9:16">9:16 (Vertical)</option>
                <option value="16:9">16:9 (Widescreen)</option>
                <option value="4:3">4:3</option>
                <option value="3:4">3:4</option>
                <option value="3:2">3:2</option>
                <option value="2:3">2:3</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Short summary of the prompt..."
              className="form-textarea"
            />
          </div>

          <div>
            <label className="form-label">Prompt Text *</label>
            <textarea
              rows={5}
              value={formPromptText}
              onChange={(e) => setFormPromptText(e.target.value)}
              placeholder="Full generation prompt instructions..."
              className="form-textarea"
              required
            />
          </div>

          <div className="form-grid-2">
            <div>
              <label className="form-label">Negative Prompt</label>
              <textarea
                rows={3}
                value={formNegativePrompt}
                onChange={(e) => setFormNegativePrompt(e.target.value)}
                placeholder="blurry, watermark, low quality..."
                className="form-textarea"
              />
            </div>
            <div>
              <label className="form-label">
                Generation Settings (JSON Object)
              </label>
              <textarea
                rows={3}
                value={formSettingsText}
                onChange={(e) => setFormSettingsText(e.target.value)}
                className="form-textarea font-mono"
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div>
              <label className="form-label">Tags (comma-separated)</label>
              <input
                type="text"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="realistic-female-portrait, teal-lehenga, photorealistic"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                value={formStatus}
                onChange={(e) =>
                  setFormStatus(e.target.value as PromptStatusChoice)
                }
                className="form-select"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="archived">Archived</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="checkbox-group-inline">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={formFeatured}
                onChange={(e) => setFormFeatured(e.target.checked)}
              />
              <span>Featured</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={formPremium}
                onChange={(e) => setFormPremium(e.target.checked)}
              />
              <span>Premium</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={formMature}
                onChange={(e) => setFormMature(e.target.checked)}
              />
              <span>Mature (18+)</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={formPrivate}
                onChange={(e) => setFormPrivate(e.target.checked)}
              />
              <span>Private</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
              />
              <span>Update Existing Slug</span>
            </label>
          </div>

          <div className="form-grid-2">
            <div className="file-upload-box">
              <label className="form-label">Main Preview Image</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setPreviewImage(e.target.files?.[0] || null)}
                className="form-file-input"
              />
            </div>
            <div className="file-upload-box">
              <label className="form-label">Additional Images (up to 8)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) =>
                  setAdditionalImages(
                    e.target.files
                      ? Array.from(e.target.files).slice(0, 8)
                      : []
                  )
                }
                className="form-file-input"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "Uploading..." : "Create Prompt via FormData"}
            </button>
          </div>
        </form>
      )}

      {uploadMode === "bulk" && (
        <form onSubmit={handleBulkSubmit} className="admin-form">
          <div className="form-row-between">
            <label className="form-label">
              Prompts JSON Array (
              <code>POST /api/v1/adminuser/prompts/bulk-upload/</code>) *
            </label>
            <button
              type="button"
              onClick={() => setBulkJsonText(SAMPLE_BULK_JSON)}
              className="btn btn-secondary btn-xs"
            >
              Load Bulk Example
            </button>
          </div>

          <textarea
            rows={14}
            value={bulkJsonText}
            onChange={(e) => setBulkJsonText(e.target.value)}
            placeholder="Paste JSON array of prompt objects..."
            className="form-textarea font-mono"
            required
          />
          {bulkParseError && (
            <p className="field-error-text">JSON Error: {bulkParseError}</p>
          )}

          {parsedBulkPreview && (
            <div className="parsed-preview-box">
              <div className="parsed-preview-header">
                Ready to Bulk Upload {parsedBulkPreview.length} Prompt(s)
              </div>
              <ul className="bulk-preview-list">
                {parsedBulkPreview.slice(0, 8).map((item, idx) => (
                  <li key={idx}>
                    <strong>#{idx + 1}:</strong>{" "}
                    {item.title || "(missing title)"} —{" "}
                    <span className="badge badge-info">
                      {item.category || "no category"}
                    </span>{" "}
                    {item.image ? <code>[image: {item.image}]</code> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="file-upload-box">
            <label className="form-label">
              Optional Mapped Image Files (matched by filename in{" "}
              <code>image</code> or <code>slug</code>)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) =>
                setBulkImages(e.target.files ? Array.from(e.target.files) : [])
              }
              className="form-file-input"
            />
            {bulkImages.length > 0 && (
              <div className="file-chip">
                {bulkImages.length} file(s):{" "}
                {bulkImages.map((f) => f.name).join(", ")}
              </div>
            )}
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={bulkUpdateExisting}
              onChange={(e) => setBulkUpdateExisting(e.target.checked)}
            />
            <span>Update existing prompts when slug matches</span>
          </label>

          <div className="form-actions">
            <button
              type="submit"
              disabled={loading || !!bulkParseError}
              className="btn btn-primary"
            >
              {loading ? "Uploading Batch..." : "Run Bulk Upload"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
