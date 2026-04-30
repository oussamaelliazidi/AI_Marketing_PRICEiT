"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { VOICES, VoiceType } from "@/lib/voices";
import type { MinedQuote } from "@/app/api/quotes/route";

// ── Types ──────────────────────────────────────────────────────────────────

type Segment = "small_contractor" | "large_firm";
type Format =
  | "linkedin_post"
  | "cold_email"
  | "blog_intro"
  | "instagram"
  | "x_post"
  | "email_sequence"
  | "facebook_post"
  | "whatsapp_message"
  | "snapchat";

interface Tab {
  format: Format;
  label: string;
  icon: string;
  content: string;
  score: number | null;
}

interface FormatOption {
  id: Format;
  label: string;
  icon: string;
  description: string;
}

interface SegmentOption {
  id: Segment;
  label: string;
  sub: string;
}

// ── Config ─────────────────────────────────────────────────────────────────

const FORMATS: FormatOption[] = [
  { id: "linkedin_post",    label: "LinkedIn",      icon: "💼", description: "150–300 words, hook → body → CTA" },
  { id: "cold_email",       label: "Cold Email",    icon: "📧", description: "Subject + 3–5 sentences + single ask" },
  { id: "email_sequence",   label: "3 Emails",      icon: "📬", description: "Day 0, 3, 7 outreach campaign" },
  { id: "blog_intro",       label: "Blog Intro",    icon: "📝", description: "H1 + intro + first subhead + body" },
  { id: "instagram",        label: "Instagram",     icon: "📸", description: "Hook + story + hashtags" },
  { id: "x_post",           label: "X / Twitter",   icon: "𝕏", description: "Under 280 chars, one idea" },
  { id: "facebook_post",    label: "Facebook",      icon: "📘", description: "100–200 words, conversational" },
  { id: "whatsapp_message", label: "WhatsApp",      icon: "💬", description: "Under 100 words, text-like tone" },
  { id: "snapchat",         label: "Snapchat",      icon: "👻", description: "Caption + 2-line context blurb" },
];

const ALL_FORMAT_META: Record<Format, { label: string; icon: string }> = {
  linkedin_post:    { label: "LinkedIn",   icon: "💼" },
  cold_email:       { label: "Cold Email", icon: "📧" },
  email_sequence:   { label: "3 Emails",   icon: "📬" },
  blog_intro:       { label: "Blog",       icon: "📝" },
  instagram:        { label: "Instagram",  icon: "📸" },
  x_post:           { label: "X Post",     icon: "𝕏" },
  facebook_post:    { label: "Facebook",   icon: "📘" },
  whatsapp_message: { label: "WhatsApp",   icon: "💬" },
  snapchat:         { label: "Snapchat",   icon: "👻" },
};

const REPURPOSE_ORDER: Format[] = [
  "linkedin_post", "x_post", "instagram", "facebook_post",
  "cold_email", "email_sequence", "whatsapp_message", "blog_intro", "snapchat",
];

// Character limits for tight formats (Feature 2)
const CHAR_LIMITS: Partial<Record<Format, { max: number; warn: number }>> = {
  x_post:           { max: 280, warn: 240 },
  snapchat:         { max: 150, warn: 100 },
  whatsapp_message: { max: 500, warn: 400 },
};

const SEGMENTS: SegmentOption[] = [
  { id: "small_contractor", label: "Small Contractor", sub: "1–20 people, owner-operators" },
  { id: "large_firm",       label: "Large Firm",       sub: "50+ employees, estimating teams" },
];

const TOPIC_SUGGESTIONS: Record<Segment, string[]> = {
  small_contractor: [
    "The 3 pricing mistakes costing you thousands every month",
    "How to price any job in 2 minutes — no spreadsheet",
    "Why you're losing money on jobs you priced correctly",
    "The real cost of a $35/hr tradesperson (it's closer to $55)",
    "From gut-feel quotes to winning on math",
    "Stop under-bidding — use this formula before every quote",
  ],
  large_firm: [
    "Cutting 3-day estimates to same-day turnaround",
    "Audit trail on every pricing decision",
    "Estimating team bottleneck killing your bid volume",
    "Margin misses on commercial fit-outs — what's going wrong",
    "60% less estimating time, same accuracy",
    "Professional proposals that win against international competitors",
  ],
};

// YouTube competitive analysis — top performing angles (125 videos analysed)
const YOUTUBE_TOPICS: Record<Segment, string[]> = {
  small_contractor: [
    "NEVER price a construction job without checking this first",
    "The 30-second rule before sending any quote",
    "3 numbers every contractor must know before quoting",
    "One spreadsheet formula that can ruin your business",
    "Why your competitor always beats you on price",
    "How to add overhead to a quote (most contractors skip this)",
    "The difference between turnover and profit",
    "Watch me build a $40,000 quote in under 2 minutes",
  ],
  large_firm: [
    "What Procore costs vs what PRICEIT costs — honest comparison",
    "AI-powered pricing walkthrough for construction firms",
    "How winning GCC contractors price faster and win more bids",
    "Villa fit-out pricing in Dubai — step by step",
    "UAE contractors: stop pricing fit-out like structural work",
    "How to build payment delay buffer into your GCC quotes",
    "Professional proposals that win in the Dubai/Abu Dhabi market",
    "VAT in construction quotes — UAE 5% vs Saudi 15%",
  ],
};

// ── Component ──────────────────────────────────────────────────────────────

export default function GeneratePage() {
  // Controls
  const [segment, setSegment]             = useState<Segment>("small_contractor");
  const [format, setFormat]               = useState<Format>("linkedin_post");
  const [voice, setVoice]                 = useState<VoiceType>("street");
  const [repurposeVoice, setRepurposeVoice] = useState<VoiceType>("street"); // Feature 4
  const [topic, setTopic]                 = useState("");

  // Output tabs (Feature 1)
  const [tabs, setTabs]                   = useState<Tab[]>([]);
  const [activeTabFormat, setActiveTabFormat] = useState<Format | null>(null);

  // Loading states
  const [isGenerating, setIsGenerating]   = useState(false);
  const [loadingFormats, setLoadingFormats] = useState<Set<Format>>(new Set());
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  // UI
  const [error, setError]   = useState("");
  const [copied, setCopied] = useState(false);

  // Phase 4 — Industry quotes
  const [industryQuotes, setIndustryQuotes] = useState<MinedQuote[]>([]);
  const [quotesLoading, setQuotesLoading]   = useState(false);
  const [quotesError, setQuotesError]       = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);

  // ── Derived ──
  const activeTab    = tabs.find((t) => t.format === activeTabFormat) ?? null;
  const output       = activeTab?.content ?? "";
  const qualityScore = activeTab?.score   ?? null;
  const selectedFormat = FORMATS.find((f) => f.id === format)!;
  const charLimit    = activeTabFormat ? CHAR_LIMITS[activeTabFormat] : null;
  const charCount    = output.length;
  const charColor    = charLimit
    ? charCount > charLimit.max  ? "text-red-400 font-semibold"
    : charCount > charLimit.warn ? "text-yellow-400"
    : "text-zinc-600"
    : "text-zinc-600";

  // ── Helpers ──

  function upsertTab(fmt: Format, content: string, score: number | null) {
    const meta = ALL_FORMAT_META[fmt];
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.format === fmt);
      const tab: Tab = { format: fmt, label: meta.label, icon: meta.icon, content, score };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = tab;
        return next;
      }
      return [...prev, tab];
    });
    setActiveTabFormat(fmt);
  }

  function copyToClipboard() {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadDocx() {
    if (!output) return;
    const res = await fetch("/api/export/docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: output, format, voice, segment, topic: topic || undefined }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "priceit_export.docx";
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetAll() {
    setTabs([]);
    setActiveTabFormat(null);
    setError("");
    setCopied(false);
    setTopic("");
    setSegment("small_contractor");
    setFormat("linkedin_post");
    setVoice("street");
    setRepurposeVoice("street");
  }

  // ── Phase 4: Fetch industry quotes on mount ───────────────────────────────

  useEffect(() => {
    setQuotesLoading(true);
    fetch(`/api/quotes?segment=${segment}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setIndustryQuotes(data);
        else setQuotesError(true);
      })
      .catch(() => setQuotesError(true))
      .finally(() => setQuotesLoading(false));
  }, [segment]);

  async function useQuote(q: MinedQuote) {
    setTopic(q.topic_suggestion);
    // Record behavioral signal (fire & forget)
    fetch("/api/quotes/use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: q.id }),
    }).catch(() => {});
  }

  async function refreshQuotes() {
    setQuotesLoading(true);
    setQuotesError(false);
    fetch(`/api/quotes?segment=${segment}&refresh=1`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setIndustryQuotes(data);
        else setQuotesError(true);
      })
      .catch(() => setQuotesError(true))
      .finally(() => setQuotesLoading(false));
  }

  // ── Generate ──

  async function generate() {
    if (isGenerating) return;
    setIsGenerating(true);
    setError("");
    setCopied(false);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, segment, topic, voice }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const scoreHeader = res.headers.get("X-Quality-Score");
      const score = scoreHeader ? parseInt(scoreHeader, 10) : null;

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      // Create tab immediately so it shows while streaming
      upsertTab(format, "", null);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        upsertTab(format, accumulated, null);
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }

      upsertTab(format, accumulated, score);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  // ── Repurpose single (Feature 4: uses repurposeVoice) ──

  async function repurpose(targetFormat: Format) {
    if (!output || isGenerating || loadingFormats.has(targetFormat)) return;

    setLoadingFormats((prev) => new Set(prev).add(targetFormat));
    setError("");
    setCopied(false);

    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: output,
          sourceFormat: activeTabFormat ?? format,
          targetFormat,
          segment,
          voice: repurposeVoice,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Repurpose failed");
      }

      const scoreHeader = res.headers.get("X-Quality-Score");
      const score = scoreHeader ? parseInt(scoreHeader, 10) : null;

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      upsertTab(targetFormat, "", null);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        upsertTab(targetFormat, accumulated, null);
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }

      upsertTab(targetFormat, accumulated, score);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Repurpose failed");
    } finally {
      setLoadingFormats((prev) => {
        const next = new Set(prev);
        next.delete(targetFormat);
        return next;
      });
    }
  }

  // ── Batch repurpose all (Feature 3) ──

  async function repurposeAll() {
    if (!output || isGenerating || isBatchRunning) return;
    setIsBatchRunning(true);
    const currentFormat = activeTabFormat ?? format;
    const targets = REPURPOSE_ORDER.filter((f) => f !== currentFormat);
    await Promise.all(targets.map((t) => repurpose(t)));
    setIsBatchRunning(false);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-yellow-400 font-black text-xl tracking-tight">PRICEIT</span>
          <span className="text-zinc-500 text-sm">/ Content Engine</span>
        </Link>
        <div className="flex items-center gap-4">
          {tabs.length > 0 && (
            <button
              onClick={resetAll}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-400/50 transition-all"
            >
              ↺ Reset
            </button>
          )}
          <Link href="/tools" className="text-zinc-400 text-sm hover:text-white transition-colors">
            ← All Tools
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-black mb-2">Content Engine</h1>
          <p className="text-zinc-400">Generate on-brand PRICEIT content in seconds. Powered by Groq.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left: Controls ── */}
          <div className="space-y-6">

            {/* Segment */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                Target Audience
              </label>
              <div className="grid grid-cols-2 gap-3">
                {SEGMENTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSegment(s.id)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      segment === s.id
                        ? "border-yellow-400 bg-yellow-400/10 text-white"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
                    }`}
                  >
                    <div className="font-semibold text-sm">{s.label}</div>
                    <div className="text-xs mt-0.5 opacity-70">{s.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                Voice
              </label>
              <div className="grid grid-cols-3 gap-2">
                {VOICES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVoice(v.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      voice === v.id
                        ? "border-yellow-400 bg-yellow-400/10 text-white"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
                    }`}
                  >
                    <div className="font-semibold text-sm">{v.label}</div>
                    <div className="text-xs mt-0.5 opacity-60 leading-tight">{v.tagline}</div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                {VOICES.find((v) => v.id === voice)?.description}
              </p>
            </div>

            {/* Format */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                Content Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      format === f.id
                        ? "border-yellow-400 bg-yellow-400/10 text-white"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{f.icon}</span>
                      <span className="font-semibold text-xs">{f.label}</span>
                    </div>
                    <div className="text-xs mt-1 opacity-60 leading-tight">{f.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                Topic / Angle
                <span className="ml-2 text-zinc-600 normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={`e.g. "${TOPIC_SUGGESTIONS[segment][0]}"`}
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 text-sm resize-none transition-colors"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TOPIC_SUGGESTIONS[segment].map((s) => (
                  <button
                    key={s}
                    onClick={() => setTopic(s)}
                    className="text-xs px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-full text-zinc-400 hover:text-white transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* ── YouTube Angles (from 125-video competitive analysis) ── */}
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                    📺 YouTube angles
                  </span>
                  <span className="text-[10px] text-zinc-700">proven high-view topics</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {YOUTUBE_TOPICS[segment].map((s) => (
                    <button
                      key={s}
                      onClick={() => setTopic(s)}
                      className="text-xs px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 hover:border-yellow-400/40 rounded-full text-zinc-500 hover:text-yellow-400 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Phase 4: From Industry ── */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                    📰 From Industry
                  </span>
                  <button
                    onClick={refreshQuotes}
                    disabled={quotesLoading}
                    className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-40"
                  >
                    {quotesLoading ? "Loading…" : "↻ New topics"}
                  </button>
                </div>

                {quotesLoading ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-20 rounded-lg bg-zinc-800/60 animate-pulse" />
                    ))}
                  </div>
                ) : quotesError ? (
                  <div className="text-xs text-zinc-600 py-3 text-center">
                    Couldn't load industry news — try refreshing
                  </div>
                ) : industryQuotes.length === 0 ? (
                  <div className="text-xs text-zinc-600 py-3 text-center">
                    No industry quotes found
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                    {industryQuotes.slice(0, 8).map((q) => (
                      <button
                        key={q.id}
                        onClick={() => useQuote(q)}
                        className="text-left p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/80 transition-all group"
                      >
                        <div className="text-[10px] text-zinc-600 font-medium mb-1 uppercase tracking-wide">
                          {q.source}
                        </div>
                        <div className="text-xs text-zinc-400 leading-snug line-clamp-2 mb-2 group-hover:text-zinc-300">
                          {q.quote}
                        </div>
                        <div className="text-[10px] text-yellow-500/80 leading-snug line-clamp-1">
                          → {q.topic_suggestion}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={generate}
              disabled={isGenerating}
              className={`w-full py-4 rounded-lg font-black text-lg tracking-tight transition-all ${
                isGenerating
                  ? "bg-yellow-400/50 text-black/50 cursor-not-allowed"
                  : "bg-yellow-400 hover:bg-yellow-300 text-black cursor-pointer"
              }`}
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </span>
              ) : (
                `Generate ${selectedFormat.label}`
              )}
            </button>

            {/* Format hint */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Format rules
              </div>
              <div className="text-sm text-zinc-400 space-y-1">
                {format === "linkedin_post"    && <><div>• Hook: 1–2 lines, no emoji on line 1</div><div>• Body: 3–5 paragraphs with line breaks</div><div>• CTA: 1 direct line at the end</div><div>• Total: 150–300 words</div></>}
                {format === "cold_email"       && <><div>• Subject: under 50 chars, no clickbait</div><div>• No "I hope this finds you well"</div><div>• Body: 3–5 sentences only</div><div>• One ask per email</div></>}
                {format === "email_sequence"   && <><div>• 3 emails: Day 0, 3, 7</div><div>• Day 0: Pain-led cold email</div><div>• Day 3: Social proof follow-up</div><div>• Day 7: Value-add or breakup</div></>}
                {format === "blog_intro"       && <><div>• H1 under 60 chars, sentence case</div><div>• Intro: 2 sentences, lead with pain</div><div>• First subhead + body paragraph</div><div>• Ends with beta waitlist CTA</div></>}
                {format === "instagram"        && <><div>• Hook on first line</div><div>• Short punchy lines</div><div>• Max 3 hashtags from approved list</div></>}
                {format === "x_post"           && <><div>• Max 280 characters</div><div>• One idea only</div><div>• 0–1 hashtag</div></>}
                {format === "facebook_post"    && <><div>• Hook in first 1–2 lines</div><div>• Relatable story, conversational tone</div><div>• 100–200 words</div><div>• 1–2 hashtags max</div></>}
                {format === "whatsapp_message" && <><div>• Sounds like a text from a colleague</div><div>• Under 100 words</div><div>• No subject line, no sales pitch</div><div>• One clear ask at the end</div></>}
                {format === "snapchat"         && <><div>• Caption: under 50 characters</div><div>• Context: 1–2 short lines</div><div>• Visual and punchy</div><div>• No hashtags</div></>}
              </div>
            </div>
          </div>

          {/* ── Right: Output ── */}
          <div className="flex flex-col">

            {/* Output tabs (Feature 1) */}
            {tabs.length > 0 && (
              <div className="flex gap-1 mb-3 overflow-x-auto pb-1 scrollbar-none">
                {tabs.map((tab) => {
                  const isLoading = loadingFormats.has(tab.format);
                  return (
                    <button
                      key={tab.format}
                      onClick={() => setActiveTabFormat(tab.format)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                        activeTabFormat === tab.format
                          ? "bg-zinc-700 border-zinc-600 text-white"
                          : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                      {isLoading ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                      ) : tab.score !== null ? (
                        <span className={`text-xs ${
                          tab.score >= 62 ? "text-green-400"
                          : tab.score >= 50 ? "text-yellow-400"
                          : "text-red-400"
                        }`}>
                          {tab.score}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Output header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                  Output
                </label>
                {qualityScore !== null && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    qualityScore >= 62
                      ? "bg-green-400/15 text-green-400 border border-green-400/30"
                      : qualityScore >= 50
                      ? "bg-yellow-400/15 text-yellow-400 border border-yellow-400/30"
                      : "bg-red-400/15 text-red-400 border border-red-400/30"
                  }`}>
                    Quality {qualityScore}/100
                  </span>
                )}
              </div>
              {output && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all"
                  >
                    {copied ? (
                      <><svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-green-400">Copied!</span></>
                    ) : (
                      <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                    )}
                  </button>
                  <button
                    onClick={downloadDocx}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V19a2 2 0 002 2h14a2 2 0 002-2v-2" /></svg>
                    .docx
                  </button>
                </div>
              )}
            </div>

            {/* Output box */}
            <div
              ref={outputRef}
              className={`flex-1 min-h-[440px] bg-zinc-900 border rounded-lg p-6 overflow-y-auto transition-colors ${
                error ? "border-red-500/50" : output ? "border-zinc-700" : "border-zinc-800"
              }`}
            >
              {error ? (
                <div className="text-red-400 text-sm">
                  <div className="font-semibold mb-1">Error</div>
                  <div>{error}</div>
                  {(error.includes("API key") || error.includes("api_key") || error.includes("auth")) && (
                    <div className="mt-3 text-zinc-500 text-xs">
                      Add your free Groq API key to <code className="bg-zinc-800 px-1 rounded">web/.env.local</code>:
                      <pre className="mt-1 bg-zinc-800 p-2 rounded">GROQ_API_KEY=gsk_...</pre>
                      <div className="mt-1">Get one free at <span className="text-yellow-400">console.groq.com</span></div>
                    </div>
                  )}
                </div>
              ) : output ? (
                <pre className="text-zinc-100 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {output}
                  {(isGenerating || loadingFormats.has(activeTabFormat!)) && (
                    <span className="inline-block w-0.5 h-4 bg-yellow-400 ml-0.5 animate-pulse" />
                  )}
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                  <div className="text-4xl mb-3">✦</div>
                  <div className="text-sm text-center">
                    Choose a format, pick your audience,<br />then hit Generate.
                  </div>
                  {isGenerating && (
                    <div className="mt-4 text-yellow-400 text-xs animate-pulse">Writing…</div>
                  )}
                </div>
              )}
            </div>

            {/* Character count (Feature 2) */}
            {output && (
              <div className={`mt-2 text-xs text-right ${charColor}`}>
                {charCount} chars
                {charLimit && ` / ${charLimit.max} max`}
                {" · "}
                {output.split(/\s+/).filter(Boolean).length} words
                {charLimit && charCount > charLimit.max && (
                  <span className="ml-2 text-red-400">⚠ Over limit</span>
                )}
              </div>
            )}

            {/* Repurpose section */}
            {output && !isGenerating && (
              <div className="mt-4">
                {/* Repurpose header + voice toggle (Feature 4) */}
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                    Repurpose to →
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-600 mr-1">Voice:</span>
                    {VOICES.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setRepurposeVoice(v.id)}
                        className={`text-xs px-2 py-0.5 rounded border transition-all ${
                          repurposeVoice === v.id
                            ? "border-yellow-400/60 text-yellow-400 bg-yellow-400/10"
                            : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Repurpose pills */}
                <div className="flex flex-wrap gap-2">
                  {REPURPOSE_ORDER.filter((t) => t !== activeTabFormat).map((t) => {
                    const meta = ALL_FORMAT_META[t];
                    const isLoading = loadingFormats.has(t);
                    return (
                      <button
                        key={t}
                        onClick={() => repurpose(t)}
                        disabled={isLoading || isBatchRunning}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          isLoading
                            ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                            : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-white"
                        } disabled:cursor-not-allowed`}
                      >
                        <span>{meta.icon}</span>
                        <span>{isLoading ? "Converting…" : meta.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Batch repurpose button (Feature 3) */}
                <button
                  onClick={repurposeAll}
                  disabled={isBatchRunning || isGenerating}
                  className={`mt-2 w-full py-2 rounded-lg border text-xs font-semibold tracking-wide transition-all ${
                    isBatchRunning
                      ? "border-yellow-400/40 text-yellow-400/60 cursor-not-allowed"
                      : "border-zinc-700 text-zinc-400 hover:border-yellow-400/40 hover:text-yellow-400"
                  }`}
                >
                  {isBatchRunning ? "Generating all formats…" : "⚡ Generate all formats"}
                </button>
              </div>
            )}

            {/* Regenerate */}
            {output && !isGenerating && (
              <button
                onClick={generate}
                disabled={isBatchRunning}
                className="mt-2 w-full py-2.5 border border-zinc-700 hover:border-zinc-500 rounded-lg text-zinc-400 hover:text-white text-sm transition-all disabled:opacity-50"
              >
                Regenerate ↻
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-zinc-800 text-center text-zinc-600 text-xs">
          Content generated using PRICEIT brand voice + style guide. Always review before publishing.
        </div>
      </div>
    </div>
  );
}
