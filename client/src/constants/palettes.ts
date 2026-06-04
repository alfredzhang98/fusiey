import { Color } from '../types';
import { hexToRgb, rgbToLab } from '../services/beadEngineV2/colorSpace';

/**
 * Fusiey bead palettes — 2.6mm mini beads
 * Hex values from official MARD colour chart (221色电子色号)
 *
 * Semantic markers (isSkin/isGrey/isInk/isDark) are applied programmatically
 * at the bottom so Gemini-free pipelines (Engine T) can still gate candidates
 * per cell. Declared on IDs rather than brittle hex ranges — if a hex changes,
 * the marker follows the id.
 */

// ── semantic ID lists (keep in sync with MARD-221 spec) ──────────────
// isGrey excludes H1 (pure white) and H2 (#FBFBFB, effectively white) — grey
// removal should not touch highlight-level whites.
const SKIN_IDS = new Set(['E2', 'E8', 'G1', 'G9', 'A11', 'A13']);
const GREY_IDS = new Set(['H3', 'H4', 'H5']);
const INK_IDS  = new Set(['H5', 'H7']);

function applyMarkers(colors: Color[]): Color[] {
  return colors.map((c) => {
    const L = rgbToLab(hexToRgb(c.hex))[0]; // perceptual lightness
    return {
      ...c,
      isSkin: SKIN_IDS.has(c.id),
      isGrey: GREY_IDS.has(c.id),
      isInk:  INK_IDS.has(c.id),
      isDark: L < 40,
    };
  });
}

// 24-colour base set
const PALETTE_24_RAW: Color[] = [
  { id: 'A4',  name: 'Yellow',       hex: '#F7EC5C', code: 'A4',  brand: 'Fusiey' },
  { id: 'A6',  name: 'Orange',       hex: '#FDA951', code: 'A6',  brand: 'Fusiey' },
  { id: 'A7',  name: 'Dark Orange',  hex: '#FA8C4F', code: 'A7',  brand: 'Fusiey' },
  { id: 'B3',  name: 'Light Green',  hex: '#A1F586', code: 'B3',  brand: 'Fusiey' },
  { id: 'B5',  name: 'Green',        hex: '#39E158', code: 'B5',  brand: 'Fusiey' },
  { id: 'B8',  name: 'Dark Green',   hex: '#1D9B54', code: 'B8',  brand: 'Fusiey' },
  { id: 'C3',  name: 'Cyan',         hex: '#1AE0F7', code: 'C3',  brand: 'Fusiey' },
  { id: 'C5',  name: 'Blue',         hex: '#06AADF', code: 'C5',  brand: 'Fusiey' },
  { id: 'C8',  name: 'Dark Blue',    hex: '#0F52BD', code: 'C8',  brand: 'Fusiey' },
  { id: 'D6',  name: 'Lavender',     hex: '#B37BDC', code: 'D6',  brand: 'Fusiey' },
  { id: 'D7',  name: 'Purple',       hex: '#8758A9', code: 'D7',  brand: 'Fusiey' },
  { id: 'D9',  name: 'Light Violet', hex: '#D5B9F4', code: 'D9',  brand: 'Fusiey' },
  { id: 'E2',  name: 'Light Pink',   hex: '#FCC1DD', code: 'E2',  brand: 'Fusiey' },
  { id: 'E4',  name: 'Pink',         hex: '#E8649E', code: 'E4',  brand: 'Fusiey' },
  { id: 'F5',  name: 'Red',          hex: '#E10328', code: 'F5',  brand: 'Fusiey' },
  { id: 'G1',  name: 'Cream',        hex: '#FFE4D3', code: 'G1',  brand: 'Fusiey' },
  { id: 'G5',  name: 'Gold',         hex: '#E7B34E', code: 'G5',  brand: 'Fusiey' },
  { id: 'G7',  name: 'Brown',        hex: '#985C3A', code: 'G7',  brand: 'Fusiey' },
  { id: 'H1',  name: 'White',        hex: '#FFFFFF', code: 'H1',  brand: 'Fusiey' },
  { id: 'H2',  name: 'Off White',    hex: '#FBFBFB', code: 'H2',  brand: 'Fusiey' },
  { id: 'H3',  name: 'Light Grey',   hex: '#B4B4B4', code: 'H3',  brand: 'Fusiey' },
  { id: 'H4',  name: 'Grey',         hex: '#878787', code: 'H4',  brand: 'Fusiey' },
  { id: 'H5',  name: 'Dark Grey',    hex: '#464648', code: 'H5',  brand: 'Fusiey' },
  { id: 'H7',  name: 'Black',        hex: '#010101', code: 'H7',  brand: 'Fusiey' },
];

// 48-colour extended set (24 base + 24 extra)
const PALETTE_48_RAW: Color[] = [
  // A — Yellow / Orange
  { id: 'A4',  name: 'Yellow',       hex: '#F7EC5C', code: 'A4',  brand: 'Fusiey' },
  { id: 'A6',  name: 'Orange',       hex: '#FDA951', code: 'A6',  brand: 'Fusiey' },
  { id: 'A7',  name: 'Dark Orange',  hex: '#FA8C4F', code: 'A7',  brand: 'Fusiey' },
  { id: 'A10', name: 'Tangerine',    hex: '#F47E38', code: 'A10', brand: 'Fusiey' },
  { id: 'A11', name: 'Peach Yellow', hex: '#FEDB99', code: 'A11', brand: 'Fusiey' },
  { id: 'A13', name: 'Apricot',      hex: '#FEC667', code: 'A13', brand: 'Fusiey' },
  // B — Green
  { id: 'B3',  name: 'Light Green',  hex: '#A1F586', code: 'B3',  brand: 'Fusiey' },
  { id: 'B5',  name: 'Green',        hex: '#39E158', code: 'B5',  brand: 'Fusiey' },
  { id: 'B8',  name: 'Dark Green',   hex: '#1D9B54', code: 'B8',  brand: 'Fusiey' },
  { id: 'B12', name: 'Forest Green', hex: '#1A6E3D', code: 'B12', brand: 'Fusiey' },
  // C — Cyan / Blue
  { id: 'C2',  name: 'Pale Cyan',    hex: '#ABF8FE', code: 'C2',  brand: 'Fusiey' },
  { id: 'C3',  name: 'Cyan',         hex: '#1AE0F7', code: 'C3',  brand: 'Fusiey' },
  { id: 'C5',  name: 'Blue',         hex: '#06AADF', code: 'C5',  brand: 'Fusiey' },
  { id: 'C6',  name: 'Sky Blue',     hex: '#54A7E9', code: 'C6',  brand: 'Fusiey' },
  { id: 'C7',  name: 'Royal Blue',   hex: '#3977CA', code: 'C7',  brand: 'Fusiey' },
  { id: 'C8',  name: 'Dark Blue',    hex: '#0F52BD', code: 'C8',  brand: 'Fusiey' },
  { id: 'C10', name: 'Ocean Blue',   hex: '#3CBCE3', code: 'C10', brand: 'Fusiey' },
  { id: 'C11', name: 'Turquoise',    hex: '#2ADED3', code: 'C11', brand: 'Fusiey' },
  { id: 'C13', name: 'Ice Blue',     hex: '#CDE7FE', code: 'C13', brand: 'Fusiey' },
  // D — Purple / Violet
  { id: 'D3',  name: 'Navy',         hex: '#3554AF', code: 'D3',  brand: 'Fusiey' },
  { id: 'D6',  name: 'Lavender',     hex: '#B37BDC', code: 'D6',  brand: 'Fusiey' },
  { id: 'D7',  name: 'Purple',       hex: '#8758A9', code: 'D7',  brand: 'Fusiey' },
  { id: 'D9',  name: 'Light Violet', hex: '#D5B9F4', code: 'D9',  brand: 'Fusiey' },
  { id: 'D13', name: 'Magenta',      hex: '#B5038D', code: 'D13', brand: 'Fusiey' },
  { id: 'D15', name: 'Indigo',       hex: '#2F1F8C', code: 'D15', brand: 'Fusiey' },
  { id: 'D18', name: 'Orchid',       hex: '#9A64B8', code: 'D18', brand: 'Fusiey' },
  { id: 'D19', name: 'Lilac',        hex: '#D8C2D9', code: 'D19', brand: 'Fusiey' },
  { id: 'D21', name: 'Violet',       hex: '#940595', code: 'D21', brand: 'Fusiey' },
  // E — Pink
  { id: 'E2',  name: 'Light Pink',   hex: '#FCC1DD', code: 'E2',  brand: 'Fusiey' },
  { id: 'E3',  name: 'Orchid Pink',  hex: '#F6BDE8', code: 'E3',  brand: 'Fusiey' },
  { id: 'E4',  name: 'Pink',         hex: '#E8649E', code: 'E4',  brand: 'Fusiey' },
  { id: 'E7',  name: 'Hot Pink',     hex: '#C53674', code: 'E7',  brand: 'Fusiey' },
  { id: 'E8',  name: 'Soft Pink',    hex: '#FDDBE9', code: 'E8',  brand: 'Fusiey' },
  // F — Red
  { id: 'F5',  name: 'Red',          hex: '#E10328', code: 'F5',  brand: 'Fusiey' },
  { id: 'F8',  name: 'Dark Red',     hex: '#BB0126', code: 'F8',  brand: 'Fusiey' },
  { id: 'F13', name: 'Coral',        hex: '#F45C45', code: 'F13', brand: 'Fusiey' },
  // G — Beige / Brown
  { id: 'G1',  name: 'Cream',        hex: '#FFE4D3', code: 'G1',  brand: 'Fusiey' },
  { id: 'G5',  name: 'Gold',         hex: '#E7B34E', code: 'G5',  brand: 'Fusiey' },
  { id: 'G7',  name: 'Brown',        hex: '#985C3A', code: 'G7',  brand: 'Fusiey' },
  { id: 'G8',  name: 'Dark Brown',   hex: '#713D2F', code: 'G8',  brand: 'Fusiey' },
  { id: 'G9',  name: 'Sand',         hex: '#E4B685', code: 'G9',  brand: 'Fusiey' },
  { id: 'G13', name: 'Chestnut',     hex: '#B2714B', code: 'G13', brand: 'Fusiey' },
  // H — Grey scale
  { id: 'H1',  name: 'White',        hex: '#FFFFFF', code: 'H1',  brand: 'Fusiey' },
  { id: 'H2',  name: 'Off White',    hex: '#FBFBFB', code: 'H2',  brand: 'Fusiey' },
  { id: 'H3',  name: 'Light Grey',   hex: '#B4B4B4', code: 'H3',  brand: 'Fusiey' },
  { id: 'H4',  name: 'Grey',         hex: '#878787', code: 'H4',  brand: 'Fusiey' },
  { id: 'H5',  name: 'Dark Grey',    hex: '#464648', code: 'H5',  brand: 'Fusiey' },
  { id: 'H7',  name: 'Black',        hex: '#010101', code: 'H7',  brand: 'Fusiey' },
];

// ── decorated exports (markers applied) ──────────────────────────────
export const PALETTE_24: Color[] = applyMarkers(PALETTE_24_RAW);
export const PALETTE_48: Color[] = applyMarkers(PALETTE_48_RAW);

export const PALETTES = [
  { id: 'fusiey-24', name: 'Fusiey 24 Colours (2.6mm)', colors: PALETTE_24 },
  { id: 'fusiey-48', name: 'Fusiey 48 Colours (2.6mm)', colors: PALETTE_48 },
];
