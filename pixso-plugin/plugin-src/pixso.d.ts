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
    visible?: boolean;
    characters?: string;
    exportSettings?: readonly unknown[];
    exportAsync?: (settings: unknown) => Promise<unknown>;
    children?: readonly SceneNodeLike[];
  }

  interface PageNodeLike extends SceneNodeLike {
    children: readonly SceneNodeLike[];
    selection?: readonly SceneNodeLike[];
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

  interface PluginClientStorageApi {
    getAsync(key: string): Promise<unknown>;
    setAsync(key: string, value: unknown): Promise<void>;
    deleteAsync(key: string): Promise<void>;
    keysAsync(): Promise<string[]>;
  }

  interface PixsoApi {
    showUI(html: string, options?: PixsoShowUiOptions): void;
    notify(message: string): void;
    ui: PluginUiApi;
    clientStorage: PluginClientStorageApi;
    root: DocumentNodeLike;
    currentPage: PageNodeLike;
    apiVersion?: string;
    editorType?: string;
    command?: string;
    origin?: string;
    fileKey?: string;
    pluginId?: string;
    on?: (event: string, handler: (...args: unknown[]) => void) => unknown;
    currentUser?: unknown;
    [key: string]: unknown;
  }

  const pixso: PixsoApi;
}
