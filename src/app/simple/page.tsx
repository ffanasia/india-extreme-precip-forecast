import type { Metadata } from "next"

import { SimpleView } from "@/components/simple-view"

export const metadata: Metadata = {
  title: "Varsha — heavy rain guide",
  description:
    "Plain-language heavy rain outlook for farms and businesses across mainland India, with what to do over the next week.",
}

export default function SimplePage() {
  return <SimpleView />
}
