import { resolvePage } from './resolvePage.js';

export interface FindDecorativeNodesInput {
  page?: string;
  maxNodeSizePx?: number;
  minNodeSizePx?: number;
  maxCandidates?: number;
  maxVisited?: number;
}

export interface DecorativeCandidate {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  reasons: string[];
  emoji?: string;
}

const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u;
const NAME_HINT_PATTERN = /icon|emoji|logo|badge|图标|表情|标志/i;
const SMALL_GRAPHIC_TYPES = new Set(['INSTANCE', 'COMPONENT', 'VECTOR', 'BOOLEAN_OPERATION', 'GROUP']);

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function readProp(node: SceneNodeLike, prop: string): unknown {
  try {
    return (node as unknown as Record<string, unknown>)[prop];
  } catch {
    return undefined;
  }
}

function numericSize(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function classify(
  node: SceneNodeLike,
  minNodeSizePx: number,
  maxNodeSizePx: number
): { reasons: string[]; emoji?: string } {
  const reasons: string[] = [];
  let emoji: string | undefined;

  const characters = readProp(node, 'characters');
  if (node.type === 'TEXT' && typeof characters === 'string') {
    const trimmed = characters.trim();
    if (trimmed.length > 0 && trimmed.length <= 8) {
      const match = trimmed.match(EMOJI_PATTERN);
      if (match) {
        reasons.push('emoji-text');
        emoji = match[0];
      }
    }
  }

  const width = numericSize(readProp(node, 'width'));
  const height = numericSize(readProp(node, 'height'));
  const largestEdge = width !== undefined && height !== undefined ? Math.max(width, height) : undefined;
  if (
    SMALL_GRAPHIC_TYPES.has(node.type) &&
    largestEdge !== undefined &&
    largestEdge >= minNodeSizePx &&
    largestEdge <= maxNodeSizePx &&
    largestEdge / Math.max(Math.min(width as number, height as number), 1) <= 2
  ) {
    reasons.push('small-graphic');
  }

  const exportSettings = readProp(node, 'exportSettings');
  if (Array.isArray(exportSettings) && exportSettings.length > 0) {
    reasons.push('export-setting');
  }

  if (NAME_HINT_PATTERN.test(node.name ?? '')) {
    reasons.push('name-hint');
  }

  return { reasons, emoji };
}

function scaleProposal(candidates: DecorativeCandidate[]): Record<string, unknown> {
  const sizes = candidates
    .map(candidate => Math.max(candidate.width || 0, candidate.height || 0))
    .sort((a, b) => a - b);
  const medianSizePx = sizes.length > 0 ? sizes[Math.floor((sizes.length - 1) / 2)] ?? 24 : 24;

  let recommended = 1;
  let bestDistance = Number.POSITIVE_INFINITY;
  const options = [1, 2, 3].map(scale => {
    const typicalPx = Math.round(medianSizePx * scale);
    const distance = Math.abs(typicalPx - 128);
    if (distance < bestDistance) {
      bestDistance = distance;
      recommended = scale;
    }
    return { scale, typicalPx };
  });

  return {
    medianSizePx,
    recommended,
    options,
    rationale: `Median candidate edge is ${medianSizePx}px; at ${recommended}x a typical export is about ${Math.round(
      medianSizePx * recommended
    )}px.`
  };
}

export async function findDecorativeNodes(input: FindDecorativeNodesInput = {}): Promise<Record<string, unknown>> {
  if (!pixso.root) throw new Error('No document root available.');

  const page = resolvePage(input.page);
  const maxNodeSizePx = clamp(input.maxNodeSizePx ?? 96, 16, 512);
  const minNodeSizePx = clamp(input.minNodeSizePx ?? 8, 1, 64);
  const candidateCap = clamp(input.maxCandidates ?? 200, 1, 500);
  const visitedCap = clamp(input.maxVisited ?? 4000, 1, 20000);

  const candidates: DecorativeCandidate[] = [];
  let visited = 0;
  let truncatedVisited = false;
  let truncatedCandidates = false;

  const queue: SceneNodeLike[] = [...page.children];
  let cursor = 0;

  while (cursor < queue.length) {
    if (visited >= visitedCap) {
      truncatedVisited = true;
      break;
    }
    const node = queue[cursor] as SceneNodeLike;
    cursor += 1;
    visited += 1;

    if (readProp(node, 'visible') === false) continue;

    const { reasons, emoji } = classify(node, minNodeSizePx, maxNodeSizePx);
    if (reasons.length > 0) {
      if (candidates.length < candidateCap) {
        candidates.push({
          id: node.id,
          name: node.name,
          type: node.type,
          width: numericSize(readProp(node, 'width')) ?? 0,
          height: numericSize(readProp(node, 'height')) ?? 0,
          reasons,
          ...(emoji ? { emoji } : {})
        });
      } else {
        truncatedCandidates = true;
      }
      continue;
    }

    for (const child of (readProp(node, 'children') as SceneNodeLike[] | undefined) ?? []) {
      queue.push(child);
    }
  }

  return {
    file: { name: pixso.root.name },
    page: { id: page.id, name: page.name },
    visited,
    truncatedVisited,
    candidates,
    candidateCount: candidates.length,
    truncatedCandidates,
    scaleProposal: scaleProposal(candidates)
  };
}
