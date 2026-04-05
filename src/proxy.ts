// src/middleware.ts
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/request';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

export const config = {
  matcher: [
    // Match only the root and locale-prefixed paths
    // This prevents middleware from running on /dashboard, /accounts etc
    '/((?!_next|api|favicon\\.ico).*)',
  ],
};
