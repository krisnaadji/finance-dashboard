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
  const strippedPath = pathname.replace(new RegExp('^/(en|id)(/|$)'), '$2') || '/';
  const isActive = strippedPath.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className="flex flex-col md:flex-row items-center md:items-start gap-1 md:gap-2.5 flex-1 md:flex-none
        px-2 md:px-3 py-2 rounded-none md:rounded-lg text-xs md:text-sm transition-all duration-150
        justify-center md:justify-start border border-transparent"
      style={
        isActive
          ? {
              background: 'rgba(16,185,129,0.12)',
              borderColor: 'rgba(16,185,129,0.28)',
              color: '#34d399',
            }
          : { color: 'rgba(241,245,249,0.45)' }
      }
      onMouseEnter={
        !isActive
          ? (e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLElement).style.color = 'rgba(241,245,249,0.85)';
            }
          : undefined
      }
      onMouseLeave={
        !isActive
          ? (e) => {
              (e.currentTarget as HTMLElement).style.background = '';
              (e.currentTarget as HTMLElement).style.color = 'rgba(241,245,249,0.45)';
            }
          : undefined
      }
    >
      <span className="text-sm md:text-xs opacity-80">{icon}</span>
      <span className="text-[10px] md:text-sm">{label}</span>
    </Link>
  );
}
