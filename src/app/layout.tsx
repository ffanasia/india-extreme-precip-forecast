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
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-deva",
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
  preload: false,
  display: "swap",
})
const gujarati = Noto_Sans_Gujarati({
  variable: "--font-gujr",
  subsets: ["gujarati"],
  weight: ["400", "500", "600"],
  preload: false,
  display: "swap",
})
const gurmukhi = Noto_Sans_Gurmukhi({
  variable: "--font-guru",
  subsets: ["gurmukhi"],
  weight: ["400", "500", "600"],
  preload: false,
  display: "swap",
})
const bengali = Noto_Sans_Bengali({
  variable: "--font-beng",
  subsets: ["bengali"],
  weight: ["400", "500", "600"],
  preload: false,
  display: "swap",
})
const tamil = Noto_Sans_Tamil({
  variable: "--font-taml",
  subsets: ["tamil"],
  weight: ["400", "500", "600"],
  preload: false,
  display: "swap",
})
const telugu = Noto_Sans_Telugu({
  variable: "--font-telu",
  subsets: ["telugu"],
  weight: ["400", "500", "600"],
  preload: false,
  display: "swap",
})
const kannada = Noto_Sans_Kannada({
  variable: "--font-knda",
  subsets: ["kannada"],
  weight: ["400", "500", "600"],
  preload: false,
  display: "swap",
})
const malayalam = Noto_Sans_Malayalam({
  variable: "--font-mlym",
  subsets: ["malayalam"],
  weight: ["400", "500", "600"],
  preload: false,
  display: "swap",
})

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
