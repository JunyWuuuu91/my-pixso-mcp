export function readProp(node: unknown, prop: string): unknown {
  if (node === null || node === undefined) return undefined;
  try {
    return (node as Record<string, unknown>)[prop];
  } catch {
    return undefined;
  }
}

export function numericSize(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function describeKind(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value;
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
