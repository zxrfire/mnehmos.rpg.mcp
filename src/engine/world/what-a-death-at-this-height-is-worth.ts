/**
 * What a death is worth, by who died, and what the world does about it.
 *
 * Three constants decided how big a death was and not one of them read the
 * dead. `elder_died` emitted `scale: 'local'`, `visibility: 'faction'` and a
 * magnitude capped at 0.8; a killing emitted `scale: 'personal'`,
 * `visibility: 'regional'` and 0.45 whoever the victim was. So the First Seat of
 * the Empyrean Court dying and an outer disciple dying differed by four tenths of
 * one number, and the world afterwards was the world before it.
 *
 * The design owner's bar: an elder of a great house dying is news, a Seat dying
 * is *"earth-shaking"* - the age turning. The four Seats are the ceiling of this
 * world, so one of them dying changes what is possible in it.
 *
 * ── THE SCALE IS NOT DECIDED HERE ────────────────────────────────────────
 *
 * `whatArrivingInIsWorth` already answers "how far does a thing at this rung
 * reach", realm by realm, and exists because two files were answering it
 * separately and disagreeing in eight of nine realms. A death is the same
 * question about the same ladder, so it reads that table rather than inventing
 * a third set of cutoffs. Tribulation Transcendence is `continental`; Immortal
 * is `world`.
 *
 * ── PERSONAL ALWAYS, INSTITUTIONAL BY WHAT THEY HELD UP ──────────────────
 *
 * The whole rule, in the owner's terms: **a rate where the outcome is a
 * nothingburger, a simulated life where the outcome is an event, and never a
 * cause invented after the fact at either end.** And on the small death:
 * *"it happens, people cry, sects move on"*.
 *
 * So it is not that the wake scales with the rung. It is WHICH HALF fires:
 *
 *   the personal half    always, at every height, and it is not this file's.
 *                        `settleNpcDeath` moves the heirs, the goals, the ties
 *                        - thinned by a generation and inherited, not erased -
 *                        and the estate; a killing opens the kin's grudge
 *                        through `whatAKillingLeaves`. Somebody always mourns,
 *                        and that is already written.
 *   the institutional    the succession, the oaths released, the power index,
 *                        the houses realigning, and news past the compound.
 *                        This file, and nothing else.
 *
 * An outer disciple dying is a fact in one compound and a name off a roll, and
 * the house absorbs it and carries on. That is the correct amount of ceremony
 * for it, and the pull to give every death a little of the large one is the
 * thing to resist.
 *
 * ── THE PROPERTY, AND WHY THE EXAMPLES ARE NOT THE RULE ──────────────────
 *
 * The owner, on the other end of it: *"a patriarch or empyrean court seat dying -
 * earth shaking"*, and then, plainly: *"again, examples"*. THOSE TWO ARE NOT
 * THE SET, and a rule written as "ordinal above N, or rank index 0" gets his
 * two examples right and everything else wrong.
 *
 * The property is this: **a death is earth-shaking when the world afterwards is
 * not arranged the way it was before.** Several roads reach it, and the band is
 * whoever the property catches:
 *
 *   how high they stood     read off the same table a crossing is, so the top
 *                           of the ladder carries by itself. A False Immortal
 *                           arrives here without anybody naming the role.
 *   what they held          the top rung of a live house. A patriarch at Core
 *                           Formation is a succession everybody has an interest
 *                           in, whatever their rung.
 *   who leaned on them      the people whose protection was their word, and the
 *                           ones who answered to them directly. A protector
 *                           whose presence was the reason a house was left
 *                           alone is exactly this, and has no title at all.
 *   what only they carried  the last living holder of an art. What goes with
 *                           them is not replaceable. `technique_lost` asks the
 *                           same question of the whole roll, and both now derive
 *                           it from {@link howManyLivingHoldEachArt} rather than
 *                           each counting for itself - see that function for
 *                           what the two copies had already drifted on.
 *
 * NOT YET A ROAD, and worth writing down so nobody assumes it is handled:
 * somebody whose name alone was keeping two houses from fighting. The world
 * models house standing and it models who they are afraid of, but nothing joins
 * the two into "this person was the reason", and inventing it here would be a
 * second answer to a question the war code should own.
 *
 * AND IT MUST CATCH FEW PEOPLE. An age does not turn often: if a long run says
 * a tenth of deaths are earth-shaking, the property is too generous and the
 * fix is here rather than in the wake.
 *
 * What {@link theWakeOfADeath} does, all of it through machinery that already
 * existed:
 *
 *   the power index   `power_ordinal` is the strongest person on a roll. It was
 *                     recomputed on intake and never on a death, so a house
 *                     whose strongest died went on being read at their height
 *                     by recruitment, gatherings and the road table. Now it
 *                     falls when they do, and the figure is written onto the
 *                     fact so the drop is visible rather than silent.
 *   who stood behind  every open oath the dead person swore is released: the
 *                     one who owed it is not there to keep it. Anybody who had
 *                     their protection has lost it, which is what that means.
 *   friends and foes  a house that has lost its strongest is worth less to the
 *                     houses that stood with it and less frightening to the
 *                     ones that stood against it. Both move, by how much of the
 *                     house's height went with them.
 *   the succession    a chair at the top of a house emptying is an event with a
 *                     name, not the promotion pass quietly refilling it.
 *
 * ── AND A DEATH IS AN OUTCOME, NOT A RATE ────────────────────────────────
 *
 * The rule behind every cause in this world, in the design owner's terms:
 * *"people don't randomly die at 5% at a uniform rate, we simulate what
 * happened in x years based on their current traits, whether they chose to
 * advance or what. and if they died in a war."* The list is not closed. The
 * test for any path that ends somebody is whether the death came out of
 * something that actually happened to this person; what fails it is a weighted
 * pick with a cause attached afterwards, however plausible the cause reads.
 *
 * Two halves, and the second is a hard constraint:
 *
 *   the general population   may keep a rate. Mortals and the low rungs live
 *                            short lives full of things that kill people, and a
 *                            rate is a fair summary of a life nobody is
 *                            simulating in detail.
 *   ordinal 29 and above     NO BACKGROUND RATE AT ALL. *"These old monsters
 *                            value their lives."* What kills somebody there is
 *                            a thing they chose - a crossing, a wall, a fight
 *                            taken - or a thing large enough to reach them: a
 *                            war, a house falling around them, another old
 *                            monster, or their span running out. Caution is a
 *                            trait at that height and not an exception to a
 *                            rule: somebody who spent millennia getting there
 *                            does not take a fight they might lose.
 *
 * ── WHAT THAT RULE DELETED, WHICH IS THE POINT OF WRITING IT DOWN ────────
 *
 * `time.ts` already ends everybody whose `lifespanEndsOnDay` has passed, on the
 * exact day, with a fact. A span running out is modelled properly. So the
 * `elder_died` pass drawing somebody by how much of their span they had spent
 * was not a second cause - it was a rate that killed people BEFORE their span
 * ran out, and a second earlier version of a death the world already does. It
 * is gone. What is left of that pass is a wound somebody was already carrying,
 * and only below {@link WHERE_THE_OLD_MONSTERS_BEGIN}.
 *
 * ── AND WHAT SURVIVED THE AUDIT DELIBERATELY ─────────────────────────────
 *
 * `disappearance` and `technique_lost` are weighted picks, which is the shape
 * this rule dislikes - and they should stay. Neither ends anybody:
 * `theWorldLoses` writes MISSING, and somebody nobody can account for is
 * exactly what seclusion looks like from outside, which at this height is the
 * ordinary condition rather than a loss. Rebuilding going-into-seclusion as a
 * choice, to produce a row that reads identically, would cost a system and buy
 * nothing. Do not "fix" them.
 *
 * UNMEASURED. Written against a reading of the code, not against a run: what
 * needs measuring is deaths per century by cause and by rung above and below
 * 29, whether the Court's four Seats reach five thousand years, and whether the
 * standing moves compound over that span into houses that all hate each other.
 */

import { whatArrivingInIsWorth } from './a-crossing-enters-the-world-as-news.js';
import { makeFact, type EventScale, type FactVisibility } from './history.js';
import { isBelowTheLid } from './layers.js';
import { relationshipWith, type NpcRecord } from './npc-state.js';
import { settleObligation } from '../social/grudges.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { FactionRecord, WorldState } from './world-state.js';

/**
 * How often the yearly draw takes somebody with an old wound: an untreated
 * injury that finally kills them.
 *
 * The one cause that exists on the row before the draw. A span running out is
 * `time.ts`'s, on the day, and a breakthrough that did not hold is
 * `applyAdvancement`'s.
 */
export const WHEN_IT_IS_AN_OLD_WOUND = 0.25;

/**
 * Where the old monsters begin, and the background rate stops.
 *
 * The owner's own figure, and the same rung `the-rogues-a-world-opens-with.ts`
 * reads as the height a person with no house is not supposed to reach.
 */
export const WHERE_THE_OLD_MONSTERS_BEGIN = 29;

/** What a death at somebody's height is worth as an event. */
export interface WhatADeathIsWorth {
    scale: EventScale;
    visibility: FactVisibility;
    /** 0..1, the news layer's own weight. */
    magnitude: number;
}

/**
 * What holding the top rung of a house adds to the magnitude of dying.
 *
 * A seat is one chair. Somebody at the same rung who does not hold one is one
 * of a house's seniors; the holder is the house, in the way the province talks
 * about it.
 */
export const WHAT_HOLDING_A_CHAIR_ADDS = 0.15;

/** Where a death stops being a house's business and becomes everybody's. */
export const WHEN_A_DEATH_IS_MORE_THAN_A_HOUSES_OWN: readonly EventScale[] =
    Object.freeze(['regional', 'continental', 'world']);

/**
 * How many people leaning on somebody makes their going a thing the world has
 * to rearrange itself around.
 *
 * Deliberately not small. Every master of two disciples has somebody leaning on
 * them, and the band is supposed to be rare.
 */
export const ENOUGH_PEOPLE_LEANED_ON_THEM = 6;

/** Below this nobody is holding anything up, and the roads are not worth reading. */
export const NOBODY_LEANS_ON_A_MORTAL = 13;

/** What this person was holding up, beside their own rung. */
export interface WhatTheyHeldUp {
    /** People whose protection was their word: open oaths they swore. */
    swornTo: number;
    /** People who answered to them directly and are still alive. */
    leanedOnThem: number;
    /** True where nobody else alive carries an art they carried. */
    theLastOfAnArt: boolean;
}

/**
 * How many living people below the lid carry each art in the world.
 *
 * THE PRIMITIVE, and the reason it is a map rather than a per-person walk. Two
 * readers want this property and they want it at different scales: a death asks
 * it of ONE person, and `technique_lost` has to ask it of the whole roll to know
 * who it may draw from at all. A per-person answer used to build a pool is a
 * walk of the roll per person, which is the roll squared; this is one walk, and
 * both readers derive from it.
 *
 * ALIVE AND BELOW THE LID. Somebody above the lid holding an art is not somebody
 * anybody here can be taught by, which is what "nobody living has it" means in
 * the world the player is standing in. This unified two filters that disagreed:
 * the pass already read the lid and {@link whatTheyHeldUp} did not, so a person
 * whose art survived only in the hands of an immortal read as replaceable here
 * and as the last of it there.
 */
export function howManyLivingHoldEachArt(state: WorldState): Map<string, number> {
    const counts = new Map<string, number>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !isBelowTheLid(npc)) continue;
        // A person's own list is not a set by construction, and counting a
        // duplicate twice would make somebody the second holder of their own art.
        for (const id of new Set(npc.cultivation.techniqueIds)) {
            counts.set(id, (counts.get(id) ?? 0) + 1);
        }
    }
    return counts;
}

/**
 * The arts this person carries that nobody else alive carries.
 *
 * What goes out of the world with them. Empty is the ordinary answer: a house
 * teaches its shelf to everybody who can reach it, so most arts are held by
 * dozens and only the top of a library reaches exactly one person.
 *
 * Pass `counts` when asking about more than one person - see
 * {@link howManyLivingHoldEachArt} for why.
 */
export function theArtsOnlyTheyHold(
    state: WorldState,
    npc: NpcRecord,
    counts: Map<string, number> = howManyLivingHoldEachArt(state)
): string[] {
    if (npc.status !== 'alive' || !isBelowTheLid(npc)) return [];
    return [...new Set(npc.cultivation.techniqueIds)].filter(id => counts.get(id) === 1);
}

/**
 * What a person was holding up, read off the world rather than off a title.
 *
 * Cheap by construction: nobody below `NOBODY_LEANS_ON_A_MORTAL` is holding
 * anything up, and a death is a rare enough event to walk the roll once.
 */
export function whatTheyHeldUp(state: WorldState, npc: NpcRecord): WhatTheyHeldUp {
    const none = { swornTo: 0, leanedOnThem: 0, theLastOfAnArt: false };
    if (npc.cultivation.realmOrdinal < NOBODY_LEANS_ON_A_MORTAL) return none;

    let swornTo = 0;
    for (const record of state.obligations ?? []) {
        if (record.kind === 'oath' && record.status === 'open' && record.holderId === npc.id) swornTo++;
    }

    let leanedOnThem = 0;
    for (const other of state.npcs) {
        if (other.id === npc.id || other.status !== 'alive') continue;
        const tie = relationshipWith(other, npc.id);
        if (tie === null) continue;
        // Somebody who answered to them: their master, their teacher, the
        // patron they stood behind. The tie is held by the one who leaned,
        // which is the direction read here - a protector whose presence was the
        // reason a house was left alone is a row of these and no title at all.
        if ((tie.kind === 'master' || tie.kind === 'teacher' || tie.kind === 'patron')
            && tie.standing > 0) leanedOnThem++;
    }
    // DERIVED, not counted here. This walk used to carry its own copy of the
    // rule, which is how it came to disagree with the pass about the lid.
    return { swornTo, leanedOnThem, theLastOfAnArt: theArtsOnlyTheyHold(state, npc).length > 0 };
}

/**
 * How far the news of this death carries, and how loud it is.
 *
 * `state` is optional only because two callers hold a row before they hold a
 * world; with it, the roads other than the rung are read.
 */
export function whatADeathIsWorth(
    npc: Pick<NpcRecord, 'cultivation' | 'factionRankIndex'>,
    house: Pick<FactionRecord, 'ranks'> | null,
    heldUp?: WhatTheyHeldUp | null
): WhatADeathIsWorth {
    const ordinal = npc.cultivation.realmOrdinal;
    const heldAChair = house !== null && house.ranks.length > 0
        && npc.factionRankIndex >= house.ranks.length - 1;
    // THE PROPERTY, BY WHICHEVER ROAD REACHES IT. The rung carries by itself at
    // the top; a chair, the people who leaned on them, or being the last hands
    // an art is in carry somebody the rung would have left in their compound.
    // It never lowers what the rung already bought.
    const byRung = whatArrivingInIsWorth(ordinal).scale;
    const theWorldMustRearrange = heldAChair
        || (heldUp != null && (heldUp.theLastOfAnArt
            || heldUp.swornTo + heldUp.leanedOnThem >= ENOUGH_PEOPLE_LEANED_ON_THEM));
    const scale: EventScale =
        theWorldMustRearrange && (byRung === 'personal' || byRung === 'local')
            ? 'regional'
            : byRung;
    // A death nobody outside the compound could perceive is the house's own
    // business; past that, the qi of the place said it before anybody did.
    const visibility: FactVisibility =
        scale === 'personal' ? 'faction'
            : scale === 'local' ? 'faction'
                : scale === 'regional' ? 'regional' : 'public';
    const magnitude = Math.min(1,
        0.2 + ordinal * 0.02 + (heldAChair ? WHAT_HOLDING_A_CHAIR_ADDS : 0));
    return { scale, visibility, magnitude: Number(magnitude.toFixed(2)) };
}

/**
 * Whether this person's dying would leave the world arranged differently.
 *
 * ONE PROPERTY, READ IN TWO PLACES, and that is the point of it. The owner:
 * *"i'm also not even against the 5% loss function if it makes sense, it just
 * doesn't make sense to high ordinal figures. patriarchs obviously don't have a
 * 5% chance of dying every year."* A rate is an honest summary of a life nobody
 * is simulating in detail, and the world has to stay dangerous - so a rate is
 * not the enemy. What cannot be decided by a background draw is somebody whose
 * death would reorder things, and that is exactly the same set of people whose
 * death carries when it does come.
 *
 * So this decides who is exempt from a rate AND how far the news travels. Two
 * thresholds would have drifted apart; this one cannot. Note what it catches
 * that an ordinal cut does not: the head of a modest house at Core Formation,
 * who is a patriarch by every meaning of the word.
 */
export function theirDeathWouldRearrangeTheWorld(
    state: WorldState,
    npc: NpcRecord,
    house?: Pick<FactionRecord, 'ranks'> | null
): boolean {
    const home = house !== undefined ? house
        : npc.factionId === null ? null
            : state.factions.find(f => f.id === npc.factionId) ?? null;
    return theWorldTakesNoticeOf(whatADeathIsWorth(npc, home, whatTheyHeldUp(state, npc)));
}

/** Whether a death at this scale is the world's business and not one house's. */
export function theWorldTakesNoticeOf(worth: WhatADeathIsWorth): boolean {
    return WHEN_A_DEATH_IS_MORE_THAN_A_HOUSES_OWN.includes(worth.scale);
}

/**
 * What a friend loses and what an enemy gains when a house's strongest is gone,
 * at the full share. Scaled by how much of the house's height went with them.
 */
export const WHAT_LOSING_THEM_MOVES_A_HOUSE_STANDING = 0.15;

/** What the world did about this death. Null where it did nothing, which is ordinary. */
export interface TheWake {
    worth: WhatADeathIsWorth;
    /** The house's power index before and after, where it moved. */
    powerWas: number | null;
    powerNow: number | null;
    /** Open oaths the dead had sworn, now released because nobody is left to keep them. */
    protectionsLapsed: number;
    /** Houses whose standing toward the dead person's house moved. */
    housesThatMoved: number;
    /** True where the chair they held is now empty. */
    seatEmptied: boolean;
}

/**
 * The world reordering itself around a death. Call AFTER the row is dead and
 * `settleNpcDeath` has run: this reads the roll as it now stands.
 *
 * Returns null for a death the world does not take notice of, which is nearly
 * all of them.
 */
export function theWakeOfADeath(
    state: WorldState,
    deceased: NpcRecord,
    day: number,
    cause: string
): TheWake | null {
    const house = deceased.factionId === null
        ? null
        : state.factions.find(f => f.id === deceased.factionId) ?? null;
    const worth = whatADeathIsWorth(deceased, house, whatTheyHeldUp(state, deceased));
    if (!theWorldTakesNoticeOf(worth)) return null;

    // ── THE POWER INDEX ──────────────────────────────────────────────────
    let powerWas: number | null = null;
    let powerNow: number | null = null;
    let seatEmptied = false;
    if (house !== null) {
        powerWas = Number(house.resources.power_ordinal ?? 0);
        const strongest = state.npcs.reduce((top, n) =>
            n.factionId === house.id && n.status === 'alive' && n.id !== deceased.id
                ? Math.max(top, n.cultivation.realmOrdinal) : top, 0);
        if (strongest !== powerWas) {
            house.resources.power_ordinal = strongest;
            powerNow = strongest;
        }
        seatEmptied = house.ranks.length > 0
            && deceased.factionRankIndex >= house.ranks.length - 1;
    }

    // ── WHO STOOD BEHIND THEM ────────────────────────────────────────────
    //
    // An oath is a person's word, and the person is gone. Released rather than
    // broken: they did not fail to keep it.
    let protectionsLapsed = 0;
    const ledger = state.obligations ?? [];
    for (let i = 0; i < ledger.length; i++) {
        const record = ledger[i]!;
        if (record.kind !== 'oath' || record.status !== 'open') continue;
        if (record.holderId !== deceased.id) continue;
        ledger[i] = settleObligation(record, {
            resolution: 'oath_released',
            onDay: day,
            byId: deceased.id,
            note: `${deceased.name} is dead, and nobody is left to keep it.`
        });
        protectionsLapsed++;
    }

    // ── FRIENDS AND FOES ─────────────────────────────────────────────────
    //
    // How much of the house went with them: the whole of it where they were its
    // ceiling, less where somebody else stands at the same height.
    let housesThatMoved = 0;
    if (house !== null && powerWas !== null && powerNow !== null && powerWas > 0) {
        const share = Math.max(0, Math.min(1, (powerWas - powerNow) / powerWas));
        const move = WHAT_LOSING_THEM_MOVES_A_HOUSE_STANDING * share;
        if (move > 0.001) {
            for (const other of state.factions) {
                if (other.id === house.id || other.dissolvedOnDay !== null) continue;
                const stood = other.standing[house.id];
                if (stood === undefined || stood === 0) continue;
                // Worth less to a friend, less frightening to an enemy: both
                // read the same way, which is that the house standing there is
                // not the house they were standing with or against.
                other.standing[house.id] = Number(
                    Math.max(-1, Math.min(1, stood - Math.sign(stood) * move * Math.abs(stood)))
                        .toFixed(3));
                housesThatMoved++;
            }
        }
    }

    // ── THE SUCCESSION ───────────────────────────────────────────────────
    if (seatEmptied && house !== null) {
        appendWorldFact(state, makeFact({
            day,
            kind: 'succession',
            scale: worth.scale,
            summary:
                `The chair ${deceased.name} held in the ${house.name} is empty. ${cause}`,
            actors: [{ id: deceased.id, name: deceased.name, role: 'deceased' }],
            locationId: house.seatLocationId ?? deceased.locationId,
            factionIds: [house.id],
            visibility: worth.visibility,
            magnitude: worth.magnitude,
            data: {
                powerWas,
                powerNow,
                protectionsLapsed,
                housesThatMoved,
                unattributed:
                    'The mountain has been shut for a season, and the houses that deal with '
                    + 'it are all waiting on the same answer.'
            }
        }));
    }

    return { worth, powerWas, powerNow, protectionsLapsed, housesThatMoved, seatEmptied };
}
