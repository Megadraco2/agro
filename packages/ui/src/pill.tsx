import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const pillVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-foreground',
        muted: 'bg-border text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Pill({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof pillVariants>) {
  return (
    <span className={cn(pillVariants({ variant, className }))} {...props} />
  );
}
