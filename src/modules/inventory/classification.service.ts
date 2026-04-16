import { Injectable, Logger } from '@nestjs/common';

// ─── Public contract ─────────────────────────────────────────────────────────

/**
 * Result returned by POST /inventory/classify.
 *
 * All values come from Google Cloud Vision API image analysis.
 * No values are deterministically computed from the file name or URI.
 *
 * `categoryPreset` may be null when Vision API labels do not match any
 * known CategoryPreset — e.g. Iraqi-specific garments (Abaya, Galabiya,
 * Dishdasha) that generic Vision models do not label specifically.
 * The review screen must prompt the user to choose manually in that case.
 *
 * `source === 'manual_fallback'` means GOOGLE_VISION_API_KEY is not configured
 * or the API call failed. All classification fields will be empty/null.
 */
export interface VisionClassificationResult {
  /** One of CategoryPreset string values, or null if Vision couldn't map */
  categoryPreset: string | null;
  /** Real score from Vision (0–1), null if categoryPreset is null */
  categoryConfidence: number | null;
  /** ColorFamily string value — derived from actual dominant pixel data */
  primaryColorFamily: string;
  /** #RRGGBB hex of the most dominant color cluster */
  primaryColorHex: string;
  /** Vision's pixelFraction for the primary color (0–1) */
  primaryColorScore: number;
  secondaryColorFamily: string | null;
  secondaryColorHex: string | null;
  secondaryColorScore: number | null;
  audienceTag: 'MEN' | 'WOMEN' | 'UNISEX';
  audienceConfidence: number;
  /**
   * Broad skin-tone group detected from the customer image.
   * Derived from Vision IMAGE_PROPERTIES: colors in skin-tone HSL range
   * (h 0–45°, s 8–60%, l 25–82%) are extracted and classified by lightness.
   * null when no skin-tone color cluster is detectable (e.g. clothing-only image).
   * Only populated when source === 'vision_api'.
   */
  skinToneGroup: 'light' | 'medium' | 'dark' | null;
  /** Raw Vision labels for transparency — shown in review UI if desired */
  rawLabels: Array<{ label: string; confidence: number }>;
  source: 'vision_api' | 'manual_fallback';
}

// ─── Internal Vision API types ────────────────────────────────────────────────

interface VisionColorEntry {
  color: { red?: number; green?: number; blue?: number };
  score: number;
  pixelFraction: number;
}

interface VisionLabelEntry {
  description: string;
  score: number;
  topicality: number;
}

interface VisionApiResponse {
  responses: Array<{
    labelAnnotations?: VisionLabelEntry[];
    imagePropertiesAnnotation?: {
      dominantColors: {
        colors: VisionColorEntry[];
      };
    };
    error?: { code: number; message: string };
  }>;
}

// ─── Category mapping table ───────────────────────────────────────────────────

/**
 * Each entry: [matchTerms, categoryPreset, baseConfidence]
 *
 * Matched against Vision label descriptions (lowercased).
 * Entries are checked in order — first match wins.
 *
 * Iraqi-specific garments are listed but Vision will rarely produce them.
 * If none match, categoryPreset is null — user must select manually.
 */
const LABEL_TO_CATEGORY: Array<[string[], string, number]> = [
  [['abaya'], 'abayas', 0.90],
  [['embroidered abaya', 'embroidered'], 'abayas_embroidered', 0.85],
  [['dishdasha', 'thawb', 'thobe', 'kandura'], 'dishdashes', 0.90],
  [['jalabiya', 'jalabiyya', 'kaftan', 'robe'], 'galabiyas', 0.82],
  [['gown', 'dress', 'frock', 'skirt'], 'dresses', 0.85],
  [['suit', 'tuxedo', 'blazer', 'formal wear', 'overcoat', 'trench coat'], 'formal', 0.80],
  [
    ['shirt', 't-shirt', 'blouse', 'top', 'sweater', 'hoodie', 'jeans',
     'trouser', 'pants', 'shorts', 'jacket', 'coat', 'casual'],
    'casual',
    0.78,
  ],
  [
    ['bag', 'handbag', 'purse', 'clutch', 'accessory', 'accessories',
     'jewelry', 'jewellery', 'scarf', 'belt', 'hat', 'cap', 'shoe',
     'shoes', 'sandal', 'boot', 'watch'],
    'accessories',
    0.80,
  ],
];

// ─── Audience signals ─────────────────────────────────────────────────────────

const WOMEN_SIGNALS = [
  'women', "women's", 'female', 'feminine', 'ladies', 'dress', 'gown',
  'blouse', 'abaya', 'skirt', 'bra', 'lingerie',
];
const MEN_SIGNALS = [
  'men', "men's", 'male', 'masculine', 'suit', 'tie', 'dishdasha',
  'thawb', 'thobe', 'beard',
];

// ─── Color helpers ────────────────────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) => {
        const hex = Math.round(Math.max(0, Math.min(255, c))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h = (h / 6) * 360;
  }

  return { h, s: s * 100, l: l * 100 };
}

/**
 * Map an RGB pixel color to the nearest ColorFamily enum value.
 * ColorFamily values (from mobile types): black, navy, burgundy, brown,
 * gold, silver, red, green, blue, white, cream, multi.
 */
function rgbToColorFamily(r: number, g: number, b: number): string {
  const { h, s, l } = rgbToHsl(r, g, b);

  // Achromatic checks first (lightness-based)
  if (l < 12) return 'black';
  if (l > 88 && s < 15) return 'white';
  if (s < 12 && l >= 50 && l <= 80) return 'silver';
  if (l < 30 && s < 20) return 'black'; // dark grey → black

  // Chromatic checks ordered by specificity
  if (h >= 30 && h <= 62 && s < 40 && l > 76) return 'cream';
  if (h >= 210 && h <= 248 && l < 32 && s > 35) return 'navy';
  if ((h <= 22 || h >= 338) && s > 35 && l >= 12 && l <= 42) return 'burgundy';
  if (h >= 12 && h <= 48 && s >= 25 && l >= 18 && l <= 58) return 'brown';
  if (h >= 36 && h <= 62 && s > 55 && l >= 32 && l <= 72) return 'gold';
  if ((h <= 14 || h >= 348) && s > 45 && l > 32) return 'red';
  if (h >= 88 && h <= 168 && s > 22) return 'green';
  if (h >= 182 && h <= 262 && s > 22) return 'blue';

  return 'multi';
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  /**
   * Classify a clothing image using Google Cloud Vision API.
   *
   * @param imageBuffer - Raw image bytes (JPEG / PNG / WebP)
   * @returns Classification result with real Vision API data, or a
   *          manual_fallback result if the API key is not configured.
   */
  async classify(imageBuffer: Buffer): Promise<VisionClassificationResult> {
    const apiKey = process.env.GOOGLE_VISION_API_KEY;

    if (!apiKey) {
      this.logger.warn(
        'GOOGLE_VISION_API_KEY is not set — returning manual_fallback. ' +
        'Set the key in backend/.env to enable real classification.',
      );
      return this.buildManualFallback();
    }

    const imageBase64 = imageBuffer.toString('base64');
    const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    let visionData: VisionApiResponse;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [
                { type: 'LABEL_DETECTION', maxResults: 20 },
                { type: 'IMAGE_PROPERTIES' },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        this.logger.error(`Vision API HTTP ${response.status}: ${await response.text()}`);
        return this.buildManualFallback();
      }

      visionData = (await response.json()) as VisionApiResponse;
    } catch (err) {
      this.logger.error('Vision API network error:', err);
      return this.buildManualFallback();
    }

    const result = visionData.responses[0];
    if (!result) {
      this.logger.error('Vision API returned empty responses array');
      return this.buildManualFallback();
    }
    if (result.error) {
      this.logger.error(`Vision API error ${result.error.code}: ${result.error.message}`);
      return this.buildManualFallback();
    }

    return this.parseVisionResult(result);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private parseVisionResult(
    result: VisionApiResponse['responses'][0],
  ): VisionClassificationResult {
    // ── Labels ────────────────────────────────────────────────────────────────
    const labels: VisionLabelEntry[] = result.labelAnnotations || [];
    const rawLabels = labels.map((l) => ({
      label: l.description,
      confidence: Math.round(l.score * 1000) / 1000,
    }));

    // ── Category ──────────────────────────────────────────────────────────────
    let categoryPreset: string | null = null;
    let categoryConfidence: number | null = null;

    outer: for (const label of labels) {
      const lower = label.description.toLowerCase();
      for (const [terms, preset, baseConf] of LABEL_TO_CATEGORY) {
        if (terms.some((t) => lower.includes(t))) {
          categoryPreset = preset;
          // Real confidence = Vision's score × base mapping confidence
          categoryConfidence = Math.round(label.score * baseConf * 100) / 100;
          break outer;
        }
      }
    }

    // ── Audience ──────────────────────────────────────────────────────────────
    const allLabelsStr = labels.map((l) => l.description.toLowerCase()).join(' ');
    const womenHits = WOMEN_SIGNALS.filter((s) => allLabelsStr.includes(s)).length;
    const menHits = MEN_SIGNALS.filter((s) => allLabelsStr.includes(s)).length;

    let audienceTag: 'MEN' | 'WOMEN' | 'UNISEX' = 'UNISEX';
    let audienceConfidence = 0.50;

    if (womenHits > menHits) {
      audienceTag = 'WOMEN';
      audienceConfidence = Math.min(0.50 + womenHits * 0.10, 0.92);
    } else if (menHits > womenHits) {
      audienceTag = 'MEN';
      audienceConfidence = Math.min(0.50 + menHits * 0.10, 0.92);
    }

    // ── Colors ────────────────────────────────────────────────────────────────
    const colorEntries: VisionColorEntry[] =
      result.imagePropertiesAnnotation?.dominantColors?.colors || [];

    // Sort by pixelFraction (actual coverage in the image)
    const sorted = [...colorEntries].sort((a, b) => b.pixelFraction - a.pixelFraction);

    const primary = sorted[0];
    const pr = primary?.color?.red ?? 0;
    const pg = primary?.color?.green ?? 0;
    const pb = primary?.color?.blue ?? 0;

    const primaryColorFamily = rgbToColorFamily(pr, pg, pb);
    const primaryColorHex = rgbToHex(pr, pg, pb);
    const primaryColorScore = primary?.pixelFraction ?? 0;

    let secondaryColorFamily: string | null = null;
    let secondaryColorHex: string | null = null;
    let secondaryColorScore: number | null = null;

    // Only use secondary if it covers ≥10% of pixels and differs from primary family
    if (sorted.length > 1) {
      const secondary = sorted[1];
      if (secondary.pixelFraction >= 0.10) {
        const sr = secondary.color?.red ?? 0;
        const sg = secondary.color?.green ?? 0;
        const sb = secondary.color?.blue ?? 0;
        const secFamily = rgbToColorFamily(sr, sg, sb);
        if (secFamily !== primaryColorFamily) {
          secondaryColorFamily = secFamily;
          secondaryColorHex = rgbToHex(sr, sg, sb);
          secondaryColorScore = secondary.pixelFraction;
        }
      }
    }

    const skinToneGroup = this.extractSkinToneGroup(colorEntries);

    return {
      categoryPreset,
      categoryConfidence,
      primaryColorFamily,
      primaryColorHex,
      primaryColorScore: Math.round(primaryColorScore * 1000) / 1000,
      secondaryColorFamily,
      secondaryColorHex,
      secondaryColorScore: secondaryColorScore != null
        ? Math.round(secondaryColorScore * 1000) / 1000
        : null,
      audienceTag,
      audienceConfidence: Math.round(audienceConfidence * 100) / 100,
      skinToneGroup,
      rawLabels,
      source: 'vision_api',
    };
  }

  /**
   * Detect broad skin-tone group from Vision dominant colors.
   *
   * Skin-tone pixels occupy a narrow HSL range:
   *   hue 0–45° (reds/oranges/yellows), saturation 8–60%, lightness 25–82%.
   *
   * The most-covering color in this range is classified:
   *   light  → l > 62
   *   medium → l 40–62
   *   dark   → l < 40
   *
   * Returns null if no skin-tone cluster is found (e.g. clothing-only image).
   */
  private extractSkinToneGroup(
    colors: VisionColorEntry[],
  ): 'light' | 'medium' | 'dark' | null {
    const skinToneColors = colors
      .filter((entry) => {
        const r = entry.color?.red ?? 0;
        const g = entry.color?.green ?? 0;
        const b = entry.color?.blue ?? 0;
        const { h, s, l } = rgbToHsl(r, g, b);
        // Skin-tone HSL range: warm hues, moderate saturation, mid lightness
        return h >= 0 && h <= 45 && s >= 8 && s <= 60 && l >= 25 && l <= 82;
      })
      .sort((a, b) => b.pixelFraction - a.pixelFraction);

    if (skinToneColors.length === 0) return null;

    // Require at least 3% pixel coverage to avoid noise
    if (skinToneColors[0].pixelFraction < 0.03) return null;

    const dominant = skinToneColors[0];
    const r = dominant.color?.red ?? 0;
    const g = dominant.color?.green ?? 0;
    const b = dominant.color?.blue ?? 0;
    const { l } = rgbToHsl(r, g, b);

    if (l > 62) return 'light';
    if (l >= 40) return 'medium';
    return 'dark';
  }

  private buildManualFallback(): VisionClassificationResult {
    return {
      categoryPreset: null,
      categoryConfidence: null,
      primaryColorFamily: 'multi',
      primaryColorHex: '#808080',
      primaryColorScore: 0,
      secondaryColorFamily: null,
      secondaryColorHex: null,
      secondaryColorScore: null,
      audienceTag: 'UNISEX',
      audienceConfidence: 0,
      skinToneGroup: null,
      rawLabels: [],
      source: 'manual_fallback',
    };
  }
}
