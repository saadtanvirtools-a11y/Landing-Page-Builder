import { create } from "zustand";
import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { Template, ParsedBlock, PageScripts, BlockInstance } from "../types";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function getUserProjectDocId(userId: string, templateId: string): string {
  return `${userId}__${templateId}`;
}

function swapBlockInRawHtml(fullHtml: string, blockId: string, newBlockHtml: string): string {
  const parser = new DOMParser();
  const doc2 = parser.parseFromString(fullHtml, "text/html");
  const el = doc2.querySelector(`[data-block="${blockId}"]`);
  if (!el) return fullHtml;

  const temp = parser.parseFromString(newBlockHtml, "text/html");
  const newEl = temp.querySelector(`[data-block="${blockId}"]`);
  if (!newEl) return fullHtml;

  el.replaceWith(newEl);
  return "<!DOCTYPE html>\n" + doc2.documentElement.outerHTML;
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
  if (ownClass.trim()) return { tailwindClass: ownClass, styleChildSelector: "" };

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

function extractSvgMarkup(el: Element): string {
  if (el.tagName.toLowerCase() === "svg") {
    return el.outerHTML.trim();
  }

  const directSvg = Array.from(el.children).find(
    (child) => child.tagName.toLowerCase() === "svg"
  );
  if (directSvg) return directSvg.outerHTML.trim();

  const nestedSvg = el.querySelector("svg");
  if (nestedSvg) return nestedSvg.outerHTML.trim();

  return (el.innerHTML || "").trim();
}

function isSvgMarkup(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("<svg") && trimmed.includes("</svg>");
}

function readEditableContent(el: Element, type: string): string {
  if (type === "image") {
    return el.getAttribute("src") || (el as HTMLImageElement).src || "";
  }

  if (type === "link") {
    return el.getAttribute("href") || "";
  }

  if (type === "svg") {
    return extractSvgMarkup(el);
  }

  // ✅ Important:
  // If a "text" editable contains an inline SVG, return the SVG markup instead of textContent.
  const nestedSvg = el.querySelector("svg");
  if (nestedSvg) {
    return nestedSvg.outerHTML.trim();
  }

  return (el.textContent || "").trim();
}

function reparseBlockFromOwnHtml(
  blockHtml: string,
  blockId: string
): {
  editables: ParsedBlock["editables"];
  colorVars: Record<string, string>;
  styles: { bgColor?: string; textSize?: string; fontWeight?: string };
} {
  const parser = new DOMParser();
  const doc2 = parser.parseFromString(blockHtml, "text/html");
  const el = doc2.querySelector(`[data-block="${blockId}"]`);
  if (!el) return { editables: [], colorVars: {}, styles: {} };

  const colorVars = parseColorVarsAttr(el.getAttribute("data-color-vars") || "");
  const editables = Array.from(el.querySelectorAll("[data-editable]")).map((e) => {
    const id = e.getAttribute("data-editable") || "";
    const type = e.getAttribute("data-editable-type") || "text";
    const styleId = e.getAttribute("data-style-id") || "";
    const styleProps = (e.getAttribute("data-style-props") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");
    const colorVarsRaw = e.getAttribute("data-color-vars") || "";
    const content = readEditableContent(e, type);
    const { tailwindClass, styleChildSelector } = readTailwindClass(e);

    return {
      id,
      type: type as "text" | "image" | "link" | "svg",
      content,
      colorVars: parseColorVarsAttr(colorVarsRaw),
      tailwindClass,
      styleProps,
      styleId,
      styleChildSelector,
    };
  });

  const inlineStyle = (el as HTMLElement).style;
  const styles: { bgColor?: string; textSize?: string; fontWeight?: string } = {};
  if (inlineStyle.backgroundColor) styles.bgColor = inlineStyle.backgroundColor;
  if (inlineStyle.fontSize) styles.textSize = inlineStyle.fontSize;
  if (inlineStyle.fontWeight) styles.fontWeight = inlineStyle.fontWeight;

  return { editables, colorVars, styles };
}

function reparseBlock(fullHtml: string, blockId: string): Partial<ParsedBlock> {
  const parser = new DOMParser();
  const doc2 = parser.parseFromString(fullHtml, "text/html");
  const el = doc2.querySelector(`[data-block="${blockId}"]`);
  if (!el) return {};

  const wrapperColorVars = parseColorVarsAttr(el.getAttribute("data-color-vars") || "");
  const editables = Array.from(el.querySelectorAll("[data-editable]")).map((e) => {
    const id = e.getAttribute("data-editable") || "";
    const type = e.getAttribute("data-editable-type") || "text";
    const styleId = e.getAttribute("data-style-id") || "";
    const styleProps = (e.getAttribute("data-style-props") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");
    const content = readEditableContent(e, type);
    const { tailwindClass, styleChildSelector } = readTailwindClass(e);

    return {
      id,
      type: type as "text" | "image" | "link" | "svg",
      content,
      colorVars: parseColorVarsAttr(e.getAttribute("data-color-vars") || ""),
      tailwindClass,
      styleProps,
      styleId,
      styleChildSelector,
    };
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
  sourceCssVars: Record<string, string>
): {
  scopedHtml: string;
  scopedCssVars: Record<string, string>;
  varRenameMap: Record<string, string>;
} {
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
    scopedHtml = scopedHtml.replace(
      new RegExp(`(data-color-vars="[^"]*?)${escaped}([^"]*")`, "g"),
      `$1${newVar}$2`
    );
  });

  return { scopedHtml, scopedCssVars, varRenameMap };
}

function scopeBlockEditableIds(
  html: string,
  blockId: string
): { scopedHtml: string; idRenameMap: Record<string, string> } {
  const idRenameMap: Record<string, string> = {};

  let scopedHtml = html.replace(/data-editable="([^"]+)"/g, (_: string, oldId: string) => {
    const newId = `${blockId}-${oldId}`;
    idRenameMap[oldId] = newId;
    return `data-editable="${newId}"`;
  });

  scopedHtml = scopedHtml.replace(/data-style-id="([^"]+)"/g, (_: string, oldId: string) => {
    const newId = `${blockId}-${oldId}`;
    if (!idRenameMap[oldId]) idRenameMap[oldId] = newId;
    return `data-style-id="${newId}"`;
  });

  return { scopedHtml, idRenameMap };
}

function injectCssVarsIntoHtml(rawHtml: string, cssVariables: Record<string, string>): string {
  const parser = new DOMParser();
  const doc2 = parser.parseFromString(rawHtml, "text/html");
  let styleEl = doc2.getElementById("lp-css-vars") as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = doc2.createElement("style");
    styleEl.id = "lp-css-vars";
    doc2.head.appendChild(styleEl);
  }

  const varLines = Object.entries(cssVariables)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  styleEl.textContent = `:root {\n${varLines}\n}`;
  return "<!DOCTYPE html>\n" + doc2.documentElement.outerHTML;
}

function rebuildRawHtml(blocks: ParsedBlock[], baseHtml: string): string {
  const parser = new DOMParser();
  const doc2 = parser.parseFromString(baseHtml, "text/html");
  doc2.body.innerHTML = "";

  blocks.forEach((block) => {
    const blockDoc = parser.parseFromString(block.rawHtml || "", "text/html");
    const blockEl =
      blockDoc.querySelector(`[data-block="${block.blockId}"]`) ?? blockDoc.body.firstElementChild;
    if (blockEl) doc2.body.appendChild(blockEl.cloneNode(true));
  });

  return "<!DOCTYPE html>\n" + doc2.documentElement.outerHTML;
}

function patchDataBlockAttr(html: string, oldId: string, newId: string): string {
  return html.replace(
    new RegExp(`data-block="${oldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g"),
    `data-block="${newId}"`
  );
}

function applyInlineStyleToBlockHtml(
  blockHtml: string,
  blockId: string,
  styleKey: string,
  value: string
): string {
  const parser = new DOMParser();
  const doc2 = parser.parseFromString(blockHtml, "text/html");
  const el = doc2.querySelector(`[data-block="${blockId}"]`) as HTMLElement | null;
  if (!el) return blockHtml;

  el.style[styleKey as any] = value;
  return "<!DOCTYPE html>\n" + doc2.documentElement.outerHTML;
}

async function saveProjectToFirestore(params: {
  userId: string;
  template: Template | null;
  canvasBlocks: BlockInstance[];
  pageScripts: PageScripts;
}) {
  const { userId, template, canvasBlocks, pageScripts } = params;
  if (!template) return;

  const docId = getUserProjectDocId(userId, template.id);

  await setDoc(
    doc(db, "userProjects", docId),
    {
      id: docId,
      userId,
      templateId: template.id,
      templateName: template.templateName,
      currentTemplate: template,
      canvasBlocks,
      pageScripts,
      updatedAt: serverTimestamp(),
      savedAtIso: new Date().toISOString(),
    },
    { merge: true }
  );
}

async function loadProjectFromFirestore(params: {
  userId: string;
  templateId?: string | null;
}) {
  const { userId, templateId } = params;
  if (!templateId) return null;

  const docId = getUserProjectDocId(userId, templateId);
  const snap = await getDoc(doc(db, "userProjects", docId));
  if (!snap.exists()) return null;
  return snap.data() as any;
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface EditorState {
  currentTemplate: Template | null;
  selectedBlockId: string | null;
  canvasBlocks: BlockInstance[];
  templateName: string | null;
  pageScripts: PageScripts;
  lastSaved: string | null;
  isSaving: boolean;

  updatePageSettings: (data: Partial<PageScripts>) => void;
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
  loadFromStorage: (userId: string, templateId?: string | null) => Promise<void>;
  resetEditor: () => void;
}

const DEFAULT_SCRIPTS: PageScripts = {
  gtmId: "",
  headScripts: "",
  bodyScripts: "",
  pageTitle: "",
  faviconUrl: "",
  metaDescription: "",
  googleAnalyticsId: "",
};

// ─────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────
export const useEditorStore = create<EditorState>((set, get) => ({
  currentTemplate: null,
  selectedBlockId: null,
  canvasBlocks: [],
  templateName: null,
  pageScripts: DEFAULT_SCRIPTS,
  lastSaved: null,
  isSaving: false,

  updatePageSettings: (data) =>
    set((state) => ({
      pageScripts: {
        ...state.pageScripts,
        ...data,
      },
    })),

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
      currentTemplate: {
        ...template,
        blocks: reparsedBlocks,
      },
      templateName: template.templateName,
      selectedBlockId: null,
      pageScripts: {
        ...DEFAULT_SCRIPTS,
        ...(template.pageScripts ?? {}),
      },
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
      pageScripts: { ...DEFAULT_SCRIPTS },
    };

    let newBlocks = [...base.blocks];
    let freshRawHtml = block.rawHtml ?? "";
    let sourceCssVars: Record<string, string> = {};
    const isStandalone = !block.sourceTemplateId || block.sourceTemplateId.startsWith("standalone::");

    const applyBlock = (freshHtml: string, cssVars: Record<string, string>) => {
      const existsAlready = newBlocks.some(
        (b) => b.blockId === block.blockId || b.blockId.startsWith(block.blockId + "_")
      );
      const uniqueBlockId = existsAlready ? `${block.blockId}_${Date.now()}` : block.blockId;

      const {
        scopedHtml: cssVarScopedHtml,
        scopedCssVars,
        varRenameMap,
      } = scopeBlockCssVars(freshHtml, uniqueBlockId, cssVars);

      const blockIdPatchedHtml =
        uniqueBlockId !== block.blockId
          ? patchDataBlockAttr(cssVarScopedHtml, block.blockId, uniqueBlockId)
          : cssVarScopedHtml;

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
        scopedEditables = block.editables.map((e) => {
          const remappedColorVars: Record<string, string> = {};
          Object.entries(e.colorVars ?? {}).forEach(([prop, varName]) => {
            remappedColorVars[prop] = varRenameMap[varName] ?? varName;
          });

          return {
            ...e,
            id: idRenameMap[e.id] ?? e.id,
            styleId: idRenameMap[e.styleId] ?? e.styleId,
            colorVars: remappedColorVars,
            tailwindClass: e.tailwindClass ?? "",
          };
        });

        scopedColorVars = (block as any).colorVars ?? {};
        styles = (block as any).styles ?? {};
      } else {
        const reparsed = reparseBlockFromOwnHtml(finalScopedHtml, uniqueBlockId);
        scopedEditables = reparsed.editables;
        scopedColorVars = reparsed.colorVars;
        styles = reparsed.styles;
      }

      const mergedCssVariables = { ...(base.cssVariables ?? {}), ...scopedCssVars };

      const blockToInsert: ParsedBlock = {
        ...block,
        blockId: uniqueBlockId,
        rawHtml: finalScopedHtml,
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
    };

    if (block.sourceTemplateId && !block.sourceTemplateId.startsWith("standalone::")) {
      getDoc(doc(db, "templates", block.sourceTemplateId))
        .then((snap) => {
          if (snap.exists()) {
            const srcTemplate = snap.data() as Template;
            const parser = new DOMParser();
            const srcDoc = parser.parseFromString(srcTemplate.rawHtml, "text/html");
            const el = srcDoc.querySelector(`[data-block="${block.blockId}"]`);
            if (el) freshRawHtml = el.outerHTML;
            sourceCssVars = srcTemplate.cssVariables ?? {};
          }
          applyBlock(freshRawHtml, sourceCssVars);
        })
        .catch((e) => {
          console.error("[addBlockToTemplate] Firestore error:", e);
          applyBlock(freshRawHtml, sourceCssVars);
        });
    } else {
      if (block.sourceTemplateId?.startsWith("standalone::")) {
        sourceCssVars = (block as any).cssVariables ?? {};
      }
      applyBlock(freshRawHtml, sourceCssVars);
    }
  },

  removeBlockFromTemplate: (blockId) => {
    const { currentTemplate } = get();
    if (!currentTemplate) return;

    const newBlocks = currentTemplate.blocks
      .filter((b) => b.blockId !== blockId)
      .map((b, i) => ({ ...b, blockOrder: i + 1 }));

    const newRawHtml = rebuildRawHtml(newBlocks, currentTemplate.rawHtml);

    set({
      currentTemplate: {
        ...currentTemplate,
        blocks: newBlocks,
        rawHtml: newRawHtml,
      },
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
          if (editable.type === "image") {
            el.setAttribute("src", newContent);
          } else if (editable.type === "link") {
            el.setAttribute("href", newContent);
          } else if (editable.type === "svg") {
            const svgDoc = parser.parseFromString(newContent.trim(), "image/svg+xml");
            const newSvg = svgDoc.documentElement;

            if (el.tagName.toLowerCase() === "svg") {
              if (newSvg && newSvg.tagName.toLowerCase() === "svg") {
                el.replaceWith(blockDoc.importNode(newSvg, true));
              } else {
                (el as HTMLElement).outerHTML = newContent;
              }
            } else {
              const currentSvg = el.querySelector("svg");
              if (currentSvg && newSvg && newSvg.tagName.toLowerCase() === "svg") {
                currentSvg.replaceWith(blockDoc.importNode(newSvg, true));
              } else {
                (el as HTMLElement).innerHTML = newContent;
              }
            }
          } else {
            // ✅ Important:
            // if pasted content is SVG markup, render it instead of showing raw code as text
            if (isSvgMarkup(newContent)) {
              (el as HTMLElement).innerHTML = newContent.trim();
            } else {
              const textNodes = Array.from(el.childNodes).filter(
                (n) => n.nodeType === Node.TEXT_NODE
              );

              if (textNodes.length > 0) {
                textNodes[0].textContent = newContent;
              } else {
                el.textContent = newContent;
              }
            }
          }
        }

        return {
          ...block,
          rawHtml: "<!DOCTYPE html>\n" + blockDoc.documentElement.outerHTML,
          editables: block.editables.map((e) =>
            e.id === editableId ? { ...e, content: newContent } : e
          ),
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
          else (targetEl as HTMLElement).className = cleanClassList;
        } else {
          (targetEl as HTMLElement).className = cleanClassList;
        }
      }

      return {
        ...b,
        rawHtml: "<!DOCTYPE html>\n" + blockDoc.documentElement.outerHTML,
        editables: b.editables.map((e) =>
          e.id === editable!.id ? { ...e, tailwindClass: cleanClassList } : e
        ),
      };
    });

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
      canvasBlocks: s.canvasBlocks.map((b) =>
        b.instanceId === instanceId ? { ...b, content: { ...b.content, ...content } } : b
      ),
    })),

  updateBlockStyles: (instanceId, styles) =>
    set((s) => ({
      canvasBlocks: s.canvasBlocks.map((b) =>
        b.instanceId === instanceId ? { ...b, styles: { ...b.styles, ...styles } } : b
      ),
    })),

  saveToStorage: (userId) => {
    const { currentTemplate, canvasBlocks, pageScripts } = get();
    set({ isSaving: true });

    setTimeout(async () => {
      try {
        let templateToSave = currentTemplate
          ? {
              ...currentTemplate,
              blocks: currentTemplate.blocks.map((b) => ({ ...b, styles: b.styles ?? {} })),
            }
          : null;

        if (templateToSave && templateToSave.blocks.length > 0) {
          const rebuilt = rebuildRawHtml(templateToSave.blocks as ParsedBlock[], templateToSave.rawHtml);
          templateToSave = {
            ...templateToSave,
            rawHtml: injectCssVarsIntoHtml(rebuilt, templateToSave.cssVariables ?? {}),
          };
        }

        const payload = {
          currentTemplate: templateToSave,
          canvasBlocks,
          pageScripts,
          savedAt: new Date().toISOString(),
        };

        localStorage.setItem(`editor_save_${userId}`, JSON.stringify(payload));

        await saveProjectToFirestore({
          userId,
          template: templateToSave,
          canvasBlocks,
          pageScripts,
        });
      } catch (e) {
        console.error("[saveToStorage]", e);
      }

      set({ isSaving: false, lastSaved: new Date().toISOString() });
    }, 400);
  },

  loadFromStorage: async (userId, templateId) => {
    try {
      if (templateId) {
        try {
          const project = await loadProjectFromFirestore({ userId, templateId });
          if (project?.currentTemplate) {
            const savedTemplate: Template = project.currentTemplate;

            const processBlocks = async () => {
              const processedBlocks = await Promise.all(
                savedTemplate.blocks.map(async (block) => {
                  if (block.editables && block.editables.length > 0 && block.rawHtml) {
                    return { ...block, styles: block.styles ?? {} };
                  }

                  let blockRawHtml = block.rawHtml;

                  if (!blockRawHtml && block.sourceTemplateId && !block.sourceTemplateId.startsWith("standalone::")) {
                    try {
                      const snap = await getDoc(doc(db, "templates", block.sourceTemplateId));
                      if (snap.exists()) {
                        const srcTemplate = snap.data() as Template;
                        const parser = new DOMParser();
                        const srcDoc = parser.parseFromString(srcTemplate.rawHtml, "text/html");
                        const el =
                          srcDoc.querySelector(`[data-block="${block.blockId}"]`) ??
                          srcDoc.querySelector(`[data-block="${block.blockId.split("_")[0]}"]`);

                        if (el) {
                          const { scopedHtml } = scopeBlockCssVars(
                            el.outerHTML,
                            block.blockId,
                            srcTemplate.cssVariables ?? {}
                          );
                          blockRawHtml = scopedHtml;
                        }
                      }
                    } catch {
                      // ignore
                    }
                  }

                  const { colorVars, editables, styles } = reparseBlockFromOwnHtml(
                    blockRawHtml || "",
                    block.blockId
                  );
                  return { ...block, rawHtml: blockRawHtml, colorVars, editables, styles };
                })
              );

              set({
                currentTemplate: { ...savedTemplate, blocks: processedBlocks },
                canvasBlocks: project.canvasBlocks ?? [],
                pageScripts: {
                  ...DEFAULT_SCRIPTS,
                  ...(project.pageScripts ?? {}),
                },
                templateName: savedTemplate.templateName ?? null,
                lastSaved: project.savedAtIso ?? null,
              });
            };

            await processBlocks();
            return;
          }
        } catch (fireErr) {
          console.error("[loadFromStorage] Firestore load error:", fireErr);
        }
      }

      const raw = localStorage.getItem(`editor_save_${userId}`);
      if (!raw) return;

      const data = JSON.parse(raw);
      const savedTemplate: Template | null = data.currentTemplate ?? null;

      if (savedTemplate) {
        const processBlocks = async () => {
          const processedBlocks = await Promise.all(
            savedTemplate.blocks.map(async (block) => {
              if (block.editables && block.editables.length > 0 && block.rawHtml) {
                return { ...block, styles: block.styles ?? {} };
              }

              let blockRawHtml = block.rawHtml;

              if (!blockRawHtml && block.sourceTemplateId && !block.sourceTemplateId.startsWith("standalone::")) {
                try {
                  const snap = await getDoc(doc(db, "templates", block.sourceTemplateId));
                  if (snap.exists()) {
                    const srcTemplate = snap.data() as Template;
                    const parser = new DOMParser();
                    const srcDoc = parser.parseFromString(srcTemplate.rawHtml, "text/html");
                    const el =
                      srcDoc.querySelector(`[data-block="${block.blockId}"]`) ??
                      srcDoc.querySelector(`[data-block="${block.blockId.split("_")[0]}"]`);

                    if (el) {
                      const { scopedHtml } = scopeBlockCssVars(
                        el.outerHTML,
                        block.blockId,
                        srcTemplate.cssVariables ?? {}
                      );
                      blockRawHtml = scopedHtml;
                    }
                  }
                } catch {
                  // ignore
                }
              }

              const { colorVars, editables, styles } = reparseBlockFromOwnHtml(
                blockRawHtml || "",
                block.blockId
              );
              return { ...block, rawHtml: blockRawHtml, colorVars, editables, styles };
            })
          );

          set({
            currentTemplate: { ...savedTemplate, blocks: processedBlocks },
            canvasBlocks: data.canvasBlocks ?? [],
            pageScripts: {
              ...DEFAULT_SCRIPTS,
              ...(data.pageScripts ?? {}),
            },
            templateName: savedTemplate.templateName ?? null,
            lastSaved: data.savedAt ?? null,
          });
        };

        await processBlocks();
      } else {
        set({
          currentTemplate: null,
          canvasBlocks: data.canvasBlocks ?? [],
          pageScripts: {
            ...DEFAULT_SCRIPTS,
            ...(data.pageScripts ?? {}),
          },
          lastSaved: data.savedAt ?? null,
        });
      }
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