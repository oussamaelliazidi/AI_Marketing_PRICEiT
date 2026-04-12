"use client";

import { useState, useRef } from "react";
import Link from "next/link";

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
  { id: "linkedin_post",    label: "LinkedIn Post",    icon: "💼", description: "150–300 words, hook → body → CTA" },
  { id: "cold_email",       label: "Cold Email",       icon: "📧", description: "Subject + 3–5 sentences + single ask" },
  { id: "email_sequence",   label: "3-Email Sequence", icon: "📬", description: "Day 0, 3, 7 outreach campaign" },
  { id: "blog_intro",       label: "Blog Intro",       icon: "📝", description: "H1 + intro + first subhead + body" },
  { id: "instagram",        label: "Instagram",        icon: "📸", description: "Hook + body + hashtags" },
  { id: "x_post",           label: "X / Twitter",      icon: "𝕏", description: "Under 280 chars, one idea" },
];

// All repurpose targets (includes social formats not in main picker)
const REPURPOSE_TARGETS: { id: Format; label: string; icon: string }[] = [
  { id: "linkedin_post",    label: "LinkedIn",  icon: "💼" },
  { id: "x_post",           label: "X Post",    icon: "𝕏" },
  { id: "instagram",        label: "Instagram", icon: "📸" },
  { id: "facebook_post",    label: "Facebook",  icon: "📘" },
  { id: "cold_email",       label: "Cold Email",icon: "📧" },
  { id: "email_sequence",   label: "3 Emails",  icon: "📬" },
  { id: "whatsapp_message", label: "WhatsApp",  icon: "💬" },
  { id: "blog_intro",       label: "Blog",      icon: "📝" },
  { id: "snapchat",         label: "Snapchat",  icon: "👻" },
];

const SEGMENTS: SegmentOption[] = [
  { id: "small_contractor", label: "Small Contractor", sub: "1–20 people, owner-operators" },
  { id: "large_firm", label: "Large Firm", sub: "50+ employees, estimating teams" },
];

const TOPIC_SUGGESTIONS: Record<Segment, string[]> = {
  small_contractor: [
    "Stop under-bidding on roofing jobs",
    "Pricing a 3-trade job in under 2 minutes",
    "How to win more bids without cutting margin",
    "The cost of one bad estimate",
    "From spreadsheet chaos to instant quotes",
  ],
  large_firm: [
    "Cutting 3-day estimates to same-day",
    "Audit trail on every pricing decision",
    "Estimating team bottleneck kills bid volume",
    "Margin misses on commercial fit-outs",
    "60% less estimating time, same accuracy",
  ],
};

// ── Component ──────────────────────────────────────────────────────────────

export default function GeneratePage() {
  const [segment, setSegment] = useState<Segment>("small_contractor");
  const [format, setFormat] = useState<Format>("linkedin_post");
  const [topic, setTopic] = useState("");
  const [output, setOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [isRepurposing, setIsRepurposing] = useState(false);
  const [repurposingTo, setRepurposingTo] = useState<Format | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const selectedFormat = FORMATS.find((f) => f.id === format)!;

  async function generate() {
    if (isGenerating) return;
    setIsGenerating(true);
    setOutput("");
    setError("");
    setCopied(false);
    setQualityScore(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, segment, topic }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      // Read quality score from header
      const scoreHeader = res.headers.get("X-Quality-Score");
      if (scoreHeader) setQualityScore(parseInt(scoreHeader, 10));

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setOutput(accumulated);
        if (outputRef.current) {
          outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  function copyToClipboard() {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function useSuggestion(s: string) {
    setTopic(s);
  }

  async function repurpose(targetFormat: Format) {
    if (!output || isGenerating || isRepurposing) return;
    setIsRepurposing(true);
    setRepurposingTo(targetFormat);
    setError("");
    setCopied(false);
    setQualityScore(null);

    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: output,
          sourceFormat: format,
          targetFormat,
          segment,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Repurpose failed");
      }

      const scoreHeader = res.headers.get("X-Quality-Score");
      if (scoreHeader) setQualityScore(parseInt(scoreHeader, 10));

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setOutput(accumulated);
        if (outputRef.current) {
          outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
      }

      // Switch active format to the repurposed one
      setFormat(targetFormat);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Repurpose failed");
    } finally {
      setIsRepurposing(false);
      setRepurposingTo(null);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-yellow-400 font-black text-xl tracking-tight">PRICEIT</span>
          <span className="text-zinc-500 text-sm">/ Content Engine</span>
        </Link>
        <Link
          href="/"
          className="text-zinc-400 text-sm hover:text-white transition-colors"
        >
          ← Back to site
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-black mb-2">
            Content Engine
          </h1>
          <p className="text-zinc-400">
            Generate on-brand PRICEIT content in seconds. Powered by Claude.
          </p>
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

            {/* Format */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                Content Format
              </label>
              <div className="grid grid-cols-2 gap-2">
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
                    <div className="flex items-center gap-2">
                      <span className="text-base">{f.icon}</span>
                      <span className="font-semibold text-sm">{f.label}</span>
                    </div>
                    <div className="text-xs mt-1 opacity-60">{f.description}</div>
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
              {/* Suggestions */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TOPIC_SUGGESTIONS[segment].map((s) => (
                  <button
                    key={s}
                    onClick={() => useSuggestion(s)}
                    className="text-xs px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-full text-zinc-400 hover:text-white transition-all"
                  >
                    {s}
                  </button>
                ))}
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
                {format === "linkedin_post" && (
                  <>
                    <div>• Hook: 1–2 lines, no emoji on line 1</div>
                    <div>• Body: 3–5 paragraphs with line breaks</div>
                    <div>• CTA: 1 direct line at the end</div>
                    <div>• Total: 150–300 words</div>
                  </>
                )}
                {format === "cold_email" && (
                  <>
                    <div>• Subject: under 50 chars, no clickbait</div>
                    <div>• No "I hope this finds you well"</div>
                    <div>• Body: 3–5 sentences only</div>
                    <div>• One ask per email</div>
                  </>
                )}
                {format === "email_sequence" && (
                  <>
                    <div>• 3 emails: Day 0, 3, 7</div>
                    <div>• Day 0: Pain-led cold email</div>
                    <div>• Day 3: Social proof follow-up</div>
                    <div>• Day 7: Value-add or breakup</div>
                  </>
                )}
                {format === "blog_intro" && (
                  <>
                    <div>• H1 under 60 chars, sentence case</div>
                    <div>• Intro: 2 sentences, lead with pain</div>
                    <div>• First subhead + body paragraph</div>
                    <div>• Ends with beta waitlist CTA</div>
                  </>
                )}
                {format === "instagram" && (
                  <>
                    <div>• Hook on first line</div>
                    <div>• Short punchy lines</div>
                    <div>• Max 3 hashtags from approved list</div>
                  </>
                )}
                {format === "x_post" && (
                  <>
                    <div>• Max 280 characters</div>
                    <div>• One idea only</div>
                    <div>• 0–1 hashtag</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Output ── */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                  Output
                </label>
                {qualityScore !== null && (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      qualityScore >= 70
                        ? "bg-green-400/15 text-green-400 border border-green-400/30"
                        : qualityScore >= 55
                        ? "bg-yellow-400/15 text-yellow-400 border border-yellow-400/30"
                        : "bg-red-400/15 text-red-400 border border-red-400/30"
                    }`}
                  >
                    Quality {qualityScore}/100
                  </span>
                )}
              </div>
              {output && (
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>

            <div
              ref={outputRef}
              className={`flex-1 min-h-[500px] bg-zinc-900 border rounded-lg p-6 overflow-y-auto transition-colors ${
                error
                  ? "border-red-500/50"
                  : output
                  ? "border-zinc-700"
                  : "border-zinc-800"
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
                  {isGenerating && (
                    <span className="inline-block w-0.5 h-4 bg-yellow-400 ml-0.5 animate-pulse" />
                  )}
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                  <div className="text-4xl mb-3">✦</div>
                  <div className="text-sm text-center">
                    Choose a format, pick your audience,
                    <br />
                    then hit Generate.
                  </div>
                  {isGenerating && (
                    <div className="mt-4 text-yellow-400 text-xs animate-pulse">
                      Claude is writing…
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Character count */}
            {output && (
              <div className="mt-2 text-xs text-zinc-600 text-right">
                {output.length} chars · {output.split(/\s+/).filter(Boolean).length} words
              </div>
            )}

            {/* Repurpose row */}
            {output && !isGenerating && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  Repurpose to →
                </div>
                <div className="flex flex-wrap gap-2">
                  {REPURPOSE_TARGETS.filter((t) => t.id !== format).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => repurpose(t.id)}
                      disabled={isRepurposing}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        repurposingTo === t.id
                          ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                          : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-white"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <span>{t.icon}</span>
                      <span>
                        {repurposingTo === t.id ? "Converting…" : t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Regenerate */}
            {output && !isGenerating && (
              <button
                onClick={generate}
                disabled={isRepurposing}
                className="mt-3 w-full py-2.5 border border-zinc-700 hover:border-zinc-500 rounded-lg text-zinc-400 hover:text-white text-sm transition-all disabled:opacity-50"
              >
                Regenerate ↻
              </button>
            )}
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-8 border-t border-zinc-800 text-center text-zinc-600 text-xs">
          Content generated using PRICEIT brand voice + style guide. Always review before publishing.
        </div>
      </div>
    </div>
  );
}
