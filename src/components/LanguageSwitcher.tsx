'use client';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  function switchLocale(newLocale: string) {
    if (newLocale === locale) return;
    // Strip any existing locale prefix
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] === 'en' || segments[0] === 'id') segments.shift();
    const base = '/' + segments.join('/');
    const newPath = newLocale === 'id' ? base || '/' : '/en' + (base || '/');
    // Hard navigation — guaranteed to trigger next-intl middleware on all devices
    window.location.assign(newPath);
  }

  return (
    <div className="flex rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.04] w-full">
      {(['id', 'en'] as const).map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => switchLocale(loc)}
          onTouchEnd={(e) => {
            e.preventDefault();
            switchLocale(loc);
          }}
          className={`flex-1 py-2 md:py-1.5 text-sm md:text-xs font-medium
            cursor-pointer select-none transition-all duration-150 ${
              loc === locale ? 'bg-white/[0.12] text-white' : 'text-white/35 hover:text-white/60'
            }`}
        >
          {loc === 'id' ? 'ID' : 'EN'}
        </button>
      ))}
    </div>
  );
}
