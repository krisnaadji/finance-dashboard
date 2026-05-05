// src/app/layout.tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono, Syne, Instrument_Serif } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const syne = Syne({ variable: '--font-syne', subsets: ['latin'], weight: ['400', '600', '700', '800'] });
const instrumentSerif = Instrument_Serif({
  variable: '--font-serif',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Finance Bot Dashboard',
  description: 'Personal finance tracking via WhatsApp',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} ${instrumentSerif.variable}`}>
        {children}
      </body>
    </html>
  );
}
