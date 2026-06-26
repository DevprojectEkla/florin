import type { CategoryType } from '../../types';

const TYPE_STYLES: Record<CategoryType, string> = {
  income:   'bg-green-500/15 text-green-400',
  fixed:    'bg-orange-500/15 text-orange-400',
  variable: 'bg-blue-500/15 text-blue-400',
  savings:  'bg-yellow-500/15 text-yellow-400',
  transfer: 'bg-slate-500/15 text-slate-400',
};

interface TypeBadgeProps {
  type: CategoryType;
  label: string;
}

export function TypeBadge({ type, label }: TypeBadgeProps) {
  return (
    <span className={`badge ${TYPE_STYLES[type]}`}>
      {label}
    </span>
  );
}

interface ColorDotProps {
  color: string | null;
  size?: 'sm' | 'md';
}

export function ColorDot({ color, size = 'md' }: ColorDotProps) {
  const sz = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';
  return (
    <span
      className={`inline-block rounded-full flex-shrink-0 ${sz}`}
      style={{ backgroundColor: color ?? '#64748b' }}
    />
  );
}
