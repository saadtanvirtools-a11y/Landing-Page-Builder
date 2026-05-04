import { useRef, useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import type { ParsedBlock, Template, EditableItem, PageScripts } from "../../types";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const FONT_SIZE_OPTIONS = [
  "text-xs",
  "text-sm",
  "text-base",
  "text-lg",
  "text-xl",
  "text-2xl",
  "text-3xl",
  "text-4xl",
  "text-5xl",
  "text-6xl",
];

const FONT_WEIGHT_OPTIONS = [
  "font-thin",
  "font-extralight",
  "font-light",
  "font-normal",
  "font-medium",
  "font-semibold",
  "font-bold",
  "font-extrabold",
  "font-black",
];

const BORDER_RADIUS_OPTIONS = [
  "rounded-none",
  "rounded-sm",
  "rounded",
  "rounded-md",
  "rounded-lg",
  "rounded-xl",
  "rounded-2xl",
  "rounded-3xl",
  "rounded-full",
];

const SHADOW_OPTIONS = [
  "shadow-none",
  "shadow-sm",
  "shadow",
  "shadow-md",
  "shadow-lg",
  "shadow-xl",
  "shadow-2xl",
];

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

function prettifyLabel(id: string): string {
  return id
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isValidSvgMarkup(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("<svg") && trimmed.includes("</svg>");
}

function hasMarqueeCss(css: string): boolean {
  const lower = (css || "").toLowerCase();
  return (
    lower.includes("marquee") ||
    lower.includes("marquee-track") ||
    lower.includes("marquee-wrapper") ||
    lower.includes("marquee-container") ||
    /@keyframes\s+[^{]*marquee/i.test(css) ||
    /animation\s*:[^;]*marquee/i.test(css)
  );
}

function extractMarqueeSpeed(css: string): number {
  if (!css) return 20;

  const animationDurationMatch = css.match(/animation-duration\s*:\s*(\d+(?:\.\d+)?)(ms|s)/i);
  if (animationDurationMatch) {
    const value = parseFloat(animationDurationMatch[1]);
    const unit = animationDurationMatch[2].toLowerCase();
    return unit === "ms" ? Math.max(1, Math.round(value / 1000)) : value;
  }

  const animationMatch = css.match(/animation\s*:[^;]*?(\d+(?:\.\d+)?)(ms|s)[^;]*;/i);
  if (animationMatch) {
    const value = parseFloat(animationMatch[1]);
    const unit = animationMatch[2].toLowerCase();
    return unit === "ms" ? Math.max(1, Math.round(value / 1000)) : value;
  }

  return 20;
}

function updateMarqueeSpeed(css: string, newSpeed: number): string {
  if (!css) return css;
  const speed = `${newSpeed}s`;

  let updated = css.replace(
    /(animation-duration\s*:\s*)(\d+(?:\.\d+)?)(ms|s)/gi,
    `$1${speed}`
  );

  updated = updated.replace(
    /(animation\s*:[^;]*?)(\d+(?:\.\d+)?)(ms|s)([^;]*;)/gi,
    `$1${speed}$4`
  );

  return updated;
}

function extractMarqueeCssPreview(css: string): string {
  if (!css) return "";

  const parts: string[] = [];
  const keyframesRegex = /@keyframes\s+[^{]*marquee[\s\S]*?}\s*}/gi;
  const ruleRegex = /[^{}]*(marquee|animation)[^{}]*\{[^{}]*\}/gi;

  let match: RegExpExecArray | null;

  while ((match = keyframesRegex.exec(css)) !== null) {
    parts.push(match[0].trim());
  }

  while ((match = ruleRegex.exec(css)) !== null) {
    const rule = match[0].trim();
    if (!parts.includes(rule)) parts.push(rule);
  }

  return parts.join("\n\n");
}

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────
interface Props {
  selectedBlock: ParsedBlock | null;
  template: Template | null;
  pageSettings: PageScripts;
  onPageSettingsChange: (data: Partial<PageScripts>) => void;
  onEditableChange: (editableId: string, newContent: string) => void;
  onEditableUrlChange: (editableId: string, newUrl: string) => void;
  onCssVarChange: (varName: string, newValue: string) => void;
  onClassSwap: (editableId: string, newClassList: string) => void;
  onBlockStyleChange: (blockId: string, styleKey: string, value: string) => void;
  resolveLiveColor: (varName: string) => string;
}

// ─────────────────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────────────────
function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] bg-indigo-100 text-indigo-600 font-bold px-2 py-0.5 rounded-full leading-none">
      {children}
    </span>
  );
}

function AccordionSection({
  icon,
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  icon: string;
  title: string;
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-3 rounded-2xl border border-indigo-100/70 bg-white overflow-hidden shadow-[0_6px_20px_rgba(99,102,241,0.05)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50/80 via-white to-violet-50/70 hover:from-indigo-100/70 hover:to-violet-100/60 transition-all duration-150"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-sm">{icon}</span>
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-[0.14em] truncate">
            {title}
          </span>
          {badge !== undefined && badge > 0 && <SectionBadge>{badge}</SectionBadge>}
        </div>

        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7c83a3"
          strokeWidth="2.5"
          className={`transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && <div className="px-4 pb-4 pt-3 bg-white space-y-3">{children}</div>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-[0.14em]">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 bg-slate-50/80 transition-all placeholder:text-slate-300"
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 resize-none bg-slate-50/80 transition-all"
    />
  );
}

function LinkField({
  value,
  onChange,
  placeholder = "https://example.com",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2.5">
      <TextInput value={value} onChange={onChange} placeholder={placeholder} />
      {value && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
        >
          Open link
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 17L17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </a>
      )}
    </div>
  );
}

function ImageField({
  value,
  onChange,
  uploadLabel = "Upload from device",
}: {
  value: string;
  onChange: (v: string) => void;
  uploadLabel?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => onChange((ev.target?.result as string) || "");
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2.5">
      {value && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 h-28 flex items-center justify-center overflow-hidden relative group shadow-inner">
          <img
            src={value}
            alt="preview"
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-indigo-950/8 transition-all flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 text-xs text-white font-semibold bg-indigo-900/70 px-2.5 py-1 rounded-lg transition-all">
              Change Image
            </span>
          </div>
        </div>
      )}

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com/image.jpg"
        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50/80 placeholder:text-slate-300"
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-indigo-300 rounded-xl text-xs text-indigo-600 font-semibold hover:bg-indigo-50 hover:border-indigo-400 transition-all duration-150 bg-white"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {uploadLabel}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

function SvgField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const isValid = isValidSvgMarkup(value);

  return (
    <div className="space-y-2.5">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 min-h-[120px] p-4 flex items-center justify-center overflow-hidden">
        {isValid ? (
          <div
            className="max-w-full max-h-[160px] [&>svg]:max-w-full [&>svg]:max-h-[140px] [&>svg]:w-auto [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: value }}
          />
        ) : (
          <p className="text-xs text-slate-400 text-center">
            Paste valid SVG code to preview here
          </p>
        )}
      </div>

      <TextArea value={value} onChange={onChange} rows={10} />

      <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2">
        <p className="text-[11px] text-indigo-700 leading-relaxed">
          Paste full SVG code. Best result comes when SVG uses <span className="font-semibold">fill="currentColor"</span> or <span className="font-semibold">stroke="currentColor"</span>.
        </p>
      </div>

      {!isValid && value.trim() && (
        <p className="text-xs text-amber-600">
          This does not look like valid SVG markup yet.
        </p>
      )}
    </div>
  );
}

function ColorPicker({
  label,
  varName,
  value,
  onChange,
}: {
  label: string;
  varName: string;
  value: string;
  onChange: (varName: string, val: string) => void;
}) {
  const safeValue = value && value.startsWith("#") ? value : "#ffffff";

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/80 border border-slate-200 hover:border-indigo-200 transition-all">
      <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-md shrink-0 cursor-pointer hover:scale-[1.03] transition-transform">
        <input
          type="color"
          value={safeValue}
          onChange={(e) => onChange(varName, e.target.value)}
          className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer opacity-0 z-10"
        />
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
        <p className="text-xs font-semibold text-slate-700 mb-1 capitalize">{label}</p>
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(varName, e.target.value)}
          placeholder="#ffffff"
          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        />
      </div>
    </div>
  );
}

function InlineColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const toHex = (color: string): string => {
    if (!color) return "#ffffff";
    if (color.startsWith("#")) return color;

    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return (
        "#" +
        [match[1], match[2], match[3]]
          .map((n) => parseInt(n, 10).toString(16).padStart(2, "0"))
          .join("")
      );
    }

    return "#ffffff";
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/80 border border-slate-200 hover:border-indigo-200 transition-all">
      <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-md shrink-0 cursor-pointer hover:scale-[1.03] transition-transform">
        <input
          type="color"
          value={toHex(value)}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer opacity-0 z-10"
        />
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
        <p className="text-xs font-semibold text-slate-700 mb-1 capitalize">{label}</p>
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#ffffff"
          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        />
      </div>
    </div>
  );
}

function SelectField({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50/80 appearance-none cursor-pointer pr-8"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#8f96b2"
        strokeWidth="2.5"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

function PaddingSlider({
  label,
  value,
  steps,
  onChange,
}: {
  label: string;
  value: number;
  steps: number[];
  onChange: (v: number) => void;
}) {
  const idx = steps.indexOf(value);
  const pct = ((idx === -1 ? 0 : idx) / (steps.length - 1)) * 100;

  return (
    <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200">
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <span className="text-[11px] font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-500 px-2 py-0.5 rounded-full min-w-8 text-center">
          {value}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={steps.length - 1}
        value={idx === -1 ? 0 : idx}
        onChange={(e) => onChange(steps[parseInt(e.target.value, 10)])}
        className="w-full accent-indigo-500 cursor-pointer"
        style={{ background: `linear-gradient(to right, #6366f1 ${pct}%, #e5e7eb ${pct}%)` }}
      />

      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-300">{steps[0]}</span>
        <span className="text-[10px] text-slate-300">{steps[steps.length - 1]}</span>
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
      <div className="space-y-3">
        <div>
          <FieldLabel>Background Color</FieldLabel>
          <InlineColorPicker
            label="Background"
            value={styles?.bgColor || ""}
            onChange={(v) => onBlockStyleChange(blockId, "backgroundColor", v)}
          />
        </div>
      </div>
    </AccordionSection>
  );
}

function PageSettingsSection({
  pageSettings,
  onPageSettingsChange,
}: {
  pageSettings: PageScripts;
  onPageSettingsChange: (data: Partial<PageScripts>) => void;
}) {
  return (
    <AccordionSection icon="🌐" title="Page Settings" defaultOpen={true}>
      <div className="space-y-3">

        <div>
          <FieldLabel>Page Title</FieldLabel>
          <TextInput
            value={pageSettings.pageTitle || ""}
            onChange={(v) => onPageSettingsChange({ pageTitle: v })}
            placeholder="My Landing Page"
          />
        </div>

        <div>
          <FieldLabel>Meta Description</FieldLabel>
          <TextArea
            value={pageSettings.metaDescription || ""}
            onChange={(v) => onPageSettingsChange({ metaDescription: v })}
            rows={4}
          />
        </div>

        <div>
          <FieldLabel>Favicon</FieldLabel>
          <ImageField
            value={pageSettings.faviconUrl || ""}
            onChange={(v) => onPageSettingsChange({ faviconUrl: v })}
          />
        </div>

        {/* 🔥 ADD THIS */}
        <div>
          <FieldLabel>Head Scripts</FieldLabel>
          <TextArea
            value={pageSettings.headScripts || ""}
            onChange={(v) => onPageSettingsChange({ headScripts: v })}
            rows={6}
          />
        </div>

        <div>
          <FieldLabel>Body Scripts</FieldLabel>
          <TextArea
            value={pageSettings.bodyScripts || ""}
            onChange={(v) => onPageSettingsChange({ bodyScripts: v })}
            rows={6}
          />
        </div>

      </div>
    </AccordionSection>
  );
}

// ─────────────────────────────────────────────────────────────
// EDITABLE CARD
// ─────────────────────────────────────────────────────────────
function EditableCard({
  item,
  onEditableChange,
  onEditableUrlChange,
  onCssVarChange,
  onClassSwap,
  resolveLiveColor,
}: {
  item: EditableItem;
  onEditableChange: (id: string, v: string) => void;
  onEditableUrlChange: (id: string, v: string) => void;
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

  const extraProps = styleProps.filter(
    (p) =>
      !["bg", "text-color", "border-color", "text-align", "font-size", "font-weight"].includes(p)
  );

  const label = prettifyLabel(item.id);
  const currentFontSize = getCurrentClass(item.tailwindClass, FONT_SIZE_OPTIONS);
  const currentFontWeight = getCurrentClass(item.tailwindClass, FONT_WEIGHT_OPTIONS);

  const contentIsSvg = isValidSvgMarkup(item.content);
  const isImage = item.type === "image";
  const isLink = item.type === "link";
  const isSvg = item.type === "svg" || contentIsSvg;
  const isTextLike = item.type === "text" || item.type === "link";
  const hasEditableUrl = typeof item.linkHref === "string";

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3.5 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <span
          className="shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-xs shadow-sm"
          style={{
            background: isImage
              ? "#fef3c7"
              : isLink
                ? "#dbeafe"
                : isSvg
                  ? "#dcfce7"
                  : "#ede9fe",
            color: isImage
              ? "#92400e"
              : isLink
                ? "#1d4ed8"
                : isSvg
                  ? "#166534"
                  : "#5b21b6",
          }}
        >
          {isImage ? "🖼" : isLink ? "🔗" : isSvg ? "⬡" : "T"}
        </span>

        <span className="flex-1 text-xs font-semibold text-slate-700 truncate">{label}</span>

        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9ca3af"
          strokeWidth="2.5"
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-slate-100">
          <div className="pt-2">
            {isImage ? (
              <ImageField value={item.content} onChange={(v) => onEditableChange(item.id, v)} />
            ) : isLink ? (
              <LinkField value={item.content} onChange={(v) => onEditableChange(item.id, v)} />
            ) : isSvg ? (
              <SvgField value={item.content} onChange={(v) => onEditableChange(item.id, v)} />
            ) : item.content.length > 80 ? (
              <TextArea value={item.content} onChange={(v) => onEditableChange(item.id, v)} />
            ) : (
              <TextInput value={item.content} onChange={(v) => onEditableChange(item.id, v)} />
            )}
          </div>

          {hasEditableUrl && (
            <div className="space-y-2.5 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3">
              <FieldLabel>Button / Link URL</FieldLabel>
              <LinkField
                value={item.linkHref || ""}
                onChange={(v) => onEditableUrlChange(item.id, v)}
                placeholder="https://example.com or #section"
              />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                This updates the actual href for this button/link. Button text stays editable above.
              </p>
            </div>
          )}

          {isTextLike && !isSvg && (
            <div className="space-y-2.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.14em]">Typography</p>

              <div>
                <FieldLabel>Font Size</FieldLabel>
                <SelectField
                  value={currentFontSize}
                  options={FONT_SIZE_OPTIONS}
                  placeholder="— inherit —"
                  onChange={(v) => {
                    const newClassList = swapClass(item.tailwindClass, FONT_SIZE_OPTIONS, v);
                    onClassSwap(item.id, newClassList);
                  }}
                />
                {item.tailwindClass
                  .split(" ")
                  .some((c) => c.includes(":") && FONT_SIZE_OPTIONS.includes(stripPrefix(c))) && (
                  <p className="text-xs text-amber-500 mt-1.5">
                    ⚠ Responsive sizes removed when you pick a size
                  </p>
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
                    onClassSwap(item.id, newClassList);
                  }}
                />
              </div>
            </div>
          )}

          {Object.keys(item.colorVars).length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.14em]">
                {isSvg ? "SVG Colors" : "Colors"}
              </p>
              {Object.entries(item.colorVars)
                .filter(([prop]) => prop !== "bg")
                .map(([prop, varName]) => (
                  <ColorPicker
                    key={varName}
                    label={prop === "bg" ? "Background" : prop.replace(/-/g, " ")}
                    varName={varName}
                    value={resolveLiveColor(varName)}
                    onChange={onCssVarChange}
                  />
                ))}
            </div>
          )}

          {extraProps.length > 0 && !isSvg && (
            <div className="space-y-2.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.14em]">Layout</p>

              {styleProps.includes("border-radius") && (
                <div>
                  <FieldLabel>Border Radius</FieldLabel>
                  <SelectField
                    value={getCurrentClass(item.tailwindClass, BORDER_RADIUS_OPTIONS)}
                    options={BORDER_RADIUS_OPTIONS}
                    onChange={(v) =>
                      onClassSwap(item.id, swapClass(item.tailwindClass, BORDER_RADIUS_OPTIONS, v))
                    }
                  />
                </div>
              )}

              {styleProps.includes("shadow") && (
                <div>
                  <FieldLabel>Shadow</FieldLabel>
                  <SelectField
                    value={getCurrentClass(item.tailwindClass, SHADOW_OPTIONS)}
                    options={SHADOW_OPTIONS}
                    onChange={(v) =>
                      onClassSwap(item.id, swapClass(item.tailwindClass, SHADOW_OPTIONS, v))
                    }
                  />
                </div>
              )}

              {styleProps.includes("padding-y") && (
                <PaddingSlider
                  label="Padding Y"
                  value={parseInt((item.tailwindClass.match(/py-(\d+)/) || ["", "0"])[1], 10)}
                  steps={PADDING_Y_STEPS}
                  onChange={(v) =>
                    onClassSwap(item.id, item.tailwindClass.replace(/py-\d+/, "").trim() + ` py-${v}`)
                  }
                />
              )}

              {styleProps.includes("padding-x") && (
                <PaddingSlider
                  label="Padding X"
                  value={parseInt((item.tailwindClass.match(/px-(\d+)/) || ["", "0"])[1], 10)}
                  steps={PADDING_X_STEPS}
                  onChange={(v) =>
                    onClassSwap(item.id, item.tailwindClass.replace(/px-\d+/, "").trim() + ` px-${v}`)
                  }
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
      <div className="space-y-2.5">
        {entries.map(([prop, varName]) => (
          <ColorPicker
            key={varName}
            label={prop === "bg" ? "Background" : prop.replace(/-/g, " ")}
            varName={varName}
            value={resolveLiveColor(varName)}
            onChange={onCssVarChange}
          />
        ))}
      </div>
    </AccordionSection>
  );
}

function EmptyState() {
  return (
    <div className="w-80 bg-gradient-to-b from-white to-slate-50 border-l border-indigo-100 flex flex-col h-full">
      <div className="px-5 py-4 border-b border-indigo-100 bg-white/90">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83 M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 text-sm">Properties</h2>
            <p className="text-xs text-slate-400 mt-0.5">Section editor</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-7 text-center gap-5">
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center border border-indigo-100 shadow-sm">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#8b95ff" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M3 9h18M9 21V9" />
            </svg>
          </div>

          <div className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center shadow-md">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-700">Select a Section</p>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Click any section in the canvas preview to edit its content, styles, colors, and page settings.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-sm">
          <span>👆</span>
          <span>Choose a section from the canvas</span>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-indigo-100 bg-white/80">
        <p className="text-xs text-slate-400 text-center">Changes apply instantly to preview</p>
      </div>
    </div>
  );
}

// 🔥 ADD THIS NEW COMPONENT (PUT ABOVE MAIN EXPORT)

function MarqueeControlSection({ selectedBlock }: { selectedBlock: ParsedBlock | null }) {
  const currentTemplate = useEditorStore((state) => state.currentTemplate);
  const updateRawCss = useEditorStore((state) => (state as any).updateRawCss);

  const rawCss = String((currentTemplate as any)?.rawCss || "");

  // ❌ if no block selected → hide
  if (!selectedBlock) return null;

  // ❌ if selected block is NOT marquee → hide
  const blockHtml = (selectedBlock.rawHtml || "").toLowerCase();
  const isMarqueeBlock =
    blockHtml.includes("marquee") ||
    blockHtml.includes("marquee-track") ||
    blockHtml.includes("marquee-wrapper");

  if (!isMarqueeBlock) return null;

  // ❌ if no css → hide
  if (!hasMarqueeCss(rawCss) || typeof updateRawCss !== "function") return null;

  const speed = extractMarqueeSpeed(rawCss);
  const marqueeCssPreview = extractMarqueeCssPreview(rawCss);

  return (
    <AccordionSection icon="🎞️" title="Marquee Animation" defaultOpen={true}>
      <div className="space-y-4">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
          <p className="text-[11px] text-indigo-700">
            Edit marquee animation for this section
          </p>
        </div>

        <div>
          <FieldLabel>Animation Speed: {speed}s</FieldLabel>
          <input
            type="range"
            min={5}
            max={80}
            value={speed}
            onChange={(e) => {
              const nextSpeed = Number(e.target.value);
              const updatedCss = updateMarqueeSpeed(rawCss, nextSpeed);
              updateRawCss(updatedCss);
            }}
            className="w-full"
          />
        </div>

        <TextArea value={marqueeCssPreview} onChange={() => {}} rows={8} />
      </div>
    </AccordionSection>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function PropertiesPanel({
  selectedBlock,
  template,
  pageSettings,
  onPageSettingsChange,
  onEditableChange,
  onEditableUrlChange,
  onCssVarChange,
  onClassSwap,
  onBlockStyleChange,
  resolveLiveColor,
}: Props) {
  if (!template) return null;

  // ✅ SAFE ACCESS (NO CRASH)
  const blockId = selectedBlock?.blockId || "";
  const blockName = selectedBlock?.blockName || "No Section Selected";
  const editables = selectedBlock?.editables || [];
  const colorVars = selectedBlock?.colorVars || {};
  const styles = selectedBlock?.styles || {};

  const textEditables = editables.filter(
    (e) => e.type === "text" && !isValidSvgMarkup(e.content)
  );

  const imageEditables = editables.filter((e) => e.type === "image");
  const linkEditables = editables.filter((e) => e.type === "link");

  const svgEditables = editables.filter(
    (e) => e.type === "svg" || (e.type === "text" && isValidSvgMarkup(e.content))
  );

  return (
    <div className="w-80 bg-gradient-to-b from-white to-slate-50 border-l border-indigo-100 flex flex-col h-full overflow-hidden">

      {/* HEADER */}
      <div className="px-5 py-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-600 to-violet-600 shrink-0 shadow-sm">
        <h2 className="text-white text-sm font-semibold">
          {selectedBlock ? blockName : "Page Settings"}
        </h2>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">

        {/* ✅ ALWAYS VISIBLE */}
     <PageSettingsSection
  pageSettings={pageSettings}
  onPageSettingsChange={onPageSettingsChange}
/>

<MarqueeControlSection selectedBlock={selectedBlock} />
        {/* ✅ ONLY IF BLOCK SELECTED */}
        {selectedBlock ? (
          <>
            <BlockStylesSection
              blockId={blockId}
              styles={{ bgColor: styles?.bgColor }}
              onBlockStyleChange={onBlockStyleChange}
            />

            <BlockColorVars
              colorVars={colorVars}
              onCssVarChange={onCssVarChange}
              resolveLiveColor={resolveLiveColor}
            />

            {textEditables.length > 0 && (
              <AccordionSection icon="✏️" title="Text Content">
                {textEditables.map((item) => (
                  <EditableCard
                    key={item.id}
                    item={item}
                    onEditableChange={onEditableChange}
                    onEditableUrlChange={onEditableUrlChange}
                    onCssVarChange={onCssVarChange}
                    onClassSwap={onClassSwap}
                    resolveLiveColor={resolveLiveColor}
                  />
                ))}
              </AccordionSection>
            )}

            {imageEditables.length > 0 && (
              <AccordionSection icon="🖼️" title="Images">
                {imageEditables.map((item) => (
                  <EditableCard
                    key={item.id}
                    item={item}
                    onEditableChange={onEditableChange}
                    onEditableUrlChange={onEditableUrlChange}
                    onCssVarChange={onCssVarChange}
                    onClassSwap={onClassSwap}
                    resolveLiveColor={resolveLiveColor}
                  />
                ))}
              </AccordionSection>
            )}

            {svgEditables.length > 0 && (
              <AccordionSection icon="⬡" title="SVG Content">
                {svgEditables.map((item) => (
                  <EditableCard
                    key={item.id}
                    item={item}
                    onEditableChange={onEditableChange}
                    onEditableUrlChange={onEditableUrlChange}
                    onCssVarChange={onCssVarChange}
                    onClassSwap={onClassSwap}
                    resolveLiveColor={resolveLiveColor}
                  />
                ))}
              </AccordionSection>
            )}
          </>
        ) : (
          <div className="text-center py-10 text-gray-400 text-sm">
            Select a section to edit content
          </div>
        )}
      </div>
    </div>
  );
}