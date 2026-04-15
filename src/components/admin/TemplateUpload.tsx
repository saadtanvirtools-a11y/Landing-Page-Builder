import React, { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import { Upload, FileArchive, CheckCircle, XCircle, Loader2, AlertTriangle, Info, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { parseHtmlToTemplate } from "../../utils/htmlParser";

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

// ✅ Simple fast hash — no crypto needed
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ✅ Check duplicate by FILE CONTENT (rawHtml hash)
function findDuplicateByContent(htmlString: string): ExistingTemplate | null {
  try {
    const incoming = hashString(htmlString.trim());
    const all: ExistingTemplate[] = JSON.parse(localStorage.getItem("lp_templates") || "[]");
    return all.find((t) => hashString((t.rawHtml || "").trim()) === incoming) ?? null;
  } catch {
    return null;
  }
}

// Check duplicate by NAME
function findDuplicateByName(name: string): ExistingTemplate | null {
  try {
    const all: ExistingTemplate[] = JSON.parse(localStorage.getItem("lp_templates") || "[]");
    return all.find((t) => t.templateName.trim().toLowerCase() === name.trim().toLowerCase()) ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// HTML VALIDATOR
// ─────────────────────────────────────────────────────────────
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
      blocks.length > 0 ? `Found ${blocks.length} block${blocks.length !== 1 ? "s" : ""}: ${blockIds.slice(0, 5).join(", ")}${blockIds.length > 5 ? "…" : ""}` : "No [data-block] elements found.",
    detail: blocks.length === 0 ? `Every section must have a data-block attribute.\nExample: <section data-block="hero">` : undefined,
  });

  const duplicates = blockIds.filter((id, i) => blockIds.indexOf(id) !== i);
  const uniqueDups = [...new Set(duplicates)];
  checks.push({
    label: "No duplicate block IDs",
    ok: duplicates.length === 0,
    blocking: true,
    message: duplicates.length === 0 ? "All block IDs are unique ✓" : `Duplicate block IDs: ${uniqueDups.join(", ")}`,
    detail: duplicates.length > 0 ? `Each data-block value must be unique.\nDuplicates: ${uniqueDups.join(", ")}` : undefined,
  });

  const editables = Array.from(doc.querySelectorAll("[data-editable]"));
  checks.push({
    label: "Has data-editable fields",
    ok: editables.length > 0,
    blocking: true,
    message: editables.length > 0 ? `Found ${editables.length} editable field${editables.length !== 1 ? "s" : ""}` : "No [data-editable] elements found.",
    detail: editables.length === 0 ? `Add data-editable and data-editable-type to editable elements.` : undefined,
  });

  const missingType = editables.filter((e) => !e.getAttribute("data-editable-type"));
  checks.push({
    label: "All editables have data-editable-type",
    ok: missingType.length === 0,
    blocking: true,
    message:
      missingType.length === 0
        ? "All editable elements have a type ✓"
        : `${missingType.length} editable${missingType.length !== 1 ? "s" : ""} missing data-editable-type: ${missingType.map((e) => e.getAttribute("data-editable") || "?").join(", ")}`,
    detail: missingType.length > 0 ? `Every data-editable must have data-editable-type="text", "image", or "link".` : undefined,
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
    message:
      invalidTypes.length === 0
        ? `All types are valid (text / image / link) ✓`
        : `Invalid types: ${invalidTypes.map((e) => `${e.getAttribute("data-editable")}="${e.getAttribute("data-editable-type")}"`).join(", ")}`,
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
        ? `Found ${cssVarNames.length} CSS variable${cssVarNames.length !== 1 ? "s" : ""}: ${cssVarNames.slice(0, 4).join(", ")}${cssVarNames.length > 4 ? "…" : ""}`
        : "No :root CSS variables found.",
    detail: cssVarNames.length === 0 ? `Add :root { --primary: #6366f1; } in a <style> tag.` : undefined,
  });

  const colorVarEls = Array.from(doc.querySelectorAll("[data-color-vars]"));
  const brokenColorVars: string[] = [];
  colorVarEls.forEach((el) => {
    const raw = el.getAttribute("data-color-vars") || "";
    raw.split(",").forEach((pair) => {
      const varName = pair.split(":")[1]?.trim();
      if (varName && !cssVarNames.includes(varName)) brokenColorVars.push(varName);
    });
  });
  if (colorVarEls.length > 0) {
    checks.push({
      label: "data-color-vars reference valid CSS vars",
      ok: brokenColorVars.length === 0,
      blocking: false,
      message:
        brokenColorVars.length === 0
          ? "All color-var references are valid ✓"
          : `${brokenColorVars.length} var${brokenColorVars.length !== 1 ? "s" : ""} not in :root: ${[...new Set(brokenColorVars)].join(", ")}`,
      detail: brokenColorVars.length > 0 ? `Not defined in :root:\n${[...new Set(brokenColorVars)].join(", ")}` : undefined,
    });
  }

  return checks;
}

// ─────────────────────────────────────────────────────────────
// ZIP VALIDATOR
// ─────────────────────────────────────────────────────────────
async function validateZip(file: File): Promise<{ result: ValidationResult; htmlString: string | null }> {
  const checks: ValidationCheck[] = [];
  let htmlString: string | null = null;

  checks.push({
    label: "File format is .zip",
    ok: file.name.endsWith(".zip"),
    blocking: true,
    message: file.name.endsWith(".zip") ? "Valid ZIP file ✓" : "File must be a .zip archive",
  });

  const sizeMB = file.size / (1024 * 1024);
  checks.push({
    label: "File size under 10MB",
    ok: sizeMB < 10,
    blocking: true,
    message: sizeMB < 10 ? `${sizeMB.toFixed(2)} MB — OK ✓` : `${sizeMB.toFixed(2)} MB — exceeds 10MB limit`,
  });

  try {
    const zip = await JSZip.loadAsync(file);
    const files = Object.keys(zip.files);
    const htmlFile = files.find((f) => f.endsWith("index.html"));
    const cssFile = files.find((f) => f.includes("public/") && f.endsWith(".css"));

    checks.push({
      label: "Contains index.html",
      ok: !!htmlFile,
      blocking: true,
      message: htmlFile ? `Found: ${htmlFile} ✓` : "index.html is missing from ZIP",
    });
    checks.push({
      label: "Contains public/style.css",
      ok: !!cssFile,
      blocking: true,
      message: cssFile ? `Found: ${cssFile} ✓` : "public/style.css is missing",
    });

    if (htmlFile) {
      htmlString = await zip.files[htmlFile].async("string");
      checks.push(...validateHtmlStructure(htmlString));
    }
  } catch {
    checks.push({ label: "ZIP is readable", ok: false, blocking: true, message: "Could not open ZIP — may be corrupted" });
  }

  const blockingFailed = checks.filter((c) => c.blocking && !c.ok);
  const warnings = checks.filter((c) => !c.blocking && !c.ok).length;
  return {
    result: { passed: blockingFailed.length === 0, checks, warnings, errors: blockingFailed.length },
    htmlString,
  };
}

// ─────────────────────────────────────────────────────────────
// CHECK ROW
// ─────────────────────────────────────────────────────────────
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
            <span className={`font-semibold ${check.ok ? "text-green-700" : isWarning ? "text-amber-700" : "text-red-600"}`}>{check.label}</span>
            {isWarning && <span className="shrink-0 text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">warning</span>}
          </div>
          <p className={`mt-0.5 ${check.ok ? "text-green-600" : isWarning ? "text-amber-600" : "text-red-500"}`}>{check.message}</p>
        </div>
        {check.detail && !check.ok && (
          <button onClick={() => setExpanded(!expanded)} className="shrink-0 text-gray-400 hover:text-gray-600 mt-0.5">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>
      {expanded && check.detail && (
        <div className="px-3 pb-2 border-t border-current/10">
          <pre className={`text-xs whitespace-pre-wrap font-mono mt-1.5 leading-relaxed ${isWarning ? "text-amber-600" : "text-red-500"}`}>{check.detail}</pre>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function TemplateUpload({ onUploaded }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [category, setCategory] = useState("saas");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle", message: "", progress: 0 });
  const [showAllChecks, setShowAllChecks] = useState(false);

  // ✅ Stores the extracted HTML from the ZIP (needed for content hash)
  const [parsedHtml, setParsedHtml] = useState<string | null>(null);

  // File-content duplicate (detected at file pick time)
  const [fileDup, setFileDup] = useState<ExistingTemplate | null>(null);
  const [fileOverride, setFileOverride] = useState(false);

  // Name duplicate (live as admin types)
  const [nameOverride, setNameOverride] = useState(false);

  // Live name duplicate check
  useEffect(() => {
    if (!templateName.trim()) {
      setNameOverride(false);
      return;
    }
    setNameOverride(false);
  }, [templateName]);

  async function handleFile(file: File) {
    setSelectedFile(file);
    setValidation(null);
    setParsedHtml(null);
    setFileDup(null);
    setFileOverride(false);
    setUploadState({ status: "validating", message: "Validating ZIP structure...", progress: 10 });

    const { result, htmlString } = await validateZip(file);
    setValidation(result);

    if (htmlString) {
      setParsedHtml(htmlString);
      // ✅ Check file content duplicate RIGHT HERE after extracting HTML
      const contentDup = findDuplicateByContent(htmlString);
      if (contentDup) {
        setFileDup(contentDup);
        // Don't proceed — show warning, keep validation visible
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

    // ✅ Synchronous content check at upload time too (belt + suspenders)
    if (!overrideFileCheck) {
      const contentDup = findDuplicateByContent(parsedHtml);
      if (contentDup) {
        setFileDup(contentDup);
        return;
      }
    }

    // ✅ Synchronous name check at upload time
    if (!overrideNameCheck) {
      const liveDup = findDuplicateByName(templateName);
      if (liveDup) {
        return;
      }
    }

    setUploadState({ status: "uploading", message: "Reading ZIP...", progress: 20 });
    try {
      const zip = await JSZip.loadAsync(selectedFile);
      setUploadState({ status: "uploading", message: "Extracting files...", progress: 40 });

      const htmlFile = Object.keys(zip.files).find((f) => f.endsWith("index.html"));
      if (!htmlFile) throw new Error("index.html not found in ZIP");
      const htmlString = await zip.files[htmlFile].async("string");

      setUploadState({ status: "uploading", message: "Parsing HTML structure...", progress: 60 });
      const cssFile = Object.keys(zip.files).find((f) => f.includes("public/") && f.endsWith("style.css"));
      const cssString = cssFile ? await zip.files[cssFile].async("string") : "";

      const templateId = `tpl_${Date.now()}`;
      const parsedTemplate = parseHtmlToTemplate({ htmlString, templateId, templateName: templateName.trim(), category });
      (parsedTemplate as any).rawCss = cssString;
      (parsedTemplate as any).rawHtml = htmlString; // ✅ Store rawHtml for future content checks

      setUploadState({ status: "uploading", message: "Saving template...", progress: 80 });
      const existing = JSON.parse(localStorage.getItem("lp_templates") || "[]");
      existing.push(parsedTemplate);
      localStorage.setItem("lp_templates", JSON.stringify(existing));

      setUploadState({
        status: "success",
        message: `Template saved! Found ${parsedTemplate.blocks.length} blocks and ${Object.keys(parsedTemplate.cssVariables).length} CSS variables.`,
        progress: 100,
      });
      onUploaded();
      setTimeout(() => handleReset(), 3500);
    } catch (err: any) {
      setUploadState({ status: "error", message: `Upload failed: ${err?.message || "Unknown error"}`, progress: 0 });
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
    setUploadState({ status: "idle", message: "", progress: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const isUploading = uploadState.status === "uploading";
  const isValidating = uploadState.status === "validating";

  const liveNameDup = findDuplicateByName(templateName);

  const canUpload =
    !!selectedFile &&
    !!templateName.trim() &&
    validation?.passed === true &&
    !isUploading &&
    !isValidating &&
    uploadState.status !== "success" &&
    !(!!fileDup && !fileOverride) && // blocked by file dup
    !(!!liveNameDup && !nameOverride); // blocked by name dup

  const sortedChecks = validation ? [...validation.checks].sort((a, b) => (!a.ok && b.ok ? -1 : a.ok && !b.ok ? 1 : 0)) : [];
  const visibleChecks = showAllChecks ? sortedChecks : sortedChecks.slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* HEADER */}
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600">
        <h3 className="text-base font-bold text-white">Upload Template</h3>
        <p className="text-xs text-indigo-200 mt-0.5">
          ZIP must contain a properly annotated <code className="bg-white/20 px-1 rounded">index.html</code>
        </p>
      </div>

      <div className="p-6 space-y-5">
        {/* TEMPLATE NAME */}
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

        {/* ✅ FILE CONTENT duplicate warning — shown right after file is picked */}
        {fileDup && !fileOverride && (
          <div className="bg-red-50 border-2 border-red-400 rounded-xl overflow-hidden">
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="text-2xl shrink-0">🚫</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-700">This file is already uploaded!</p>
                <p className="text-xs text-red-600 mt-1">This exact file content already exists as:</p>
                <div className="mt-1.5 px-3 py-2 bg-red-100 rounded-lg border border-red-200">
                  <p className="text-xs font-bold text-red-700">{fileDup.templateName}</p>
                  <p className="text-xs text-red-500">
                    {fileDup.category} · uploaded {fileDup.createdAt ?? "previously"}
                  </p>
                </div>
                <p className="text-xs text-red-500 mt-2">Choose a different file, or save as a new separate copy anyway.</p>
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

        {/* ✅ NAME duplicate warning */}
        {liveNameDup && !nameOverride && !fileDup && templateName.trim() && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl overflow-hidden">
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="text-xl shrink-0">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-800">Template name already exists!</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  A template named <span className="font-bold">"{liveNameDup.templateName}"</span> already exists in <span className="font-bold">{liveNameDup.category}</span>.
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
                }}
                className="flex-1 py-2 rounded-lg border-2 border-amber-400 text-amber-700 hover:bg-amber-100 text-xs font-bold transition"
              >
                ✏️ Rename Template
              </button>
            </div>
          </div>
        )}

        {/* CATEGORY */}
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1.5 uppercase tracking-wide">Category</label>
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
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {/* DROP ZONE */}
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
          <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

          {isValidating ? (
            <>
              <Loader2 size={36} className="text-indigo-400 animate-spin" />
              <p className="text-sm font-semibold text-indigo-600">Validating...</p>
            </>
          ) : fileDup && !fileOverride ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center">
                <XCircle size={28} className="text-red-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-red-600">{selectedFile?.name}</p>
                <p className="text-xs text-red-500 mt-0.5">🚫 Already uploaded — click to choose different file</p>
              </div>
            </>
          ) : selectedFile ? (
            <>
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center
                ${validation?.passed ? "bg-green-100" : validation ? "bg-red-100" : "bg-indigo-100"}`}
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

        {/* VALIDATION RESULTS */}
        {(isValidating || validation) && (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div
              className={`px-4 py-2.5 flex items-center justify-between
              ${validation?.passed ? "bg-green-50 border-b border-green-100" : validation ? "bg-red-50 border-b border-red-100" : "bg-gray-50 border-b border-gray-100"}`}
            >
              <div className="flex items-center gap-2">
                <Info size={13} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Validation Report</span>
              </div>
              {validation && (
                <div className="flex items-center gap-2">
                  {validation.errors > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">
                      {validation.errors} error{validation.errors !== 1 ? "s" : ""}
                    </span>
                  )}
                  {validation.warnings > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full">
                      {validation.warnings} warning{validation.warnings !== 1 ? "s" : ""}
                    </span>
                  )}
                  {validation.passed && validation.errors === 0 && <span className="text-xs bg-green-100 text-green-600 font-bold px-2 py-0.5 rounded-full">✓ Ready to upload</span>}
                </div>
              )}
            </div>
            <div className="p-3 space-y-1.5 bg-white">
              {isValidating ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                  <Loader2 size={13} className="animate-spin text-indigo-400" /> Running validation checks...
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
                          <ChevronDown size={12} /> Show {sortedChecks.length - 5} more checks
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* PROGRESS BAR */}
        {isUploading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium">{uploadState.message}</span>
              <span className="text-indigo-600 font-bold">{uploadState.progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500" style={{ width: `${uploadState.progress}%` }} />
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {uploadState.status === "success" && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
            <CheckCircle size={18} className="text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-700">Upload Successful!</p>
              <p className="text-xs text-green-600 mt-0.5">{uploadState.message}</p>
            </div>
          </div>
        )}

        {/* ERROR */}
        {uploadState.status === "error" && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
            <AlertCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-600">Upload Failed</p>
              <p className="text-xs text-red-500 mt-0.5">{uploadState.message}</p>
            </div>
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={!canUpload}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all duration-150
              ${!canUpload ? "bg-gray-300 cursor-not-allowed" : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 cursor-pointer"}`}
          >
            {isUploading ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Processing...
              </>
            ) : fileDup && !fileOverride ? (
              <>
                <XCircle size={15} /> Blocked — Duplicate File
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
          <button onClick={handleReset} className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            Reset
          </button>
        </div>

        {/* ZIP GUIDE */}
        <div className="rounded-xl border border-amber-100 bg-amber-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-amber-100 flex items-center gap-2">
            <AlertTriangle size={13} className="text-amber-500" />
            <p className="text-xs font-bold text-amber-700">Required ZIP structure</p>
          </div>
          <div className="px-3 py-2.5 space-y-1">
            <pre className="text-xs text-amber-700 font-mono leading-relaxed">
              {`template.zip
├── index.html          ← must have data-block, data-editable
└── public/
  ├── style.css       ← must have :root { --vars }
  ├── main.js
  └── ...`}
            </pre>
            <div className="pt-1.5 border-t border-amber-100 space-y-1">
              <p className="text-xs font-bold text-amber-600">Required HTML attributes:</p>
              {[
                ["data-block", 'On each section: data-block="hero"'],
                ["data-editable", 'On editable elements: data-editable="hero-title"'],
                ["data-editable-type", 'Type of field: "text" | "image" | "link"'],
                [":root vars", "CSS variables in <style>: --primary: #6366f1"],
              ].map(([attr, desc]) => (
                <div key={attr} className="flex items-start gap-2 text-xs">
                  <code className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-mono shrink-0">{attr}</code>
                  <span className="text-amber-600">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
