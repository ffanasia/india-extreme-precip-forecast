export type IrrigationNeed = "normal" | "critical" | "light" | "ponded" | "stop"

export type Stage = {
  id: string
  name: string
  /** Inclusive range of days after sowing, transplanting, or planting. */
  from: number
  to: number
  /** FAO-56 style crop coefficient applied to reference evapotranspiration. */
  kc: number
  irrigation: IrrigationNeed
  heatMax?: number
  coldMin?: number
  lodging?: boolean
  harvest?: boolean
  nitrogen?: string
  focus: string
}

export type Disease = {
  name: string
  tMin: number
  tMax: number
  /** Humid hours in a day (relative humidity at or above `rh`, or rain) that favour infection. */
  wetHours: number
  rh?: number
  stages: string[]
  scout: string
}

export type Crop = {
  id: string
  name: string
  local: string
  season: string
  startLabel: "sowing" | "transplanting" | "planting"
  sowMonths: number[]
  sowTemp: [number, number]
  /** Fraction of available soil water the crop can use before stress (FAO-56 p). */
  depletion: number
  ozone: "high" | "medium" | "low"
  stages: Stage[]
  diseases: Disease[]
}

export const CROPS: Crop[] = [
  {
    id: "wheat",
    name: "Wheat",
    local: "Gehun",
    season: "Rabi",
    startLabel: "sowing",
    sowMonths: [10, 11, 12],
    sowTemp: [16, 23],
    depletion: 0.55,
    ozone: "high",
    stages: [
      { id: "emergence", name: "Sowing and emergence", from: 0, to: 20, kc: 0.4, irrigation: "normal", focus: "Even emergence. Keep the seed bed moist and watch for termites." },
      {
        id: "crown_root",
        name: "Crown root initiation",
        from: 21,
        to: 30,
        kc: 0.7,
        irrigation: "critical",
        nitrogen: "Top-dress the second nitrogen dose with the first irrigation.",
        focus: "The first irrigation, about 21 days after sowing, matters more than any other. Missing it cuts tillers and yield.",
      },
      { id: "tillering", name: "Tillering", from: 31, to: 60, kc: 0.95, irrigation: "normal", nitrogen: "Apply the last nitrogen dose by about 45 days if you split it in three.", focus: "Weed control and the second irrigation. First rust scouting in the north." },
      { id: "jointing", name: "Jointing and booting", from: 61, to: 80, kc: 1.15, irrigation: "critical", coldMin: 3, focus: "Water demand rises fast. Frost now damages the developing ear." },
      { id: "flowering", name: "Heading and flowering", from: 81, to: 95, kc: 1.15, irrigation: "critical", heatMax: 32, coldMin: 3, lodging: true, focus: "Heat above 32 °C or frost now causes empty grains. Avoid irrigating on windy days to prevent lodging." },
      { id: "grain_fill", name: "Grain filling", from: 96, to: 120, kc: 0.9, irrigation: "critical", heatMax: 34, lodging: true, focus: "Terminal heat above 34 °C shrivels grain. A light irrigation helps the crop ride out a hot spell." },
      { id: "maturity", name: "Maturity and harvest", from: 121, to: 140, kc: 0.3, irrigation: "stop", harvest: true, focus: "Stop irrigating. Harvest when grain is hard and straw is golden, on dry days." },
    ],
    diseases: [
      { name: "Yellow rust", tMin: 10, tMax: 20, wetHours: 6, stages: ["tillering", "jointing", "flowering"], scout: "Look for yellow powdery stripes on leaves, starting in patches." },
      { name: "Leaf blight", tMin: 18, tMax: 28, wetHours: 10, stages: ["jointing", "flowering", "grain_fill"], scout: "Look for brown oval spots with yellow edges on lower leaves." },
    ],
  },
  {
    id: "rice",
    name: "Rice (transplanted)",
    local: "Dhaan",
    season: "Kharif",
    startLabel: "transplanting",
    sowMonths: [6, 7, 8],
    sowTemp: [22, 34],
    depletion: 0.2,
    ozone: "medium",
    stages: [
      { id: "establishment", name: "Establishment", from: 0, to: 15, kc: 1.05, irrigation: "ponded", focus: "Keep 2–5 cm of standing water so seedlings root and weeds stay down." },
      { id: "tillering", name: "Tillering", from: 16, to: 40, kc: 1.1, irrigation: "ponded", nitrogen: "Top-dress nitrogen at active tillering, about 20–25 days after transplanting.", focus: "Tiller count is set now. Keep water shallow." },
      { id: "panicle", name: "Panicle initiation", from: 41, to: 60, kc: 1.2, irrigation: "ponded", nitrogen: "Apply the last nitrogen dose at panicle initiation.", focus: "Do not let the field dry out. Water stress now reduces grain number." },
      { id: "flowering", name: "Flowering", from: 61, to: 75, kc: 1.2, irrigation: "ponded", heatMax: 35, focus: "Heat above 35 °C at flowering causes empty grains. Keep water standing." },
      { id: "grain_fill", name: "Grain filling", from: 76, to: 100, kc: 1.0, irrigation: "ponded", lodging: true, focus: "Keep soil saturated. Strong wind can flatten the crop." },
      { id: "maturity", name: "Maturity and harvest", from: 101, to: 115, kc: 0.6, irrigation: "stop", harvest: true, focus: "Drain the field about 10 days before harvest. Harvest on dry days and dry the grain quickly." },
    ],
    diseases: [
      { name: "Blast", tMin: 20, tMax: 28, wetHours: 10, stages: ["tillering", "panicle", "flowering"], scout: "Look for eye-shaped grey spots with brown edges on leaves and neck." },
      { name: "Sheath blight", tMin: 26, tMax: 33, wetHours: 12, stages: ["tillering", "panicle", "flowering", "grain_fill"], scout: "Look for grey-green blotches on the sheath near the water line." },
    ],
  },
  {
    id: "cotton",
    name: "Cotton",
    local: "Kapas",
    season: "Kharif",
    startLabel: "sowing",
    sowMonths: [4, 5, 6],
    sowTemp: [20, 32],
    depletion: 0.65,
    ozone: "medium",
    stages: [
      { id: "emergence", name: "Emergence", from: 0, to: 20, kc: 0.45, irrigation: "normal", focus: "Gap filling and thinning. Watch for jassids and thrips." },
      { id: "vegetative", name: "Vegetative growth", from: 21, to: 55, kc: 0.75, irrigation: "normal", nitrogen: "First nitrogen top-dressing at about 30–35 days, after thinning.", focus: "Weed control and earthing up." },
      { id: "squaring", name: "Square formation", from: 56, to: 75, kc: 1.0, irrigation: "normal", nitrogen: "Second nitrogen dose at square formation.", focus: "Scout for pink bollworm in squares and flowers." },
      { id: "flowering", name: "Flowering and boll formation", from: 76, to: 115, kc: 1.15, irrigation: "critical", heatMax: 40, focus: "Peak water need. Heat above 40 °C or dry soil makes squares and bolls drop." },
      { id: "boll_open", name: "Boll opening", from: 116, to: 150, kc: 0.8, irrigation: "normal", harvest: true, focus: "Pick opened bolls on dry days. Rain on open bolls stains and weakens the lint." },
      { id: "picking", name: "Final picking", from: 151, to: 180, kc: 0.6, irrigation: "stop", harvest: true, focus: "Stop irrigating. Finish picking and destroy stalks to break the pink bollworm cycle." },
    ],
    diseases: [
      { name: "Boll rot", tMin: 25, tMax: 33, wetHours: 12, stages: ["flowering", "boll_open"], scout: "Look for dark, soft lower bolls after spells of humid weather." },
      { name: "Grey mildew", tMin: 20, tMax: 30, wetHours: 10, stages: ["squaring", "flowering"], scout: "Look for pale angular spots with white powder under the leaves." },
    ],
  },
  {
    id: "maize",
    name: "Maize",
    local: "Makka",
    season: "Kharif and rabi",
    startLabel: "sowing",
    sowMonths: [6, 7, 10, 11],
    sowTemp: [18, 32],
    depletion: 0.55,
    ozone: "low",
    stages: [
      { id: "emergence", name: "Emergence", from: 0, to: 15, kc: 0.4, irrigation: "normal", focus: "Even stand. Watch for fall armyworm in the leaf whorl." },
      { id: "vegetative", name: "Knee-high and vegetative", from: 16, to: 45, kc: 0.8, irrigation: "normal", nitrogen: "Top-dress nitrogen at knee-high, about 25–30 days after sowing.", focus: "Weed control and earthing up. Keep scouting the whorl for armyworm." },
      { id: "tasseling", name: "Tasselling and silking", from: 46, to: 65, kc: 1.2, irrigation: "critical", heatMax: 35, nitrogen: "Apply the last nitrogen dose just before tasselling.", focus: "The most water-sensitive stage. Dry soil or heat above 35 °C now leaves cobs half filled." },
      { id: "grain_fill", name: "Grain filling", from: 66, to: 95, kc: 1.05, irrigation: "critical", lodging: true, focus: "Keep soil moist until the grain dents." },
      { id: "maturity", name: "Maturity and harvest", from: 96, to: 110, kc: 0.5, irrigation: "stop", harvest: true, focus: "Harvest when husks are dry and grain shows a black layer. Dry cobs before storage." },
    ],
    diseases: [
      { name: "Turcicum leaf blight", tMin: 18, tMax: 27, wetHours: 10, stages: ["vegetative", "tasseling", "grain_fill"], scout: "Look for long grey-green cigar-shaped lesions on leaves." },
    ],
  },
  {
    id: "soybean",
    name: "Soybean",
    local: "Soyabean",
    season: "Kharif",
    startLabel: "sowing",
    sowMonths: [6, 7],
    sowTemp: [22, 32],
    depletion: 0.5,
    ozone: "high",
    stages: [
      { id: "emergence", name: "Emergence", from: 0, to: 15, kc: 0.4, irrigation: "normal", focus: "Even stand. Drain standing water after heavy showers." },
      { id: "vegetative", name: "Vegetative growth", from: 16, to: 40, kc: 0.8, irrigation: "normal", focus: "Weed control in the first 30–45 days. Watch for girdle beetle and semilooper." },
      { id: "flowering", name: "Flowering", from: 41, to: 60, kc: 1.1, irrigation: "critical", heatMax: 35, focus: "Dry spells now cause flower drop. Give a protective irrigation if rain fails." },
      { id: "pod_fill", name: "Pod filling", from: 61, to: 90, kc: 1.1, irrigation: "critical", focus: "Water stress shrinks seed size. Scout for pod borers." },
      { id: "maturity", name: "Maturity and harvest", from: 91, to: 105, kc: 0.5, irrigation: "stop", harvest: true, focus: "Harvest when most pods turn brown. Rain at harvest causes shattering and poor seed." },
    ],
    diseases: [
      { name: "Rust", tMin: 18, tMax: 28, wetHours: 10, stages: ["flowering", "pod_fill"], scout: "Look for tan to reddish-brown pustules under lower leaves." },
      { name: "Anthracnose and pod blight", tMin: 25, tMax: 32, wetHours: 12, stages: ["flowering", "pod_fill"], scout: "Look for dark sunken spots on stems and pods." },
    ],
  },
  {
    id: "chickpea",
    name: "Chickpea",
    local: "Chana",
    season: "Rabi",
    startLabel: "sowing",
    sowMonths: [10, 11],
    sowTemp: [18, 27],
    depletion: 0.5,
    ozone: "medium",
    stages: [
      { id: "emergence", name: "Emergence", from: 0, to: 20, kc: 0.4, irrigation: "normal", focus: "Even stand. Watch for wilt patches and cutworm." },
      { id: "branching", name: "Branching", from: 21, to: 45, kc: 0.7, irrigation: "normal", focus: "Nipping the tips at about 30–40 days encourages branching. Give one light irrigation before flowering if the soil is dry." },
      { id: "flowering", name: "Flowering", from: 46, to: 75, kc: 1.0, irrigation: "light", heatMax: 30, coldMin: 4, focus: "Avoid heavy irrigation now: it causes flower drop and excess leaf growth. Frost below 4 °C kills flowers. Scout for pod borer." },
      { id: "pod_fill", name: "Pod filling", from: 76, to: 100, kc: 1.0, irrigation: "critical", heatMax: 32, focus: "One light irrigation at pod filling raises yield if the soil is dry." },
      { id: "maturity", name: "Maturity and harvest", from: 101, to: 120, kc: 0.35, irrigation: "stop", harvest: true, focus: "Harvest when leaves turn reddish-brown and pods rattle." },
    ],
    diseases: [
      { name: "Botrytis grey mould", tMin: 18, tMax: 26, wetHours: 10, stages: ["flowering", "pod_fill"], scout: "Look for grey fuzzy growth on flowers and pods in dense patches." },
      { name: "Ascochyta blight", tMin: 15, tMax: 25, wetHours: 12, stages: ["branching", "flowering", "pod_fill"], scout: "Look for brown spots with dark rings on leaves, stems, and pods." },
    ],
  },
  {
    id: "mustard",
    name: "Mustard",
    local: "Sarson",
    season: "Rabi",
    startLabel: "sowing",
    sowMonths: [10, 11],
    sowTemp: [18, 27],
    depletion: 0.6,
    ozone: "medium",
    stages: [
      { id: "emergence", name: "Emergence", from: 0, to: 15, kc: 0.35, irrigation: "normal", focus: "Thin to one plant every 10–15 cm about two weeks after sowing." },
      {
        id: "rosette",
        name: "Rosette",
        from: 16,
        to: 35,
        kc: 0.7,
        irrigation: "critical",
        nitrogen: "Top-dress the remaining nitrogen with the first irrigation, about 30 days after sowing.",
        focus: "The first irrigation at about 30 days sets up branching.",
      },
      { id: "flowering", name: "Flowering", from: 36, to: 70, kc: 1.05, irrigation: "critical", coldMin: 3, focus: "Aphids build up in cool, cloudy, humid weather. Frost damages flowers and young pods." },
      { id: "pod_fill", name: "Pod filling", from: 71, to: 105, kc: 0.95, irrigation: "critical", coldMin: 3, focus: "A second irrigation at pod filling helps seed weight." },
      { id: "maturity", name: "Maturity and harvest", from: 106, to: 125, kc: 0.35, irrigation: "stop", harvest: true, focus: "Harvest when about three-quarters of pods turn yellow, in the morning, to cut shattering." },
    ],
    diseases: [
      { name: "Aphids", tMin: 10, tMax: 20, wetHours: 12, rh: 75, stages: ["flowering", "pod_fill"], scout: "Check the top 10 cm of shoots; act when about a quarter of plants carry colonies." },
      { name: "Alternaria blight", tMin: 18, tMax: 27, wetHours: 10, stages: ["flowering", "pod_fill"], scout: "Look for round brown spots with rings on leaves and pods." },
      { name: "White rust", tMin: 10, tMax: 20, wetHours: 8, stages: ["rosette", "flowering"], scout: "Look for white blisters under leaves." },
    ],
  },
  {
    id: "potato",
    name: "Potato",
    local: "Aloo",
    season: "Rabi",
    startLabel: "planting",
    sowMonths: [10, 11],
    sowTemp: [15, 25],
    depletion: 0.35,
    ozone: "high",
    stages: [
      { id: "sprouting", name: "Planting and sprouting", from: 0, to: 20, kc: 0.5, irrigation: "normal", focus: "Light, frequent irrigation keeps ridges moist without rotting the seed." },
      { id: "vegetative", name: "Vegetative growth", from: 21, to: 35, kc: 0.8, irrigation: "normal", nitrogen: "Top-dress nitrogen at earthing up, about 25–30 days after planting.", focus: "Earthing up covers forming tubers." },
      { id: "tuber_init", name: "Tuber initiation", from: 36, to: 55, kc: 1.1, irrigation: "critical", coldMin: 2, focus: "Keep soil evenly moist. Uneven watering now causes cracked and misshapen tubers." },
      { id: "bulking", name: "Tuber bulking", from: 56, to: 85, kc: 1.1, irrigation: "critical", coldMin: 2, focus: "Peak water need. Irrigate lightly before a frosty night." },
      { id: "maturity", name: "Maturity and dehaulming", from: 86, to: 100, kc: 0.7, irrigation: "stop", harvest: true, focus: "Stop irrigating about 10 days before cutting haulms. Dig 10–15 days after dehaulming so skins set." },
    ],
    diseases: [
      { name: "Late blight", tMin: 10, tMax: 25, wetHours: 10, stages: ["vegetative", "tuber_init", "bulking"], scout: "Look for dark water-soaked patches on leaves with white growth underneath in the morning." },
    ],
  },
]

export function cropById(id: string | null | undefined): Crop | null {
  return CROPS.find((crop) => crop.id === id) ?? null
}

export function stageOn(crop: Crop, das: number): Stage | null {
  if (das < 0) return null
  const last = crop.stages[crop.stages.length - 1]
  if (das > last.to) return last
  return crop.stages.find((stage) => das >= stage.from && das <= stage.to) ?? null
}
