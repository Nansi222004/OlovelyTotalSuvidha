import { ReactNode } from 'react';

/**
 * Minimal loading state that matches page background
 * Prevents flash by using same background as pages
 */
export default function PageLoader({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      {children || (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-neutral-500">Loading...</p>
        </div>
      )}
    </div>
  );
}

