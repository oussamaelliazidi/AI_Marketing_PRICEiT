-- ============================================================================
-- Migration: Add indexes for content history queries
-- Context:   web/app/api/history/route.ts queries three tables with
--            ORDER BY created_at DESC, optional WHERE on format / segment.
--            Without indexes these hit sequential scans on every page load.
-- ============================================================================

-- ── content_generations ─────────────────────────────────────────────────────
-- Base query: ORDER BY created_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_content_generations_created_at_desc
  ON content_generations (created_at DESC);

-- Filtered: WHERE format = $1 ORDER BY created_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_content_generations_format_created_at
  ON content_generations (format, created_at DESC);

-- Filtered: WHERE segment = $1 ORDER BY created_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_content_generations_segment_created_at
  ON content_generations (segment, created_at DESC);

-- ── content_repurposes ──────────────────────────────────────────────────────
-- Base query: ORDER BY created_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_content_repurposes_created_at_desc
  ON content_repurposes (created_at DESC);

-- Filtered: WHERE target_format = $1 ORDER BY created_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_content_repurposes_target_format_created_at
  ON content_repurposes (target_format, created_at DESC);

-- Filtered: WHERE segment = $1 ORDER BY created_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_content_repurposes_segment_created_at
  ON content_repurposes (segment, created_at DESC);

-- ── seo_generations ─────────────────────────────────────────────────────────
-- Base query: ORDER BY created_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_seo_generations_created_at_desc
  ON seo_generations (created_at DESC);

-- Filtered: WHERE segment = $1 ORDER BY created_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_seo_generations_segment_created_at
  ON seo_generations (segment, created_at DESC);
