import type { Metadata } from "next";
import { Fira_Sans_Extra_Condensed, Golos_Text, JetBrains_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, LOCALES } from "@/lib/i18n/locales";
import "../globals.css";

const firaCondensed = Fira_Sans_Extra_Condensed({
  variable: "--font-fira-condensed",
  weight: ["300", "800", "900"],
  subsets: ["latin", "cyrillic"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "cyrillic"],
});

const golos = Golos_Text({
  variable: "--font-golos",
  subsets: ["latin", "cyrillic"],
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const { meta } = getDictionary(lang);
  return { title: { default: meta.title, template: `%s — ${meta.title}` }, description: meta.description };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      className={`${firaCondensed.variable} ${jetbrains.variable} ${golos.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        <Header locale={lang} dict={getDictionary(lang)} />
        {children}
      </body>
    </html>
  );
}
