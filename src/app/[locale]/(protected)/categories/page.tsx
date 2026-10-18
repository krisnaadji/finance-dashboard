'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccountId, useAccountRole } from '@/components/AccountSwitcher';
import { categoryLabel, categoryPath, type Category, type CategoryLocale, type CategoryType } from '@/lib/categories';
import type { Summary } from '@/lib/reporting-contract';
import { canApplyTranslation, type CategoryFormRevision } from '@/lib/category-form-state';
import { parseAmount } from '@/lib/financial-validation';
import { formatIDR, startOfMonth, today } from '@/lib/utils';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';

interface Budget { id: string; category_id: string; amount: string }
const input = 'min-h-11 w-full rounded-lg border border-white/20 bg-[#141a20] px-3 py-2 text-white focus-visible:outline-emerald-400';
const blank = { name_id: '', name_en: '', parent_id: '', type: 'expense' as CategoryType, budget: '' };

export default function CategoriesPage() {
  const t = useTranslations('hierarchy');
  const locale = useLocale() as CategoryLocale;
  const accountId = useAccountId();
  const owner = useAccountRole() === 'owner';
  const [cats, setCats] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState(blank);
  const [source, setSource] = useState<CategoryLocale>('id');
  const [editing, setEditing] = useState<Category | null>(null);
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [formError, setFormError] = useState('');
  const [translationError, setTranslationError] = useState('');
  const revision = useRef(0);
  const targetRevision = useRef(0);
  const dialog = useRef<HTMLElement>(null);
  const formSnapshot = useRef<CategoryFormRevision>({ accountId, revision: 0, targetRevision: 0, source, target: source === 'id' ? 'en' : 'id', sourceText: '', parentId: null });
  formSnapshot.current = { accountId, revision: revision.current, targetRevision: targetRevision.current, source, target: source === 'id' ? 'en' : 'id', sourceText: form[source === 'id' ? 'name_id' : 'name_en'].trim(), parentId: form.parent_id || null };
  const request = useRef<AbortController | null>(null);
  const currentAccount = useRef(accountId);
  currentAccount.current = accountId;
  const loadKey = `${accountId}|${locale}|${tick}`;
  const currentLoad = useRef(loadKey); currentLoad.current = loadKey;
  function cancelSuggestion() { revision.current++; formSnapshot.current.revision = revision.current; request.current?.abort(); setTranslating(false); }
  function close() { cancelSuggestion(); setOpened(false); setEditing(null); setSaving(false); }
  function change(next: Partial<typeof blank>) {
    if (Object.hasOwn(next, source === 'id' ? 'name_en' : 'name_id')) targetRevision.current++;
    cancelSuggestion(); setForm(f => ({ ...f, ...next }));
  }
  useEffect(() => {
    cancelSuggestion();
    setOpened(false); setEditing(null); setCats([]); setBudgets([]); setSummary(null); setSaving(false);
    if (!accountId) return;
    const controller = new AbortController(); const requested = loadKey;
    setLoading(true); setError('');
    const load = async (url: string) => { const r = await fetch(url, { signal: controller.signal }); if (!r.ok) throw new Error(); return r.json(); };
    Promise.all([
      load(`/api/categories?account_id=${accountId}&include_inactive=true`),
      load(`/api/budgets?account_id=${accountId}`),
      load(`/api/summary?account_id=${accountId}&from=${startOfMonth()}&to=${today()}`),
    ]).then(([c, b, s]) => { if (!controller.signal.aborted && currentLoad.current === requested) { setCats(c); setBudgets(b); setSummary(s); } })
      .catch(() => { if (!controller.signal.aborted && currentLoad.current === requested) setError(t('loadFailed')); })
      .finally(() => { if (!controller.signal.aborted && currentLoad.current === requested) setLoading(false); });
    return () => { controller.abort(); request.current?.abort(); revision.current++; };
  }, [accountId, tick, loadKey, t]);
  useEffect(() => {
    if (!opened) return;
    const previous = document.activeElement as HTMLElement | null;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); cancelSuggestion(); setOpened(false); setSaving(false); }
      if (event.key !== 'Tab') return;
      const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)');
      if (!items?.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.current?.querySelector<HTMLElement>('input, select, button')?.focus();
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); previous?.focus(); };
  }, [opened]);
  function open(category?: Category) {
    cancelSuggestion(); setSaving(false); setEditing(category ?? null); setFormError(''); setTranslationError(''); setSource(locale);
    setForm(category ? { name_id: category.name_id ?? '', name_en: category.name_en ?? '', parent_id: category.parent_id ?? '', type: category.type, budget: budgets.find(b => b.category_id === category.id)?.amount ?? '' } : blank);
    setOpened(true);
  }
  async function suggest() {
    cancelSuggestion();
    const text = form[source === 'id' ? 'name_id' : 'name_en'].trim();
    if (!text) { setTranslationError(t('nameRequired')); return; }
    const controller = new AbortController(); request.current = controller;
    const snapshot = { ...formSnapshot.current, revision: revision.current, targetRevision: targetRevision.current };
    const account = accountId;
    setTranslating(true); setTranslationError('');
    try {
      const response = await fetch('/api/categories/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ account_id: account, name: text, source, target: source === 'id' ? 'en' : 'id' }) });
      const body = await response.json();
      if (!canApplyTranslation(snapshot, formSnapshot.current, controller.signal.aborted)) return;
      if (!response.ok || typeof body.translation !== 'string' || !body.translation.trim()) throw new Error();
      setForm(f => ({ ...f, [snapshot.target === 'id' ? 'name_id' : 'name_en']: body.translation }));
    } catch { if (canApplyTranslation(snapshot, formSnapshot.current, controller.signal.aborted)) setTranslationError(t('translationFailed')); }
    finally { if (snapshot.revision === revision.current) setTranslating(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); cancelSuggestion(); setFormError('');
    if ((!editing || editing.is_custom) && !form.name_id.trim() && !form.name_en.trim()) { setFormError(t('nameRequired')); return; }
    const rootExpense = form.type === 'expense' && !form.parent_id;
    const budget = parseAmount(form.budget);
    const clearBudget = !form.budget.trim() || /^0+(?:\.0{1,2})?$/.test(form.budget.trim());
    if (editing && rootExpense && !clearBudget && budget === null) { setFormError(t('budgetInvalid')); return; }
    const existingBudget = editing ? budgets.find(b => b.category_id === editing.id) : undefined;
    const budgetChanged = editing && rootExpense && (clearBudget ? !!existingBudget : budget !== parseAmount(existingBudget?.amount));
    setSaving(true); const account = accountId; const saveRevision = revision.current; let labelsSaved = false;
    const isCurrent = () => account === currentAccount.current && saveRevision === revision.current;
    try {
      if (!editing || editing.is_custom) {
        const r = await fetch('/api/categories', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(editing ? { id: editing.id } : { account_id: account, type: form.type, parent_id: form.parent_id || null }), name_id: form.name_id.trim() || null, name_en: form.name_en.trim() || null }) });
        if (!r.ok) throw new Error();
        const category = await r.json(); labelsSaved = true;
        if (!isCurrent()) return;
        setCats(cs => editing ? cs.map(c => c.id === editing.id ? category : c) : [...cs, category]);
      }
      if (editing && budgetChanged) {
        const existing = existingBudget;
        let response: Response | undefined;
        if (!clearBudget) response = await fetch('/api/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account_id: account, category_id: editing.id, amount: budget }) });
        else if (existing) response = await fetch(`/api/budgets?id=${existing.id}`, { method: 'DELETE' });
        if (response && !response.ok) { if (isCurrent()) setFormError(t(labelsSaved ? 'budgetPartialFailure' : 'saveFailed')); return; }
        if (response && !clearBudget) { const b = await response.json(); if (isCurrent()) setBudgets(bs => [...bs.filter(x => x.category_id !== editing.id), b]); }
        else if (isCurrent()) setBudgets(bs => bs.filter(x => x.category_id !== editing.id));
      }
      if (isCurrent()) { setSaving(false); close(); }
    } catch { if (isCurrent()) setFormError(t(labelsSaved && editing && rootExpense ? 'budgetPartialFailure' : 'saveFailed')); }
    finally { if (isCurrent()) setSaving(false); }
  }
  async function remove(category: Category) {
    if (!confirm(t('confirmDelete'))) return;
    const account = accountId;
    try { const r = await fetch(`/api/categories?id=${category.id}`, { method: 'DELETE' }); if (!r.ok) throw new Error(); if (account === currentAccount.current) setCats(cs => cs.map(c => c.id === category.id ? { ...c, is_active: false } : c)); }
    catch { if (account === currentAccount.current) setError(t('saveFailed')); }
  }
  const parents = cats.filter(c => c.is_active && !c.parent_id && c.type === form.type && c.code !== 'salary');
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><h1 className="text-xl font-semibold text-white">{t('categories')}</h1>{owner && <GlassButton onClick={() => open()} disabled={!accountId || loading || !!error}>{t('addCategory')}</GlassButton>}</div>
    <p className="text-sm text-white/70">{t('legacyBudgetNote')}</p>
    {loading && <p role="status" className="text-white/70">{t('loading')}</p>}
    {error && <div role="alert" className="text-red-300">{error} <GlassButton onClick={() => setTick(n => n + 1)}>{t('retry')}</GlassButton></div>}
    {!loading && !cats.length && <p className="text-white/70">{t('emptyCategories')}</p>}
    {(['expense', 'income'] as const).map(type => <section key={type}><h2 className="mb-2 text-white">{t(type)}</h2><ul className="space-y-2">{cats.filter(c => c.type === type && !c.parent_id).flatMap(root => [root, ...cats.filter(c => c.parent_id === root.id)]).map(c => {
      const budget = !c.parent_id && c.type === 'expense' ? budgets.find(b => b.category_id === c.id) : null;
      return <li key={c.id} className={c.parent_id ? 'ml-4 sm:ml-8' : ''}><GlassCard className="p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="min-w-0 break-words text-white/90">{categoryPath(c, cats, locale)}{!c.is_active && ` (${t('inactive')})`}</span><div className="flex gap-2">{owner && (c.is_custom || (!c.parent_id && c.type === 'expense')) && <GlassButton onClick={() => open(c)}>{t('edit')}</GlassButton>}{owner && c.is_custom && c.is_active && <GlassButton variant="danger" onClick={() => remove(c)}>{t('delete')}</GlassButton>}</div></div>
        {budget && <div className="mt-2 text-sm text-white/70"><p>{t('monthlyBudget')}: {formatIDR(summary?.spendingByCategoryId[c.id] ?? '0.00')} / {formatIDR(budget.amount)}</p><ul>{summary?.categoryDetails.filter(d => d.parentId === c.id).map(d => <li key={d.categoryId ?? 'direct'}>{d.categoryId === c.id || d.categoryId === null ? t('direct') : categoryLabel(cats.find(x => x.id === d.categoryId) ?? c, locale)}: {formatIDR(d.amount)}</li>)}</ul></div>}
      </GlassCard></li>;
    })}</ul></section>)}
    {opened && owner && <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/70 p-4" onClick={close}><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="category-form-title" onClick={e => e.stopPropagation()} className="mx-auto my-8 w-full max-w-lg rounded-2xl border border-white/20 bg-[#080c10] p-5 text-white"><h2 id="category-form-title" className="mb-4 text-lg">{t(editing ? 'edit' : 'addCategory')}</h2><form onSubmit={save} className="space-y-3"><fieldset disabled={saving} className="space-y-3">
      {(!editing || editing.is_custom) && <><label className="block">{t('originalLanguage')}<select className={input} value={source} onChange={e => { cancelSuggestion(); setSource(e.target.value as CategoryLocale); }}><option value="id">Bahasa Indonesia</option><option value="en">English</option></select></label>{(['id', 'en'] as const).map(language => <label key={language} className="block">{t(language === 'id' ? 'nameId' : 'nameEn')}<input maxLength={120} className={input} value={form[language === 'id' ? 'name_id' : 'name_en']} onChange={e => change({ [language === 'id' ? 'name_id' : 'name_en']: e.target.value })} /></label>)}<GlassButton onClick={suggest} disabled={translating || saving}>{t(translating ? 'translating' : translationError ? 'retryTranslation' : 'suggestTranslation')}</GlassButton>{translationError && <p role="alert" className="text-amber-300">{translationError}</p>}</>}
      {!editing && <><label className="block">{t('type')}<select className={input} value={form.type} onChange={e => change({ type: e.target.value as CategoryType, parent_id: '' })}><option value="expense">{t('expense')}</option><option value="income">{t('income')}</option></select></label><label className="block">{t('parent')}<select className={input} value={form.parent_id} onChange={e => change({ parent_id: e.target.value })}><option value="">{t('root')}</option>{parents.map(c => <option key={c.id} value={c.id}>{categoryLabel(c, locale)}</option>)}</select></label></>}
      {editing && !editing.parent_id && editing.type === 'expense' && <label className="block">{t('monthlyBudget')}<input inputMode="decimal" className={input} value={form.budget} onChange={e => change({ budget: e.target.value })} /><span className="text-sm text-white/70">{t('budgetHelp')}</span></label>}
      {formError && <p role="alert" className="text-red-300">{formError}</p>}<div className="flex gap-2"><GlassButton type="submit" disabled={saving}>{t(saving ? 'saving' : 'save')}</GlassButton><GlassButton onClick={close} disabled={saving}>{t('cancel')}</GlassButton></div>
    </fieldset></form></section></div>}
  </div>;
}
