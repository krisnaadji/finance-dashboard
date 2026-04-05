import { getRequestConfig } from 'next-intl/server';

export const locales = ['id', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'id';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  return {
    locale: locale ?? 'id',
    messages: (await import(`../../messages/${locale ?? 'id'}.json`)).default,
  };
});
