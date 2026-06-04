export interface McpContentText {
    type: 'text';
    text: string;
}
export interface McpContentImage {
    type: 'image';
    mimeType: string;
    data: string;
}
export type McpContent = McpContentText | McpContentImage;
export interface McpToolResult {
    [key: string]: unknown;
    content: McpContent[];
    structuredContent?: Record<string, unknown>;
}
export declare function jsonToolResult(data: unknown): McpToolResult;
export declare function imageToolResult(meta: Record<string, unknown>, dataBase64: string, mimeType: string): McpToolResult;
export declare function errorToolResult(error: unknown): McpToolResult;
