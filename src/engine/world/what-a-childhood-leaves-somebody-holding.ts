/**
 * What a childhood leaves somebody holding, besides a household.
 *
 * A life arrived at sixteen with kin and nothing else. The opening bound
 * `parent` and `kin` and stopped there, on a ruling that a MASTER is the road
 * the game is about and should be earned in play rather than handed over - which
 * is right, and which had quietly come to mean that nobody outside the household
 * had ever mattered to anybody before their first turn.
 *
 * So a person could not be told *the one who taught you is dead*, because there
 * was no one who taught you. The trope the design owner asked for - *"your
 * mentor dying is a classic xianxia trope that ought to fall out"* - was
 * unreachable, and not because the world kills nobody: because the tie was never
 * written.
 *
 * ── WHAT IT CAN LEAVE, AND THE LIST IS NOT CLOSED ────────────────────────
 *
 * The owner, twice, and the second widened the first: *"yes, some ties"*, then
 * *"maybe you're looking for a disciple that saved you... you wanna repay him.
 * example, non exhaustive."* So two stores rather than one kind:
 *
 *   A TIE          somebody taught them, or took them in. `teacher` at its
 *                  existing light weight, which is a line and not a bond -
 *                  nobody knelt and nobody acknowledged anybody.
 *   AN OBLIGATION  somebody did something for them that they mean to repay.
 *                  `createFavor` with the causes the ledger already has:
 *                  `saved_life`, `sheltered`, `gifted_resource`.
 *
 * AND THE SECOND IS THE ONE WORTH HAVING. A tie tells a player who they were; a
 * debt tells them what to do. *Somebody saved you and you want to repay them* is
 * a road out of the opening - you can go and find them, find that they are gone,
 * or find who killed them - and none of that needs a new system, because the
 * obligation ledger is where the oath at the door and the teaching term already
 * live.
 *
 * ── SOME LIVES, AND THE NUMBER FALLS OUT ─────────────────────────────────
 *
 * {@link SOME_LIVES_HOLD_SOMETHING}. A life with nobody outside its household is
 * an ordinary life and stays the common case - the same shape as *it might* and
 * *"its totally possible the protagonist had a happy childhood, lol"*. Nothing
 * here is stamped at one: a life may hold a tie, a debt, both or neither.
 *
 * ── AND NOTHING HERE GENERATES A DEATH ───────────────────────────────────
 *
 * Whoever is bound is somebody the world already has, standing where that life
 * stood. Whether they are alive when the opening runs is the world's business:
 * it kills people for its own reasons and this reads what it did. A bound person
 * is nobody special - a village elder who taught somebody once is an ordinary
 * person the world may kill, ignore, or let die of age, and the whole value of
 * this is that the world does not know it did anything.
 *
 * NO MASTER, and that ruling stands: `master` is the road the game is about.
 */

import { createFavor, type FavorCause, type ObligationRecord } from '../social/grudges.js';
import { forStream } from '../cultivation/rng.js';
import { TAUGHT_BY_STANDING } from './the-ties-an-ordinary-life-produces.js';
import { isBelowTheLid } from './layers.js';
import { upsertRelationship, type NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

/** How many lives hold anything at all from outside the household. */
export const SOME_LIVES_HOLD_SOMETHING = 0.35;

/** Of those, how many hold a second thing. Fewer, so one stays the ordinary case. */
export const AND_A_FEW_HOLD_TWO = 0.3;

/** How much older somebody has to be to have taught or sheltered a child. */
export const OLD_ENOUGH_TO_HAVE_TAUGHT_THEM = 14;

/** What a childhood debt is for, in the ledger's own words. */
export const WHAT_SOMEBODY_DID_FOR_THEM: readonly FavorCause[] =
    Object.freeze(['saved_life', 'sheltered', 'gifted_resource']);

/** One thing a childhood left, either a tie or an account. */
export interface SomethingAChildhoodLeft {
    /** The person on the other end. Somebody the world has, alive or not. */
    otherId: string;
    otherName: string;
    /** `taught` writes a tie; the rest open an obligation this life holds. */
    what: 'taught' | FavorCause;
    /** The obligation, where one was opened. */
    owed: ObligationRecord | null;
}

/**
 * Bind whatever this life's childhood left it, onto the life's own row and onto
 * the ledger. Returns what was bound, which is usually nothing.
 *
 * `near` is the people standing where this life stood: the caller knows that
 * better than this does, and passing them in keeps the world read in one place.
 */
export function whatTheirChildhoodLeftThem(input: {
    state: WorldState;
    /** Null where the world has no row for this life yet, and then nothing is bound. */
    life: NpcRecord | null;
    near: readonly NpcRecord[];
    seed: string;
    day: number;
}): SomethingAChildhoodLeft[] {
    const { state, life, near, seed, day } = input;
    if (life === null) return [];
    const rng = forStream(seed, 'what-a-childhood-left', life.id);
    if (!rng.chance(SOME_LIVES_HOLD_SOMETHING)) return [];

    const ageInDays = day - life.identity.bornOnDay;
    const couldHave = near.filter(other =>
        other.id !== life.id
        && isBelowTheLid(other)
        // Older than them by enough to have been the one doing the teaching or
        // the sheltering. Read off birth rather than status, so somebody the
        // world has since killed is still eligible - which is the whole point.
        && (day - other.identity.bornOnDay) - ageInDays >= OLD_ENOUGH_TO_HAVE_TAUGHT_THEM * 365);
    if (couldHave.length === 0) return [];

    const out: SomethingAChildhoodLeft[] = [];
    const wanted = rng.chance(AND_A_FEW_HOLD_TWO) ? 2 : 1;
    const taken = new Set<string>();
    for (let i = 0; i < wanted && taken.size < couldHave.length; i++) {
        let other = couldHave[rng.int(0, couldHave.length - 1)]!;
        if (taken.has(other.id)) {
            const left = couldHave.filter(c => !taken.has(c.id));
            other = left[rng.int(0, left.length - 1)]!;
        }
        taken.add(other.id);
        out.push(rng.chance(0.5)
            ? theyTaughtThem(state, life, other, day)
            : theyDidSomethingForThem(state, life, other, rng.int(0, WHAT_SOMEBODY_DID_FOR_THEM.length - 1), day));
    }
    return out;
}

/** A line, not a bond: somebody showed them the first form. */
function theyTaughtThem(
    state: WorldState,
    life: NpcRecord,
    other: NpcRecord,
    day: number
): SomethingAChildhoodLeft {
    const at = state.npcs.findIndex(n => n.id === life.id);
    if (at >= 0) {
        state.npcs[at] = upsertRelationship(state.npcs[at]!, {
            targetId: other.id,
            targetName: other.name,
            kind: 'teacher',
            standing: TAUGHT_BY_STANDING,
            note: `Showed them what they know, before any of it had a name.`
        }, day);
    }
    return { otherId: other.id, otherName: other.name, what: 'taught', owed: null };
}

/** And somebody did something for them that they mean to repay. */
function theyDidSomethingForThem(
    state: WorldState,
    life: NpcRecord,
    other: NpcRecord,
    which: number,
    day: number
): SomethingAChildhoodLeft {
    const cause = WHAT_SOMEBODY_DID_FOR_THEM[which] ?? 'sheltered';
    const owed = createFavor({
        holderId: other.id,
        subjectId: life.id,
        cause,
        severity: cause === 'saved_life' ? 'grave' : 'serious',
        onDay: day,
        description: cause === 'saved_life'
            ? `${other.name} got them out of something they would not have got out of.`
            : cause === 'sheltered'
                ? `${other.name} took them in when there was nowhere else.`
                : `${other.name} gave them what they needed and never asked after it.`,
        participants: [life.id, other.id]
    });
    state.obligations ??= [];
    state.obligations.push(owed);
    return { otherId: other.id, otherName: other.name, what: cause, owed };
}

/**
 * Whoever this life holds something with, dead or alive: the ties on their row
 * and the accounts they stand on either end of.
 *
 * The read the opening wants. It takes no view on who is dead - the caller has
 * the roster and the window - and it never ranks a stranger above somebody who
 * mattered, because a stranger is not in here at all.
 */
export function whoTheyHoldSomethingWith(
    state: WorldState,
    lifeId: string
): { otherId: string; weight: number }[] {
    const byOther = new Map<string, number>();
    const keep = (id: string, weight: number) => {
        const had = byOther.get(id) ?? 0;
        if (weight > had) byOther.set(id, weight);
    };
    const life = state.npcs.find(n => n.id === lifeId);
    for (const tie of life?.relationships ?? []) {
        if (tie.standing <= 0) continue;
        keep(tie.targetId, tie.standing);
    }
    // An account weighs what it was worth: a life saved outweighs a kindness,
    // and both outweigh somebody who merely stood nearby.
    for (const record of state.obligations ?? []) {
        if (record.status !== 'open') continue;
        const other = record.holderId === lifeId ? record.subjectId
            : record.subjectId === lifeId ? record.holderId : null;
        if (other === null) continue;
        keep(other, record.severity === 'grave' ? 0.9
            : record.severity === 'serious' ? 0.7 : 0.4);
    }
    return [...byOther].map(([otherId, weight]) => ({ otherId, weight }))
        .sort((a, b) => b.weight - a.weight || (a.otherId < b.otherId ? -1 : 1));
}
