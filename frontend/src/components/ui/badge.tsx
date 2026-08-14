import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center rounded-full border font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variants = {
      default: 'bg-primary text-white border-primary',
      destructive: 'bg-red-500 text-white border-red-500',
      outline: 'text-neutral-700 border-neutral-200 bg-white/90 backdrop-blur-sm',
      secondary: 'bg-neutral-100 text-neutral-900 border-neutral-200',
    };

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variants[variant], className)}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;


