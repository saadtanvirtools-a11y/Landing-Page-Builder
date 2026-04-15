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
// ─────────────────────────────────────────────────────────
function parseColorVars(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw) return result;
  raw.split(",").forEach((pair) => {
    const [key, val] = pair.split(":").map((s) => s.trim());
    if (key && val) result[key] = val;
  });
  return result;
}

// ─────────────────────────────────────────────────────────
// STEP 3 — Extract all [data-editable] elements inside a block
// ─────────────────────────────────────────────────────────
function extractEditables(blockEl: Element): EditableItem[] {
  const editables: EditableItem[] = [];
  const elements = Array.from(blockEl.querySelectorAll("[data-editable]"));

  for (const el of elements) {
    const id = el.getAttribute("data-editable") || "";
    const type = el.getAttribute("data-editable-type") || "text";

    let content = "";
    if (type === "image") {
      content = (el as HTMLImageElement).src || el.getAttribute("src") || "";
    } else {
      content = (el.textContent || "").trim();
    }

    editables.push({
      id,
      type: type as EditableItem["type"],
      content,
      colorVars: parseColorVars(el.getAttribute("data-color-vars") || ""),
      tailwindClass: el.getAttribute("class") || "",
      styleProps: el.getAttribute("data-style-props") || "",
      styleId: el.getAttribute("data-style-id") || "",
    });
  }
  return editables;
}

// ─────────────────────────────────────────────────────────
// STEP 4 — Extract all [data-block] sections
//
// ✅ NEW: each ParsedBlock now includes:
//   rawHtml            — the block's own outer HTML snippet
//   sourceTemplateId   — filled in by parseHtmlToTemplate()
//   sourceTemplateName — filled in by parseHtmlToTemplate()
// ─────────────────────────────────────────────────────────
// function extractBlocks(doc: Document, templateId: string, templateName: string): ParsedBlock[] {
//   const blocks: ParsedBlock[] = [];
//   const blockElements = Array.from(doc.querySelectorAll("[data-block]"));

//   for (const el of blockElements) {
//     const blockId = el.getAttribute("data-block") || "";
//     const blockName = el.getAttribute("data-block-name") || blockId;
//     const blockOrder = parseInt(el.getAttribute("data-block-order") || "0", 10);
//     const removable = el.getAttribute("data-block-removable") !== "false";
//     const colorVarsRaw = el.getAttribute("data-color-vars") || "";
//     const editables = extractEditables(el);

//     // ✅ Capture this block's own HTML snippet
//     const rawHtml = el.outerHTML;

//     blocks.push({
//       blockId,
//       blockName,
//       blockOrder,
//       removable,
//       colorVars: parseColorVars(colorVarsRaw),
//       editables,
//       rawHtml, // ← block's own HTML ✅
//       sourceTemplateId: templateId, // ← which template ✅
//       sourceTemplateName: templateName, // ← display name   ✅
//     });
//   }

//   blocks.sort((a, b) => a.blockOrder - b.blockOrder);
//   return blocks;
// }

function extractBlocks(doc: Document, templateId: string, templateName: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const blockElements = Array.from(doc.querySelectorAll("[data-block]"));

  for (const el of blockElements) {
    const blockId    = el.getAttribute("data-block") || "";
    const blockName  = el.getAttribute("data-block-name") || blockId;
    const blockOrder = parseInt(el.getAttribute("data-block-order") || "0", 10);
    const removable  = el.getAttribute("data-block-removable") !== "false";

    // ✅ ONLY the wrapper element's own attribute — no child merging
    const wrapperColorVarsRaw = el.getAttribute("data-color-vars") || "";

    const editables = extractEditables(el);
    const rawHtml   = el.outerHTML;

    blocks.push({
      blockId,
      blockName,
      blockOrder,
      removable,
      colorVars         : parseColorVars(wrapperColorVarsRaw), // ✅ wrapper only
      editables,
      rawHtml,
      sourceTemplateId  : templateId,
      sourceTemplateName: templateName,
    });
  }

  blocks.sort((a, b) => a.blockOrder - b.blockOrder);
  return blocks;
}


// ─────────────────────────────────────────────────────────
// MAIN — Parse full HTML string into Template JSON
// ─────────────────────────────────────────────────────────
export function parseHtmlToTemplate(params: { htmlString: string; templateId: string; templateName: string; category: string }): Template {
  const { htmlString, templateId, templateName, category } = params;

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  const cssVariables = extractCSSVariables(doc);

  // ✅ Pass templateId + templateName so every block knows its source
  const blocks = extractBlocks(doc, templateId, templateName);

  const pageScripts: PageScripts = {
    gtmId: "",
    headScripts: "",
    bodyScripts: "",
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
// ALWAYS writes :root { --var: value } as plain text string
// ─────────────────────────────────────────────────────────────
export function injectCSSVariables(rawHtml: string, cssVariables: CSSVariables): string {
  if (!cssVariables || Object.keys(cssVariables).length === 0) {
    return rawHtml;
  }

  // Build the :root { } block as a plain string
  const varLines = Object.entries(cssVariables)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  const styleBlock = `<style id="lp-css-vars">\n:root {\n${varLines}\n}\n</style>`;

  // Remove any previously injected lp-css-vars style tag
  const cleaned = rawHtml.replace(/<style[^>]*id=["']lp-css-vars["'][^>]*>[\s\S]*?<\/style>/gi, "");

  // Inject into <head> — if no <head>, inject before </body>
  if (cleaned.includes("</head>")) {
    return cleaned.replace("</head>", styleBlock + "\n</head>");
  }
  if (cleaned.includes("<head>")) {
    return cleaned.replace("<head>", "<head>\n" + styleBlock);
  }
  // Fallback: inject before </body>
  if (cleaned.includes("</body>")) {
    return cleaned.replace("</body>", styleBlock + "\n</body>");
  }
  return cleaned + "\n" + styleBlock;
}
// ─────────────────────────────────────────────────────────
// HELPER — Update a single editable's content in raw HTML
// ─────────────────────────────────────────────────────────
export function updateEditableInHtml(rawHtml: string, editableId: string, newContent: string, type: "text" | "image" | "link"): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");
  const el = doc.querySelector(`[data-editable="${editableId}"]`);
  if (!el) return rawHtml;

  if (type === "image") {
    el.setAttribute("src", newContent);
  } else if (type === "link") {
    el.setAttribute("href", newContent);
  } else {
    // Preserve child elements (icons, spans) — only update text nodes
    const textNodes = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE);
    if (textNodes.length > 0) {
      textNodes[0].textContent = newContent;
    } else {
      el.textContent = newContent;
    }
  }

  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}
