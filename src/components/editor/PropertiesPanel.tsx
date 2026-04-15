import { useRef, useState } from "react";
import type { ParsedBlock, Template, EditableItem } from "../../types";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const FONT_SIZE_OPTIONS = ["text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl", "text-3xl", "text-4xl", "text-5xl", "text-6xl"];
const FONT_WEIGHT_OPTIONS = ["font-thin", "font-extralight", "font-light", "font-normal", "font-medium", "font-semibold", "font-bold", "font-extrabold", "font-black"];
const BORDER_RADIUS_OPTIONS = ["rounded-none", "rounded-sm", "rounded", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-3xl", "rounded-full"];
const SHADOW_OPTIONS = ["shadow-none", "shadow-sm", "shadow", "shadow-md", "shadow-lg", "shadow-xl", "shadow-2xl"];
const PADDING_Y_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40];
const PADDING_X_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40];

// ─────────────────────────────────────────────────────────────
// TAILWIND CLASS HELPERS
// ─────────────────────────────────────────────────────────────
function stripPrefix(cls: string): string {
  const idx = cls.indexOf(":");
  return idx !== -1 ? cls.slice(idx + 1) : cls;
}

function swapClass(classList: string, options: string[], newVal: string): string {
  const kept = classList
    .split(" ")
    .filter(Boolean)
    .filter((c) => !options.includes(stripPrefix(c)));
  return newVal ? [...kept, newVal].join(" ").trim() : kept.join(" ").trim();
}

function getCurrentClass(classList: string, options: string[]): string {
  const match = classList
    .split(" ")
    .filter(Boolean)
    .find((c) => options.includes(stripPrefix(c)));
  return match ? stripPrefix(match) : "";
}

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────
interface Props {
  selectedBlock: ParsedBlock | null;
  template: Template | null;
  onEditableChange: (editableId: string, newContent: string) => void;
  onCssVarChange: (varName: string, newValue: string) => void;
  onClassSwap: (editableId: string, newClassList: string) => void;
  onBlockStyleChange: (blockId: string, styleKey: string, value: string) => void;
  resolveLiveColor: (varName: string) => string;
}

// ─────────────────────────────────────────────────────────────
// ACCORDION SECTION
// ─────────────────────────────────────────────────────────────
function AccordionSection({ icon, title, badge, defaultOpen = true, children }: { icon: string; title: string; badge?: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-3 rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5
                   bg-linear-to-r from-gray-50 to-white hover:from-indigo-50
                   hover:to-white transition-all duration-150"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{title}</span>
          {badge !== undefined && badge > 0 && <span className="text-xs bg-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded-full leading-none">{badge}</span>}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="px-3 pb-3 pt-2 bg-white space-y-2">{children}</div>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">{children}</label>;
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                 focus:outline-none focus:ring-2 focus:ring-indigo-400
                 focus:border-indigo-300 bg-gray-50 transition-all placeholder:text-gray-300"
    />
  );
}

function TextArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                 focus:outline-none focus:ring-2 focus:ring-indigo-400
                 focus:border-indigo-300 resize-none bg-gray-50 transition-all"
    />
  );
}

function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  };
  return (
    <div className="space-y-2">
      {value && (
        <div className="rounded-xl border-2 border-gray-100 bg-gray-50 h-28 flex items-center justify-center overflow-hidden relative group">
          <img
            src={value}
            alt="preview"
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 text-xs text-white font-semibold bg-black/50 px-2 py-1 rounded-lg transition-all">Change Image</span>
          </div>
        </div>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com/image.jpg"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono
                   focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 placeholder:text-gray-300"
      />
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed
                   border-indigo-200 rounded-xl text-xs text-indigo-500 font-semibold hover:bg-indigo-50
                   hover:border-indigo-400 transition-all duration-150"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Upload from device
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

function ColorPicker({ label, varName, value, onChange }: { label: string; varName: string; value: string; onChange: (varName: string, val: string) => void }) {
  const safeValue = value && value.startsWith("#") ? value : "#ffffff";
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100 hover:border-indigo-200 transition-all">
      <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-md shrink-0 cursor-pointer hover:scale-105 transition-transform">
        <input type="color" value={safeValue} onChange={(e) => onChange(varName, e.target.value)} className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer opacity-0 z-10" />
        <div className="w-full h-full" style={{ background: value || "#ffffff" }} />
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)",
            backgroundSize: "6px 6px",
            backgroundPosition: "0 0,0 3px,3px -3px,-3px 0",
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-600 mb-1 capitalize">{label}</p>
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(varName, e.target.value)}
          placeholder="#ffffff"
          className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs font-mono
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        />
      </div>
    </div>
  );
}

function InlineColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (val: string) => void }) {
  const toHex = (color: string): string => {
    if (!color) return "#ffffff";
    if (color.startsWith("#")) return color;
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) return "#" + [match[1], match[2], match[3]].map((n) => parseInt(n).toString(16).padStart(2, "0")).join("");
    return "#ffffff";
  };
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100 hover:border-indigo-200 transition-all">
      <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-md shrink-0 cursor-pointer hover:scale-105 transition-transform">
        <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer opacity-0 z-10" />
        <div className="w-full h-full" style={{ background: value || "#ffffff" }} />
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)",
            backgroundSize: "6px 6px",
            backgroundPosition: "0 0,0 3px,3px -3px,-3px 0",
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-600 mb-1 capitalize">{label}</p>
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#ffffff"
          className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs font-mono
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        />
      </div>
    </div>
  );
}

function SelectField({ value, options, placeholder, onChange }: { value: string; options: string[]; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs
                   focus:outline-none focus:ring-2 focus:ring-indigo-400
                   bg-gray-50 appearance-none cursor-pointer pr-8"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

function PaddingSlider({ label, value, steps, onChange }: { label: string; value: number; steps: number[]; onChange: (v: number) => void }) {
  const idx = steps.indexOf(value);
  const pct = ((idx === -1 ? 0 : idx) / (steps.length - 1)) * 100;
  return (
    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-gray-500">{label}</span>
        <span className="text-xs font-bold text-white bg-indigo-500 px-2 py-0.5 rounded-full min-w-7 text-center">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        value={idx === -1 ? 0 : idx}
        onChange={(e) => onChange(steps[parseInt(e.target.value)])}
        className="w-full accent-indigo-500 cursor-pointer"
        style={{ background: `linear-gradient(to right, #6366f1 ${pct}%, #e5e7eb ${pct}%)` }}
      />
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-300">{steps[0]}</span>
        <span className="text-xs text-gray-300">{steps[steps.length - 1]}</span>
      </div>
    </div>
  );
}

function BlockStylesSection({
  blockId,
  styles,
  onBlockStyleChange,
}: {
  blockId: string;
  styles: { bgColor?: string };
  onBlockStyleChange: (blockId: string, styleKey: string, value: string) => void;
}) {
  return (
    <AccordionSection icon="🎛️" title="Block Styles" defaultOpen={true}>
      <div className="space-y-3 pt-1">
        <div>
          <FieldLabel>Background Color</FieldLabel>
          <InlineColorPicker label="Background" value={styles?.bgColor || ""} onChange={(v) => onBlockStyleChange(blockId, "backgroundColor", v)} />
        </div>
      </div>
    </AccordionSection>
  );
}

// ─────────────────────────────────────────────────────────────
// EDITABLE CARD — with debug logs in correct positions
// ─────────────────────────────────────────────────────────────
function EditableCard({
  item,
  onEditableChange,
  onCssVarChange,
  onClassSwap,
  resolveLiveColor,
}: {
  item: EditableItem;
  onEditableChange: (id: string, v: string) => void;
  onCssVarChange: (varName: string, v: string) => void;
  onClassSwap: (id: string, cls: string) => void;
  resolveLiveColor: (varName: string) => string;
}) {
  const [open, setOpen] = useState(true);

  const styleProps = item.styleProps
    ? item.styleProps
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const extraProps = styleProps.filter((p) => !["bg", "text-color", "border-color", "text-align", "font-size", "font-weight"].includes(p));

  const label = item.id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // ── These must be declared BEFORE the console.log ──
  const currentFontSize = getCurrentClass(item.tailwindClass, FONT_SIZE_OPTIONS);
  const currentFontWeight = getCurrentClass(item.tailwindClass, FONT_WEIGHT_OPTIONS);

  // ── DEBUG LOG 1: What data does each editable have? ──
  // Open DevTools → Console, click a block to see this output.
  // Look for badge/button items and check tailwindClass + currentFontSize.
  console.log(`%c[EditableCard] ${item.id}`, "color: #6366f1; font-weight: bold", {
    type: item.type,
    styleId: item.styleId,
    tailwindClass: item.tailwindClass,
    currentFontSize,
    currentFontWeight,
    styleProps: item.styleProps,
  });

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left">
        <span
          className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs"
          style={{
            background: item.type === "image" ? "#fef3c7" : "#ede9fe",
            color: item.type === "image" ? "#92400e" : "#5b21b6",
          }}
        >
          {item.type === "image" ? "🖼" : "T"}
        </span>
        <span className="flex-1 text-xs font-semibold text-gray-700 truncate">{label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-50">
          <div className="pt-2">
            {item.type === "image" ? (
              <ImageField value={item.content} onChange={(v) => onEditableChange(item.id, v)} />
            ) : item.content.length > 80 ? (
              <TextArea value={item.content} onChange={(v) => onEditableChange(item.id, v)} />
            ) : (
              <TextInput value={item.content} onChange={(v) => onEditableChange(item.id, v)} />
            )}
          </div>

          {item.type !== "image" && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Typography</p>

              <div>
                <FieldLabel>Font Size</FieldLabel>
                <SelectField
                  value={currentFontSize}
                  options={FONT_SIZE_OPTIONS}
                  placeholder="— inherit —"
                  onChange={(v) => {
                    const newClassList = swapClass(item.tailwindClass, FONT_SIZE_OPTIONS, v);
                    // ── DEBUG LOG 2: What gets sent to onClassSwap? ──
                    console.log(`%c[FontSize] ${item.id}`, "color: #10b981; font-weight: bold", {
                      editableId: item.id,
                      from: currentFontSize,
                      to: v,
                      oldClassList: item.tailwindClass,
                      newClassList,
                    });
                    onClassSwap(item.id, newClassList);
                  }}
                />
                {item.tailwindClass.split(" ").some((c) => c.includes(":") && FONT_SIZE_OPTIONS.includes(stripPrefix(c))) && (
                  <p className="text-xs text-amber-500 mt-1">⚠ Responsive sizes removed when you pick a size</p>
                )}
              </div>

              <div>
                <FieldLabel>Font Weight</FieldLabel>
                <SelectField
                  value={currentFontWeight}
                  options={FONT_WEIGHT_OPTIONS}
                  placeholder="— inherit —"
                  onChange={(v) => {
                    const newClassList = swapClass(item.tailwindClass, FONT_WEIGHT_OPTIONS, v);
                    // ── DEBUG LOG 3: Font weight change ──
                    console.log(`%c[FontWeight] ${item.id}`, "color: #f59e0b; font-weight: bold", {
                      editableId: item.id,
                      from: currentFontWeight,
                      to: v,
                      oldClassList: item.tailwindClass,
                      newClassList,
                    });
                    onClassSwap(item.id, newClassList);
                  }}
                />
              </div>
            </div>
          )}

          {Object.keys(item.colorVars).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Colors</p>
              {Object.entries(item.colorVars)
                .filter(([prop]) => prop !== "bg")
                .map(([prop, varName]) => (
                  <ColorPicker key={varName} label={prop === "bg" ? "Background" : prop.replace(/-/g, " ")} varName={varName} value={resolveLiveColor(varName)} onChange={onCssVarChange} />
                ))}
            </div>
          )}

          {extraProps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Layout</p>
              {styleProps.includes("border-radius") && (
                <div>
                  <FieldLabel>Border Radius</FieldLabel>
                  <SelectField
                    value={getCurrentClass(item.tailwindClass, BORDER_RADIUS_OPTIONS)}
                    options={BORDER_RADIUS_OPTIONS}
                    onChange={(v) => onClassSwap(item.id, swapClass(item.tailwindClass, BORDER_RADIUS_OPTIONS, v))}
                  />
                </div>
              )}
              {styleProps.includes("shadow") && (
                <div>
                  <FieldLabel>Shadow</FieldLabel>
                  <SelectField
                    value={getCurrentClass(item.tailwindClass, SHADOW_OPTIONS)}
                    options={SHADOW_OPTIONS}
                    onChange={(v) => onClassSwap(item.id, swapClass(item.tailwindClass, SHADOW_OPTIONS, v))}
                  />
                </div>
              )}
              {styleProps.includes("padding-y") && (
                <PaddingSlider
                  label="Padding Y"
                  value={parseInt((item.tailwindClass.match(/py-(\d+)/) || ["", "0"])[1])}
                  steps={PADDING_Y_STEPS}
                  onChange={(v) => onClassSwap(item.id, item.tailwindClass.replace(/py-\d+/, "").trim() + ` py-${v}`)}
                />
              )}
              {styleProps.includes("padding-x") && (
                <PaddingSlider
                  label="Padding X"
                  value={parseInt((item.tailwindClass.match(/px-(\d+)/) || ["", "0"])[1])}
                  steps={PADDING_X_STEPS}
                  onChange={(v) => onClassSwap(item.id, item.tailwindClass.replace(/px-\d+/, "").trim() + ` px-${v}`)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BlockColorVars({
  colorVars,
  onCssVarChange,
  resolveLiveColor,
}: {
  colorVars: Record<string, string>;
  onCssVarChange: (varName: string, val: string) => void;
  resolveLiveColor: (varName: string) => string;
}) {
  const entries = Object.entries(colorVars).filter(([prop]) => prop !== "bg");
  if (entries.length === 0) return null;
  return (
    <AccordionSection icon="🎨" title="Section Colors" badge={entries.length}>
      <div className="space-y-2 pt-1">
        {entries.map(([prop, varName]) => (
          <ColorPicker key={varName} label={prop === "bg" ? "Background" : prop.replace(/-/g, " ")} varName={varName} value={resolveLiveColor(varName)} onChange={onCssVarChange} />
        ))}
      </div>
    </AccordionSection>
  );
}

function EmptyState() {
  return (
    <div className="w-72 bg-white border-l border-gray-100 flex flex-col h-full">
      <div className="px-4 py-4 border-b border-gray-100 bg-linear-to-r from-slate-50 to-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83 M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <h2 className="font-bold text-gray-700 text-sm">Properties</h2>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-indigo-50 to-violet-50 flex items-center justify-center border border-indigo-100">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M3 9h18M9 21V9" />
            </svg>
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center shadow-md">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-600">Select a Section</p>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">Click any section in the canvas preview to edit its content, colors, and styles.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-300 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
          <span>👆</span>
          <span>Click on the canvas below</span>
        </div>
      </div>
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-400 text-center">⚡ Live editing — no save needed</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function PropertiesPanel({ selectedBlock, template, onEditableChange, onCssVarChange, onClassSwap, onBlockStyleChange, resolveLiveColor }: Props) {
  if (!selectedBlock || !template) return <EmptyState />;

  const { blockId, blockName, editables, colorVars, styles } = selectedBlock;

  // ── DEBUG LOG 4: What editables does the selected block have? ──
  console.log(`%c[PropertiesPanel] block: ${blockId}`, "color: #8b5cf6; font-weight: bold; font-size: 13px", {
    editableCount: editables.length,
    editables: editables.map((e) => ({
      id: e.id,
      type: e.type,
      styleId: e.styleId,
      tailwindClass: e.tailwindClass,
      colorVarsKeys: Object.keys(e.colorVars ?? {}),
    })),
  });

  const textEditables = editables.filter((e) => e.type !== "image");
  const imageEditables = editables.filter((e) => e.type === "image");

  return (
    <div className="w-72 bg-white border-l border-gray-100 flex flex-col h-full overflow-hidden">
      {/* HEADER */}
      <div className="px-4 py-3.5 border-b border-gray-100 bg-linear-to-r from-indigo-600 to-violet-600 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0 border border-white/30">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-white text-sm leading-tight truncate capitalize">{blockName || blockId}</h2>
            <p className="text-xs text-indigo-200 leading-tight mt-0.5">
              {editables.length} field{editables.length !== 1 ? "s" : ""} · live editing
            </p>
          </div>
          <div className="shrink-0 bg-white/20 text-white text-xs font-bold px-2 py-1 rounded-lg border border-white/20">#{blockId}</div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          {Object.keys(colorVars ?? {}).length > 0 && (
            <span className="flex items-center gap-1 text-xs bg-white/15 text-white px-2 py-1 rounded-lg border border-white/20">
              🎨 {Object.keys(colorVars ?? {}).length} color{Object.keys(colorVars ?? {}).length !== 1 ? "s" : ""}
            </span>
          )}
          {textEditables.length > 0 && <span className="flex items-center gap-1 text-xs bg-white/15 text-white px-2 py-1 rounded-lg border border-white/20">✏️ {textEditables.length} text</span>}
          {imageEditables.length > 0 && <span className="flex items-center gap-1 text-xs bg-white/15 text-white px-2 py-1 rounded-lg border border-white/20">🖼 {imageEditables.length} img</span>}
        </div>
      </div>

      {/* SCROLLABLE BODY */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin scrollbar-thumb-gray-200">
        <BlockStylesSection blockId={blockId} styles={{ bgColor: styles?.bgColor }} onBlockStyleChange={onBlockStyleChange} />

        <BlockColorVars colorVars={colorVars ?? {}} onCssVarChange={onCssVarChange} resolveLiveColor={resolveLiveColor} />

        {textEditables.length > 0 && (
          <AccordionSection icon="✏️" title="Text Content" badge={textEditables.length}>
            <div className="space-y-2 pt-1">
              {textEditables.map((item) => (
                <EditableCard key={item.id} item={item} onEditableChange={onEditableChange} onCssVarChange={onCssVarChange} onClassSwap={onClassSwap} resolveLiveColor={resolveLiveColor} />
              ))}
            </div>
          </AccordionSection>
        )}

        {imageEditables.length > 0 && (
          <AccordionSection icon="🖼️" title="Images" badge={imageEditables.length}>
            <div className="space-y-2 pt-1">
              {imageEditables.map((item) => (
                <EditableCard key={item.id} item={item} onEditableChange={onEditableChange} onCssVarChange={onCssVarChange} onClassSwap={onClassSwap} resolveLiveColor={resolveLiveColor} />
              ))}
            </div>
          </AccordionSection>
        )}

        {editables.length === 0 && Object.keys(colorVars ?? {}).length === 0 && (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🔍</div>
            <p className="text-xs font-semibold text-gray-400">No editable fields</p>
            <p className="text-xs text-gray-300 mt-1">Use Block Styles above to customize.</p>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-linear-to-r from-gray-50 to-white shrink-0 flex items-center justify-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <p className="text-xs text-gray-400">Changes apply instantly to the canvas</p>
      </div>
    </div>
  );
}
