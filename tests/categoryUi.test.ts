import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TransactionTable } from '../src/components/TransactionTable';
import { CategorySelector } from '../src/components/CategorySelector';
import { CategoryPieChart } from '../src/components/CategoryPieChart';
import type { Category } from '../src/lib/categories';

vi.stubGlobal('React', React);
vi.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key }));

const root: Category = { id: 'root', account_id: 'account', code: null, name_id: 'Hewan', name_en: 'Pets', parent_id: null, type: 'expense', is_active: true, is_custom: true, sort_order: 0 };
const child: Category = { ...root, id: 'child', parent_id: root.id, name_id: 'Perawatan', name_en: 'Care' };
const transaction = { id: 'txn', date: '2026-10-17', description: 'Vet', amount: '200.00', category_id: child.id, type: 'expense', categories: child, parent: root };

describe('hierarchy presentation', () => {
  it('shows member edit controls while keeping deletion owner-only on both layouts', () => {
    const html = renderToStaticMarkup(React.createElement(TransactionTable, { transactions: [transaction], onDelete: () => {}, onUpdate: () => {}, isOwner: false }));
    expect(html.match(/>edit<\/button>/g)).toHaveLength(2);
    expect(html).not.toContain('>delete</button>');
    expect(html).toContain('Pets / Care');
  });

  it('retains an inactive historical child and its translated path', () => {
    const inactive = { ...child, is_active: false };
    const html = renderToStaticMarkup(React.createElement(CategorySelector, { categories: [root, inactive], type: 'expense', value: inactive.id, historicalValue: inactive, onChange: () => {}, locale: 'en' }));
    expect(html).toContain('Pets / Care (inactive)');
    expect(html).toMatch(/<option\b(?=[^>]*\bvalue="child")(?=[^>]*\bselected="")[^>]*>/);
  });

  it('shows root totals once and keeps uncategorized separate from drilldown', () => {
    const html = renderToStaticMarkup(React.createElement(CategoryPieChart, {
      categories: [{ ...root, amount: '600.25' }, { id: null, name_id: null, name_en: null, amount: '100.00' }],
      details: [{ parentId: root.id, categoryId: root.id, amount: '100.00' }, { parentId: root.id, categoryId: child.id, amount: '500.25' }], catalog: [root, child],
    }));
    expect(html).toContain('Pets');
    expect(html).toContain('uncategorized');
    expect(html).not.toContain('>Care<');
    expect(html.match(/>Pets<\/span>/g)).toHaveLength(1);
  });
});
