export function jsonToolResult(data) {
    const structuredContent = toStructuredContent(data);
    return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent
    };
}
function toStructuredContent(data) {
    if (data && typeof data === 'object' && !Array.isArray(data))
        return data;
    return { value: data };
}
export function imageToolResult(meta, dataBase64, mimeType) {
    return {
        content: [
            { type: 'text', text: JSON.stringify(meta, null, 2) },
            { type: 'image', mimeType, data: dataBase64 }
        ],
        structuredContent: meta
    };
}
export function errorToolResult(error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
        content: [{ type: 'text', text: `Pixso Advanced MCP error: ${message}` }],
        structuredContent: { ok: false, error: message }
    };
}
//# sourceMappingURL=toolResult.js.map