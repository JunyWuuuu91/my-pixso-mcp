export interface GetDocumentInput {
  maxTopFrames?: number;
}

interface TopFrameSummary {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
}

interface PageSummary {
  id: string;
  name: string;
  isCurrent: boolean;
  topFrameCount: number;
  topFrames: TopFrameSummary[];
  truncated: boolean;
}

export async function getDocument(input: GetDocumentInput): Promise<Record<string, unknown>> {
  const requested = input.maxTopFrames ?? 100;
  const maxTopFrames = Math.min(Math.max(Math.round(requested) || 100, 1), 500);

  const root = pixso.root;
  if (!root) {
    throw new Error('No active Pixso document. Open a design file first.');
  }

  const currentPageId = pixso.currentPage?.id;
  const pages: PageSummary[] = (root.children ?? []).map(page => {
    const children = page.children ?? [];
    return {
      id: page.id,
      name: page.name,
      isCurrent: page.id === currentPageId,
      topFrameCount: children.length,
      topFrames: children.slice(0, maxTopFrames).map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        width: Math.round(node.width ?? 0),
        height: Math.round(node.height ?? 0)
      })),
      truncated: children.length > maxTopFrames
    };
  });

  return {
    file: {
      id: root.id,
      name: root.name,
      pageCount: pages.length
    },
    currentPageId,
    pages
  };
}
