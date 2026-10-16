import type { Metadata } from "next"

import { FarmPlanner } from "@/components/farm-planner"

export const metadata: Metadata = {
  title: "Varsha — farm planner",
  description:
    "Crop-stage farm planner for mainland India: the best day and hour to spray, fertilise, irrigate, sow, and harvest, with air pollution and crop stress alerts.",
}

export default function FarmPage() {
  return <FarmPlanner />
}
