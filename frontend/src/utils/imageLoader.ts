// Helper function to dynamically import images with special characters
// This avoids Vite's URL decoding issues with special characters in paths

export async function loadImage(path: string): Promise<string> {
  try {
    // Use dynamic import with ?url to get the asset URL
    const module = await import(/* @vite-ignore */ path + '?url');
    return module.default;
  } catch (error) {
    console.error(`Failed to load image: ${path}`, error);
    return '';
  }
}

// Pre-load all product images using import.meta.glob
const productImageModules = import.meta.glob(
  '../../assets/Image-20251130T081301Z-1-001/Image/product/product/**/*.{jpg,jpeg,png,webp}',
  { eager: true, query: '?url', import: 'default' }
);

// Pre-load all category images
const categoryImageModules = import.meta.glob(
  '../../assets/category/*.{png,jpg,jpeg}',
  { eager: true, query: '?url', import: 'default' }
);

// Helper to get image URL by matching filename
export function getProductImage(filename: string): string {
  const normalizedFilename = filename.toLowerCase().replace(/\s+/g, ' ');
  for (const [path, url] of Object.entries(productImageModules)) {
    if (path.toLowerCase().includes(normalizedFilename.toLowerCase())) {
      return url as string;
    }
  }
  return '';
}

export function getCategoryImage(filename: string): string {
  for (const [path, url] of Object.entries(categoryImageModules)) {
    if (path.includes(filename)) {
      return url as string;
    }
  }
  return '';
}

