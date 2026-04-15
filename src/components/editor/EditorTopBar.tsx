import { useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import { useAuthStore } from "../../store/authStore";
import { useNavigate } from "react-router-dom";
import type { Template } from "../../types";

function exportTemplate(template: Template): void {
  const EDITOR_ATTRS = [
    "data-editable",
    "data-editable-type",
    "data-style-id",
    "data-style-layer",
    "data-style-props",
    "data-color-vars",
    "data-block",
    "data-block-name",
    "data-block-order",
    "data-block-removable",
    "data-block-item",
  ];

  const parser = new DOMParser();
  const doc = parser.parseFromString(template.rawHtml, "text/html");

  EDITOR_ATTRS.forEach((attr) => {
    doc.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr));
  });

  doc.querySelectorAll("[data-tpl-styles]").forEach((el) => {
    const parent = el.parentElement;
    if (parent) {
      Array.from(el.children).forEach((child) => parent.insertBefore(child, el));
      el.remove();
    }
  });

  doc.querySelectorAll('link[href*="./public/"], link[href*="public/"], link[href*="style.css"]').forEach((el) => el.remove());
  doc.querySelectorAll("style#lp-css-vars").forEach((el) => el.remove());

  const head = doc.head || doc.createElement("head");
  if (!doc.head) {
    const htmlEl = doc.documentElement || doc.createElement("html");
    htmlEl.prepend(head);
    if (!doc.documentElement) {
      doc.appendChild(htmlEl);
    }
  }

  let titleEl = head.querySelector("title");
  if (!titleEl) {
    titleEl = doc.createElement("title");
    head.prepend(titleEl);
  }
  if (!titleEl.textContent?.trim()) {
    titleEl.textContent = template.templateName || "Exported Page";
  }

  if (!head.querySelector('meta[name="viewport"]')) {
    const viewport = doc.createElement("meta");
    viewport.setAttribute("name", "viewport");
    viewport.setAttribute("content", "width=device-width, initial-scale=1.0");
    head.appendChild(viewport);
  }

  if (!head.querySelector('script[src*="cdn.tailwindcss.com"]')) {
    const tailwindScript = doc.createElement("script");
    tailwindScript.setAttribute("src", "https://cdn.tailwindcss.com");
    head.appendChild(tailwindScript);

    const configScript = doc.createElement("script");
    configScript.textContent = `tailwind.config = {
      theme: {
        extend: {
          animation: { marquee: \"marquee 20s linear infinite\" },
          keyframes: {
            marquee: {
              \"0%\":   { transform: \"translateX(0%)\" },
              \"100%\": { transform: \"translateX(-50%)\" },
            },
          },
        },
      },
    };`;
    head.appendChild(configScript);
  }

  const cssVarLines = Object.entries(template.cssVariables)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  const cssVarStyle = doc.createElement("style");
  cssVarStyle.id = "lp-css-vars";
  cssVarStyle.textContent = `:root {\n${cssVarLines}\n}`;
  head.appendChild(cssVarStyle);

  const body = doc.body || doc.createElement("body");
  if (!doc.body) {
    const htmlEl = doc.documentElement;
    htmlEl.appendChild(body);
  }

  const finalHtml = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;

  const blob = new Blob([finalHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fileName = (template.templateName || "export")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  a.href = url;
  a.download = `${fileName}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log(`[export] ✅ ${fileName}.html — ${finalHtml.length} chars`);
}

function StatusDot({ saving }: { saving: boolean }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {saving ? (
        <>
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
        </>
      ) : (
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      )}
    </span>
  );
}
export default function EditorTopBar() {
  const { currentTemplate, canvasBlocks, lastSaved, isSaving, saveToStorage } = useEditorStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [exported, setExported] = useState(false);

  const hasBlocks = (currentTemplate?.blocks?.length ?? canvasBlocks.length) > 0;
  const blockCount = currentTemplate?.blocks?.length ?? canvasBlocks.length;

  const handleSave = () => {
    if (user?.id) saveToStorage(user.id);
  };

  // ✅ THE FIX: Save SYNCHRONOUSLY to localStorage, then navigate
  // Do NOT use saveToStorage() — it has a 400ms setTimeout that
  // gets cancelled when the component unmounts on navigate()
  const handlePreview = () => {
    if (!hasBlocks) return;

    console.log("=== [PREVIEW CLICK] ===");
    console.log("[Preview] user.id:", user?.id);
    console.log("[Preview] currentTemplate.id:", currentTemplate?.id);
    console.log("[Preview] blocks:", currentTemplate?.blocks?.length);
    console.log("[Preview] cssVars:", JSON.stringify(currentTemplate?.cssVariables));

    if (user?.id && currentTemplate) {
      try {
        // Get the LATEST state directly from store (not from React closure)
        const latestState = useEditorStore.getState();
        const tpl = latestState.currentTemplate;

        console.log("[Preview] latestState.tpl.id:", tpl?.id);
        console.log("[Preview] latestState cssVars:", JSON.stringify(tpl?.cssVariables));

        const snapshot = {
          currentTemplate: tpl
            ? {
                ...tpl,
                blocks: tpl.blocks.map((b) => ({ ...b, styles: b.styles ?? {} })),
              }
            : null,
          canvasBlocks: latestState.canvasBlocks,
          pageScripts: latestState.pageScripts,
          savedAt: new Date().toISOString(),
        };

        const serialized = JSON.stringify(snapshot);
        console.log("[Preview] Saving", serialized.length, "chars to editor_save_" + user.id);

        localStorage.setItem(`editor_save_${user.id}`, serialized);

        // ── VERIFY it was actually written ──────────────────────
        const verify = localStorage.getItem(`editor_save_${user.id}`);
        const verifyParsed = verify ? JSON.parse(verify) : null;
        console.log("[Preview] ✅ VERIFY saved.id:", verifyParsed?.currentTemplate?.id);
        console.log("[Preview] ✅ VERIFY cssVars:", JSON.stringify(verifyParsed?.currentTemplate?.cssVariables));
        console.log("[Preview] ✅ VERIFY blocks:", verifyParsed?.currentTemplate?.blocks?.length);
      } catch (e) {
        console.error("[Preview] ❌ Save FAILED:", e);
      }
    } else {
      console.warn("[Preview] ⚠️ Skipped save — user.id:", user?.id, "| template:", !!currentTemplate);
    }

    navigate("/preview", {
      state: { templateId: currentTemplate?.id ?? null },
    });
  };

  const handleExport = () => {
    if (!currentTemplate) return;
    exportTemplate(currentTemplate);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  const formatSaved = (iso: string | null) => {
    if (!iso) return "Not saved yet";
    return `Saved ${new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div className="h-14 bg-white border-b border-gray-100 shadow-sm flex items-center justify-between px-4 flex-shrink-0 z-10">
      {/* LEFT */}
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-indigo-600 transition-colors group">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:-translate-x-0.5 transition-transform">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          <span className="hidden sm:inline">Dashboard</span>
        </button>
        <div className="w-px h-5 bg-gray-200 shrink-0" />
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M3 9h18M9 21V9" />
            </svg>
          </div>
          <div className="hidden sm:block min-w-0">
            <p className="text-sm font-bold text-gray-800 leading-tight">Page Editor</p>
            <p className="text-xs text-gray-400 leading-tight truncate max-w-36">{currentTemplate?.templateName ?? "No template loaded"}</p>
          </div>
        </div>
        <span className="hidden md:inline-flex items-center gap-1 text-xs font-semibold bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          {blockCount} block{blockCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* CENTER */}
      <div className="hidden md:flex items-center gap-2">
        <StatusDot saving={isSaving} />
        <span className={`text-xs font-medium transition-colors ${isSaving ? "text-amber-500" : "text-gray-400"}`}>{isSaving ? "Saving changes…" : formatSaved(lastSaved)}</span>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePreview}
          disabled={!hasBlocks}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                     text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50
                     hover:border-gray-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Preview
        </button>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600
                     border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300
                     transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Saving…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Save
            </>
          )}
        </button>

        <button
          onClick={handleExport}
          disabled={!hasBlocks || !currentTemplate}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg
            transition-all duration-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              exported ? "bg-emerald-500 text-white scale-95" : "bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700"
            }`}
        >
          {exported ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Exported!
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export HTML
            </>
          )}
        </button>
      </div>
    </div>
  );
}
