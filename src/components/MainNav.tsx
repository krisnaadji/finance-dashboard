'use client';
import { useTranslations } from 'next-intl';
import { NavLink } from '@/components/NavLink';

export function MainNav({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('nav');

  return (
    <>
      <NavLink href="/dashboard" icon="▦" label={t('dashboard')} />
      <NavLink href="/transactions" icon="⇅" label={compact ? t('transactionsShort') : t('transactions')} />
      <NavLink href="/accounts" icon="◎" label={t('accounts')} />
      <NavLink href="/categories" icon="⊞" label={t('categories')} />
    </>
  );
}
