import { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

interface SheetContentProps {
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
  className?: string;
}

interface SheetHeaderProps {
  children: ReactNode;
  className?: string;
}

interface SheetTitleProps {
  children: ReactNode;
  className?: string;
}

interface SheetDescriptionProps {
  children: ReactNode;
  className?: string;
}

interface SheetFooterProps {
  children: ReactNode;
  className?: string;
}

interface SheetCloseProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  const handleBackdropClick = () => {
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" onClick={handleBackdropClick}>
          {children}
        </div>
      )}
    </AnimatePresence>
  );
}

export function SheetContent({ side = 'bottom', children, className }: SheetContentProps) {
  const sideClasses = {
    top: 'top-0 rounded-b-3xl',
    right: 'right-0 rounded-l-3xl',
    bottom: 'bottom-0 rounded-t-3xl',
    left: 'left-0 rounded-r-3xl',
  };

  const initialY = side === 'bottom' ? '100%' : side === 'top' ? '-100%' : '0';
  const initialX = side === 'right' ? '100%' : side === 'left' ? '-100%' : '0';

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black"
      />

      {/* Sheet */}
      <motion.div
        initial={{ 
          y: side === 'bottom' || side === 'top' ? initialY : 0,
          x: side === 'left' || side === 'right' ? initialX : 0,
          opacity: 0 
        }}
        animate={{ y: 0, x: 0, opacity: 1 }}
        exit={{ 
          y: side === 'bottom' || side === 'top' ? initialY : 0,
          x: side === 'left' || side === 'right' ? initialX : 0,
          opacity: 0 
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'absolute bg-white shadow-2xl border border-neutral-200 w-full flex flex-col',
          side === 'bottom' ? 'h-[95vh] max-h-[95vh]' : 'max-h-[90vh]',
          sideClasses[side],
          className
        )}
        style={{
          ...(side === 'bottom' && {
            bottom: 0,
            left: 0,
            right: 0,
          }),
        }}
      >
        {children}
      </motion.div>
    </>
  );
}

export function SheetHeader({ children, className }: SheetHeaderProps) {
  return (
    <div className={cn('flex flex-col space-y-2 text-center sm:text-left px-4 pt-4', className)}>
      {children}
    </div>
  );
}

export function SheetTitle({ children, className }: SheetTitleProps) {
  return (
    <h2 className={cn('text-xl font-bold text-neutral-900', className)}>
      {children}
    </h2>
  );
}

export function SheetDescription({ children, className }: SheetDescriptionProps) {
  return (
    <p className={cn('text-sm text-neutral-500', className)}>
      {children}
    </p>
  );
}

export function SheetFooter({ children, className }: SheetFooterProps) {
  return (
    <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-4 pb-4', className)}>
      {children}
    </div>
  );
}

export function SheetClose({ children, className, onClick }: SheetCloseProps) {
  return (
    <button
      onClick={onClick}
      className={cn('absolute top-3 right-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2', className)}
    >
      {children}
    </button>
  );
}

