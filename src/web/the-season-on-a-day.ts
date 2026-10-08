/** Pure existing season read, shared by narration and exposure; no runtime imports. */
/**
 * The season on a day of the run, which begins in early spring.
 *
 * The engine models no seasons and has no use for one, so this is the prompt layer's own
 * reading of the run's day. It exists because a model handed no season writes a different one
 * every time somebody arrives somewhere: summer heat at a gate, frost at the next look. The
 * start is fixed rather than drawn, since all it has to be is the same every turn of a life.
 */
export function theSeasonOn(dayOfTheRun: number): string {
    const SEASONS = [
        'early spring', 'late spring', 'early summer', 'late summer',
        'early autumn', 'late autumn', 'early winter', 'late winter'
    ] as const;
    const dayOfTheYear = ((Math.floor(dayOfTheRun) % 365) + 365) % 365;
    return SEASONS[Math.min(SEASONS.length - 1, Math.floor(dayOfTheYear / (365 / SEASONS.length)))]!;
}

