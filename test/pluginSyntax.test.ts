import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pluginMain = 'pixso-plugin/main.js';

describe('Pixso plugin bundle', () => {
  it('is valid JavaScript', () => {
    expect(() => execFileSync(process.execPath, ['--check', pluginMain], { stdio: 'pipe' })).not.toThrow();
  });

  it('contains the v0.4 compact agent contract features', () => {
    const source = readFileSync(pluginMain, 'utf8');
    expect(source).toContain('buildFrameSnapshot');
    expect(source).toContain('compileCodingContext');
    expect(source).toContain('buildCssSummary');
    expect(source).toContain('ruleGroups');
    expect(source).toContain('sourceConfidence');
    expect(source).toContain('implementationConfidence');
    expect(source).toContain('getCssContext');
    expect(source).toContain('get_coding_context is the primary design scan');
  });
});
