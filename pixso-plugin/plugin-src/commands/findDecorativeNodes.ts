import { resolvePage } from './resolvePage.js';
import { clamp, numericSize, readProp } from '../utils/nodeProps.js';

export interface FindDecorativeNodesInput {
  page?: string;
  maxNodeSizePx?: number;
  minNodeSizePx?: number;
  maxCandidates?: number;
  maxVisited?: number;
}

export interface DecorativeGroup {
  name: string;
  type: string;
  width: number;
  height: number;
  reasons: string[];
  count: number;
  ids: string[];
  emoji?: string;
}

const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u;
const NAME_HINT_PATTERN = /\b(icon|emoji|logo|badge|svg)\b|图标|表情|标志(?!物)/i;
const SMALL_GRAPHIC_TYPES = new Set(['INSTANCE', 'COMPONENT', 'VECTOR', 'BOOLEAN_OPERATION', 'GROUP']);

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

function groupKey(node: SceneNodeLike, width: number, height: number, reasons: string[], emoji?: string): string {
  const round = (value: number) => Math.round(value * 100) / 100;
  return `${node.type}|${node.name}|${round(width)}x${round(height)}|${reasons.join(',')}|${emoji ?? ''}`;
}

function scaleProposal(sizes: number[]): Record<string, unknown> {
  const sorted = sizes.slice().sort((a, b) => a - b);
  const medianSizePx = sorted.length > 0 ? sorted[Math.floor((sorted.length - 1) / 2)] ?? 24 : 24;

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
  const candidateCap = clamp(input.maxCandidates ?? 500, 1, 2000);
  const visitedCap = clamp(input.maxVisited ?? 8000, 1, 20000);

  const groups = new Map<string, DecorativeGroup>();
  const measuredSizes: number[] = [];
  let visited = 0;
  let collected = 0;
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
      if (collected < candidateCap) {
        const width = numericSize(readProp(node, 'width')) ?? 0;
        const height = numericSize(readProp(node, 'height')) ?? 0;
        collected += 1;
        measuredSizes.push(Math.max(width, height));
        const key = groupKey(node, width, height, reasons, emoji);
        const group = groups.get(key);
        if (group) {
          group.count += 1;
          group.ids.push(node.id);
        } else {
          groups.set(key, {
            name: node.name,
            type: node.type,
            width,
            height,
            reasons,
            count: 1,
            ids: [node.id],
            ...(emoji ? { emoji } : {})
          });
        }
      } else {
        truncatedCandidates = true;
      }
      continue;
    }

    for (const child of (readProp(node, 'children') as SceneNodeLike[] | undefined) ?? []) {
      queue.push(child);
    }
  }

  const sortedGroups = [...groups.values()].sort(
    (a, b) =>
      b.count - a.count ||
      a.type.localeCompare(b.type) ||
      a.name.localeCompare(b.name) ||
      a.ids[0]!.localeCompare(b.ids[0]!)
  );

  return {
    file: { name: pixso.root.name },
    page: { id: page.id, name: page.name },
    visited,
    truncatedVisited,
    groups: sortedGroups,
    candidateCount: collected,
    truncatedCandidates,
    scaleProposal: scaleProposal(measuredSizes)
  };
}
