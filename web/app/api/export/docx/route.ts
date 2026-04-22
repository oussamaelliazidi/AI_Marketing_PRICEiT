import { NextRequest } from "next/server";
import {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, BorderStyle, PageNumber,
  LevelFormat,
} from "docx";
import { checkLength, MAX_CONTENT_LENGTH, MAX_TOPIC_LENGTH } from "@/lib/validateInput";

// ── Format labels ──────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  linkedin_post:    "LinkedIn Post",
  x_post:           "X Post",
  instagram:        "Instagram Caption",
  cold_email:       "Cold Email",
  email_sequence:   "Email Sequence",
  blog_intro:       "Blog Introduction",
  facebook_post:    "Facebook Post",
  whatsapp_message: "WhatsApp Message",
  snapchat:         "Snapchat Caption",
  blog_post:        "SEO Blog Post",
};

const VOICE_LABELS: Record<string, string> = {
  street:       "Street",
  professional: "Professional",
  aggressive:   "Aggressive",
};

const SEGMENT_LABELS: Record<string, string> = {
  small_contractor: "Small Contractor",
  large_firm:       "Large Construction Firm",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function buildParagraphs(text: string): Paragraph[] {
  const lines = text.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Email labels (EMAIL 1 — Day 0)
    if (/^EMAIL \d/i.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 240, after: 80 },
          children: [new TextRun({ text: trimmed, bold: true, size: 24, font: "Arial" })],
        })
      );
      continue;
    }

    // Subject line
    if (/^Subject:/i.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 80, after: 80 },
          children: [new TextRun({ text: trimmed, bold: true, size: 22, font: "Arial" })],
        })
      );
      continue;
    }

    // Empty line → small spacer
    if (!trimmed) {
      paragraphs.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: [] }));
      continue;
    }

    // Normal paragraph
    paragraphs.push(
      new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: trimmed, size: 22, font: "Arial" })],
      })
    );
  }

  return paragraphs;
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return Response.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const { content, format, voice, segment, topic } = body as Record<string, unknown>;

    if (!content || typeof content !== "string") {
      return Response.json({ error: "content is required and must be a string" }, { status: 400 });
    }

    const contentErr = checkLength("content", content, MAX_CONTENT_LENGTH);
    if (contentErr) return contentErr;

    const topicErr = checkLength("topic", typeof topic === "string" ? topic : undefined, MAX_TOPIC_LENGTH);
    if (topicErr) return topicErr;

    const formatKey  = typeof format === "string" ? format : "";
    const voiceKey   = typeof voice === "string" ? voice : "";
    const segmentKey = typeof segment === "string" ? segment : "";

    const formatLabel  = FORMAT_LABELS[formatKey]  ?? "Content";
    const voiceLabel   = VOICE_LABELS[voiceKey]    ?? "";
    const segmentLabel = SEGMENT_LABELS[segmentKey] ?? "";
    const date         = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const metaParts = [segmentLabel, voiceLabel, date].filter(Boolean);

    const doc = new Document({
      numbering: { config: [] },
      styles: {
        default: {
          document: { run: { font: "Arial", size: 22 } },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 }, // A4
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },

          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "F5C518", space: 8 } },
                  children: [
                    new TextRun({ text: "PRICEIT", bold: true, size: 24, color: "F5C518", font: "Arial" }),
                    new TextRun({ text: "  ·  AI Construction Pricing Platform", size: 20, color: "888888", font: "Arial" }),
                  ],
                }),
              ],
            }),
          },

          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  border: { top: { style: BorderStyle.SINGLE, size: 4, color: "333333", space: 6 } },
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: "PRICEIT — priceit.io  ·  Page ", size: 18, color: "888888", font: "Arial" }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888", font: "Arial" }),
                  ],
                }),
              ],
            }),
          },

          children: [
            // Format heading
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 0, after: 120 },
              children: [new TextRun({ text: formatLabel, bold: true, size: 36, font: "Arial", color: "111111" })],
            }),

            // Topic line (if provided)
            ...(topic
              ? [new Paragraph({
                  spacing: { before: 0, after: 80 },
                  children: [new TextRun({ text: `Topic: ${topic}`, size: 20, color: "666666", italics: true, font: "Arial" })],
                })]
              : []),

            // Meta line
            new Paragraph({
              spacing: { before: 0, after: 240 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "EEEEEE", space: 8 } },
              children: [new TextRun({ text: metaParts.join("  ·  "), size: 18, color: "999999", font: "Arial" })],
            }),

            // Content
            ...buildParagraphs(content),

            // End spacer
            new Paragraph({ spacing: { before: 240 }, children: [] }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const uint8  = new Uint8Array(buffer);

    const safeLabel = formatLabel.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename  = `priceit_${safeLabel}_${Date.now()}.docx`;

    return new Response(uint8, {
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      String(buffer.byteLength),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/export/docx]", message);
    return Response.json({ error: "Export failed" }, { status: 500 });
  }
}
