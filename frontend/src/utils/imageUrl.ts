/**
 * imageUrl.ts
 * Clean URL resolution utility with zero module dependencies or glob loaders.
 */

/**
 * Resolves any image URL or path to a valid loadable URL.
 * Handles:
 * - data: and blob: URLs
 * - http:// / https:// full URLs
 * - legacy olovelytotal.com URLs pointing to local /uploads
 * - relative paths like /uploads/..., /assets/...
 */
export function resolveImageUrl(url?: string | null): string {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return "";

  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  // Determine current backend server origin (e.g. http://localhost:5000)
  const apiBase =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api/v1";
  const serverOrigin = apiBase.replace(/\/api\/v\d+\/?$|\/api\/?$/, "");

  // If URL references legacy domain with /uploads, redirect to current server origin
  if (trimmed.includes("olovelytotal.com/uploads/")) {
    const pathPart = trimmed.split("olovelytotal.com")[1];
    return `${serverOrigin}${pathPart}`;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Handle relative /uploads/... or /assets/...
  const cleanUrl = trimmed.replace(/\\/g, "/");
  if (cleanUrl.startsWith("/assets/") || cleanUrl.startsWith("assets/")) {
    return cleanUrl.startsWith("/") ? cleanUrl : `/${cleanUrl}`;
  }

  return `${serverOrigin}/${cleanUrl.startsWith("/") ? cleanUrl.slice(1) : cleanUrl}`;
}
