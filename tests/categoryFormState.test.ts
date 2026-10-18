import { describe, expect, it } from 'vitest';
import { canApplyTranslation } from '../src/lib/category-form-state';

describe('translation form revision ownership', () => {
  const request = { accountId: 'account-a', revision: 3, targetRevision: 0, source: 'en' as const, target: 'id' as const, sourceText: 'Cat care', parentId: 'pets' };
  it('accepts a result only for the unchanged requesting form', () => {
    expect(canApplyTranslation(request, { ...request })).toBe(true);
  });
  it('ignores a late result after a target/source/language/parent edit or modal cancellation', () => {
    expect(canApplyTranslation(request, { ...request, revision: 4 })).toBe(false);
  });
  it('preserves a manually edited translation while the suggestion is pending', () => {
    expect(canApplyTranslation(request, { ...request, targetRevision: 1 })).toBe(false);
  });
  it('rejects changed source text, languages, and parent independently', () => {
    expect(canApplyTranslation(request, { ...request, sourceText: 'Dog care' })).toBe(false);
    expect(canApplyTranslation(request, { ...request, source: 'id', target: 'en' })).toBe(false);
    expect(canApplyTranslation(request, { ...request, parentId: 'household' })).toBe(false);
  });
  it('cannot populate a different account even when its revision matches', () => {
    expect(canApplyTranslation(request, { ...request, accountId: 'account-b' })).toBe(false);
  });
  it('rejects aborted requests even if their revision is unchanged', () => {
    expect(canApplyTranslation(request, request, true)).toBe(false);
  });
  it('does not accept an older request after a replacement request completes', () => {
    const replacement = { ...request, revision: 5 };
    expect(canApplyTranslation(request, replacement)).toBe(false);
    expect(canApplyTranslation(replacement, replacement)).toBe(true);
  });
});
