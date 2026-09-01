export interface ResolvedPage {
  id: string;
  name: string;
  children: readonly SceneNodeLike[];
}

function pages(): readonly PageNodeLike[] {
  return pixso.root?.children ?? [];
}

export function listPageNames(): string {
  const names = pages().map(page => `"${page.name}"`);
  return names.length > 0 ? names.join(', ') : '(no pages)';
}

export function resolvePage(page?: string): ResolvedPage {
  const candidates = pages();
  let match: PageNodeLike | undefined;

  if (page === undefined || page === '') {
    match = pixso.currentPage ?? candidates[0];
  } else {
    match =
      candidates.find(entry => entry.id === page) ??
      candidates.find(entry => entry.name === page) ??
      candidates.find(entry => entry.name.toLowerCase().includes(page.toLowerCase()));
  }

  if (!match) {
    throw new Error(`Page "${page}" not found. Pages: ${listPageNames()}`);
  }

  return { id: match.id, name: match.name, children: match.children ?? [] };
}
