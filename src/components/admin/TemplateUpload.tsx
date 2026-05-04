import { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import {
  Upload,
  FileArchive,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Info,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Image,
} from "lucide-react";
import { parseHtmlToTemplate } from "../../utils/htmlParser";
import { db } from "../../firebase";
import { collection, getDocs, setDoc, doc, query, where } from "firebase/firestore";
import { uploadTemplateImage } from "../../api/supabaseStorage";

interface Props {
  onUploaded: () => void;
}
interface ValidationCheck {
  label: string;
  ok: boolean;
  blocking: boolean;
  message: string;
  detail?: string;
}
interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  warnings: number;
  errors: number;
}
interface UploadState {
  status: "idle" | "validating" | "uploading" | "success" | "error";
  message: string;
  progress: number;
}
interface ExistingTemplate {
  id: string;
  templateName: string;
  category: string;
  rawHtml?: string;
  createdAt?: string;
}

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
};

function getImageMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_MIME[ext] ?? "image/png";
}

async function imageToDataUrl(zipFile: JSZip.JSZipObject, filename: string): Promise<string> {
  const base64 = await zipFile.async("base64");
  return `data:${getImageMime(filename)};base64,${base64}`;
}

async function extractImages(zip: JSZip): Promise<Record<string, string>> {
  const imageMap: Record<string, string> = {};
  const imageFiles = Object.entries(zip.files).filter(([path, file]) => {
    if (file.dir) return false;
    const lower = path.toLowerCase();
    return (
      lower.includes("images/") &&
      Object.keys(IMAGE_MIME).some((ext) => lower.endsWith(`.${ext}`))
    );
  });

  await Promise.all(
    imageFiles.map(async ([path, file]) => {
      try {
        const dataUrl = await imageToDataUrl(file, path);
        const filename = path.split("/").pop()!;
        imageMap[path] = dataUrl;
        imageMap[`images/${filename}`] = dataUrl;
        imageMap[`/images/${filename}`] = dataUrl;
        imageMap[`./images/${filename}`] = dataUrl;
        imageMap[`../images/${filename}`] = dataUrl;
        imageMap[filename] = dataUrl;

        if (path.startsWith("public/")) {
          imageMap[path.replace(/^public\//, "")] = dataUrl;
          imageMap[`/${path.replace(/^public\//, "")}`] = dataUrl;
        }
      } catch (err) {
        console.warn(`[extractImages] Failed: ${path}`, err);
      }
    })
  );

  return imageMap;
}

// ── Upload images to Supabase Storage ─────────────────────────────
async function uploadImagesToSupabase(
  zip: JSZip,
  templateId: string
): Promise<{ urlMap: Record<string, string>; uploadedImageCount: number }> {
  const urlMap: Record<string, string> = {};

  const imageFiles = Object.entries(zip.files).filter(([path, file]) => {
    if (file.dir) return false;
    const lower = path.toLowerCase();
    return (
      lower.includes("images/") &&
      Object.keys(IMAGE_MIME).some((ext) => lower.endsWith(`.${ext}`))
    );
  });

 

  let uploadedImageCount = 0;

  for (const [path, file] of imageFiles) {
    const filename = path.split("/").pop()!;
    try {
      const arrayBuffer = await file.async("arraybuffer");
      const mimeType = getImageMime(filename);
      const uploadFile = new File([arrayBuffer], filename, { type: mimeType });

      const uploaded = await uploadTemplateImage(uploadFile, templateId);

      urlMap[path] = uploaded.url;
      urlMap[`images/${filename}`] = uploaded.url;
      urlMap[`/images/${filename}`] = uploaded.url;
      urlMap[`./images/${filename}`] = uploaded.url;
      urlMap[`../images/${filename}`] = uploaded.url;
      urlMap[filename] = uploaded.url;

      if (path.startsWith("public/")) {
        urlMap[path.replace(/^public\//, "")] = uploaded.url;
        urlMap[`/${path.replace(/^public\//, "")}`] = uploaded.url;
      }

      uploadedImageCount++;
      // console.log(`[uploadImagesToSupabase] ✅ Success: ${filename}`, uploaded.url);
    } catch (err: any) {
      console.error(`[uploadImagesToSupabase] ❌ Failed: ${path}`, err);
      throw new Error(`Image upload failed for ${filename}: ${err?.message || "Unknown error"}`);
    }
  }

  //console.log(`[uploadImagesToSupabase] Complete: ${uploadedImageCount} image(s) uploaded`);
  return { urlMap, uploadedImageCount };
}

function embedImagesIntoHtml(html: string, imageMap: Record<string, string>): string {
  if (!Object.keys(imageMap).length) return html;

  let result = html;
  Object.entries(imageMap).forEach(([path, dataUrl]) => {
    const esc = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`src=["']${esc}["']`, "gi"), `src="${dataUrl}"`);
    result = result.replace(new RegExp(`url\\(["']?${esc}["']?\\)`, "gi"), `url("${dataUrl}")`);
    result = result.replace(new RegExp(`href=["']${esc}["']`, "gi"), `href="${dataUrl}"`);
  });

  return result;
}

function embedImagesIntoCss(css: string, imageMap: Record<string, string>): string {
  if (!css || !Object.keys(imageMap).length) return css;

  let result = css;
  Object.entries(imageMap).forEach(([path, dataUrl]) => {
    const esc = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`url\\(["']?${esc}["']?\\)`, "gi"), `url("${dataUrl}")`);
  });

  return result;
}

// ✅ KEY FIX: Strip compiled Tailwind, keep ONLY:
//   1. :root { } CSS variable blocks
//   2. Rules with base64 data: URLs (background images)
//   3. @font-face rules
//   4. Custom non-Tailwind rules
function extractCustomCssOnly(css: string): string {
  if (!css || !css.trim()) return "";

  const isTailwindOutput =
    css.includes("tailwindcss") ||
    css.includes("@layer theme") ||
    css.includes("@layer base") ||
    css.includes("@layer utilities") ||
    css.includes("@layer components");

  if (!isTailwindOutput) {
    
    return css;
  }

 
  const kept: string[] = [];

  const rootRegex = /:root\s*\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rootRegex.exec(css)) !== null) {
    kept.push(`:root {\n${m[1]}\n}`);
  }

  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let i = 0;
  while (i < cssWithoutComments.length) {
    const openBrace = cssWithoutComments.indexOf("{", i);
    if (openBrace === -1) break;

    let depth = 1;
    let j = openBrace + 1;
    while (j < cssWithoutComments.length && depth > 0) {
      if (cssWithoutComments[j] === "{") depth++;
      else if (cssWithoutComments[j] === "}") depth--;
      j++;
    }

    const closeBrace = j - 1;
    const block = cssWithoutComments.slice(openBrace + 1, closeBrace);
    const selector = cssWithoutComments.slice(i, openBrace).trim();

    if (block.includes("data:image/") || block.includes("data:font/")) {
      const rule = `${selector} {\n${block.trim()}\n}`;
      if (!kept.some((k) => k.trim() === rule.trim())) {
        kept.push(rule);
      }
    }

    i = closeBrace + 1;
  }

  const fontFaceRegex = /@font-face\s*\{[^}]+\}/g;
  while ((m = fontFaceRegex.exec(css)) !== null) {
    kept.push(m[0]);
  }

  const result = kept.join("\n\n").trim();
  console.log(
    `[extractCustomCssOnly] ${(css.length / 1024).toFixed(1)}KB → ${(result.length / 1024).toFixed(1)}KB`,
    `| ${kept.length} rule(s) kept`
  );

  return result;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

async function findDuplicateByContent(htmlString: string): Promise<ExistingTemplate | null> {
  try {
    const incoming = hashString(htmlString.trim());
    const snap = await getDocs(collection(db, "templates"));
    const found = snap.docs.find((d) => hashString((d.data().rawHtml || "").trim()) === incoming);
    return found ? (found.data() as ExistingTemplate) : null;
  } catch {
    return null;
  }
}

async function findDuplicateByName(name: string): Promise<ExistingTemplate | null> {
  try {
    const q = query(collection(db, "templates"), where("templateName", "==", name.trim()));
    const snap = await getDocs(q);
    return snap.empty ? null : (snap.docs[0].data() as ExistingTemplate);
  } catch {
    return null;
  }
}

function validateHtmlStructure(htmlString: string): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  const blocks = Array.from(doc.querySelectorAll("[data-block]"));
  const blockIds = blocks.map((b) => b.getAttribute("data-block")!).filter(Boolean);

  checks.push({
    label: "Has data-block sections",
    ok: blocks.length > 0,
    blocking: true,
    message:
      blocks.length > 0
        ? `Found ${blocks.length} block(s): ${blockIds.slice(0, 5).join(", ")}${blockIds.length > 5 ? "…" : ""}`
        : "No [data-block] elements found.",
    detail:
      blocks.length === 0
        ? `Every section must have a data-block attribute.\nExample: <section data-block="hero">`
        : undefined,
  });

  const duplicates = blockIds.filter((id, i) => blockIds.indexOf(id) !== i);
  const uniqueDups = [...new Set(duplicates)];
  checks.push({
    label: "No duplicate block IDs",
    ok: duplicates.length === 0,
    blocking: true,
    message: duplicates.length === 0 ? "All block IDs are unique ✓" : `Duplicate IDs: ${uniqueDups.join(", ")}`,
    detail:
      duplicates.length > 0
        ? `Each data-block must be unique.\nDuplicates: ${uniqueDups.join(", ")}`
        : undefined,
  });

  const editables = Array.from(doc.querySelectorAll("[data-editable]"));
  checks.push({
    label: "Has data-editable fields",
    ok: editables.length > 0,
    blocking: true,
    message: editables.length > 0 ? `Found ${editables.length} editable field(s)` : "No [data-editable] elements found.",
    detail:
      editables.length === 0
        ? `Add data-editable and data-editable-type to editable elements.`
        : undefined,
  });

  const missingType = editables.filter((e) => !e.getAttribute("data-editable-type"));
  checks.push({
    label: "All editables have data-editable-type",
    ok: missingType.length === 0,
    blocking: true,
    message: missingType.length === 0 ? "All editable elements have a type ✓" : `${missingType.length} missing data-editable-type`,
    detail:
      missingType.length > 0
        ? `Every data-editable must have data-editable-type="text", "image", or "link".`
        : undefined,
  });

  const validTypes = ["text", "image", "link"];
  const invalidTypes = editables.filter((e) => {
    const t = e.getAttribute("data-editable-type");
    return t && !validTypes.includes(t);
  });
  checks.push({
    label: "Valid data-editable-type values",
    ok: invalidTypes.length === 0,
    blocking: true,
    message: invalidTypes.length === 0 ? `All types valid ✓` : `Invalid types found`,
    detail: invalidTypes.length > 0 ? `Allowed: "text", "image", "link".` : undefined,
  });

  const styleContent = Array.from(doc.querySelectorAll("style"))
    .map((s) => s.textContent || "")
    .join("\n");

  const rootVarMatches = styleContent.match(/:root\s*\{([^}]+)\}/);
  const cssVarNames: string[] = [];
  if (rootVarMatches?.[1]) {
    const varLines = rootVarMatches[1].match(/--([\w-]+)\s*:/g);
    if (varLines) varLines.forEach((v) => cssVarNames.push(v.replace(":", "").trim()));
  }

  checks.push({
    label: "Has CSS variables in :root",
    ok: cssVarNames.length > 0,
    blocking: true,
    message:
      cssVarNames.length > 0
        ? `Found ${cssVarNames.length} CSS var(s): ${cssVarNames.slice(0, 4).join(", ")}${cssVarNames.length > 4 ? "…" : ""}`
        : "No :root CSS variables found.",
    detail:
      cssVarNames.length === 0
        ? `Add :root { --primary: #6366f1; } in a <style> tag.`
        : undefined,
  });

  return checks;
}

async function validateZip(file: File): Promise<{ result: ValidationResult; htmlString: string | null; imageCount: number }> {
  const checks: ValidationCheck[] = [];
  let htmlString: string | null = null;
  let imageCount = 0;

  checks.push({
    label: "File format is .zip",
    ok: file.name.endsWith(".zip"),
    blocking: true,
    message: file.name.endsWith(".zip") ? "Valid ZIP ✓" : "Must be .zip",
  });

  const sizeMB = file.size / (1024 * 1024);
  checks.push({
    label: "File size under 10MB",
    ok: sizeMB < 10,
    blocking: true,
    message: sizeMB < 10 ? `${sizeMB.toFixed(2)} MB ✓` : `${sizeMB.toFixed(2)} MB — too large`,
  });

  try {
    const zip = await JSZip.loadAsync(file);
    const files = Object.keys(zip.files);

    const htmlFile = files.find((f) => f.endsWith("index.html"));
    const cssFile = files.find((f) => f.includes("public/") && f.endsWith("style.css"));
    const jsFile = files.find((f) => f.includes("public/") && f.endsWith("main.js"));

    imageCount = files.filter((f) => {
      const lower = f.toLowerCase();
      return (
        lower.includes("images/") &&
        Object.keys(IMAGE_MIME).some((ext) => lower.endsWith(`.${ext}`)) &&
        !zip.files[f].dir
      );
    }).length;

    checks.push({
      label: "Contains index.html",
      ok: !!htmlFile,
      blocking: true,
      message: htmlFile ? `Found: ${htmlFile} ✓` : "index.html missing",
    });

    // ✅ made optional
    checks.push({
      label: "Contains public/style.css (optional)",
      ok: true,
      blocking: false,
      message: cssFile ? `Found: ${cssFile} ✓` : "No public/style.css — continuing without CSS file",
    });

    // ✅ made optional
    checks.push({
      label: "Contains public/main.js (optional)",
      ok: true,
      blocking: false,
      message: jsFile ? `Found: ${jsFile} ✓` : "No public/main.js — continuing without JS file",
    });

    checks.push({
      label: "Images folder (optional)",
      ok: imageCount > 0,
      blocking: false,
      message: imageCount > 0 ? `${imageCount} image(s) found — will be uploaded to Supabase ✓` : "No images/ folder",
    });

    if (htmlFile) {
      htmlString = await zip.files[htmlFile].async("string");
      checks.push(...validateHtmlStructure(htmlString));
    }
  } catch {
    checks.push({
      label: "ZIP is readable",
      ok: false,
      blocking: true,
      message: "Could not open ZIP",
    });
  }

  const blockingFailed = checks.filter((c) => c.blocking && !c.ok);

  return {
    result: {
      passed: blockingFailed.length === 0,
      checks,
      warnings: checks.filter((c) => !c.blocking && !c.ok).length,
      errors: blockingFailed.length,
    },
    htmlString,
    imageCount,
  };
}

// ✅ Remove undefined recursively for Firestore safety
function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === "object") {
    const result: Record<string, any> = {};
    Object.entries(value as Record<string, any>).forEach(([key, val]) => {
      if (val === undefined) return;
      result[key] = stripUndefinedDeep(val);
    });
    return result as T;
  }

  return value;
}

// ✅ Normalize template before Firestore save
function buildFirestoreSafeTemplate(template: any) {
  return stripUndefinedDeep({
    ...template,
    rawHtml: template.rawHtml || "",
    rawCss: template.rawCss || "",
    rawJs: template.rawJs || "",
    cssVariables: template.cssVariables || {},
    blocks: (template.blocks || []).map((block: any) => ({
      ...block,
      blockId: block.blockId || "",
      blockName: block.blockName || "",
      blockOrder: typeof block.blockOrder === "number" ? block.blockOrder : 0,
      removable: typeof block.removable === "boolean" ? block.removable : true,
      colorVars: block.colorVars || {},
      rawHtml: block.rawHtml || "",
      sourceTemplateId: block.sourceTemplateId || "",
      sourceTemplateName: block.sourceTemplateName || "",
      styles: block.styles || {},
      editables: (block.editables || []).map((editable: any) => ({
        ...editable,
        id: editable.id || "",
        type: editable.type || "text",
        content: editable.content || "",
        colorVars: editable.colorVars || {},
        tailwindClass: editable.tailwindClass || "",
        styleProps: editable.styleProps || "",
        styleId: editable.styleId || "",
        styleChildSelector: editable.styleChildSelector || "",
      })),
    })),
 pageScripts: {
  gtmId: template.pageScripts?.gtmId || "",
  headScripts: template.pageScripts?.headScripts || "",
  bodyScripts: template.pageScripts?.bodyScripts || "",
  pageTitle: template.pageScripts?.pageTitle || "",
  faviconUrl: template.pageScripts?.faviconUrl || "",
  metaDescription: template.pageScripts?.metaDescription || "",
  googleAnalyticsId: template.pageScripts?.googleAnalyticsId || "",
  hasMarquee: template.pageScripts?.hasMarquee || false, // 🔥 NEW
},
  });
}

function CheckRow({ check }: { check: ValidationCheck }) {
  const [expanded, setExpanded] = useState(false);
  const isWarning = !check.blocking && !check.ok;

  return (
    <div
      className={`rounded-lg border text-xs overflow-hidden transition-all
      ${check.ok ? "border-green-100 bg-green-50/50" : check.blocking ? "border-red-100 bg-red-50/50" : "border-amber-100 bg-amber-50/50"}`}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        {check.ok ? (
          <CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" />
        ) : isWarning ? (
          <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
        ) : (
          <XCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`font-semibold ${check.ok ? "text-green-700" : isWarning ? "text-amber-700" : "text-red-600"}`}>
              {check.label}
            </span>
            {isWarning && (
              <span className="shrink-0 text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">
                warning
              </span>
            )}
          </div>
          <p className={`mt-0.5 ${check.ok ? "text-green-600" : isWarning ? "text-amber-600" : "text-red-500"}`}>
            {check.message}
          </p>
        </div>

        {check.detail && !check.ok && (
          <button onClick={() => setExpanded(!expanded)} className="shrink-0 text-gray-400 hover:text-gray-600 mt-0.5">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {expanded && check.detail && (
        <div className="px-3 pb-2 border-t border-current/10">
          <pre className={`text-xs whitespace-pre-wrap font-mono mt-1.5 leading-relaxed ${isWarning ? "text-amber-600" : "text-red-500"}`}>
            {check.detail}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function TemplateUpload({ onUploaded }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [category, setCategory] = useState("saas");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle", message: "", progress: 0 });
  const [showAllChecks, setShowAllChecks] = useState(false);
  const [parsedHtml, setParsedHtml] = useState<string | null>(null);
  const [fileDup, setFileDup] = useState<ExistingTemplate | null>(null);
  const [fileOverride, setFileOverride] = useState(false);
  const [nameOverride, setNameOverride] = useState(false);
  const [liveNameDup, setLiveNameDup] = useState<ExistingTemplate | null>(null);
  const [detectedImages, setDetectedImages] = useState(0);

  useEffect(() => {
    if (!templateName.trim()) {
      setLiveNameDup(null);
      return;
    }

    const timer = setTimeout(async () => {
      const dup = await findDuplicateByName(templateName);
      setLiveNameDup(dup);
    }, 400);

    return () => clearTimeout(timer);
  }, [templateName]);

  async function handleFile(file: File) {
    setSelectedFile(file);
    setValidation(null);
    setParsedHtml(null);
    setFileDup(null);
    setFileOverride(false);
    setDetectedImages(0);
    setUploadState({ status: "validating", message: "Validating ZIP structure...", progress: 10 });

    const { result, htmlString, imageCount } = await validateZip(file);
    setValidation(result);
    setDetectedImages(imageCount);

    if (htmlString) {
      setParsedHtml(htmlString);
      const contentDup = await findDuplicateByContent(htmlString);
      if (contentDup) {
        setFileDup(contentDup);
        setUploadState({ status: "idle", message: "", progress: 0 });
        return;
      }
    }

    setUploadState({ status: "idle", message: "", progress: 0 });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function doUpload(overrideFileCheck = false, overrideNameCheck = false) {
    if (!selectedFile || !templateName.trim() || !validation?.passed || !parsedHtml) return;

    if (!overrideFileCheck) {
      const contentDup = await findDuplicateByContent(parsedHtml);
      if (contentDup) {
        setFileDup(contentDup);
        return;
      }
    }

    if (!overrideNameCheck) {
      const nameDup = await findDuplicateByName(templateName);
      if (nameDup) {
        setLiveNameDup(nameDup);
        return;
      }
    }

    setUploadState({ status: "uploading", message: "Reading ZIP...", progress: 15 });

    try {
      const zip = await JSZip.loadAsync(selectedFile);
      const files = Object.keys(zip.files);

      setUploadState({ status: "uploading", message: "Extracting files...", progress: 30 });

      const htmlFile = files.find((f) => f.endsWith("index.html"));
      if (!htmlFile) throw new Error("index.html not found in ZIP");

      let htmlString = await zip.files[htmlFile].async("string");

      const cssFile = files.find((f) => f.includes("public/") && f.endsWith("style.css"));
      let cssString = cssFile ? await zip.files[cssFile].async("string") : "";

      const jsFile = files.find((f) => f.includes("public/") && f.endsWith("main.js"));
      const jsString = jsFile ? await zip.files[jsFile].async("string") : "";

      setUploadState({ status: "uploading", message: "Uploading images to Supabase...", progress: 45 });
      const templateId = `tpl-${Date.now()}`;
      const { urlMap: imageUrlMap, uploadedImageCount } = await uploadImagesToSupabase(zip, templateId);

      if (Object.keys(imageUrlMap).length > 0) {
        htmlString = embedImagesIntoHtml(htmlString, imageUrlMap);
        cssString = embedImagesIntoCss(cssString, imageUrlMap);
      
      }

      setUploadState({ status: "uploading", message: "Processing CSS...", progress: 60 });
      const strippedCss = extractCustomCssOnly(cssString);

      setUploadState({ status: "uploading", message: "Parsing HTML structure...", progress: 70 });

const parsedTemplate = parseHtmlToTemplate({
  htmlString,
  templateId,
  templateName: templateName.trim(),
  category,
  rawJs: jsString || "", // 🔥 IMPORTANT FIX
});

      const templateWithAssets = buildFirestoreSafeTemplate({
        ...parsedTemplate,
        rawHtml: htmlString,
        rawCss: strippedCss,
        rawJs: jsString || "",
      });

      setUploadState({ status: "uploading", message: "Checking document size...", progress: 80 });

      const docBytes = new Blob([JSON.stringify(templateWithAssets)]).size;
   
      if (docBytes > 900_000) {
        throw new Error(
          `Document is still ${(docBytes / 1024 / 1024).toFixed(1)} MB. Please reduce CSS or contact support.`
        );
      }

      setUploadState({ status: "uploading", message: "Saving to Firestore...", progress: 90 });
      await setDoc(doc(db, "templates", templateId), templateWithAssets);

      const imgMsg = uploadedImageCount > 0 ? ` · ${uploadedImageCount} image(s) uploaded to Supabase` : "";
      const cssMsg = strippedCss ? ` · custom CSS saved` : "";
      const jsMsg = jsString ? ` · JavaScript saved` : "";

      setUploadState({
        status: "success",
        message: `Template saved! ${templateWithAssets.blocks.length} blocks · ${Object.keys(
          templateWithAssets.cssVariables
        ).length} CSS vars${imgMsg}${cssMsg}${jsMsg}.`,
        progress: 100,
      });

      onUploaded();
      setTimeout(() => handleReset(), 3500);
    } catch (err: any) {
      setUploadState({
        status: "error",
        message: `Upload failed: ${err?.message ?? "Unknown error"}`,
        progress: 0,
      });
    }
  }

  function handleUpload() {
    doUpload(fileOverride, nameOverride);
  }

  function handleReset() {
    setSelectedFile(null);
    setTemplateName("");
    setValidation(null);
    setShowAllChecks(false);
    setParsedHtml(null);
    setFileDup(null);
    setFileOverride(false);
    setNameOverride(false);
    setLiveNameDup(null);
    setDetectedImages(0);
    setUploadState({ status: "idle", message: "", progress: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const isUploading = uploadState.status === "uploading";
  const isValidating = uploadState.status === "validating";

  const canUpload =
    !!selectedFile &&
    !!templateName.trim() &&
    validation?.passed === true &&
    !isUploading &&
    !isValidating &&
    uploadState.status !== "success" &&
    !(!!fileDup && !fileOverride) &&
    !(!!liveNameDup && !nameOverride);

  const sortedChecks = validation
    ? [...validation.checks].sort((a, b) => (!a.ok && b.ok ? -1 : a.ok && !b.ok ? 1 : 0))
    : [];

  const visibleChecks = showAllChecks ? sortedChecks : sortedChecks.slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600">
        <h3 className="text-base font-bold text-white">Upload Template</h3>
        <p className="text-xs text-indigo-200 mt-0.5">
          ZIP must contain <code className="bg-white/20 px-1 rounded">index.html</code>, optional{" "}
          <code className="bg-white/20 px-1 rounded">images/</code>, optional{" "}
          <code className="bg-white/20 px-1 rounded">public/style.css</code> and optional{" "}
          <code className="bg-white/20 px-1 rounded">public/main.js</code>
        </p>
      </div>

      <div className="p-6 space-y-5">
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5 uppercase tracking-wide">
            Template Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g. Modern SaaS Landing"
            className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none bg-gray-50 text-gray-800 transition-all
              ${
                liveNameDup && !nameOverride
                  ? "border-amber-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  : "border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              }`}
          />
        </div>

        {fileDup && !fileOverride && (
          <div className="bg-red-50 border-2 border-red-400 rounded-xl overflow-hidden">
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="text-2xl shrink-0">🚫</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-700">This file is already uploaded!</p>
                <div className="mt-1.5 px-3 py-2 bg-red-100 rounded-lg border border-red-200">
                  <p className="text-xs font-bold text-red-700">{fileDup.templateName}</p>
                  <p className="text-xs text-red-500">
                    {fileDup.category} · {fileDup.createdAt ?? "previously"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-4 pb-3">
              <button
                type="button"
                onClick={() => {
                  setFileDup(null);
                  setSelectedFile(null);
                  setValidation(null);
                  setParsedHtml(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition"
              >
                🗂 Choose Different File
              </button>
              <button
                type="button"
                onClick={() => {
                  setFileOverride(true);
                  setFileDup(null);
                }}
                className="flex-1 py-2 rounded-lg border-2 border-red-400 text-red-600 hover:bg-red-100 text-xs font-bold transition"
              >
                ⚠️ Save as New Copy
              </button>
            </div>
          </div>
        )}

        {liveNameDup && !nameOverride && !fileDup && templateName.trim() && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl overflow-hidden">
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="text-xl shrink-0">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-800">Template name already exists!</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  A template named <span className="font-bold">"{liveNameDup.templateName}"</span> already exists.
                </p>
              </div>
            </div>
            <div className="flex gap-2 px-4 pb-3">
              <button
                type="button"
                disabled={!selectedFile || !validation?.passed || isUploading}
                onClick={() => {
                  setNameOverride(true);
                  doUpload(fileOverride, true);
                }}
                className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 disabled:cursor-not-allowed text-white text-xs font-bold transition"
              >
                {isUploading ? "Saving..." : "✅ Save Anyway"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTemplateName("");
                  setLiveNameDup(null);
                }}
                className="flex-1 py-2 rounded-lg border-2 border-amber-400 text-amber-700 hover:bg-amber-100 text-xs font-bold transition"
              >
                ✏️ Rename Template
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5 uppercase tracking-wide">
            Category
          </label>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-gray-50 text-gray-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer"
            >
              <option value="saas">SaaS</option>
              <option value="agency">Agency</option>
              <option value="portfolio">Portfolio</option>
              <option value="ecommerce">E-Commerce</option>
              <option value="startup">Startup</option>
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2.5"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200
            ${
              dragOver
                ? "border-indigo-500 bg-indigo-50 scale-[0.99]"
                : fileDup && !fileOverride
                  ? "border-red-400 bg-red-50"
                  : selectedFile
                    ? validation?.passed
                      ? "border-green-300 bg-green-50"
                      : validation && !validation.passed
                        ? "border-red-300 bg-red-50"
                        : "border-indigo-300 bg-indigo-50"
                    : "border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/30"
            }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          {isValidating ? (
            <>
              <Loader2 size={36} className="text-indigo-400 animate-spin" />
              <p className="text-sm font-semibold text-indigo-600">Validating...</p>
            </>
          ) : selectedFile ? (
            <>
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  validation?.passed ? "bg-green-100" : validation ? "bg-red-100" : "bg-indigo-100"
                }`}
              >
                {validation?.passed ? (
                  <CheckCircle size={28} className="text-green-500" />
                ) : validation ? (
                  <XCircle size={28} className="text-red-400" />
                ) : (
                  <FileArchive size={28} className="text-indigo-500" />
                )}
              </div>

              <div className="text-center">
                <p className="text-sm font-bold text-gray-700">{selectedFile.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  {validation && (
                    <span className={`ml-2 font-semibold ${validation.passed ? "text-green-600" : "text-red-500"}`}>
                      ·{" "}
                      {validation.passed
                        ? `✓ Valid${validation.warnings > 0 ? ` (${validation.warnings} warning${validation.warnings !== 1 ? "s" : ""})` : ""}`
                        : `${validation.errors} error${validation.errors !== 1 ? "s" : ""}`}
                    </span>
                  )}
                </p>

                {detectedImages > 0 && (
                  <div className="flex items-center justify-center gap-1 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">
                      <Image size={10} /> {detectedImages} image(s) → Supabase
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400">Click to change file</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Upload size={28} className="text-gray-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-500">Drag & drop ZIP here</p>
                <p className="text-xs text-gray-400 mt-0.5">.zip only · max 10MB</p>
              </div>
            </>
          )}
        </div>

        {(isValidating || validation) && (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div
              className={`px-4 py-2.5 flex items-center justify-between
              ${validation?.passed ? "bg-green-50 border-b border-green-100" : validation ? "bg-red-50 border-b border-red-100" : "bg-gray-50 border-b border-gray-100"}`}
            >
              <div className="flex items-center gap-2">
                <Info size={13} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                  Validation Report
                </span>
              </div>

              {validation && (
                <div className="flex items-center gap-2">
                  {validation.errors > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">
                      {validation.errors} error(s)
                    </span>
                  )}
                  {validation.warnings > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full">
                      {validation.warnings} warning(s)
                    </span>
                  )}
                  {validation.passed && validation.errors === 0 && (
                    <span className="text-xs bg-green-100 text-green-600 font-bold px-2 py-0.5 rounded-full">
                      ✓ Ready
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="p-3 space-y-1.5 bg-white">
              {isValidating ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                  <Loader2 size={13} className="animate-spin text-indigo-400" /> Running checks...
                </div>
              ) : (
                <>
                  {visibleChecks.map((c, i) => (
                    <CheckRow key={i} check={c} />
                  ))}

                  {sortedChecks.length > 5 && (
                    <button
                      onClick={() => setShowAllChecks(!showAllChecks)}
                      className="w-full text-xs text-indigo-500 hover:text-indigo-700 font-semibold py-1.5 flex items-center justify-center gap-1"
                    >
                      {showAllChecks ? (
                        <>
                          <ChevronUp size={12} /> Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown size={12} /> Show {sortedChecks.length - 5} more
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {isUploading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium">{uploadState.message}</span>
              <span className="text-indigo-600 font-bold">{uploadState.progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
          </div>
        )}

        {uploadState.status === "success" && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
            <CheckCircle size={18} className="text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-700">Upload Successful!</p>
              <p className="text-xs text-green-600 mt-0.5">{uploadState.message}</p>
            </div>
          </div>
        )}

        {uploadState.status === "error" && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
            <AlertCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-600">Upload Failed</p>
              <p className="text-xs text-red-500 mt-0.5">{uploadState.message}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={!canUpload}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all duration-150
              ${
                !canUpload
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 cursor-pointer"
              }`}
          >
            {isUploading ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Processing...
              </>
            ) : fileDup && !fileOverride ? (
              <>
                <XCircle size={15} /> Blocked — Duplicate
              </>
            ) : liveNameDup && !nameOverride ? (
              <>
                <AlertTriangle size={15} /> Blocked — Duplicate Name
              </>
            ) : (
              <>
                <Upload size={15} /> Upload Template
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-amber-100 flex items-center gap-2">
            <AlertTriangle size={13} className="text-amber-500" />
            <p className="text-xs font-bold text-amber-700">Recommended ZIP structure</p>
          </div>
          <div className="px-3 py-2.5">
            <pre className="text-xs text-amber-700 font-mono leading-relaxed">{`template.zip
├── index.html
├── images/             (optional)
│   ├── hero.png
│   └── logo.svg
└── public/             (optional)
    ├── style.css
    └── main.js`}</pre>
            <p className="text-xs text-amber-600 mt-2">
              💡 Images are uploaded to Supabase and URLs are auto-replaced in HTML/CSS.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}