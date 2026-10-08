import type { SyntheticEvent } from "react";

/**
 * Responsive delivery for event posters hosted on Cloudinary.
 *
 * The sheet stores plain upload URLs (originals up to 3240×4050 / ~3 MB each).
 * Cloudinary can resize and re-encode on its CDN via URL parameters, so the
 * browser downloads a version sized for the card instead of the original:
 *   f_auto  — WebP/AVIF where supported
 *   q_auto  — perceptual quality (verified visually identical at card size)
 *   c_limit — scale down only, never upscale
 *
 * Anything that isn't a plain Cloudinary upload URL is returned untouched.
 */

// https://res.cloudinary.com/<cloud>/image/upload/v<version>/<public id>
// — only matches when no transformation is already present.
const PLAIN_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/.+)$/;

const WIDTHS = [320, 480, 640, 800, 1080];

export interface PosterSources {
  src: string;
  srcSet?: string;
}

export function posterSources(url: string): PosterSources {
  const match = PLAIN_UPLOAD.exec(url);
  if (!match) return { src: url };
  const at = (width: number) => `${match[1]}f_auto,q_auto,c_limit,w_${width}/${match[2]}`;
  return {
    src: at(800),
    srcSet: WIDTHS.map((width) => `${at(width)} ${width}w`).join(", "),
  };
}

/**
 * `onError` safety net: if a resized variant ever fails to load, show the
 * untouched original URL instead (once — no retry loop).
 */
export function fallbackToOriginal(event: SyntheticEvent<HTMLImageElement>, originalUrl: string) {
  const img = event.currentTarget;
  if (img.dataset.posterFallback || img.src === originalUrl) return;
  img.dataset.posterFallback = "1";
  img.removeAttribute("srcset"); // srcset would otherwise take precedence over src
  img.src = originalUrl;
}
