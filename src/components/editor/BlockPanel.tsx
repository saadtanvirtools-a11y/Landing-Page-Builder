import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useAuthStore } from "../../store/authStore";
import { db } from "../../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import type { ParsedBlock, Template, StandaloneBlock } from "../../types";

// ── Block meta ─────────────────────────────────────────────
const BLOCK_META: Record<string, { label: string; icon: string }> = {
  hero          : { label: "Hero",         icon: "🦸" },
  features      : { label: "Features",     icon: "⚡" },
  benefits      : { label: "Benefits",     icon: "✅" },
  faq           : { label: "FAQ",          icon: "❓" },
  testimonials  : { label: "Testimonials", icon: "💬" },
  cta           : { label: "CTA",          icon: "🎯" },
  "cta-banner"  : { label: "CTA Banner",   icon: "🎯" },
  footer        : { label: "Footer",       icon: "🔗" },
  navbar        : { label: "Navbar",       icon: "🔝" },
  pricing       : { label: "Pricing",      icon: "💰" },
  contact       : { label: "Contact",      icon: "📬" },
  "how-it-works": { label: "How It Works", icon: "🔄" },
  other         : { label: "Other",        icon: "📦" },
};

// ── BlockOption (from template) ────────────────────────────
export interface BlockOption {
  block             : ParsedBlock;
  sourceTemplateId  : string;
  sourceTemplateName: string;
  templateRawHtml   : string;
  variantLabel      : string;
}

// ── Drag ID helpers ────────────────────────────────────────
export function makeDragId(blockId: string, sourceTemplateId: string) {
  return `PANEL::${blockId}::${sourceTemplateId}`;
}
export function parseDragId(id: string) {
  const parts = id.split("::");
  return { blockId: parts[1], sourceTemplateId: parts[2] };
}
export function isPanelDrag(id: string)               { return id.startsWith("PANEL::"); }
export function makeStandaloneDragId(blockId: string) { return `STANDALONE::${blockId}`; }
export function isStandaloneDrag(id: string)          { return id.startsWith("STANDALONE::"); }
export function parseStandaloneDragId(id: string)     { return { standaloneId: id.replace("STANDALONE::", "") }; }

// ── Build preview doc (template block) ────────────────────
function buildPreviewDoc(blockHtml: string, templateFullHtml: string): string {
  const parser    = new DOMParser();
  const doc       = parser.parseFromString(templateFullHtml, "text/html");
  const styleTags = Array.from(doc.querySelectorAll("style")).map((s) => s.outerHTML).join("\n");
  const linkTags  = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.outerHTML).join("\n");
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
  const cssVarBlock = Object.entries(block.cssVariables).map(([k, v]) => `  ${k}: ${v};`).join("\n");
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
  const wrapperRef                        = useRef<HTMLDivElement>(null);
  const iframeRef                         = useRef<HTMLIFrameElement>(null);
  const [scale, setScale]                 = useState(0.165);
  const [contentHeight, setContentHeight] = useState(300);
  const [loaded, setLoaded]               = useState(false);

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
        if (!doc) { setLoaded(true); return; }
        const h = Math.max(
          doc.body.scrollHeight, doc.body.offsetHeight,
          doc.documentElement.scrollHeight, doc.documentElement.offsetHeight,
        );
        if (h > 10) { setContentHeight(h); setLoaded(true); }
      } catch { setLoaded(true); }
    };
    const t1 = setTimeout(measure, 300);
    const t2 = setTimeout(measure, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div ref={wrapperRef} className="w-full rounded-lg overflow-hidden relative bg-gray-100"
      style={{ height: Math.round(contentHeight * scale) || 70, opacity: loaded ? 1 : 0, transition: "opacity 0.3s" }}>
      <iframe ref={iframeRef} srcDoc={srcDoc} title="preview" scrolling="no" onLoad={handleLoad}
        className="absolute top-0 left-0 border-0"
        style={{ width: "1280px", height: `${contentHeight}px`, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}
        sandbox="allow-scripts allow-same-origin" />
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse rounded-lg" />
      )}
    </div>
  );
}

// ── Template block card ────────────────────────────────────
function DraggableBlockCard({ option, blockId, isOnCanvas }: {
  option: BlockOption; blockId: string; isOnCanvas: boolean;
}) {
  const dragId = makeDragId(blockId, option.sourceTemplateId);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId });
  const srcDoc = useMemo(
    () => buildPreviewDoc(option.block.rawHtml, option.templateRawHtml),
    [option.block.rawHtml, option.templateRawHtml],
  );

  return (
    <div ref={setNodeRef}
      className={`relative rounded-xl border-2 transition-all group overflow-hidden
        ${isDragging  ? "opacity-40 scale-95 border-indigo-300"
        : isOnCanvas  ? "border-green-400 bg-green-50"
        :               "border-gray-100 bg-white hover:border-indigo-300 hover:shadow-md"}`}>
      {isOnCanvas && (
        <div className="absolute top-2 left-2 z-10 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold shadow">
          ✓ On Canvas
        </div>
      )}
      <div className="absolute top-2 left-2 z-10 bg-indigo-100 text-indigo-600 text-xs px-2 py-0.5 rounded-full font-semibold border border-indigo-200 leading-tight"
        style={{ display: isOnCanvas ? "none" : undefined }}>
        📄 Template
      </div>
      <div {...listeners} {...attributes}
        className="absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing p-1.5 rounded-lg bg-white/90 hover:bg-indigo-100 text-gray-400 hover:text-indigo-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to canvas">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/>
          <circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/>
          <circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/>
        </svg>
      </div>
      <div className="p-2">
        <BlockMiniPreview srcDoc={srcDoc} />
        <div className="flex items-center justify-between mt-2 px-0.5">
          <div>
            <p className="text-xs font-bold text-gray-700">{option.variantLabel}</p>
            <p className="text-xs text-gray-400 truncate max-w-[120px]">{option.sourceTemplateName}</p>
          </div>
          <div className="flex items-center gap-1 text-gray-300 group-hover:text-indigo-400 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
            <span className="text-xs">drag</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Standalone block card ──────────────────────────────────
function StandaloneBlockCard({ block, isOnCanvas }: {
  block: StandaloneBlock; isOnCanvas: boolean;
}) {
  const { user } = useAuthStore();

  // ✅ Access logic using Firestore user (from authStore)
  const isLocked = (() => {
    if (block.tier === "free")    return false;
    if (block.tier === "premium") return true;
    if (block.tier === "custom") {
      if (user?.role === "admin") return false;
      return !(block.allowedUserIds ?? []).includes(user?.id ?? "");
    }
    return false;
  })();

  const dragId = makeStandaloneDragId(block.id);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id      : dragId,
    disabled: isLocked,
  });

  const srcDoc = useMemo(() => buildStandalonePreviewDoc(block), [block]);

  const lockLabel = block.tier === "premium"
    ? { icon: "🔒", title: "Premium",    sub: "Upgrade to unlock" }
    : { icon: "🔒", title: "Restricted", sub: "No access"         };

  const tierBadge =
    block.tier === "free"
      ? { label: "🆓 Free",    cls: "bg-green-100  text-green-700  border-green-200"  }
      : block.tier === "custom"
      ? { label: "👤 Custom",  cls: "bg-indigo-100 text-indigo-700 border-indigo-200" }
      : { label: "🔒 Premium", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" };

  return (
    <div ref={setNodeRef}
      className={`relative rounded-xl border-2 transition-all group overflow-hidden
        ${isDragging  ? "opacity-40 scale-95 border-indigo-300"
        : isLocked    ? "border-yellow-200 bg-yellow-50/40"
        : isOnCanvas  ? "border-green-400 bg-green-50"
        :               "border-gray-100 bg-white hover:border-indigo-300 hover:shadow-md"}`}>

      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-yellow-50/85 backdrop-blur-[1px] rounded-xl cursor-not-allowed">
          <span className="text-2xl mb-1">{lockLabel.icon}</span>
          <p className="text-xs font-bold text-yellow-700">{lockLabel.title}</p>
          <p className="text-xs text-yellow-500 mt-0.5">{lockLabel.sub}</p>
        </div>
      )}

      {/* On-canvas badge */}
      {isOnCanvas && !isLocked && (
        <div className="absolute top-2 left-2 z-10 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold shadow">
          ✓ On Canvas
        </div>
      )}

      {/* Tier badge */}
      {!isOnCanvas && (
        <div className={`absolute top-2 left-2 z-10 text-xs px-2 py-0.5 rounded-full font-semibold border leading-tight ${tierBadge.cls}`}>
          {tierBadge.label}
        </div>
      )}

      {/* Drag handle */}
      {!isLocked && (
        <div {...listeners} {...attributes}
          className="absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing p-1.5 rounded-lg bg-white/90 hover:bg-indigo-100 text-gray-400 hover:text-indigo-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to canvas">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/>
            <circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/>
            <circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/>
          </svg>
        </div>
      )}

      <div className={`p-2 ${isLocked ? "opacity-40 pointer-events-none" : ""}`}>
        <BlockMiniPreview srcDoc={srcDoc} />
        <div className="flex items-center justify-between mt-2 px-0.5">
          <div>
            <p className="text-xs font-bold text-gray-700">{block.blockName}</p>
            <p className="text-xs text-gray-400">Standalone</p>
          </div>
          {!isLocked && (
            <div className="flex items-center gap-1 text-gray-300 group-hover:text-indigo-400 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
              <span className="text-xs">drag</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────
interface BlockPanelProps {
  draggingOption    : BlockOption | null;
  canvasBlockIds    : string[];
  assignedTemplateId: string | null;
}

// ── BLOCK PANEL ────────────────────────────────────────────
export default function BlockPanel({
  draggingOption,
  canvasBlockIds,
  assignedTemplateId,
}: BlockPanelProps) {
  const [expandedType,      setExpandedType]      = useState<string | null>(null);
  const [search,            setSearch]            = useState("");

  // ✅ Firestore state
  const [allTemplates,      setAllTemplates]      = useState<Template[]>([]);
  const [standaloneBlocks,  setStandaloneBlocks]  = useState<StandaloneBlock[]>([]);
  const [loadingTemplates,  setLoadingTemplates]  = useState(true);
  const [loadingBlocks,     setLoadingBlocks]     = useState(true);

  // ✅ Load assigned template(s) from Firestore
  useEffect(() => {
    setLoadingTemplates(true);
    const fetchTemplates = async () => {
      try {
        let templates: Template[] = [];
        if (assignedTemplateId) {
          // Only fetch the assigned template
          const q    = query(collection(db, "templates"), where("__name__", "==", assignedTemplateId));
          const snap = await getDocs(q);
          // Fallback: getDoc by ID is cleaner — use getDocs on full collection filtered
          if (snap.empty) {
            // Try fetching all and filter (in case where() on __name__ isn't supported)
            const allSnap = await getDocs(collection(db, "templates"));
            templates = allSnap.docs
              .map((d) => d.data() as Template)
              .filter((t) => t.id === assignedTemplateId);
          } else {
            templates = snap.docs.map((d) => d.data() as Template);
          }
        } else {
          const snap = await getDocs(collection(db, "templates"));
          templates  = snap.docs.map((d) => d.data() as Template);
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

  // ✅ Load standalone blocks from Firestore
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
    const countPerType: Record<string, number>  = {};
    const groups: Record<string, BlockOption[]> = {};
    allTemplates.forEach((template) => {
      template.blocks.forEach((block) => {
        if (!groups[block.blockId]) groups[block.blockId] = [];
        countPerType[block.blockId] = (countPerType[block.blockId] || 0) + 1;
        const meta  = BLOCK_META[block.blockId];
        const label = meta?.label ?? block.blockId;
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
    const keys      = new Set([...Object.keys(groupedTemplateBlocks), ...Object.keys(groupedStandaloneBlocks)]);
    const metaOrder = Object.keys(BLOCK_META);
    return Array.from(keys).sort((a, b) => {
      const ai = metaOrder.indexOf(a); const bi = metaOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [groupedTemplateBlocks, groupedStandaloneBlocks]);

  const filteredBlockTypes = useMemo(() => {
    if (!search.trim()) return allBlockTypes;
    const q = search.toLowerCase();
    return allBlockTypes.filter((blockType) => {
      const meta  = BLOCK_META[blockType];
      const label = (meta?.label ?? blockType).toLowerCase();
      if (label.includes(q)) return true;
      const tOpts   = groupedTemplateBlocks[blockType] || [];
      if (tOpts.some((o) => o.variantLabel.toLowerCase().includes(q) || o.sourceTemplateName.toLowerCase().includes(q))) return true;
      const sBlocks = groupedStandaloneBlocks[blockType] || [];
      if (sBlocks.some((b) => b.blockName.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [allBlockTypes, search, groupedTemplateBlocks, groupedStandaloneBlocks]);

  const totalCount = allBlockTypes.reduce((acc, bt) =>
    acc + (groupedTemplateBlocks[bt]?.length || 0) + (groupedStandaloneBlocks[bt]?.length || 0), 0);

  const isEmpty = !isLoading && allTemplates.length === 0 && standaloneBlocks.length === 0;

  return (
    <div className="w-64 bg-white border-r border-gray-100 flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800 text-sm">🧱 Blocks</h2>
          {totalCount > 0 && (
            <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">
              {totalCount}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Drag any block onto the canvas</p>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300"
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Search blocks..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
      </div>

      {/* Dragging hint */}
      {draggingOption && (
        <div className="mx-3 mb-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-600 font-medium text-center animate-pulse shrink-0">
          🎯 Drop onto the canvas to add!
        </div>
      )}

      {/* Block list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 pt-1">

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
            <p className="text-xs text-gray-400">Loading blocks...</p>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-xs text-gray-500 font-medium">No blocks yet</p>
            <p className="text-xs text-gray-400 mt-1">Ask admin to upload templates or blocks</p>
          </div>
        )}

        {/* No search results */}
        {!isLoading && !isEmpty && filteredBlockTypes.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-300">No blocks match "{search}"</p>
          </div>
        )}

        {/* Block type groups */}
        {!isLoading && filteredBlockTypes.map((blockType) => {
          const meta         = BLOCK_META[blockType] || { label: blockType, icon: "📦" };
          const isExpanded   = expandedType === blockType;
          const tOptions     = groupedTemplateBlocks[blockType]   || [];
          const sBlocks      = groupedStandaloneBlocks[blockType] || [];
          const totalInGroup = tOptions.length + sBlocks.length;

          const onCanvasCount =
            tOptions.filter((o) => canvasBlockIds.includes(o.block.blockId + "::" + o.sourceTemplateId)).length +
            sBlocks.filter((b)  => canvasBlockIds.includes(`standalone::${b.id}`)).length;

          const hasFree    = sBlocks.some((b) => b.tier === "free");
          const hasPremium = sBlocks.some((b) => b.tier === "premium");
          const hasCustom  = sBlocks.some((b) => b.tier === "custom");

          return (
            <div key={blockType} className="rounded-xl border border-gray-100 overflow-hidden">
              <button onClick={() => setExpandedType(isExpanded ? null : blockType)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-left">
                <div className="flex items-center gap-2">
                  <span className="text-base">{meta.icon}</span>
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{meta.label}</span>
                  <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold">
                    {totalInGroup}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {onCanvasCount > 0 && (
                    <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-medium">
                      {onCanvasCount} added
                    </span>
                  )}
                  {hasFree    && <span className="text-xs">🆓</span>}
                  {hasPremium && <span className="text-xs">🔒</span>}
                  {hasCustom  && <span className="text-xs">👤</span>}
                  <span className="text-gray-300 text-xs">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="p-2 space-y-2.5 bg-white">
                  {tOptions.length > 0 && (
                    <>
                      {sBlocks.length > 0 && (
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider px-1 pt-1">
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
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider px-1 pt-1">
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
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 shrink-0">
        <p className="text-xs text-gray-400 text-center">⠿ Drag any block onto the canvas</p>
      </div>
    </div>
  );
}