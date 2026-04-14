"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { HistoryItem } from "@/app/api/history/route";

// ── Helpers ────────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  linkedin_post:    "LinkedIn",
  x_post:           "X Post",
  instagram:        "Instagram",
  cold_email:       "Cold Email",
  email_sequence:   "Email Seq.",
  blog_intro:       "Blog Intro",
  facebook_post:    "Facebook",
  whatsapp_message: "WhatsApp",
  snapchat:         "Snapchat",
  blog_post:        "SEO Post",
};

const TYPE_COLORS: Record<string, string> = {
  generation: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  repurpose:  "bg-blue-400/15 text-blue-400 border-blue-400/30",
  seo:        "bg-green-400/15 text-green-400 border-green-400/30",
};

const TYPE_LABELS: Record<string, string> = {
  generation: "Generated",
  repurpose:  "Repurposed",
  seo:        "SEO",
};

function scoreColor(score: number) {
  if (score >= 70) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Component ──────────────────────────────────────────────────────────────

type FilterType = "all" | "generation" | "repurpose" | "seo";

export default function HistoryPage() {
  const [items, setItems]         = useState<HistoryItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId]   = useState<string | null>(null);
  const [noKey, setNoKey]         = useState(false);

  async function fetchHistory(type: FilterType) {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/history?type=${type}&limit=50`);
      const data = await res.json();

      if (data.error?.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        setNoKey(true);
        setItems([]);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to load history");
      setItems(data.items ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory(filterType);
  }, [filterType]);

  function copy(item: HistoryItem) {
    navigator.clipboard.writeText(item.content);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const TABS: { id: FilterType; label: string }[] = [
    { id: "all",        label: "All" },
    { id: "generation", label: "Content Engine" },
    { id: "repurpose",  label: "Repurposed" },
    { id: "seo",        label: "SEO Posts" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-yellow-400 font-black text-xl tracking-tight">PRICEIT</span>
          <span className="text-zinc-500 text-sm">/ Content History</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/generate"   className="text-zinc-400 text-sm hover:text-white transition-colors">Content Engine →</Link>
          <Link href="/seo"        className="text-zinc-400 text-sm hover:text-white transition-colors">SEO Engine →</Link>
          <Link href="/conversion" className="text-zinc-400 text-sm hover:text-white transition-colors">Conversion →</Link>
          <Link href="/"           className="text-zinc-400 text-sm hover:text-white transition-colors">← Back</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black mb-2">Content History</h1>
            <p className="text-zinc-400">All generated content — your AI training dataset.</p>
          </div>
          <button
            onClick={() => fetchHistory(filterType)}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500 transition-all"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Service role key missing */}
        {noKey && (
          <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-6 mb-8">
            <div className="font-semibold text-yellow-400 mb-2">One setup step needed</div>
            <p className="text-sm text-zinc-400 mb-3">
              Reading history requires the Supabase service role key (RLS blocks anonymous reads by design).
            </p>
            <ol className="text-sm text-zinc-300 space-y-1 list-decimal list-inside">
              <li>Go to <span className="text-yellow-400">Supabase dashboard → Settings → API</span></li>
              <li>Copy the <span className="font-mono text-yellow-400">service_role</span> secret key</li>
              <li>Add to <span className="font-mono text-zinc-300">.env.local</span>: <span className="font-mono text-yellow-400">SUPABASE_SERVICE_ROLE_KEY=your_key_here</span></li>
              <li>Also add it to <span className="text-yellow-400">Vercel → Environment Variables</span></li>
              <li>Restart the dev server</li>
            </ol>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                filterType === tab.id
                  ? "bg-yellow-400 text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* States */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
            <svg className="animate-spin h-8 w-8 text-yellow-400 mb-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div className="text-sm animate-pulse">Loading history…</div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        {!loading && !error && !noKey && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-sm">No content generated yet — go make something.</div>
            <Link href="/generate" className="mt-4 text-yellow-400 text-sm hover:underline">
              Open Content Engine →
            </Link>
          </div>
        )}

        {/* Items */}
        {!loading && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => {
              const isExpanded = expandedId === item.id;
              const preview    = item.content.slice(0, 140).replace(/\n/g, " ").trim();
              const hasMore    = item.content.length > 140;
              const formatLabel = FORMAT_LABELS[item.format] ?? item.format;

              return (
                <div
                  key={item.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors"
                >
                  {/* Row header */}
                  <div className="flex items-start gap-3 px-4 py-3">
                    {/* Type badge */}
                    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium mt-0.5 ${TYPE_COLORS[item.type]}`}>
                      {TYPE_LABELS[item.type]}
                    </span>

                    {/* Format + preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold text-white">{formatLabel}</span>
                        <span className="text-xs text-zinc-600">·</span>
                        <span className="text-xs text-zinc-500 capitalize">{item.voice}</span>
                        <span className="text-xs text-zinc-600">·</span>
                        <span className="text-xs text-zinc-500">{item.segment === "large_firm" ? "Large Firm" : "Small Contractor"}</span>
                        {item.topic && (
                          <>
                            <span className="text-xs text-zinc-600">·</span>
                            <span className="text-xs text-zinc-500 italic truncate max-w-[200px]">{item.topic}</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {isExpanded ? item.content : preview}
                        {!isExpanded && hasMore && <span className="text-zinc-600">…</span>}
                      </p>
                    </div>

                    {/* Right: score + meta + actions */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                      <span className={`text-xs font-bold ${scoreColor(item.score)}`}>
                        {item.score}
                      </span>
                      <span className="text-xs text-zinc-600">{timeAgo(item.created_at)}</span>
                      {item.word_count && (
                        <span className="text-xs text-zinc-700">{item.word_count}w</span>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
                        >
                          {isExpanded ? "Collapse" : "Expand"}
                        </button>
                        <button
                          onClick={() => copy(item)}
                          className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
                        >
                          {copiedId === item.id ? "✓" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded full content */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800 px-4 py-4 bg-zinc-950">
                      <pre className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">
                        {item.content}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}

            <p className="text-center text-xs text-zinc-700 pt-4">
              Showing last {items.length} items · Training data only — not published content
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
