// Pixso plugin entry. Command dispatch lands in stage 1.
declare const pixso: { notify?: (message: string) => void };

if (typeof pixso !== 'undefined' && pixso.notify) {
  pixso.notify('my-pixso-mcp plugin loaded');
}
