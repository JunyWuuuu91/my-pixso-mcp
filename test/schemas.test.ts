import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { findRelatedFramesSchema, getCodingContextSchema, getCssContextSchema, getExportPreviewSchema, getScreenshotSchema } from '../src/tools/schemas.js';

describe('tool schemas', () => {
  it('exposes screenshot mode for get_coding_context', () => {
    expect(getCodingContextSchema.includeScreenshot).toBeDefined();
    expect(getCodingContextSchema.maxScreenshotWidth).toBeDefined();
  });

  it('exposes v0.4 performance controls for get_coding_context', () => {
    expect(getCodingContextSchema.performanceProfile).toBeDefined();
    expect(getCodingContextSchema.budgetMs).toBeDefined();
    expect(getCodingContextSchema.includeVariables).toBeDefined();
    expect(getCodingContextSchema.includeStyles).toBeDefined();
    expect(getCodingContextSchema.maxTypographyVisitedNodes).toBeDefined();
    expect(getCodingContextSchema.profile).toBeDefined();
    expect(getCodingContextSchema.includeRawTree).toBeDefined();
    expect(getCodingContextSchema.includeCssSummary).toBeDefined();
  });

  it('keeps expensive coding-context sections opt-in by default', () => {
    const defaults = z.object(getCodingContextSchema).parse({});
    expect(defaults.includeComponentHints).toBe(false);
    expect(defaults.includeScreenshot).toBe('none');
  });

  it('exposes find_related_frames controls', () => {
    expect(findRelatedFramesSchema.nodeId).toBeDefined();
    expect(findRelatedFramesSchema.maxResults).toBeDefined();
    expect(findRelatedFramesSchema.strategies).toBeDefined();
  });

  it('exposes get_css_context controls', () => {
    const defaults = z.object(getCssContextSchema).parse({});
    expect(defaults.mode).toBe('compact');
    expect(defaults.depth).toBe(3);
    expect(defaults.includeStyleResolution).toBe(true);
    expect(defaults.includeLowConfidence).toBe(false);
    expect(defaults.scope).toBe('key');
    expect(defaults.groupDuplicates).toBe(true);
    expect(defaults.omitDefaults).toBe(true);
    expect(defaults.guidanceProfile).toBe('faithful');
    expect(defaults.declarationMetadata).toBeUndefined();
    expect(defaults.selectorStrategy).toBe('alias');
    expect(getCssContextSchema.selectorStrategy).toBeDefined();
    expect(getCssContextSchema.scope).toBeDefined();
    expect(getCssContextSchema.groupDuplicates).toBeDefined();
    expect(getCssContextSchema.omitDefaults).toBeDefined();
    expect(getCssContextSchema.guidanceProfile).toBeDefined();
  });

  it('exposes export preview and screenshot guards', () => {
    const defaults = z.object(getScreenshotSchema).parse({});
    expect(getExportPreviewSchema.maxPixels).toBeDefined();
    expect(getScreenshotSchema.maxPixels).toBeDefined();
    expect(getScreenshotSchema.allowLargeExport).toBeDefined();
    expect(defaults.contentsOnly).toBe(true);
  });
});
