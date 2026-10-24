import Link from "next/link";
import { Suspense } from "react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b-[6px] border-ink px-gutter py-7">
      <Link href={`/${locale}`} className="poster text-[28px] leading-none tracking-[0.02em] text-ink">
        Read<span className="text-signal">/</span>Deeper
      </Link>
      <nav aria-label={dict.nav.language} className="label-mono flex items-center gap-6">
        <Link href={`/${locale}`}>← {dict.nav.newSearch}</Link>
        {/* Reads the current URL on the client; renders a plain fallback until then */}
        <Suspense fallback={<span className="w-[76px]" />}>
          <LanguageSwitch locale={locale} />
        </Suspense>
      </nav>
    </header>
  );
}
