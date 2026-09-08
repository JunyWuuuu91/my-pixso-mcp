/**
 * Compact value serializers shared by plugin commands (read_nodes, probe_api).
 * Pure functions over plain data — no `pixso` global — so they are unit-testable.
 */

const MAX_TEXT_LENGTH = 120;

interface RgbaLike {
  r: number;
  g: number;
  b: number;
  a?: number;
}

function channel(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(255, Math.max(0, Math.round(n * 255)));
}

/** {r,g,b} → #RRGGBB; {r,g,b,a} → #RRGGBBAA (alpha byte appended only when 0 < a < 1). */
export function toHexColor(color: unknown): string | undefined {
  if (!color || typeof color !== 'object') return undefined;
  const rgba = color as RgbaLike;
  const hex = `#${[rgba.r, rgba.g, rgba.b].map(c => channel(c).toString(16).padStart(2, '0')).join('')}`;
  const alpha = typeof rgba.a === 'number' ? rgba.a : 1;
  if (alpha < 1) {
    return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
  }
  return hex;
}

export function round(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : undefined;
}

export function truncateText(value: unknown, max = MAX_TEXT_LENGTH): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

interface GradientStopLike {
  position?: number;
  color?: RgbaLike;
}

interface PaintLike {
  type?: string;
  visible?: boolean;
  opacity?: number;
  color?: RgbaLike;
  gradientStops?: GradientStopLike[];
  gradientHandlePositions?: unknown;
}

/** Paint → {type, color?, opacity?, stops?}; invisible paints are dropped. */
export function serializePaint(paint: PaintLike | undefined | null): Record<string, unknown> | undefined {
  if (!paint || typeof paint !== 'object') return undefined;
  if (paint.visible === false) return undefined;
  const out: Record<string, unknown> = { type: paint.type ?? 'SOLID' };
  const hex = toHexColor(paint.color);
  if (hex) out.color = hex;
  const opacity = round(paint.opacity);
  if (opacity !== undefined && opacity !== 1) out.opacity = opacity;
  if (Array.isArray(paint.gradientStops) && paint.gradientStops.length) {
    out.stops = paint.gradientStops.map(stop => ({
      position: round(stop?.position) ?? 0,
      color: toHexColor(stop?.color) ?? '#000000'
    }));
  }
  return out;
}

export function serializePaints(fills: unknown): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(fills) || fills.length === 0) return undefined;
  const serialized = fills.map(paint => serializePaint(paint as PaintLike)).filter(Boolean) as Array<
    Record<string, unknown>
  >;
  return serialized.length ? serialized : undefined;
}

interface EffectLike {
  type?: string;
  visible?: boolean;
  offset?: { x?: number; y?: number };
  radius?: number;
  spread?: number;
  color?: RgbaLike;
}

/** Effect → {type, offset:[x,y], radius, color}; invisible effects are dropped. */
export function serializeEffect(effect: EffectLike | undefined | null): Record<string, unknown> | undefined {
  if (!effect || typeof effect !== 'object') return undefined;
  if (effect.visible === false) return undefined;
  const out: Record<string, unknown> = { type: effect.type ?? 'DROP_SHADOW' };
  const x = round(effect.offset?.x) ?? 0;
  const y = round(effect.offset?.y) ?? 0;
  out.offset = [x, y];
  const radius = round(effect.radius);
  if (radius !== undefined) out.radius = radius;
  const spread = round(effect.spread);
  if (spread !== undefined && spread !== 0) out.spread = spread;
  const hex = toHexColor(effect.color);
  if (hex) out.color = hex;
  return out;
}

export function serializeEffects(effects: unknown): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(effects) || effects.length === 0) return undefined;
  const serialized = effects.map(effect => serializeEffect(effect as EffectLike)).filter(Boolean) as Array<
    Record<string, unknown>
  >;
  return serialized.length ? serialized : undefined;
}

/**
 * Radius → number when all four corners match, otherwise a per-corner record
 * {tl, tr, bl, br} with only the values that differ from the first corner.
 */
export function serializeRadius(
  cornerRadius: unknown,
  topLeft?: unknown,
  topRight?: unknown,
  bottomLeft?: unknown,
  bottomRight?: unknown
): number | Record<string, number> | undefined {
  const single = round(cornerRadius);
  const tl = round(topLeft);
  const tr = round(topRight);
  const bl = round(bottomLeft);
  const br = round(bottomRight);
  const corners = [tl, tr, bl, br];
  if (corners.every(c => c === undefined)) return single;
  if (corners.every(c => c !== undefined && c === corners[0])) return corners[0];
  // Not uniform: return a self-contained per-corner record (base radius fills
  // in corners the node itself does not specify individually).
  const out: Record<string, number> = {};
  const assign = (key: string, value: number | undefined) => {
    const resolved = value ?? single;
    if (resolved !== undefined) out[key] = resolved;
  };
  assign('tl', tl);
  assign('tr', tr);
  assign('bl', bl);
  assign('br', br);
  return Object.keys(out).length ? out : single;
}

/** Padding → number when all sides match, otherwise {t, r, b, l}. */
export function serializePadding(top?: unknown, right?: unknown, bottom?: unknown, left?: unknown):
  | number
  | Record<string, number>
  | undefined {
  const t = round(top);
  const r = round(right);
  const b = round(bottom);
  const l = round(left);
  if (t === undefined && r === undefined && b === undefined && l === undefined) return undefined;
  if (t === r && r === b && b === l && t !== undefined) return t;
  const out: Record<string, number> = {};
  if (t !== undefined) out.t = t;
  if (r !== undefined) out.r = r;
  if (b !== undefined) out.b = b;
  if (l !== undefined) out.l = l;
  return out;
}
