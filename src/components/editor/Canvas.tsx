// import { useRef, useEffect, useCallback } from "react";
// import { useDroppable } from "@dnd-kit/core";
// import { useEditorStore } from "../../store/editorStore";
// import type { BlockOption } from "./BlockPanel";

// // ─────────────────────────────────────────────────────────────
// // TAILWIND FONT-SIZE / FONT-WEIGHT → value mapping
// // ─────────────────────────────────────────────────────────────
// const TAILWIND_FONT_SIZE_MAP: Record<string, string> = {
//   "text-xs":   "0.75rem",
//   "text-sm":   "0.875rem",
//   "text-base": "1rem",
//   "text-lg":   "1.125rem",
//   "text-xl":   "1.25rem",
//   "text-2xl":  "1.5rem",
//   "text-3xl":  "1.875rem",
//   "text-4xl":  "2.25rem",
//   "text-5xl":  "3rem",
//   "text-6xl":  "3.75rem",
//   "text-7xl":  "4.5rem",
//   "text-8xl":  "6rem",
//   "text-9xl":  "8rem",
// };

// const TAILWIND_FONT_WEIGHT_MAP: Record<string, string> = {
//   "font-thin":       "100",
//   "font-extralight": "200",
//   "font-light":      "300",
//   "font-normal":     "400",
//   "font-medium":     "500",
//   "font-semibold":   "600",
//   "font-bold":       "700",
//   "font-extrabold":  "800",
//   "font-black":      "900",
// };

// // ─────────────────────────────────────────────────────────────
// // BUILD IFRAME HTML
// // ─────────────────────────────────────────────────────────────
// function buildIframeHtml(rawHtml: string, selectedBlockId: string | null): string {
//   const tailwindCdn = rawHtml.includes("cdn.tailwindcss.com")
//     ? ""
//     : `<script src="https://cdn.tailwindcss.com"><\/script>`;

//   let processedHtml = rawHtml
//     .replace(/<link[^>]+href=["']\.\/public\/[^"']+["'][^>]*>/gi, "")
//     .replace(/<link[^>]+href=["']public\/[^"']+["'][^>]*>/gi, "")
//     .replace(/<script[^>]+src=["']\.\/public\/[^"']+["'][^>]*><\/script>/gi, "")
//     .replace(/<script[^>]+src=["']public\/[^"']+["'][^>]*><\/script>/gi, "");

//   if (tailwindCdn) {
//     if (processedHtml.includes("</head>")) {
//       processedHtml = processedHtml.replace("</head>", `${tailwindCdn}\n</head>`);
//     } else if (processedHtml.includes("<head>")) {
//       processedHtml = processedHtml.replace("<head>", `<head>\n${tailwindCdn}`);
//     } else {
//       processedHtml = `<head>${tailwindCdn}</head>\n` + processedHtml;
//     }
//   }

//   const script = `
// <script>
//   (function () {
//     var FONT_SIZE_MAP   = ${JSON.stringify(TAILWIND_FONT_SIZE_MAP)};
//     var FONT_WEIGHT_MAP = ${JSON.stringify(TAILWIND_FONT_WEIGHT_MAP)};

//     function stripPrefix(cls) {
//       var idx = cls.indexOf(':');
//       return idx !== -1 ? cls.slice(idx + 1) : cls;
//     }

//     function applyTypography(el, classList) {
//       var classes = classList.split(' ').filter(Boolean);
//       el.style.removeProperty('font-size');
//       el.style.removeProperty('font-weight');
//       classes.forEach(function(cls) {
//         var base = stripPrefix(cls);
//         if (FONT_SIZE_MAP[base])   el.style.setProperty('font-size',   FONT_SIZE_MAP[base],   'important');
//         if (FONT_WEIGHT_MAP[base]) el.style.setProperty('font-weight', FONT_WEIGHT_MAP[base], 'important');
//       });
//     }

//     function highlight(blockId) {
//       document.querySelectorAll('[data-block]').forEach(function(el) {
//         if (blockId && el.getAttribute('data-block') === blockId) {
//           el.style.outline       = '3px solid #6366f1';
//           el.style.outlineOffset = '-3px';
//         } else {
//           el.style.outline       = '';
//           el.style.outlineOffset = '';
//         }
//       });
//     }

//     document.addEventListener('click', function(e) {
//       var el = e.target;
//       while (el && el !== document.body) {
//         if (el.hasAttribute && el.hasAttribute('data-block')) {
//           var id = el.getAttribute('data-block');
//           window.parent.postMessage({ type: 'BLOCK_SELECTED', blockId: id }, '*');
//           highlight(id);
//           return;
//         }
//         el = el.parentElement;
//       }
//       window.parent.postMessage({ type: 'BLOCK_DESELECTED' }, '*');
//       highlight(null);
//     });

//     window.addEventListener('message', function(e) {
//       if (!e.data) return;
//       var d = e.data;

//       if (d.type === 'HIGHLIGHT_BLOCK') {
//         highlight(d.blockId);
//         return;
//       }

//       // Replace the UPDATE_CSS_VARS handler in the iframe script with:
// if (d.type === 'UPDATE_CSS_VARS') {
//   var vars = d.cssVariables;
//   if (!vars) return;

//   // ✅ Write to BOTH the static style tag AND a live override tag
//   // This ensures vars survive Tailwind's initialization
//   var staticEl = document.getElementById('lp-css-vars');
//   var liveEl   = document.getElementById('lp-css-vars-live');

//   if (!liveEl) {
//     liveEl    = document.createElement('style');
//     liveEl.id = 'lp-css-vars-live';
//     document.head.appendChild(liveEl);
//   }

//   var lines = Object.keys(vars).map(function(k) {
//     return '  ' + k + ': ' + vars[k] + ' !important;';
//   }).join('\n');

//   var cssText = ':root {\n' + lines + '\n}';
//   liveEl.textContent = cssText;

//   // Also update the static tag if it exists
//   if (staticEl) staticEl.textContent = cssText;

//   // Force full repaint
//   document.documentElement.style.display = 'none';
//   document.documentElement.offsetHeight;  // trigger reflow
//   document.documentElement.style.display = '';
//   return;
// }


//       // if (d.type === 'UPDATE_CSS_VARS') {
//       //   var vars = d.cssVariables;
//       //   if (!vars) return;
//       //   var styleEl = document.getElementById('lp-css-vars-live');
//       //   if (!styleEl) {
//       //     styleEl    = document.createElement('style');
//       //     styleEl.id = 'lp-css-vars-live';
//       //     document.head.appendChild(styleEl);
//       //   }
//       //   var lines = Object.keys(vars).map(function(k) {
//       //     return '  ' + k + ': ' + vars[k] + ' !important;';
//       //   }).join('\\n');
//       //   styleEl.textContent = ':root {\\n' + lines + '\\n}';
//       //   document.body.offsetHeight;
//       //   return;
//       // }

// // ── UPDATE_CLASS: find by data-style-id, fallback to data-editable ──
// if (d.type === 'UPDATE_CLASS') {
//   var target = document.querySelector('[data-style-id="' + d.styleId + '"]');
//   // ✅ FIX: also try data-editable as fallback
//   if (!target) target = document.querySelector('[data-editable="' + d.styleId + '"]');
//   if (!target) return;
//   target.className = d.newClassList;
//   applyTypography(target, d.newClassList);
//   // ✅ FIX: also apply to ALL children in case classes live on a child
//   target.querySelectorAll('*').forEach(function(child) {
//     applyTypography(child, child.className);
//   });
//   document.body.offsetHeight;
//   return;
// }

// // ── UPDATE_EDITABLE_CLASS: find by data-editable ─────────
// if (d.type === 'UPDATE_EDITABLE_CLASS') {
//   var target = document.querySelector('[data-editable="' + d.editableId + '"]');
//   if (!target) return;
//   target.className = d.newClassList;
//   applyTypography(target, d.newClassList);
//   document.body.offsetHeight;
//   return;
// }


//       if (d.type === 'UPDATE_EDITABLE') {
//         var target = document.querySelector('[data-editable="' + d.editableId + '"]');
//         if (!target) return;
//         if (d.editableType === 'image') {
//           target.src = d.content;
//         } else if (d.editableType === 'link') {
//           target.href = d.content;
//         } else {
//           var textNodes = Array.from(target.childNodes).filter(function(n) {
//             return n.nodeType === 3;
//           });
//           if (textNodes.length > 0) {
//             textNodes[0].textContent = d.content;
//           } else {
//             target.textContent = d.content;
//           }
//         }
//         return;
//       }

//       if (d.type === 'UPDATE_BLOCK_STYLE') {
//         var target = document.querySelector('[data-block="' + d.blockId + '"]');
//         if (!target) return;
//         target.style[d.styleKey] = d.value;
//         document.body.offsetHeight;
//         return;
//       }
//     });

//     ${selectedBlockId ? `highlight(${JSON.stringify(selectedBlockId)});` : ""}
//   })();
// <\/script>`;

//   return processedHtml.includes("</body>")
//     ? processedHtml.replace("</body>", script + "\n</body>")
//     : processedHtml + script;
// }

// // ─────────────────────────────────────────────────────────────
// // DROP ZONE STRIP
// // ─────────────────────────────────────────────────────────────
// function DropZoneStrip({ id, isActive }: { id: string; isActive: boolean }) {
//   const { setNodeRef, isOver } = useDroppable({ id });
//   const active = isActive || isOver;
//   return (
//     <div
//       ref={setNodeRef}
//       data-dropzone-id={id}
//       className={`
//         mx-2 rounded-lg border-2 border-dashed transition-all duration-150
//         flex items-center justify-center text-xs font-semibold
//         ${active
//           ? "border-indigo-500 bg-indigo-50 text-indigo-600 py-3 my-1"
//           : "border-transparent text-transparent py-0.5 my-0.5 hover:border-gray-200 hover:py-1"}
//       `}
//     >
//       {active && (
//         <span className="flex items-center gap-1.5 animate-pulse">
//           <span>⬇</span> Drop here
//         </span>
//       )}
//     </div>
//   );
// }

// // ─────────────────────────────────────────────────────────────
// // SECTION ROW
// // ─────────────────────────────────────────────────────────────
// function SectionRow({
//   blockId, blockName, order, isSelected,
//   canMoveUp, canMoveDown,
//   onSelect, onRemove, onMoveUp, onMoveDown,
// }: {
//   blockId: string; blockName: string; order: number;
//   isSelected: boolean; canMoveUp: boolean; canMoveDown: boolean;
//   onSelect: () => void; onRemove: () => void;
//   onMoveUp: () => void; onMoveDown: () => void;
// }) {
//   return (
//     <div
//       onClick={onSelect}
//       className={`
//         flex items-center gap-2 px-3 py-2 mx-2 rounded-lg border
//         cursor-pointer transition-all group
//         ${isSelected
//           ? "border-indigo-400 bg-indigo-50 shadow-sm"
//           : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40"}
//       `}
//     >
//       <span className={`
//         w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0
//         ${isSelected ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-500"}
//       `}>
//         {order}
//       </span>
//       <div className="flex-1 min-w-0">
//         <span className="text-xs font-semibold text-gray-700 capitalize truncate block">
//           {blockName || blockId}
//         </span>
//       </div>
//       {isSelected && (
//         <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full shrink-0">
//           ✏️
//         </span>
//       )}
//       <div className={`
//         flex items-center gap-0.5 transition-opacity shrink-0
//         ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
//       `}>
//         <button
//           onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
//           disabled={!canMoveUp}
//           className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs"
//         >↑</button>
//         <button
//           onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
//           disabled={!canMoveDown}
//           className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs"
//         >↓</button>
//         <button
//           onClick={(e) => { e.stopPropagation(); onRemove(); }}
//           className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 text-xs"
//         >✕</button>
//       </div>
//     </div>
//   );
// }

// // ─────────────────────────────────────────────────────────────
// // EMPTY CANVAS
// // ─────────────────────────────────────────────────────────────
// function EmptyCanvas({ activeDropZone }: { activeDropZone: string | null }) {
//   const { setNodeRef, isOver } = useDroppable({ id: "canvas-empty" });
//   const active = isOver || activeDropZone === "canvas-empty" || activeDropZone === "canvas-iframe-drop";
//   return (
//     <div className="flex-1 flex flex-col p-4">
//       <div
//         ref={setNodeRef}
//         className={`
//           flex-1 flex flex-col items-center justify-center rounded-2xl
//           border-2 border-dashed transition-all duration-200
//           ${active ? "border-indigo-400 bg-indigo-50 scale-[0.99]" : "border-gray-200 bg-gray-50"}
//         `}
//       >
//         {active ? (
//           <div className="text-center animate-pulse">
//             <div className="text-5xl mb-3">⬇</div>
//             <p className="text-lg font-bold text-indigo-600">Drop to add!</p>
//           </div>
//         ) : (
//           <div className="text-center">
//             <div className="text-5xl mb-4">🧱</div>
//             <h3 className="text-base font-semibold text-gray-500 mb-1">Canvas is Empty</h3>
//             <p className="text-xs text-gray-400">Drag blocks from the left panel</p>
//             <div className="mt-3 text-xs text-gray-300">← drag from Blocks panel</div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// // ─────────────────────────────────────────────────────────────
// // IFRAME DROP OVERLAY
// // ─────────────────────────────────────────────────────────────
// function IframeDropOverlay({ isDragging }: { isDragging: boolean }) {
//   const { setNodeRef } = useDroppable({ id: "canvas-iframe-drop" });
//   return (
//     <div
//       ref={setNodeRef}
//       data-dropzone-id="canvas-iframe-drop"
//       className="absolute inset-0 z-10"
//       style={{ pointerEvents: isDragging ? "all" : "none" }}
//     />
//   );
// }

// // ─────────────────────────────────────────────────────────────
// // MAIN CANVAS COMPONENT
// // ─────────────────────────────────────────────────────────────
// export default function Canvas({
//   draggingOption,
//   activeDropZone,
// }: {
//   draggingOption: BlockOption | null;
//   activeDropZone: string | null;
// }) {
//   const {
//     currentTemplate, selectedBlockId,
//     selectBlock, removeBlockFromTemplate, reorderBlocks,
//   } = useEditorStore();

//   const iframeRef   = useRef<HTMLIFrameElement>(null);
//   const iframeReady = useRef(false);

//   // ── Stable refs — never cause re-renders ─────────────────
//   // lastEditables: tracks the last value sent to the iframe per editable
//   // Key insight: this is populated in handleIframeLoad from the store state
//   // AT THAT MOMENT. After that, Effect 3 diffs against it to detect changes.
//   const lastEditables   = useRef<Record<string, { content: string; type: string; tailwindClass: string }>>({});
//   const lastCssVars     = useRef<Record<string, string>>({});
//   const lastBlockStyles = useRef<Record<string, Record<string, string>>>({});

//   // ── Block-structure key: changes only on add/remove/reorder ──
//   // Does NOT change when editables' tailwindClass changes.
//   // This is the ONLY thing that should trigger a full iframe reload.
//   const lastBlockKey = useRef<string>("");

//   // ── Pending messages queued while iframe is loading ───────
//   const pendingMessages = useRef<object[]>([]);

//   // ── postMessage helper ────────────────────────────────────
//   const postToIframe = useCallback((msg: object) => {
//     iframeRef.current?.contentWindow?.postMessage(msg, "*");
//   }, []);

//   // ── Compute block-structure key (blockId + order only) ───
//   // IMPORTANT: Does NOT include rawHtml or tailwindClass.
//   // Changes only when blocks are added, removed, or reordered.
//   const getBlockKey = useCallback(() =>
//     (currentTemplate?.blocks ?? [])
//       .map((b) => `${b.blockId}:${b.blockOrder ?? 0}`)
//       .join("|"),
//   [currentTemplate?.blocks]);

//   // ── Write full HTML into iframe ───────────────────────────
//   const writeIframe = useCallback(() => {
//     if (!currentTemplate || !iframeRef.current) return;
//     const doc = iframeRef.current.contentDocument
//              || iframeRef.current.contentWindow?.document;
//     if (!doc) return;
//     iframeReady.current = false;
//     // Reset tracking — handleIframeLoad will repopulate from store
//     lastEditables.current   = {};
//     lastBlockStyles.current = {};
//     doc.open();
//     doc.write(buildIframeHtml(currentTemplate.rawHtml, selectedBlockId));
//     doc.close();
//   }, [currentTemplate, selectedBlockId]);

//   // ─────────────────────────────────────────────────────────
//   // EFFECT 1 — Full iframe reload ONLY when block structure changes
//   //
//   // Watches: block IDs + order (NOT rawHtml, NOT tailwindClass)
//   //
//   // WHY NOT rawHtml:
//   //   updateClassSwap updates block.rawHtml (to persist class in HTML)
//   //   but does NOT update currentTemplate.rawHtml.
//   //   So watching currentTemplate.rawHtml would fire on text/image edits
//   //   but NOT on class swaps — which is exactly what we want.
//   //
//   //   HOWEVER: updateEditable DOES update currentTemplate.rawHtml.
//   //   We want a reload for text edits too so the content persists.
//   //   Solution: watch BOTH blockKey AND currentTemplate.rawHtml,
//   //   but use the ref comparison to avoid double-reloads.
//   // ─────────────────────────────────────────────────────────
//   useEffect(() => {
//     if (!currentTemplate) return;

//     const newKey = getBlockKey();

//     // Only reload on block structure change (add/remove/reorder)
//     // updateClassSwap does NOT change currentTemplate.rawHtml,
//     // so this effect will NOT fire for font-size/weight changes.
//     if (newKey !== lastBlockKey.current) {
//       lastBlockKey.current = newKey;
//       writeIframe();
//     }
//   }, [
//     // Stable string: only changes on add/remove/reorder
//     (currentTemplate?.blocks ?? [])
//       .map((b) => `${b.blockId}:${b.blockOrder ?? 0}`)
//       .join("|"),
//   ]);

//   // ─────────────────────────────────────────────────────────
//   // EFFECT 1b — Reload when rawHtml changes (text/image edits)
//   //
//   // updateEditable changes currentTemplate.rawHtml.
//   // We need to reload so the new text appears in the iframe.
//   // updateClassSwap does NOT change currentTemplate.rawHtml,
//   // so this does NOT fire for class changes. ✅
//   // ─────────────────────────────────────────────────────────
//   const lastRawHtml = useRef<string>("");
//   useEffect(() => {
//     if (!currentTemplate?.rawHtml) return;
//     if (currentTemplate.rawHtml !== lastRawHtml.current) {
//       lastRawHtml.current = currentTemplate.rawHtml;
//       writeIframe();
//     }
//   }, [currentTemplate?.rawHtml]);

//  // Effect 2 — CSS variable changes → live postMessage
// // Only fires for LIVE updates (user dragging color picker)
// // NOT for initial load (handleIframeLoad handles that)
// useEffect(() => {
//   if (!currentTemplate?.cssVariables) return;
//   if (!iframeReady.current) return; // ← ADD THIS: skip if iframe not ready

//   const vars      = currentTemplate.cssVariables;
//   const hasChange = Object.entries(vars).some(
//     ([k, v]) => lastCssVars.current[k] !== v
//   );
//   if (!hasChange) return;

//   lastCssVars.current = { ...vars };
//   postToIframe({ type: "UPDATE_CSS_VARS", cssVariables: vars });
// }, [currentTemplate?.cssVariables]);

//   // ─────────────────────────────────────────────────────────
//   // EFFECT 3 — Editable class changes → postMessage
//   //
//   // THE FIX for "font-size/weight not updating":
//   //
//   // Root cause was a race condition:
//   //   1. updateClassSwap fires → updates store blocks (tailwindClass changes)
//   //   2. Effect 3 fires → detects change → queues postMessage
//   //   3. BUT: handleIframeLoad had just reset lastEditables from the store
//   //      AFTER the class change → so lastEditables already had the NEW value
//   //   4. Effect 3 sees prev.tailwindClass === currClass → SKIPS sending
//   //
//   // Fix: Effect 3 now sends postMessage DIRECTLY without going through
//   // lastEditables comparison. Instead it compares against a separate
//   // "sentToIframe" ref that tracks what was actually sent to the iframe,
//   // NOT what's in the store.
//   //
//   // This means:
//   //   - handleIframeLoad sets sentToIframe = store values (iframe has these)
//   //   - updateClassSwap changes store → Effect 3 sees new value ≠ sentToIframe
//   //   - postMessage sent → sentToIframe updated
//   //   - Next render: sentToIframe === store → no duplicate send ✅
//   // ─────────────────────────────────────────────────────────
//   // "sentToIframe" = what the iframe currently has (set on load + after each send)
//   const sentToIframe = useRef<Record<string, { content: string; tailwindClass: string }>>({});

//   useEffect(() => {
//     if (!currentTemplate?.blocks) return;

//     const toSend: object[] = [];

//     currentTemplate.blocks.forEach((block) => {
//       (block.editables ?? []).forEach((item) => {
//         const sent       = sentToIframe.current[item.id];
//         const currClass  = item.tailwindClass ?? "";
//         const currContent = item.content ?? "";

//         if (!sent) {
//           // Not yet sent to iframe — will be sent on next iframe load
//           return;
//         }

//         // ── Class changed ────────────────────────────────
//         if (sent.tailwindClass !== currClass) {
//           sentToIframe.current[item.id] = { ...sent, tailwindClass: currClass };

//           if (item.styleId) {
//             toSend.push({
//               type        : "UPDATE_CLASS",
//               styleId     : item.styleId,
//               newClassList: currClass,
//             });
//           } else {
//             toSend.push({
//               type        : "UPDATE_EDITABLE_CLASS",
//               editableId  : item.id,
//               newClassList: currClass,
//             });
//           }
//         }

//         // ── Content changed ──────────────────────────────
//         if (sent.content !== currContent) {
//           sentToIframe.current[item.id] = { ...sent, content: currContent };
//           toSend.push({
//             type        : "UPDATE_EDITABLE",
//             editableId  : item.id,
//             content     : currContent,
//             editableType: item.type,
//           });
//         }
//       });
//     });

//     if (toSend.length === 0) return;

//     if (iframeReady.current) {
//       toSend.forEach((msg) => postToIframe(msg));
//     } else {
//       pendingMessages.current.push(...toSend);
//     }
//   }, [currentTemplate?.blocks]);

//   // ─────────────────────────────────────────────────────────
//   // EFFECT 4 — Block-level inline style updates (bg color)
//   // ─────────────────────────────────────────────────────────
//   useEffect(() => {
//     if (!currentTemplate?.blocks || !iframeReady.current) return;

//     currentTemplate.blocks.forEach((block) => {
//       const blockStyles = (block as any).styles ?? {};
//       const prevStyles  = lastBlockStyles.current[block.blockId] ?? {};

//       const styleKeyMap: Record<string, string> = {
//         bgColor        : "backgroundColor",
//         backgroundColor: "backgroundColor",
//       };

//       Object.entries(blockStyles).forEach(([storeKey, value]) => {
//         const cssKey = styleKeyMap[storeKey] ?? storeKey;
//         if (prevStyles[cssKey] !== value) {
//           if (!lastBlockStyles.current[block.blockId]) {
//             lastBlockStyles.current[block.blockId] = {};
//           }
//           lastBlockStyles.current[block.blockId][cssKey] = value as string;
//           postToIframe({
//             type    : "UPDATE_BLOCK_STYLE",
//             blockId : block.blockId,
//             styleKey: cssKey,
//             value   : value as string,
//           });
//         }
//       });
//     });
//   }, [currentTemplate?.blocks]);

//   // ─────────────────────────────────────────────────────────
//   // EFFECT 5 — Re-highlight when selected block changes
//   // ─────────────────────────────────────────────────────────
//   useEffect(() => {
//     if (!iframeReady.current) return;
//     postToIframe({ type: "HIGHLIGHT_BLOCK", blockId: selectedBlockId });
//   }, [selectedBlockId]);

//   // ─────────────────────────────────────────────────────────
//   // EFFECT 6 — Listen for messages from iframe
//   // ─────────────────────────────────────────────────────────
//   useEffect(() => {
//     const handler = (e: MessageEvent) => {
//       if (e.data?.type === "BLOCK_SELECTED")   selectBlock(e.data.blockId);
//       if (e.data?.type === "BLOCK_DESELECTED") selectBlock(null);
//     };
//     window.addEventListener("message", handler);
//     return () => window.removeEventListener("message", handler);
//   }, [selectBlock]);

//   // ─────────────────────────────────────────────────────────
//   // IFRAME onLoad handler
//   //
//   // KEY FIX: Populates sentToIframe (NOT lastEditables) from the
//   // current store state. This records exactly what the iframe has
//   // right after loading, so Effect 3 can correctly diff against it.
//   //
//   // Old bug: lastEditables was populated here, then Effect 3 compared
//   // against it — but if a class change happened BEFORE the load completed,
//   // lastEditables would already have the NEW value, so Effect 3 would
//   // see no change and skip sending. Now sentToIframe is the source of
//   // truth for "what the iframe actually has", separate from the store.
//   // ─────────────────────────────────────────────────────────
// const handleIframeLoad = useCallback(() => {
//   iframeReady.current     = true;
//   sentToIframe.current    = {};
//   lastBlockStyles.current = {};

//   // Record store state as "what iframe has"
//   currentTemplate?.blocks?.forEach((block) => {
//     (block.editables ?? []).forEach((item) => {
//       sentToIframe.current[item.id] = {
//         content      : item.content ?? "",
//         tailwindClass: item.tailwindClass ?? "",
//       };
//     });
//     const blockStyles = (block as any).styles ?? {};
//     if (Object.keys(blockStyles).length > 0) {
//       lastBlockStyles.current[block.blockId] = { ...blockStyles };
//     }
//   });

//   // ✅ THE REAL FIX:
//   // Tailwind CDN script runs AFTER onLoad fires.
//   // It resets/overwrites CSS custom properties when it initializes.
//   // We must send CSS vars AFTER Tailwind finishes — use a delay.
//   //
//   // We send in 3 waves to guarantee delivery:
//   //   - 50ms:  catches fast loads
//   //   - 300ms: catches normal Tailwind CDN load
//   //   - 800ms: catches slow network / Tailwind config processing
//   const sendCssVars = () => {
//     if (currentTemplate?.cssVariables &&
//         Object.keys(currentTemplate.cssVariables).length > 0) {
//       postToIframe({
//         type        : "UPDATE_CSS_VARS",
//         cssVariables: currentTemplate.cssVariables,
//       });
//       lastCssVars.current = { ...currentTemplate.cssVariables };
//     }
//   };

//   sendCssVars();                          // immediate
//   setTimeout(sendCssVars, 300);           // after Tailwind CDN loads
//   setTimeout(sendCssVars, 800);           // safety net

//   // Highlight selected block
//   if (selectedBlockId) {
//     setTimeout(() => {
//       postToIframe({ type: "HIGHLIGHT_BLOCK", blockId: selectedBlockId });
//     }, 50);
//   }

//   // Flush pending messages
//   if (pendingMessages.current.length > 0) {
//     const msgs = [...pendingMessages.current];
//     pendingMessages.current = [];
//     setTimeout(() => msgs.forEach((msg) => postToIframe(msg)), 350);
//   }
// }, [currentTemplate, selectedBlockId, postToIframe]);

//   // ── Empty state ──────────────────────────────────────────
//   if (!currentTemplate || currentTemplate.blocks.length === 0) {
//     return (
//       <div className="flex-1 flex flex-col overflow-hidden">
//         <EmptyCanvas activeDropZone={activeDropZone} />
//       </div>
//     );
//   }

//   const blocks     = [...currentTemplate.blocks].sort((a, b) => (a.blockOrder ?? 0) - (b.blockOrder ?? 0));
//   const isDragging = !!draggingOption;

//   return (
//     <div className="flex-1 flex flex-col overflow-hidden">

//       {/* ── Top bar ── */}
//       <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 shrink-0">
//         <div className="flex items-center gap-2">
//           <span className="text-xs font-bold text-gray-700">
//             📄 {currentTemplate.templateName}
//           </span>
//           <span className="text-xs text-gray-400">
//             · {blocks.length} section{blocks.length !== 1 ? "s" : ""}
//           </span>
//         </div>
//         <div className="flex items-center gap-2">
//           {selectedBlockId && !isDragging && (
//             <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
//               ✏️ Editing: {selectedBlockId}
//             </span>
//           )}
//           {isDragging && (
//             <span className="text-xs bg-indigo-50 text-indigo-500 border border-indigo-200 px-2 py-0.5 rounded-full font-medium animate-pulse">
//               🎯 Drop in the section list above
//             </span>
//           )}
//           {!isDragging && (
//             <span className="text-xs text-gray-400">👆 Click section to select</span>
//           )}
//         </div>
//       </div>

//       {/* ── Section list with drop zones ── */}
//       <div
//         className="shrink-0 bg-gray-50 border-b border-gray-200 overflow-y-auto"
//         style={{ maxHeight: "220px" }}
//       >
//         <div className="py-1.5">
//           <DropZoneStrip id="drop-before-0" isActive={activeDropZone === "drop-before-0"} />
//           {blocks.map((block, idx) => (
//             <div key={block.blockId}>
//               <SectionRow
//                 blockId={block.blockId}
//                 blockName={block.blockName || block.blockId}
//                 order={idx + 1}
//                 isSelected={selectedBlockId === block.blockId}
//                 canMoveUp={idx > 0}
//                 canMoveDown={idx < blocks.length - 1}
//                 onSelect={() => selectBlock(selectedBlockId === block.blockId ? null : block.blockId)}
//                 onRemove={() => removeBlockFromTemplate(block.blockId)}
//                 onMoveUp={() => {
//                   if (idx > 0) reorderBlocks(block.blockId, blocks[idx - 1].blockId);
//                 }}
//                 onMoveDown={() => {
//                   if (idx < blocks.length - 1) reorderBlocks(block.blockId, blocks[idx + 1].blockId);
//                 }}
//               />
//               <DropZoneStrip
//                 id={`drop-after-${idx}`}
//                 isActive={activeDropZone === `drop-after-${idx}`}
//               />
//             </div>
//           ))}
//         </div>
//       </div>

//       {/* ── Iframe preview ── */}
//       <div className="flex-1 overflow-auto bg-white relative">
//         <iframe
//           ref={iframeRef}
//           title="Template Preview"
//           className="w-full border-0"
//           style={{ height: "100%", minHeight: "500px" }}
//           sandbox="allow-scripts allow-same-origin"
//           onLoad={handleIframeLoad}
//         />
//         <IframeDropOverlay isDragging={isDragging} />
//         {!selectedBlockId && !isDragging && (
//           <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none">
//             <div className="bg-black/50 text-white text-xs px-4 py-2 rounded-full backdrop-blur-sm">
//               👆 Click any section in the preview to edit
//             </div>
//           </div>
//         )}
//       </div>

//     </div>
//   );
// }












import { useRef, useEffect, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useEditorStore } from "../../store/editorStore";
import type { BlockOption } from "./BlockPanel";

const TAILWIND_FONT_SIZE_MAP: Record<string, string> = {
  "text-xs":   "0.75rem",  "text-sm":   "0.875rem", "text-base": "1rem",
  "text-lg":   "1.125rem", "text-xl":   "1.25rem",  "text-2xl":  "1.5rem",
  "text-3xl":  "1.875rem", "text-4xl":  "2.25rem",  "text-5xl":  "3rem",
  "text-6xl":  "3.75rem",  "text-7xl":  "4.5rem",   "text-8xl":  "6rem",
  "text-9xl":  "8rem",
};

const TAILWIND_FONT_WEIGHT_MAP: Record<string, string> = {
  "font-thin":       "100", "font-extralight": "200", "font-light":    "300",
  "font-normal":     "400", "font-medium":     "500", "font-semibold": "600",
  "font-bold":       "700", "font-extrabold":  "800", "font-black":    "900",
};

// ─────────────────────────────────────────────────────────────
// BUILD IFRAME HTML
// ─────────────────────────────────────────────────────────────
function buildIframeHtml(rawHtml: string, selectedBlockId: string | null): string {
  const tailwindCdn = rawHtml.includes("cdn.tailwindcss.com")
    ? ""
    : `<script src="https://cdn.tailwindcss.com"><\/script>`;

  let processedHtml = rawHtml
    .replace(/<link[^>]+href=["']\.\/public\/[^"']+["'][^>]*>/gi, "")
    .replace(/<link[^>]+href=["']public\/[^"']+["'][^>]*>/gi, "")
    .replace(/<script[^>]+src=["']\.\/public\/[^"']+["'][^>]*><\/script>/gi, "")
    .replace(/<script[^>]+src=["']public\/[^"']+["'][^>]*><\/script>/gi, "");

  if (tailwindCdn) {
    if (processedHtml.includes("</head>")) {
      processedHtml = processedHtml.replace("</head>", `${tailwindCdn}\n</head>`);
    } else if (processedHtml.includes("<head>")) {
      processedHtml = processedHtml.replace("<head>", `<head>\n${tailwindCdn}`);
    } else {
      processedHtml = `<head>${tailwindCdn}</head>\n` + processedHtml;
    }
  }

  const script = `
<script>
  (function () {
    var FONT_SIZE_MAP   = ${JSON.stringify(TAILWIND_FONT_SIZE_MAP)};
    var FONT_WEIGHT_MAP = ${JSON.stringify(TAILWIND_FONT_WEIGHT_MAP)};

    function stripPrefix(cls) {
      var idx = cls.indexOf(':');
      return idx !== -1 ? cls.slice(idx + 1) : cls;
    }

    function applyTypography(el, classList) {
      var classes = classList.split(' ').filter(Boolean);
      el.style.removeProperty('font-size');
      el.style.removeProperty('font-weight');
      classes.forEach(function(cls) {
        var base = stripPrefix(cls);
        if (FONT_SIZE_MAP[base])   el.style.setProperty('font-size',   FONT_SIZE_MAP[base],   'important');
        if (FONT_WEIGHT_MAP[base]) el.style.setProperty('font-weight', FONT_WEIGHT_MAP[base], 'important');
      });
    }

    function highlight(blockId) {
      document.querySelectorAll('[data-block]').forEach(function(el) {
        if (blockId && el.getAttribute('data-block') === blockId) {
          el.style.outline       = '3px solid #6366f1';
          el.style.outlineOffset = '-3px';
        } else {
          el.style.outline       = '';
          el.style.outlineOffset = '';
        }
      });
    }

    // ── Click handler — block selection ──────────────────
    document.addEventListener('click', function(e) {
      var el = e.target;
      while (el && el !== document.body) {
        if (el.hasAttribute && el.hasAttribute('data-block')) {
          var id = el.getAttribute('data-block');
          window.parent.postMessage({ type: 'BLOCK_SELECTED', blockId: id }, '*');
          highlight(id);
          return;
        }
        el = el.parentElement;
      }
      window.parent.postMessage({ type: 'BLOCK_DESELECTED' }, '*');
      highlight(null);
    });

    // ── Message handler ───────────────────────────────────
    window.addEventListener('message', function(e) {
      if (!e.data) return;
      var d = e.data;

      if (d.type === 'HIGHLIGHT_BLOCK') {
        highlight(d.blockId);
        return;
      }

      if (d.type === 'UPDATE_CSS_VARS') {
        var vars = d.cssVariables;
        if (!vars) return;
        // Write to live override style tag (highest specificity)
        var liveEl = document.getElementById('lp-css-vars-live');
        if (!liveEl) {
          liveEl    = document.createElement('style');
          liveEl.id = 'lp-css-vars-live';
          document.head.appendChild(liveEl);
        }
        var lines = Object.keys(vars).map(function(k) {
          return '  ' + k + ': ' + vars[k] + ';';
        }).join('\\n');
        liveEl.textContent = ':root {\\n' + lines + '\\n}';
        // Also update static tag if present
        var staticEl = document.getElementById('lp-css-vars');
        if (staticEl) staticEl.textContent = liveEl.textContent;
        // Force repaint WITHOUT display:none (that breaks clicks)
        document.body.offsetHeight;
        return;
      }

      if (d.type === 'UPDATE_CLASS') {
        var target = document.querySelector('[data-style-id="' + d.styleId + '"]');
        if (!target) target = document.querySelector('[data-editable="' + d.styleId + '"]');
        if (!target) return;
        target.className = d.newClassList;
        applyTypography(target, d.newClassList);
        target.querySelectorAll('*').forEach(function(child) {
          applyTypography(child, child.className);
        });
        document.body.offsetHeight;
        return;
      }

      if (d.type === 'UPDATE_EDITABLE_CLASS') {
        var target = document.querySelector('[data-editable="' + d.editableId + '"]');
        if (!target) return;
        target.className = d.newClassList;
        applyTypography(target, d.newClassList);
        document.body.offsetHeight;
        return;
      }

      if (d.type === 'UPDATE_EDITABLE') {
        var target = document.querySelector('[data-editable="' + d.editableId + '"]');
        if (!target) return;
        if (d.editableType === 'image') {
          target.src = d.content;
        } else if (d.editableType === 'link') {
          target.href = d.content;
        } else {
          var textNodes = Array.from(target.childNodes).filter(function(n) {
            return n.nodeType === 3;
          });
          if (textNodes.length > 0) textNodes[0].textContent = d.content;
          else target.textContent = d.content;
        }
        return;
      }

      if (d.type === 'UPDATE_BLOCK_STYLE') {
        var target = document.querySelector('[data-block="' + d.blockId + '"]');
        if (!target) return;
        target.style[d.styleKey] = d.value;
        document.body.offsetHeight;
        return;
      }
    });

    ${selectedBlockId ? `highlight(${JSON.stringify(selectedBlockId)});` : ""}
  })();
<\/script>`;

  return processedHtml.includes("</body>")
    ? processedHtml.replace("</body>", script + "\n</body>")
    : processedHtml + script;
}

// ─────────────────────────────────────────────────────────────
// DropZoneStrip, SectionRow, EmptyCanvas, IframeDropOverlay
// (unchanged — keep your existing implementations)
// ─────────────────────────────────────────────────────────────
function DropZoneStrip({ id, isActive }: { id: string; isActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const active = isActive || isOver;
  return (
    <div ref={setNodeRef} data-dropzone-id={id}
      className={`mx-2 rounded-lg border-2 border-dashed transition-all duration-150 flex items-center justify-center text-xs font-semibold ${active ? "border-indigo-500 bg-indigo-50 text-indigo-600 py-3 my-1" : "border-transparent text-transparent py-0.5 my-0.5 hover:border-gray-200 hover:py-1"}`}>
      {active && <span className="flex items-center gap-1.5 animate-pulse"><span>⬇</span> Drop here</span>}
    </div>
  );
}

function SectionRow({ blockId, blockName, order, isSelected, canMoveUp, canMoveDown, onSelect, onRemove, onMoveUp, onMoveDown }: {
  blockId: string; blockName: string; order: number; isSelected: boolean;
  canMoveUp: boolean; canMoveDown: boolean; onSelect: () => void;
  onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  return (
    <div onClick={onSelect}
      className={`flex items-center gap-2 px-3 py-2 mx-2 rounded-lg border cursor-pointer transition-all group ${isSelected ? "border-indigo-400 bg-indigo-50 shadow-sm" : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40"}`}>
      <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-500"}`}>{order}</span>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-gray-700 capitalize truncate block">{blockName || blockId}</span>
      </div>
      {isSelected && <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full shrink-0">✏️</span>}
      <div className={`flex items-center gap-0.5 transition-opacity shrink-0 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={!canMoveUp} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs">↑</button>
        <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={!canMoveDown} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs">↓</button>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 text-xs">✕</button>
      </div>
    </div>
  );
}

function EmptyCanvas({ activeDropZone }: { activeDropZone: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-empty" });
  const active = isOver || activeDropZone === "canvas-empty" || activeDropZone === "canvas-iframe-drop";
  return (
    <div className="flex-1 flex flex-col p-4">
      <div ref={setNodeRef} className={`flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200 ${active ? "border-indigo-400 bg-indigo-50 scale-[0.99]" : "border-gray-200 bg-gray-50"}`}>
        {active ? (
          <div className="text-center animate-pulse"><div className="text-5xl mb-3">⬇</div><p className="text-lg font-bold text-indigo-600">Drop to add!</p></div>
        ) : (
          <div className="text-center"><div className="text-5xl mb-4">🧱</div><h3 className="text-base font-semibold text-gray-500 mb-1">Canvas is Empty</h3><p className="text-xs text-gray-400">Drag blocks from the left panel</p><div className="mt-3 text-xs text-gray-300">← drag from Blocks panel</div></div>
        )}
      </div>
    </div>
  );
}

function IframeDropOverlay({ isDragging }: { isDragging: boolean }) {
  const { setNodeRef } = useDroppable({ id: "canvas-iframe-drop" });
  return <div ref={setNodeRef} data-dropzone-id="canvas-iframe-drop" className="absolute inset-0 z-10" style={{ pointerEvents: isDragging ? "all" : "none" }} />;
}

// ─────────────────────────────────────────────────────────────
// MAIN CANVAS
// ─────────────────────────────────────────────────────────────
export default function Canvas({ draggingOption, activeDropZone }: {
  draggingOption: BlockOption | null;
  activeDropZone: string | null;
}) {
  const { currentTemplate, selectedBlockId, selectBlock, removeBlockFromTemplate, reorderBlocks } = useEditorStore();

  const iframeRef         = useRef<HTMLIFrameElement>(null);
  const iframeReady       = useRef(false);
  const lastCssVars       = useRef<Record<string, string>>({});
  const lastBlockStyles   = useRef<Record<string, Record<string, string>>>({});
  const lastBlockKey      = useRef<string>("");
  const lastRawHtml       = useRef<string>("");
  const pendingMessages   = useRef<object[]>([]);
  const sentToIframe      = useRef<Record<string, { content: string; tailwindClass: string }>>({});
  // Track pending CSS var timers so we can cancel on unmount
  const cssVarTimers      = useRef<ReturnType<typeof setTimeout>[]>([]);

  const postToIframe = useCallback((msg: object) => {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  const writeIframe = useCallback(() => {
  if (!currentTemplate || !iframeRef.current) return;
  const doc = iframeRef.current.contentDocument
           || iframeRef.current.contentWindow?.document;
  if (!doc) return;

  iframeReady.current     = false;
  sentToIframe.current    = {};
  lastBlockStyles.current = {};

  // ✅ THE FIX: Inject CSS vars DIRECTLY into the HTML before writing.
  // This means vars are baked into the document — Tailwind CDN cannot
  // override them because our <style> tag is injected AFTER Tailwind loads.
  // We place it just before </body> so it's the LAST style rule = wins.
  let html = buildIframeHtml(currentTemplate.rawHtml, selectedBlockId);

  if (currentTemplate.cssVariables &&
      Object.keys(currentTemplate.cssVariables).length > 0) {
    const varLines = Object.entries(currentTemplate.cssVariables)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n");
    const styleTag = `<style id="lp-css-vars-baked">:root {\n${varLines}\n}</style>`;
    // Inject just before </body> — AFTER Tailwind CDN script tag
    // so it wins the cascade
    html = html.includes("</body>")
      ? html.replace("</body>", `${styleTag}\n</body>`)
      : html + styleTag;
  }

  doc.open();
  doc.write(html);
  doc.close();
}, [currentTemplate, selectedBlockId]);

  // ── Effect 1: block structure change → full reload ──────
  useEffect(() => {
    if (!currentTemplate) return;
    const newKey = (currentTemplate.blocks ?? [])
      .map((b) => `${b.blockId}:${b.blockOrder ?? 0}`).join("|");
    if (newKey !== lastBlockKey.current) {
      lastBlockKey.current = newKey;
      writeIframe();
    }
  }, [
    (currentTemplate?.blocks ?? [])
      .map((b) => `${b.blockId}:${b.blockOrder ?? 0}`).join("|"),
  ]);

  // ── Effect 1b: rawHtml change → full reload ─────────────
  useEffect(() => {
    if (!currentTemplate?.rawHtml) return;
    if (currentTemplate.rawHtml !== lastRawHtml.current) {
      lastRawHtml.current = currentTemplate.rawHtml;
      writeIframe();
    }
  }, [currentTemplate?.rawHtml]);

  // ── Effect 2: CSS vars live update (while iframe ready) ─
  useEffect(() => {
    if (!currentTemplate?.cssVariables) return;
    if (!iframeReady.current) return;
    const vars = currentTemplate.cssVariables;
    const hasChange = Object.entries(vars).some(([k, v]) => lastCssVars.current[k] !== v);
    if (!hasChange) return;
    lastCssVars.current = { ...vars };
    postToIframe({ type: "UPDATE_CSS_VARS", cssVariables: vars });
  }, [currentTemplate?.cssVariables]);

  // ── Effect 3: editable content/class changes ────────────
  useEffect(() => {
    if (!currentTemplate?.blocks) return;
    const toSend: object[] = [];
    currentTemplate.blocks.forEach((block) => {
      (block.editables ?? []).forEach((item) => {
        const sent        = sentToIframe.current[item.id];
        const currClass   = item.tailwindClass ?? "";
        const currContent = item.content ?? "";
        if (!sent) return;
        if (sent.tailwindClass !== currClass) {
          sentToIframe.current[item.id] = { ...sent, tailwindClass: currClass };
          if (item.styleId) {
            toSend.push({ type: "UPDATE_CLASS", styleId: item.styleId, newClassList: currClass });
          } else {
            toSend.push({ type: "UPDATE_EDITABLE_CLASS", editableId: item.id, newClassList: currClass });
          }
        }
        if (sent.content !== currContent) {
          sentToIframe.current[item.id] = { ...sent, content: currContent };
          toSend.push({ type: "UPDATE_EDITABLE", editableId: item.id, content: currContent, editableType: item.type });
        }
      });
    });
    if (toSend.length === 0) return;
    if (iframeReady.current) toSend.forEach((msg) => postToIframe(msg));
    else pendingMessages.current.push(...toSend);
  }, [currentTemplate?.blocks]);

  // ── Effect 4: block inline styles ───────────────────────
  useEffect(() => {
    if (!currentTemplate?.blocks || !iframeReady.current) return;
    const styleKeyMap: Record<string, string> = { bgColor: "backgroundColor", backgroundColor: "backgroundColor" };
    currentTemplate.blocks.forEach((block) => {
      const blockStyles = (block as any).styles ?? {};
      const prevStyles  = lastBlockStyles.current[block.blockId] ?? {};
      Object.entries(blockStyles).forEach(([storeKey, value]) => {
        const cssKey = styleKeyMap[storeKey] ?? storeKey;
        if (prevStyles[cssKey] !== value) {
          if (!lastBlockStyles.current[block.blockId]) lastBlockStyles.current[block.blockId] = {};
          lastBlockStyles.current[block.blockId][cssKey] = value as string;
          postToIframe({ type: "UPDATE_BLOCK_STYLE", blockId: block.blockId, styleKey: cssKey, value: value as string });
        }
      });
    });
  }, [currentTemplate?.blocks]);

  // ── Effect 5: highlight selected block ──────────────────
  useEffect(() => {
    if (!iframeReady.current) return;
    postToIframe({ type: "HIGHLIGHT_BLOCK", blockId: selectedBlockId });
  }, [selectedBlockId]);

  // ── Effect 6: message listener ───────────────────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "BLOCK_SELECTED")   selectBlock(e.data.blockId);
      if (e.data?.type === "BLOCK_DESELECTED") selectBlock(null);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [selectBlock]);

  // ── Cleanup timers on unmount ────────────────────────────
  useEffect(() => {
    return () => {
      cssVarTimers.current.forEach(clearTimeout);
    };
  }, []);

  // ── handleIframeLoad ─────────────────────────────────────
  const handleIframeLoad = useCallback(() => {
  iframeReady.current     = true;
  sentToIframe.current    = {};
  lastBlockStyles.current = {};

  // Populate sentToIframe from current store state
  currentTemplate?.blocks?.forEach((block) => {
    (block.editables ?? []).forEach((item) => {
      sentToIframe.current[item.id] = {
        content      : item.content ?? "",
        tailwindClass: item.tailwindClass ?? "",
      };
    });
    const blockStyles = (block as any).styles ?? {};
    if (Object.keys(blockStyles).length > 0) {
      lastBlockStyles.current[block.blockId] = { ...blockStyles };
    }
  });

  // Sync lastCssVars so Effect 2 doesn't fire unnecessarily
  if (currentTemplate?.cssVariables) {
    lastCssVars.current = { ...currentTemplate.cssVariables };
  }

  // Highlight selected block
  if (selectedBlockId) {
    postToIframe({ type: "HIGHLIGHT_BLOCK", blockId: selectedBlockId });
  }

  // Flush pending messages
  if (pendingMessages.current.length > 0) {
    const msgs = [...pendingMessages.current];
    pendingMessages.current = [];
    setTimeout(() => msgs.forEach((msg) => postToIframe(msg)), 50);
  }
}, [currentTemplate, selectedBlockId, postToIframe]);


// ── Effect 2 stays the same — handles LIVE color picker updates ──
// (user dragging color picker after iframe is loaded)
useEffect(() => {
  if (!currentTemplate?.cssVariables) return;
  if (!iframeReady.current) return;
  const vars = currentTemplate.cssVariables;
  const hasChange = Object.entries(vars).some(
    ([k, v]) => lastCssVars.current[k] !== v
  );
  if (!hasChange) return;
  lastCssVars.current = { ...vars };
  postToIframe({ type: "UPDATE_CSS_VARS", cssVariables: vars });
}, [currentTemplate?.cssVariables]);

  // ── Empty state ──────────────────────────────────────────
  if (!currentTemplate || currentTemplate.blocks.length === 0) {
    return <div className="flex-1 flex flex-col overflow-hidden"><EmptyCanvas activeDropZone={activeDropZone} /></div>;
  }

  const blocks     = [...currentTemplate.blocks].sort((a, b) => (a.blockOrder ?? 0) - (b.blockOrder ?? 0));
  const isDragging = !!draggingOption;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700">📄 {currentTemplate.templateName}</span>
          <span className="text-xs text-gray-400">· {blocks.length} section{blocks.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedBlockId && !isDragging && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">✏️ Editing: {selectedBlockId}</span>}
          {isDragging && <span className="text-xs bg-indigo-50 text-indigo-500 border border-indigo-200 px-2 py-0.5 rounded-full font-medium animate-pulse">🎯 Drop in the section list above</span>}
          {!isDragging && <span className="text-xs text-gray-400">👆 Click section to select</span>}
        </div>
      </div>

      <div className="shrink-0 bg-gray-50 border-b border-gray-200 overflow-y-auto" style={{ maxHeight: "220px" }}>
        <div className="py-1.5">
          <DropZoneStrip id="drop-before-0" isActive={activeDropZone === "drop-before-0"} />
          {blocks.map((block, idx) => (
            <div key={block.blockId}>
              <SectionRow
                blockId={block.blockId} blockName={block.blockName || block.blockId}
                order={idx + 1} isSelected={selectedBlockId === block.blockId}
                canMoveUp={idx > 0} canMoveDown={idx < blocks.length - 1}
                onSelect={() => selectBlock(selectedBlockId === block.blockId ? null : block.blockId)}
                onRemove={() => removeBlockFromTemplate(block.blockId)}
                onMoveUp={() => { if (idx > 0) reorderBlocks(block.blockId, blocks[idx - 1].blockId); }}
                onMoveDown={() => { if (idx < blocks.length - 1) reorderBlocks(block.blockId, blocks[idx + 1].blockId); }}
              />
              <DropZoneStrip id={`drop-after-${idx}`} isActive={activeDropZone === `drop-after-${idx}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white relative">
        <iframe
          ref={iframeRef} title="Template Preview"
          className="w-full border-0"
          style={{ height: "100%", minHeight: "500px" }}
          sandbox="allow-scripts allow-same-origin"
          onLoad={handleIframeLoad}
        />
        <IframeDropOverlay isDragging={isDragging} />
        {!selectedBlockId && !isDragging && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-black/50 text-white text-xs px-4 py-2 rounded-full backdrop-blur-sm">
              👆 Click any section in the preview to edit
            </div>
          </div>
        )}
      </div>
    </div>
  );
}