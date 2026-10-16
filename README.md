# Varsha

Extreme precipitation desk for mainland India. It scores the chance of a heavy-rain day at 21 anchors, and sets that short-range guidance next to the local ERA5 baseline, a CMIP6 HighResMIP climate shift, and recent satellite-informed observations.

Andaman and Nicobar and Lakshadweep are outside this desk.

There are two views of the same forecast:

- `/` is the detailed desk for forecasters and researchers: thresholds, windows, model breakdowns, plumes, and the CMIP6 map.
- `/simple` is the heavy rain guide for farmers and non-specialists. It turns the numbers into risk words ("Small chance", "Likely"), natural frequencies ("about 3 in 10"), a day-by-day strip, ground wetness from the satellite layer, and what to do on the farm or for business and travel. Pick a place or use your location; the choice is kept in the link (`/simple?city=chennai`) so it can be shared.

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

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The server listens on localhost only.

`data/climatology.json` is committed, so a fresh clone works without rebuilding it. To refresh the ERA5 and CMIP6 layer, run `npm run climatology`; it makes about 30 large archive requests, writes raw responses to `data/raw/`, and reuses them on later runs. The desk caches the live ensemble and satellite pull for 30 minutes in `data/cache/`.

For a faster local server, run `npm run build && npm start` on the same port.

```bash
npm test
npm run lint
```

No API key is required. Open-Meteo’s free tier is for non-commercial use; see their licence if you deploy this beyond research.
