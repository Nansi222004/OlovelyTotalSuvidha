import { lazy, ComponentType } from 'react';

/**
 * Helper to determine if an error is a dynamic module import failure
 */
export function isDynamicImportError(error: any): boolean {
  if (!error) return false;
  const str = (
    typeof error === 'string'
      ? error
      : error.message || error.reason?.message || error.reason || error.stack || String(error)
  ).toLowerCase();

  return (
    str.includes('dynamically imported module') ||
    str.includes('failed to fetch') ||
    str.includes('importing a module script failed') ||
    str.includes('loading chunk') ||
    str.includes('chunkloaderror') ||
    str.includes('failed to load module script') ||
    str.includes('error loading module')
  );
}

/**
 * Enhanced lazy loader that handles dynamic import failures caused by production deployments
 * or temporary network glitches.
 * 
 * When a deployment replaces old asset hashes, dynamic import() fails.
 * This utility automatically reloads the window to fetch the latest index.html and assets.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  componentName: string = 'component'
) {
  return lazy(async () => {
    const pageHasBeenReloadedKey = `lazy_retry_${componentName}`;

    try {
      const component = await componentImport();
      // Clear flag on successful load
      sessionStorage.removeItem(pageHasBeenReloadedKey);
      return component;
    } catch (error: any) {
      console.error(`[lazyWithRetry] Failed to load dynamic chunk for ${componentName}:`, error);

      // Check if error is a dynamic import failure
      if (isDynamicImportError(error)) {
        const lastReloadTs = Number(sessionStorage.getItem('chunk_reload_ts') || '0');
        const now = Date.now();

        // Rate limit reloads to once per 10 seconds to prevent infinite reload loops
        if (now - lastReloadTs > 10000) {
          sessionStorage.setItem('chunk_reload_ts', String(now));
          sessionStorage.setItem(pageHasBeenReloadedKey, 'true');
          // Force reload to get latest HTML and asset bundle from server
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      }

      // Rethrow if reloaded already within rate-limit window so ErrorBoundary can handle it gracefully
      throw error;
    }
  });
}

export default lazyWithRetry;

