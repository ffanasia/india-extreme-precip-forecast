import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function MethodDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Method</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl italic">How Varsha scores a day</DialogTitle>
          <DialogDescription>
            A research desk for extreme daily rain on the Indian mainland. It is not an IMD warning.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1 text-sm leading-6 text-foreground/90">
          <section>
            <h3 className="font-medium text-paper">The probability</h3>
            <p className="text-muted-foreground">
              For each anchor, ECMWF IFS and NCEP GEFS each contribute their own member frequency: the share of
              members with at least one day in the window at or above the threshold. Varsha reports the average of
              those two frequencies, so the larger IFS ensemble does not outvote GEFS. Incomplete members are left
              out. This is an ensemble frequency, not a probability that has been reliability-calibrated against gauges.
            </p>
          </section>
          <section>
            <h3 className="font-medium text-paper">Thresholds</h3>
            <p className="text-muted-foreground">
              Heavy, very heavy, and extremely heavy follow the India Meteorological Department 24-hour categories:
              64.5 mm, 115.6 mm, and 204.5 mm. Local R99p is the 99th percentile of ERA5 wet days (at least 1 mm) from
              1991 to 2020 at that anchor. The climatology line counts how many of those 30 years reached the same
              threshold inside the same calendar window.
            </p>
          </section>
          <section>
            <h3 className="font-medium text-paper">Four inputs</h3>
            <p className="text-muted-foreground">
              ERA5 sets the local baseline and the analog year. CMIP6 HighResMIP, bias-corrected to ERA5-Land, describes
              how JJAS and OND extreme-day frequency changes between 1991–2014 and 2031–2049 at a regional centroid.
              Open-Meteo characterises these runs as the high-resolution CMIP6 set closest to RCP8.5; it is not a full
              SSP ensemble, and it is not blended into this week&apos;s probability. The real-time cycle is IFS plus
              GEFS. Satellite context is NASA POWER PRECTOTCORR from GEOS-IT, a satellite- and gauge-informed analysis
              with about two days of latency. GPM IMERG Early and Late are the swath products this layer stands in for;
              the public PPS archive asks for an Earthdata login.
            </p>
          </section>
          <section>
            <h3 className="font-medium text-paper">What the map is not</h3>
            <p className="text-muted-foreground">
              Twenty-one cities, not a 0.25° grid. Maharashtra and Karnataka are left unshaded in the climate view
              because a single state colour would mix the coast with the interior. Andaman and Nicobar and Lakshadweep
              are outside this mainland desk. In the western Himalaya the ERA5 land cell is wetter than valley station
              records, because the cell includes surrounding slopes. Analogs match the ensemble-median daily sequence, not a circulation
              pattern. Agreement is high only when both ensembles put substantial probability on the event and stay
              within 20 percentage points of each other.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
