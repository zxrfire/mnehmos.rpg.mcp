/** Calibration over measured crossings; not a simulation rule. */
import { CROSSINGS_ATTEMPTED_PER_MILLENNIUM } from '../src/engine/world/ladder-odds.js';

/** Mean residence used only to check the authored population against measured landings. */
export const FALSE_IMMORTAL_MEAN_RESIDENCE_YEARS = 500;

export interface ImmortalStock {
    /** Attempts per millennium the record supports. */
    attemptsPerMillennium: number;
    /** Of those attempts, how many land where. Measured from the engine. */
    landings: { trueImmortal: number; falseImmortal: number; dead: number; stranded: number };
    /** False Immortals produced per millennium. */
    falseImmortalsPerMillennium: number;
    /**
     * Expected number standing in the world at any moment: production times
     * mean residence. THIS is the number the setting constrains to one to three,
     * and it is a residence count rather than a production count.
     */
    expectedResident: number;
    /** True Immortals produced per millennium. They are not resident at all. */
    trueImmortalsPerMillennium: number;
}

/**
 * What the world should be holding, given a measured per-attempt outcome split.
 */
export function immortalStock(
    landings: ImmortalStock['landings'],
    opts: { attemptsPerMillennium?: number; meanResidenceYears?: number } = {}
): ImmortalStock {
    const attempts = opts.attemptsPerMillennium ?? CROSSINGS_ATTEMPTED_PER_MILLENNIUM;
    const residence = opts.meanResidenceYears ?? FALSE_IMMORTAL_MEAN_RESIDENCE_YEARS;
    const total =
        landings.trueImmortal + landings.falseImmortal + landings.dead + landings.stranded;
    const share = (n: number) => (total > 0 ? n / total : 0);

    const falsePerMillennium = attempts * share(landings.falseImmortal);
    return {
        attemptsPerMillennium: attempts,
        landings,
        falseImmortalsPerMillennium: falsePerMillennium,
        // Little's law, and it is the whole argument: a queue whose arrivals are
        // rare and whose residents leave quickly is nearly always empty, however
        // long the residents could in principle have stayed.
        expectedResident: (falsePerMillennium / 1000) * residence,
        trueImmortalsPerMillennium: attempts * share(landings.trueImmortal)
    };
}

