import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useAuthStore } from "../../store/authStore";
import { db } from "../../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import type { ParsedBlock, Template, StandaloneBlock } from "../../types";

// ── Block meta ─────────────────────────────────────────────
const BLOCK_META: Record<string, { label: string; icon: string }> = {
  hero: { label: "Hero", icon: "🦸" },
  features: { label: "Features", icon: "⚡" },
  benefits: { label: "Benefits", icon: "✅" },
  faq: { label: "FAQ", icon: "❓" },
  testimonials: { label: "Testimonials", icon: "💬" },
  cta: { label: "CTA", icon: "🎯" },
  "cta-banner": { label: "CTA Banner", icon: "🎯" },
  footer: { label: "Footer", icon: "🔗" },
  navbar: { label: "Navbar", icon: "🔝" },
  pricing: { label: "Pricing", icon: "💰" },
  contact: { label: "Contact", icon: "📬" },
  "how-it-works": { label: "How It Works", icon: "🔄" },
  other: { label: "Other", icon: "📦" },
};

// ── BlockOption (from template) ────────────────────────────
export interface BlockOption {
  block: ParsedBlock;
  sourceTemplateId: string;
  sourceTemplateName: string;
  templateRawHtml: string;
  variantLabel: string;
}

// ── Drag ID helpers ────────────────────────────────────────
export function makeDragId(blockId: string, sourceTemplateId: string) {
  return `PANEL::${blockId}::${sourceTemplateId}`;
}
export function parseDragId(id: string) {
  const parts = id.split("::");
  return { blockId: parts[1], sourceTemplateId: parts[2] };
}
export function isPanelDrag(id: string) {
  return id.startsWith("PANEL::");
}
export function makeStandaloneDragId(blockId: string) {
  return `STANDALONE::${blockId}`;
}
export function isStandaloneDrag(id: string) {
  return id.startsWith("STANDALONE::");
}
export function parseStandaloneDragId(id: string) {
  return { standaloneId: id.replace("STANDALONE::", "") };
}

// ── Build preview doc (template block) ────────────────────
function buildPreviewDoc(blockHtml: string, templateFullHtml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(templateFullHtml, "text/html");
  const styleTags = Array.from(doc.querySelectorAll("style"))
    .map((s) => s.outerHTML)
    .join("\n");
  const linkTags = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
    .map((l) => l.outerHTML)
    .join("\n");

  return `<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8"/>
  <style>*,*::before,*::after{box-sizing:border-box;}
  html,body{margin:0;padding:0;overflow:hidden;width:1280px;min-width:1280px;}</style>
  ${linkTags}${styleTags}
  <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body style="width:1280px;min-width:1280px;margin:0;padding:0;">${blockHtml}</body>
</html>`;
}

// ── Build preview doc (standalone block) ──────────────────
function buildStandalonePreviewDoc(block: StandaloneBlock): string {
  const cssVarBlock = Object.entries(block.cssVariables)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  return `<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8"/>
  <style>*,*::before,*::after{box-sizing:border-box;}
  html,body{margin:0;padding:0;overflow:hidden;width:1280px;min-width:1280px;}
  :root{${cssVarBlock}}</style>
  <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body style="width:1280px;min-width:1280px;margin:0;padding:0;">${block.rawHtml}</body>
</html>`;
}

// ── Mini iframe preview ────────────────────────────────────
function BlockMiniPreview({ srcDoc }: { srcDoc: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.165);
  const [contentHeight, setContentHeight] = useState(300);
  const [loaded, setLoaded] = useState(false);

  const computeScale = useCallback(() => {
    if (wrapperRef.current) {
      const w = wrapperRef.current.getBoundingClientRect().width;
      if (w > 0) setScale(w / 1280);
    }
  }, []);

  useEffect(() => {
    computeScale();
    const ro = new ResizeObserver(computeScale);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [computeScale]);

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const measure = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) {
          setLoaded(true);
          return;
        }
        const h = Math.max(
          doc.body.scrollHeight,
          doc.body.offsetHeight,
          doc.documentElement.scrollHeight,
          doc.documentElement.offsetHeight
        );
        if (h > 10) {
          setContentHeight(h);
          setLoaded(true);
        }
      } catch {
        setLoaded(true);
      }
    };

    const t1 = setTimeout(measure, 300);
    const t2 = setTimeout(measure, 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="w-full rounded-xl overflow-hidden relative bg-slate-100 border border-slate-200"
      style={{ height: Math.round(contentHeight * scale) || 70, opacity: loaded ? 1 : 0, transition: "opacity 0.3s" }}
    >
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        title="preview"
        scrolling="no"
        onLoad={handleLoad}
        className="absolute top-0 left-0 border-0"
        style={{
          width: "1280px",
          height: `${contentHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
        sandbox="allow-scripts allow-same-origin"
      />

      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 animate-pulse rounded-xl" />
      )}
    </div>
  );
}

// ── Template block card ────────────────────────────────────
function DraggableBlockCard({
  option,
  blockId,
  isOnCanvas,
}: {
  option: BlockOption;
  blockId: string;
  isOnCanvas: boolean;
}) {
  const dragId = makeDragId(blockId, option.sourceTemplateId);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId });

  const srcDoc = useMemo(
    () => buildPreviewDoc(option.block.rawHtml, option.templateRawHtml),
    [option.block.rawHtml, option.templateRawHtml]
  );

  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-2xl border transition-all group overflow-hidden shadow-[0_4px_14px_rgba(15,23,42,0.04)]
        ${
          isDragging
            ? "opacity-40 scale-95 border-indigo-300 bg-indigo-50"
            : isOnCanvas
              ? "border-emerald-300 bg-emerald-50/60"
              : "border-slate-200 bg-white hover:border-indigo-200 hover:shadow-[0_10px_24px_rgba(99,102,241,0.10)]"
        }`}
    >
      {isOnCanvas && (
        <div className="absolute top-2 left-2 z-10 bg-emerald-500 text-white text-[11px] px-2 py-0.5 rounded-full font-semibold shadow">
          ✓ On Canvas
        </div>
      )}

      {!isOnCanvas && (
        <div className="absolute top-2 left-2 z-10 bg-indigo-100 text-indigo-600 text-[11px] px-2 py-0.5 rounded-full font-semibold border border-indigo-200 leading-tight">
          📄 Template
        </div>
      )}

      <div
        {...listeners}
        {...attributes}
        className="absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing p-1.5 rounded-xl bg-white/90 hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to canvas"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="4" cy="3" r="1.2" />
          <circle cx="10" cy="3" r="1.2" />
          <circle cx="4" cy="7" r="1.2" />
          <circle cx="10" cy="7" r="1.2" />
          <circle cx="4" cy="11" r="1.2" />
          <circle cx="10" cy="11" r="1.2" />
        </svg>
      </div>

      <div className="p-2.5">
        <BlockMiniPreview srcDoc={srcDoc} />

        <div className="flex items-center justify-between mt-3 px-0.5 gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{option.variantLabel}</p>
            <p className="text-[11px] text-slate-400 truncate max-w-[130px]">{option.sourceTemplateName}</p>
          </div>

          <div className="flex items-center gap-1 text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
            <span className="text-[11px]">drag</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Standalone block card ──────────────────────────────────
function StandaloneBlockCard({
  block,
  isOnCanvas,
}: {
  block: StandaloneBlock;
  isOnCanvas: boolean;
}) {
  const { user } = useAuthStore();

  const isLocked = (() => {
    if (block.tier === "free") return false;
    if (block.tier === "premium") return true;
    if (block.tier === "custom") {
      if (user?.role === "admin") return false;
      return !(block.allowedUserIds ?? []).includes(user?.id ?? "");
    }
    return false;
  })();

  const dragId = makeStandaloneDragId(block.id);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    disabled: isLocked,
  });

  const srcDoc = useMemo(() => buildStandalonePreviewDoc(block), [block]);

  const lockLabel =
    block.tier === "premium"
      ? { icon: "🔒", title: "Premium", sub: "Upgrade to unlock" }
      : { icon: "🔒", title: "Restricted", sub: "No access" };

  const tierBadge =
    block.tier === "free"
      ? { label: "🆓 Free", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" }
      : block.tier === "custom"
        ? { label: "👤 Custom", cls: "bg-indigo-100 text-indigo-700 border-indigo-200" }
        : { label: "🔒 Premium", cls: "bg-amber-100 text-amber-700 border-amber-200" };

  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-2xl border transition-all group overflow-hidden shadow-[0_4px_14px_rgba(15,23,42,0.04)]
        ${
          isDragging
            ? "opacity-40 scale-95 border-indigo-300 bg-indigo-50"
            : isLocked
              ? "border-amber-200 bg-amber-50/50"
              : isOnCanvas
                ? "border-emerald-300 bg-emerald-50/60"
                : "border-slate-200 bg-white hover:border-indigo-200 hover:shadow-[0_10px_24px_rgba(99,102,241,0.10)]"
        }`}
    >
      {isLocked && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-amber-50/85 backdrop-blur-[1px] rounded-2xl cursor-not-allowed">
          <span className="text-2xl mb-1">{lockLabel.icon}</span>
          <p className="text-xs font-bold text-amber-700">{lockLabel.title}</p>
          <p className="text-xs text-amber-500 mt-0.5">{lockLabel.sub}</p>
        </div>
      )}

      {isOnCanvas && !isLocked && (
        <div className="absolute top-2 left-2 z-10 bg-emerald-500 text-white text-[11px] px-2 py-0.5 rounded-full font-semibold shadow">
          ✓ On Canvas
        </div>
      )}

      {!isOnCanvas && (
        <div className={`absolute top-2 left-2 z-10 text-[11px] px-2 py-0.5 rounded-full font-semibold border leading-tight ${tierBadge.cls}`}>
          {tierBadge.label}
        </div>
      )}

      {!isLocked && (
        <div
          {...listeners}
          {...attributes}
          className="absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing p-1.5 rounded-xl bg-white/90 hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to canvas"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <circle cx="4" cy="3" r="1.2" />
            <circle cx="10" cy="3" r="1.2" />
            <circle cx="4" cy="7" r="1.2" />
            <circle cx="10" cy="7" r="1.2" />
            <circle cx="4" cy="11" r="1.2" />
            <circle cx="10" cy="11" r="1.2" />
          </svg>
        </div>
      )}

      <div className={`p-2.5 ${isLocked ? "opacity-40 pointer-events-none" : ""}`}>
        <BlockMiniPreview srcDoc={srcDoc} />

        <div className="flex items-center justify-between mt-3 px-0.5 gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{block.blockName}</p>
            <p className="text-[11px] text-slate-400">Standalone</p>
          </div>

          {!isLocked && (
            <div className="flex items-center gap-1 text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
              <span className="text-[11px]">drag</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────
interface BlockPanelProps {
  draggingOption: BlockOption | null;
  canvasBlockIds: string[];
  assignedTemplateId: string | null;
}

// ── BLOCK PANEL ────────────────────────────────────────────
export default function BlockPanel({
  draggingOption,
  canvasBlockIds,
  assignedTemplateId,
}: BlockPanelProps) {
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [allTemplates, setAllTemplates] = useState<Template[]>([]);
  const [standaloneBlocks, setStandaloneBlocks] = useState<StandaloneBlock[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingBlocks, setLoadingBlocks] = useState(true);

  useEffect(() => {
    setLoadingTemplates(true);

    const fetchTemplates = async () => {
      try {
        let templates: Template[] = [];

        if (assignedTemplateId) {
          const q = query(collection(db, "templates"), where("__name__", "==", assignedTemplateId));
          const snap = await getDocs(q);

          if (snap.empty) {
            const allSnap = await getDocs(collection(db, "templates"));
            templates = allSnap.docs
              .map((d) => d.data() as Template)
              .filter((t) => t.id === assignedTemplateId);
          } else {
            templates = snap.docs.map((d) => d.data() as Template);
          }
        } else {
          const snap = await getDocs(collection(db, "templates"));
          templates = snap.docs.map((d) => d.data() as Template);
        }

        setAllTemplates(templates);
      } catch (err) {
        console.error("[BlockPanel] Failed to load templates:", err);
        setAllTemplates([]);
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, [assignedTemplateId]);

  useEffect(() => {
    setLoadingBlocks(true);

    getDocs(collection(db, "blocks"))
      .then((snap) => {
        setStandaloneBlocks(snap.docs.map((d) => d.data() as StandaloneBlock));
      })
      .catch((err) => {
        console.error("[BlockPanel] Failed to load blocks:", err);
        setStandaloneBlocks([]);
      })
      .finally(() => setLoadingBlocks(false));
  }, []);

  const isLoading = loadingTemplates || loadingBlocks;

  const groupedTemplateBlocks = useMemo(() => {
    const countPerType: Record<string, number> = {};
    const groups: Record<string, BlockOption[]> = {};

    allTemplates.forEach((template) => {
      template.blocks.forEach((block) => {
        if (!groups[block.blockId]) groups[block.blockId] = [];
        countPerType[block.blockId] = (countPerType[block.blockId] || 0) + 1;
        const meta = BLOCK_META[block.blockId];
        const label = meta?.label ?? block.blockId;

        groups[block.blockId].push({
          block,
          sourceTemplateId: template.id,
          sourceTemplateName: template.templateName,
          templateRawHtml: template.rawHtml,
          variantLabel: `${label} ${countPerType[block.blockId]}`,
        });
      });
    });

    return groups;
  }, [allTemplates]);

  const groupedStandaloneBlocks = useMemo(() => {
    const groups: Record<string, StandaloneBlock[]> = {};
    standaloneBlocks.forEach((b) => {
      if (!groups[b.blockType]) groups[b.blockType] = [];
      groups[b.blockType].push(b);
    });
    return groups;
  }, [standaloneBlocks]);

  const allBlockTypes = useMemo(() => {
    const keys = new Set([...Object.keys(groupedTemplateBlocks), ...Object.keys(groupedStandaloneBlocks)]);
    const metaOrder = Object.keys(BLOCK_META);

    return Array.from(keys).sort((a, b) => {
      const ai = metaOrder.indexOf(a);
      const bi = metaOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [groupedTemplateBlocks, groupedStandaloneBlocks]);

  const filteredBlockTypes = useMemo(() => {
    if (!search.trim()) return allBlockTypes;
    const q = search.toLowerCase();

    return allBlockTypes.filter((blockType) => {
      const meta = BLOCK_META[blockType];
      const label = (meta?.label ?? blockType).toLowerCase();
      if (label.includes(q)) return true;

      const tOpts = groupedTemplateBlocks[blockType] || [];
      if (tOpts.some((o) => o.variantLabel.toLowerCase().includes(q) || o.sourceTemplateName.toLowerCase().includes(q))) {
        return true;
      }

      const sBlocks = groupedStandaloneBlocks[blockType] || [];
      if (sBlocks.some((b) => b.blockName.toLowerCase().includes(q))) {
        return true;
      }

      return false;
    });
  }, [allBlockTypes, search, groupedTemplateBlocks, groupedStandaloneBlocks]);

  const totalCount = allBlockTypes.reduce(
    (acc, bt) => acc + (groupedTemplateBlocks[bt]?.length || 0) + (groupedStandaloneBlocks[bt]?.length || 0),
    0
  );

  const isEmpty = !isLoading && allTemplates.length === 0 && standaloneBlocks.length === 0;

  return (
    <div className="w-72 bg-gradient-to-b from-white to-slate-50 border-r border-indigo-100 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-indigo-100 shrink-0 bg-white/90">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-sm">🧱</span>
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">Blocks</h2>
              <p className="text-xs text-slate-400 mt-0.5">Drag blocks to canvas</p>
            </div>
          </div>

          {totalCount > 0 && (
            <span className="text-[11px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
              {totalCount}
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-3.5 pt-3.5 pb-2 shrink-0">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          <input
            type="text"
            placeholder="Search blocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700 placeholder:text-slate-300"
          />
        </div>
      </div>

      {/* Dragging hint */}
      {draggingOption && (
        <div className="mx-3.5 mb-2 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-600 font-medium text-center animate-pulse shrink-0">
          🎯 Drop onto the canvas to add
        </div>
      )}

      {/* Block list */}
      <div className="flex-1 overflow-y-auto px-3.5 pb-3.5 space-y-2.5 pt-1">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-400">Loading blocks...</p>
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-xs text-slate-600 font-medium">No blocks yet</p>
            <p className="text-xs text-slate-400 mt-1">Ask admin to upload templates or blocks</p>
          </div>
        )}

        {!isLoading && !isEmpty && filteredBlockTypes.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-slate-300">No blocks match "{search}"</p>
          </div>
        )}

        {!isLoading &&
          filteredBlockTypes.map((blockType) => {
            const meta = BLOCK_META[blockType] || { label: blockType, icon: "📦" };
            const isExpanded = expandedType === blockType;
            const tOptions = groupedTemplateBlocks[blockType] || [];
            const sBlocks = groupedStandaloneBlocks[blockType] || [];
            const totalInGroup = tOptions.length + sBlocks.length;

            const onCanvasCount =
              tOptions.filter((o) => canvasBlockIds.includes(o.block.blockId + "::" + o.sourceTemplateId)).length +
              sBlocks.filter((b) => canvasBlockIds.includes(`standalone::${b.id}`)).length;

            const hasFree = sBlocks.some((b) => b.tier === "free");
            const hasPremium = sBlocks.some((b) => b.tier === "premium");
            const hasCustom = sBlocks.some((b) => b.tier === "custom");

            return (
              <div
                key={blockType}
                className="rounded-2xl border border-indigo-100 bg-white overflow-hidden shadow-[0_4px_14px_rgba(15,23,42,0.03)]"
              >
                <button
                  onClick={() => setExpandedType(isExpanded ? null : blockType)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/60 hover:from-indigo-100/60 hover:to-violet-100/50 transition text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base">{meta.icon}</span>
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-[0.14em] truncate">
                      {meta.label}
                    </span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                      {totalInGroup}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onCanvasCount > 0 && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-semibold">
                        {onCanvasCount} added
                      </span>
                    )}
                    {hasFree && <span className="text-xs">🆓</span>}
                    {hasPremium && <span className="text-xs">🔒</span>}
                    {hasCustom && <span className="text-xs">👤</span>}
                    <span className="text-slate-300 text-xs">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-2.5 space-y-2.5 bg-white">
                    {tOptions.length > 0 && (
                      <>
                        {sBlocks.length > 0 && (
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.14em] px-1 pt-1">
                            📄 From Templates
                          </p>
                        )}

                        {tOptions.map((option) => {
                          const compositeId = option.block.blockId + "::" + option.sourceTemplateId;
                          return (
                            <DraggableBlockCard
                              key={`tpl-${option.sourceTemplateId}`}
                              option={option}
                              blockId={blockType}
                              isOnCanvas={canvasBlockIds.includes(compositeId)}
                            />
                          );
                        })}
                      </>
                    )}

                    {sBlocks.length > 0 && (
                      <>
                        {tOptions.length > 0 && (
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.14em] px-1 pt-1">
                            🧩 Standalone
                          </p>
                        )}

                        {sBlocks.map((block) => (
                          <StandaloneBlockCard
                            key={`sa-${block.id}`}
                            block={block}
                            isOnCanvas={canvasBlockIds.includes(`standalone::${block.id}`)}
                          />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-indigo-100 bg-white/80 shrink-0">
        <p className="text-xs text-slate-400 text-center">⠿ Drag any block onto the canvas</p>
      </div>
    </div>
  );
}