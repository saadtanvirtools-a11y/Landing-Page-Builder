import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { useAuthStore } from "../../store/authStore";
import { useEditorStore } from "../../store/editorStore";
import BlockPanel from "../../components/editor/BlockPanel";
import DragandDrop from "../../components/editor/DragandDrop";
import Canvas from "../../components/editor/Canvas";
import PropertiesPanel from "../../components/editor/PropertiesPanel";
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import type { BlockOption } from "../../components/editor/BlockPanel";
import {
  isPanelDrag,
  parseDragId,
  isStandaloneDrag,
  parseStandaloneDragId,
} from "../../components/editor/BlockPanel";
import type { Template, StandaloneBlock, EditableItem } from "../../types";
import { uploadEditorImage } from "../../api/supabaseStorage";

async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type || "image/png" });
}

function isDataUrl(value: string): boolean {
  return typeof value === "string" && value.startsWith("data:image/");
}

function guessFileExtensionFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,/);
  if (!match) return "png";

  const ext = match[1].toLowerCase();
  if (ext === "jpeg") return "jpg";
  if (ext === "svg+xml") return "svg";
  return ext;
}

function sanitizeFileName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-./]+|[-./]+$/g, "");
}

function getFileBaseNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    const raw = pathname.split("/").pop() || "asset";
    const withoutQuery = raw.split("?")[0].split("#")[0];
    const lastDot = withoutQuery.lastIndexOf(".");

    if (lastDot > 0) {
      return sanitizeFileName(withoutQuery.slice(0, lastDot)) || "asset";
    }

    return sanitizeFileName(withoutQuery) || "asset";
  } catch {
    const clean = url.split("/").pop()?.split("?")[0]?.split("#")[0] || "asset";
    const lastDot = clean.lastIndexOf(".");

    if (lastDot > 0) {
      return sanitizeFileName(clean.slice(0, lastDot)) || "asset";
    }

    return sanitizeFileName(clean) || "asset";
  }
}

function getExtensionFromUrlOrType(url: string, contentType?: string): string {
  const type = (contentType || "").toLowerCase();

  if (type.includes("svg")) return "svg";
  if (type.includes("png")) return "png";
  if (type.includes("jpeg")) return "jpg";
  if (type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("x-icon") || type.includes("ico")) return "ico";

  try {
    const pathname = new URL(url, window.location.origin).pathname;
    const file = pathname.split("/").pop() || "";
    const ext = file.split(".").pop()?.toLowerCase();
    if (ext) return ext === "jpeg" ? "jpg" : ext;
  } catch {
    const file = url.split("/").pop() || "";
    const ext = file.split(".").pop()?.toLowerCase();
    if (ext) return ext === "jpeg" ? "jpg" : ext;
  }

  return "png";
}

function getMimeTypeFromExt(ext: string): string {
  const lower = ext.toLowerCase();
  if (lower === "png") return "image/png";
  if (lower === "jpg" || lower === "jpeg") return "image/jpeg";
  if (lower === "svg") return "image/svg+xml";
  if (lower === "webp") return "image/webp";
  if (lower === "gif") return "image/gif";
  if (lower === "ico") return "image/x-icon";
  return "image/png";
}

function isExportableAssetUrl(url: string): boolean {
  if (!url) return false;

  const lower = url.trim().toLowerCase();
  if (!lower) return false;
  if (lower.startsWith("javascript:")) return false;
  if (lower.startsWith("mailto:")) return false;
  if (lower.startsWith("tel:")) return false;

  return true;
}

async function blobFromAnyUrl(url: string): Promise<Blob> {
  if (url.startsWith("data:")) {
    const res = await fetch(url);
    return await res.blob();
  }

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch asset: ${res.status} ${res.statusText}`);
  }

  return await res.blob();
}

function extractUrlsFromCss(css: string): string[] {
  const results: string[] = [];
  const regex = /url\((['"]?)(.*?)\1\)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(css)) !== null) {
    const url = (match[2] || "").trim();
    if (!url) continue;
    if (url.startsWith("data:")) continue;
    if (url.startsWith("#")) continue;
    results.push(url);
  }

  return results;
}

function replaceUrlsInCss(css: string, assetMap: Record<string, string>): string {
  let updated = css;

  Object.entries(assetMap).forEach(([oldUrl, newUrl]) => {
    const escaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    updated = updated.replace(
      new RegExp(`url\\((['"]?)${escaped}\\1\\)`, "g"),
      `url("${newUrl}")`
    );
  });

  return updated;
}

async function localizeAsset(
  url: string,
  zip: JSZip,
  seen: Map<string, string>,
  usedNames: Set<string>
): Promise<string> {
  if (!isExportableAssetUrl(url)) return url;

  if (seen.has(url)) {
    return seen.get(url)!;
  }

  const blob = await blobFromAnyUrl(url);
  const ext = getExtensionFromUrlOrType(url, blob.type);
  const base = getFileBaseNameFromUrl(url);

  let fileName = `${base}.${ext}`;
  let counter = 1;

  while (usedNames.has(fileName)) {
    fileName = `${base}-${counter}.${ext}`;
    counter += 1;
  }

  usedNames.add(fileName);

  const localPath = `images/${fileName}`;
  zip.file(localPath, blob);
  seen.set(url, localPath);

  return localPath;
}

function formatExportTimestamp(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}-${hh}-${min}-${ss}`;
}

function buildExportFileName(pageTitle?: string, templateName?: string): string {
  const baseName =
    sanitizeFileName(pageTitle || "") ||
    sanitizeFileName(templateName || "") ||
    "export";

  return `${baseName}-${formatExportTimestamp()}.zip`;
}

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
        <div className="text-xs font-bold text-indigo-600 truncate">
          {option.variantLabel}
        </div>
        <div className="text-xs text-gray-400 truncate mt-0.5">
          {option.sourceTemplateName}
        </div>
        <div className="mt-2 text-center text-lg">➕</div>
      </div>
    );
  }

  if (standaloneBlock) {
    return (
      <div className="w-48 rounded-xl border-2 border-green-500 bg-white shadow-2xl px-3 py-2.5 rotate-1 opacity-95 pointer-events-none">
        <div className="text-xs font-bold text-green-600 truncate">
          {standaloneBlock.blockName}
        </div>
        <div className="text-xs text-gray-400 truncate mt-0.5">
          🧩 Standalone block
        </div>
        <div className="mt-2 text-center text-lg">➕</div>
      </div>
    );
  }

  return null;
}

function standaloneToParseBlock(block: StandaloneBlock) {
  return {
    blockId: block.blockType,
    blockName: block.blockName,
    blockOrder: 0,
    rawHtml: block.rawHtml,
    editables: block.editables ?? [],
    colorVars: {},
    cssVariables: block.cssVariables ?? {},
    sourceTemplateId: `standalone::${block.id}`,
    sourceTemplateName: "Standalone",
  };
}

const BLOCK_LABELS: Record<string, string> = {
  hero: "Hero",
  features: "Features",
  footer: "Footer",
  navbar: "Navbar",
  pricing: "Pricing",
  faq: "FAQ",
  testimonials: "Testimonials",
  cta: "CTA",
  "cta-banner": "CTA Banner",
  benefits: "Benefits",
  contact: "Contact",
  "how-it-works": "How It Works",
};

function buildGroupedBlocksFromTemplates(
  templates: Template[],
  activeTemplateId: string | null
): Record<string, BlockOption[]> {
  const filtered = activeTemplateId
    ? templates.filter((t) => t.id === activeTemplateId)
    : templates;

  const groups: Record<string, BlockOption[]> = {};
  const countPerType: Record<string, number> = {};

  filtered.forEach((template) => {
    template.blocks.forEach((block) => {
      if (!groups[block.blockId]) groups[block.blockId] = [];

      countPerType[block.blockId] = (countPerType[block.blockId] || 0) + 1;

      const label = BLOCK_LABELS[block.blockId] ?? block.blockId;

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
}

export default function EditorLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const {
    lastSaved,
    isSaving,
    templateName,
    currentTemplate,
    selectedBlockId,
    pageScripts,
    saveToStorage,
    resetEditor,
    addBlockToTemplate,
    updateEditable,
    updateCssVar,
    updateClassSwap,
    updateBlockStyle,
    updatePageSettings,
  } = useEditorStore();

  const activeTemplateId = currentTemplate?.id ?? null;

  const [draggingOption, setDraggingOption] = useState<BlockOption | null>(null);
  const [draggingStandalone, setDraggingStandalone] = useState<StandaloneBlock | null>(null);
  const [exported, setExported] = useState(false);
  const [isUploadingEditorImage, setIsUploadingEditorImage] = useState(false);

  const [firestoreTemplates, setFirestoreTemplates] = useState<Template[]>([]);
  const [firestoreStandaloneBlocks, setFirestoreStandaloneBlocks] = useState<StandaloneBlock[]>([]);

  const activeDropZoneRef = useRef<string | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<string | null>(null);

  const updateDropZone = useCallback((id: string | null) => {
    activeDropZoneRef.current = id;
    setActiveDropZone(id);
  }, []);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const canvasBlockIds = useMemo(
    () =>
      (currentTemplate?.blocks ?? []).map((b) =>
        b.sourceTemplateId?.startsWith("standalone::")
          ? b.sourceTemplateId
          : b.blockId + "::" + b.sourceTemplateId
      ),
    [currentTemplate?.blocks]
  );

  const handleDragStart = useCallback(
    (e: DragStartEvent) => {
      const id = String(e.active.id);

      if (isPanelDrag(id)) {
        const groups = buildGroupedBlocksFromTemplates(firestoreTemplates, activeTemplateId);
        const { blockId, sourceTemplateId } = parseDragId(id);
        const found = (groups[blockId] || []).find(
          (o) => o.sourceTemplateId === sourceTemplateId
        );

        setDraggingOption(found ?? null);
        setDraggingStandalone(null);
        updateDropZone(null);
        return;
      }

      if (isStandaloneDrag(id)) {
        const { standaloneId } = parseStandaloneDragId(id);
        const found = firestoreStandaloneBlocks.find((b) => b.id === standaloneId);

        setDraggingStandalone(found ?? null);
        setDraggingOption(null);
        updateDropZone(null);
      }
    },
    [updateDropZone, activeTemplateId, firestoreTemplates, firestoreStandaloneBlocks]
  );

  const handleDragOver = useCallback(
    (e: DragOverEvent) => {
      const overId = e.over?.id ? String(e.over.id) : null;

      if (overId !== activeDropZoneRef.current) {
        updateDropZone(overId);
      }
    },
    [updateDropZone]
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const activeId = String(e.active.id);
      const lastKnownZone = activeDropZoneRef.current;
      const dndKitOverId = e.over?.id ? String(e.over.id) : null;
      const overId = dndKitOverId ?? lastKnownZone;

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
        const { blockId, sourceTemplateId } = parseDragId(activeId);
        const groups = buildGroupedBlocksFromTemplates(firestoreTemplates, activeTemplateId);
        const option = (groups[blockId] || []).find(
          (o) => o.sourceTemplateId === sourceTemplateId
        );

        if (!option) {
          console.error("[DragEnd] ❌ Template block not found:", blockId);
          return;
        }

        doAdd({
          ...option.block,
          sourceTemplateId: option.sourceTemplateId,
          sourceTemplateName: option.sourceTemplateName,
        });

        return;
      }

      if (isStandaloneDrag(activeId)) {
        const { standaloneId } = parseStandaloneDragId(activeId);
        const found = firestoreStandaloneBlocks.find((b) => b.id === standaloneId);

        if (!found) {
          console.error("[DragEnd] ❌ Standalone block not found:", standaloneId);
          return;
        }

        doAdd(standaloneToParseBlock(found));
      }
    },
    [addBlockToTemplate, updateDropZone, activeTemplateId, firestoreTemplates, firestoreStandaloneBlocks]
  );

  useEffect(() => {
    if (!user) return;

    const t = setInterval(() => saveToStorage(user.id), 30_000);

    return () => clearInterval(t);
  }, [user, saveToStorage]);

  const handleSave = () => {
    if (user) saveToStorage(user.id);
  };

  const handleReset = () => {
    if (confirm("Reset canvas? All unsaved changes will be lost.")) {
      resetEditor();
    }
  };

  const handleBackToDashboard = () => {
    const shouldLeave = confirm("Go back to dashboard? Make sure your changes are saved.");
    if (!shouldLeave) return;

    navigate("/dashboard");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handlePreview = () => {
    if (!currentTemplate?.blocks?.length) return;

    if (user?.id && currentTemplate) {
      const latestState = useEditorStore.getState();
      const tpl = latestState.currentTemplate;

      const snapshot = {
        currentTemplate: tpl
          ? { ...tpl, blocks: tpl.blocks.map((b) => ({ ...b, styles: b.styles ?? {} })) }
          : null,
        canvasBlocks: latestState.canvasBlocks,
        pageScripts: latestState.pageScripts,
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(`editor_save_${user.id}`, JSON.stringify(snapshot));
    }

    navigate("/preview", { state: { templateId: currentTemplate?.id ?? null } });
  };

  const buildExportZip = async (template: Template): Promise<Blob> => {
    const zip = new JSZip();
    const parser = new DOMParser();
    const doc2 = parser.parseFromString(template.rawHtml, "text/html");
    const assetMap = new Map<string, string>();
    const usedNames = new Set<string>();

    const editorAttrs = [
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

    editorAttrs.forEach((attr) => {
      doc2.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr));
    });

    doc2.querySelectorAll("[data-tpl-styles]").forEach((el) => {
      const parent = el.parentElement;

      if (parent) {
        Array.from(el.children).forEach((child) => parent.insertBefore(child, el));
        el.remove();
      }
    });

    const head = doc2.head || doc2.createElement("head");

    if (!doc2.head) {
      const htmlEl = doc2.documentElement || doc2.createElement("html");
      htmlEl.prepend(head);
      if (!doc2.documentElement) doc2.appendChild(htmlEl);
    }

    let titleEl = head.querySelector("title");

    if (!titleEl) {
      titleEl = doc2.createElement("title");
      head.prepend(titleEl);
    }

    titleEl.textContent = pageScripts.pageTitle?.trim() || template.templateName || "Exported Page";

    const existingMetaDescription = head.querySelector('meta[name="description"]');
    if (existingMetaDescription) existingMetaDescription.remove();

    if (pageScripts.metaDescription?.trim()) {
      const metaDescription = doc2.createElement("meta");
      metaDescription.setAttribute("name", "description");
      metaDescription.setAttribute("content", pageScripts.metaDescription.trim());
      head.appendChild(metaDescription);
    }

    const existingFavicon = head.querySelector('link[rel="icon"]');
    if (existingFavicon) existingFavicon.remove();

    if (pageScripts.faviconUrl?.trim()) {
      try {
        const faviconUrl = pageScripts.faviconUrl.trim();
        const faviconBlob = await blobFromAnyUrl(faviconUrl);
        const faviconExt = getExtensionFromUrlOrType(faviconUrl, faviconBlob.type);
        const faviconMime = getMimeTypeFromExt(faviconExt);
        const faviconPath = `images/favicon.${faviconExt}`;

        zip.file(faviconPath, faviconBlob);

        const favicon = doc2.createElement("link");
        favicon.setAttribute("rel", "icon");
        favicon.setAttribute("type", faviconMime);
        favicon.setAttribute("href", faviconPath);
        head.appendChild(favicon);
      } catch (err) {
        console.error("[Export] Failed favicon:", err);
      }
    }

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

    const imageEls = Array.from(doc2.querySelectorAll("img[src], source[src]"));

    for (const el of imageEls) {
      const attr = el.tagName.toLowerCase() === "source" ? "src" : "src";
      const src = el.getAttribute(attr) || "";

      if (!isExportableAssetUrl(src)) continue;

      try {
        const localPath = await localizeAsset(src, zip, assetMap, usedNames);
        el.setAttribute(attr, localPath);
      } catch (err) {
        console.error("[Export] Failed to localize image:", src, err);
      }
    }

    const elementsWithStyle = Array.from(doc2.querySelectorAll<HTMLElement>("[style]"));

    for (const el of elementsWithStyle) {
      const styleValue = el.getAttribute("style") || "";
      const urls = extractUrlsFromCss(styleValue);

      if (urls.length === 0) continue;

      const replacements: Record<string, string> = {};

      for (const url of urls) {
        try {
          replacements[url] = await localizeAsset(url, zip, assetMap, usedNames);
        } catch (err) {
          console.error("[Export] Failed to localize inline style asset:", url, err);
        }
      }

      el.setAttribute("style", replaceUrlsInCss(styleValue, replacements));
    }

    const styleTags = Array.from(head.querySelectorAll("style"));
    let combinedCss = "";

    for (const styleEl of styleTags) {
      let cssText = styleEl.textContent || "";
      const urls = extractUrlsFromCss(cssText);

      if (urls.length > 0) {
        const replacements: Record<string, string> = {};

        for (const url of urls) {
          try {
            replacements[url] = await localizeAsset(url, zip, assetMap, usedNames);
          } catch (err) {
            console.error("[Export] Failed to localize CSS asset:", url, err);
          }
        }

        cssText = replaceUrlsInCss(cssText, replacements);
      }

      combinedCss += (combinedCss ? "\n\n" : "") + cssText;
      styleEl.remove();
    }

    const cssVarLines = Object.entries(template.cssVariables || {})
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n");

    if (cssVarLines.trim()) {
      combinedCss += `${combinedCss ? "\n\n" : ""}:root {\n${cssVarLines}\n}`;
    }

    let combinedJs = "";

    const inlineScripts = Array.from(doc2.querySelectorAll("script")).filter((script) => {
      const src = script.getAttribute("src");
      return !src;
    });

    for (const script of inlineScripts) {
      const jsText = script.textContent?.trim() || "";

      if (jsText) {
        combinedJs += (combinedJs ? "\n\n" : "") + jsText;
      }

      script.remove();
    }

    if (!doc2.body) {
      const htmlEl = doc2.documentElement;
      const body = doc2.createElement("body");

      while (htmlEl.firstChild) {
        body.appendChild(htmlEl.firstChild);
      }

      htmlEl.appendChild(body);
    }

    if (pageScripts.headScripts?.trim()) {
      head.insertAdjacentHTML("beforeend", pageScripts.headScripts.trim());
    }

    if (pageScripts.bodyScripts?.trim() && doc2.body) {
      doc2.body.insertAdjacentHTML("afterbegin", pageScripts.bodyScripts.trim());
    }

    const oldCssLink = head.querySelector('link[href="public/style.css"]');
    if (oldCssLink) oldCssLink.remove();

    const exportCssLink = doc2.createElement("link");
    exportCssLink.setAttribute("rel", "stylesheet");
    exportCssLink.setAttribute("href", "public/style.css");
    head.appendChild(exportCssLink);

    const oldMainJs = doc2.querySelector('script[src="public/main.js"]');
    if (oldMainJs) oldMainJs.remove();

    const exportMainJs = doc2.createElement("script");
    exportMainJs.setAttribute("src", "public/main.js");

    if (doc2.body) {
      doc2.body.appendChild(exportMainJs);
    } else {
      head.appendChild(exportMainJs);
    }

    zip.file("index.html", `<!DOCTYPE html>\n${doc2.documentElement.outerHTML}`);
    zip.file("public/style.css", combinedCss || "/* Exported styles */\n");
    zip.file("public/main.js", combinedJs || "// Exported scripts\n");

    return await zip.generateAsync({ type: "blob" });
  };

  const handleExport = async () => {
    if (!currentTemplate) return;

    try {
      const latestState = useEditorStore.getState();
      const latestTemplate = latestState.currentTemplate || currentTemplate;
      const latestPageScripts = latestState.pageScripts || pageScripts;

      const zipBlob = await buildExportZip(latestTemplate);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");

      const exportFileName = buildExportFileName(
        latestPageScripts?.pageTitle?.trim(),
        latestTemplate?.templateName
      );

      a.href = url;
      a.download = exportFileName;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExported(true);
      setTimeout(() => setExported(false), 2500);
    } catch (err) {
      console.error("[Export] ZIP export failed:", err);
      alert("ZIP export failed. Please try again.");
    }
  };

  const resolveLiveColor = useCallback(
    (varName: string): string => {
      if (!currentTemplate) return "#ffffff";

      const fromStore = currentTemplate.cssVariables?.[varName];

      if (fromStore && fromStore.trim() !== "") {
        return fromStore.trim();
      }

      if (currentTemplate.rawHtml) {
        const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = currentTemplate.rawHtml.match(
          new RegExp(escaped + "\\s*:\\s*([^;\\n\\r}]+)")
        );

        if (match?.[1]?.trim()) {
          return match[1].trim();
        }
      }

      return "#ffffff";
    },
    [currentTemplate]
  );

  const handleCssVarChange = useCallback(
    (varName: string, value: string) => updateCssVar(varName, value),
    [updateCssVar]
  );

  const handleClassSwap = useCallback(
    (editableId: string, newClass: string) => updateClassSwap(editableId, newClass),
    [updateClassSwap]
  );

  const handlePageSettingsChange = useCallback(
    (data: any) => updatePageSettings(data),
    [updatePageSettings]
  );

  const handleEditableChange = useCallback(
    async (editableId: string, newContent: string) => {
      if (!currentTemplate) return;

      const allEditables: EditableItem[] = currentTemplate.blocks.flatMap(
        (b) => b.editables || []
      );

      const editable = allEditables.find((e) => e.id === editableId);

      if (!editable) {
        updateEditable(editableId, newContent);
        return;
      }

      if (editable.type !== "image" || !isDataUrl(newContent)) {
        updateEditable(editableId, newContent);
        return;
      }

      if (!user?.id) {
        console.error("[EditorLayout] Cannot upload editor image: missing user id");
        return;
      }

      try {
        setIsUploadingEditorImage(true);

        const ext = guessFileExtensionFromDataUrl(newContent);
        const file = await dataUrlToFile(newContent, `${editableId}.${ext}`);

        const uploaded = await uploadEditorImage({
          file,
          userId: user.id,
          projectId: currentTemplate.id,
          editableId,
        });

        updateEditable(editableId, uploaded.url);
      } catch (err) {
        console.error("[EditorLayout] Failed to upload editor image:", err);
        alert("Image upload failed. Please try again.");
      } finally {
        setIsUploadingEditorImage(false);
      }
    },
    [currentTemplate, updateEditable, user?.id]
  );

  const selectedBlock =
    currentTemplate?.blocks.find((b) => b.blockId === selectedBlockId) ?? null;

  const hasBlocks = (currentTemplate?.blocks?.length ?? 0) > 0;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
        <nav className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between flex-shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBackToDashboard}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all group shrink-0"
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

              <span className="hidden sm:inline">Back to Dashboard</span>
            </button>

            <div className="w-px h-6 bg-gray-200 shrink-0" />

            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">LP</span>
            </div>

            <div className="min-w-0">
              <h1 className="font-bold text-gray-800 text-sm leading-none truncate max-w-xs">
                {templateName ?? "Landing Page Builder"}
              </h1>

              <p className="text-xs text-gray-400 mt-0.5">
                {currentTemplate
                  ? `${currentTemplate.blocks.length} section${
                      currentTemplate.blocks.length !== 1 ? "s" : ""
                    }`
                  : "Drag blocks from the left panel to start"}
              </p>
            </div>
          </div>

          <div className="text-xs text-gray-400 hidden md:block">
            {isUploadingEditorImage
              ? "🖼 Uploading image..."
              : isSaving
                ? "💾 Saving..."
                : lastSaved
                  ? `✅ Saved ${new Date(lastSaved).toLocaleTimeString()}`
                  : "⬜ Not saved yet"}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-500 transition font-medium"
            >
              Reset
            </button>

            <button
              onClick={handlePreview}
              disabled={!hasBlocks}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Preview
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || isUploadingEditorImage}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>

            <button
              onClick={handleExport}
              disabled={!hasBlocks || !currentTemplate}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                exported
                  ? "bg-emerald-500 text-white"
                  : "bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700"
              }`}
            >
              {exported ? "Exported!" : "Export ZIP"}
            </button>

            <div className="flex items-center gap-2 ml-1 pl-2 border-l border-gray-100">
              <span className="text-xs text-gray-500 hidden sm:inline">{user?.name}</span>

              <button
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-red-500 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </nav>

        <div className="flex flex-1 overflow-hidden">
          <BlockPanel
            draggingOption={draggingOption}
            canvasBlockIds={canvasBlockIds}
          />

          <DragandDrop activeDropZone={activeDropZone} />

          <Canvas
            draggingOption={draggingOption}
            activeDropZone={activeDropZone}
          />

          <PropertiesPanel
            selectedBlock={selectedBlock}
            template={currentTemplate}
            pageSettings={pageScripts}
            onPageSettingsChange={handlePageSettingsChange}
            onEditableChange={handleEditableChange}
            onCssVarChange={handleCssVarChange}
            onClassSwap={handleClassSwap}
            onBlockStyleChange={updateBlockStyle}
            resolveLiveColor={resolveLiveColor}
          />
        </div>
      </div>

      <DragOverlay modifiers={[restrictToWindowEdges]}>
        <DragOverlayCard
          option={draggingOption}
          standaloneBlock={draggingStandalone}
        />
      </DragOverlay>
    </DndContext>
  );
}