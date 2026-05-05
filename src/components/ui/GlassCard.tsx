import { ReactNode, CSSProperties } from 'react';

type Tint = 'emerald' | 'sky' | 'red' | 'amber' | 'none';

const tintMap: Record<Tint, { background: string; borderColor: string }> = {
  emerald: {
    background: 'linear-gradient(135deg, rgba(16,185,129,0.09), rgba(16,185,129,0.04))',
    borderColor: 'rgba(16,185,129,0.25)',
  },
  sky: {
    background: 'linear-gradient(135deg, rgba(14,165,233,0.09), rgba(14,165,233,0.04))',
    borderColor: 'rgba(14,165,233,0.22)',
  },
  red: {
    background: 'linear-gradient(135deg, rgba(248,113,113,0.09), rgba(248,113,113,0.03))',
    borderColor: 'rgba(248,113,113,0.22)',
  },
  amber: {
    background: 'linear-gradient(135deg, rgba(251,191,36,0.09), rgba(251,191,36,0.03))',
    borderColor: 'rgba(251,191,36,0.22)',
  },
  none: { background: 'rgba(255,255,255,0.035)', borderColor: 'rgba(255,255,255,0.07)' },
};

interface Props {
  children: ReactNode;
  tint?: Tint;
  className?: string;
  style?: CSSProperties;
}

export function GlassCard({ children, tint = 'none', className = '', style }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border backdrop-blur-md ${className}`}
      style={{ ...tintMap[tint], ...style }}
    >
      {/* Shimmer highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 60%)' }}
      />
      {children}
    </div>
  );
}
