/* global React, imageSrcset */

/* ============================================================
   PICTURE COMPONENT
   - Serves AVIF -> WebP -> original JPG/PNG via <picture>.
   - The .avif/.webp siblings (and their -480/-960 width
     variants) are produced at build time by
     scripts/optimize-images.js; imageSrcset (ui-helpers.js)
     describes that set, so paths are derived, never listed.
   - With a `sizes` hint the sources advertise the width
     variants and small slots (cards, phones) download small
     files; without one the full variant stays the single
     candidate, exactly as before.
   - Accepts the same props as <img>; defaults match the rest
     of the site (lazy + async).
   ============================================================ */

function Picture({
  src,
  alt,
  width,
  height,
  sizes,
  loading = "lazy",
  decoding = "async",
  fetchPriority,
  className,
}) {
  if (!src) return null;
  if (!/\.(jpe?g|png)$/i.test(src)) {
    return <img src={src} alt={alt} width={width} height={height}
                loading={loading} decoding={decoding}
                fetchPriority={fetchPriority} className={className} />;
  }
  const base = src.replace(/\.(jpe?g|png)$/i, "");
  const srcSetFor = (ext) => (sizes ? imageSrcset(src, ext) : `${base}.${ext}`);

  return (
    <picture>
      <source srcSet={srcSetFor("avif")} sizes={sizes} type="image/avif" />
      <source srcSet={srcSetFor("webp")} sizes={sizes} type="image/webp" />
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        className={className}
      />
    </picture>
  );
}

window.Picture = Picture;
