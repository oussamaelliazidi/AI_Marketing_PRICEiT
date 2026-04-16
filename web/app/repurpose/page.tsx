"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { VOICES, VoiceType } from "@/lib/voices";

// ── Types & config ─────────────────────────────────────────────────────────

type Segment = "small_contractor" | "large_firm";
type Mode    = "single" | "all";

const FORMATS = [
  { id: "linkedin_post",    label: "LinkedIn Post" },
  { id: "x_post",           label: "X Post" },
  { id: "instagram",        label: "Instagram" },
  { id: "cold_email",       label: "Cold Email" },
  { id: "email_sequence",   label: "Email Sequence" },
  { id: "blog_intro",       label: "Blog Intro" },
  { id: "facebook_post",    label: "Facebook Post" },
  { id: "whatsapp_message", label: "WhatsApp" },
  { id: "snapchat",         label: "Snapchat" },
];

const SEGMENTS = [
  { id: "small_contractor" as Segment, label: "Small Contractor", sub: "1–20 people" },
  { id: "large_firm"       as Segment, label: "Large Firm",       sub: "50+ employees" },
];

interface FormatResult {
  format:  string;
  label:   string;
  content: string;
  score:   number;
  status:  "pending" | "loading" | "done" | "error";
  error?:  string;
}

function scoreColor(score: number) {
  if (score >= 70) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function scoreBadgeClass(score: number) {
  if (score >= 70) return "bg-green-400/15 text-green-400 border-green-400/30";
  if (score >= 50) return "bg-yellow-400/15 text-yellow-400 border-yellow-400/30";
  return "bg-red-400/15 text-red-400 border-red-400/30";
}

// ── Component ──────────────────────────────────────────────────────────────

export default function RepurposePage() {
  const [mode, setMode]                   = useState<Mode>("single");
  const [sourceContent, setSourceContent] = useState("");
  const [sourceFormat, setSourceFormat]   = useState("linkedin_post");
  const [targetFormat, setTargetFormat]   = useState("cold_email");
  const [segment, setSegment]             = useState<Segment>("small_contractor");
  const [voice, setVoice]                 = useState<VoiceType>("street");

  // Single mode state
  const [output, setOutput]             = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError]               = useState("");
  const [copied, setCopied]             = useState(false);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // All mode state
  const [allResults, setAllResults]       = useState<FormatResult[]>([]);
  const [allRunning, setAllRunning]       = useState(false);
  const [copiedAllId, setCopiedAllId]     = useState<string | null>(null);
  const [expandedAll, setExpandedAll]     = useState<string | null>(null);

  const wordCount = output.split(/\s+/).filter(Boolean).length;

  // ── Single repurpose ───────────────────────────────────────────────────

  async function repurposeSingle() {
    if (isGenerating || !sourceContent.trim()) return;
    setIsGenerating(true);
    setOutput("");
    setError("");
    setCopied(false);
    setQualityScore(null);

    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: sourceContent.trim(), sourceFormat, targetFormat, segment, voice }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Repurpose failed");
      }

      const scoreHeader = res.headers.get("X-Quality-Score");
      if (scoreHeader) setQualityScore(parseInt(scoreHeader, 10));

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setOutput(accumulated);
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  // ── Repurpose for All ──────────────────────────────────────────────────

  async function repurposeAll() {
    if (allRunning || !sourceContent.trim()) return;
    setAllRunning(true);
    setExpandedAll(null);

    const targets = FORMATS.filter((f) => f.id !== sourceFormat);

    // Initialise all cards as loading
    setAllResults(
      targets.map((f) => ({
        format:  f.id,
        label:   f.label,
        content: "",
        score:   0,
        status:  "loading",
      }))
    );

    // Fire all requests in parallel
    await Promise.allSettled(
      targets.map(async (f) => {
        try {
          const res = await fetch("/api/repurpose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content:      sourceContent.trim(),
              sourceFormat,
              targetFormat: f.id,
              segment,
              voice,
            }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed");
          }

          const scoreHeader = res.headers.get("X-Quality-Score");
          const score = scoreHeader ? parseInt(scoreHeader, 10) : 0;

          const reader  = res.body!.getReader();
          const decoder = new TextDecoder();
          let content = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            content += decoder.decode(value, { stream: true });
            // Update this card's content as it streams in
            setAllResults((prev) =>
              prev.map((r) =>
                r.format === f.id ? { ...r, content, score, status: "loading" } : r
              )
            );
          }

          setAllResults((prev) =>
            prev.map((r) =>
              r.format === f.id ? { ...r, content, score, status: "done" } : r
            )
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Error";
          setAllResults((prev) =>
            prev.map((r) =>
              r.format === f.id ? { ...r, status: "error", error: msg } : r
            )
          );
        }
      })
    );

    setAllRunning(false);
  }

  function copyAll(format: string, content: string) {
    navigator.clipboard.writeText(content);
    setCopiedAllId(format);
    setTimeout(() => setCopiedAllId(null), 2000);
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadDocx() {
    if (!output) return;
    const res = await fetch("/api/export/docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: output, format: targetFormat, voice, segment }),
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

  function reset() {
    setOutput(""); setError(""); setCopied(false); setQualityScore(null);
    setAllResults([]); setExpandedAll(null);
  }

  const sourceLabel = FORMATS.find((f) => f.id === sourceFormat)?.label ?? sourceFormat;
  const targetLabel = FORMATS.find((f) => f.id === targetFormat)?.label ?? targetFormat;
  const doneCount   = allResults.filter((r) => r.status === "done").length;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-yellow-400 font-black text-xl tracking-tight">PRICEIT</span>
          <span className="text-zinc-500 text-sm">/ Repurpose</span>
        </Link>
        <div className="flex items-center gap-4">
          {(output || allResults.length > 0) && (
            <button
              onClick={reset}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-400/50 transition-all"
            >
              ↺ Reset
            </button>
          )}
          <Link href="/generate" className="text-zinc-400 text-sm hover:text-white transition-colors">Content Engine →</Link>
          <Link href="/history"  className="text-zinc-400 text-sm hover:text-white transition-colors">History →</Link>
          <Link href="/"         className="text-zinc-400 text-sm hover:text-white transition-colors">← Back</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black mb-2">Repurpose Engine</h1>
            <p className="text-zinc-400">Same story — every platform.</p>
          </div>
          {/* Mode toggle */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 gap-1">
            <button
              onClick={() => setMode("single")}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                mode === "single" ? "bg-yellow-400 text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              Single Format
            </button>
            <button
              onClick={() => setMode("all")}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                mode === "all" ? "bg-yellow-400 text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              All Formats ✦
            </button>
          </div>
        </div>

        {/* ── Shared inputs ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Source format */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
              Source Format
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSourceFormat(f.id)}
                  className={`px-2 py-2 rounded-lg border text-xs font-medium text-left transition-all ${
                    sourceFormat === f.id
                      ? "border-yellow-400 bg-yellow-400/10 text-white"
                      : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source content */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
              Paste Your {sourceLabel}
            </label>
            <textarea
              value={sourceContent}
              onChange={(e) => setSourceContent(e.target.value)}
              placeholder={`Paste your ${sourceLabel} here — or anything you want to repurpose…`}
              rows={6}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 text-sm transition-colors resize-none leading-relaxed"
            />
            {sourceContent && (
              <div className="mt-1 text-xs text-zinc-600 text-right">
                {sourceContent.split(/\s+/).filter(Boolean).length} words
              </div>
            )}
          </div>
        </div>

        {/* Audience + Voice */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
          {SEGMENTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSegment(s.id)}
              className={`p-3 rounded-lg border text-left transition-all ${
                segment === s.id
                  ? "border-yellow-400 bg-yellow-400/10 text-white"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              <div className="font-semibold text-xs">{s.label}</div>
              <div className="text-xs mt-0.5 opacity-70">{s.sub}</div>
            </button>
          ))}
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
              <div className="font-semibold text-xs">{v.label}</div>
              <div className="text-xs mt-0.5 opacity-60 leading-tight">{v.tagline}</div>
            </button>
          ))}
        </div>

        {/* ════════════════════ SINGLE MODE ════════════════════ */}
        {mode === "single" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-5">
              {/* Target format */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                  Target Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setTargetFormat(f.id)}
                      disabled={f.id === sourceFormat}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-all ${
                        f.id === sourceFormat
                          ? "border-zinc-800 bg-zinc-900 text-zinc-700 cursor-not-allowed"
                          : targetFormat === f.id
                          ? "border-blue-400 bg-blue-400/10 text-white"
                          : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Arrow summary */}
              {sourceContent.trim() && (
                <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-zinc-400">
                  <span className="font-semibold text-white">{sourceLabel}</span>
                  <span className="text-yellow-400 text-base">→</span>
                  <span className="font-semibold text-white">{targetLabel}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="capitalize">{voice}</span>
                  <span className="text-zinc-600">·</span>
                  <span>{segment === "large_firm" ? "Large Firm" : "Small Contractor"}</span>
                </div>
              )}

              <button
                onClick={repurposeSingle}
                disabled={isGenerating || !sourceContent.trim()}
                className={`w-full py-4 rounded-lg font-black text-lg tracking-tight transition-all ${
                  isGenerating || !sourceContent.trim()
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
                    Repurposing…
                  </span>
                ) : `Repurpose → ${targetLabel}`}
              </button>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Output */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                  {targetLabel} Output
                </label>
                <div className="flex items-center gap-2">
                  {qualityScore !== null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${scoreBadgeClass(qualityScore)}`}>
                      Quality {qualityScore}
                    </span>
                  )}
                  {output && (
                    <>
                      <button
                        onClick={copyToClipboard}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all"
                      >
                        {copied
                          ? <><svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-green-400">Copied!</span></>
                          : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                        }
                      </button>
                      <button
                        onClick={downloadDocx}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V19a2 2 0 002 2h14a2 2 0 002-2v-2" /></svg>
                        .docx
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div
                ref={outputRef}
                className={`flex-1 min-h-[400px] bg-zinc-900 border rounded-lg p-6 overflow-y-auto transition-colors ${
                  error ? "border-red-500/50" : output ? "border-zinc-700" : "border-zinc-800"
                }`}
              >
                {output ? (
                  <pre className="text-zinc-100 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                    {output}
                    {isGenerating && <span className="inline-block w-0.5 h-4 bg-yellow-400 ml-0.5 animate-pulse" />}
                  </pre>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                    <div className="text-4xl mb-3">🔄</div>
                    <div className="text-sm text-center">Pick a target format and hit Repurpose.</div>
                  </div>
                )}
              </div>
              {output && (
                <div className="mt-2 text-xs text-zinc-600 text-right">{wordCount} words · {output.length} chars</div>
              )}
              {output && !isGenerating && (
                <button
                  onClick={repurposeSingle}
                  className="mt-2 w-full py-2.5 border border-zinc-700 hover:border-zinc-500 rounded-lg text-zinc-400 hover:text-white text-sm transition-all"
                >
                  Repurpose again ↻
                </button>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════ ALL FORMATS MODE ════════════════════ */}
        {mode === "all" && (
          <div>
            {/* CTA */}
            <button
              onClick={repurposeAll}
              disabled={allRunning || !sourceContent.trim()}
              className={`w-full py-4 rounded-lg font-black text-lg tracking-tight transition-all mb-8 ${
                allRunning || !sourceContent.trim()
                  ? "bg-yellow-400/50 text-black/50 cursor-not-allowed"
                  : "bg-yellow-400 hover:bg-yellow-300 text-black cursor-pointer"
              }`}
            >
              {allRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Repurposing all formats… {doneCount}/{FORMATS.length - 1} done
                </span>
              ) : `✦ Repurpose for All Formats (${FORMATS.length - 1})`}
            </button>

            {/* Results grid */}
            {allResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {allResults.map((result) => {
                  const isExpanded = expandedAll === result.format;
                  return (
                    <div
                      key={result.format}
                      className={`bg-zinc-900 border rounded-lg overflow-hidden transition-colors ${
                        result.status === "done"    ? "border-zinc-700" :
                        result.status === "error"   ? "border-red-500/30" :
                        result.status === "loading" && result.content ? "border-zinc-700" :
                        "border-zinc-800"
                      }`}
                    >
                      {/* Card header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                        <span className="text-sm font-semibold text-white">{result.label}</span>
                        <div className="flex items-center gap-2">
                          {result.status === "loading" && (
                            <svg className="animate-spin h-3.5 w-3.5 text-yellow-400" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          )}
                          {(result.status === "done" || (result.status === "loading" && result.content)) && result.score > 0 && (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full border ${scoreBadgeClass(result.score)}`}>
                              {result.score}
                            </span>
                          )}
                          {result.status === "done" && (
                            <button
                              onClick={() => copyAll(result.format, result.content)}
                              className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
                            >
                              {copiedAllId === result.format ? "✓" : "Copy"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="px-4 py-3">
                        {result.status === "error" ? (
                          <p className="text-red-400 text-xs">{result.error}</p>
                        ) : result.content ? (
                          <>
                            <pre className={`text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap font-sans transition-all ${
                              isExpanded ? "" : "line-clamp-6 max-h-32 overflow-hidden"
                            }`}>
                              {result.content}
                              {result.status === "loading" && (
                                <span className="inline-block w-0.5 h-3 bg-yellow-400 ml-0.5 animate-pulse" />
                              )}
                            </pre>
                            {result.status === "done" && result.content.length > 200 && (
                              <button
                                onClick={() => setExpandedAll(isExpanded ? null : result.format)}
                                className="mt-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                              >
                                {isExpanded ? "Show less ↑" : "Show more ↓"}
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-center py-8 text-zinc-700 text-xs">
                            Waiting…
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {allResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-600 bg-zinc-900 border border-zinc-800 rounded-lg">
                <div className="text-4xl mb-3">✦</div>
                <div className="text-sm text-center leading-relaxed">
                  Paste your content above and hit Repurpose for All.<br />
                  {FORMATS.length - 1} formats generated in parallel — all at once.
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-zinc-800 text-center text-zinc-600 text-xs">
          Repurposed content preserves the original story and numbers. Always review before publishing.
        </div>
      </div>
    </div>
  );
}
