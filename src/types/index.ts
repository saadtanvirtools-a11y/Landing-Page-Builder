// ── User ──────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
  assignedTemplateId: string | null;
  assignedTemplateName: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PageScripts {
  gtmId: string;
  headScripts: string;
  bodyScripts: string;

  // SEO / page settings
  pageTitle: string;
  faviconUrl: string;
  metaDescription: string;
  googleAnalyticsId: string;
}

export interface BlockVariant {
  blockType: string;
  variantId: number;
  label: string;
  description?: string;
  defaultContent: Record<string, any>;
  defaultStyles: Record<string, any>;
}

export interface BlockInstance {
  instanceId: string;
  blockType: string;
  variantId: number;
  order: number;
  content: Record<string, any>;
  styles: Record<string, any>;
}

export interface BlockProps {
  block: BlockInstance;
  isSelected: boolean;
  onSelect: () => void;
}

export interface EditorState {
  canvasBlocks: BlockInstance[];
  pageScripts: PageScripts;
  lastSaved: string | null;
}

export interface CSSVariables {
  [varName: string]: string;
}

export type EditableType = "text" | "image" | "link" | "svg";

export interface EditableItem {
  id: string;
  type: EditableType;
  content: string;
  colorVars: Record<string, string>;
  tailwindClass: string;
  styleProps: string;
  styleId: string;
  styleChildSelector?: string;
}

export interface ParsedBlock {
  blockId: string;
  blockName: string;
  blockOrder: number;
  removable: boolean;
  colorVars: Record<string, string>;
  editables: EditableItem[];
  rawHtml: string;
  sourceTemplateId: string;
  sourceTemplateName: string;
  styles?: Record<string, string>;
}

export interface Template {
  id: string;
  templateName: string;
  category: string;
  createdAt: string;
  cssVariables: CSSVariables;
  blocks: ParsedBlock[];
  rawHtml: string;
  lastSaved?: string | null;
  pageScripts: PageScripts;
  rawCss?: string;
  rawJs?: string;
}

export interface Assignment {
  userId: string;
  templateId: string;
}

export interface UserEditorSave {
  userId: string;
  templateId: string;
  cssVariables: CSSVariables;
  editables: Record<string, string>;
  editedHtml: string;
  savedAt: string;
}

// ── User Project (saved edited version per user/template) ───────────────
export interface UserProject {
  id: string;
  userId: string;
  templateId: string;
  templateName: string;
  currentTemplate: Template;
  canvasBlocks: BlockInstance[];
  pageScripts: PageScripts;
  savedAtIso?: string;
  updatedAt?: any;
}

// ── Block Tier ────────────────────────────────────────
// "free"    = all users can use
// "premium" = locked for everyone
// "custom"  = only users in allowedUserIds can use
export type BlockTier = "free" | "premium" | "custom";

// ── Standalone Block ──────────────────────────────────
export interface StandaloneBlock {
  id: string;
  blockName: string;
  blockType: string;
  tier: BlockTier;
  // ✅ When tier === "custom" → only these user IDs can access
  // When tier === "free"    → everyone (array ignored)
  // When tier === "premium" → nobody   (array ignored)
  allowedUserIds: string[];
  cssVariables: CSSVariables;
  editables: EditableItem[];
  rawHtml: string;
  createdAt: string;
}