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
    // Set a cookie to override browser language detection
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;

    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] === 'en' || segments[0] === 'id') {
      segments.shift();
    }
    const basePath = segments.length > 0 ? '/' + segments.join('/') : '/';
    const newPath = newLocale === 'id' ? basePath : '/en' + basePath;

    startTransition(() => {
      router.push(newPath);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1">
      {(['id', 'en'] as const).map((loc) => (
        <button
          key={loc}
          onClick={() => switchLocale(loc)}
          disabled={isPending}
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
