/**
 * The cultivating households a world already has on the day it opens.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Four fresh worlds, seeds `census-0..3`:
 *
 *     living people                      451 - 453
 *     of them at Foundation or above     126 - 128   (28%)
 *     holding a spouse tie                 0
 *     holding two parents                  0
 *
 * `the-families-a-world-opens-holding.ts` writes those parents and says in its
 * own header what it deliberately leaves: spouses belong to `applyHouseholds`,
 * which only runs as the world is simulated forward. So no world anybody has
 * ever opened contained a marriage, and no child in one has ever had two
 * parents - including the player, whose household this engine had only just
 * learned to give them at all.
 *
 * The design owner: **"seed this"**. A fresh world is not a newly created one.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY ONLY CULTIVATORS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The owner, narrowing it:
 *
 *   > "your parents can be mortal and don't bother. but if they're cultivators,
 *   > seed this relationship"
 *
 * A village of farmers pairing off is below the resolution this engine works
 * at: nothing reads it, nothing acts on it, and three hundred more ties would
 * be volume without meaning. Two cultivators married to each other is a fact
 * with weight - a cultivating household, a line, and something a child is born
 * into.
 *
 * THE RUNG BAR DOES NOT REACH A STATED MARRIAGE, and the reason is the bar's
 * own. A mortal household is refused because the world cannot keep a mortal:
 * `theWorldForgetsTheMortalDead` deletes them, so the other half of the tie goes
 * and the widow cannot be widowed. A catalog figure is kept by name at whatever
 * rung they stand - that sweep's explicit exception - so the reason does not
 * reach them, and the Coal Hand who married into the forge clan is recorded at
 * ordinal 6.
 *
 * The line between the two is not this file's to draw and is not drawn here.
 * {@link FOUNDATION_ORDINAL} already carries it, in the words of the module
 * that owns the ladder: *"below it a character is a mortal with a party trick,
 * above it they are a cultivator."*
 *
 * AND NOBODY THE CATALOG WROTE IS DRAWN FOR AT ALL. The design owner:
 * *"hardcode the authored figure marriages, but not the grudges."* Who somebody
 * is married to is a fact about them and belongs beside their rank and their
 * house, so it is written in `members.ts` beside them and is
 * the same in every world; what two people did to each other is a fact about a
 * world and is minted per seed by `the-wrongs-a-world-opens-holding.ts`.
 *
 * That ruling landed on a pass that was, measured, doing nothing else. Two
 * seeded worlds before it: 26 and 28 marriages, EVERY ONE of them between two
 * catalog figures, none involving anybody else. A fresh world holds 126 to 128
 * living cultivators and 126 of them are authored, so the draw's whole reachable
 * population was the catalog. It still runs, over the two or three cultivators
 * the seeder produces itself, and lands nothing in most worlds - which is a
 * demographic fact about a fresh world and not a broken pass. See
 * {@link seedTheMarriagesTheCatalogStates} for the half that now carries it.
 *
 * AND A CULTIVATOR WHO MARRIED A MORTAL IS NOT RECORDED. Both ends or neither.
 * The argument for recording the cultivator's half alone is real - they are the
 * one the world simulates, so their household is the one anything would read -
 * and it is refused because the half-fact is the expensive kind. A tie is
 * symmetric everywhere else in this layer; one written from a single side would
 * have `whoTheyCarryFor` answering that a Core Formation elder carries for a
 * farmer who has never heard of them, `rescuersFor` putting nobody on a road
 * because the mortal half holds nothing, and a widow who cannot be widowed
 * because the world never tracked whether the other half was alive. A mortal
 * marriage is not modelled, and saying so once is cheaper than modelling half
 * of it forever.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS A SECOND MARRIAGE MECHANIC
 * ═════════════════════════════════════════════════════════════════════════
 *
 * {@link formHouseholds} is the rule, extracted from `applyHouseholds` so both
 * callers run it rather than agree with it. Who may pair with whom, in what
 * order, at what standing, under what note and refusing blood in both
 * directions is all there. This file decides three things and they are the
 * three below: WHO is a candidate, HOW OFTEN, and WHEN it happened.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WIDOWHOOD IS REACHABLE AND, TODAY, DOES NOT HAPPEN
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The candidate pool is every cultivator the world holds standing in a place,
 * ALIVE OR NOT, and a marriage to somebody who has since died is dated before
 * they died. That is the honest version of a household with one parent in it.
 *
 * Measured: it never fires. A fresh world holds three to five dead people and
 * NOT ONE of them is a cultivator - the only deaths a new world contains are
 * the killings `the-wrongs-a-world-opens-holding.ts` writes, and those are done
 * to mortals. So the count of widows in a fresh world is zero, and it is zero
 * for a demographic reason rather than a mechanical one. The path is covered by
 * `a widow is a household with a history` in this module's test, which arranges
 * the dead cultivator the seeder does not supply. Whether prior ages should
 * leave dead cultivators standing anywhere is a question for whoever owns
 * `seedPriorAges`; it is not answered by a marriage pass.
 */

import { forStream } from '../cultivation/rng.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { FOUNDATION_ORDINAL } from '../cultivation/realms.js';
import { AUTHORED_MARRIAGES } from '../../data/cultivation/members.js';
import { worldIdForCatalogPerson } from './a-catalog-person-and-their-world-row.js';
import { isBelowTheLid } from './layers.js';
import {
    bindHousehold,
    formHouseholds,
    HOUSEHOLD_MIN_AGE,
    HOUSEHOLD_PER_YEAR,
    rosterOf,
    type Roster
} from './the-ties-an-ordinary-life-produces.js';
import { somebodyTheCatalogWrote, type NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// THE ONE NUMBER THIS FILE DECIDES
// ─────────────────────────────────────────────────────────────────────────

/**
 * The share of cultivators who never keep a household at all.
 *
 * Needed because the exposure term below SATURATES at the ages this population
 * has. Measured on four fresh worlds, cultivator ages run 90 to 640 with a
 * median of 224, so at {@link HOUSEHOLD_PER_YEAR} a median cultivator has had
 * two hundred adult years of a three-percent roll and has effectively certainly
 * been asked. Left at that, every cultivator with anybody to pair with would be
 * paired, which is a census rather than a place - and this is a genre whose
 * people go into a cave for a century on purpose.
 *
 * So this is the term that carries the answer, and it is a statement rather
 * than a tuning constant: a clear majority of cultivators never keep one.
 * Seclusion, a house that forbids it, two hundred years spent somewhere nobody
 * else was, and choice. The realised married share is lower again and is
 * bounded by something that is not this file's - how many places hold two
 * cultivators at all - and it is measured rather than set. See the test.
 */
export const NEVER_KEEPS_A_HOUSEHOLD = 0.62;

// ─────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────

export interface MarriagesSeeded {
    /** Households written. Each is two rows. */
    households: number;
    /** Of those, the ones the catalog states. Identical in every world. */
    stated: number;
    /**
     * Stated marriages this world holds no row for either half of.
     *
     * A catalog and a seeder disagreeing about who exists, and a pass that
     * swallows one leaves somebody the catalog says is married holding nothing.
     * The test asserts this is nought.
     */
    statedUnwritten: number;
    /**
     * Stated marriages written over a tie `seedFactions` had derived.
     *
     * Reported because it is a real loss and has to stay small and visible. See
     * {@link seedTheMarriagesTheCatalogStates} for why the marriage wins.
     */
    statedOverDerived: number;
    /** Of those, ones whose other half is no longer alive. */
    widowed: number;
}

function ageInYears(npc: NpcRecord, onDay: number): number {
    return Math.floor((onDay - npc.identity.bornOnDay) / DAYS_PER_YEAR);
}

const isACultivator = (npc: NpcRecord): boolean =>
    npc.cultivation.realmOrdinal >= FOUNDATION_ORDINAL;

/** The last day this person could have been standing at their own wedding. */
const lastDayAlive = (npc: NpcRecord, presentDay: number): number =>
    npc.status === 'alive' ? presentDay : (npc.diedOnDay ?? presentDay);

/**
 * The chance somebody has ever formed a household, given the adult years they
 * have had to do it in.
 *
 * The yearly rate, accumulated, which is what "reach the same state the yearly
 * pass would have reached" means arithmetically - and then the share who never
 * do. Both terms are named; neither is a curve fitted to an outcome.
 */
export function everFormedOne(adultYears: number): number {
    if (adultYears <= 0) return 0;
    const asked = 1 - Math.pow(1 - HOUSEHOLD_PER_YEAR, adultYears);
    return asked * (1 - NEVER_KEEPS_A_HOUSEHOLD);
}

/**
 * Give the world the cultivating households it should already have had.
 *
 * Called once, from `seedWorld`, and BEFORE the families pass: a child gets a
 * second parent off `bindNewbornToHousehold` reading a spouse tie, so a pass
 * that ran after this one would be seeding the households a generation too
 * late.
 */
export function seedTheMarriagesStandingInAPlace(
    state: WorldState,
    presentDay: number,
    roster: Roster = rosterOf(state)
): MarriagesSeeded {
    const { at } = roster;

    // The stated ones FIRST, so the draw below sees them as spoken for and
    // cannot pair somebody the catalog has already married to somebody else.
    const stated = seedTheMarriagesTheCatalogStates(state, presentDay, at);

    const candidates = state.npcs.filter(npc =>
        npc.locationId !== null
        && isBelowTheLid(npc)
        && isACultivator(npc)
        // NOBODY THE CATALOG WROTE IS DRAWN FOR. Theirs are stated - see
        // {@link seedTheMarriagesTheCatalogStates}, which has already run.
        && !somebodyTheCatalogWrote(npc)
        && ageInYears(npc, lastDayAlive(npc, presentDay)) >= HOUSEHOLD_MIN_AGE
        && !npc.relationships.some(r => r.kind === 'spouse'));

    const began = (one: NpcRecord, other: NpcRecord): number =>
        whenAHouseholdBegan(state, one, other, presentDay);

    const drawn = formHouseholds(state, at, {
        candidates,
        wouldPair: one => forStream(state.seed, 'keeps-a-household', one.id)
            .chance(everFormedOne(ageInYears(one, lastDayAlive(one, presentDay)) - HOUSEHOLD_MIN_AGE)),
        couldPair: (one, other) => {
            // Two dead people is a household nothing would ever read. One of
            // them has to still be standing for the tie to mean anything.
            if (one.status !== 'alive' && other.status !== 'alive') return false;
            // And a marriage has to fit between the later coming of age and the
            // earlier death. A window that does not exist is a pair that never
            // stood in the same decade.
            const opens = Math.max(
                one.identity.bornOnDay + HOUSEHOLD_MIN_AGE * DAYS_PER_YEAR,
                other.identity.bornOnDay + HOUSEHOLD_MIN_AGE * DAYS_PER_YEAR
            );
            return Math.min(
                lastDayAlive(one, presentDay), lastDayAlive(other, presentDay)) >= opens;
        },
        beganOn: began
    });

    // Counted off the world afterwards rather than inside the predicate: a
    // count kept by a function that answers a question is a count that is wrong
    // the first time the question is asked about a pair that is then refused
    // for some other reason.
    const gone = new Set(state.npcs.filter(npc => npc.status !== 'alive').map(npc => npc.id));
    const widowed = state.npcs.filter(npc =>
        npc.status === 'alive'
        && npc.relationships.some(r => r.kind === 'spouse' && gone.has(r.targetId))).length;

    return {
        households: stated.written + drawn,
        stated: stated.written,
        statedUnwritten: stated.unwritten,
        statedOverDerived: stated.overDerived,
        widowed
    };
}

/**
 * The day a household began, drawn between the later coming of age and the
 * earlier ending.
 *
 * A DAY, NOT MIDNIGHT ON DAY ZERO, so a world opens holding marriages of every
 * length its people could have kept one - some of them centuries old.
 *
 * A STATED MARRIAGE IS DATED BY THE WORLD AND NOT BY THE CATALOG, which is not
 * a hole in the ruling. The catalog does not give these people a birthday: their
 * age is derived from the rung they stand at and moves with the seed, so a date
 * written down beside the pair would sit outside one of the two lives in most
 * worlds. WHO is the fact; HOW LONG is what this world made of it.
 */
function whenAHouseholdBegan(
    state: WorldState,
    one: NpcRecord,
    other: NpcRecord,
    presentDay: number
): number {
    const opens = Math.max(
        one.identity.bornOnDay + HOUSEHOLD_MIN_AGE * DAYS_PER_YEAR,
        other.identity.bornOnDay + HOUSEHOLD_MIN_AGE * DAYS_PER_YEAR
    );
    const closes = Math.min(
        lastDayAlive(one, presentDay), lastDayAlive(other, presentDay));
    if (closes <= opens) return opens;
    // Keyed on the pair rather than drawn from the place's stream, so it can be
    // asked twice - once to check the window is real and once to date the tie -
    // without moving.
    const rng = forStream(state.seed, 'a-household-began', `${one.id}:${other.id}`);
    return Math.floor(opens + rng.float(0, 1) * (closes - opens));
}

/** What one run over {@link AUTHORED_MARRIAGES} managed. */
interface StatedMarriages {
    written: number;
    unwritten: number;
    overDerived: number;
}

/**
 * Write the marriages the catalog states.
 *
 * No place grouping, no rate and no draw: there is nothing to decide. The two
 * people are named, and the only questions are whether the world holds them and
 * whether writing the tie would destroy another.
 *
 * NEITHER HALF HAS TO BE STANDING IN THE SAME PLACE, which is the one rule of
 * the drawn pass that cannot apply. `formHouseholds` groups by location because
 * it is looking for two people who could plausibly have met; a stated marriage
 * has already happened, and where the two of them stand today is a posting
 * rather than an objection.
 *
 * AND A STATED MARRIAGE OUTRANKS A DERIVED TIE, which is the ordinary rule in
 * this repo read the other way round: a seeder does not argue with the writing.
 * The only rows that can be standing between two catalog figures when this runs
 * are the `rival` and `ally` ones `seedFactions` derives from rank order, and
 * one of them is in the way of the clearest marriage in the catalog - the Keeper
 * of the Ninefold Register married in and did not take the house name, and the
 * house's four Yan are the four who hold "Was the other candidate" and "Serves
 * under" toward her, because she is at the top of it. Refusing there would mean
 * the one marriage `members.ts` states in as many words is the one no world
 * holds.
 *
 * So it is written, and the row it replaces is counted rather than lost
 * quietly - the defect `the-families-a-world-opens-holding.ts` measured at a
 * third of the world's other ties was a DRAWN family eating seeded rows in bulk
 * and silently, and neither of those is true here.
 */
function seedTheMarriagesTheCatalogStates(
    state: WorldState,
    presentDay: number,
    at: Map<string, number>
): StatedMarriages {
    let written = 0;
    let unwritten = 0;
    let overDerived = 0;

    for (const marriage of AUTHORED_MARRIAGES) {
        const oneAt = at.get(worldIdForCatalogPerson(marriage.oneId));
        const otherAt = at.get(worldIdForCatalogPerson(marriage.otherId));
        if (oneAt === undefined || otherAt === undefined) {
            unwritten++;
            continue;
        }
        const one = state.npcs[oneAt];
        const other = state.npcs[otherAt];
        if (one.relationships.some(r => r.targetId === other.id && r.kind !== 'spouse')
            || other.relationships.some(r => r.targetId === one.id && r.kind !== 'spouse')) {
            overDerived++;
        }
        bindHousehold(state, at, one, other, whenAHouseholdBegan(state, one, other, presentDay));
        written++;
    }

    return { written, unwritten, overDerived };
}
