import { supabase } from "../lib/supabase";

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-./]+|[-./]+$/g, "");
}

function splitFileName(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");

  if (lastDot === -1) {
    return {
      name: sanitizeSegment(fileName) || "file",
      ext: "png",
    };
  }

  const rawName = fileName.slice(0, lastDot);
  const rawExt = fileName.slice(lastDot + 1);

  return {
    name: sanitizeSegment(rawName) || "file",
    ext: sanitizeSegment(rawExt) || "png",
  };
}

async function uploadToBucket(params: {
  bucket: "template-assets" | "user-assets";
  file: File;
  folderPath: string;
}) {
  const { bucket, file, folderPath } = params;

  const safeFolderPath = folderPath
    .split("/")
    .map((part) => sanitizeSegment(part))
    .filter(Boolean)
    .join("/");

  const { name, ext } = splitFileName(file.name);
  const fileName = `${Date.now()}-${name}.${ext}`;
  const filePath = `${safeFolderPath}/${fileName}`;


  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/png",
    });

  if (error) {
    console.error(`[uploadToBucket] Supabase upload error (${bucket}):`, error);
    throw new Error(error.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return {
    bucket,
    path: data.path,
    url: publicUrlData.publicUrl,
    originalName: file.name,
  };
}

// ─────────────────────────────────────────────────────────────
// ADMIN: upload template asset while template ZIP is processed
// ─────────────────────────────────────────────────────────────
export async function uploadTemplateImage(file: File, templateId: string) {
  const safeTemplateId = sanitizeSegment(templateId) || "template";

  return uploadToBucket({
    bucket: "template-assets",
    file,
    folderPath: `templates/${safeTemplateId}`,
  });
}

// ─────────────────────────────────────────────────────────────
// ADMIN: upload standalone block asset while block ZIP is processed
// ─────────────────────────────────────────────────────────────
export async function uploadBlockImage(file: File, blockId: string) {
  const safeBlockId = sanitizeSegment(blockId) || "block";

  return uploadToBucket({
    bucket: "template-assets",
    file,
    folderPath: `blocks/${safeBlockId}`,
  });
}

// ─────────────────────────────────────────────────────────────
// USER: upload image while editing assigned template
// ─────────────────────────────────────────────────────────────
export async function uploadUserImage(file: File, userId: string, projectId: string) {
  const safeUserId = sanitizeSegment(userId) || "user";
  const safeProjectId = sanitizeSegment(projectId) || "project";

  return uploadToBucket({
    bucket: "user-assets",
    file,
    folderPath: `users/${safeUserId}/projects/${safeProjectId}`,
  });
}

// ─────────────────────────────────────────────────────────────
// USER: upload image for a specific editable inside editor
// Useful for hero-image, logo, product-image, etc.
// ─────────────────────────────────────────────────────────────
export async function uploadEditorImage(params: {
  file: File;
  userId: string;
  projectId: string;
  editableId: string;
}) {
  const { file, userId, projectId, editableId } = params;

  const safeUserId = sanitizeSegment(userId) || "user";
  const safeProjectId = sanitizeSegment(projectId) || "project";
  const safeEditableId = sanitizeSegment(editableId) || "image";

  return uploadToBucket({
    bucket: "user-assets",
    file,
    folderPath: `users/${safeUserId}/projects/${safeProjectId}/editables/${safeEditableId}`,
  });
}