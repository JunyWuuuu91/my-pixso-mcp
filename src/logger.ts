export interface Logger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

function format(message: string, meta?: unknown): string {
  if (meta === undefined) return `[pixso-advanced-mcp] ${message}`;
  const rendered = typeof meta === 'string' ? meta : JSON.stringify(meta);
  return `[pixso-advanced-mcp] ${message} ${rendered}`;
}

export const logger: Logger = {
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
