/**
 * THE ONE ANSWER TO "HOW MANY ROADS BESIDES THEIR OWN HAS THIS PERSON WALKED",
 * for a player and for anybody else, out of one function.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULE, AND IT IS ONE RULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   ACCESS PUTS A ROAD IN REACH. YEARS ARE WHAT WALK IT.
 *
 * Every road within reach carries a price in YEARS OF PRACTICE, stated by what
 * put it in reach. A cultivator walks the roads they have actually paid for,
 * cheapest first, out of the years they have been cultivating - and the price
 * is CUMULATIVE, because nobody is in two places at once. Somebody who has a
 * cliff, a canon and a carving inside their reach does not get three roads for
 * standing still; they get the ones the years cover.
 *
 * Insights formed by events are the other half and they are NOT charged. An
 * insight is something that already happened to somebody - it has an
 * achievement behind it, a day, and an account - and it counts the moment it
 * exists. That is the deep, fast, dangerous route, and it is the route that
 * also pays an odds bonus through `understandingEffects`, because it carries a
 * degree. Exposure gives the shallowest degree and nothing else.
 *
 * So the blend is deliberate and it is symmetrical:
 *
 *   SURVIVE SOMETHING     immediate, deep, rare, and it can kill you.
 *   STAND SOMEWHERE LONG  slow, shallow, and available to anybody with access.
 *
 * Both halves are read by this function, and this function is what the gate
 * asks. There is no player path and no NPC path. There are two ADAPTERS, one
 * per storage layer, because a player's world is rows in SQLite and an NPC's is
 * `WorldState` - but an adapter only gathers facts. It decides nothing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE PRICES DIFFER BY SOURCE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A flat price would have made every source the same source, which throws away
 * the thing the design owner actually asked for: some of this is one-time and
 * some of it is passive. In this model that difference IS the price.
 *
 *   A carving is cheap because it is a text. You read it. What makes it rare is
 *   that there are three faces in the world, not that reading takes a century.
 *   A cliff is expensive because nothing on it is addressed to you and the only
 *   way through is to sit there. A material costs nothing at all because the
 *   object WAS the price and it no longer exists.
 *
 * See `YEARS_A_ROAD_COSTS`. The prices are a tuning table and they are
 * calibrated against the world, not argued for: `scripts/probe-can-the-world-
 * feed-the-dao-gate.ts` is what settles them, and `tests/engine/world/
 * the-pyramid.test.ts` is what catches it when they are wrong.
 */

import { DAYS_PER_YEAR } from './cultivation.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import { InsightDomainSchema, type Insight, type InsightDomain } from '../../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT A ROAD IN REACH IS
// ─────────────────────────────────────────────────────────────────────────

/**
 * How a road came to be within somebody's reach.
 *
 * Deliberately a closed union rather than a free string: it is the key into the
 * price table, the provenance kind and the account, and a source nobody priced
 * is a source that would silently cost zero.
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
 * Years of practice each kind of access costs before the road is actually
 * walked. THE TUNING TABLE. See the banner for why they are not all the same.
 *
 * Calibrated so that the standing population's road counts land where they were
 * before this module, which is the only bar that matters: the previous numbers
 * came from a world that had already been measured to produce an apex, and the
 * point of this change is to make the player subject to the same rule, not to
 * re-tune the world underneath it. `probe-can-the-world-feed-the-dao-gate.ts`
 * before and after is the check.
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
 *
 * Both a `Cultivator` and an `NpcRecord` can answer "how old are they" and
 * neither stores the day an art was taken up, so the shared clock has to be the
 * one both sides actually hold. Subtracting a start age rather than counting
 * from birth is what stops a fourteen-year-old outer disciple arriving with a
 * road, and it is what stopped the NPC side dating its synthesised insights to
 * the day the person was BORN.
 */
export const CULTIVATION_BEGINS_AT_AGE = 12;

/** Years this person has been cultivating at all. The budget exposure spends. */
export function yearsCultivating(ageInYears: number): number {
    return Math.max(0, ageInYears - CULTIVATION_BEGINS_AT_AGE);
}

// ─────────────────────────────────────────────────────────────────────────
// THE ONE SOURCE BOTH SIDES ALREADY HOLD IN THE SAME SHAPE
// ─────────────────────────────────────────────────────────────────────────

/** Domains a technique can teach. Not `element`: a root supplies that unaided. */
const TAUGHT_DOMAINS: ReadonlySet<string> = new Set(
    InsightDomainSchema.options.filter(d => d !== 'element')
);

/**
 * The roads the arts in somebody's hands put within their reach.
 *
 * SHARED OUTRIGHT, because this is the one channel where the player and the
 * world already store the same fact in the same shape: `Cultivator.knownTechniques`
 * and `NpcCultivation.techniqueIds` are both arrays of ids into the same
 * catalog, and every technique in it declares a `domain` drawn from the same
 * enum an insight uses. There is no adapter here and there must not be one -
 * two copies of this loop is exactly how the sides drifted apart the first time.
 *
 * One entry per distinct domain, first art wins, so holding three sword canons
 * is one road and not three.
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

// ─────────────────────────────────────────────────────────────────────────
// THE FUNCTION THE GATE ASKS
// ─────────────────────────────────────────────────────────────────────────

/** Everything the rule reads. Both sides project onto this and nothing else. */
export interface RoadBearer {
    /** Comprehension that already happened, with an achievement behind it. */
    insights?: readonly Insight[];
    /**
     * The arts in their hands.
     *
     * READ HERE RATHER THAN LEFT TO THE CALLER, and that is the single decision
     * that makes the practice channel impossible to get wrong. Every caller
     * already hands the gate a whole cultivator, and a whole cultivator already
     * carries this field - `Cultivator.knownTechniques` for a player, and
     * `NpcCultivation.techniqueIds` copied onto the subject for anybody else.
     * So the commonest road channel in the world needs no adapter on either
     * side, and a call site that never heard of this module gets the right
     * answer anyway. `src/web/game.ts` has four such call sites and none of
     * them had to change.
     */
    knownTechniques?: readonly string[];
    /**
     * Roads some OTHER access has put in reach - ground, a spent material, a
     * carving, an object fit for the path.
     *
     * This one does need a caller, because where a person is standing and what
     * their house lets them onto is a fact about a world, and the engine holds
     * no map. Absent means "nothing but their arts", which is the honest answer
     * for an odds harness and for any caller without a world in scope.
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
 *
 * Cheapest first because it is what anybody would actually do, and stable
 * because the answer has to be the same every time it is asked - this function
 * is called on the same person many times over a life and a wobbling order
 * would give somebody a road one year and take it away the next.
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
 *
 * Insights they already hold come through untouched - they happened, they have
 * a degree, and nothing here may overwrite one. Exposure then fills in whatever
 * further DOMAINS the years cover, at the shallowest degree, skipping any
 * domain a real insight already covers because the gate counts domains and
 * paying twice for one would be free.
 *
 * `bornOnDay` dates the provenance. A road bought with years is dated to the
 * day the years ran out, never to a birthday, because an insight is required to
 * name the event that produced it and "they were born" is not one.
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
