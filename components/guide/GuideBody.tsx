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
    <p className="m-0 flex flex-wrap items-center gap-2.5 font-mono text-[13px]">
      {/* The marker stays with the link when a long title wraps */}
      <span className="inline-flex items-baseline gap-2.5">
        <span aria-hidden="true" className="inline-block size-3.5 shrink-0 translate-y-0.5 bg-signal" />
        <a href={link.url} target="_blank" rel="noreferrer" className="underline-offset-[3px]">
          {isWikipedia ? link.title : dict.guide.britannica}
        </a>
      </span>
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
      <div className="flex flex-col px-gutter pb-4">
        {sections.map((section, i) => (
          <section
            key={section.name}
            aria-labelledby={`section-${i}`}
            className="stair-step flex flex-col gap-4 pt-10"
            style={{ "--step": i } as React.CSSProperties}
          >
            <div className="flex items-end gap-5 border-b-[3px] border-ink pb-2">
              <span aria-hidden="true" className="poster text-[clamp(48px,6vw,84px)] leading-[0.75] text-signal">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 id={`section-${i}`} className="poster m-0 text-[clamp(28px,3.4vw,48px)] leading-[0.9]">
                {dict.sections[section.name]}
              </h2>
            </div>
            {/* One row per topic: number | title | why + source. On phones the
                text moves under the title. */}
            <div>
              {section.topics.map((topic, j) => (
                <article
                  key={j}
                  className="grid grid-cols-[40px_minmax(0,1fr)] items-baseline gap-x-6 gap-y-1 border-b border-dashed border-rule py-3.5 last:border-b-0 md:grid-cols-[48px_minmax(200px,300px)_minmax(0,1fr)]"
                >
                  <span className="row-span-3 font-mono text-xs tracking-[0.1em] text-concrete md:row-span-2">
                    {i + 1}.{j + 1}
                  </span>
                  <h3 className="poster m-0 text-[26px] leading-[0.95] font-extrabold md:row-span-2">
                    {topic.link ? (
                      <Link href={topicHref(locale, bookId, stage, topic.title)} className="no-underline">
                        {topic.title}
                      </Link>
                    ) : (
                      topic.title
                    )}
                  </h3>
                  {topic.whyItMatters && (
                    <p className="col-start-2 m-0 text-base leading-[1.45] md:col-start-3">{topic.whyItMatters}</p>
                  )}
                  {topic.link && (
                    <div className="col-start-2 md:col-start-3">
                      <ResourceLink link={topic.link} locale={locale} dict={dict} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {further.length > 0 && (
        <section aria-labelledby="further-title" className="mx-gutter mt-8 mb-14 flex flex-col gap-4">
          <h2 id="further-title" className="poster m-0 text-[clamp(48px,6vw,84px)] leading-[0.8]">
            {dict.guide.further[0]} <span className="text-signal">{dict.guide.further[1]}</span>
          </h2>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4 p-0">
            {further.map((topic, i) => (
              // The whole tile is the link: the title's link stretches over it
              <li
                key={i}
                className="relative flex flex-col items-start justify-between gap-4 bg-ink p-5 text-paper transition-colors has-[a]:hover:bg-signal"
              >
                {topic.link ? (
                  <Link
                    href={topicHref(locale, bookId, stage, topic.title)}
                    className="poster text-[26px] leading-none font-extrabold text-paper no-underline after:absolute after:inset-0 after:content-[''] hover:text-paper"
                  >
                    {topic.title}
                  </Link>
                ) : (
                  <span className="poster text-[26px] leading-none font-extrabold">{topic.title}</span>
                )}
                {topic.link && (
                  <span className="font-mono text-xs">
                    {topic.link.source === "wikipedia" ? topic.link.title : dict.guide.britannica}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
