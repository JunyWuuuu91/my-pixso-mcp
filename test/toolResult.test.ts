import { describe, expect, it } from 'vitest';
import { imageToolResult, jsonToolResult } from '../src/utils/toolResult.js';

describe('tool results', () => {
  it('wraps non-object structured content', () => {
    const result = jsonToolResult(['a']);
    expect(result.structuredContent).toEqual({ value: ['a'] });
  });

  it('returns MCP image content', () => {
    const result = imageToolResult({ nodeId: '1:2' }, 'abc', 'image/png');
    expect(result.content[1]).toEqual({ type: 'image', mimeType: 'image/png', data: 'abc' });
  });
});
