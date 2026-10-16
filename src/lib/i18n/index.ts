import { en, type Key, type Messages } from "./en"

export type { Key, Messages }

export const LANGUAGES = [
  { code: "en", name: "English", native: "English", locale: "en-IN" },
  { code: "hi", name: "Hindi", native: "हिन्दी", locale: "hi-IN" },
  { code: "mr", name: "Marathi", native: "मराठी", locale: "mr-IN" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", locale: "gu-IN" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", locale: "pa-IN" },
  { code: "bn", name: "Bengali", native: "বাংলা", locale: "bn-IN" },
  { code: "ta", name: "Tamil", native: "தமிழ்", locale: "ta-IN" },
  { code: "te", name: "Telugu", native: "తెలుగు", locale: "te-IN" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", locale: "kn-IN" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", locale: "ml-IN" },
] as const

export type Lang = (typeof LANGUAGES)[number]["code"]

export function isLang(value: string | null | undefined): value is Lang {
  return LANGUAGES.some((item) => item.code === value)
}

export type Params = Record<string, string | number>

export type Translator = {
  lang: Lang
  locale: string
  t: (key: Key, params?: Params) => string
  /** Lower-cases a name for use mid-sentence; only English needs it. */
  lower: (text: string) => string
  /** "Sat 17 Oct" in the reader's language. */
  day: (iso: string) => string
  /** "17 Oct" */
  date: (iso: string) => string
  /** "Saturday" or "Sat" */
  weekday: (iso: string, width?: "long" | "short") => string
  issued: (iso: string) => string
  has: (key: string) => key is Key
}

function utc(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function fill(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))
}

export function makeTranslator(lang: Lang, messages: Partial<Messages> | null): Translator {
  const locale = LANGUAGES.find((item) => item.code === lang)?.locale ?? "en-IN"
  const formatter = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone: "UTC", numberingSystem: "latn", ...options })
  const dayFormat = formatter({ weekday: "short", day: "numeric", month: "short" })
  const dateFormat = formatter({ day: "numeric", month: "short" })
  const longWeekday = formatter({ weekday: "long" })
  const shortWeekday = formatter({ weekday: "short" })
  const issuedFormat = new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Kolkata",
    numberingSystem: "latn",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
  const english = lang === "en"
  return {
    lang,
    locale,
    t: (key, params) => fill(messages?.[key] ?? en[key] ?? key, params),
    lower: (text) => (english ? text.toLowerCase() : text),
    day: (iso) => (english ? `${shortWeekday.format(utc(iso))} ${dateFormat.format(utc(iso))}` : dayFormat.format(utc(iso))),
    date: (iso) => dateFormat.format(utc(iso)),
    weekday: (iso, width = "short") => (width === "long" ? longWeekday : shortWeekday).format(utc(iso)),
    issued: (iso) => issuedFormat.format(new Date(iso)),
    has: (key): key is Key => key in en,
  }
}

export const english = makeTranslator("en", en)

export async function loadMessages(lang: Lang): Promise<Partial<Messages>> {
  switch (lang) {
    case "hi":
      return (await import("./messages/hi")).messages
    case "mr":
      return (await import("./messages/mr")).messages
    case "gu":
      return (await import("./messages/gu")).messages
    case "pa":
      return (await import("./messages/pa")).messages
    case "bn":
      return (await import("./messages/bn")).messages
    case "ta":
      return (await import("./messages/ta")).messages
    case "te":
      return (await import("./messages/te")).messages
    case "kn":
      return (await import("./messages/kn")).messages
    case "ml":
      return (await import("./messages/ml")).messages
    default:
      return en
  }
}
