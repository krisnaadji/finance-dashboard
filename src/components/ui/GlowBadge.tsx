// src/components/ui/GlowBadge.tsx
import { ReactNode } from 'react';

type Color = 'emerald' | 'sky' | 'red' | 'amber';

const colorMap: Record<Color, { bg: string; border: string; text: string; dot: string }> = {
  emerald: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', text: '#34d399', dot: '#10b981' },
  sky:     { bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.28)', text: '#38bdf8', dot: '#0ea5e9' },
  red:     { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)', text: '#f87171', dot: '#ef4444' },
  amber:   { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.28)', text: '#fbbf24', dot: '#f59e0b' },
};

interface Props {
  color: Color;
  children: ReactNode;
  dot?: boolean;
  className?: string;
  onClick?: () => void;
}

export function GlowBadge({ color, children, dot = false, className = '', onClick }: Props) {
  const c = colorMap[color];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${className}`}
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
      onClick={onClick}
    >
      {dot && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ background: c.dot, boxShadow: `0 0 5px ${c.dot}` }}
        />
      )}
      {children}
    </span>
  );
}
