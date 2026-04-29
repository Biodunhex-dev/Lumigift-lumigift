import Image from "next/image";
import styles from "./GiftMedia.module.css";

interface GiftMediaProps {
  /** Full Cloudinary URL, e.g. https://res.cloudinary.com/<cloud>/image/upload/... */
  src: string;
  alt: string;
  /** Rendered width in pixels (used for layout/sizing hint). Defaults to 600. */
  width?: number;
  /** Rendered height in pixels. Defaults to 400. */
  height?: number;
  /** Mark as priority (LCP image) — disables lazy loading for above-the-fold images. */
  priority?: boolean;
}

/**
 * Renders a Cloudinary gift media image using next/image for automatic:
 * - WebP/AVIF conversion
 * - Responsive srcset generation
 * - Lazy loading (unless priority=true)
 * - Proper sizing hints to avoid layout shift
 */
export function GiftMedia({
  src,
  alt,
  width = 600,
  height = 400,
  priority = false,
}: GiftMediaProps) {
  return (
    <div className={styles.wrapper}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        sizes="(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 600px"
        className={styles.image}
      />
    </div>
  );
}
