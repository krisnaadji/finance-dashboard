'use client';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations('language');
  const pathname = usePathname();

  function switchLocale(newLocale: string) {
    if (newLocale === locale) return;

    // 1. Set cookie so next-intl middleware respects the chosen locale
    //    even when path has no prefix (e.g. /dashboard = Indonesian default)
    const secure = window.location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax${secure}`;

    // 2. Build the new path with correct locale prefix
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] === 'en' || segments[0] === 'id') segments.shift();
    const base = segments.length > 0 ? '/' + segments.join('/') : '/';
    const newPath = newLocale === 'id' ? base : '/en' + base;

    // 3. Hard navigate — ensures middleware runs and reads the new cookie
    window.location.assign(newPath + window.location.search + window.location.hash);
  }

  return (
    <div role="group" aria-label={t('label')} className="flex rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.04] w-full">
      {(['id', 'en'] as const).map((loc) => (
        <button
          key={loc}
          type="button"
          aria-label={t(loc)}
          aria-pressed={loc === locale}
          onClick={() => switchLocale(loc)}
          onTouchEnd={(e) => {
            e.preventDefault();
            switchLocale(loc);
          }}
          className={`flex-1 py-2 md:py-1.5 text-sm md:text-xs font-medium cursor-pointer select-none transition-all duration-150 focus-visible:outline-emerald-400 ${
            loc === locale ? 'bg-white/[0.12] text-white' : 'text-white/35 hover:text-white/60'
          }`}
        >
          {loc === 'id' ? 'ID' : 'EN'}
        </button>
      ))}
    </div>
  );
}
