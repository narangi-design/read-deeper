import type { Locale } from "@/lib/i18n/locales";
import type { Section } from "@/lib/schemas/guide";

// One count, several word forms: "1 edition / 5 editions", "1 издание / 2 издания / 5 изданий"
type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

// Typed as all plural forms, so other languages can add few/many
const forms = (wordForms: PluralForms) => wordForms;

export function plural(locale: Locale, count: number, forms: PluralForms): string {
  const rule = new Intl.PluralRules(locale).select(count);
  return `${count} ${forms[rule] ?? forms.other}`;
}

const en = {
  meta: {
    title: "Read Deeper",
    description: "The context that makes a book richer — history, ideas, influences.",
  },
  nav: {
    newSearch: "New search",
    language: "Language",
  },
  search: {
    title: "Read deeper",
    tagline: "Find a book. Get the context that makes it richer.",
    label: "Book title or author",
    placeholder: "Dune, Pale Fire, Bulgakov…",
    submit: "Find",
    results: "Results",
    searching: "Searching Wikidata and Open Library",
    noResults: "Nothing found. Try the original title or the author's name.",
    error: "Book search is unavailable right now. Try again in a minute.",
  },
  book: {
    editions: forms({ one: "edition", other: "editions" }),
    question: "Where are you with this book?",
    before: { step: "01 / before", title: "About to read", hint: "Background with no spoilers" },
    after: { step: "02 / after", title: "Finished it", hint: "Symbols, references and influences" },
    wrongBook: "Not this book? Back to search",
    cover: "Cover of",
  },
  guide: {
    stage: { before: "Before reading", after: "After reading" },
    stageNav: "Reading stage",
    summary: { before: "Context before reading", after: "Context after reading" },
    further: ["Go", "deeper"],
    wikipedia: "Wikipedia",
    britannica: "Search Britannica",
    englishOnly: "No article in your language",
    unfamiliar:
      "We don't know this book well enough to recommend context without guessing. Try another edition or a better-known book.",
    obscure: "This book is rarely catalogued — the guide may be less precise.",
    loading: "Picking the context",
    loadingTopics: forms({ one: "topic", other: "topics" }),
    error: "The guide couldn't be generated — the model may be busy.",
    retry: "Try again",
    footer: "Read/Deeper — context, not a summary",
    sources: "Sources: Open Library, Wikipedia",
  },
  sections: {
    "Literary Influences": "Literary influences",
    "Genre & Form": "Genre & form",
    "Author's Life": "Author's life",
    "Historical Events": "Historical events",
    "Politics & Power": "Politics & power",
    "Society & Class": "Society & class",
    "Culture & Customs": "Culture & customs",
    "Religion & Mythology": "Religion & mythology",
    Philosophy: "Philosophy",
    "Science & Technology": "Science & technology",
    Psychology: "Psychology",
    "Art & Music": "Art & music",
    "Language & Style": "Language & style",
    "Places & Geography": "Places & geography",
    "Economics & Work": "Economics & work",
    "Gender & Family": "Gender & family",
    "Law & Justice": "Law & justice",
    "War & Conflict": "War & conflict",
    "Symbols & Allusions": "Symbols & allusions",
    "Reception & Legacy": "Reception & legacy",
  } satisfies Record<Section, string>,
};

export type Dictionary = typeof en;

const ru: Dictionary = {
  meta: {
    title: "Read Deeper",
    description: "Контекст, который делает книгу глубже: история, идеи, влияния.",
  },
  nav: {
    newSearch: "Новый поиск",
    language: "Язык",
  },
  search: {
    title: "Читать глубже",
    tagline: "Найдите книгу — и контекст, который сделает её глубже.",
    label: "Название книги или автор",
    placeholder: "Dune, Pale Fire, Булгаков…",
    submit: "Найти",
    results: "Результаты",
    searching: "Ищем в Wikidata и Open Library",
    noResults: "Ничего не нашлось. Попробуйте оригинальное название или имя автора.",
    error: "Поиск книг сейчас недоступен. Попробуйте через минуту.",
  },
  book: {
    editions: { one: "издание", few: "издания", many: "изданий", other: "издания" },
    // Non-breaking space: a one-letter preposition never ends a line
    question: "Где вы сейчас с этой книгой?",
    before: { step: "01 / до", title: "Собираюсь читать", hint: "Фон и контекст без спойлеров" },
    after: { step: "02 / после", title: "Уже прочитано", hint: "Символы, отсылки и влияния" },
    wrongBook: "Не та книга? Вернуться к поиску",
    cover: "Обложка книги",
  },
  guide: {
    stage: { before: "До чтения", after: "После чтения" },
    stageNav: "Стадия чтения",
    summary: { before: "Контекст перед чтением", after: "Контекст после чтения" },
    further: ["Ещё", "глубже"],
    wikipedia: "Википедия",
    britannica: "Поиск в Britannica",
    englishOnly: "Статьи на русском нет",
    unfamiliar:
      "Мы пока мало знаем об этой книге и не хотим подбирать контекст наугад. Попробуйте другое издание или более известную книгу.",
    obscure: "Эта книга редко встречается в каталогах — гайд может быть неточным.",
    loading: "Подбираем контекст",
    loadingTopics: { one: "тема", few: "темы", many: "тем", other: "темы" },
    error: "Не получилось собрать гайд — возможно, модель перегружена.",
    retry: "Попробовать ещё раз",
    footer: "Read/Deeper — контекст, а не пересказ",
    sources: "Источники: Open Library, Wikipedia",
  },
  sections: {
    "Literary Influences": "Литературные влияния",
    "Genre & Form": "Жанр и форма",
    "Author's Life": "Жизнь автора",
    "Historical Events": "Исторические события",
    "Politics & Power": "Политика и власть",
    "Society & Class": "Общество и классы",
    "Culture & Customs": "Культура и обычаи",
    "Religion & Mythology": "Религия и мифология",
    Philosophy: "Философия",
    "Science & Technology": "Наука и технологии",
    Psychology: "Психология",
    "Art & Music": "Искусство и музыка",
    "Language & Style": "Язык и стиль",
    "Places & Geography": "Места и география",
    "Economics & Work": "Экономика и труд",
    "Gender & Family": "Гендер и семья",
    "Law & Justice": "Право и правосудие",
    "War & Conflict": "Война и конфликты",
    "Symbols & Allusions": "Символы и аллюзии",
    "Reception & Legacy": "Восприятие и наследие",
  },
};

const dictionaries: Record<Locale, Dictionary> = { en, ru };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
