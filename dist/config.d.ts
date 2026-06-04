import type { ServerConfig } from './types.js';
export declare function readPackageVersion(): string;
export declare function isSupportedNodeVersion(version: string): boolean;
export declare function parseArgs(argv: string[]): {
    command: string;
    flags: Record<string, string | boolean>;
};
export declare function buildConfig(flags: Record<string, string | boolean>): ServerConfig;
export declare function currentEntryPath(): string;
