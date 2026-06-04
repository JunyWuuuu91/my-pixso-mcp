import type { ServerConfig } from './types.js';
export interface InstallCodexConfigOptions {
    config: ServerConfig;
    entryPath: string;
    configPath?: string;
    write?: boolean;
    backupSuffix?: string;
}
export interface InstallCodexConfigResult {
    configPath: string;
    backupPath?: string;
    mode: 'preview' | 'write';
    created: boolean;
    updated: boolean;
    block: string;
    content: string;
}
export declare function defaultCodexConfigPath(): string;
export declare function renderCodexConfigSnippet(config: ServerConfig, entryPath: string): string;
export declare function renderManagedCodexConfigBlock(config: ServerConfig, entryPath: string): string;
export declare function hasPixsoCodexConfig(text: string): boolean;
export declare function upsertManagedCodexConfig(existingText: string, block: string): string;
export declare function installCodexConfig(options: InstallCodexConfigOptions): InstallCodexConfigResult;
