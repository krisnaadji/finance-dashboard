import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

// Tell Next.js which locales to pre-render — prevents 'Failed to generate static paths' error
export function generateStaticParams() {
  return [{ locale: 'id' }, { locale: 'en' }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
