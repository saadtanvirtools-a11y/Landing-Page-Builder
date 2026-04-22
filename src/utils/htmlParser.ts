import type { CSSVariables, EditableItem, ParsedBlock, Template, PageScripts } from "../types";

// ─────────────────────────────────────────────────────────
// STEP 1 — Extract all CSS variables from :root {} in <style>
// ─────────────────────────────────────────────────────────
function extractCSSVariables(doc: Document): CSSVariables {
  const vars: CSSVariables = {};
  const styleTags = Array.from(doc.querySelectorAll("style"));

  for (const tag of styleTags) {
    const text = tag.textContent || "";
    const rootMatch = text.match(/:root\s*\{([^}]+)\}/s);
    if (!rootMatch) continue;

    const rootBlock = rootMatch[1];
    const varRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let match: RegExpExecArray | null;

    while ((match = varRegex.exec(rootBlock)) !== null) {
      vars[match[1].trim()] = match[2].trim();
    }
  }

  return vars;
}

// ─────────────────────────────────────────────────────────
// STEP 2 — Parse data-color-vars attribute into a map
// safer: split only at first colon
// ─────────────────────────────────────────────────────────
function parseColorVars(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw) return result;

  raw.split(",").forEach((pair) => {
    const colonIdx = pair.indexOf(":");
    if (colonIdx === -1) return;

    const key = pair.slice(0, colonIdx).trim();
    const val = pair.slice(colonIdx + 1).trim();

    if (key && val) result[key] = val;
  });

  return result;
}

// ─────────────────────────────────────────────────────────
// helper — read tailwind class and child selector if needed
// ─────────────────────────────────────────────────────────
function readTailwindClass(el: Element): { tailwindClass: string; styleChildSelector?: string } {
  const ownClass = el.getAttribute("class") || "";
  if (ownClass.trim()) return { tailwindClass: ownClass };

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

  return { tailwindClass: "" };
}

// ─────────────────────────────────────────────────────────
// STEP 3 — Extract all [data-editable] elements inside a block
// ─────────────────────────────────────────────────────────
function extractEditables(blockEl: Element): EditableItem[] {
  const editables: EditableItem[] = [];
  const elements = Array.from(blockEl.querySelectorAll("[data-editable]"));

  for (const el of elements) {
    const id = el.getAttribute("data-editable") || "";
    const type = (el.getAttribute("data-editable-type") || "text") as EditableItem["type"];

    let content = "";

    if (type === "image") {
      content = el.getAttribute("src") || (el as HTMLImageElement).src || "";
    } else if (type === "link") {
      content = el.getAttribute("href") || "";
    } else {
      content = (el.textContent || "").trim();
    }

    const { tailwindClass, styleChildSelector } = readTailwindClass(el);

    editables.push({
      id,
      type,
      content,
      colorVars: parseColorVars(el.getAttribute("data-color-vars") || ""),
      tailwindClass,
      styleProps: el.getAttribute("data-style-props") || "",
      styleId: el.getAttribute("data-style-id") || "",
      styleChildSelector,
    });
  }

  return editables;
}

// ─────────────────────────────────────────────────────────
// STEP 4 — Extract all [data-block] sections
// ─────────────────────────────────────────────────────────
function extractBlocks(doc: Document, templateId: string, templateName: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const blockElements = Array.from(doc.querySelectorAll("[data-block]"));

  for (const el of blockElements) {
    const blockId = el.getAttribute("data-block") || "";
    const blockName = el.getAttribute("data-block-name") || blockId;
    const blockOrder = parseInt(el.getAttribute("data-block-order") || "0", 10);
    const removable = el.getAttribute("data-block-removable") !== "false";

    const wrapperColorVarsRaw = el.getAttribute("data-color-vars") || "";
    const editables = extractEditables(el);
    const rawHtml = el.outerHTML;

    blocks.push({
      blockId,
      blockName,
      blockOrder,
      removable,
      colorVars: parseColorVars(wrapperColorVarsRaw),
      editables,
      rawHtml,
      sourceTemplateId: templateId,
      sourceTemplateName: templateName,
    });
  }

  blocks.sort((a, b) => a.blockOrder - b.blockOrder);
  return blocks;
}

// ─────────────────────────────────────────────────────────
// HELPER — Replace asset paths in HTML before parsing
// ─────────────────────────────────────────────────────────
export function replaceAssetPathsInHtml(html: string, assetMap: Record<string, string>): string {
  if (!html || !assetMap || Object.keys(assetMap).length === 0) {
    return html;
  }

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

// ─────────────────────────────────────────────────────────
// MAIN — Parse full HTML string into Template JSON
// ─────────────────────────────────────────────────────────
export function parseHtmlToTemplate(params: {
  htmlString: string;
  templateId: string;
  templateName: string;
  category: string;
}): Template {
  const { htmlString, templateId, templateName, category } = params;

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  const cssVariables = extractCSSVariables(doc);
  const blocks = extractBlocks(doc, templateId, templateName);

  const pageScripts: PageScripts = {
    gtmId: "",
    headScripts: "",
    bodyScripts: "",
    pageTitle: "",
    faviconUrl: "",
    metaDescription: "",
    googleAnalyticsId: "",
  };

  return {
    id: templateId,
    templateName,
    category,
    createdAt: new Date().toISOString().split("T")[0],
    cssVariables,
    blocks,
    rawHtml: htmlString,
    pageScripts,
  };
}

// ─────────────────────────────────────────────────────────────
// Inject CSS variables into rawHtml as a <style> tag
// ─────────────────────────────────────────────────────────────
export function injectCSSVariables(rawHtml: string, cssVariables: CSSVariables): string {
  if (!cssVariables || Object.keys(cssVariables).length === 0) {
    return rawHtml;
  }

  const varLines = Object.entries(cssVariables)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  const styleBlock = `<style id="lp-css-vars">\n:root {\n${varLines}\n}\n</style>`;

  const cleaned = rawHtml.replace(
    /<style[^>]*id=["']lp-css-vars["'][^>]*>[\s\S]*?<\/style>/gi,
    ""
  );

  if (cleaned.includes("</head>")) {
    return cleaned.replace("</head>", styleBlock + "\n</head>");
  }

  if (cleaned.includes("<head>")) {
    return cleaned.replace("<head>", "<head>\n" + styleBlock);
  }

  if (cleaned.includes("</body>")) {
    return cleaned.replace("</body>", styleBlock + "\n</body>");
  }

  return cleaned + "\n" + styleBlock;
}

// ─────────────────────────────────────────────────────────
// HELPER — Update a single editable's content in raw HTML
// ─────────────────────────────────────────────────────────
export function updateEditableInHtml(
  rawHtml: string,
  editableId: string,
  newContent: string,
  type: "text" | "image" | "link"
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");
  const el = doc.querySelector(`[data-editable="${editableId}"]`);

  if (!el) return rawHtml;

  if (type === "image") {
    el.setAttribute("src", newContent);
  } else if (type === "link") {
    el.setAttribute("href", newContent);
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

  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}