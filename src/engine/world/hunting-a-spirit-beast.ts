/**
 * Hunting a spirit beast - what is on this ground, whether it can be taken,
 * and what comes off the body.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────
 *
 * This is the beast catalog's reader. `src/data/cultivation/beasts.ts` carries
 * the whole non-human population on the same ordinal ladder cultivators stand
 * on - every beast, its materials priced in the herb catalog's own bands, the
 * tides, the contract model, and a full set of lookups - and for a long time
 * nothing in `src/engine/`, `src/web/` or `src/server/` read a line of it.
 * That is the shape AGENTS.md files under "a module nothing calls is not a
 * feature". Anything reaching the catalog should come through here.
 *
 * ── WHY IT MATTERS TO THE ECONOMY ────────────────────────────────────────
 *
 * A measurement taken elsewhere - 2373 deaths over six seeds and forty years,
 * none at the heaven band or above - was read as saying the world produces no
 * high-grade material. That measurement is about CULTIVATORS. Beasts are the
 * other half of the population, they climb the same ladder, and their bodies
 * are where the top of the material ladder actually comes from. A core is the
 * catalog's own phrase for it: somebody else's centuries, in a form that can
 * be eaten or sold.
 *
 * So the supply is real. It is also hard, and nothing here is what makes it
 * hard - `items.md` rules that scarcity is measured rather than authored, and
 * every gate below was already in the data:
 *
 *   - `ordinal` prices the fight, through the same resolver a person goes
 *     through. A beast four rungs up is not an encounter, it is a way to die.
 *   - `harvestOrdinal` says which realm can take a thing off a body at all,
 *     so killing something is not the same as being able to cut it.
 *   - `persistence` says what ground a thing survives on. The impressive
 *     animals are behind seals, which is most of why seals kill people.
 *   - `frequency` weights the draw, and it falls off a cliff up the ladder:
 *     300 for a hare, 2 for a leviathan.
 *
 * No constant in this file adds to that. If the supply turns out wrong, the
 * fix is in the catalog's numbers, not here.
 *
 * ── THE THREE BANDS, AND WHICH ONE DECIDES THE SCENE ────────────────────
 *
 * Two constants cut the population into three, and `bandOf` is the gate.
 * Neither line is a rule about beasts - the first is `items.md`'s
 * counted/tracked boundary and the second is the ladder:
 *
 *   below `BEAST_CORE_ORDINAL` (17)    an animal.   COUNTED.
 *   17 to 28, it has a core            an animal.   TRACKED.
 *   `BEAST_CHANGE_ORDINAL` (29) and up somebody.    A PERSON, elsewhere.
 *
 * The counted band is most of the hunting anybody ever does and it is the
 * band that makes hunting playable: "I hunt a spirit beast" gets an outcome
 * and some materials without the world minting a named individual it then has
 * to remember, the same way it does not remember a spirit stone.
 *
 * ── AND WHETHER A THING CAN ANSWER IS A DIFFERENT QUESTION AGAIN ─────────
 *
 * `readsAsSomebody` reads `speaks`, and never the ordinal:
 *
 * > **`BEAST_CHANGE_ORDINAL` is a FLOOR beneath which nothing may speak. It
 * > is not a promise that everything above it does.**
 *
 * The catalog authored those as different facts and is right to. Two entries
 * stand above the change and say nothing, and they are the worst things in it
 * precisely because there is nothing to negotiate with. Reading the ordinal
 * instead of the field would make those rows illegal.
 *
 * ── AND THERE IS A SECOND AXIS ENTIRELY ─────────────────────────────────
 *
 * The rung gives what it gives everybody. `abilityAt` is the other axis: what
 * a thing can do because of what it IS, which no amount of cultivation
 * confers on a human. It scales on the SAME two constants, so one pair of
 * numbers now decides three separate things and none of them needed a
 * threshold of its own. `bloodlineTierForChild` is that ladder read
 * backwards, which is how a trait leaves the beasts entirely and becomes a
 * human family line.
 *
 * ── AND THE ETHICS FALL OUT OF THE SAME LINE ─────────────────────────────
 *
 * A core off an animal and a core off something that answered you are not the
 * same object. `items.md`'s "Holding is a signature" is the machinery for
 * that and it needs nothing new: the difference goes in the provenance, on
 * the ordinary object row, in the ordinary `note` field, and anybody who
 * reads the chain two centuries later can see what was done.
 *
 * This file does not refuse the killing. Agency: anybody may attempt
 * anything, and the engine's job is to say honestly what it cost. What it
 * does is make sure the world knows the difference even when the player does
 * not.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ────────────────────────────────────────
 *
 * **The contract.** `THE_CONTRACT` in the catalog is a full design and
 * `CONTRACT_ENGINE_REQUIREMENTS` next to it lists the five things the engine
 * would need before one could resolve mechanically rather than being
 * narrated - a cultivator-side draw share, a beast as a persistable actor
 * with its own advancing ordinal, an oath record with a penalty clause and a
 * witnessing house, a termination path per break condition, and a location
 * link. Not one of those exists. Building a contract without them would mean
 * a bond that costs nothing, against a party that never grows, which is the
 * exact opposite of what the design says a contract is. It stays written up
 * and unbuilt on purpose.
 *
 * **A second combat system.** Nothing here rolls a fight. A beast reaches
 * `combat_manage` as a described opponent - a name and a realm ordinal, the
 * fields `OpponentSchema` already has - so it goes through `assessPower`,
 * the categorical-gap refusal, `killRequirement` and the seeded exchange
 * stream exactly as a person does. Reproducibility is a law here and a
 * parallel resolver would break it.
 *
 * Pure functions. No DB, no I/O, no randomness of its own: every draw takes a
 * uniform sample from a stream the caller owns, matching `rollHerb`,
 * `rollBeast` and `rollEncounter`.
 */

import {
    BEASTS,
    BEAST_CHANGE_ORDINAL,
    BEAST_CORE_ORDINAL,
    materialsOf,
    type Beast,
    type BeastAbility,
    type BeastMaterial
} from '../../data/cultivation/beasts.js';
import type { HerbBiome } from '../../data/cultivation/herbs.js';
import { MAX_ORDINAL, rankName } from '../cultivation/realms.js';
import {
    narrowToOffered,
    regardOf,
    steepestGap,
    type Regard
} from '../cultivation/regard.js';
import {
    makeObject,
    transferPossession,
    type ObjectRecord,
    type ObjectSignificance
} from './possessions.js';

// ─────────────────────────────────────────────────────────────────────────
// THE GROUND
//
// `persistence` is the catalog's statement about where a thing survives the
// Late Age, and until now nothing read it. It is the difference between a
// province that has hares and a sealed chamber that has had something
// cultivating in it undisturbed since before the seal was cut.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the caller knows about the ground somebody is standing on.
 *
 * Deliberately four small facts rather than a location record. The engine
 * layer must not reach into storage, and every one of these is already
 * readable off a `WorldLocation` by whoever calls in.
 */
export interface GroundForBeasts {
    /** Narrows the draw when the caller knows it. Omitted means the whole map. */
    biome?: HerbBiome;
    /** Inside closed ground: a sealed ruin, an unopened chamber, a cut face. */
    sealed: boolean;
    /** The ground is a vein, or sits on one close enough to matter. */
    onAVein: boolean;
}

/**
 * What could be standing here at all, before anybody's realm is considered.
 *
 * The whole of the persistence rule, and it is one-directional: richer ground
 * carries everything poorer ground carries, and adds. A sealed pocket is also
 * a vein, because a seal is what stopped anybody drawing on it.
 */
export function beastsOnThisGround(ground: GroundForBeasts): readonly Beast[] {
    return BEASTS.filter(beast => {
        if (ground.biome && beast.biome !== ground.biome) return false;
        switch (beast.persistence) {
            case 'sealed_only':
                return ground.sealed;
            case 'vein_only':
                return ground.onAVein || ground.sealed;
            case 'open_world':
            case 'thin_remnant':
                return true;
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────
// THE DRAW
// ─────────────────────────────────────────────────────────────────────────

/**
 * Weighted draw over an already-filtered pool.
 *
 * `rollBeast` in the catalog does this too and cannot be used here: it owns
 * its own pool selection and has nowhere to put the ground. Rather than widen
 * a catalog function's signature from an engine module, the four lines of
 * weighted-draw arithmetic are restated - and they are arithmetic, not a
 * second rule. The sample comes in from a stream the caller seeded, which is
 * the property that actually matters.
 */
function drawByFrequency(pool: readonly Beast[], sample: number): Beast | undefined {
    if (pool.length === 0) return undefined;
    const total = pool.reduce((sum, b) => sum + b.frequency, 0);
    let cursor = Math.max(0, Math.min(0.999999999, sample)) * total;
    for (const beast of pool) {
        cursor -= beast.frequency;
        if (cursor < 0) return beast;
    }
    return pool[pool.length - 1];
}

/**
 * What a hunter meets, and what was also here and is above them.
 *
 * Two answers rather than one, because they are two different facts and only
 * reporting the first is how somebody walks into a realm gap. `met` is drawn
 * from what this hunter could plausibly take; `above` is everything on this
 * ground standing over them, which is the read that keeps people alive.
 */
export interface WhatIsOnThisGround {
    /** What the hunt actually turned up, or null for empty ground. */
    met: Beast | null;
    /** Everything here standing above the hunter. Never drawn, always said. */
    above: readonly Beast[];
    /** The worst of `above`, priced by the ordinary resolver. Null if clear. */
    worst: Regard | null;
}

export function whatIsOnThisGround(
    ground: GroundForBeasts,
    hunterOrdinal: number,
    sample: number
): WhatIsOnThisGround {
    const here = beastsOnThisGround(ground);
    const rung = clampOrdinal(hunterOrdinal);

    const reachable = here.filter(b => b.ordinal <= rung);
    const above = here.filter(b => b.ordinal > rung);

    // The same narrowing the catalog's own draw applies: a hare somebody is
    // twenty rungs past is not an encounter, it is a thing walked past. Where
    // nothing survives the narrowing the reachable set comes back, because
    // ground with only hares on it still has hares on it.
    const offered = narrowToOffered(reachable, rung);

    return {
        met: drawByFrequency(offered, sample) ?? null,
        above,
        worst: above.length > 0 ? steepestGap(above, rung) : null
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHICH OF TWO SCENES THIS IS
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much the world bothers to remember about one of these.
 *
 * Three bands off two constants, and neither line is a rule about beasts:
 * the first is `items.md`'s counted/tracked boundary and the second is the
 * ladder. See THE THREE BANDS in the catalog header.
 *
 *   `counted`  below `BEAST_CORE_ORDINAL`. A generic act with a generic
 *              outcome. Nothing is minted, nothing is named, and the world
 *              does not have to remember it any more than it remembers a
 *              meal. This is most of the hunting anybody ever does.
 *   `tracked`  at `BEAST_CORE_ORDINAL` and above. It has a core, a core is
 *              worth money, and money is what makes a thing singular.
 *   `person`   at `BEAST_CHANGE_ORDINAL` and above. Not this file's business
 *              at all - see `theChangedBelongAmongThePeople` below.
 */
export type BeastBand = 'counted' | 'tracked' | 'person';

export function bandOf(beast: Beast): BeastBand {
    if (beast.ordinal >= BEAST_CHANGE_ORDINAL) return 'person';
    if (beast.ordinal >= BEAST_CORE_ORDINAL) return 'tracked';
    return 'counted';
}

/**
 * Whether this is somebody rather than something.
 *
 * Reads `speaks`, which is the fact the catalog authored, and never the
 * ordinal. See the header: `BEAST_CHANGE_ORDINAL` is the floor beneath which
 * nothing may speak, not a promise that everything above it does.
 */
export function readsAsSomebody(beast: Beast): boolean {
    return beast.speaks;
}

/** Whether a beast is at or past the rung where a core can exist at all. */
export function hasACore(beast: Beast): boolean {
    return beast.ordinal >= BEAST_CORE_ORDINAL;
}

// ─────────────────────────────────────────────────────────────────────────
// THE SPECIES AXIS
//
// The rung gives what it gives everybody. This is what a thing can do because
// of what it IS, and no amount of cultivation confers it on a human.
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far a species ability has come.
 *
 * Three strengths off the SAME two constants that already decide counted
 * versus tracked and animal versus person. Three rules, two numbers, and
 * nothing authored per beast except the ability itself - which means a
 * species with a well-judged ability gets a well-judged progression for free.
 *
 * `final` carries one thing the others do not. At `BEAST_CHANGE_ORDINAL` a
 * beast is human-shaped, so taking the beast form back is a CAPABILITY of the
 * final form rather than its default state. The tortoise puts the shell on
 * deliberately. That is a better mechanic than a permanent shape, and it
 * falls out of the change rather than being added beside it.
 */
export type AbilityTier = 'latent' | 'grown' | 'final';

export interface AbilityAt {
    tier: AbilityTier;
    name: string;
    kind: BeastAbility['kind'];
    /** The authored line, which describes the final form. */
    what: string;
    /** What this tier actually amounts to, stated once per tier. */
    atThisTier: string;
    /** Only the final form can put the beast shape on and take it off. */
    canTakeTheBeastForm: boolean;
}

const WHAT_A_TIER_AMOUNTS_TO: Record<AbilityTier, string> = {
    latent:
        'A weak version of it, and unmistakably the same thing. Enough that somebody who '
        + 'knows what they are looking at can name the species off it, and not enough to '
        + 'decide anything.',
    grown:
        'The working version. It is worth building a fight around, worth hiding, and worth '
        + 'somebody asking where it came from.',
    final:
        'The whole of it, and the beast shape available on request rather than worn. What '
        + 'is standing there looks like a person until it decides otherwise.'
};

export function abilityAt(beast: Beast): AbilityAt {
    const band = bandOf(beast);
    const tier: AbilityTier =
        band === 'person' ? 'final' : band === 'tracked' ? 'grown' : 'latent';
    return {
        tier,
        name: beast.ability.name,
        kind: beast.ability.kind,
        what: beast.ability.what,
        atThisTier: WHAT_A_TIER_AMOUNTS_TO[tier],
        canTakeTheBeastForm: tier === 'final'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// BLOODLINE
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a child carries, read off both parents.
 *
 * ── WHY THIS EXISTS AND WHAT IT IS NOT ──────────────────────────────────
 *
 * Nobody is born a beast. A beast becomes a person by cultivating to
 * `BEAST_CHANGE_ORDINAL`, and a person marries. A species ability is a real
 * trait rather than a technique, so it is the kind of thing that passes down
 * - and the child, never having been a beast, is human and carries it anyway.
 * That is a bloodline: a human family line that breathes fire, or that does
 * not break.
 *
 * **It is not talent and must never be routed through the talent machinery.**
 * The opening screen promises the player, in as many words, that spirit root
 * and the four innate attributes are rolled once and locked for the run. A
 * bloodline that improved either would make that promise false and a player
 * would catch it. Two axes, kept apart, exactly as the species ability is
 * kept apart from the rung:
 *
 *   talent     rolled, never inherited, untouched by any of this
 *   bloodline  inherited, never rolled, and never a spirit root
 *
 * ── IT DILUTES, AND THE CURVE IS THE ABILITY LADDER READ BACKWARDS ──────
 *
 * Gone in three generations, and NOT ONE NUMBER IS AUTHORED FOR IT. The
 * strengths a bloodline steps down through are the same three the ability
 * climbed - final, then grown, then latent, then nothing. **If a dilution
 * constant ever appears, the design has drifted.**
 *
 * Two consequences worth having, both free:
 *
 *   - **A bloodline is visible while it lasts and then is not.** Three
 *     generations is inside living memory where cultivators live centuries,
 *     so a family can be known for fire and then be a family that says it has
 *     fire and cannot show you. That is a claim without proof, which is the
 *     territory `docs/world/houses/trust.md` already covers.
 *   - **It prices a marriage correctly.** A wasting asset has to be renewed,
 *     which is a reason for arrangements to recur rather than happen once.
 *     Permanence would make one marriage worth any price.
 *
 * ── AND IT READS BOTH PARENTS, WHICH IS THE WHOLE RULE ──────────────────
 *
 * One carrier and one outsider steps down. **Two carriers hold the line**,
 * because there are two of it. There is no `marriedWithinTheLine` flag and
 * there must not be one - everything below falls out of that single sentence,
 * and if it needs a second sentence something has gone wrong.
 *
 * What that produces without anybody authoring it: a family whose line is
 * wasting has a REASON to marry its own, so the world grows insular bloodline
 * clans - closed, strange, and perfectly rational about it. A line that
 * married out is three generations from a claim it cannot demonstrate; a line
 * that married in can still show you. Same rule, sorting families into two
 * kinds by what they chose.
 *
 * **Holding the line is free, deliberately.** Two carriers hold it exactly
 * and indefinitely, and a closed clan can therefore sustain a final-form
 * ability forever. That is chosen rather than overlooked: it is precisely why
 * such families stay closed, and the cost is already paid in the fiction
 * rather than in a number - a clan that marries only its own is a clan whose
 * members do not get to choose, which is a real price and a legible one. A
 * second decay applied to closed lines would be a dilution curve wearing a
 * different hat.
 */
export function bloodlineTierForChild(
    left: AbilityTier | null,
    right: AbilityTier | null
): AbilityTier | null {
    // Two carriers hold the line at the better of what they hold. Nothing here
    // asks whether they are related, or of the same house, or married within
    // anything - only what each of them carries.
    if (left && right) return STRONGER_OF[left][right];
    const only = left ?? right;
    if (!only) return null;
    return STEP_DOWN[only];
}

/**
 * A line, as a person carries it.
 *
 * Two fields and no third. `speciesId` is a `Beast` id in `beasts.ts`, so what
 * the line actually DOES is read off the catalog's own `ability` and never
 * copied onto the person - there is one description of what a stone-shelled
 * thing can do and it is in the catalog. `tier` is where the dilution ladder
 * has got to, and `bloodlineTierForChild` is the only thing that moves it.
 *
 * **Nothing is stored about how it is inherited**, because inheritance is a
 * function of the two parents and is computed at the birth. A `carriers` count,
 * a `generationsLeft`, a `dilutedOn` day - each of those is the same fact stored
 * twice and would go stale the first time somebody married.
 */
/** Whether a stored value is a tier this build knows. */
export function isAbilityTier(value: unknown): value is AbilityTier {
    return value === 'latent' || value === 'grown' || value === 'final';
}

export interface Bloodline {
    /** A `Beast` id in `beasts.ts`. The ability itself is read from there. */
    speciesId: string;
    /** How strong it still is. `null` is not representable: gone is no line. */
    tier: AbilityTier;
}

/**
 * The child's line, read off both parents' whole records rather than two tiers.
 *
 * The tier arithmetic is `bloodlineTierForChild`'s and is not repeated. What
 * this adds is the species, which is the part a bare tier cannot carry: a child
 * of two carriers of DIFFERENT lines takes the stronger one, because a person
 * has one bloodline and the world has no vocabulary for two. Ties go to the
 * left-hand parent's, and that is arbitrary rather than a rule about which
 * parent counts - the caller may pass them either way round and the swap test
 * in `tests/engine/household` is what holds the rest of the match symmetric.
 */
export function bloodlineForChild(
    left: Bloodline | null,
    right: Bloodline | null
): Bloodline | null {
    const tier = bloodlineTierForChild(left?.tier ?? null, right?.tier ?? null);
    if (!tier) return null;
    if (left && right) {
        const stronger = ORDER.indexOf(right.tier) > ORDER.indexOf(left.tier) ? right : left;
        return { speciesId: stronger.speciesId, tier };
    }
    const only = left ?? right;
    return only ? { speciesId: only.speciesId, tier } : null;
}

const ORDER: readonly AbilityTier[] = ['latent', 'grown', 'final'];

const STEP_DOWN: Record<AbilityTier, AbilityTier | null> = {
    final: 'grown',
    grown: 'latent',
    latent: null
};

const STRONGER_OF: Record<AbilityTier, Record<AbilityTier, AbilityTier>> =
    Object.fromEntries(ORDER.map(a => [
        a,
        Object.fromEntries(ORDER.map(b =>
            [b, ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b])) as Record<AbilityTier, AbilityTier>
    ])) as Record<AbilityTier, Record<AbilityTier, AbilityTier>>;

/**
 * WHAT IS DELIBERATELY NOT BUILT HERE, AND WHERE IT GOES.
 *
 * A beast at `BEAST_CHANGE_ORDINAL` or above is a person and belongs among
 * the people: its own row, holding what any cultivator holds - a rung, a
 * house or none, wants, relationships, a name. It is not a beast with social
 * features bolted on, and this module must never grow a second set of social
 * verbs for one. **If a branch on "is this a beast" appears anywhere near
 * that question, the design has gone wrong.**
 *
 * The question a house actually asks about one is the question it asks about
 * every cultivator alive:
 *
 *   > Is this person worth more to you alive, or as material?
 *
 * A righteous house answers "alive" on principle, a demonic house prices it,
 * a neutral one prices it and is embarrassed about it - and an elder worth
 * more to the house than their body is worth is the same arithmetic reaching
 * the opposite answer rather than an exception to it. A changed beast is
 * simply an extreme input, because its body is worth a great deal. It makes a
 * general rule visible instead of needing one of its own.
 *
 * AND IT IS CAUGHT BY TALKING, NEVER BY LOOKING. A changed beast wears the
 * human shape perfectly - it cultivated into that body - and the species
 * shows only as ordinary human variation, a burly man or a thin one. There is
 * no anatomical tell, nothing uncanny, and nothing here may invent either.
 *
 * What is missing is the upbringing, and the correct implementation of that
 * is ONE STATE rather than any behaviour:
 *
 * > **A changed beast begins with no records for ordinary life.**
 *
 * `KnowingStage` in `src/engine/social/discovery.ts` already holds what
 * somebody has a reference for, per subject, with `unaware` at the bottom.
 * Asking what a thing is, using it wrong, and lying badly about where you
 * grew up are three faces of that one absence, and the narrator writes them.
 * **Do not enumerate them.** A stored list of gaffes repeats inside three
 * meals and is the engine writing prose. If the answer needs a field, a list
 * or a branch on species, it has gone wrong -
 * `WHAT_GIVES_A_CHANGED_BEAST_AWAY` in the catalog says so at length.
 *
 * None of which is a rule about beasts. Anyone with no record for a thing
 * behaves this way - the sealed ancestor, somebody sect-raised who has never
 * bought anything, somebody from four provinces over. The changed beast is
 * only the most complete case, having the fewest records of anybody. It is
 * `trust.md`'s second axis again: realm is capability, worldview is
 * reference, and reference is acquired by living rather than by climbing.
 *
 * Every piece that needs is already written and unwired, which is why this is
 * a wiring job rather than a design one:
 *
 *   - `src/engine/cultivation/a-cultivators-body-is-material.ts` grades what
 *     a body yields. 337 lines, and no caller anywhere in `src/`.
 *   - House alignment is already on every house in `sects.ts`.
 *   - `DEMONIC_STANDINGS` states body-by-body how each demonic house comes by
 *     people, which is the gate for what a given house would actually do.
 *   - `whatWouldItTake` prices what somebody would take for a thing, on one
 *     scale, in any medium.
 *
 * Done honestly it makes the body-as-material module live for EVERY
 * cultivator rather than only for beasts, which is the test to hold it to.
 */
export const theChangedBelongAmongThePeople = true;

/**
 * The reading a cultivator gets across a valley, and the only one they get.
 *
 * One ladder, so the realm vocabulary applies to a boar exactly as it applies
 * to a disciple, and the sentence a player is shown is the sentence an NPC
 * would say.
 */
export function readTheThing(beast: Beast, hunterOrdinal: number): string {
    const regard = regardOf(beast, clampOrdinal(hunterOrdinal));
    const height = `${beast.name}, at ${rankName(beast.ordinal)}`;
    if (readsAsSomebody(beast)) {
        // No anatomical tell, deliberately - see
        // `WHAT_GIVES_A_CHANGED_BEAST_AWAY`. The shape is correct and looking
        // harder is not the check. What is offered here is the rung and the
        // fact that it is a party; what would actually give it away is a
        // conversation nobody is having while deciding whether to swing.
        return `${height}. The shape is exactly right, and it is watching you have the `
            + `thought. Whatever else it is, it is a party to a conversation, and opening `
            + `with a sword is how that goes wrong.`;
    }
    return `${height}. ${regard.reaction}`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE HARVEST
//
// `items.md` governs this and nothing here decides it independently. The
// counted/tracked line is the one that document derives from production:
// a grade the standing population can restock is a quantity, a grade it
// cannot is a row with a history. Measured on a world of 587 living
// cultivators: 587 can work mortal, 89 can work earth, 30 can work heaven,
// and nobody at all above that.
// ─────────────────────────────────────────────────────────────────────────

export type HarvestShape = 'counted' | 'tracked';

/**
 * Which shape a material is stored in.
 *
 * By GRADE, which is the measured boundary, rather than by `core`, which is
 * the tempting one and is wrong at exactly one row: an Earth Dragon Scale is
 * heaven grade and not a core, and its own catalog description says nobody
 * sells one without first being asked where it came from. That sentence is a
 * provenance requirement written in prose, and reading `core` would have
 * thrown it away.
 */
export function howAMaterialIsStored(material: BeastMaterial): HarvestShape {
    return material.grade === 'mortal' || material.grade === 'earth'
        ? 'counted'
        : 'tracked';
}

/**
 * How much bookkeeping the world keeps on one of these.
 *
 * DERIVED FROM {@link howAMaterialIsStored} rather than written out beside it,
 * because the two used to disagree: earth grade is stored as a count and was
 * filed `notable`, which `possessions.ts` reads as a row with a provenance.
 * `mundane` is the documented marker for a thing that gets none, so a counted
 * material filed above it is a counted thing that answers `isTracked` with yes.
 *
 * The same shape as `significanceOfPill` and `significanceOfDose`: one
 * threshold, both consequences, and nothing here that can drift from it.
 */
export function significanceOf(material: BeastMaterial): ObjectSignificance {
    if (howAMaterialIsStored(material) === 'counted') return 'mundane';
    return material.grade === 'heaven' ? 'significant' : 'legendary';
}

export interface TakenMaterial {
    material: BeastMaterial;
    shape: HarvestShape;
}

export interface LeftBehindMaterial {
    material: BeastMaterial;
    /** Why it stayed where it was. */
    because: 'realm' | 'no_body';
    /** The ordinal it wants, for the `realm` case. */
    needs: number;
}

export interface Harvest {
    taken: readonly TakenMaterial[];
    leftBehind: readonly LeftBehindMaterial[];
}

/**
 * What comes off, given a body and somebody to cut it.
 *
 * Two gates, both already in the data:
 *
 * **A body has to exist.** `taking: 'kill'` needs one. `shed` and `scavenge`
 * do not, and that is the whole bottom of the beast trade rather than an
 * oversight - a shed antler off a vein each spring is a crop, and a tusk
 * found where something else finished the job is the commonest honest income
 * of a hungry cultivator. It means somebody who cannot fight anything still
 * has a route onto this ladder.
 *
 * **`harvestOrdinal` is the realm below which taking it is not survivable.**
 * Killing a thing and being able to cut it are different facts, and this is
 * what stops a lucky kill from becoming a windfall.
 */
export function whatComesOffTheBody(input: {
    beast: Beast;
    takerOrdinal: number;
    /** Whether the thing is dead and the body is available. */
    killed: boolean;
}): Harvest {
    const rung = clampOrdinal(input.takerOrdinal);
    const taken: TakenMaterial[] = [];
    const leftBehind: LeftBehindMaterial[] = [];

    for (const material of materialsOf(input.beast.id)) {
        if (material.taking === 'kill' && !input.killed) {
            leftBehind.push({ material, because: 'no_body', needs: material.harvestOrdinal });
            continue;
        }
        if (material.harvestOrdinal > rung) {
            leftBehind.push({ material, because: 'realm', needs: material.harvestOrdinal });
            continue;
        }
        taken.push({ material, shape: howAMaterialIsStored(material) });
    }

    return { taken, leftBehind };
}

// ─────────────────────────────────────────────────────────────────────────
// THE OBJECT, AND WHAT ITS PROVENANCE SAYS ABOUT WHOEVER HOLDS IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * A tracked material as a real object with a real origin.
 *
 * Made and then MOVED, rather than made already in somebody's hand. That is
 * not ceremony: `transferPossession` is what the rest of the world uses -
 * `immortal-world.ts` in four places, `legacy.ts`, the repair dose, the
 * barter path - and it is what appends the provenance link. An object that
 * arrives in a pouch with no chain behind it is indistinguishable from
 * something stolen, and `items.md` cares about exactly that.
 *
 * `how` is `looted`, which is the catalog's own word for taking a thing off a
 * body. Ownership moves with it, and that is the one place this departs from
 * the general rule that looting never transfers ownership - the rule protects
 * a party who was wronged, and by the catalog's own account of a beast's
 * death there is no such party: *the body is the whole of them, no nascent
 * soul leaves, and nothing comes back.* There are no heirs and no claim.
 *
 * ── AND THE LINE THROUGH THE POPULATION LANDS HERE ───────────────────────
 *
 * The note says whether this came off something that could answer. That is
 * the entire enforcement of the ethical half: no separate table, no branch
 * anywhere on what kind of thing it was, no bespoke rule. One sentence in the
 * ordinary provenance field on the ordinary object row, which anybody reading
 * the chain two centuries later can see, and which whoever is holding it has
 * to account for if they are asked.
 */
export function objectForBeastMaterial(init: {
    id: string;
    material: BeastMaterial;
    beast: Beast;
    takerId: string;
    takerName: string;
    /** Where it was killed or gathered. Free text, goes in the provenance. */
    place: string;
    onDay: number;
}): ObjectRecord {
    const { material, beast } = init;
    const somebody = readsAsSomebody(beast);

    const blank = makeObject({
        id: init.id,
        name: material.name,
        kind: 'material',
        significance: significanceOf(material),
        description: material.description,
        // Not a weapon. A core is worth an enormous amount and is worth
        // nothing in a fight, and `power` is the fight column.
        power: null,
        locationId: null,
        tags: [
            'beast_material',
            `grade:${material.grade}`,
            `source:${beast.id}`,
            ...(material.core ? ['core'] : []),
            ...(somebody ? ['taken_from_something_that_spoke'] : [])
        ],
        data: {
            materialId: material.id,
            beastId: beast.id,
            beastOrdinal: beast.ordinal,
            grade: material.grade,
            value: material.value,
            core: material.core,
            spoke: somebody
        }
    });

    return transferPossession(blank, {
        onDay: init.onDay,
        toHolderId: init.takerId,
        toHolderName: init.takerName,
        how: 'looted',
        transfersOwnership: true,
        source: `Taken off a ${beast.name} at ${rankName(beast.ordinal)}, at ${init.place}`,
        note: somebody
            ? `Cut from something that had a shape and a voice and could have been `
              + `spoken to. It stood at ${rankName(beast.ordinal)}, which is the rung at `
              + `which that becomes true, and whoever holds this is holding the `
              + `${material.value} stones somebody else spent centuries becoming.`
            : `Taken off an animal at ${rankName(beast.ordinal)}. Nothing about it could `
              + `have answered.`
    });
}

// ─────────────────────────────────────────────────────────────────────────

function clampOrdinal(ordinal: number): number {
    if (!Number.isFinite(ordinal)) return 0;
    return Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
}
