"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LOCALES, type Locale } from "@/lib/i18n/locales";

// Same page in the other language: swaps the locale prefix, keeps the query
export function LanguageSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();

  return (
    <span className="flex gap-2">
      {LOCALES.map((target) => {
        const href = pathname.replace(`/${locale}`, `/${target}`) + (query ? `?${query}` : "");
        const current = target === locale;
        return (
          <Link
            key={target}
            href={href}
            hrefLang={target}
            aria-current={current ? "true" : undefined}
            className={`px-2 py-1 no-underline ${current ? "bg-ink text-paper hover:text-paper" : ""}`}
          >
            {target.toUpperCase()}
          </Link>
        );
      })}
    </span>
  );
}
