function format(message, meta) {
    if (meta === undefined)
        return `[pixso-advanced-mcp] ${message}`;
    const rendered = typeof meta === 'string' ? meta : JSON.stringify(meta);
    return `[pixso-advanced-mcp] ${message} ${rendered}`;
}
export const logger = {
    info(message, meta) {
        console.error(format(message, meta));
    },
    warn(message, meta) {
        console.error(format(`WARN ${message}`, meta));
    },
    error(message, meta) {
        console.error(format(`ERROR ${message}`, meta));
    }
};
//# sourceMappingURL=logger.js.map