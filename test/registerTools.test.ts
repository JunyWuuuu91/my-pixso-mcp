import { describe, expect, it } from 'vitest';
import { normalizePluginInputForCommand } from '../src/tools/registerTools.js';

describe('registerTools plugin input normalization', () => {
  it('keeps agent CSS guidance compact unless declaration metadata is explicit', () => {
    expect(normalizePluginInputForCommand('get_css_context', {
      guidanceProfile: 'agent',
      mode: 'compact'
    })).toEqual({
      guidanceProfile: 'agent',
      mode: 'compact',
      declarationMetadata: 'none'
    });

    expect(normalizePluginInputForCommand('get_css_context', {
      guidanceProfile: 'agent',
      declarationMetadata: 'compact'
    })).toEqual({
      guidanceProfile: 'agent',
      declarationMetadata: 'compact'
    });
  });

  it('does not alter faithful CSS calls or unrelated commands', () => {
    const faithfulInput = { guidanceProfile: 'faithful', mode: 'compact' };
    expect(normalizePluginInputForCommand('get_css_context', faithfulInput)).toBe(faithfulInput);

    const codingInput = { guidanceProfile: 'agent' };
    expect(normalizePluginInputForCommand('get_coding_context', codingInput)).toBe(codingInput);
  });
});
