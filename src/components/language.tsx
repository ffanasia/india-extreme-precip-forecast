"use client"

import { Languages } from "lucide-react"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LANGUAGES, english, isLang, loadMessages, makeTranslator, type Lang, type Messages, type Translator } from "@/lib/i18n"

const STORAGE_KEY = "varsha.lang"

type LanguageState = { tr: Translator; lang: Lang; setLang: (lang: Lang) => void; switching: boolean }

const LanguageContext = createContext<LanguageState>({ tr: english, lang: "en", setLang: () => {}, switching: false })

const loaded = new Map<Lang, Partial<Messages>>()

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [tr, setTr] = useState<Translator>(english)
  const [switching, setSwitching] = useState(false)

  const apply = useCallback(async (lang: Lang) => {
    document.documentElement.lang = lang
    if (lang === "en") {
      setTr(english)
      return
    }
    setSwitching(true)
    try {
      let messages = loaded.get(lang)
      if (!messages) {
        messages = await loadMessages(lang)
        loaded.set(lang, messages)
      }
      setTr(makeTranslator(lang, messages))
    } catch {
      document.documentElement.lang = "en"
      setTr(english)
    } finally {
      setSwitching(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const fromUrl = new URLSearchParams(window.location.search).get("lang")
      const stored = window.localStorage.getItem(STORAGE_KEY)
      const initial = isLang(fromUrl) ? fromUrl : isLang(stored) ? stored : "en"
      if (initial !== "en") void apply(initial)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [apply])

  const setLang = useCallback(
    (lang: Lang) => {
      window.localStorage.setItem(STORAGE_KEY, lang)
      const url = new URL(window.location.href)
      if (lang === "en") url.searchParams.delete("lang")
      else url.searchParams.set("lang", lang)
      window.history.replaceState(null, "", url)
      void apply(lang)
    },
    [apply],
  )

  const value = useMemo(() => ({ tr, lang: tr.lang, setLang, switching }), [tr, setLang, switching])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageState {
  return useContext(LanguageContext)
}

const LANGUAGE_ITEMS = LANGUAGES.map((item) => ({
  value: item.code,
  label: item.code === "en" ? item.native : `${item.native} · ${item.name}`,
}))

export function LanguagePicker({ className }: { className?: string }) {
  const { tr, lang, setLang, switching } = useLanguage()
  return (
    <Select
      items={LANGUAGE_ITEMS}
      value={lang}
      onValueChange={(value) => {
        if (typeof value === "string" && isLang(value)) setLang(value)
      }}
    >
      <SelectTrigger size="sm" className={className} aria-label={`${tr.t("ui.language")} (Language)`}>
        <Languages className={switching ? "animate-pulse" : ""} />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGE_ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function TranslationNote() {
  const { tr, lang } = useLanguage()
  if (lang === "en") return null
  return <p className="text-xs leading-5 text-muted-foreground">{tr.t("ui.translationNote")}</p>
}
