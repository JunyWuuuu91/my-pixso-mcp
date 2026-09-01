export {};

declare global {
  const __html__: string;

  interface PluginUiApi {
    postMessage(message: unknown): void;
    onmessage: ((payload: unknown) => void | Promise<void>) | null;
  }

  interface SceneNodeLike {
    id: string;
    name: string;
    type: string;
    width: number;
    height: number;
  }

  interface PageNodeLike extends SceneNodeLike {
    children: readonly SceneNodeLike[];
  }

  interface DocumentNodeLike {
    id: string;
    name: string;
    children: readonly PageNodeLike[];
  }

  interface PixsoShowUiOptions {
    width?: number;
    height?: number;
    title?: string;
    visible?: boolean;
    enableResize?: boolean;
    minWidth?: number;
    minHeight?: number;
  }

  const pixso: {
    showUI(html: string, options?: PixsoShowUiOptions): void;
    notify(message: string): void;
    ui: PluginUiApi;
    root: DocumentNodeLike;
    currentPage: PageNodeLike;
  };
}
