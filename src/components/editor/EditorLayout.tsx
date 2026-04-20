import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useEditorStore } from "../../store/editorStore";
import BlockPanel from "../../components/editor/BlockPanel";
import Canvas from "../../components/editor/Canvas";
import PropertiesPanel from "../../components/editor/PropertiesPanel";
import { db } from "../../firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import type { BlockOption } from "../../components/editor/BlockPanel";
import {
  isPanelDrag, parseDragId,
  isStandaloneDrag, parseStandaloneDragId,
} from "../../components/editor/BlockPanel";
import type { Template, StandaloneBlock } from "../../types";

// ─────────────────────────────────────────────────────────────
// Drag overlay card
// ─────────────────────────────────────────────────────────────
function DragOverlayCard({
  option,
  standaloneBlock,
}: {
  option: BlockOption | null;
  standaloneBlock: StandaloneBlock | null;
}) {
  if (option) {
    return (
      <div className="w-48 rounded-xl border-2 border-indigo-500 bg-white shadow-2xl px-3 py-2.5 rotate-1 opacity-95 pointer-events-none">
        <div className="text-xs font-bold text-indigo-600 truncate">{option.variantLabel}</div>
        <div className="text-xs text-gray-400 truncate mt-0.5">{option.sourceTemplateName}</div>
        <div className="mt-2 text-center text-lg">➕</div>
      </div>
    );
  }
  if (standaloneBlock) {
    return (
      <div className="w-48 rounded-xl border-2 border-green-500 bg-white shadow-2xl px-3 py-2.5 rotate-1 opacity-95 pointer-events-none">
        <div className="text-xs font-bold text-green-600 truncate">{standaloneBlock.blockName}</div>
        <div className="text-xs text-gray-400 truncate mt-0.5">🧩 Standalone block</div>
        <div className="mt-2 text-center text-lg">➕</div>
      </div>
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Convert StandaloneBlock → ParsedBlock for addBlockToTemplate
// ─────────────────────────────────────────────────────────────
function standaloneToParseBlock(block: StandaloneBlock) {
  return {
    blockId           : block.blockType,
    blockName         : block.blockName,
    blockOrder        : 0,
    rawHtml           : block.rawHtml,
    editables         : block.editables ?? [],
    colorVars         : {},
    cssVariables      : block.cssVariables ?? {},
    sourceTemplateId  : `standalone::${block.id}`,
    sourceTemplateName: "Standalone",
  };
}

const BLOCK_LABELS: Record<string, string> = {
  hero          : "Hero",
  features      : "Features",
  footer        : "Footer",
  navbar        : "Navbar",
  pricing       : "Pricing",
  faq           : "FAQ",
  testimonials  : "Testimonials",
  cta           : "CTA",
  "cta-banner"  : "CTA Banner",
  benefits      : "Benefits",
  contact       : "Contact",
  "how-it-works": "How It Works",
};

// ─────────────────────────────────────────────────────────────
// Build grouped blocks from Firestore templates
// ─────────────────────────────────────────────────────────────
function buildGroupedBlocksFromTemplates(
  templates: Template[],
  assignedTemplateId: string | null,
): Record<string, BlockOption[]> {
  const filtered = assignedTemplateId
    ? templates.filter((t) => t.id === assignedTemplateId)
    : templates;

  const groups: Record<string, BlockOption[]> = {};
  const countPerType: Record<string, number>  = {};

  filtered.forEach((template) => {
    template.blocks.forEach((block) => {
      if (!groups[block.blockId]) groups[block.blockId] = [];
      countPerType[block.blockId] = (countPerType[block.blockId] || 0) + 1;
      const label = BLOCK_LABELS[block.blockId] ?? block.blockId;
      groups[block.blockId].push({
        block,
        sourceTemplateId  : template.id,
        sourceTemplateName: template.templateName,
        templateRawHtml   : template.rawHtml,
        variantLabel      : `${label} ${countPerType[block.blockId]}`,
      });
    });
  });
  return groups;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function EditorLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const assignedTemplateId = user?.assignedTemplateId ?? null;

  const {
    lastSaved, isSaving, templateName,
    currentTemplate, selectedBlockId,
    saveToStorage, loadFromStorage, loadTemplate,
    resetEditor, addBlockToTemplate,
    updateEditable, updateCssVar, updateClassSwap, updateBlockStyle,
  } = useEditorStore();

  const [draggingOption,     setDraggingOption]     = useState<BlockOption | null>(null);
  const [draggingStandalone, setDraggingStandalone] = useState<StandaloneBlock | null>(null);
  const [exported,           setExported]           = useState(false);

  // ✅ Firestore data cached in state for drag operations
  const [firestoreTemplates,       setFirestoreTemplates]       = useState<Template[]>([]);
  const [firestoreStandaloneBlocks, setFirestoreStandaloneBlocks] = useState<StandaloneBlock[]>([]);

  const activeDropZoneRef = useRef<string | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<string | null>(null);

  const updateDropZone = useCallback((id: string | null) => {
    activeDropZoneRef.current = id;
    setActiveDropZone(id);
  }, []);

  const lastPointerPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => { lastPointerPos.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // ✅ Load editor save from localStorage on mount
  useEffect(() => {
    if (user?.id) loadFromStorage(user.id);
  }, [user?.id]);

  // ✅ Load templates + standalone blocks from Firestore (for drag operations)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tplSnap, blkSnap] = await Promise.all([
          getDocs(collection(db, "templates")),
          getDocs(collection(db, "blocks")),
        ]);
        setFirestoreTemplates(tplSnap.docs.map((d) => d.data() as Template));
        setFirestoreStandaloneBlocks(blkSnap.docs.map((d) => d.data() as StandaloneBlock));
      } catch (err) {
        console.error("[EditorLayout] Failed to load Firestore data:", err);
      }
    };
    fetchData();
  }, []);

  // ✅ Ensure currentTemplate matches assignedTemplateId — fetch from Firestore
  useEffect(() => {
    if (!assignedTemplateId) return;
    if (currentTemplate?.id === assignedTemplateId) return;

    getDoc(doc(db, "templates", assignedTemplateId))
      .then((snap) => {
        if (snap.exists()) {
          loadTemplate(snap.data() as Template);
        } else {
          console.warn("[EditorLayout] Assigned template not found in Firestore:", assignedTemplateId);
        }
      })
      .catch((err) => console.error("[EditorLayout] Failed to load assigned template:", err));
  }, [assignedTemplateId, currentTemplate?.id, loadTemplate]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const canvasBlockIds = useMemo(
    () =>
      (currentTemplate?.blocks ?? []).map((b) =>
        b.sourceTemplateId?.startsWith("standalone::")
          ? b.sourceTemplateId
          : b.blockId + "::" + b.sourceTemplateId,
      ),
    [currentTemplate?.blocks],
  );

  // ── Drag Start ───────────────────────────────────────────
  const handleDragStart = useCallback(
    (e: DragStartEvent) => {
      const id = String(e.active.id);

      if (isPanelDrag(id)) {
        // ✅ Use Firestore templates (cached in state)
        const groups = buildGroupedBlocksFromTemplates(firestoreTemplates, assignedTemplateId);
        const { blockId, sourceTemplateId } = parseDragId(id);
        const found = (groups[blockId] || []).find((o) => o.sourceTemplateId === sourceTemplateId);
        setDraggingOption(found ?? null);
        setDraggingStandalone(null);
        updateDropZone(null);
        return;
      }

      if (isStandaloneDrag(id)) {
        // ✅ Use Firestore standalone blocks (cached in state)
        const { standaloneId } = parseStandaloneDragId(id);
        const found = firestoreStandaloneBlocks.find((b) => b.id === standaloneId);
        setDraggingStandalone(found ?? null);
        setDraggingOption(null);
        updateDropZone(null);
      }
    },
    [updateDropZone, assignedTemplateId, firestoreTemplates, firestoreStandaloneBlocks],
  );

  // ── Drag Over ────────────────────────────────────────────
  const handleDragOver = useCallback(
    (e: DragOverEvent) => {
      const overId = e.over?.id ? String(e.over.id) : null;
      if (overId !== activeDropZoneRef.current) updateDropZone(overId);
    },
    [updateDropZone],
  );

  // ── Drag End ─────────────────────────────────────────────
  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const activeId      = String(e.active.id);
      const lastKnownZone = activeDropZoneRef.current;
      const dndKitOverId  = e.over?.id ? String(e.over.id) : null;
      const overId        = dndKitOverId ?? lastKnownZone;

      setDraggingOption(null);
      setDraggingStandalone(null);
      updateDropZone(null);

      const doAdd = (parsedBlock: any) => {
        if (overId === "drop-before-0") {
          addBlockToTemplate(parsedBlock, -1);
        } else if (overId?.startsWith("drop-after-")) {
          const idx = parseInt(overId.replace("drop-after-", ""), 10);
          addBlockToTemplate(parsedBlock, isNaN(idx) ? undefined : idx);
        } else {
          addBlockToTemplate(parsedBlock, undefined);
        }
      };

      if (isPanelDrag(activeId)) {
        // ✅ Use Firestore templates (cached in state)
        const { blockId, sourceTemplateId } = parseDragId(activeId);
        const groups = buildGroupedBlocksFromTemplates(firestoreTemplates, assignedTemplateId);
        const option = (groups[blockId] || []).find((o) => o.sourceTemplateId === sourceTemplateId);
        if (!option) {
          console.error("[DragEnd] ❌ Template block not found:", blockId);
          return;
        }
        doAdd({
          ...option.block,
          sourceTemplateId  : option.sourceTemplateId,
          sourceTemplateName: option.sourceTemplateName,
        });
        return;
      }

      if (isStandaloneDrag(activeId)) {
        // ✅ Use Firestore standalone blocks (cached in state)
        const { standaloneId } = parseStandaloneDragId(activeId);
        const found = firestoreStandaloneBlocks.find((b) => b.id === standaloneId);
        if (!found) {
          console.error("[DragEnd] ❌ Standalone block not found:", standaloneId);
          return;
        }
        doAdd(standaloneToParseBlock(found));
      }
    },
    [addBlockToTemplate, updateDropZone, assignedTemplateId, firestoreTemplates, firestoreStandaloneBlocks],
  );

  // ── Auto-save every 30s ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => saveToStorage(user.id), 30_000);
    return () => clearInterval(t);
  }, [user]);

  const handleSave    = () => { if (user) saveToStorage(user.id); };
  const handleReset   = () => { if (confirm("Reset canvas? All unsaved changes will be lost.")) resetEditor(); };
  const handleLogout  = () => { logout(); navigate("/login"); };

  const handlePreview = () => {
    if (!currentTemplate?.blocks?.length) return;
    if (user?.id && currentTemplate) {
      const latestState = useEditorStore.getState();
      const tpl         = latestState.currentTemplate;
      const snapshot    = {
        currentTemplate: tpl ? { ...tpl, blocks: tpl.blocks.map((b) => ({ ...b, styles: b.styles ?? {} })) } : null,
        canvasBlocks   : latestState.canvasBlocks,
        pageScripts    : latestState.pageScripts,
        savedAt        : new Date().toISOString(),
      };
      localStorage.setItem(`editor_save_${user.id}`, JSON.stringify(snapshot));
    }
    navigate("/preview", { state: { templateId: currentTemplate?.id ?? null } });
  };

  const buildExportHtml = (template: Template): string => {
    const EDITOR_ATTRS = [
      "data-editable", "data-editable-type", "data-style-id", "data-style-layer",
      "data-style-props", "data-color-vars", "data-block", "data-block-name",
      "data-block-order", "data-block-removable", "data-block-item",
    ];
    const parser = new DOMParser();
    const doc2   = parser.parseFromString(template.rawHtml, "text/html");
    EDITOR_ATTRS.forEach((attr) => {
      doc2.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr));
    });
    doc2.querySelectorAll("[data-tpl-styles]").forEach((el) => {
      const parent = el.parentElement;
      if (parent) { Array.from(el.children).forEach((child) => parent.insertBefore(child, el)); el.remove(); }
    });
    const head = doc2.head || doc2.createElement("head");
    if (!doc2.head) { const htmlEl = doc2.documentElement || doc2.createElement("html"); htmlEl.prepend(head); if (!doc2.documentElement) doc2.appendChild(htmlEl); }
    let titleEl = head.querySelector("title");
    if (!titleEl) { titleEl = doc2.createElement("title"); head.prepend(titleEl); }
    if (!titleEl.textContent?.trim()) titleEl.textContent = template.templateName || "Exported Page";
    if (!head.querySelector('meta[name="viewport"]')) {
      const viewport = doc2.createElement("meta");
      viewport.setAttribute("name", "viewport");
      viewport.setAttribute("content", "width=device-width, initial-scale=1.0");
      head.appendChild(viewport);
    }
    if (!head.querySelector('script[src*="cdn.tailwindcss.com"]')) {
      const tailwindScript = doc2.createElement("script");
      tailwindScript.setAttribute("src", "https://cdn.tailwindcss.com");
      head.appendChild(tailwindScript);
    }
    const cssVarLines = Object.entries(template.cssVariables || {}).map(([k, v]) => `  ${k}: ${v};`).join("\n");
    let cssVarStyle = head.querySelector("style#lp-css-vars");
    if (!cssVarStyle) { cssVarStyle = doc2.createElement("style"); cssVarStyle.id = "lp-css-vars"; head.appendChild(cssVarStyle); }
    cssVarStyle.textContent = `:root {\n${cssVarLines}\n}`;
    if (!doc2.body) { const htmlEl = doc2.documentElement; const body = doc2.createElement("body"); while (htmlEl.firstChild) body.appendChild(htmlEl.firstChild); htmlEl.appendChild(body); }
    return `<!DOCTYPE html>\n${doc2.documentElement.outerHTML}`;
  };

  const handleExport = () => {
    if (!currentTemplate) return;
    const html = buildExportHtml(currentTemplate);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const fileName = (currentTemplate.templateName || "export").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    a.href = url; a.download = `${fileName}.html`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    setExported(true); setTimeout(() => setExported(false), 2500);
  };

  const resolveLiveColor = useCallback(
    (varName: string): string => {
      if (!currentTemplate) return "#ffffff";
      const fromStore = currentTemplate.cssVariables?.[varName];
      if (fromStore && fromStore.trim() !== "") return fromStore.trim();
      if (currentTemplate.rawHtml) {
        const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match   = currentTemplate.rawHtml.match(new RegExp(escaped + "\\s*:\\s*([^;\\n\\r}]+)"));
        if (match?.[1]?.trim()) return match[1].trim();
      }
      return "#ffffff";
    },
    [currentTemplate],
  );

  const handleCssVarChange = useCallback((varName: string, value: string) => updateCssVar(varName, value),    [updateCssVar]);
  const handleClassSwap    = useCallback((editableId: string, newClass: string) => updateClassSwap(editableId, newClass), [updateClassSwap]);

  const selectedBlock = currentTemplate?.blocks.find((b) => b.blockId === selectedBlockId) ?? null;
  const hasBlocks     = (currentTemplate?.blocks?.length ?? 0) > 0;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen overflow-hidden bg-gray-50">

        {/* ── NAV ── */}
        <nav className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between flex-shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">LP</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-gray-800 text-sm leading-none truncate max-w-xs">{templateName ?? "Landing Page Builder"}</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {currentTemplate
                  ? `${currentTemplate.blocks.length} section${currentTemplate.blocks.length !== 1 ? "s" : ""}`
                  : "Drag blocks from the left panel to start"}
              </p>
            </div>
          </div>

          <div className="text-xs text-gray-400 hidden md:block">
            {isSaving ? "💾 Saving..." : lastSaved ? `✅ Saved ${new Date(lastSaved).toLocaleTimeString()}` : "⬜ Not saved yet"}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleReset} className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-500 transition font-medium">Reset</button>

            <button onClick={handlePreview} disabled={!hasBlocks}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
              Preview
            </button>

            <button onClick={handleSave} disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>
              {isSaving ? "Saving..." : "Save"}
            </button>

            <button onClick={handleExport} disabled={!hasBlocks || !currentTemplate}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed
                ${exported ? "bg-emerald-500 text-white" : "bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700"}`}>
              {exported ? (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>Exported!</>
              ) : (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>Export HTML/CSS</>
              )}
            </button>

            <div className="flex items-center gap-2 ml-1 pl-2 border-l border-gray-100">
              <span className="text-xs text-gray-500 hidden sm:inline">{user?.name}</span>
              <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-500 transition">Logout</button>
            </div>
          </div>
        </nav>

        {/* ── 3-panel layout ── */}
        <div className="flex flex-1 overflow-hidden">
          <BlockPanel
            draggingOption={draggingOption}
            canvasBlockIds={canvasBlockIds}
            assignedTemplateId={assignedTemplateId}
          />
          <Canvas draggingOption={draggingOption} activeDropZone={activeDropZone} />
          <PropertiesPanel
            selectedBlock={selectedBlock}
            template={currentTemplate}
            onEditableChange={updateEditable}
            onCssVarChange={handleCssVarChange}
            onClassSwap={handleClassSwap}
            onBlockStyleChange={updateBlockStyle}
            resolveLiveColor={resolveLiveColor}
          />
        </div>
      </div>

      <DragOverlay modifiers={[restrictToWindowEdges]}>
        <DragOverlayCard option={draggingOption} standaloneBlock={draggingStandalone} />
      </DragOverlay>
    </DndContext>
  );
}