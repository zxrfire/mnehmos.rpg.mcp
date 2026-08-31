/**
 * The qi scale: one number, 1 to 100, for what the ground under a place holds.
 *
 * 100 is the best ground below the Lid - the Hollow Court's own mountain, and
 * the pockets that were sealed while the world was still rich. Nothing down
 * here exceeds it.
 *
 * WHY IT MOVED OFF 0..1
 * ---------------------
 * It was a 0..1 fraction, which is the same information at a tenth of the
 * resolution. Measured against a live database: Sweptground, the default
 * birthplace, sat at 0.3475 and reported every turn as "thin: half cultivation
 * rate, and a penalty to breakthrough odds"; the best ground in the world sat
 * at 1.0; the sealed compound essentially next door sat at 0.7167. Almost every
 * difference a player could act on lived in the second decimal place of a
 * number nobody was ever shown.
 *
 * That mattered because of what thin ground does to the ladder. Rank 16 costs
 * 30,803 qi-units; fifty years of unbroken seclusion at half rate produces
 * about 25,429. On thin ground the ladder becomes unclimbable somewhere around
 * ordinal 16, permanently, for every run - so "go somewhere better" is not a
 * nicety, it is the whole of the middle game, and the scale it is decided on
 * should be legible.
 *
 * TWO NUMBERS, DELIBERATELY DIFFERENT
 * -----------------------------------
 *   `qiDensity`                    GEOLOGY. What the vein holds. 1..100.
 *   `environment.spiritualDensity` USABILITY. What somebody standing there can
 *                                  actually draw. Stays a 0..1 fraction,
 *                                  because that is what the ambient engine
 *                                  speaks.
 *
 * A sealed ruin is 100 and 0.05 at the same time, and that gap is the whole
 * economy of exploration. `qiFraction` is the ONLY conversion between them.
 *
 * The four ambient bands are unchanged, and they are still drawn per window
 * from the location's usable density rather than read off it - a rich vein
 * still sometimes reads thin, and that variance is deliberate weather over
 * fixed geology. See `src/engine/cultivation/ambient.ts`.
 *
 * This module is a leaf on purpose: `locations.ts` and `history.ts` both need
 * the scale and already point at each other, so it cannot live in either.
 */

/** Dead ground still reads 1. Nothing is 0, because 0 would mean "unmeasured". */
export const QI_DENSITY_MIN = 1;

/** The Hollow Court's ground, and the ceiling below the Lid. */
export const QI_DENSITY_MAX = 100;

/** The Late Age's ordinary open air. Sweptground sits about here. */
export const QI_DENSITY_DEFAULT = 35;

/**
 * Where the four ambient bands sit on the ground scale.
 *
 * These are the density a place would have to hold for that band to be its
 * ORDINARY weather, not a promise about any given month. Anchored on the
 * existing 0..1 band centres so the two scales cannot drift apart, and stated
 * here so a reader can price a place at a glance.
 */
export const QI_BAND_FLOORS = {
    thin: QI_DENSITY_MIN,
    normal: 25,
    dense: 55,
    spirit_tide: 90
} as const;

/** Integer, in range. The one place the scale's bounds are enforced. */
export function clampQiDensity(value: number): number {
    if (!Number.isFinite(value)) return QI_DENSITY_DEFAULT;
    return Math.max(QI_DENSITY_MIN, Math.min(QI_DENSITY_MAX, Math.round(value)));
}

/**
 * The scale as the 0..1 fraction `spiritualDensity` and the ambient engine
 * speak. The single conversion point; nothing else may divide by 100.
 */
export function qiFraction(density: number): number {
    return clampQiDensity(density) / QI_DENSITY_MAX;
}

/**
 * The band a place at this density would ordinarily sit in.
 *
 * Reporting only - it names what the geology implies. The actual band for a
 * given window is still rolled from the usable density, so this is what a
 * surveyor would write down, not what this month will feel like.
 */
export function ordinaryBandFor(density: number): 'thin' | 'normal' | 'dense' | 'spirit_tide' {
    const d = clampQiDensity(density);
    if (d >= QI_BAND_FLOORS.spirit_tide) return 'spirit_tide';
    if (d >= QI_BAND_FLOORS.dense) return 'dense';
    if (d >= QI_BAND_FLOORS.normal) return 'normal';
    return 'thin';
}
