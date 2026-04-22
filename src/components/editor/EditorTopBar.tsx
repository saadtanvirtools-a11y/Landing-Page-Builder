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
}

// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────

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

  // ✅ Confirm before leaving editor
  const handleBackToDashboard = () => {
    const confirmLeave = confirm("Are you sure you want to leave? Unsaved changes may be lost.");

    if (!confirmLeave) return;

    // Optional auto-save before leaving
    if (user?.id) {
      saveToStorage(user.id);
    }

    navigate("/dashboard");
  };

  const handlePreview = () => {
    if (!hasBlocks) return;

    if (user?.id && currentTemplate) {
      const latestState = useEditorStore.getState();

      const snapshot = {
        currentTemplate: latestState.currentTemplate,
        canvasBlocks: latestState.canvasBlocks,
        pageScripts: latestState.pageScripts,
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(`editor_save_${user.id}`, JSON.stringify(snapshot));
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
    <div className="h-14 bg-white border-b border-gray-100 shadow-sm flex items-center justify-between px-4">

      {/* LEFT */}
      <div className="flex items-center gap-3">

        {/* ✅ BACK BUTTON */}
        <button
          onClick={handleBackToDashboard}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold 
                     text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 
                     rounded-lg transition-all group"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="group-hover:-translate-x-1 transition-transform"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>

          <span>Back to Dashboard</span>
        </button>

        <div className="w-px h-5 bg-gray-200" />

        <div>
          <p className="text-sm font-bold text-gray-800">Page Editor</p>
          <p className="text-xs text-gray-400">{currentTemplate?.templateName}</p>
        </div>

        <span className="hidden md:inline text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
          {blockCount} blocks
        </span>
      </div>

      {/* CENTER */}
      <div className="hidden md:flex items-center gap-2">
        <StatusDot saving={isSaving} />
        <span className="text-xs text-gray-400">
          {isSaving ? "Saving..." : formatSaved(lastSaved)}
        </span>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2">

        <button
          onClick={handlePreview}
          disabled={!hasBlocks}
          className="px-3 py-1.5 text-xs border rounded-lg"
        >
          Preview
        </button>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-3 py-1.5 text-xs border rounded-lg"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>

        <button
          onClick={handleExport}
          className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg"
        >
          {exported ? "Exported!" : "Export"}
        </button>

      </div>
    </div>
  );
}