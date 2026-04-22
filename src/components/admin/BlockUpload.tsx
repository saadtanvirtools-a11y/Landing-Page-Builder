import { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import { db } from "../../firebase";
import { collection, getDocs, setDoc, doc, query, where } from "firebase/firestore";
import { uploadBlockImage } from "../../api/supabaseStorage";
import type { StandaloneBlock, BlockTier, CSSVariables, EditableItem, User } from "../../types";

const BLOCK_TYPES = [
  { value: "hero", label: "🦸 Hero" },
  { value: "features", label: "⚡ Features" },
  { value: "benefits", label: "✅ Benefits" },
  { value: "faq", label: "❓ FAQ" },
  { value: "testimonials", label: "💬 Testimonials" },
  { value: "cta", label: "🎯 CTA" },
  { value: "cta-banner", label: "🎯 CTA Banner" },
  { value: "footer", label: "🔗 Footer" },
  { value: "navbar", label: "🔝 Navbar" },
  { value: "pricing", label: "💰 Pricing" },
  { value: "contact", label: "📬 Contact" },
  { value: "how-it-works", label: "🔄 How It Works" },
  { value: "other", label: "📦 Other" },
];

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

function isImagePath(path: string): boolean {
  const lower = path.toLowerCase();
  const isImage = Object.keys(IMAGE_MIME).some((ext) => lower.endsWith(`.${ext}`));
  const isInImagesFolder = lower.includes("/images/") || lower.startsWith("images/");
  return isInImagesFolder && isImage;
}

// ── Hash helper ─────────────────────────────────────────
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ── Firestore duplicate checks ───────────────────────────
async function findDuplicateByContent(htmlContent: string): Promise<StandaloneBlock | null> {
  try {
    const incoming = hashString(htmlContent.trim());
    const snap = await getDocs(collection(db, "blocks"));
    const found = snap.docs.find((d) => hashString((d.data().rawHtml || "").trim()) === incoming);
    return found ? (found.data() as StandaloneBlock) : null;
  } catch {
    return null;
  }
}

async function findDuplicateByName(name: string, type: string): Promise<StandaloneBlock | null> {
  try {
    const q = query(
      collection(db, "blocks"),
      where("blockName", "==", name.trim()),
      where("blockType", "==", type)
    );
    const snap = await getDocs(q);
    return snap.empty ? null : (snap.docs[0].data() as StandaloneBlock);
  } catch {
    return null;
  }
}

// ── Load users from Firestore ────────────────────────────
async function loadUsersFromFirestore(): Promise<User[]> {
  try {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs
      .map((d) => {
        const { password, ...u } = d.data() as any;
        return u as User;
      })
      .filter((u) => u.role !== "admin");
  } catch {
    return [];
  }
}

// ── HTML Parsing helpers ────────────────────────────────
function extractCSSVariables(docEl: Document): CSSVariables {
  const vars: CSSVariables = {};
  for (const tag of Array.from(docEl.querySelectorAll("style"))) {
    const text = tag.textContent || "";
    const rootMatch = text.match(/:root\s*\{([^}]+)\}/s);
    if (!rootMatch) continue;

    const varRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let match: RegExpExecArray | null;
    while ((match = varRegex.exec(rootMatch[1])) !== null) {
      vars[match[1].trim()] = match[2].trim();
    }
  }
  return vars;
}

function parseColorVars(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw) return result;

  raw.split(",").forEach((pair) => {
    const colonIdx = pair.indexOf(":");
    if (colonIdx === -1) return;
    const k = pair.slice(0, colonIdx).trim();
    const v = pair.slice(colonIdx + 1).trim();
    if (k && v) result[k] = v;
  });

  return result;
}

function readTailwindClass(el: Element): { tailwindClass: string; styleChildSelector: string } {
  const ownClass = el.getAttribute("class") || "";
  if (ownClass.trim()) return { tailwindClass: ownClass, styleChildSelector: "" };

  const child = el.firstElementChild;
  if (child) {
    const childClass = child.getAttribute("class") || "";
    if (childClass.trim()) {
      return {
        tailwindClass: childClass,
        styleChildSelector: `${child.tagName.toLowerCase()}:nth-child(1)`,
      };
    }
  }

  return { tailwindClass: "", styleChildSelector: "" };
}

function extractEditables(blockEl: Element): EditableItem[] {
  return Array.from(blockEl.querySelectorAll("[data-editable]")).map((el) => {
    const id = el.getAttribute("data-editable") || "";
    const type = el.getAttribute("data-editable-type") || "text";
    const styleId = el.getAttribute("data-style-id") || "";
    const styleProps = el.getAttribute("data-style-props") || "";

    const content =
      type === "image"
        ? el.getAttribute("src") || (el as HTMLImageElement).src || ""
        : type === "link"
          ? el.getAttribute("href") || ""
          : (el.textContent || "").trim();

    const { tailwindClass, styleChildSelector } = readTailwindClass(el);

    return {
      id,
      type: type as EditableItem["type"],
      content,
      colorVars: parseColorVars(el.getAttribute("data-color-vars") || ""),
      tailwindClass,
      styleProps,
      styleId,
      styleChildSelector,
    };
  });
}

function parseBlockHtml(htmlString: string): {
  cssVariables: CSSVariables;
  editables: EditableItem[];
  rawHtml: string;
  error?: string;
} {
  const parser = new DOMParser();
  const docEl = parser.parseFromString(htmlString, "text/html");
  const blockEl = docEl.querySelector("[data-block]");

  if (!blockEl) {
    return {
      cssVariables: {},
      editables: [],
      rawHtml: htmlString,
      error: "No [data-block] attribute found. Add data-block='blocktype' to your root element.",
    };
  }

  return {
    cssVariables: extractCSSVariables(docEl),
    editables: extractEditables(blockEl),
    rawHtml: htmlString,
  };
}

function generateId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function injectAssetsIntoHtml(params: {
  htmlString: string;
  cssString: string;
  jsString: string;
}): string {
  const { htmlString, cssString, jsString } = params;
  let finalHtml = htmlString;

  finalHtml = finalHtml
    .replace(/<link[^>]+href=["']\.\/public\/[^"']+["'][^>]*>/gi, "")
    .replace(/<link[^>]+href=["']public\/[^"']+["'][^>]*>/gi, "")
    .replace(/<script[^>]+src=["']\.\/public\/[^"']+["'][^>]*><\/script>/gi, "")
    .replace(/<script[^>]+src=["']public\/[^"']+["'][^>]*><\/script>/gi, "");

  if (cssString.trim()) {
    const styleTag = `\n<style id="block-upload-inline-css">\n${cssString}\n</style>\n`;
    if (finalHtml.includes("</head>")) {
      finalHtml = finalHtml.replace("</head>", `${styleTag}</head>`);
    } else {
      finalHtml = styleTag + finalHtml;
    }
  }

  if (jsString.trim()) {
    const scriptTag = `\n<script id="block-upload-inline-js">\n${jsString}\n</script>\n`;
    if (finalHtml.includes("</body>")) {
      finalHtml = finalHtml.replace("</body>", `${scriptTag}</body>`);
    } else {
      finalHtml += scriptTag;
    }
  }

  return finalHtml;
}

function replaceAssetPathsInHtml(html: string, assetMap: Record<string, string>): string {
  if (!html || !Object.keys(assetMap).length) return html;

  let updatedHtml = html;

  Object.entries(assetMap).forEach(([oldPath, newUrl]) => {
    const escaped = oldPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    updatedHtml = updatedHtml.replace(
      new RegExp(`src=["']${escaped}["']`, "gi"),
      `src="${newUrl}"`
    );

    updatedHtml = updatedHtml.replace(
      new RegExp(`href=["']${escaped}["']`, "gi"),
      `href="${newUrl}"`
    );

    updatedHtml = updatedHtml.replace(
      new RegExp(`url\\(["']?${escaped}["']?\\)`, "gi"),
      `url("${newUrl}")`
    );
  });

  return updatedHtml;
}

function replaceAssetPathsInCss(css: string, assetMap: Record<string, string>): string {
  if (!css || !Object.keys(assetMap).length) return css;

  let updatedCss = css;

  Object.entries(assetMap).forEach(([oldPath, newUrl]) => {
    const escaped = oldPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    updatedCss = updatedCss.replace(
      new RegExp(`url\\(["']?${escaped}["']?\\)`, "gi"),
      `url("${newUrl}")`
    );
  });

  return updatedCss;
}

interface Props {
  onUploaded?: () => void;
}

export default function BlockUpload({ onUploaded }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [blockName, setBlockName] = useState("");
  const [blockType, setBlockType] = useState("hero");
  const [tier, setTier] = useState<BlockTier>("free");
  const [users, setUsers] = useState<User[]>([]);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [editableCount, setEditableCount] = useState(0);
  const [cssVarCount, setCssVarCount] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [parseError, setParseError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [fileDup, setFileDup] = useState<StandaloneBlock | null>(null);
  const [fileOverride, setFileOverride] = useState(false);
  const [nameOverride, setNameOverride] = useState(false);
  const [liveDupByName, setLiveDupByName] = useState<StandaloneBlock | null>(null);

  const [zipFile, setZipFile] = useState<File | null>(null);

  useEffect(() => {
    loadUsersFromFirestore().then(setUsers).catch(console.error);
  }, []);

  useEffect(() => {
    if (!blockName.trim()) {
      setLiveDupByName(null);
      return;
    }

    const timer = setTimeout(async () => {
      const dup = await findDuplicateByName(blockName, blockType);
      setLiveDupByName(dup);
    }, 400);

    return () => clearTimeout(timer);
  }, [blockName, blockType]);

  function toggleUser(userId: string) {
    setAllowedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleFile(file: File) {
    setParseError("");
    setHtmlContent("");
    setEditableCount(0);
    setCssVarCount(0);
    setImageCount(0);
    setSuccess(false);
    setError("");
    setFileDup(null);
    setFileOverride(false);

    if (!file.name.endsWith(".zip")) {
      setError("Please upload a .zip file.");
      return;
    }

    setFileName(file.name);
    setZipFile(file);

    try {
      const zip = await JSZip.loadAsync(file);
      const files = Object.keys(zip.files);

      const htmlPath = files.find((f) => f.endsWith("index.html")) || files.find((f) => f.endsWith(".html"));
      const htmlFile = htmlPath ? zip.files[htmlPath] : null;

      if (!htmlFile) {
        setError("No HTML file found inside the ZIP.");
        return;
      }

      const htmlString = await htmlFile.async("string");

      const imageFiles = files.filter((path) => !zip.files[path].dir && isImagePath(path));
      setImageCount(imageFiles.length);

      const contentDup = await findDuplicateByContent(htmlString);
      if (contentDup) {
        setFileDup(contentDup);

        const result = parseBlockHtml(htmlString);
        if (!result.error) {
          setHtmlContent(htmlString);
          setEditableCount(result.editables.length);
          setCssVarCount(Object.keys(result.cssVariables).length);
        }
        return;
      }

      const result = parseBlockHtml(htmlString);
      if (result.error) {
        setParseError(result.error);
        return;
      }

      setHtmlContent(htmlString);
      setEditableCount(result.editables.length);
      setCssVarCount(Object.keys(result.cssVariables).length);
    } catch {
      setError("Failed to read ZIP file. Please try again.");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function doSave() {
    setUploading(true);
    setError("");

    try {
      if (!zipFile) {
        setError("Please upload a ZIP file first.");
        return;
      }

      const blockId = generateId();
      const zip = await JSZip.loadAsync(zipFile);
      const files = Object.keys(zip.files);

      const htmlPath = files.find((f) => f.endsWith("index.html")) || files.find((f) => f.endsWith(".html"));
      const cssPath = files.find((f) => f.includes("public/") && f.endsWith("style.css"));
      const jsPath = files.find((f) => f.includes("public/") && f.endsWith("main.js"));

      if (!htmlPath) {
        setError("No HTML file found inside the ZIP.");
        return;
      }

      let finalHtml = await zip.files[htmlPath].async("string");
      let cssString = cssPath ? await zip.files[cssPath].async("string") : "";
      const jsString = jsPath ? await zip.files[jsPath].async("string") : "";

      const imageUrlMap: Record<string, string> = {};
      const imageFiles = files.filter((path) => !zip.files[path].dir && isImagePath(path));

      for (const path of imageFiles) {
        const zipObj = zip.files[path];
        const fileNameOnly = path.split("/").pop() || "image.png";
        const arrayBuffer = await zipObj.async("arraybuffer");
        const mimeType = getImageMime(fileNameOnly);
        const uploadFile = new File([arrayBuffer], fileNameOnly, { type: mimeType });

        const uploaded = await uploadBlockImage(uploadFile, blockId);

        imageUrlMap[path] = uploaded.url;
        imageUrlMap[`images/${fileNameOnly}`] = uploaded.url;
        imageUrlMap[`/images/${fileNameOnly}`] = uploaded.url;
        imageUrlMap[`./images/${fileNameOnly}`] = uploaded.url;
        imageUrlMap[`../images/${fileNameOnly}`] = uploaded.url;
        imageUrlMap[fileNameOnly] = uploaded.url;
      }

      finalHtml = replaceAssetPathsInHtml(finalHtml, imageUrlMap);
      cssString = replaceAssetPathsInCss(cssString, imageUrlMap);

      finalHtml = injectAssetsIntoHtml({
        htmlString: finalHtml,
        cssString,
        jsString,
      });

      const result = parseBlockHtml(finalHtml);
      if (result.error) {
        setError(result.error);
        return;
      }

      const newBlock: StandaloneBlock = {
        id: blockId,
        blockName: blockName.trim(),
        blockType,
        tier,
        allowedUserIds: tier === "custom" ? allowedUserIds : [],
        cssVariables: result.cssVariables,
        editables: result.editables,
        rawHtml: finalHtml,
        createdAt: new Date().toISOString().split("T")[0],
      };

      await setDoc(doc(db, "blocks", newBlock.id), newBlock);

      setSuccess(true);
      handleReset();

      setTimeout(() => {
        onUploaded?.();
        setSuccess(false);
      }, 1800);
    } catch (err: any) {
      console.error("[BlockUpload] Save failed:", err);
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!blockName.trim()) {
      setError("Block name is required.");
      return;
    }

    if (!htmlContent || !zipFile) {
      setError("Please upload a ZIP file first.");
      return;
    }

    if (parseError) {
      setError("Fix the HTML errors before saving.");
      return;
    }

    if (tier === "custom" && allowedUserIds.length === 0) {
      setError("Please select at least one user for Custom access.");
      return;
    }

    if (!fileOverride) {
      const contentDup = await findDuplicateByContent(htmlContent);
      if (contentDup) {
        setFileDup(contentDup);
        setError(`This exact file was already uploaded as "${contentDup.blockName}".`);
        return;
      }
    }

    if (!nameOverride) {
      const nameDup = await findDuplicateByName(blockName, blockType);
      if (nameDup) {
        setLiveDupByName(nameDup);
        setError(`A block named "${nameDup.blockName}" (${nameDup.blockType}) already exists.`);
        return;
      }
    }

    await doSave();
  }

  async function handleNameSaveAnyway() {
    setError("");

    if (!blockName.trim()) {
      setError("Block name is required.");
      return;
    }

    if (!htmlContent || !zipFile) {
      setError("Please upload a ZIP file first.");
      return;
    }

    if (tier === "custom" && allowedUserIds.length === 0) {
      setError("Please select at least one user for Custom access.");
      return;
    }

    setNameOverride(true);
    await doSave();
  }

  function handleReset() {
    setBlockName("");
    setBlockType("hero");
    setTier("free");
    setAllowedUserIds([]);
    setFileName("");
    setZipFile(null);
    setHtmlContent("");
    setParseError("");
    setEditableCount(0);
    setCssVarCount(0);
    setImageCount(0);
    setError("");
    setFileDup(null);
    setFileOverride(false);
    setNameOverride(false);
    setLiveDupByName(null);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const submitDisabled =
    uploading ||
    !htmlContent ||
    !!parseError ||
    (!!fileDup && !fileOverride) ||
    (!!liveDupByName && !nameOverride);

  return (
    <div className="space-y-5">
      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-medium">
          <span className="text-lg">✅</span> Block saved! Switching to list…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <span className="text-lg shrink-0">❌</span>
          <span>{error}</span>
        </div>
      )}

      {fileDup && !fileOverride && (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl overflow-hidden">
          <div className="flex items-start gap-3 px-4 py-3">
            <span className="text-2xl shrink-0">🚫</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-700">This file is already uploaded!</p>
              <p className="text-xs text-red-600 mt-1">Already exists as:</p>
              <div className="mt-1.5 px-3 py-2 bg-red-100 rounded-lg border border-red-200">
                <p className="text-xs font-bold text-red-700">{fileDup.blockName}</p>
                <p className="text-xs text-red-500">
                  {fileDup.blockType} · uploaded {fileDup.createdAt}
                </p>
              </div>
              <p className="text-xs text-red-500 mt-2">
                Upload a different file, or save as a new copy anyway.
              </p>
            </div>
          </div>
          <div className="flex gap-2 px-4 pb-3">
            <button
              type="button"
              onClick={() => {
                setFileDup(null);
                setHtmlContent("");
                setFileName("");
                setZipFile(null);
                setImageCount(0);
                setFileOverride(false);
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

      {liveDupByName && !nameOverride && !fileDup && blockName.trim() && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl overflow-hidden">
          <div className="flex items-start gap-3 px-4 py-3">
            <span className="text-xl shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">Name already exists!</p>
              <p className="text-xs text-amber-700 mt-0.5">
                A <span className="font-bold">{blockType}</span> block named{" "}
                <span className="font-bold">"{blockName.trim()}"</span> was uploaded on{" "}
                <span className="font-bold">{liveDupByName.createdAt}</span>.
              </p>
            </div>
          </div>
          <div className="flex gap-2 px-4 pb-3">
            <button
              type="button"
              disabled={!htmlContent || !!parseError || !!fileDup || uploading}
              onClick={handleNameSaveAnyway}
              className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 disabled:cursor-not-allowed text-white text-xs font-bold transition"
            >
              {uploading ? "Saving..." : "✅ Save Anyway"}
            </button>
            <button
              type="button"
              onClick={() => {
                setBlockName("");
                setLiveDupByName(null);
              }}
              className="flex-1 py-2 rounded-lg border-2 border-amber-400 text-amber-700 hover:bg-amber-100 text-xs font-bold transition"
            >
              ✏️ Rename Block
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Block Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={blockName}
            onChange={(e) => setBlockName(e.target.value)}
            placeholder='e.g. "Dark Hero", "Pricing Table v2"'
            className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white placeholder-gray-300
              ${
                liveDupByName && !nameOverride
                  ? "border-amber-400 focus:ring-amber-200 bg-amber-50"
                  : "border-gray-200 focus:ring-indigo-300"
              }`}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Block Type <span className="text-red-400">*</span>
          </label>
          <select
            value={blockType}
            onChange={(e) => setBlockType(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            {BLOCK_TYPES.map((bt) => (
              <option key={bt.value} value={bt.value}>
                {bt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Access Tier <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                value: "free",
                emoji: "🆓",
                label: "Free",
                desc: "All users",
                active: "border-green-400 bg-green-50 text-green-700",
              },
              {
                value: "premium",
                emoji: "🔒",
                label: "Premium",
                desc: "Locked for all",
                active: "border-yellow-400 bg-yellow-50 text-yellow-700",
              },
              {
                value: "custom",
                emoji: "👤",
                label: "Custom",
                desc: "Pick users",
                active: "border-indigo-400 bg-indigo-50 text-indigo-700",
              },
            ].map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTier(t.value as BlockTier)}
                className={`flex flex-col items-center gap-1.5 px-3 py-4 rounded-xl border-2 transition-all text-sm font-semibold
                  ${
                    tier === t.value
                      ? t.active
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                  }`}
              >
                <span className="text-2xl">{t.emoji}</span>
                <span>{t.label}</span>
                <span className="text-xs font-normal text-gray-400 text-center">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {tier === "custom" && (
          <div className="border border-indigo-100 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
              <p className="text-xs font-bold text-indigo-700">👤 Select Allowed Users</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAllowedUserIds(users.map((u) => u.id))}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold"
                >
                  All
                </button>
                <span className="text-indigo-200">|</span>
                <button
                  type="button"
                  onClick={() => setAllowedUserIds([])}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold"
                >
                  None
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
              {users.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-gray-400">No users found in system</p>
                  <p className="text-xs text-gray-300 mt-0.5">Users appear here after they sign up</p>
                </div>
              ) : (
                users.map((user) => {
                  const checked = allowedUserIds.includes(user.id);
                  return (
                    <label
                      key={user.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                        checked ? "bg-indigo-50" : "bg-white hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(user.id)}
                        className="w-4 h-4 rounded accent-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">{user.name}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                      {checked && <span className="text-xs text-indigo-500 font-bold shrink-0">✓</span>}
                    </label>
                  );
                })
              )}
            </div>
            {allowedUserIds.length > 0 && (
              <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-100">
                <p className="text-xs text-indigo-600 font-medium">
                  {allowedUserIds.length} user{allowedUserIds.length !== 1 ? "s" : ""} selected
                </p>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Block ZIP File <span className="text-red-400">*</span>
          </label>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${
                fileDup && !fileOverride
                  ? "border-red-400 bg-red-50"
                  : htmlContent
                    ? "border-green-300 bg-green-50"
                    : parseError
                      ? "border-red-300 bg-red-50"
                      : "border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50"
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />

            {fileDup && !fileOverride ? (
              <div className="space-y-1">
                <div className="text-3xl">🚫</div>
                <p className="text-sm font-semibold text-red-600">{fileName}</p>
                <p className="text-xs text-red-500 mt-1">This file is already uploaded</p>
                <p className="text-xs text-gray-400 mt-1">Click to choose a different file</p>
              </div>
            ) : htmlContent ? (
              <div className="space-y-1">
                <div className="text-3xl">✅</div>
                <p className="text-sm font-semibold text-green-700">{fileName}</p>
                <div className="flex justify-center gap-4 mt-2 flex-wrap">
                  <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full font-medium">
                    {editableCount} editables
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium">
                    {cssVarCount} CSS vars
                  </span>
                  <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full font-medium">
                    {imageCount} image{imageCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Click to replace</p>
              </div>
            ) : parseError ? (
              <div className="space-y-1">
                <div className="text-3xl">⚠️</div>
                <p className="text-sm font-semibold text-red-600">{fileName}</p>
                <p className="text-xs text-red-500 mt-1 max-w-sm mx-auto">{parseError}</p>
                <p className="text-xs text-gray-400 mt-1">Click to try another file</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-4xl">📦</div>
                <p className="text-sm font-semibold text-gray-600">Drop your ZIP here or click to browse</p>
                <p className="text-xs text-gray-400">
                  ZIP should contain <code className="bg-gray-100 px-1 rounded">index.html</code>,
                  optional <code className="bg-gray-100 px-1 rounded">images/</code>,
                  optional <code className="bg-gray-100 px-1 rounded">public/style.css</code>,
                  and optional <code className="bg-gray-100 px-1 rounded">public/main.js</code>
                </p>
              </div>
            )}
          </div>

          <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs font-semibold text-blue-700 mb-1">📋 HTML Requirements</p>
            <ul className="text-xs text-blue-600 space-y-0.5 list-disc list-inside">
              <li>
                Root element must have <code className="bg-blue-100 px-1 rounded">data-block="blocktype"</code>
              </li>
              <li>
                Editable elements need <code className="bg-blue-100 px-1 rounded">data-editable="id"</code>
              </li>
              <li>
                CSS variables should be defined in <code className="bg-blue-100 px-1 rounded">:root {"{}"}</code>
              </li>
              <li>
                Image paths can be like <code className="bg-blue-100 px-1 rounded">images/hero.jpg</code>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitDisabled}
            className="flex-1 py-3 px-6 disabled:bg-gray-300 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-all shadow-sm"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving...
              </span>
            ) : fileDup && !fileOverride ? (
              "🚫 Blocked — Duplicate File"
            ) : liveDupByName && !nameOverride ? (
              "🚫 Blocked — Duplicate Name"
            ) : (
              `Save ${tier === "premium" ? "🔒 Premium" : tier === "custom" ? "👤 Custom" : "🆓 Free"} Block`
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-3 border border-gray-200 text-gray-500 hover:bg-gray-50 font-semibold rounded-xl text-sm transition"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}