import { useDroppable, useDraggable } from "@dnd-kit/core";
import { useEditorStore } from "../../store/editorStore";

function isLockedSection(block: any): boolean {
  const blockId = String(block?.blockId || "").toLowerCase();
  const blockName = String(block?.blockName || "").toLowerCase();

  return (
    blockId.includes("navbar") ||
    blockId.includes("nav") ||
    blockId.includes("header") ||
    blockId.includes("footer") ||
    blockId.includes("hero") ||
    blockName.includes("navbar") ||
    blockName.includes("nav") ||
    blockName.includes("header") ||
    blockName.includes("footer") ||
    blockName.includes("hero")
  );
}

function isFooterSection(block: any): boolean {
  const blockId = String(block?.blockId || "").toLowerCase();
  const blockName = String(block?.blockName || "").toLowerCase();

  return blockId.includes("footer") || blockName.includes("footer");
}

function DropZoneStrip({
  id,
  isActive,
  disabled = false,
}: {
  id: string;
  isActive: boolean;
  disabled?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled,
  });

  const active = !disabled && (isActive || isOver);

  if (disabled) {
    return <div className="py-1 my-1" />;
  }

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

function DraggableSectionCard({
  block,
  idx,
  locked,
  children,
}: {
  block: any;
  idx: number;
  locked: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `section-${block.blockId}`,
      disabled: locked,
      data: {
        type: "existing-section",
        blockId: block.blockId,
        index: idx,
      },
    });

  const style: React.CSSProperties | undefined = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 999 : "auto",
        position: isDragging ? "relative" : "static",
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div {...(!locked ? listeners : {})}>{children}</div>
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
          Navbar, Hero, and Footer are fixed
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
            {/* disabled: no section before navbar */}
            <DropZoneStrip
              id="drop-before-0"
              isActive={activeDropZone === "drop-before-0"}
              disabled={true}
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

              const disableDropAfter =
                isLockedSection(block) || isFooterSection(nextBlock);

              return (
                <div key={block.blockId}>
                  <DraggableSectionCard
                    block={block}
                    idx={idx}
                    locked={locked}
                  >
                    <div
                      onClick={() => handleSelectSection(block.blockId)}
                      className={`flex items-center gap-2 px-3 py-2.5 mx-3 rounded-xl border transition-all group
                        ${
                          locked
                            ? "cursor-not-allowed"
                            : "cursor-grab active:cursor-grabbing"
                        }
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
                              alert("Navbar, Hero, and Footer are fixed.");
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
                  </DraggableSectionCard>

                  <DropZoneStrip
                    id={`drop-after-${idx}`}
                    isActive={activeDropZone === `drop-after-${idx}`}
                    disabled={disableDropAfter}
                  />
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="px-5 py-3 border-t border-indigo-100 bg-white shrink-0">
        <p className="text-xs text-slate-400 text-center">
          Sections can only move between Hero and Footer
        </p>
      </div>
    </aside>
  );
}