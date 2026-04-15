import { create } from "zustand";
import type { Template, ParsedBlock, PageScripts, BlockInstance } from "../types";

function swapBlockInRawHtml(fullHtml: string, blockId: string, newBlockHtml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHtml, "text/html");
  const el = doc.querySelector(`[data-block="${blockId}"]`);
  if (!el) return fullHtml;
  const temp = parser.parseFromString(newBlockHtml, "text/html");
  const newEl = temp.querySelector(`[data-block="${blockId}"]`);
  if (!newEl) return fullHtml;
  el.replaceWith(newEl);
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}

function parseColorVarsAttr(raw: string): Record<string, string> {
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
  if (ownClass.trim()) {
    return { tailwindClass: ownClass, styleChildSelector: "" };
  }
  const child = el.firstElementChild;
  if (child) {
    const childClass = child.getAttribute("class") || "";
    if (childClass.trim()) {
      const tag = child.tagName.toLowerCase();
      return { tailwindClass: childClass, styleChildSelector: `${tag}:nth-child(1)` };
    }
  }
  return { tailwindClass: "", styleChildSelector: "" };
}

function reparseBlockFromOwnHtml(
  blockHtml: string,
  blockId: string,
): {
  editables: ParsedBlock["editables"];
  colorVars: Record<string, string>;
  styles: { bgColor?: string; textSize?: string; fontWeight?: string };
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(blockHtml, "text/html");
  const el = doc.querySelector(`[data-block="${blockId}"]`);
  if (!el) return { editables: [], colorVars: {}, styles: {} };

  const colorVars = parseColorVarsAttr(el.getAttribute("data-color-vars") || "");
  const editableElements = el.querySelectorAll("[data-editable]");
  const editables = Array.from(editableElements).map((e) => {
    const id = e.getAttribute("data-editable") || "";
    const type = e.getAttribute("data-editable-type") || "text";
    const styleId = e.getAttribute("data-style-id") || "";
    const styleProps = (e.getAttribute("data-style-props") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");
    const colorVarsRaw = e.getAttribute("data-color-vars") || "";
    const colorVars = parseColorVarsAttr(colorVarsRaw);
    const content = type === "image" ? e.getAttribute("src") || "" : (e.textContent || "").trim();
    const { tailwindClass, styleChildSelector } = readTailwindClass(e);
    return { id, type: type as "text" | "image" | "link", content, colorVars, tailwindClass, styleProps, styleId, styleChildSelector };
  });

  const styles: { bgColor?: string; textSize?: string; fontWeight?: string } = {};
  const inlineStyle = (el as HTMLElement).style;
  if (inlineStyle.backgroundColor) styles.bgColor = inlineStyle.backgroundColor;
  if (inlineStyle.fontSize) styles.textSize = inlineStyle.fontSize;
  if (inlineStyle.fontWeight) styles.fontWeight = inlineStyle.fontWeight;

  return { editables, colorVars, styles };
}

function reparseBlock(fullHtml: string, blockId: string): Partial<ParsedBlock> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHtml, "text/html");
  const el = doc.querySelector(`[data-block="${blockId}"]`);
  if (!el) return {};

  const wrapperColorVars = parseColorVarsAttr(el.getAttribute("data-color-vars") || "");
  const editableElements = el.querySelectorAll("[data-editable]");
  const editables = Array.from(editableElements).map((e) => {
    const id = e.getAttribute("data-editable") || "";
    const type = e.getAttribute("data-editable-type") || "text";
    const styleId = e.getAttribute("data-style-id") || "";
    const styleProps = (e.getAttribute("data-style-props") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");
    const colorVarsRaw = e.getAttribute("data-color-vars") || "";
    const colorVars = parseColorVarsAttr(colorVarsRaw);
    const content = type === "image" ? e.getAttribute("src") || "" : (e.textContent || "").trim();
    const { tailwindClass, styleChildSelector } = readTailwindClass(e);
    return { id, type: type as "text" | "image" | "link", content, colorVars, tailwindClass, styleProps, styleId, styleChildSelector };
  });

  const inlineStyle = (el as HTMLElement).style;
  const styles: { bgColor?: string; textSize?: string; fontWeight?: string } = {};
  if (inlineStyle.backgroundColor) styles.bgColor = inlineStyle.backgroundColor;
  if (inlineStyle.fontSize) styles.textSize = inlineStyle.fontSize;
  if (inlineStyle.fontWeight) styles.fontWeight = inlineStyle.fontWeight;

  return { editables, rawHtml: el.outerHTML, colorVars: wrapperColorVars, styles };
}

function scopeBlockCssVars(
  blockHtml: string,
  blockId: string,
  sourceCssVars: Record<string, string>,
): { scopedHtml: string; scopedCssVars: Record<string, string>; varRenameMap: Record<string, string> } {
  if (!sourceCssVars || Object.keys(sourceCssVars).length === 0) {
    return { scopedHtml: blockHtml, scopedCssVars: {}, varRenameMap: {} };
  }
  const varRenameMap: Record<string, string> = {};
  const scopedCssVars: Record<string, string> = {};
  Object.entries(sourceCssVars).forEach(([varName, value]) => {
    const scopedName = varName.replace("--", `--${blockId}-`);
    varRenameMap[varName] = scopedName;
    scopedCssVars[scopedName] = value;
  });
  let scopedHtml = blockHtml;
  Object.entries(varRenameMap).forEach(([oldVar, newVar]) => {
    const escaped = oldVar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    scopedHtml = scopedHtml.replace(new RegExp(`var\\(${escaped}(\\s*[,)])`, "g"), `var(${newVar}$1`);
    scopedHtml = scopedHtml.replace(new RegExp(`var\\(${escaped}\\)`, "g"), `var(${newVar})`);
    scopedHtml = scopedHtml.replace(new RegExp(`(data-color-vars="[^"]*?)${escaped}([^"]*")`, "g"), `$1${newVar}$2`);
  });
  return { scopedHtml, scopedCssVars, varRenameMap };
}

/**
 * Scopes all data-editable IDs and data-style-id attributes in a standalone block's HTML
 * to prevent collisions with template blocks that share the same IDs.
 *
 * e.g. data-editable="hero-badge"      → data-editable="block_123abc-hero-badge"
 *      data-style-id="hero-btn-primary" → data-style-id="block_123abc-hero-btn-primary"
 *
 * Returns:
 *   scopedHtml   — HTML with all IDs renamed
 *   idRenameMap  — { "hero-badge": "block_123abc-hero-badge", ... }
 */
function scopeBlockEditableIds(html: string, blockId: string): { scopedHtml: string; idRenameMap: Record<string, string> } {
  const idRenameMap: Record<string, string> = {};

  // Scope data-editable="..."
  let scopedHtml = html.replace(/data-editable="([^"]+)"/g, (_: string, oldId: string) => {
    const newId = `${blockId}-${oldId}`;
    idRenameMap[oldId] = newId;
    return `data-editable="${newId}"`;
  });

  // Scope data-style-id="..."
  scopedHtml = scopedHtml.replace(/data-style-id="([^"]+)"/g, (_: string, oldId: string) => {
    const newId = `${blockId}-${oldId}`;
    // Only add to map if not already added via data-editable pass
    if (!idRenameMap[oldId]) idRenameMap[oldId] = newId;
    return `data-style-id="${newId}"`;
  });

  return { scopedHtml, idRenameMap };
}

function injectCssVarsIntoHtml(rawHtml: string, cssVariables: Record<string, string>): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");
  let styleEl = doc.getElementById("lp-css-vars") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = doc.createElement("style");
    styleEl.id = "lp-css-vars";
    doc.head.appendChild(styleEl);
  }
  const varLines = Object.entries(cssVariables)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  styleEl.textContent = `:root {\n${varLines}\n}`;
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}

function rebuildRawHtml(blocks: ParsedBlock[], baseHtml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(baseHtml, "text/html");
  doc.body.innerHTML = "";
  blocks.forEach((block) => {
    const blockDoc = parser.parseFromString(block.rawHtml || "", "text/html");
    const blockEl = blockDoc.querySelector(`[data-block="${block.blockId}"]`) ?? blockDoc.body.firstElementChild;
    if (blockEl) doc.body.appendChild(blockEl.cloneNode(true));
  });
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}

function patchDataBlockAttr(html: string, oldId: string, newId: string): string {
  return html.replace(new RegExp(`data-block="${oldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g"), `data-block="${newId}"`);
}

function applyInlineStyleToBlockHtml(blockHtml: string, blockId: string, styleKey: string, value: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(blockHtml, "text/html");
  const el = doc.querySelector(`[data-block="${blockId}"]`) as HTMLElement | null;
  if (!el) return blockHtml;
  el.style[styleKey as any] = value;
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}

interface EditorState {
  currentTemplate: Template | null;
  selectedBlockId: string | null;
  canvasBlocks: BlockInstance[];
  templateName: string | null;
  pageScripts: PageScripts;
  lastSaved: string | null;
  isSaving: boolean;

  loadTemplate: (template: Template) => void;
  selectBlock: (blockId: string | null) => void;
  addBlockToTemplate: (block: ParsedBlock, insertAfterIndex?: number) => void;
  removeBlockFromTemplate: (blockId: string) => void;
  updateEditable: (editableId: string, newContent: string) => void;
  updateCssVar: (varName: string, newValue: string) => void;
  updateClassSwap: (editableId: string, newClassList: string) => void;
  updateBlockStyle: (blockId: string, styleKey: string, value: string) => void;
  swapBlock: (blockId: string, newBlock: ParsedBlock) => void;
  reorderBlocks: (activeId: string, overId: string) => void;
  addBlock: (block: BlockInstance) => void;
  removeBlock: (instanceId: string) => void;
  updateBlockContent: (instanceId: string, content: Record<string, any>) => void;
  updateBlockStyles: (instanceId: string, styles: Record<string, any>) => void;
  saveToStorage: (userId: string) => void;
  loadFromStorage: (userId: string) => void;
  resetEditor: () => void;
}

const DEFAULT_SCRIPTS: PageScripts = { gtmId: "", headScripts: "", bodyScripts: "" };

export const useEditorStore = create<EditorState>((set, get) => ({
  currentTemplate: null,
  selectedBlockId: null,
  canvasBlocks: [],
  templateName: null,
  pageScripts: DEFAULT_SCRIPTS,
  lastSaved: null,
  isSaving: false,

  loadTemplate: (template) => {
    const reparsedBlocks = template.blocks.map((block) => {
      const reparsed = reparseBlock(template.rawHtml, block.blockId);
      return {
        ...block,
        editables: reparsed.editables ?? block.editables,
        colorVars: reparsed.colorVars ?? block.colorVars,
        rawHtml: reparsed.rawHtml ?? block.rawHtml,
        styles: reparsed.styles ?? {},
      };
    });
    set({
      currentTemplate: { ...template, blocks: reparsedBlocks },
      templateName: template.templateName,
      selectedBlockId: null,
      pageScripts: template.pageScripts ?? DEFAULT_SCRIPTS,
    });
  },

  selectBlock: (blockId) => set({ selectedBlockId: blockId }),

  addBlockToTemplate: (block, insertAfterIndex) => {
    const { currentTemplate } = get();
    const base: Template = currentTemplate ?? {
      id: `tpl_canvas_${Date.now()}`,
      templateName: "My Page",
      category: "custom",
      createdAt: new Date().toISOString().split("T")[0],
      cssVariables: {},
      blocks: [],
      rawHtml: '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body></body></html>',
      pageScripts: { gtmId: "", headScripts: "", bodyScripts: "" },
    };

    let newBlocks = [...base.blocks];
    let freshRawHtml = block.rawHtml ?? "";
    let sourceCssVars: Record<string, string> = {};

    const isStandalone = !block.sourceTemplateId || block.sourceTemplateId.startsWith("standalone::");

    if (block.sourceTemplateId && !block.sourceTemplateId.startsWith("standalone::")) {
      try {
        const templates: Template[] = JSON.parse(localStorage.getItem("lp_templates") || "[]");
        const srcTemplate = templates.find((t) => t.id === block.sourceTemplateId);
        if (srcTemplate) {
          const parser = new DOMParser();
          const srcDoc = parser.parseFromString(srcTemplate.rawHtml, "text/html");
          const el = srcDoc.querySelector(`[data-block="${block.blockId}"]`);
          if (el) freshRawHtml = el.outerHTML;
          sourceCssVars = srcTemplate.cssVariables ?? {};
        }
      } catch (e) {
        console.error("[addBlockToTemplate]", e);
      }
    } else if (block.sourceTemplateId?.startsWith("standalone::")) {
      sourceCssVars = (block as any).cssVariables ?? {};
    }

    const existsAlready = newBlocks.some((b) => b.blockId === block.blockId || b.blockId.startsWith(block.blockId + "_"));
    const uniqueBlockId = existsAlready ? `${block.blockId}_${Date.now()}` : block.blockId;

    // ── STEP 1: Scope CSS variables (--hero-bg → --block_123-hero-bg) ──────────
    const { scopedHtml: cssVarScopedHtml, scopedCssVars, varRenameMap } = scopeBlockCssVars(freshRawHtml, uniqueBlockId, sourceCssVars);

    // ── STEP 2: Patch data-block attr if blockId changed ─────────────────────
    const blockIdPatchedHtml = uniqueBlockId !== block.blockId ? patchDataBlockAttr(cssVarScopedHtml, block.blockId, uniqueBlockId) : cssVarScopedHtml;

    // ── STEP 3 (NEW): For standalone blocks, scope data-editable + data-style-id
    //    This prevents collisions when template already has same IDs
    //    e.g. both template hero and standalone hero have data-editable="hero-badge"
    //    After scoping: standalone gets data-editable="block_123abc-hero-badge"
    let finalScopedHtml = blockIdPatchedHtml;
    let idRenameMap: Record<string, string> = {};

    if (isStandalone) {
      const result = scopeBlockEditableIds(blockIdPatchedHtml, uniqueBlockId);
      finalScopedHtml = result.scopedHtml;
      idRenameMap = result.idRenameMap;
    }

    let scopedEditables: ParsedBlock["editables"];
    let scopedColorVars: Record<string, string>;
    let styles: { bgColor?: string; textSize?: string; fontWeight?: string };

    if (isStandalone && block.editables && block.editables.length > 0) {
      // ── Remap editables to use scoped IDs + scoped CSS var names ─────────────
      scopedEditables = block.editables.map((e) => {
        // Remap colorVars: { "text-color": "--hero-badge-text-color" }
        //               → { "text-color": "--block_123-hero-badge-text-color" }
        const remappedColorVars: Record<string, string> = {};
        Object.entries(e.colorVars ?? {}).forEach(([prop, varName]) => {
          remappedColorVars[prop] = varRenameMap[varName] ?? varName;
        });

        return {
          ...e,
          // Remap id: "hero-badge" → "block_123abc-hero-badge"
          id: idRenameMap[e.id] ?? e.id,
          // Remap styleId: "hero-btn-primary" → "block_123abc-hero-btn-primary"
          styleId: idRenameMap[e.styleId] ?? e.styleId,
          colorVars: remappedColorVars,
          tailwindClass: e.tailwindClass ?? "",
        };
      });
      scopedColorVars = (block as any).colorVars ?? {};
      styles = (block as any).styles ?? {};
    } else {
      // Template block — reparse from scoped HTML
      const reparsed = reparseBlockFromOwnHtml(finalScopedHtml, uniqueBlockId);
      scopedEditables = reparsed.editables;
      scopedColorVars = reparsed.colorVars;
      styles = reparsed.styles;
    }

    const mergedCssVariables = { ...(base.cssVariables ?? {}), ...scopedCssVars };

    const blockToInsert: ParsedBlock = {
      ...block,
      blockId: uniqueBlockId,
      rawHtml: finalScopedHtml, // ✅ uses fully scoped HTML
      colorVars: scopedColorVars,
      editables: scopedEditables,
      styles,
    };

    let insertAt: number;
    if (insertAfterIndex === -1) insertAt = 0;
    else if (insertAfterIndex === undefined) insertAt = newBlocks.length;
    else insertAt = Math.min(insertAfterIndex + 1, newBlocks.length);

    newBlocks.splice(insertAt, 0, { ...blockToInsert, blockOrder: insertAt + 1 });
    const reordered = newBlocks.map((b, i) => ({ ...b, blockOrder: i + 1 }));
    const rebuiltHtml = rebuildRawHtml(reordered, base.rawHtml);
    const finalHtml = injectCssVarsIntoHtml(rebuiltHtml, mergedCssVariables);

    set({
      currentTemplate: {
        ...base,
        blocks: reordered,
        rawHtml: finalHtml,
        cssVariables: mergedCssVariables,
      },
      templateName: base.templateName,
    });
  },

  removeBlockFromTemplate: (blockId) => {
    const { currentTemplate } = get();
    if (!currentTemplate) return;
    const newBlocks = currentTemplate.blocks.filter((b) => b.blockId !== blockId).map((b, i) => ({ ...b, blockOrder: i + 1 }));
    const newRawHtml = rebuildRawHtml(newBlocks, currentTemplate.rawHtml);
    set({
      currentTemplate: { ...currentTemplate, blocks: newBlocks, rawHtml: newRawHtml },
      selectedBlockId: get().selectedBlockId === blockId ? null : get().selectedBlockId,
    });
  },

  updateEditable: (editableId, newContent) =>
    set((state) => {
      const { currentTemplate } = state;
      if (!currentTemplate) return state;
      const parser = new DOMParser();
      const updatedBlocks = currentTemplate.blocks.map((block) => {
        const editable = block.editables.find((e) => e.id === editableId);
        if (!editable) return block;
        const blockDoc = parser.parseFromString(block.rawHtml ?? "", "text/html");
        const el = blockDoc.querySelector(`[data-editable="${editableId}"]`);
        if (el) {
          if (editable.type === "image") el.setAttribute("src", newContent);
          else if (editable.type === "link") el.setAttribute("href", newContent);
          else {
            const textNodes = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE);
            if (textNodes.length > 0) textNodes[0].textContent = newContent;
            else el.textContent = newContent;
          }
        }
        return {
          ...block,
          rawHtml: "<!DOCTYPE html>\n" + blockDoc.documentElement.outerHTML,
          editables: block.editables.map((e) => (e.id === editableId ? { ...e, content: newContent } : e)),
        };
      });
      return {
        currentTemplate: {
          ...currentTemplate,
          blocks: updatedBlocks,
          rawHtml: rebuildRawHtml(updatedBlocks, currentTemplate.rawHtml),
        },
      };
    }),

  updateCssVar: (varName, value) =>
    set((state) => {
      const { currentTemplate } = state;
      if (!currentTemplate) return state;
      const newCssVariables = { ...currentTemplate.cssVariables, [varName]: value };
      const rebuiltHtml = rebuildRawHtml(currentTemplate.blocks, currentTemplate.rawHtml);
      const finalHtml = injectCssVarsIntoHtml(rebuiltHtml, newCssVariables);
      return {
        currentTemplate: {
          ...currentTemplate,
          cssVariables: newCssVariables,
          rawHtml: finalHtml,
        },
      };
    }),

  updateClassSwap: (editableId, newClassList) => {
    const { currentTemplate } = get();
    if (!currentTemplate) return;

    const RESPONSIVE_RE = /\b(?:sm|md|lg|xl|2xl):[\w/-]+\b/g;
    const cleanClassList = newClassList.replace(RESPONSIVE_RE, "").replace(/\s+/g, " ").trim();

    let block = currentTemplate.blocks.find((b) => b.editables.some((e) => e.id === editableId));
    let editable = block?.editables.find((e) => e.id === editableId);
    if (!block || !editable) {
      block = currentTemplate.blocks.find((b) => b.editables.some((e) => e.styleId === editableId));
      editable = block?.editables.find((e) => e.styleId === editableId);
    }
    if (!block || !editable) return;

    const parser = new DOMParser();

    const updatedBlocks = currentTemplate.blocks.map((b) => {
      if (b.blockId !== block!.blockId) return b;

      const blockDoc = parser.parseFromString(b.rawHtml ?? "", "text/html");

      let targetEl: Element | null = null;
      if (editable!.styleId) {
        targetEl = blockDoc.querySelector(`[data-style-id="${editable!.styleId}"]`);
      }
      if (!targetEl) {
        targetEl = blockDoc.querySelector(`[data-editable="${editable!.id}"]`);
      }

      if (targetEl) {
        const styleChildSelector = (editable as any).styleChildSelector;
        if (styleChildSelector) {
          const childEl = targetEl.querySelector(styleChildSelector);
          if (childEl) childEl.className = cleanClassList;
          else targetEl.className = cleanClassList;
        } else {
          targetEl.className = cleanClassList;
        }
      }

      const newBlockRawHtml = "<!DOCTYPE html>\n" + blockDoc.documentElement.outerHTML;

      return {
        ...b,
        rawHtml: newBlockRawHtml,
        editables: b.editables.map((e) => (e.id === editable!.id ? { ...e, tailwindClass: cleanClassList } : e)),
      };
    });

    // ✅ Rebuild currentTemplate.rawHtml so Canvas Effect 1b fires → iframe reloads
    const rebuiltHtml = rebuildRawHtml(updatedBlocks, currentTemplate.rawHtml);
    const finalHtml = injectCssVarsIntoHtml(rebuiltHtml, currentTemplate.cssVariables ?? {});

    set({
      currentTemplate: {
        ...currentTemplate,
        blocks: updatedBlocks,
        rawHtml: finalHtml,
      },
    });
  },

  updateBlockStyle: (blockId, styleKey, value) => {
    const { currentTemplate } = get();
    if (!currentTemplate) return;

    // Map styleKey to the correct property name
    const stylePropMap: Record<string, string> = {
      backgroundColor: "bgColor",
      fontSize: "textSize",
      fontWeight: "fontWeight",
    };
    const styleProp = stylePropMap[styleKey] || styleKey;

    const updatedBlocks = currentTemplate.blocks.map((block) => {
      if (block.blockId !== blockId) return block;
      return {
        ...block,
        rawHtml: applyInlineStyleToBlockHtml(block.rawHtml ?? "", blockId, styleKey, value),
        styles: { ...(block.styles ?? {}), [styleProp]: value },
      };
    });
    set({
      currentTemplate: {
        ...currentTemplate,
        blocks: updatedBlocks,
        rawHtml: rebuildRawHtml(updatedBlocks, currentTemplate.rawHtml),
      },
    });
  },

  swapBlock: (blockId, newBlock) => {
    const { currentTemplate } = get();
    if (!currentTemplate) return;
    set({
      currentTemplate: {
        ...currentTemplate,
        rawHtml: swapBlockInRawHtml(currentTemplate.rawHtml, blockId, newBlock.rawHtml),
        blocks: currentTemplate.blocks.map((b) => (b.blockId === blockId ? { ...newBlock } : b)),
      },
    });
  },

  reorderBlocks: (activeId, overId) => {
    const { currentTemplate, canvasBlocks } = get();
    if (currentTemplate) {
      const blocks = [...currentTemplate.blocks];
      const fromIdx = blocks.findIndex((b) => b.blockId === activeId);
      const toIdx = blocks.findIndex((b) => b.blockId === overId);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = blocks.splice(fromIdx, 1);
      blocks.splice(toIdx, 0, moved);
      const reordered = blocks.map((b, i) => ({ ...b, blockOrder: i + 1 }));
      set({
        currentTemplate: {
          ...currentTemplate,
          rawHtml: rebuildRawHtml(reordered, currentTemplate.rawHtml),
          blocks: reordered,
        },
      });
      return;
    }
    const fromIdx = canvasBlocks.findIndex((b) => b.instanceId === activeId);
    const toIdx = canvasBlocks.findIndex((b) => b.instanceId === overId);
    if (fromIdx === -1 || toIdx === -1) return;
    const updated = [...canvasBlocks];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    set({ canvasBlocks: updated.map((b, i) => ({ ...b, order: i + 1 })) });
  },

  addBlock: (block) => set((s) => ({ canvasBlocks: [...s.canvasBlocks, block] })),

  removeBlock: (instanceId) =>
    set((s) => ({
      canvasBlocks: s.canvasBlocks.filter((b) => b.instanceId !== instanceId),
      selectedBlockId: s.selectedBlockId === instanceId ? null : s.selectedBlockId,
    })),

  updateBlockContent: (instanceId, content) =>
    set((s) => ({
      canvasBlocks: s.canvasBlocks.map((b) => (b.instanceId === instanceId ? { ...b, content: { ...b.content, ...content } } : b)),
    })),

  updateBlockStyles: (instanceId, styles) =>
    set((s) => ({
      canvasBlocks: s.canvasBlocks.map((b) => (b.instanceId === instanceId ? { ...b, styles: { ...b.styles, ...styles } } : b)),
    })),

  saveToStorage: (userId) => {
    const { currentTemplate, canvasBlocks, pageScripts } = get();
    set({ isSaving: true });
    setTimeout(() => {
      try {
        let templateToSave = currentTemplate ? { ...currentTemplate, blocks: currentTemplate.blocks.map((b) => ({ ...b, styles: b.styles ?? {} })) } : null;
        if (templateToSave && templateToSave.blocks.length > 0) {
          const rebuilt = rebuildRawHtml(templateToSave.blocks as ParsedBlock[], templateToSave.rawHtml);
          templateToSave = { ...templateToSave, rawHtml: injectCssVarsIntoHtml(rebuilt, templateToSave.cssVariables ?? {}) };
        }
        localStorage.setItem(
          `editor_save_${userId}`,
          JSON.stringify({
            currentTemplate: templateToSave,
            canvasBlocks,
            pageScripts,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch (e) {
        console.error("[saveToStorage]", e);
      }
      set({ isSaving: false, lastSaved: new Date().toISOString() });
    }, 400);
  },

  loadFromStorage: (userId) => {
    try {
      const raw = localStorage.getItem(`editor_save_${userId}`);
      if (!raw) return;
      const data = JSON.parse(raw);
      const savedTemplate: Template | null = data.currentTemplate ?? null;

      if (savedTemplate) {
        savedTemplate.blocks = savedTemplate.blocks.map((block) => {
          // ✅ KEY FIX: If block already has editables saved, USE THEM AS-IS
          // Do NOT re-parse — re-parsing reads inline styles from HTML
          // and LOSES cssVariable-based color changes (which live in
          // cssVariables object, not as inline styles on elements)
          if (block.editables && block.editables.length > 0 && block.rawHtml) {
            return { ...block, styles: block.styles ?? {} }; // ✅ keep saved state
          }

          // Only re-parse if editables are missing (legacy saves)
          let blockRawHtml = block.rawHtml;
          if (!blockRawHtml && block.sourceTemplateId && !block.sourceTemplateId.startsWith("standalone::")) {
            try {
              const allTemplates: Template[] = JSON.parse(localStorage.getItem("lp_templates") || "[]");
              const srcTemplate = allTemplates.find((t) => t.id === block.sourceTemplateId);
              if (srcTemplate) {
                const parser = new DOMParser();
                const srcDoc = parser.parseFromString(srcTemplate.rawHtml, "text/html");
                const el = srcDoc.querySelector(`[data-block="${block.blockId}"]`) ?? srcDoc.querySelector(`[data-block="${block.blockId.split("_")[0]}"]`);
                if (el) {
                  const { scopedHtml } = scopeBlockCssVars(el.outerHTML, block.blockId, srcTemplate.cssVariables ?? {});
                  blockRawHtml = scopedHtml;
                }
              }
            } catch {
              /* ignore */
            }
          }

          const { colorVars, editables, styles } = reparseBlockFromOwnHtml(blockRawHtml || "", block.blockId);
          return { ...block, rawHtml: blockRawHtml, colorVars, editables, styles };
        });
      }

      set({
        currentTemplate: savedTemplate,
        canvasBlocks: data.canvasBlocks ?? [],
        pageScripts: data.pageScripts ?? DEFAULT_SCRIPTS,
        templateName: savedTemplate?.templateName ?? null,
        lastSaved: data.savedAt ?? null,
      });
    } catch (e) {
      console.error("[loadFromStorage]", e);
    }
  },

  resetEditor: () =>
    set({
      currentTemplate: null,
      selectedBlockId: null,
      canvasBlocks: [],
      templateName: null,
      pageScripts: DEFAULT_SCRIPTS,
      lastSaved: null,
    }),
}));
