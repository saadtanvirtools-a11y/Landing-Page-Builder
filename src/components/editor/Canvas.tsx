import { useRef, useEffect, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useEditorStore } from "../../store/editorStore";
import type { BlockOption } from "./BlockPanel";

const TAILWIND_FONT_SIZE_MAP: Record<string, string> = {
  "text-xs": "0.75rem",
  "text-sm": "0.875rem",
  "text-base": "1rem",
  "text-lg": "1.125rem",
  "text-xl": "1.25rem",
  "text-2xl": "1.5rem",
  "text-3xl": "1.875rem",
  "text-4xl": "2.25rem",
  "text-5xl": "3rem",
  "text-6xl": "3.75rem",
  "text-7xl": "4.5rem",
  "text-8xl": "6rem",
  "text-9xl": "8rem",
};

const TAILWIND_FONT_WEIGHT_MAP: Record<string, string> = {
  "font-thin": "100",
  "font-extralight": "200",
  "font-light": "300",
  "font-normal": "400",
  "font-medium": "500",
  "font-semibold": "600",
  "font-bold": "700",
  "font-extrabold": "800",
  "font-black": "900",
};

function buildIframeHtml(rawHtml: string, selectedBlockId: string | null, rawCss = "", rawJs = "", bodyScripts = ""): string {
  const tailwindCdn = rawHtml.includes("cdn.tailwindcss.com") ? "" : `<script src="https://cdn.tailwindcss.com"><\/script>`;

  let processedHtml = rawHtml
    .replace(/<link[^>]+href=["']\.\/public\/[^"']+["'][^>]*>/gi, "")
    .replace(/<link[^>]+href=["']public\/[^"']+["'][^>]*>/gi, "")
    .replace(/<script[^>]+src=["']\.\/public\/[^"']+["'][^>]*><\/script>/gi, "")
    .replace(/<script[^>]+src=["']public\/[^"']+["'][^>]*><\/script>/gi, "");

  if (rawCss.trim()) {
    const cssTag = `<style id="lp-raw-css">\n${rawCss}\n</style>`;
    processedHtml = processedHtml.includes("</head>") ? processedHtml.replace("</head>", `${cssTag}\n</head>`) : `<head>${cssTag}</head>\n${processedHtml}`;
  }

  if (tailwindCdn) {
    processedHtml = processedHtml.includes("</head>") ? processedHtml.replace("</head>", `${tailwindCdn}\n</head>`) : `<head>${tailwindCdn}</head>\n${processedHtml}`;
  }

  const marqueeScript = bodyScripts.trim()
    ? `<script>
      (function(){
        try {
          ${bodyScripts.replace(/<\/?script[^>]*>/gi, "")}

          document.dispatchEvent(new Event("DOMContentLoaded"));
          window.dispatchEvent(new Event("load"));
        } catch(e) {
          console.error("Marquee JS error:", e);
        }
      })();
      <\/script>`
    : rawJs.trim()
      ? `<script>
        (function(){
          try {
            ${rawJs}

            document.dispatchEvent(new Event("DOMContentLoaded"));
            window.dispatchEvent(new Event("load"));
          } catch(e) {
            console.error("Marquee JS error:", e);
          }
        })();
        <\/script>`
      : "";

  const editorScript = `
<script>
(function () {
  var FONT_SIZE_MAP = ${JSON.stringify(TAILWIND_FONT_SIZE_MAP)};
  var FONT_WEIGHT_MAP = ${JSON.stringify(TAILWIND_FONT_WEIGHT_MAP)};

  function stripPrefix(cls) {
    var idx = cls.indexOf(':');
    return idx !== -1 ? cls.slice(idx + 1) : cls;
  }

  function applyTypography(el, classList) {
    var classes = String(classList || '').split(' ').filter(Boolean);
    el.style.removeProperty('font-size');
    el.style.removeProperty('font-weight');

    classes.forEach(function(cls) {
      var base = stripPrefix(cls);
      if (FONT_SIZE_MAP[base]) el.style.setProperty('font-size', FONT_SIZE_MAP[base], 'important');
      if (FONT_WEIGHT_MAP[base]) el.style.setProperty('font-weight', FONT_WEIGHT_MAP[base], 'important');
    });
  }

  function highlight(blockId, shouldScroll) {
    document.querySelectorAll('[data-block]').forEach(function(el) {
      if (blockId && el.getAttribute('data-block') === blockId) {
        el.style.outline = '3px solid #6366f1';
        el.style.outlineOffset = '-3px';

        if (shouldScroll) {
          setTimeout(function() {
            el.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            });
          }, 80);
        }
      } else {
        el.style.outline = '';
        el.style.outlineOffset = '';
      }
    });
  }

  function lockCanvasInteractions() {
    var lockStyle = document.getElementById('lp-canvas-lock-style');

    if (!lockStyle) {
      lockStyle = document.createElement('style');
      lockStyle.id = 'lp-canvas-lock-style';
      lockStyle.textContent = \`
        html,
        body,
        body *,
        [data-block],
        [data-block] * {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
          -webkit-touch-callout: none !important;
        }

        a, button, input, textarea, select, form, label {
          pointer-events: none !important;
        }

        img, svg, video, canvas {
          -webkit-user-drag: none !important;
          user-drag: none !important;
        }
      \`;
      document.head.appendChild(lockStyle);
    }

    document.documentElement.style.userSelect = 'none';
    document.documentElement.style.webkitUserSelect = 'none';
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.pointerEvents = 'auto';
    document.body.setAttribute('draggable', 'false');

    document.querySelectorAll('*').forEach(function(el) {
      el.setAttribute('draggable', 'false');
    });

    document.querySelectorAll('a, button, input, textarea, select, form, label').forEach(function(el) {
      el.setAttribute('tabindex', '-1');
      el.style.pointerEvents = 'none';
      el.setAttribute('aria-disabled', 'true');

      if ('disabled' in el) {
        try { el.disabled = true; } catch (err) {}
      }
    });

    document.querySelectorAll('[contenteditable]').forEach(function(el) {
      el.setAttribute('contenteditable', 'false');
    });

    if (window.getSelection) {
      try { window.getSelection().removeAllRanges(); } catch (err) {}
    }
  }

  lockCanvasInteractions();

  document.addEventListener('click', function(e) {
    var el = e.target;

    while (el && el !== document.body) {
      if (el.hasAttribute && el.hasAttribute('data-block')) {
        e.preventDefault();
        e.stopPropagation();

        var id = el.getAttribute('data-block');
        window.parent.postMessage({ type: 'BLOCK_SELECTED', blockId: id }, '*');
        highlight(id, false);
        return;
      }

      el = el.parentElement;
    }

    e.preventDefault();
    e.stopPropagation();

    window.parent.postMessage({ type: 'BLOCK_DESELECTED' }, '*');
    highlight(null, false);
  }, true);

  document.addEventListener('dblclick', function(e) {
    e.preventDefault();
    e.stopPropagation();
  }, true);

  document.addEventListener('input', function(e) {
    e.preventDefault();
    e.stopPropagation();
  }, true);

  document.addEventListener('keydown', function(e) {
    e.preventDefault();
    e.stopPropagation();
  }, true);

  document.addEventListener('selectstart', function(e) {
    e.preventDefault();
    e.stopPropagation();

    if (window.getSelection) {
      try { window.getSelection().removeAllRanges(); } catch (err) {}
    }
  }, true);

  document.addEventListener('mousedown', function(e) {
    if (window.getSelection) {
      try { window.getSelection().removeAllRanges(); } catch (err) {}
    }
  }, true);

  document.addEventListener('mouseup', function(e) {
    if (window.getSelection) {
      try { window.getSelection().removeAllRanges(); } catch (err) {}
    }
  }, true);

  document.addEventListener('dragstart', function(e) {
    e.preventDefault();
    e.stopPropagation();
  }, true);

  document.addEventListener('copy', function(e) {
    e.preventDefault();
    e.stopPropagation();
  }, true);

  document.addEventListener('submit', function(e) {
    e.preventDefault();
    e.stopPropagation();
  }, true);

  window.addEventListener('message', function(e) {
    if (!e.data) return;
    var d = e.data;

    if (d.type === 'HIGHLIGHT_BLOCK') {
      highlight(d.blockId, !!d.scrollToBlock);
      return;
    }

    if (d.type === 'UPDATE_CSS_VARS') {
      var vars = d.cssVariables;
      if (!vars) return;

      var liveEl = document.getElementById('lp-css-vars-live');
      if (!liveEl) {
        liveEl = document.createElement('style');
        liveEl.id = 'lp-css-vars-live';
        document.head.appendChild(liveEl);
      }

      var lines = Object.keys(vars).map(function(k) {
        return '  ' + k + ': ' + vars[k] + ';';
      }).join('\\n');

      liveEl.textContent = ':root {\\n' + lines + '\\n}';
      document.body.offsetHeight;
      return;
    }

    if (d.type === 'UPDATE_CLASS') {
      var targets = Array.from(
        document.querySelectorAll('[data-style-id="' + d.styleId + '"]')
      );

      if (targets.length === 0) {
        var fallback = document.querySelector('[data-editable="' + d.styleId + '"]');
        if (fallback) targets = [fallback];
      }

      if (targets.length === 0) return;

      targets.forEach(function(target) {
        target.className = d.newClassList;
        applyTypography(target, d.newClassList);
        target.querySelectorAll('*').forEach(function(child) {
          applyTypography(child, child.className);
        });
      });

      document.body.offsetHeight;
      return;
    }

    if (d.type === 'UPDATE_EDITABLE_CLASS') {
      var editableClassTarget = document.querySelector('[data-editable="' + d.editableId + '"]');
      if (!editableClassTarget) return;

      editableClassTarget.className = d.newClassList;
      applyTypography(editableClassTarget, d.newClassList);
      document.body.offsetHeight;
      return;
    }

 if (d.type === 'UPDATE_EDITABLE') {
  var editableTargets = Array.from(
    document.querySelectorAll('[data-editable="' + d.editableId + '"]')
  );

  if (editableTargets.length === 0) return;

  editableTargets.forEach(function(editableTarget) {
    if (d.editableType === 'image') {
      editableTarget.src = d.content;
    } 
    else if (d.editableType === 'link') {
      editableTarget.href = d.content;
    } 
    else {
      var textNodes = Array.from(editableTarget.childNodes).filter(function(n) {
        return n.nodeType === 3;
      });

      if (textNodes.length > 0) {
        textNodes[0].textContent = d.content;
      } else {
        editableTarget.textContent = d.content;
      }
    }
  });

  document.body.offsetHeight;
  return;
}

    if (d.type === 'UPDATE_BLOCK_STYLE') {
      var styleTarget = document.querySelector('[data-block="' + d.blockId + '"]');
      if (!styleTarget) return;

      styleTarget.style[d.styleKey] = d.value;
      document.body.offsetHeight;
      return;
    }
  });

  ${selectedBlockId ? `highlight(${JSON.stringify(selectedBlockId)}, false);` : ""}
})();
<\/script>`;

  const scriptsToInject = `${marqueeScript}\n${editorScript}`;

  return processedHtml.includes("</body>") ? processedHtml.replace("</body>", scriptsToInject + "\n</body>") : processedHtml + scriptsToInject;
}

function EmptyCanvas({ activeDropZone }: { activeDropZone: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-empty" });

  const active = isOver || activeDropZone === "canvas-empty" || activeDropZone === "canvas-iframe-drop";

  return (
    <div className="flex-1 flex flex-col p-4">
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200 ${
          active ? "border-indigo-400 bg-indigo-50 scale-[0.99]" : "border-gray-200 bg-gray-50"
        }`}
      >
        <div className="text-center">
          <div className="text-5xl mb-4">{active ? "⬇" : "🧱"}</div>
          <h3 className="text-base font-semibold text-gray-500 mb-1">{active ? "Drop to add!" : "Canvas is Empty"}</h3>
          <p className="text-xs text-gray-400">Drag blocks from the left panel</p>
        </div>
      </div>
    </div>
  );
}

function IframeDropOverlay({ isDragging }: { isDragging: boolean }) {
  const { setNodeRef } = useDroppable({ id: "canvas-iframe-drop" });

  return <div ref={setNodeRef} data-dropzone-id="canvas-iframe-drop" className="absolute inset-0 z-10" style={{ pointerEvents: isDragging ? "all" : "none" }} />;
}

export default function Canvas({ draggingOption, activeDropZone }: { draggingOption: BlockOption | null; activeDropZone: string | null }) {
  const { currentTemplate, selectedBlockId, selectBlock } = useEditorStore();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);
  const lastCssVars = useRef<Record<string, string>>({});
  const lastBlockStyles = useRef<Record<string, Record<string, string>>>({});
  const lastBlockKey = useRef("");
  const lastRawCss = useRef("");
  const lastRawHtml = useRef("");
  const lastRawJs = useRef("");
  const lastBodyScripts = useRef("");
  const pendingMessages = useRef<object[]>([]);
  const sentToIframe = useRef<Record<string, { content: string; tailwindClass: string }>>({});

  const postToIframe = useCallback((msg: object) => {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  const writeIframe = useCallback(() => {
    if (!currentTemplate || !iframeRef.current) return;

    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;

    if (!doc) return;

    iframeReady.current = false;
    sentToIframe.current = {};
    lastBlockStyles.current = {};

    const rawCss = (currentTemplate as any).rawCss ?? "";
    const rawJs = (currentTemplate as any).rawJs ?? "";
    const bodyScripts = (currentTemplate as any).pageScripts?.bodyScripts ?? "";

    let html = buildIframeHtml(currentTemplate.rawHtml, selectedBlockId, rawCss, rawJs, bodyScripts);

    if (currentTemplate.cssVariables && Object.keys(currentTemplate.cssVariables).length > 0) {
      const varLines = Object.entries(currentTemplate.cssVariables)
        .map(([k, v]) => `  ${k}: ${v};`)
        .join("\n");

      const styleTag = `<style id="lp-css-vars-baked">:root {\n${varLines}\n}</style>`;

      html = html.includes("</body>") ? html.replace("</body>", `${styleTag}\n</body>`) : html + styleTag;
    }

    doc.open();
    doc.write(html);
    doc.close();
  }, [currentTemplate, selectedBlockId]);

  useEffect(() => {
    if (!currentTemplate) return;

    const newKey = (currentTemplate.blocks ?? []).map((b) => `${b.blockId}:${b.blockOrder ?? 0}`).join("|");

    if (newKey !== lastBlockKey.current) {
      lastBlockKey.current = newKey;
      writeIframe();
    }
  }, [(currentTemplate?.blocks ?? []).map((b) => `${b.blockId}:${b.blockOrder ?? 0}`).join("|"), writeIframe]);

  useEffect(() => {
    if (!currentTemplate?.rawHtml) return;

    if (currentTemplate.rawHtml !== lastRawHtml.current) {
      lastRawHtml.current = currentTemplate.rawHtml;
      writeIframe();
    }
  }, [currentTemplate?.rawHtml, writeIframe]);

  useEffect(() => {
    const rawJs = (currentTemplate as any)?.rawJs || "";
    const bodyScripts = (currentTemplate as any)?.pageScripts?.bodyScripts || "";

    if (rawJs !== lastRawJs.current || bodyScripts !== lastBodyScripts.current) {
      lastRawJs.current = rawJs;
      lastBodyScripts.current = bodyScripts;
      writeIframe();
    }
  }, [(currentTemplate as any)?.rawJs, (currentTemplate as any)?.pageScripts?.bodyScripts, writeIframe]);

  useEffect(() => {
    if (!currentTemplate?.cssVariables || !iframeReady.current) return;

    const vars = currentTemplate.cssVariables;
    const hasChange = Object.entries(vars).some(([k, v]) => lastCssVars.current[k] !== v);

    if (!hasChange) return;

    lastCssVars.current = { ...vars };
    postToIframe({ type: "UPDATE_CSS_VARS", cssVariables: vars });
  }, [currentTemplate?.cssVariables, postToIframe]);

  useEffect(() => {
    if (!currentTemplate?.blocks) return;

    const toSend: object[] = [];

    currentTemplate.blocks.forEach((block) => {
      (block.editables ?? []).forEach((item) => {
        const sent = sentToIframe.current[item.id];
        if (!sent) return;

        const currClass = item.tailwindClass ?? "";
        const currContent = item.content ?? "";

        if (sent.tailwindClass !== currClass) {
          sentToIframe.current[item.id] = {
            ...sent,
            tailwindClass: currClass,
          };

          toSend.push({
            type: item.styleId ? "UPDATE_CLASS" : "UPDATE_EDITABLE_CLASS",
            styleId: item.styleId,
            editableId: item.id,
            newClassList: currClass,
          });
        }

        if (sent.content !== currContent) {
          sentToIframe.current[item.id] = {
            ...sent,
            content: currContent,
          };

          toSend.push({
            type: "UPDATE_EDITABLE",
            editableId: item.id,
            content: currContent,
            editableType: item.type,
          });
        }
      });
    });

    if (toSend.length === 0) return;

    if (iframeReady.current) {
      toSend.forEach((msg) => postToIframe(msg));
    } else {
      pendingMessages.current.push(...toSend);
    }
  }, [currentTemplate?.blocks, postToIframe]);

  useEffect(() => {
    if (!currentTemplate?.blocks || !iframeReady.current) return;

    const styleKeyMap: Record<string, string> = {
      bgColor: "backgroundColor",
      backgroundColor: "backgroundColor",
    };

    currentTemplate.blocks.forEach((block) => {
      const blockStyles = (block as any).styles ?? {};
      const prevStyles = lastBlockStyles.current[block.blockId] ?? {};

      Object.entries(blockStyles).forEach(([storeKey, value]) => {
        const cssKey = styleKeyMap[storeKey] ?? storeKey;

        if (prevStyles[cssKey] !== value) {
          if (!lastBlockStyles.current[block.blockId]) {
            lastBlockStyles.current[block.blockId] = {};
          }

          lastBlockStyles.current[block.blockId][cssKey] = value as string;

          postToIframe({
            type: "UPDATE_BLOCK_STYLE",
            blockId: block.blockId,
            styleKey: cssKey,
            value: value as string,
          });
        }
      });
    });
  }, [currentTemplate?.blocks, postToIframe]);

  useEffect(() => {
    const rawCss = (currentTemplate as any)?.rawCss || "";

    if (rawCss !== lastRawCss.current) {
      lastRawCss.current = rawCss;
      writeIframe();
    }
  }, [(currentTemplate as any)?.rawCss, writeIframe]);
  useEffect(() => {
    if (!iframeReady.current) return;

    postToIframe({
      type: "HIGHLIGHT_BLOCK",
      blockId: selectedBlockId,
      scrollToBlock: true,
    });
  }, [selectedBlockId, postToIframe]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "BLOCK_SELECTED") selectBlock(e.data.blockId);
      if (e.data?.type === "BLOCK_DESELECTED") selectBlock(null);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [selectBlock]);

  const handleIframeLoad = useCallback(() => {
    iframeReady.current = true;
    sentToIframe.current = {};
    lastBlockStyles.current = {};

    currentTemplate?.blocks?.forEach((block) => {
      (block.editables ?? []).forEach((item) => {
        sentToIframe.current[item.id] = {
          content: item.content ?? "",
          tailwindClass: item.tailwindClass ?? "",
        };
      });

      const blockStyles = (block as any).styles ?? {};
      if (Object.keys(blockStyles).length > 0) {
        lastBlockStyles.current[block.blockId] = { ...blockStyles };
      }
    });

    if (currentTemplate?.cssVariables) {
      lastCssVars.current = { ...currentTemplate.cssVariables };
    }

    if (selectedBlockId) {
      postToIframe({
        type: "HIGHLIGHT_BLOCK",
        blockId: selectedBlockId,
        scrollToBlock: true,
      });
    }

    if (pendingMessages.current.length > 0) {
      const msgs = [...pendingMessages.current];
      pendingMessages.current = [];
      setTimeout(() => msgs.forEach((msg) => postToIframe(msg)), 50);
    }
  }, [currentTemplate, selectedBlockId, postToIframe]);

  if (!currentTemplate || currentTemplate.blocks.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <EmptyCanvas activeDropZone={activeDropZone} />
      </div>
    );
  }

  const isDragging = !!draggingOption;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700">📄 {currentTemplate.templateName}</span>

          <span className="text-xs text-gray-400">
            · {currentTemplate.blocks.length} section
            {currentTemplate.blocks.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedBlockId && !isDragging && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">✏️ Editing: {selectedBlockId}</span>}

          {isDragging && <span className="text-xs bg-indigo-50 text-indigo-500 border border-indigo-200 px-2 py-0.5 rounded-full font-medium animate-pulse">🎯 Drop in Page Sections panel</span>}

          {!isDragging && <span className="text-xs text-gray-400">👆 Click section to select</span>}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white relative">
        <iframe
          ref={iframeRef}
          title="Template Preview"
          className="w-full border-0"
          style={{ height: "100%", minHeight: "500px" }}
          sandbox="allow-scripts allow-same-origin"
          onLoad={handleIframeLoad}
        />

        <IframeDropOverlay isDragging={isDragging} />

        {!selectedBlockId && !isDragging && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-black/50 text-white text-xs px-4 py-2 rounded-full backdrop-blur-sm">👆 Click any section in the preview to edit</div>
          </div>
        )}
      </div>
    </div>
  );
}
