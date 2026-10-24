// Grayscale cover over a red block, offset like a poster collage.
// Open Library covers redirect to archive.org, so they skip image optimization.
import Image from "next/image";

const SIZES = {
  large: { width: 300, height: 460, block: "right-0 top-0 h-[78%] w-[82%]", shadow: "shadow-[16px_16px_0_var(--color-ink)]", box: "h-[540px] w-[400px]" },
  small: { width: 130, height: 200, block: "-right-6 top-0 h-[170px] w-[130px]", shadow: "shadow-[8px_8px_0_var(--color-ink)]", box: "h-[220px] w-[150px]" },
};

export function BookCover({
  url,
  alt,
  size,
}: {
  url: string | null;
  alt: string;
  size: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  const src = url && size === "large" ? url.replace("-M.jpg", "-L.jpg") : url;

  return (
    <div className={`relative max-w-full shrink-0 ${s.box}`}>
      <div aria-hidden="true" className={`absolute bg-signal ${s.block}`} />
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={s.width}
          height={s.height}
          unoptimized
          // Above the fold on book and guide pages; the ink fill shows while it loads
          loading="eager"
          className={`absolute bottom-0 left-0 bg-ink cover-mono object-cover ${s.shadow}`}
          style={{ width: s.width, height: s.height }}
        />
      ) : (
        <div
          aria-hidden="true"
          className={`absolute bottom-0 left-0 bg-ink ${s.shadow}`}
          style={{ width: s.width, height: s.height }}
        />
      )}
    </div>
  );
}
