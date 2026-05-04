import type { CSSVariables, EditableItem, ParsedBlock, Template, PageScripts } from "../types";

function detectSpecialScripts(html: string, js: string) {
  const combined = `${html}\n${js}`.toLowerCase();

  return {
    hasMarquee:
      combined.includes("marquee") ||
      combined.includes("data-marquee") ||
      combined.includes("marquee-track") ||
      combined.includes("marquee-wrapper") ||
      combined.includes("marquee-container") ||
      combined.includes("scrollamount") ||
      combined.includes("translatex"),
  };
}

function extractMarqueeOnlyJs(js: string): string {
  if (!js || !js.trim()) return "";

  const lines = js.split("\n");
  const result: string[] = [];

  let capture = false;
  let braceDepth = 0;

  const marqueeKeywords = [
    "marquee",
    "data-marquee",
    "marquee-track",
    "marquee-wrapper",
    "marquee-container",
    "scrollamount",
    "translatex",
  ];

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (!capture && marqueeKeywords.some((k) => lower.includes(k))) {
      capture = true;
    }

    if (capture) {
      result.push(line);

      const open = (line.match(/\{/g) || []).length;
      const close = (line.match(/\}/g) || []).length;
      braceDepth += open - close;

      if (braceDepth <= 0 && line.trim().endsWith(";")) {
        capture = false;
        braceDepth = 0;
        result.push("");
      }
    }
  }

  return result.join("\n").trim();
}

function extractInlineScripts(doc: Document): { headScripts: string; bodyScripts: string } {
  const headScripts = Array.from(doc.head?.querySelectorAll("script") || [])
    .map((s) => {
      const text = s.textContent || "";
      const marqueeJs = extractMarqueeOnlyJs(text);
      return marqueeJs ? `<script>\n${marqueeJs}\n</script>` : "";
    })
    .filter(Boolean)
    .join("\n");

  const bodyScripts = Array.from(doc.body?.querySelectorAll("script") || [])
    .map((s) => {
      const text = s.textContent || "";
      const marqueeJs = extractMarqueeOnlyJs(text);
      return marqueeJs ? `<script>\n${marqueeJs}\n</script>` : "";
    })
    .filter(Boolean)
    .join("\n");

  return { headScripts, bodyScripts };
}

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

function readTailwindClass(el: Element): {
  tailwindClass: string;
  styleChildSelector?: string;
} {
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

function extractSvgMarkup(el: Element): string {
  if (el.tagName.toLowerCase() === "svg") return el.outerHTML.trim();

  const directSvg = Array.from(el.children).find(
    (child) => child.tagName.toLowerCase() === "svg"
  );
  if (directSvg) return directSvg.outerHTML.trim();

  const nestedSvg = el.querySelector("svg");
  if (nestedSvg) return nestedSvg.outerHTML.trim();

  return (el.innerHTML || "").trim();
}

function extractEditables(blockEl: Element): EditableItem[] {
  const editables: EditableItem[] = [];
  const elements = Array.from(blockEl.querySelectorAll("[data-editable]"));

  for (const el of elements) {
    const id = el.getAttribute("data-editable") || "";
    const rawType = (el.getAttribute("data-editable-type") || "text")
      .trim()
      .toLowerCase();

    let type = rawType as "text" | "image" | "link" | "svg";
    let content = "";
    const linkHref = el.tagName.toLowerCase() === "a" ? el.getAttribute("href") || "" : undefined;

    if (type === "image") {
      content = el.getAttribute("src") || (el as HTMLImageElement).src || "";
    } else if (type === "link") {
      content = el.getAttribute("href") || "";
    } else if (type === "svg") {
      content = extractSvgMarkup(el);
    } else {
      content = (el.textContent || "").trim();
    }

    if (
      type === "text" &&
      (content === "" || content.trim() === "") &&
      el.querySelector("svg")
    ) {
      type = "svg";
      content = extractSvgMarkup(el);
    }

    const { tailwindClass, styleChildSelector } = readTailwindClass(el);

    editables.push({
      id,
      type: type as EditableItem["type"],
      content,
      colorVars: parseColorVars(el.getAttribute("data-color-vars") || ""),
      tailwindClass,
      styleProps: el.getAttribute("data-style-props") || "",
      styleId: el.getAttribute("data-style-id") || "",
      styleChildSelector,
      linkHref,
    });
  }

  return editables;
}

function extractBlocks(
  doc: Document,
  templateId: string,
  templateName: string
): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const blockElements = Array.from(doc.querySelectorAll("[data-block]"));

  for (const el of blockElements) {
    const blockId = el.getAttribute("data-block") || "";
    const blockName = el.getAttribute("data-block-name") || blockId;
    const blockOrder = parseInt(el.getAttribute("data-block-order") || "0", 10);
    const removable = el.getAttribute("data-block-removable") !== "false";

    blocks.push({
      blockId,
      blockName,
      blockOrder,
      removable,
      colorVars: parseColorVars(el.getAttribute("data-color-vars") || ""),
      editables: extractEditables(el),
      rawHtml: el.outerHTML,
      sourceTemplateId: templateId,
      sourceTemplateName: templateName,
    });
  }

  blocks.sort((a, b) => a.blockOrder - b.blockOrder);
  return blocks;
}

export function replaceAssetPathsInHtml(
  html: string,
  assetMap: Record<string, string>
): string {
  if (!html || !assetMap || Object.keys(assetMap).length === 0) return html;

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

export function parseHtmlToTemplate(params: {
  htmlString: string;
  templateId: string;
  templateName: string;
  category: string;
  rawJs?: string;
}): Template {
  const { htmlString, templateId, templateName, category, rawJs = "" } = params;

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  const cssVariables = extractCSSVariables(doc);
  const blocks = extractBlocks(doc, templateId, templateName);
  const scriptFlags = detectSpecialScripts(htmlString, rawJs);
  const inlineScripts = extractInlineScripts(doc);
  const marqueeJsOnly = extractMarqueeOnlyJs(rawJs);

  const bodyScripts = [
    inlineScripts.bodyScripts,
    marqueeJsOnly ? `<script id="lp-marquee-js">\n${marqueeJsOnly}\n</script>` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const pageScripts: PageScripts = {
    gtmId: "",
    headScripts: inlineScripts.headScripts,
    bodyScripts,
    pageTitle: doc.querySelector("title")?.textContent?.trim() || "",
    faviconUrl: doc.querySelector('link[rel="icon"]')?.getAttribute("href") || "",
    metaDescription:
      doc.querySelector('meta[name="description"]')?.getAttribute("content") || "",
    googleAnalyticsId: "",
    hasMarquee: scriptFlags.hasMarquee,
  } as PageScripts;

  return {
    id: templateId,
    templateName,
    category,
    createdAt: new Date().toISOString().split("T")[0],
    cssVariables,
    blocks,
    rawHtml: htmlString,
    rawJs: marqueeJsOnly,
    pageScripts,
  } as Template;
}

export function injectCSSVariables(
  rawHtml: string,
  cssVariables: CSSVariables
): string {
  if (!cssVariables || Object.keys(cssVariables).length === 0) return rawHtml;

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

export function updateEditableInHtml(
  rawHtml: string,
  editableId: string,
  newContent: string,
  type: "text" | "image" | "link" | "svg"
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");
  const el = doc.querySelector(`[data-editable="${editableId}"]`);

  if (!el) return rawHtml;

  if (type === "image") {
    el.setAttribute("src", newContent);
  } else if (type === "link") {
    el.setAttribute("href", newContent);
  } else if (type === "svg") {
    const trimmed = newContent.trim();

    if (el.tagName.toLowerCase() === "svg") {
      const svgDoc = parser.parseFromString(trimmed, "image/svg+xml");
      const newSvg = svgDoc.documentElement;

      if (newSvg && newSvg.tagName.toLowerCase() === "svg") {
        el.replaceWith(doc.importNode(newSvg, true));
      } else {
        el.outerHTML = trimmed;
      }
    } else {
      const currentSvg = el.querySelector("svg");

      if (currentSvg) {
        const svgDoc = parser.parseFromString(trimmed, "image/svg+xml");
        const newSvg = svgDoc.documentElement;

        if (newSvg && newSvg.tagName.toLowerCase() === "svg") {
          currentSvg.replaceWith(doc.importNode(newSvg, true));
        } else {
          el.innerHTML = trimmed;
        }
      } else {
        el.innerHTML = trimmed;
      }
    }
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