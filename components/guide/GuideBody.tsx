import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { Section, Stage } from "@/lib/schemas/guide";
import type { Resource } from "@/lib/schemas/resource";

// Shared by the finished guide and the one still streaming: a streamed topic
// has no link yet and may have half its text
export interface ViewTopic {
  title: string;
  whyItMatters?: string;
  link?: Resource;
}

export interface ViewSection {
  name: Section;
  topics: ViewTopic[];
}

type GuideStrings = Pick<Dictionary, "guide" | "sections">;

function topicHref(locale: Locale, bookId: string, stage: Stage, title: string): string {
  const query = new URLSearchParams({ stage, t: title });
  return `/${locale}/book/${bookId}/topic?${query}`;
}

function ResourceLink({ link, locale, dict }: { link: Resource; locale: Locale; dict: GuideStrings }) {
  const isWikipedia = link.source === "wikipedia";
  return (
    <p className="m-0 mt-1 flex flex-wrap items-center gap-2.5 font-mono text-[13px]">
      <span aria-hidden="true" className="inline-block size-3.5 bg-signal" />
      <a href={link.url} target="_blank" rel="noreferrer" className="underline-offset-[3px]">
        {isWikipedia ? link.title : dict.guide.britannica}
      </a>
      {isWikipedia && <span className="label-mono text-xs text-concrete">{dict.guide.wikipedia}</span>}
      {link.lang !== locale && (
        <span title={dict.guide.englishOnly} className="border-2 border-ink px-1.5 font-medium tracking-[0.08em]">
          {link.lang.toUpperCase()}
        </span>
      )}
    </p>
  );
}

export function GuideBody({
  sections,
  further,
  locale,
  bookId,
  stage,
  dict,
}: {
  sections: ViewSection[];
  further: ViewTopic[];
  locale: Locale;
  bookId: string;
  stage: Stage;
  dict: GuideStrings;
}) {
  return (
    <>
      <div className="flex flex-col px-gutter pb-24">
        {sections.map((section, i) => (
          <section
            key={section.name}
            aria-labelledby={`section-${i}`}
            className="stair-step flex flex-col gap-7 pt-16"
            style={{ "--step": i } as React.CSSProperties}
          >
            <div className="flex items-end gap-5 border-b-[3px] border-ink pb-3">
              <span aria-hidden="true" className="poster text-[clamp(72px,9vw,128px)] leading-[0.75] text-signal">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 id={`section-${i}`} className="poster m-0 text-[clamp(36px,4.4vw,64px)] leading-[0.9]">
                {dict.sections[section.name]}
              </h2>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-x-12 gap-y-10">
              {section.topics.map((topic, j) => (
                <article key={j} className="flex max-w-[620px] flex-col gap-3.5">
                  <span className="font-mono text-xs tracking-[0.1em] text-concrete">
                    {i + 1}.{j + 1}
                  </span>
                  <h3 className="poster m-0 text-[34px] leading-[0.95] font-extrabold">
                    {topic.link ? (
                      <Link href={topicHref(locale, bookId, stage, topic.title)} className="no-underline">
                        {topic.title} →
                      </Link>
                    ) : (
                      topic.title
                    )}
                  </h3>
                  {topic.whyItMatters && <p className="m-0 text-lg leading-relaxed">{topic.whyItMatters}</p>}
                  {topic.link && <ResourceLink link={topic.link} locale={locale} dict={dict} />}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {further.length > 0 && (
        <section
          aria-labelledby="further-title"
          className="flex flex-wrap gap-x-16 gap-y-10 bg-ink px-gutter pt-16 pb-18 text-paper"
        >
          <h2 id="further-title" className="poster m-0 flex-[0_1_360px] text-[clamp(56px,7vw,104px)]">
            {dict.guide.further[0]}
            <br />
            <span className="text-signal">{dict.guide.further[1]}</span>
          </h2>
          <ul className="m-0 grid flex-[1_1_560px] list-none grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] p-0">
            {further.map((topic, i) => (
              <li key={i} className="flex flex-col gap-2.5 border-t-2 border-paper pt-5 pr-6 pb-6">
                {topic.link ? (
                  <Link
                    href={topicHref(locale, bookId, stage, topic.title)}
                    className="poster text-[26px] leading-none font-extrabold text-paper no-underline"
                  >
                    {topic.title}
                  </Link>
                ) : (
                  <span className="poster text-[26px] leading-none font-extrabold">{topic.title}</span>
                )}
                {topic.link && (
                  <a
                    href={topic.link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-concrete-light no-underline"
                  >
                    ↗ {topic.link.source === "wikipedia" ? topic.link.title : dict.guide.britannica}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
