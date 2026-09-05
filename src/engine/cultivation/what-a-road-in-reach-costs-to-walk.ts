/**
 * THE ONE ANSWER TO "HOW MANY ROADS BESIDES THEIR OWN HAS THIS PERSON WALKED", for
 * a player and for anybody else, out of one function.
 */

import { DAYS_PER_YEAR } from './cultivation.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import { InsightDomainSchema, type Insight, type InsightDomain } from '../../schema/cultivation.js';

// WHAT A ROAD IN REACH IS

/**
 * How a road came to be within somebody's reach.
 */
export type HowARoadCameWithinReach =
    /** An art in their hands, practised. */
    | 'practice'
    /** A house's own ground, and they were let onto it. */
    | 'ground_held'
    /** Ground standing open in the province they are in. */
    | 'ground_open'
    /** Ground somebody dug out of a hole. */
    | 'ground_buried'
    /** A single-use object, spent on them and now gone. */
    | 'material_spent'
    /** A worked face somebody left behind, and they can get at it. */
    | 'carving'
    /** An object fit for their path, in their hands, teaching them what it is. */
    | 'artifact';

/** A road something has put within reach, and the thing that put it there. */
export interface RoadWithinReach {
    domain: InsightDomain;
    subject: string;
    /** Location id, object id or technique id. Becomes the achievement id. */
    sourceId: string;
    sourceName: string;
    how: HowARoadCameWithinReach;
}

/**
 * Years of practice each kind of access costs before the road is actually walked.
 * A flat price would have made every source the same source, which throws away
 * what the design owner asked for: some of this is one-time and some of it is
 * passive, and in this model that difference IS the price.
 */
export const YEARS_A_ROAD_COSTS: Readonly<Record<HowARoadCameWithinReach, number>> = {
    // Nothing in an art is addressed to its own road. You practise it until the
    // road is what is left over, which is why this is the most expensive thing
    // on the table and why holding four canons is not four roads.
    practice: 45,
    // Somebody let you in AND somebody showed you. Standing is what bought it,
    // and the showing is what makes it cheaper than an open ford.
    ground_held: 25,
    // Nobody is explaining it. Anybody may stand there and almost nobody reads
    // it, so the price is the sitting.
    ground_open: 40,
    // Out of a hole, made by an age that is over, and nothing in it was written
    // for a reader who exists. The same price as open ground, and the scarcity
    // is that somebody had to dig it out first.
    ground_buried: 40,
    // The object was the price. It was calibrated to a height, spent on one
    // person, and there is now one fewer in the world - charging years on top
    // would be charging twice for the same thing.
    material_spent: 0,
    // It is a text and you read it. What is expensive about a carving is that
    // there are three faces in the world and getting to one is the whole
    // journey - see `docs/world/climbing/immortals.md`, which is explicit that a later
    // reader "gets the surface an afternoon was worked out on without the
    // afternoon, and pays the whole of what reading costs".
    carving: 8,
    // Fit for your path, and therefore legible in a way it is to nobody else.
    // Cheaper than ground because the thing is IN YOUR HANDS and you are using
    // it; dearer than a carving because nothing about it is an explanation.
    artifact: 20
};

/**
 * The age before which nobody is practising anything.
 */
export const CULTIVATION_BEGINS_AT_AGE = 12;

/** Years this person has been cultivating at all. The budget exposure spends. */
export function yearsCultivating(ageInYears: number): number {
    return Math.max(0, ageInYears - CULTIVATION_BEGINS_AT_AGE);
}

// THE ONE SOURCE BOTH SIDES ALREADY HOLD IN THE SAME SHAPE

/** Domains a technique can teach. Not `element`: a root supplies that unaided. */
const TAUGHT_DOMAINS: ReadonlySet<string> = new Set(
    InsightDomainSchema.options.filter(d => d !== 'element')
);

/**
 * The roads the arts in somebody's hands put within their reach. SHARED OUTRIGHT:
 * `Cultivator.knownTechniques` and `NpcCultivation.techniqueIds` are both arrays
 * of ids into the same catalog. There is no adapter here and there must not be
 * one - two copies of this loop is how the sides drifted apart the first time.
 */
export function roadsTaughtByPractice(
    techniqueIds: readonly string[]
): RoadWithinReach[] {
    const byDomain = new Map<InsightDomain, RoadWithinReach>();
    for (const id of techniqueIds) {
        const art = getTechnique(id) as { domain?: string | null; name?: string } | undefined;
        const domain = art?.domain ?? null;
        if (domain === null || !TAUGHT_DOMAINS.has(domain)) continue;
        if (byDomain.has(domain as InsightDomain)) continue;
        byDomain.set(domain as InsightDomain, {
            domain: domain as InsightDomain,
            subject: id,
            sourceId: id,
            sourceName: art?.name ?? id,
            how: 'practice'
        });
    }
    return [...byDomain.values()];
}

// THE FUNCTION THE GATE ASKS

/** Everything the rule reads. Both sides project onto this and nothing else. */
export interface RoadBearer {
    /** Comprehension that already happened, with an achievement behind it. */
    insights?: readonly Insight[];
    /**
     * The arts in their hands.
     */
    knownTechniques?: readonly string[];
    /**
     * Roads some OTHER access has put in reach - ground, a spent material, a
     * carving, an object fit for the path.
     */
    roadsWithinReach?: readonly RoadWithinReach[];
    /** How old they are, in years. Charged against `YEARS_A_ROAD_COSTS`. */
    age?: number;
}

const HOW_IT_WAS_COME_BY: Readonly<
    Record<HowARoadCameWithinReach, Insight['provenance']['achievementKind']>
> = {
    practice: 'profound_principle',
    ground_held: 'extraordinary_instruction',
    ground_open: 'profound_principle',
    ground_buried: 'met_something_ancient',
    material_spent: 'unusual_opportunity',
    carving: 'met_something_ancient',
    artifact: 'unusual_opportunity'
};

const HOW_IT_READS: Readonly<
    Record<HowARoadCameWithinReach, (name: string, years: number) => string>
> = {
    practice: (name, years) =>
        `Practised ${name} for ${years} years, and somewhere in them it stopped being a technique.`,
    ground_held: (name, years) =>
        `Let onto ${name} by the house that holds it, and spent ${years} years there.`,
    ground_open: (name, years) =>
        `Stood at ${name} for ${years} years, which anybody may do and almost nobody profits by.`,
    ground_buried: (name, years) =>
        `Went into ${name} after somebody dug it open, and was ${years} years reading it.`,
    material_spent: name => `Understood ${name}. There is now one fewer in the world.`,
    carving: (name, years) =>
        `Read the face at ${name} over ${years} years, in a hand that assumed no reader.`,
    artifact: (name, years) =>
        `Carried ${name} for ${years} years until what it was for became obvious.`
};

/**
 * Order the reach list is spent in: cheapest first, then by source id.
 */
function inSpendingOrder(roads: readonly RoadWithinReach[]): RoadWithinReach[] {
    return [...roads].sort((a, b) => {
        const byPrice = YEARS_A_ROAD_COSTS[a.how] - YEARS_A_ROAD_COSTS[b.how];
        if (byPrice !== 0) return byPrice;
        if (a.sourceId !== b.sourceId) return a.sourceId < b.sourceId ? -1 : 1;
        return a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0;
    });
}

/**
 * Every road this cultivator has actually walked, as insights.
 */
export function roadsWalkedBy(bearer: RoadBearer, bornOnDay = 0): Insight[] {
    const out: Insight[] = [...(bearer.insights ?? [])];
    const covered = new Set<InsightDomain>(out.map(i => i.domain));

    // Practice is folded in HERE rather than by the caller. See `knownTechniques`.
    const withinReach = [
        ...roadsTaughtByPractice(bearer.knownTechniques ?? []),
        ...(bearer.roadsWithinReach ?? [])
    ];

    let budget = yearsCultivating(bearer.age ?? 0);
    let spent = 0;
    for (const road of inSpendingOrder(withinReach)) {
        if (covered.has(road.domain)) continue;
        const price = YEARS_A_ROAD_COSTS[road.how];
        if (price > budget) continue;
        budget -= price;
        spent += price;
        covered.add(road.domain);

        const achievementId = `road-${road.sourceId}-${road.domain}`;
        out.push({
            id: achievementId,
            domain: road.domain,
            subject: road.subject,
            degree: 1,
            provenance: {
                achievementId,
                achievementKind: HOW_IT_WAS_COME_BY[road.how],
                onDay: Math.max(
                    0,
                    Math.round(
                        bornOnDay + (CULTIVATION_BEGINS_AT_AGE + spent) * DAYS_PER_YEAR
                    )
                ),
                deepenedBy: [],
                account: HOW_IT_READS[road.how](road.sourceName, Math.max(1, price))
            }
        });
    }
    return out;
}
