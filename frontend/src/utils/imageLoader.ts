// Helper function to dynamically import images with special characters
// This avoids Vite's URL decoding issues with special characters in paths

export async function loadImage(path: string): Promise<string> {
  try {
    const module = await import(/* @vite-ignore */ path + '?url');
    return module.default;
  } catch (error) {
    console.error(`Failed to load image: ${path}`, error);
    return '';
  }
}

// Re-export resolveImageUrl from dedicated clean utility
export { resolveImageUrl } from './imageUrl';

export function getProductImage(_filename: string): string {
  return '';
}

export function getCategoryImage(_filename: string): string {
  return '';
}
