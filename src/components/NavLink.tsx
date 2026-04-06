'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
        isActive
          ? 'bg-white/[0.08] text-white'
          : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
      }`}
    >
      <span className="text-xs opacity-70">{icon}</span>
      {label}
    </Link>
  );
}
