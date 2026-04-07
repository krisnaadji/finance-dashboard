'use client';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(newLocale: string) {
    const isSecure = window.location.protocol === 'https:';
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax${isSecure ? ';Secure' : ''}`;
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] === 'en' || segments[0] === 'id') segments.shift();
    const basePath = segments.length > 0 ? '/' + segments.join('/') : '/';
    const newPath = newLocale === 'id' ? basePath : '/en' + basePath;
    startTransition(() => {
      router.push(newPath);
      router.refresh();
    });
  }

  return (
    <div className="flex rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.04] w-full">
      {(['id', 'en'] as const).map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => switchLocale(loc)}
          disabled={isPending}
          style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
          className={`flex-1 py-2 md:py-1.5 text-sm md:text-xs font-medium cursor-pointer select-none transition-all duration-150 ${
            loc === locale ? 'bg-white/[0.12] text-white' : 'text-white/35 hover:text-white/60'
          }`}
        >
          {loc === 'id' ? 'ID' : 'EN'}
        </button>
      ))}
    </div>
  );
}
