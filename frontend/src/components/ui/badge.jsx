import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const variants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent/10 text-accent-bright',
        success: 'border-transparent bg-success-bg text-success-bright',
        warning: 'border-transparent bg-warning-bg text-warning-bright',
        muted: 'border-transparent bg-surface-elevated text-txt-secondary',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(variants({ variant }), className)} {...props} />;
}