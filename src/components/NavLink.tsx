'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  href: string;
  icon: string;
  label: string;
}

export function NavLink({ href, icon, label }: Props) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex flex-col md:flex-row items-center md:items-start gap-1 md:gap-2.5 flex-1 md:flex-none
        px-2 md:px-3 py-2 rounded-none md:rounded-lg text-xs md:text-sm transition-all duration-150 justify-center md:justify-start ${
          isActive
            ? 'bg-white/[0.08] text-white'
            : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
        }`}
    >
      <span className="text-sm md:text-xs opacity-70">{icon}</span>
      <span className="text-[10px] md:text-sm">{label}</span>
    </Link>
  );
}
