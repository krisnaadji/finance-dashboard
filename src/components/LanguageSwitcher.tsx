'use client';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: string) {
    // Remove existing locale prefix if present
    const withoutLocale = pathname.replace(/^\/(en|id)/, '') || '/';
    // Add new locale prefix only for non-default locale
    const newPath = newLocale === 'id' ? withoutLocale : '/' + newLocale + withoutLocale;
    router.push(newPath);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1">
      {(['id', 'en'] as const).map((loc) => (
        <button
          key={loc}
          onClick={() => switchLocale(loc)}
          className={
            loc === locale
              ? 'rounded px-3 py-1 bg-blue-600 text-white text-sm font-medium'
              : 'rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100'
          }
        >
          {loc === 'id' ? 'Indonesia' : 'English'}
        </button>
      ))}
    </div>
  );
}
