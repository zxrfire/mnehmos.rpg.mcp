/**
 * Face: what somebody is worth in front of people, and the pile of small
 * slights between two of them.
 *
 * Ruled by the design owner: face is raised by victories, by deeds people saw
 * and by challenges answered; lowered by public defeats, by being exposed, by
 * refusing a challenge and by being driven off in front of others. Face between
 * two people or two houses is *the pile of small slights*, and a slight weighs
 * more when it was witnessed.
 *
 * ── TWO THINGS, AND ONLY ONE OF THEM IS A NEW NUMBER ─────────────────────
 *
 * WHAT THEY ARE WORTH IN FRONT OF PEOPLE is one number on the row,
 * `NpcRecord.face`, kept the way `merit` is kept: the smallest thing that
 * cannot be derived. It cannot be read off the ties, because a defeat in front
 * of three hundred strangers moves nothing between any two people and is
 * exactly what face is about.
 *
 * WHAT IS BETWEEN TWO PEOPLE is not a new number and must not become one. The
 * world already keeps it twice over: the standing on the tie
 * (`upsertRelationship`, `andTheOtherEnd`) and the obligation ledger's
 * `humiliation`, which is the word this design already had for a slight. So a
 * slight writes there, weighted by who saw it, and `theSlightsBetween` reads
 * the pile back out of the rows that are already being written.
 *
 * ── WHAT ACTUALLY WRITES FACE TODAY, WHICH IS TWO THINGS ─────────────────
 *
 * MEASURED, not read off the design: on `afford-a` at a thousand years, over
 * the twelve people carrying a removal from office - seniors, long-serving, the
 * kind of people a house's opinion is made of - **the mean face was zero.** Not
 * low. Zero, for every one of them.
 *
 * The cause is that `theirFaceMoves` and `withFace` are called from exactly two
 * places: `a-challenge-is-answered-on-the-yard.ts`, and the killing pass, where
 * somebody pays for being seen to kill beneath themselves. **Face is a currency
 * only violence mints.** Nobody in this world has ever gained or lost face by
 * doing their job well or badly, and the header above this one lists roads that
 * are not wired to anything:
 *
 *   *"deeds people saw"*        no deed writes face. `aDeedEntersTheWorld` knows
 *                               its own witnesses and its weight and writes
 *                               neither into this field.
 *   *"public defeats"*          only a duel on the yard counts. Losing a war,
 *                               being driven off ground, having a house's demand
 *                               refused in front of its own people: none of it.
 *   *"being exposed"*           the expose route is the owner's stated normal way
 *                               a seat changes hands, running at 31 to 32 cases
 *                               a century, and a holder turned out of an office
 *                               in front of the room loses NO face by it.
 *
 * ── THE WRITERS THIS WANTS, NAMED RATHER THAN BUILT ──────────────────────
 *
 * Deliberately not built: a currency is worth more designed once than wired in
 * a hurry at the end of a night. The natural writers, each already an event
 * somebody witnesses, with the machinery that already knows the witnesses:
 *
 *   a lecture that lands        `theWanderersGoAbout` and the attention pass
 *                               already count listeners.
 *   a promotion, and a removal  `assessPromotions` and `whatASentenceDoesToTheirPlace`
 *                               both move somebody in front of their house.
 *   a commission finished       the crafting path knows the grade asked for and
 *                               the grade delivered.
 *   a seat won or lost          the conclave already resolves in public.
 *   an acknowledgement          somebody senior naming somebody junior in front
 *                               of others, which the attention pass could write.
 *
 * Each is one call to {@link theirFaceMoves} scaled by
 * {@link whatBeingWatchedIsWorth}, which is the point: the scale below already
 * takes witnesses and the gap, so a writer only has to say what happened and
 * who saw it.
 *
 * UNTIL THEN, READ THIS FIELD KNOWING WHAT IT HOLDS. Anything weighing face
 * against another quantity is weighing a number that is zero for everybody who
 * has never been in a duel or killed somebody far beneath them. The removal
 * weight in `bringing-what-you-know-about-somebody-to-the-room.ts` reads it and
 * gets nothing from it, which is how this was found.
 *
 * ── THE SCALE ────────────────────────────────────────────────────────────
 *
 * One public win over an equal is {@link A_PUBLIC_WIN} and everything else is
 * stated against it, so there is one figure to argue with rather than a table.
 * Two things scale it, both of them facts about the event rather than dials:
 *
 *   WHO SAW IT       `whatBeingWatchedIsWorth`. Nobody watching is a private
 *                    matter and moves a fraction; a roll's worth of witnesses
 *                    (`A_ROLL_A_PLAYER_COULD_KNOW`, the number of people one
 *                    person can hold in their head) is the full figure; a
 *                    province's worth is capped at three times it, because
 *                    news of a thing is not the thing.
 *   WHO THEY WERE    `whatTheGapIsWorth`. Beating somebody a realm above you is
 *                    worth more than beating your own junior, and losing to
 *                    your junior costs more than losing to somebody above you -
 *                    gaps counted in REALMS, which is how this world counts
 *                    every other gap between two people.
 */

import { realmIndexOf } from '../cultivation/realms.js';
import { A_ROLL_A_PLAYER_COULD_KNOW } from './a-house-raises-its-own.js';
import { upsertRelationship, type NpcRecord } from './npc-state.js';
import { andTheOtherEnd } from './a-tie-has-two-ends.js';
import type { WorldState } from './world-state.js';

/*
 * WHAT MOVES IT TODAY, AND WHAT SHOULD. A challenge answered, a public win, a
 * public defeat, a refusal, stepping into somebody else's duel and breaking
 * declared terms all move it, through `a-challenge-is-answered-on-the-yard.ts`.
 * The owner's list has two more on it that belong to passes other people own:
 * BEING EXPOSED, which is the knowledge layer working out who did something,
 * and BEING DRIVEN OFF in front of people, which is the killing and rogue path.
 * Both should call `theirFaceMoves` when they land rather than keeping a second
 * number; there is one number and this is it.
 */

/** One public win over an equal, in front of a roll's worth of people. */
export const A_PUBLIC_WIN = 1;

/** What a thing nobody watched is worth against the same thing in public. */
export const WITH_NOBODY_WATCHING = 0.2;

/** The most any crowd can multiply a thing by. News of a thing is not the thing. */
export const THE_MOST_A_CROWD_IS_WORTH = 3;

/** What somebody is worth in front of people. Absent is nought, which is ordinary. */
export function faceOf(npc: Pick<NpcRecord, 'face'>): number {
    const held = npc.face;
    return typeof held === 'number' && Number.isFinite(held) ? held : 0;
}

/** The same row with face moved. Rounded to hundredths, like every other stored figure. */
export function withFace<T extends NpcRecord>(npc: T, delta: number, onDay: number): T {
    if (!Number.isFinite(delta) || delta === 0) return npc;
    return { ...npc, face: Number((faceOf(npc) + delta).toFixed(2)), updatedOnDay: onDay };
}

/** Move somebody's face where they stand in `state.npcs`. Returns what it came to. */
export function theirFaceMoves(state: WorldState, npcId: string, delta: number, onDay: number): number {
    const at = state.npcs.findIndex(n => n.id === npcId);
    if (at < 0) return 0;
    state.npcs[at] = withFace(state.npcs[at]!, delta, onDay);
    return faceOf(state.npcs[at]!);
}

/** How much the people watching multiply it by. See the header. */
export function whatBeingWatchedIsWorth(witnesses: number): number {
    const saw = Math.max(0, Math.floor(witnesses));
    if (saw === 0) return WITH_NOBODY_WATCHING;
    return Math.min(THE_MOST_A_CROWD_IS_WORTH, Math.max(
        WITH_NOBODY_WATCHING,
        saw / A_ROLL_A_PLAYER_COULD_KNOW
    ));
}

/**
 * What the gap between them is worth to the one who came off better, in realms.
 *
 * Beating somebody above you is the story; beating your own junior is a
 * Tuesday. Floored rather than allowed to go negative: a win is never worth
 * less than nothing to the winner, it is simply worth very little.
 */
export function whatTheGapIsWorth(winnerOrdinal: number, loserOrdinal: number): number {
    const gap = realmIndexOf(loserOrdinal) - realmIndexOf(winnerOrdinal);
    return Math.max(0.25, 1 + gap);
}

/** What winning in front of people is worth to the winner. */
export function whatWinningIsWorth(input: {
    winnerOrdinal: number;
    loserOrdinal: number;
    witnesses: number;
}): number {
    return Number((A_PUBLIC_WIN
        * whatTheGapIsWorth(input.winnerOrdinal, input.loserOrdinal)
        * whatBeingWatchedIsWorth(input.witnesses)).toFixed(2));
}

/**
 * What losing in front of people costs the loser.
 *
 * The mirror of the gap: losing to somebody far above you is no disgrace and
 * losing to your own junior is the one everybody remembers.
 */
export function whatLosingCosts(input: {
    loserOrdinal: number;
    winnerOrdinal: number;
    witnesses: number;
}): number {
    return Number((A_PUBLIC_WIN
        * whatTheGapIsWorth(input.winnerOrdinal, input.loserOrdinal)
        * whatBeingWatchedIsWorth(input.witnesses)).toFixed(2));
}

/**
 * A slight, written where slights are already written.
 *
 * The standing on the tie moves by what it was worth, in both directions - what
 * the slighted person holds, and what the other one knows they did - and the
 * note says what it was about. Nothing new is stored: this is the pile the
 * owner named, and it is the pile the world was already keeping.
 */
export function aSlightBetween(
    state: WorldState,
    input: {
        slighted: NpcRecord;
        by: NpcRecord;
        /** What it was worth in face, which is what it is worth on the tie. */
        worth: number;
        note: string;
        day: number;
    }
): void {
    const at = state.npcs.findIndex(n => n.id === input.slighted.id);
    if (at < 0) return;
    const held = Math.max(-1, Math.min(-0.05, -input.worth / (A_PUBLIC_WIN * THE_MOST_A_CROWD_IS_WORTH)));
    state.npcs[at] = upsertRelationship(state.npcs[at]!, {
        targetId: input.by.id,
        targetName: input.by.name,
        kind: 'rival',
        standing: held,
        note: input.note
    }, input.day);
    andTheOtherEnd(state.npcs, input.slighted, { targetId: input.by.id, kind: 'rival', standing: held },
        input.day, { note: input.note });
}

/**
 * The pile between these two, as the rows already hold it: how far under nought
 * the coldest thing the slighted one holds about them stands. Nought where
 * there is nothing between them.
 *
 * EVERY ROW FOR THAT PERSON, AND NOT THE FIRST ONE.
 *
 * Rows are keyed by the pair AND the kind (`npc-state.ts`), so two people hold
 * as many rows as there are things true between them, and `relationships` is
 * sorted with the most DEFINING kind first - a marriage, a parentage, a bond -
 * ahead of the temperature a slight is written onto (`aSlightIsHeld` writes
 * `rival`). A `find` here therefore answered with the marriage, at a standing
 * above nought, and returned nought: a wife publicly humiliated by her husband
 * read as having nothing between them, and refused nothing and answered
 * nothing on it. The defining row is exactly the wrong row to ask, because the
 * closer two people are the further it sorts from the slight.
 *
 * So: the coldest of everything standing between them, whatever kind carries
 * it. Do not "simplify" this back to one row. One pass and no allocation,
 * because the duel read calls it inside the year's loops.
 */
export function theSlightsBetween(holder: NpcRecord, otherId: string): number {
    let coldest = 0;
    for (const tie of holder.relationships) {
        if (tie.targetId !== otherId) continue;
        if (tie.standing < coldest) coldest = tie.standing;
    }
    return coldest === 0 ? 0 : Number((-coldest).toFixed(2));
}
