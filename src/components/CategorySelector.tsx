'use client';
import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { categoryLabel, selectableCategories, type Category, type CategoryLocale, type CategoryType } from '@/lib/categories';

interface Props {
  categories: Category[];
  type: CategoryType;
  value: string | null;
  onChange: (id: string | null) => void;
  locale: CategoryLocale;
  disabled?: boolean;
  historicalValue?: Category | null;
}

export function CategorySelector({ categories, type, value, onChange, locale, disabled, historicalValue }: Props) {
  const id = useId();
  const t = useTranslations('hierarchy');
  const options = selectableCategories(categories, type);
  const retained = historicalValue?.id === value && !options.some(c => c.id === value) ? historicalValue : null;
  const label = (category: Category) => {
    const parent = categories.find(c => c.id === category.parent_id);
    return parent ? `${categoryLabel(parent, locale)} / ${categoryLabel(category, locale)}` : categoryLabel(category, locale);
  };
  return <label htmlFor={id} className="block min-w-0 text-xs text-white/40">
    <span className="block mb-1">{t('category')}</span>
    <select id={id} value={value ?? ''} disabled={disabled} onChange={e => onChange(e.target.value || null)} className="w-full min-w-0 rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white focus-visible:outline-emerald-400">
      <option value="">{t('none')}</option>
      {retained && <option value={retained.id}>{label(retained)} ({t('inactive')})</option>}
      {options.filter(c => !c.parent_id).map(root => <optgroup key={root.id} label={categoryLabel(root, locale)}>
        <option value={root.id}>{categoryLabel(root, locale)}</option>
        {options.filter(c => c.parent_id === root.id).map(child => <option key={child.id} value={child.id}>{label(child)}</option>)}
      </optgroup>)}
    </select>
  </label>;
}
