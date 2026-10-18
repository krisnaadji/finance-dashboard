export interface CategoryFormRevision {
  accountId: string;
  revision: number;
  targetRevision: number;
  source: 'id' | 'en';
  target: 'id' | 'en';
  sourceText: string;
  parentId: string | null;
}

export function canApplyTranslation(request: CategoryFormRevision, current: CategoryFormRevision, aborted = false): boolean {
  return !aborted &&
    request.accountId === current.accountId &&
    request.revision === current.revision &&
    request.targetRevision === current.targetRevision &&
    request.source === current.source &&
    request.target === current.target &&
    request.sourceText === current.sourceText &&
    request.parentId === current.parentId;
}
