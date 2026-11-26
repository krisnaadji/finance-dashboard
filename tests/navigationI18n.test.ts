import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { MainNav } from '../src/components/MainNav';
import { SignOutButton } from '../src/components/SignOutButton';
import en from '../messages/en.json';
import id from '../messages/id.json';

vi.stubGlobal('React', React);
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard', useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('../src/lib/supabase-browser', () => ({ createClient: () => ({ auth: { signOut: async () => {} } }) }));

function render(locale: 'en' | 'id', element: React.ReactElement) {
  return renderToStaticMarkup(React.createElement(NextIntlClientProvider, { locale, messages: locale === 'id' ? id : en, children: element }));
}

describe('sidebar navigation translations', () => {
  it('renders nav links and sign out in Indonesian', () => {
    const html = render('id', React.createElement(React.Fragment, null, React.createElement(MainNav), React.createElement(SignOutButton)));
    for (const label of ['Dasbor', 'Transaksi', 'Akun', 'Kategori', 'Keluar']) expect(html).toContain(`${label}<`);
    for (const label of ['Dashboard', 'Transactions', 'Accounts', 'Categories', 'Sign out']) expect(html).not.toContain(`>${label}<`);
  });

  it('renders nav links and sign out in English, with the compact mobile label', () => {
    const html = render('en', React.createElement(React.Fragment, null, React.createElement(MainNav), React.createElement(SignOutButton)));
    for (const label of ['Dashboard', 'Transactions', 'Accounts', 'Categories', 'Sign out']) expect(html).toContain(`${label}<`);
    expect(render('en', React.createElement(MainNav, { compact: true }))).toContain('>Txn<');
    expect(render('id', React.createElement(MainNav, { compact: true }))).toContain('>Transaksi<');
  });

  it('keeps nav keys in sync across locales', () => {
    expect(Object.keys(id.nav).sort()).toEqual(Object.keys(en.nav).sort());
  });
});
