import type { Metadata } from "next"
import {
  Fraunces,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
} from "next/font/google"

import { LanguageProvider } from "@/components/language"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
})

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
})

// Indic faces are only fetched when a page shows text in that script.
const indic = { weight: ["400", "500", "600"], preload: false, display: "swap" } satisfies {
  weight: ("400" | "500" | "600")[]
  preload: boolean
  display: "swap"
}
const devanagari = Noto_Sans_Devanagari({ ...indic, variable: "--font-deva", subsets: ["devanagari"] })
const gujarati = Noto_Sans_Gujarati({ ...indic, variable: "--font-gujr", subsets: ["gujarati"] })
const gurmukhi = Noto_Sans_Gurmukhi({ ...indic, variable: "--font-guru", subsets: ["gurmukhi"] })
const bengali = Noto_Sans_Bengali({ ...indic, variable: "--font-beng", subsets: ["bengali"] })
const tamil = Noto_Sans_Tamil({ ...indic, variable: "--font-taml", subsets: ["tamil"] })
const telugu = Noto_Sans_Telugu({ ...indic, variable: "--font-telu", subsets: ["telugu"] })
const kannada = Noto_Sans_Kannada({ ...indic, variable: "--font-knda", subsets: ["kannada"] })
const malayalam = Noto_Sans_Malayalam({ ...indic, variable: "--font-mlym", subsets: ["malayalam"] })

const fontVariables = [plex, plexMono, fraunces, devanagari, gujarati, gurmukhi, bengali, tamil, telugu, kannada, malayalam]
  .map((font) => font.variable)
  .join(" ")

export const metadata: Metadata = {
  title: "Varsha — extreme precipitation, mainland India",
  description:
    "Short-range ensemble guidance for heavy rain over mainland India, set against ERA5 climatology, CMIP6 HighResMIP, and satellite-informed observations.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} dark h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
        <LanguageProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
