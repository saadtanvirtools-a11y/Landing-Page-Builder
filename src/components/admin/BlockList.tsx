import { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, MoreVertical, Blocks, Crown, Gift, Search, RefreshCw, AlertTriangle, Users } from "lucide-react";
import type { StandaloneBlock, BlockTier, User } from "../../types";

const BLOCK_META: Record<string, { label: string; icon: string }> = {
  hero: { label: "Hero", icon: "🦸" }, features: { label: "Features", icon: "⚡" },
  benefits: { label: "Benefits", icon: "✅" }, faq: { label: "FAQ", icon: "❓" },
  testimonials: { label: "Testimonials", icon: "💬" }, cta: { label: "CTA", icon: "🎯" },
  "cta-banner": { label: "CTA Banner", icon: "🎯" }, footer: { label: "Footer", icon: "🔗" },
  navbar: { label: "Navbar", icon: "🔝" }, pricing: { label: "Pricing", icon: "💰" },
  contact: { label: "Contact", icon: "📬" }, "how-it-works": { label: "How It Works", icon: "🔄" },
  other: { label: "Other", icon: "📦" },
};

// ✅ FIXED: reads from "mock_users" (same key your auth.ts uses)
function loadUsers(): User[] {
  try {
    return JSON.parse(localStorage.getItem("mock_users") || "[]")
      .filter((u: any) => u.role !== "admin")
      .map(({ password, ...u }: any) => u);
  } catch { return []; }
}

function TierBadge({ tier }: { tier: BlockTier }) {
  if (tier === "premium") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">
      <Crown size={10} /> Premium
    </span>
  );
  if (tier === "custom") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
      <Users size={10} /> Custom
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
      <Gift size={10} /> Free
    </span>
  );
}

function BlockPreview({ block }: { block: StandaloneBlock }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const [scale, setScale]                 = useState(0.25);
  const [contentHeight, setContentHeight] = useState(300);
  const [loaded, setLoaded]               = useState(false);

  const cssVarBlock = Object.entries(block.cssVariables).map(([k, v]) => `  ${k}: ${v};`).join("\n");
  const srcDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>*,*::before,*::after{box-sizing:border-box;}html,body{margin:0;padding:0;overflow:hidden;width:1280px;min-width:1280px;}:root{${cssVarBlock}}</style>
<script src="https://cdn.tailwindcss.com"><\/script></head>
<body style="width:1280px;min-width:1280px;margin:0;padding:0;">${block.rawHtml}</body></html>`;

  const computeScale = useCallback(() => {
    if (wrapperRef.current) { const w = wrapperRef.current.getBoundingClientRect().width; if (w > 0) setScale(w / 1280); }
  }, []);

  useEffect(() => {
    computeScale();
    const ro = new ResizeObserver(computeScale);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [computeScale]);

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const measure = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) { setLoaded(true); return; }
        const h = Math.max(doc.body.scrollHeight, doc.body.offsetHeight, doc.documentElement.scrollHeight);
        if (h > 10) { setContentHeight(h); setLoaded(true); }
      } catch { setLoaded(true); }
    };
    const t1 = setTimeout(measure, 300); const t2 = setTimeout(measure, 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div ref={wrapperRef} className="w-full rounded-lg overflow-hidden relative bg-gray-100"
      style={{ height: Math.round(contentHeight * scale) || 60, opacity: loaded ? 1 : 0, transition: "opacity 0.3s" }}>
      <iframe ref={iframeRef} srcDoc={srcDoc} title="block-preview" scrolling="no" onLoad={handleLoad}
        className="absolute top-0 left-0 border-0"
        style={{ width: "1280px", height: `${contentHeight}px`, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}
        sandbox="allow-scripts allow-same-origin" />
      {!loaded && <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse rounded-lg" />}
    </div>
  );
}

function DeleteModal({ block, onConfirm, onCancel }: { block: StandaloneBlock; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Delete Block?</p>
            <p className="text-xs text-gray-400 mt-0.5">This cannot be undone</p>
          </div>
        </div>
        <div className="px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-sm font-semibold text-gray-700">{block.blockName}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition shadow-sm">Delete</button>
        </div>
      </div>
    </div>
  );
}

function AccessModal({
  block, allUsers, onSave, onClose,
}: {
  block: StandaloneBlock; allUsers: User[];
  onSave: (id: string, tier: BlockTier, allowedUserIds: string[]) => void;
  onClose: () => void;
}) {
  const [tier,           setTier]           = useState<BlockTier>(block.tier);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>(block.allowedUserIds ?? []);

  function toggleUser(userId: string) {
    setAllowedUserIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
  }

  const tierOptions: { value: BlockTier; emoji: string; label: string; desc: string }[] = [
    { value: "free",    emoji: "🆓", label: "Free",    desc: "All users" },
    { value: "premium", emoji: "🔒", label: "Premium", desc: "Locked"    },
    { value: "custom",  emoji: "👤", label: "Custom",  desc: "Pick users" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md p-6 space-y-5">
        <div>
          <p className="text-base font-bold text-gray-800">🔐 Manage Access</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{block.blockName}</p>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Access Tier</p>
          <div className="grid grid-cols-3 gap-2">
            {tierOptions.map((t) => (
              <button key={t.value} type="button" onClick={() => setTier(t.value)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 transition-all text-xs font-semibold
                  ${tier === t.value
                    ? t.value === "free"    ? "border-green-400 bg-green-50 text-green-700"
                    : t.value === "premium" ? "border-yellow-400 bg-yellow-50 text-yellow-700"
                    :                         "border-indigo-400 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}>
                <span className="text-xl">{t.emoji}</span>
                <span>{t.label}</span>
                <span className="text-gray-400 font-normal">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {tier === "custom" && (
          <div className="border border-indigo-100 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
              <p className="text-xs font-bold text-indigo-700">Select Allowed Users</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAllowedUserIds(allUsers.map((u) => u.id))}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold">All</button>
                <span className="text-indigo-200">|</span>
                <button type="button" onClick={() => setAllowedUserIds([])}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold">None</button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
              {allUsers.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-gray-400">No users found</p>
                </div>
              ) : allUsers.map((user) => {
                const checked = allowedUserIds.includes(user.id);
                return (
                  <label key={user.id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${checked ? "bg-indigo-50" : "bg-white hover:bg-gray-50"}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleUser(user.id)}
                      className="w-4 h-4 rounded accent-indigo-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{user.name}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    {checked && <span className="text-xs text-indigo-500 font-bold shrink-0">✓</span>}
                  </label>
                );
              })}
            </div>
            {allowedUserIds.length > 0 && (
              <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-100">
                <p className="text-xs text-indigo-600 font-medium">
                  {allowedUserIds.length} user{allowedUserIds.length !== 1 ? "s" : ""} selected
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={() => onSave(block.id, tier, tier === "custom" ? allowedUserIds : [])}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition shadow-sm">
            Save Access
          </button>
        </div>
      </div>
    </div>
  );
}

function BlockCard({
  block, allUsers, onDelete, onUpdateAccess,
}: {
  block: StandaloneBlock; allUsers: User[];
  onDelete: (id: string) => void;
  onUpdateAccess: (id: string, tier: BlockTier, allowedUserIds: string[]) => void;
}) {
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [showPreview,     setShowPreview]     = useState(false);
  const [confirmDelete,   setConfirmDelete]   = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const meta = BLOCK_META[block.blockType] ?? { label: block.blockType, icon: "📦" };

  const allowedNames = (block.allowedUserIds ?? [])
    .map((id) => allUsers.find((u) => u.id === id)?.name ?? id)
    .slice(0, 3);

  return (
    <>
      {confirmDelete && (
        <DeleteModal block={block}
          onConfirm={() => { onDelete(block.id); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)} />
      )}
      {showAccessModal && (
        <AccessModal block={block} allUsers={allUsers}
          onSave={(id, tier, allowedUserIds) => { onUpdateAccess(id, tier, allowedUserIds); setShowAccessModal(false); }}
          onClose={() => setShowAccessModal(false)} />
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">{meta.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">{block.blockName}</p>
              <p className="text-xs text-gray-400 mt-0.5">{meta.label}</p>
            </div>
          </div>
          <div className="relative shrink-0">
            <button onClick={() => setMenuOpen((o) => !o)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400">
              <MoreVertical size={15} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 bg-white rounded-xl border border-gray-100 shadow-xl z-20 min-w-44 overflow-hidden">
                <button onClick={() => { setShowAccessModal(true); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-indigo-600 hover:bg-indigo-50 transition font-semibold">
                  🔐 Manage Access
                </button>
                <button onClick={() => { setConfirmDelete(true); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-500 hover:bg-red-50 transition">
                  <Trash2 size={12} /> Delete Block
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
          <TierBadge tier={block.tier} />
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">{block.editables.length} editables</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">{Object.keys(block.cssVariables).length} CSS vars</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">{block.createdAt}</span>
        </div>

        {block.tier === "custom" && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-gray-400 font-medium">Allowed:</span>
              {(block.allowedUserIds ?? []).length === 0 ? (
                <span className="text-xs text-red-400 font-medium">⚠ No users selected</span>
              ) : (
                <>
                  {allowedNames.map((name, i) => (
                    <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium border border-indigo-100">{name}</span>
                  ))}
                  {(block.allowedUserIds ?? []).length > 3 && (
                    <span className="text-xs text-gray-400">+{(block.allowedUserIds ?? []).length - 3} more</span>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="px-4 pb-4">
          <button onClick={() => setShowPreview((p) => !p)}
            className="w-full py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:border-indigo-200 hover:text-indigo-600 transition flex items-center justify-center gap-1.5">
            {showPreview ? "▲ Hide Preview" : "▼ Show Preview"}
          </button>
          {showPreview && (
            <div className="mt-3 rounded-xl overflow-hidden border border-gray-100">
              <BlockPreview block={block} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface Props { refresh: number; }

export default function BlockList({ refresh }: Props) {
  const [blocks,     setBlocks]     = useState<StandaloneBlock[]>([]);
  const [allUsers,   setAllUsers]   = useState<User[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState("");
  const [filterTier, setFilterTier] = useState<"all" | BlockTier>("all");
  const [filterType, setFilterType] = useState("all");

  function loadBlocks() {
    setLoading(true);
    setTimeout(() => {
      try { setBlocks(JSON.parse(localStorage.getItem("lp_blocks") || "[]")); }
      catch { setBlocks([]); }
      setAllUsers(loadUsers());   // ✅ now reads mock_users correctly
      setLoading(false);
    }, 300);
  }

  useEffect(() => { loadBlocks(); }, [refresh]);

  function handleDelete(id: string) {
    const updated = blocks.filter((b) => b.id !== id);
    setBlocks(updated);
    localStorage.setItem("lp_blocks", JSON.stringify(updated));
  }

  function handleUpdateAccess(id: string, tier: BlockTier, allowedUserIds: string[]) {
    const updated = blocks.map((b) => b.id === id ? { ...b, tier, allowedUserIds } : b);
    setBlocks(updated);
    localStorage.setItem("lp_blocks", JSON.stringify(updated));
  }

  const filtered = blocks.filter((b) => {
    const q           = search.toLowerCase();
    const matchSearch = !q || b.blockName.toLowerCase().includes(q) || b.blockType.toLowerCase().includes(q);
    const matchTier   = filterTier === "all" || b.tier === filterTier;
    const matchType   = filterType === "all" || b.blockType === filterType;
    return matchSearch && matchTier && matchType;
  });

  const blockTypes   = [...new Set(blocks.map((b) => b.blockType))];
  const freeCount    = blocks.filter((b) => b.tier === "free").length;
  const premiumCount = blocks.filter((b) => b.tier === "premium").length;
  const customCount  = blocks.filter((b) => b.tier === "custom").length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm">Loading blocks...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total",      value: blocks.length,  color: "text-indigo-600", bg: "bg-indigo-50",  border: "border-indigo-100" },
          { label: "Free",       value: freeCount,      color: "text-green-600",  bg: "bg-green-50",   border: "border-green-100"  },
          { label: "Premium 🔒", value: premiumCount,   color: "text-yellow-600", bg: "bg-yellow-50",  border: "border-yellow-100" },
          { label: "Custom 👤",  value: customCount,    color: "text-indigo-600", bg: "bg-indigo-50",  border: "border-indigo-100" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input type="text" placeholder="Search blocks..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" />
        </div>
        <select value={filterTier} onChange={(e) => setFilterTier(e.target.value as "all" | BlockTier)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200">
          <option value="all">All Tiers</option>
          <option value="free">🆓 Free</option>
          <option value="premium">🔒 Premium</option>
          <option value="custom">👤 Custom</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200">
          <option value="all">All Types</option>
          {blockTypes.map((t) => <option key={t} value={t}>{BLOCK_META[t]?.icon ?? "📦"} {BLOCK_META[t]?.label ?? t}</option>)}
        </select>
        <button onClick={loadBlocks} className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-indigo-600 transition" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-300 bg-white rounded-2xl border border-gray-100">
          <Blocks size={52} className="mb-3 opacity-40" />
          <p className="text-sm font-semibold">No blocks uploaded yet</p>
          <p className="text-xs mt-1">Use the Upload tab to add your first block</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300 bg-white rounded-2xl border border-gray-100">
          <Search size={40} className="mb-3 opacity-40" />
          <p className="text-sm font-semibold">No blocks match your filters</p>
          <button onClick={() => { setSearch(""); setFilterTier("all"); setFilterType("all"); }}
            className="mt-3 text-xs text-indigo-500 hover:text-indigo-700 font-semibold">Clear filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((block) => (
            <BlockCard key={block.id} block={block} allUsers={allUsers} onDelete={handleDelete} onUpdateAccess={handleUpdateAccess} />
          ))}
        </div>
      )}
      {filtered.length > 0 && filtered.length !== blocks.length && (
        <p className="text-xs text-gray-400 text-center">Showing {filtered.length} of {blocks.length} blocks</p>
      )}
    </div>
  );
}