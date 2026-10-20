# Varsha

Extreme precipitation desk for mainland India. It scores the chance of a heavy-rain day at 21 anchors, and sets that short-range guidance next to the local ERA5 baseline, a CMIP6 HighResMIP climate shift, and recent satellite-informed observations.

Andaman and Nicobar and Lakshadweep are outside this desk.

There are three views:

- `/` is the detailed desk for forecasters and researchers: thresholds, windows, model breakdowns, plumes, and the CMIP6 map.
- `/simple` is the heavy rain guide for farmers and non-specialists. It turns the numbers into risk words ("Small chance", "Likely"), natural frequencies ("about 3 in 10"), a day-by-day strip, ground wetness from the satellite layer, and what to do on the farm or for business and travel. Pick a place or use your location; the choice is kept in the link (`/simple?city=chennai`) so it can be shared.
- `/farm` is the farm planner. Choose a place, a crop, and its sowing (or transplanting) date, and it works out the crop stage on each of the next seven days and the best day and hours to spray, top-dress fertiliser, irrigate, sow, harvest, and work outdoors. It raises heat, frost, disease, lodging-wind, heavy-rain, air-quality, and ozone alerts, and lists the crops that grow well in that area by season. Settings live in the link, e.g. `/farm?city=amritsar&crop=mustard&sown=2026-09-28`.

### How the farm planner decides

- **Crop stages** come from days after sowing, using typical durations for eight crops (wheat, transplanted rice, cotton, maize, soybean, chickpea, mustard, potato). Each stage carries a crop coefficient for water use, heat and frost limits, when nitrogen is due, and which diseases matter.
- **Spraying** needs at least three consecutive daylight hours with wind of 3–15 km/h, gusts under 25 km/h, temperature at or below 30 °C, humidity of at least 40%, and no rain in the next five hours.
- **Irrigation** runs a daily soil-water balance: crop water use (FAO-56 reference evaporation times the stage coefficient) minus effective rain, starting from the model's root-zone soil moisture or your last irrigation date. It flags the day the crop would use more than its allowable share of soil water, earlier at critical stages, and holds off if 10 mm or more of rain is due within two days. Frost nights and heat days at sensitive stages add protective irrigation.
- **Fertiliser** is only suggested at stages where a nitrogen dose is due, and never before heavy rain or on waterlogged soil.
- **Sowing** checks the crop's temperature range, workable soil moisture, the usual sowing months, and no heavy rain in the following two days.
- **Disease weather** counts humid hours (relative humidity of 90% or more, or rain) inside each disease's temperature band.
- **Air quality** uses the CPCB AQI bands for PM2.5 and PM10. **Ozone crop stress** uses daily AOT40 (daytime ozone above 40 ppb). CAMS overestimates surface ozone over India, so ozone is shown as a relative crop-stress band and left out of the AQI.
- **What grows well** lists the typical kharif, rabi, and zaid crops and the orchards and plantations around each place, with the soil type, after ICAR agro-climatic zone descriptions (`src/lib/agro/regions.ts`). The season whose sowing window is open comes first. Each crop shows how much water it needs, and the eight planner crops also show whether this week's temperature suits sowing, with a button to plan that crop. Where ERA5 puts annual rain under 600 mm, crops that need less water are listed first.

### Languages

The rain guide and the farm planner can be read in English, Hindi, Marathi, Gujarati, Punjabi, Bengali, Tamil, Telugu, Kannada, and Malayalam. Pick one from the language menu in the header. The choice is saved in the browser and in the link (`/farm?lang=ta`). The detailed desk stays in English.

All text comes from the English catalogue in `src/lib/i18n/en.ts`. Each language in `src/lib/i18n/messages/` must provide every key with the same `{placeholders}`, and the type-checker enforces that. A missing key falls back to English. The translations were drafted by software, so have a native speaker review them before relying on them in the field. Digits stay in Latin script, and Indic Noto Sans fonts are only downloaded when a page shows that script.

Extra sources for the planner: the [Open-Meteo forecast API](https://open-meteo.com/en/docs) (hourly temperature, humidity, rain, wind, FAO-56 evaporation, soil moisture) and the [Open-Meteo air-quality API](https://open-meteo.com/en/docs/air-quality-api) (Copernicus CAMS global PM2.5, PM10, ozone, dust, aerosol optical depth). Both are cached for an hour in `data/cache/farm.json`.

## Sources

- **ERA5** daily precipitation, 1991–2020, from the [Open-Meteo archive](https://open-meteo.com/en/docs/historical-weather-api). Land grid cells, Asia/Kolkata civil days. Used for the wet-day 99th percentile (R99p), IMD-threshold frequencies, calendar-window climatology, and analog years.
- **CMIP6 HighResMIP** (`MPI-ESM1-2-XR`, `EC-Earth3P-HR`, `MRI-AGCM3-2-S`) from the [Open-Meteo climate API](https://open-meteo.com/en/docs/climate-api). Statistically downscaled and bias-corrected to ERA5-Land. Open-Meteo describes these runs as the high-resolution CMIP6 set closest to RCP8.5 through 2050. Varsha compares 1991–2014 with 2031–2049 for June–September and October–December. This layer is not mixed into the weekly probability.
- **Real-time cycle**: ECMWF IFS and NCEP GEFS ensembles from the [Open-Meteo ensemble API](https://open-meteo.com/en/docs/ensemble-api), seven days, equal model weight. The probability is the average of each model’s member frequency of at least one day at or above the threshold.
- **Satellite**: [NASA POWER](https://power.larc.nasa.gov/) `PRECTOTCORR` from GEOS-IT, a satellite- and gauge-informed precipitation analysis. The latest valid day is usually a few days behind the calendar. GPM IMERG Early/Late is the swath product this stands in for; the public PPS archive requires an Earthdata login.

Thresholds follow IMD 24-hour categories: heavy ≥ 64.5 mm, very heavy ≥ 115.6 mm, extremely heavy ≥ 204.5 mm. Local R99p is the ERA5 99th percentile of wet days (≥ 1 mm).

The ensemble frequency is not reliability-calibrated against gauges, and the anchors are cities rather than a full grid. It is not a substitute for an IMD warning.

The mainland outline is Natural Earth 1:50m admin-1, public domain, with island territories removed.

## Run

Needs Node 20.9 or newer and an internet connection for the live feeds.

```bash
npm install
npm run dev
```

On the same computer, open [http://127.0.0.1:43123](http://127.0.0.1:43123).

`http://127.0.0.1:43123` only works on the machine that is running the server. Pasting it into a phone browser looks for a server on the phone, so it fails. The Cursor Preview button is the same idea: it opens the app on your desktop, not on the public internet, and not for other people.

To open it on a phone, run the app on your laptop, keep the phone on the same Wi-Fi, then visit `http://YOUR-LAPTOP-IP:43123` (on macOS: System Settings → Wi-Fi → Details; on Windows: `ipconfig`). Example: `http://192.168.1.12:43123/farm`. If the phone cannot connect, allow Node or port 43123 through the laptop firewall.

### Public HTTPS (any phone, any network)

A live public URL is running for this session:

- Farm planner: https://49410aacd39908.lhr.life/farm
- Rain guide: https://49410aacd39908.lhr.life/simple
- Detailed desk: https://49410aacd39908.lhr.life/

Paste those into a phone browser. They work off your Wi-Fi. This tunnel stays up only while this Cursor agent VM is running; it is not a permanent domain.

For a lasting public site, connect this repo to [Vercel](https://vercel.com) (Next.js) or [Render](https://render.com) / [Fly.io](https://fly.io) with the `Dockerfile` in the repo root. No API keys are required. Open-Meteo’s free tier is for non-commercial use; check their licence before a public commercial launch.

`data/climatology.json` is committed, so a fresh clone works without rebuilding it. To refresh the ERA5 and CMIP6 layer, run `npm run climatology`; it makes about 30 large archive requests, writes raw responses to `data/raw/`, and reuses them on later runs. The desk caches the live ensemble and satellite pull for 30 minutes in `data/cache/`.

For a faster local server, run `npm run build && npm start` on the same port.

```bash
npm test
npm run lint
```

No API key is required. Open-Meteo’s free tier is for non-commercial use; see their licence if you deploy this beyond research.
