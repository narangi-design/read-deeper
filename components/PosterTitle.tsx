// Book title as poster type. The longer the title, the smaller the type:
// "Dune" bleeds off the edge, "Вверх по лестнице, ведущей вниз" wraps in lines.
const SIZES = {
  hero: [
    { maxLength: 6, className: "whitespace-nowrap text-[clamp(120px,24vw,360px)]" },
    { maxLength: 14, className: "text-[clamp(88px,15vw,230px)]" },
    { maxLength: 24, className: "text-[clamp(64px,11vw,170px)]" },
    { maxLength: Infinity, className: "text-[clamp(52px,9vw,136px)]" },
  ],
  header: [
    { maxLength: 8, className: "text-[clamp(96px,14vw,200px)]" },
    { maxLength: 18, className: "text-[clamp(72px,9vw,140px)]" },
    { maxLength: Infinity, className: "text-[clamp(48px,6vw,96px)]" },
  ],
};

export function posterTitleSize(title: string, variant: keyof typeof SIZES): string {
  return SIZES[variant].find(({ maxLength }) => title.length <= maxLength)!.className;
}

export function PosterTitle({
  title,
  variant,
  id,
}: {
  title: string;
  variant: keyof typeof SIZES;
  id?: string;
}) {
  return (
    <h1
      id={id}
      className={`poster m-0 max-w-[1240px] text-balance text-signal ${variant === "hero" ? "leading-none" : ""} ${posterTitleSize(title, variant)}`}
    >
      {title}
    </h1>
  );
}
