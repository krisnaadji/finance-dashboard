import { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const base =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed';

const ghostClass =
  'border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-[rgba(241,245,249,0.7)] hover:bg-[rgba(255,255,255,0.1)] hover:text-[#f1f5f9]';

const dangerClass =
  'text-[rgba(248,113,113,0.6)] hover:text-[#f87171] hover:bg-[rgba(248,113,113,0.1)]';

export function GlassButton({ variant = 'ghost', type = 'button', children, className = '', style, ...rest }: Props) {
  if (variant === 'primary') {
    return (
      <button
        type={type}
        className={`${base} text-white ${className}`}
        style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
          boxShadow: '0 0 18px rgba(16,185,129,0.28)',
          ...style,
        }}
        {...rest}
      >
        {children}
      </button>
    );
  }

  if (variant === 'danger') {
    return (
      <button type={type} className={`${base} ${dangerClass} ${className}`} style={style} {...rest}>
        {children}
      </button>
    );
  }

  return (
    <button type={type} className={`${base} ${ghostClass} ${className}`} style={style} {...rest}>
      {children}
    </button>
  );
}
