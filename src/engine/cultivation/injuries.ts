/**
 * Meridian injuries - the game's ratchet.
 *
 * Injuries do not heal on their own. There is no long rest, no hit dice, no
 * overnight recovery. An injury stays untreated until a pill, a healer or a
 * long seclusion clears it, and while untreated it drags on both cultivation
 * rate and breakthrough odds. That is the whole point: a run does not end
 * because one bad roll killed you, it ends because five months ago you took a
 * torn meridian, kept cultivating anyway, and every roll since has been worse
 * than the last.
 *
 * The lethal rule this module owns the predicate for is the blunt one: three
 * or more untreated meridian injuries. Forcing another fight in that state
 * kills you at once, and doing nothing at all kills you in BLEED_OUT_TURNS -
 * a wound nothing heals on its own does not wait for you to decide. This
 * module reports the *state*; `survival.ts` decides the *death*.
 */

import {
    INJURY_WEIGHTS,
    LETHAL_UNTREATED_INJURIES,
    type Cultivator,
    type Injury,
    type InjurySeverity,
    type InjurySource
} from '../../schema/cultivation.js';
import { getWoundType, isPermanentWound, woundNature } from '../../data/cultivation/wounds.js';
import type { CultivationRNG } from './rng.js';

// ─────────────────────────────────────────────────────────────────────────
// PENALTY CEILINGS
// Penalties stack additively, which without a ceiling means four crippling
// injuries produce a 200% cultivation penalty and a negative rate. Rather than
// let the arithmetic go absurd we cap: an injured cultivator is crippled, not
// mathematically inverted. The caps are deliberately brutal but survivable, so
// that "treat your injuries" stays a live decision instead of the run simply
// being over.
// ─────────────────────────────────────────────────────────────────────────

/** Maximum fraction of cultivation rate that injuries can strip. */
export const MAX_INJURY_CULTIVATION_PENALTY = 0.9;
/** Maximum flat breakthrough-odds penalty injuries can contribute. */
export const MAX_INJURY_BREAKTHROUGH_PENALTY = 0.6;

/** Severity ordering, mildest first. Used for "treat the worst one" triage. */
export const INJURY_SEVERITY_ORDER: readonly InjurySeverity[] = [
    'minor', 'serious', 'crippling'
] as const;

function severityRank(severity: InjurySeverity): number {
    return INJURY_SEVERITY_ORDER.indexOf(severity);
}

// ─────────────────────────────────────────────────────────────────────────
// CREATION
// ─────────────────────────────────────────────────────────────────────────

export interface CreateInjuryParams {
    severity: InjurySeverity;
    source: InjurySource;
    /** Turn on which the injury was sustained. */
    turn: number;
    /**
     * Optional override for the factual description. When omitted the authored
     * text from the wound table is used, and failing that a default composed
     * from severity and source - engine-authored, narrator-rendered throughout.
     */
    description?: string;
    /**
     * Which authored wound this is, as a key into `data/cultivation/wounds.ts`.
     *
     * Supply it wherever the engine knows what it just did to somebody. It is
     * what makes the wound a record the narrator reads rather than a phrase it
     * invents, and it is how a mental wound gets into this list at all - a
     * heart demon is a row in that table, minted through this same function,
     * carried in this same array.
     *
     * Omitted is legitimate and means an ordinary wound of its severity, which
     * is what every wound the engine minted before the table existed was.
     */
    woundType?: string | null;
}

/**
 * Mint an injury with its penalties taken from INJURY_WEIGHTS.
 *
 * Penalties are copied onto the record rather than looked up by severity at
 * read time, so a future balance pass to INJURY_WEIGHTS does not retroactively
 * rewrite the wounds in a save file. What you took is what you carry.
 *
 * The id comes from the supplied seeded RNG, never from `crypto.randomUUID`:
 * injuries surface inside BreakthroughResult and TimeSkipResult, and those
 * objects must be byte-identical across replays of the same seed.
 */
export function createInjury(params: CreateInjuryParams, rng: CultivationRNG): Injury {
    const weights = INJURY_WEIGHTS[params.severity];
    const woundType = params.woundType ?? null;
    // The authored row wins over the composed default, and an explicit
    // description wins over both - a caller that knows the specifics (which
    // strike, which channel) is saying something the table cannot.
    const authored = getWoundType(woundType);
    return {
        id: rng.uuid(),
        severity: params.severity,
        source: params.source,
        description:
            params.description ??
            authored?.description ??
            defaultInjuryDescription(params.severity, params.source),
        sustainedOnTurn: Math.max(0, Math.floor(params.turn)),
        treated: false,
        cultivationPenalty: weights.cultivationPenalty,
        breakthroughPenalty: weights.breakthroughPenalty,
        woundType
    };
}

const SOURCE_PHRASES: Record<InjurySource, string> = {
    combat: 'taken in combat',
    qi_deviation: 'torn by qi deviation',
    failed_breakthrough: 'torn by a failed breakthrough',
    tribulation: 'burned by heavenly tribulation',
    poison: 'eroded by poison',
    backlash: 'torn by technique backlash',
    other: 'sustained'
};

const SEVERITY_PHRASES: Record<InjurySeverity, string> = {
    minor: 'A minor meridian injury',
    serious: 'A serious meridian injury',
    crippling: 'A crippling meridian injury'
};

/** Factual, non-flowery. The narrator supplies the flourish. */
export function defaultInjuryDescription(severity: InjurySeverity, source: InjurySource): string {
    return `${SEVERITY_PHRASES[severity]}, ${SOURCE_PHRASES[source]}.`;
}

/**
 * Roll a severity from a seeded stream.
 *
 * `escalate` shifts the distribution upward and is how the engine expresses
 * "this went wrong at a realm boundary" or "this is the fourth lightning
 * strike" without needing a separate table per caller.
 */
export function rollInjurySeverity(rng: CultivationRNG, escalate = false): InjurySeverity {
    const roll = rng.next();
    if (escalate) {
        if (roll < 0.35) return 'minor';
        if (roll < 0.8) return 'serious';
        return 'crippling';
    }
    if (roll < 0.65) return 'minor';
    if (roll < 0.94) return 'serious';
    return 'crippling';
}

// ─────────────────────────────────────────────────────────────────────────
// QUERYING
// ─────────────────────────────────────────────────────────────────────────

export function untreatedInjuries(injuries: readonly Injury[]): Injury[] {
    return injuries.filter(i => !i.treated);
}

export function untreatedInjuryCount(injuries: readonly Injury[]): number {
    let count = 0;
    for (const injury of injuries) if (!injury.treated) count++;
    return count;
}

/**
 * Untreated wounds that are actually still OPEN - the ones the bleed-out clock
 * is about.
 *
 * A permanent wound is untreated for life by definition: nothing closes a
 * severed meridian or a rooted heart demon, so `treated` stays false forever
 * and the wound goes on costing, correctly. What it must not do is push
 * somebody into the three-untreated-wounds state that kills them, because that
 * state is "you are bleeding and nobody has stopped it" and a maiming is not
 * that. Counted the old way, a cultivator who came out of the Deity
 * Transformation wall maimed, half mad and short a span would have had ninety
 * days to live - from three conditions none of which is a bleed.
 *
 * So the ratchet keeps its teeth on open wounds and stops charging rent on
 * permanent ones. `aggregateInjuryPenalties` deliberately still counts them:
 * they are supposed to make everything harder forever. Only the CLOCK skips
 * them.
 */
export function bleedingInjuryCount(injuries: readonly Injury[]): number {
    let count = 0;
    for (const injury of injuries) {
        if (injury.treated) continue;
        if (isPermanentWound(injury.woundType)) continue;
        count++;
    }
    return count;
}

/** Untreated wounds of a given nature. The mental half is the new one. */
export function woundsOfNature(
    injuries: readonly Injury[],
    nature: 'physical' | 'mental'
): Injury[] {
    return injuries.filter(i => woundNature(i.woundType) === nature);
}

/**
 * Whether this person carries a wound nothing in the world closes.
 *
 * The predicate the world layer wants when it asks "is this somebody who was
 * ruined by a crossing rather than merely hurt recently", and the one a
 * narrator should consult before writing anybody as recovering.
 */
export function hasPermanentWound(injuries: readonly Injury[]): boolean {
    return injuries.some(i => isPermanentWound(i.woundType));
}

export interface InjuryPenalties {
    /** Fraction of cultivation rate lost, in [0, MAX_INJURY_CULTIVATION_PENALTY]. */
    cultivationPenalty: number;
    /** Flat breakthrough-odds penalty, in [0, MAX_INJURY_BREAKTHROUGH_PENALTY]. */
    breakthroughPenalty: number;
    untreatedCount: number;
    /** Multiplier form of `cultivationPenalty`, ready to fold into a rate. */
    cultivationMultiplier: number;
    /**
     * True once the count of OPEN wounds reaches the lethal-if-you-fight
     * threshold. Permanent wounds are excluded - they cost forever and they are
     * not a bleed. See `bleedingInjuryCount`.
     */
    lethalThresholdReached: boolean;
    /** Untreated wounds nothing in the world closes. They never stop costing. */
    permanentCount: number;
}

/**
 * Sum the penalties of every untreated injury, clamped to the ceilings.
 *
 * Treated injuries are kept on the record - they are scar tissue and run
 * history - but contribute nothing.
 */
export function aggregateInjuryPenalties(injuries: readonly Injury[]): InjuryPenalties {
    let cultivation = 0;
    let breakthrough = 0;
    let untreatedCount = 0;
    let permanentCount = 0;
    let bleedingCount = 0;

    for (const injury of injuries) {
        if (injury.treated) continue;
        untreatedCount++;
        // Permanent wounds are priced exactly like open ones - they are
        // supposed to make everything harder for the rest of the life. They
        // are only held back from the bleed clock.
        if (isPermanentWound(injury.woundType)) permanentCount++;
        else bleedingCount++;
        cultivation += injury.cultivationPenalty;
        breakthrough += injury.breakthroughPenalty;
    }

    const cultivationPenalty = Math.min(cultivation, MAX_INJURY_CULTIVATION_PENALTY);
    const breakthroughPenalty = Math.min(breakthrough, MAX_INJURY_BREAKTHROUGH_PENALTY);

    return {
        cultivationPenalty,
        breakthroughPenalty,
        untreatedCount,
        permanentCount,
        cultivationMultiplier: 1 - cultivationPenalty,
        lethalThresholdReached: bleedingCount >= LETHAL_UNTREATED_INJURIES
    };
}

/**
 * Whether this cultivator is in the "one more fight and you die" state:
 * LETHAL_UNTREATED_INJURIES or more untreated meridian injuries.
 *
 * Note this is a STATE predicate, not a death check. Standing here is legal and
 * survivable for a while - long enough to crawl to a healer, which is the
 * window BLEED_OUT_TURNS is sized to give. It is not indefinitely survivable:
 * forcing another fight kills at once, and staying in this state kills on the
 * clock. `evaluateDeathConditions` decides both.
 */
export function isLethalInjuryState(cultivator: Pick<Cultivator, 'injuries'>): boolean {
    return bleedingInjuryCount(cultivator.injuries) >= LETHAL_UNTREATED_INJURIES;
}

// ─────────────────────────────────────────────────────────────────────────
// TEMPERING - EXPERIENCE AS A FORM OF POWER
//
// The charter requires that surviving hardship produce a mechanical
// consequence rather than being pure loss. The cleanest expression of that
// inside this layer is already sitting in the data: a TREATED injury is a
// wound that was taken, survived, and paid to close. That is scar tissue, and
// it is worth something. A cultivator who has torn their meridians three times
// and knitted them back knows exactly what the onset of a bad breakthrough
// feels like. A cultivator who has never been hurt does not.
//
// Read carefully, because this is close to a rule the charter forbids:
//
//   - It is NOT rubber-banding. Nothing here fires because a run is going
//     badly. It fires because the player spent scarce pills, spirit stones or
//     months of seclusion closing wounds - a real cost, paid in advance, that
//     could have been spent on something else.
//   - It is symmetric. Any NPC with the same history gets the same benefit
//     from the same function.
//   - UNTREATED injuries still only ever hurt. The ratchet is untouched. The
//     loop is get hurt -> pay to heal -> the scar is worth a little, which is
//     the charter's "loss branches rather than subtracts" rather than a
//     consolation prize for failing.
//   - It is capped hard, at a few percentage points. It is judgement, not a
//     second talent stat, and it can never out-earn the spirit root you were
//     dealt.
//
// The broader charter items under "experience is power" - enemies made,
// reputation, changed relationships, combat judgement - are not modelled here.
// They belong to the social and combat layers, which own that state.
// ─────────────────────────────────────────────────────────────────────────

/** Tempering earned per closed wound, by how badly it went. */
export const TEMPERING_PER_SCAR: Record<InjurySeverity, number> = {
    minor: 0.005,
    serious: 0.012,
    crippling: 0.02
};

/** Hard ceiling on tempering, as a flat probability. Judgement, not talent. */
export const MAX_TEMPERING = 0.06;

// ─────────────────────────────────────────────────────────────────────────
// AND THE OTHER SIDE OF IT: SCAR ATTRITION
//
// Tempering alone made a closed wound a pure asset, and that turned the whole
// ratchet into a loop with no bottom: get hurt, pay a pill, come out slightly
// better than before, repeat for as long as the money holds. A cultivator who
// had torn their meridians forty times was the best-prepared person in the
// world, which is the opposite of what the setting says about them.
//
// So the curve goes up and then it goes down. The first few closed wounds are
// judgement - you know what the onset feels like now. Past that the wounds
// stop teaching and start accumulating: meridians that have been torn open and
// knitted shut a dozen times do not carry qi the way they did, and no pill
// treats scar tissue, because scar tissue is what the pill made.
//
// Read carefully, because this is the counterweight and not a second penalty
// on being hurt:
//
//   - UNTREATED wounds are still priced separately and still only ever hurt.
//     Nothing here softens the ratchet.
//   - Attrition is a function of HOW MANY wounds were closed, not of failure.
//     A cultivator who never got hurt never pays it, and a cultivator who was
//     hurt once and healed is still ahead.
//   - It is capped, so a long enough life is crippled rather than negative.
//   - It is why a prodigy who fought their way up arrives at the top of the
//     ladder unable to do what a prodigy who walked up it could. That is the
//     single most load-bearing consequence in the balance of the last realm:
//     see `assessLastCrossing` in breakthrough.ts.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Closed wounds a body absorbs before the scarring starts to cost.
 *
 * Three, which is what a clean climb through the mortal realms produces and
 * about what tempering can pay for at its cap. Below it the old contract is
 * untouched: healing is a pure return on having paid.
 *
 * Measured, not chosen. The people who arrive at the top of the ladder carry a
 * median of four closed wounds - the ones who took more mostly died at the wall
 * that gave them the fourth - so the plateau sits one below that median on
 * purpose. It is the line that decides which prodigies can still afford the
 * last crossing when they get there, and putting it anywhere else makes that
 * either everybody or nobody.
 */
export const SCAR_PLATEAU = 4;
/** Fraction of cultivation rate each closed wound past the plateau costs. */
export const SCAR_RATE_ATTRITION = 0.04;
/** Flat breakthrough-odds cost of each closed wound past the plateau. */
export const SCAR_BREAKTHROUGH_ATTRITION = 0.005;
/** Ceilings. A used-up cultivator is slow and unlucky, never inverted. */
export const MAX_SCAR_RATE_ATTRITION = 0.5;
export const MAX_SCAR_BREAKTHROUGH_ATTRITION = 0.12;

export interface Tempering {
    /** Number of treated injuries on the record. */
    scars: number;
    /** Flat bonus to breakthrough odds, in [0, MAX_TEMPERING]. */
    breakthroughBonus: number;
    /**
     * Reduction in per-check qi-deviation risk. Half the breakthrough figure:
     * recognising the onset is worth less than having been through it.
     */
    deviationRelief: number;
    /** Closed wounds past {@link SCAR_PLATEAU}. The ones that only cost. */
    wornScars: number;
    /** Fraction of cultivation rate the scarring has taken. */
    rateAttrition: number;
    /** Flat breakthrough-odds cost of the scarring. */
    breakthroughAttrition: number;
    /**
     * Tempering less attrition. Positive early, negative for anyone who bought
     * their rank with their meridians. This is the figure to show a player.
     */
    netBreakthroughModifier: number;
}

/**
 * What a cultivator's closed wounds are worth, and what they cost.
 *
 * Counts only TREATED injuries. An open wound is not experience, it is an open
 * wound, and it is priced by `aggregateInjuryPenalties` instead.
 */
export function scarTempering(injuries: readonly Injury[]): Tempering {
    let scars = 0;
    let raw = 0;
    for (const injury of injuries) {
        if (!injury.treated) continue;
        scars++;
        raw += TEMPERING_PER_SCAR[injury.severity];
    }
    const breakthroughBonus = Math.min(raw, MAX_TEMPERING);
    const wornScars = Math.max(0, scars - SCAR_PLATEAU);
    const rateAttrition = Math.min(
        MAX_SCAR_RATE_ATTRITION,
        wornScars * SCAR_RATE_ATTRITION
    );
    const breakthroughAttrition = Math.min(
        MAX_SCAR_BREAKTHROUGH_ATTRITION,
        wornScars * SCAR_BREAKTHROUGH_ATTRITION
    );
    return {
        scars,
        breakthroughBonus,
        deviationRelief: breakthroughBonus / 2,
        wornScars,
        rateAttrition,
        breakthroughAttrition,
        netBreakthroughModifier: breakthroughBonus - breakthroughAttrition
    };
}

/**
 * The multiplier scar tissue puts on a cultivation rate, ready to fold in.
 *
 * Separate from `aggregateInjuryPenalties` on purpose: that function prices
 * OPEN wounds and its figure is labelled as such everywhere it surfaces. Scar
 * tissue is a different fact about the same body and gets its own line, so a
 * rate breakdown never says "no untreated injuries" beside a number that is
 * not one.
 */
export function scarRateMultiplier(injuries: readonly Injury[]): number {
    return 1 - scarTempering(injuries).rateAttrition;
}

// ─────────────────────────────────────────────────────────────────────────
// TREATMENT
// Pure: every function returns a new array; the input is never mutated.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Mark one injury treated by id. Unknown ids are a no-op, not an error.
 *
 * A PERMANENT WOUND IS NEVER TREATED, and refusing it here rather than in the
 * callers is what makes the wound table's word good. Every permanent row says
 * in its own `treatment` field that nothing in the world closes it - a parted
 * meridian, a ruined dantian, a rooted heart demon - and a treatment path that
 * quietly closed one anyway would make that text a decoration.
 *
 * It had teeth beyond the prose, and the shape of those teeth has changed. It
 * used to be that `isHalted` read an untreated ruined dantian, so a healer
 * being handed enough money could have undone a permanent BAR by accident -
 * caught by the ceiling sweep, which heals everything it can every iteration.
 * A ruined dantian no longer halts anybody: only a realm's own break closes a
 * road, and nothing closes one of those except a crossing or the rarest
 * medicine there is. So the sweep can no longer walk somebody back onto the
 * ladder through this door.
 *
 * The refusal still matters, and now for the plain reason rather than the
 * mechanical one: a permanent wound is permanent. A parted meridian, a ruined
 * reservoir and a rooted heart demon each say in their own `treatment` field
 * that nothing in the world closes them, and they go on costing rate, odds and
 * combat power for the rest of the life. Being un-halting does not make a
 * ruined dantian survivable or cheap; it means the ladder is open to somebody
 * who will find the next wall far worse than it was.
 */
export function treatInjury(injuries: readonly Injury[], injuryId: string): Injury[] {
    return injuries.map(injury =>
        injury.id === injuryId && !injury.treated && !isPermanentWound(injury.woundType)
            ? { ...injury, treated: true }
            : injury
    );
}

export interface TriageResult {
    injuries: Injury[];
    /** The injury that was treated, or null if there was nothing to treat. */
    treated: Injury | null;
}

/**
 * Treat the single worst untreated injury - the sensible use of one scarce
 * pill. Ties break toward the oldest wound, because a wound that has been open
 * longer has had longer to do damage.
 */
export function treatWorstInjury(
    injuries: readonly Injury[],
    /**
     * What is being applied, and to whom.
     *
     * Omitted means "no grade stated", which treats everything triable - the
     * behaviour every caller had before the two axes existed, kept so that a
     * harness or a design guard can still ask "what is the worst one" without
     * pricing medicine.
     *
     * Supplied, it enforces the design owner's ruling: the rarity of the
     * medicine scales with the severity of the injury AND the realm of the
     * injured. Before it, a Nascent Soul with crippling torn meridians bought
     * thirty days of village splints for fourteen stones and walked out whole.
     * See `what-grade-of-medicine-a-wound-needs.ts`.
     */
    reaches?: (severity: InjurySeverity) => boolean
): TriageResult {
    let worst: Injury | null = null;
    for (const injury of injuries) {
        if (injury.treated) continue;
        // Not a candidate for triage at all. Spending a pill on a severed
        // meridian is not a worse use of the pill than spending it on a tear -
        // it is not a use of it, and picking it as "the worst one" would waste
        // the pill and leave the tear open. See `treatInjury`.
        if (isPermanentWound(injury.woundType)) continue;
        // Out of this medicine's reach. Skipped rather than picked-and-failed,
        // for exactly the reason above: choosing a wound the treatment cannot
        // close would waste the treatment and leave a closable one open.
        if (reaches && !reaches(injury.severity)) continue;
        if (
            worst === null ||
            severityRank(injury.severity) > severityRank(worst.severity) ||
            (severityRank(injury.severity) === severityRank(worst.severity) &&
                injury.sustainedOnTurn < worst.sustainedOnTurn)
        ) {
            worst = injury;
        }
    }
    if (worst === null) return { injuries: [...injuries], treated: null };
    const treatedInjury: Injury = { ...worst, treated: true };
    return {
        injuries: injuries.map(i => (i.id === treatedInjury.id ? treatedInjury : i)),
        treated: treatedInjury
    };
}

/**
 * Treat up to `count` injuries, worst first. Models a long seclusion or a
 * healer's course of treatment rather than a single pill.
 */
export function treatWorstInjuries(
    injuries: readonly Injury[],
    count: number,
    /** See `treatWorstInjury`. Omitted keeps the ungraded behaviour. */
    reaches?: (severity: InjurySeverity) => boolean
): TriageResult & { treatedCount: number } {
    let current = [...injuries];
    let treatedCount = 0;
    let last: Injury | null = null;
    for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
        const step = treatWorstInjury(current, reaches);
        if (step.treated === null) break;
        current = step.injuries;
        last = step.treated;
        treatedCount++;
    }
    return { injuries: current, treated: last, treatedCount };
}
