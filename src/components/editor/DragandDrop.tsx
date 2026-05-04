import { useDroppable } from "@dnd-kit/core";
import { useEditorStore } from "../../store/editorStore";

function isLockedSection(block: any): boolean {
  const blockId = String(block?.blockId || "").toLowerCase();
  const blockName = String(block?.blockName || "").toLowerCase();

  return (
    blockId.includes("navbar") ||
    blockId.includes("nav") ||
    blockId.includes("header") ||
    blockId.includes("footer") ||
    blockId.includes("hero") ||   // ✅ ADDED
    blockName.includes("navbar") ||
    blockName.includes("nav") ||
    blockName.includes("header") ||
    blockName.includes("footer") ||
    blockName.includes("hero")   // ✅ ADDED
  );
}

function DropZoneStrip({ id, isActive }: { id: string; isActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const active = isActive || isOver;

  return (
    <div
      ref={setNodeRef}
      data-dropzone-id={id}
      className={`mx-3 rounded-xl border-2 border-dashed transition-all duration-150 flex items-center justify-center text-xs font-semibold
        ${
          active
            ? "border-indigo-500 bg-indigo-50 text-indigo-600 py-4 my-2"
            : "border-transparent text-transparent py-1 my-1 hover:border-gray-200 hover:py-2"
        }`}
    >
      {active && (
        <span className="flex items-center gap-1.5 animate-pulse">
          <span>⬇</span> Drop here
        </span>
      )}
    </div>
  );
}

export default function DragandDrop({
  activeDropZone,
}: {
  activeDropZone: string | null;
}) {
  const {
    currentTemplate,
    selectedBlockId,
    selectBlock,
    removeBlockFromTemplate,
    reorderBlocks,
  } = useEditorStore();

  const blocks = [...(currentTemplate?.blocks ?? [])].sort(
    (a, b) => (a.blockOrder ?? 0) - (b.blockOrder ?? 0)
  );

  const handleSelectSection = (blockId: string) => {
    selectBlock(blockId);
  };

  return (
    <aside className="w-72 bg-gradient-to-b from-white to-slate-50 border-r border-indigo-100 h-full overflow-hidden flex flex-col">
      <div className="px-5 py-4 bg-white border-b border-indigo-100 shrink-0">
        <h2 className="font-semibold text-slate-800 text-sm">Page Sections</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Navbar, Hero, Header, and Footer are locked
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {blocks.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm font-semibold text-slate-500">
              No sections yet
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Drag blocks from the block panel
            </p>
          </div>
        ) : (
          <>
            <DropZoneStrip
              id="drop-before-0"
              isActive={activeDropZone === "drop-before-0"}
            />

            {blocks.map((block, idx) => {
              const isSelected = selectedBlockId === block.blockId;
              const locked = isLockedSection(block);

              const prevBlock = blocks[idx - 1];
              const nextBlock = blocks[idx + 1];

              const canMoveUp =
                !locked && idx > 0 && !isLockedSection(prevBlock);

              const canMoveDown =
                !locked &&
                idx < blocks.length - 1 &&
                !isLockedSection(nextBlock);

              return (
                <div key={block.blockId}>
                  <div
                    onClick={() => handleSelectSection(block.blockId)}
                    className={`flex items-center gap-2 px-3 py-2.5 mx-3 rounded-xl border cursor-pointer transition-all group
                      ${
                        isSelected
                          ? "border-indigo-400 bg-indigo-50 shadow-sm"
                          : locked
                          ? "border-amber-200 bg-amber-50/60 hover:border-amber-300"
                          : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40"
                      }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0
                        ${
                          isSelected
                            ? "bg-indigo-500 text-white"
                            : locked
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                    >
                      {idx + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 capitalize truncate">
                        {block.blockName || block.blockId}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {block.blockId}
                      </p>
                    </div>

                    {locked && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">
                        🔒
                      </span>
                    )}

                    {isSelected && !locked && (
                      <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full shrink-0">
                        ✏️
                      </span>
                    )}

                    <div
                      className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
                        isSelected
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canMoveUp) {
                            reorderBlocks(
                              block.blockId,
                              blocks[idx - 1].blockId
                            );
                          }
                        }}
                        disabled={!canMoveUp}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs"
                      >
                        ↑
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canMoveDown) {
                            reorderBlocks(
                              block.blockId,
                              blocks[idx + 1].blockId
                            );
                          }
                        }}
                        disabled={!canMoveDown}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs"
                      >
                        ↓
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();

                          if (locked) {
                            alert(
                              "Navbar, Hero, Header, and Footer are locked."
                            );
                            return;
                          }

                          removeBlockFromTemplate(block.blockId);
                        }}
                        className={`p-1 rounded text-xs ${
                          locked
                            ? "text-gray-300 cursor-not-allowed"
                            : "hover:bg-red-50 text-gray-300 hover:text-red-500"
                        }`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <DropZoneStrip
                    id={`drop-after-${idx}`}
                    isActive={activeDropZone === `drop-after-${idx}`}
                  />
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="px-5 py-3 border-t border-indigo-100 bg-white shrink-0">
        <p className="text-xs text-slate-400 text-center">
          Locked sections cannot be moved
        </p>
      </div>
    </aside>
  );
}