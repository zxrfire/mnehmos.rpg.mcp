/**
 * What a confrontation does to somebody the world holds.
 *
 * ── THE HOLE THIS FILLS ──────────────────────────────────────────────────
 *
 * `combat_manage.resolve` writes its opponent's half of a fight only where that
 * opponent has a row in the `cultivators` table. Most of the people standing in
 * a square do not: they are `NpcRecord`s in world state, `game.ts` has no id the
 * tool could look up, and it therefore DESCRIBES them - a name and an ordinal.
 * Everything the resolver then decided about that person evaporated. A player
 * could beat somebody bloody, or set out to kill them and succeed, and the world
 * held no trace of it; the same person was standing there undamaged the next
 * turn, at full strength, with no account of it against anybody.
 *
 * ── WHY THE JOIN IS HERE AND NOT IN EITHER SIDE ──────────────────────────
 *
 * NOT IN `combat-manage.ts`. That file is a tool handler over the cultivation
 * database. It runs its persistence inside one synchronous sqlite transaction;
 * world state is an async-loaded append-log held per run, and there is no run
 * handle at all when the tool is driven straight off the MCP surface. Teaching
 * it to write to the world would mean either a second transaction boundary it
 * cannot honour or a world import in a file whose whole discipline is that it
 * owns one store.
 *
 * NOT IN `game.ts` INLINE. What a fight leaves on a person is world-layer logic
 * with world-layer precedent - `gatherings.ts` has been applying confrontation
 * results to `NpcRecord`s for as long as there have been gatherings - and it
 * wants tests that do not need a `GameService`, a narrator or a database.
 *
 * So: the resolver decides, this applies, and `game.ts` carries the answer from
 * one to the other. Nothing here re-decides anything. Every field it acts on was
 * already settled by `resolveConfrontation` and `survival.ts`.
 *
 * ── HIT POINTS ARE NOT WRITTEN, AND THAT IS NOT AN OMISSION ──────────────
 *
 * The record now carries a body - `NpcCultivation.hp`, against a pool derived
 * from `maxHpForOrdinal` rather than stored - and this file still does not touch
 * it. That is a decision rather than a leftover.
 *
 * What is on the row exists because a CROSSING costs the body and there was
 * nowhere for the toll to come out of, so it bound the player and nobody else.
 * A crossing is one event with a known price, charged once, and mended back over
 * a year. A fight is not: every bout at every gathering would deplete everybody
 * who fought, nothing but the mending rate would return it, and a world of
 * permanently half-spent people is a different setting from this one. That
 * change wants its own measurement and its own ruling; it is not something to
 * arrive at as a side effect of the toll having somewhere to land.
 *
 * What a fight leaves on a body that the world CAN hold is WOUNDS, and those are
 * rows the resolver already produced. So a bout somebody walked away from
 * unmarked leaves their body as it was - which is the honest reading, not a lost
 * write - and a bout that cost them something leaves the thing it cost them, on
 * the record, where the next fight reads it.
 *
 * ── WHAT IT WRITES ───────────────────────────────────────────────────────
 *
 *   THE BODY      `carryingWounds`, the world's one write path for injuries, so
 *                 the count cannot drift from the list. Permanent wounds also
 *                 get their day in the ledger, exactly as a gathering's do.
 *   THE ACCOUNT   a tie from them to whoever did it. This is the half that makes
 *                 the rest of the world reachable: grudges, feuds and a house's
 *                 answer for a member are all keyed on somebody who holds
 *                 something about somebody.
 *   THE DEATH     `markDead` and `settleNpcDeath`, the same pair every other
 *                 killing in this layer goes through, so heirs, inherited goals
 *                 and inherited accounts all happen for a player's killing the
 *                 way they happen for the world's own.
 *   THE FACT      one chronicle row for a death, and the wound ledger's own rows
 *                 for anything permanent. Nothing for an ordinary beating: a
 *                 ledger with every scuffle in it is the noise
 *                 `recording-the-day-a-wound-was-taken.ts` was written to keep
 *                 out.
 */

import type { Injury } from '../../schema/cultivation.js';
import type { ConfrontationOutcome } from '../cultivation/combat.js';
import { fillConsequences, makeFact, type HistoricalFact } from './history.js';
import { GRUDGE_STANDING } from './gatherings.js';
import {
    carryingWounds,
    isActing,
    markDead,
    upsertRelationship
} from './npc-state.js';
import type { InheritanceRelation, ObligationInput } from '../social/grudges.js';
import {
    theAccountsAFightOpens,
    whatFollowsFromTheBout,
    type BoutTerms
} from '../social-leverage/going-further-than-an-agreed-bout-allowed.js';
import { recordPermanentWounds } from './recording-the-day-a-wound-was-taken.js';
import { settleNpcDeath, type DeathHandoff } from './time.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { whoTheyLeave } from './who-is-left-when-somebody-dies.js';
import type { WorldState } from './world-state.js';

/**
 * The confrontation, as the resolver reported it, from the loser's side.
 *
 * Deliberately not the whole `ConfrontationResult`. This module is handed the
 * findings about ONE person and has no access to the fight - which is what stops
 * it forming a second opinion about who won.
 */
export interface WhatTheFightDecided {
    /** The world person who was fought. */
    npcId: string;
    /** Whoever fought them. A cultivator id; it need not be in `state.npcs`. */
    byId: string;
    byName: string;
    /** Absolute WORLD day. Not the run's elapsed days. */
    day: number;

    /** The rows `resolveConfrontation` put on them. Applied, never re-derived. */
    wounds: readonly Injury[];
    /** The resolver's own verdict. Read for what it says, never adjusted. */
    outcome: ConfrontationOutcome;
    /** Whether this person is the one the resolver named as having lost. */
    lost: boolean;
    /**
     * The resolver's `finished` flag.
     *
     * NOT a synonym for "reduced to nothing", and the distinction is the whole
     * of why this module can kill somebody without a second death gate.
     * `finishOutcome` reads the aggressor's GOAL: `subdue` ends at capture,
     * `humiliate` at humiliation, `drive_off` at withdrawal, and only `kill`
     * against a body the tradition says is enough returns `lethal`. So a bout
     * that empties somebody's bar without meaning to arrives here `finished:
     * false` and leaves them beaten, and a killing is a killing because the
     * killer went there. See the note at the death gate in `combat-manage.ts`,
     * which is the same ruling on the other side of the same boundary.
     */
    finished: boolean;
    /**
     * What the two of them had said it was, where anybody said anything.
     *
     * `open` unless told otherwise, and a WAR is `open` rather than a special
     * case: this file's own definition over in
     * `going-further-than-an-agreed-bout-allowed.ts` is that *open is the
     * absence of an arrangement, not a declaration of hostility*, and two
     * houses at war have promised each other nothing. Only a played bout the
     * parser read as arranged passes `agreed`.
     */
    terms?: BoutTerms;
    /**
     * How many people could see it, beyond the two of them.
     *
     * It does not decide whether the actor is named - being in a fight with
     * somebody does that. It prices what the actor's own house has to have a
     * position on.
     */
    witnesses?: number;
    /**
     * Who can put a name to it. Omit and everybody the account names can.
     *
     * The seam for AGENTS.md's *a fact reaches a person* ruling, carried
     * through to `theAccountsAFightOpens` and read there. See its own comment
     * for why it defaults open rather than shut.
     */
    knownTo?: readonly string[];
}

export interface WhatItDidToThem {
    /** False where the world does not hold this person, or no longer holds them acting. */
    wrote: boolean;
    /** Wound rows put on the record. */
    wounds: number;
    died: boolean;
    /** Heirs and inherited goals, where somebody died and had a line. */
    handoff: DeathHandoff | null;
    /** Chronicle rows written. Usually none. */
    facts: HistoricalFact[];
    /**
     * The accounts the fight opened, ready for the ledger. Never written here.
     *
     * ── WHY THEY ARE HANDED BACK RATHER THAN WRITTEN ─────────────────────
     *
     * There is no obligation ledger in `WorldState`. This layer hands social
     * rows to its caller exactly the way it already hands back estates and
     * heirs, and for the same reason: the ledger is a SQLite table and the
     * world tick has no handle on one.
     *
     * ── AND WHY THEY ARE DECIDED HERE ────────────────────────────────────
     *
     * Because both fights come through here. `war-melee.ts` writes its dead
     * through this function and so does the played killing, and until this
     * field existed only the played one left an account - a world could fight
     * for five hundred years and the ledger would not contain one of its dead.
     * The design owner's ruling on that was *this is bespoke; a war death is
     * still a grudge*, and the way to stop it being bespoke is for the rows to
     * come out of the one place both paths already meet.
     */
    opens: ObligationInput[];
    /**
     * Who the dead left, heirs and blood both. The ledger half of the played
     * path writes its own rows and has to write them about the same people.
     */
    theyLeft: readonly { id: string; relation: InheritanceRelation }[];
    /**
     * Engine truth, in the words the ledger uses. The caller decides whether a
     * narrator sees it; this decides only what is true.
     */
    lines: string[];
}

const NOTHING: WhatItDidToThem = {
    wrote: false, wounds: 0, died: false, handoff: null, facts: [], lines: [],
    opens: [], theyLeft: []
};

/**
 * How badly this went for them, in the one band that decides the account.
 *
 * `crippled` is the resolver's own word for a bout that took something
 * permanent, and a crippling wound row says the same thing from the other
 * direction - the outcome band and the wound band disagree often enough that
 * reading only one of them loses real maimings.
 */
function maimed(input: WhatTheFightDecided): boolean {
    return input.outcome === 'crippled'
        || input.wounds.some(w => w.severity === 'crippling');
}

/**
 * Apply one confrontation to one world person.
 *
 * Mutates `state` in place, as every write path in this layer does, and returns
 * what it did. Deliberately NOT idempotent: called twice for the same fight it
 * writes the wounds twice, because a wound row carries no identity the world
 * could deduplicate on. The caller calls it once, on the far side of the
 * resolve, which is what `game.ts` does.
 */
export function whatTheConfrontationDidToThem(
    state: WorldState,
    input: WhatTheFightDecided
): WhatItDidToThem {
    const at = state.npcs.findIndex(n => n.id === input.npcId);
    if (at < 0) return NOTHING;
    // Somebody already dead, sealed or gone is not somebody a fight changes.
    // The resolver was handed a described body and had no way to know; the
    // world does, and its answer is the one that stands.
    if (!isActing(state.npcs[at].status)) return NOTHING;

    const day = input.day;
    const facts: HistoricalFact[] = [];
    const lines: string[] = [];

    // ── THE BODY ─────────────────────────────────────────────────────────
    if (input.wounds.length > 0) {
        state.npcs[at] = carryingWounds(state.npcs[at], input.wounds, day);
        facts.push(...recordPermanentWounds(state, state.npcs[at], input.wounds, day));
    }

    // ── THE ACCOUNT ──────────────────────────────────────────────────────
    //
    // Written BEFORE the death and onto the person who is about to die, which
    // is not an accident of ordering. `the-world-changing-on-its-own.ts` does
    // the same thing for the world's own killings and says why: the dead keep
    // their account open, because it is what the heir inherits. A tie written
    // after `markDead` would be a tie on a corpse and `settleNpcDeath` would
    // have already walked past it.
    //
    // Graded by what it came to. Losing a fight is not an enmity - a world in
    // which every exchange opens one is a world where the word stops meaning
    // anything - and being killed or maimed by somebody is.
    if (input.lost) {
        const grievous = input.finished || maimed(input);
        state.npcs[at] = upsertRelationship(state.npcs[at], grievous
            ? {
                targetId: input.byId,
                targetName: input.byName,
                kind: 'enemy',
                standing: input.finished ? -1 : GRUDGE_STANDING - 0.15,
                note: input.finished
                    ? `Killed them at ${state.npcs[at].locationId ?? 'somewhere'}.`
                    : `Went further than the fight called for. ${input.outcome}.`
            }
            : {
                targetId: input.byId,
                targetName: input.byName,
                kind: 'rival',
                standing: -0.15,
                note: 'Lost to them.'
            }, day);
    }

    // ── THE DEATH ────────────────────────────────────────────────────────
    //
    // No second gate. `finished` against the loser is the resolver's statement
    // that the finishing requirement was met by somebody who went there to meet
    // it, and asking a further question about the body is the drift the engine
    // exists to prevent. What the world adds is only that the answer lands on a
    // person the world holds, with the heirs and inherited business that follow
    // from one of its own dying.
    let handoff: DeathHandoff | null = null;
    let died = false;

    if (input.lost && input.finished) {
        const dying = state.npcs[at];
        state.npcs[at] = markDead(dying, day, `Killed by ${input.byName}.`);
        // Handed the record as it stood at death - with the account on it - so
        // the heir inherits the enmity along with everything else.
        handoff = settleNpcDeath(state, dying, day);
        died = true;

        facts.push(appendWorldFact(state, makeFact({
            day,
            kind: 'death',
            scale: 'personal',
            summary: `${input.byName} killed ${dying.name}, `
                + `${dying.cultivation.realmOrdinal} rungs up the ladder.`,
            actors: [
                { id: input.byId, name: input.byName, role: 'killer' },
                { id: dying.id, name: dying.name, role: 'victim' }
            ],
            locationId: dying.locationId,
            factionIds: dying.factionId ? [dying.factionId] : [],
            visibility: 'regional',
            magnitude: Math.min(1, 0.35 + dying.cultivation.realmOrdinal * 0.02),
            causeKnown: true,
            consequences: fillConsequences({
                immediate: 'One fewer, and somebody knows who did it.',
                losers: [{ id: dying.id, name: dying.name, role: 'victim' }],
                beneficiaries: [{ id: input.byId, name: input.byName, role: 'killer' }],
                relationshipChanges: handoff.primaryHeirId
                    ? [{
                        aId: handoff.primaryHeirId,
                        bId: input.byId,
                        change: 'an inherited account'
                    }]
                    : [],
                tenYearsLater: handoff.primaryHeirId
                    ? 'Somebody younger is still asking where they live.'
                    : 'Nobody was left to ask about it.'
            })
            // A killing is one event and never a recurrence: two of them are two
            // people, whatever the summaries have in common.
        }), { recur: false }));

        lines.push(`${dying.name} is dead, and the world has it written down.`);
        if (handoff.primaryHeirId) {
            lines.push(
                `They left somebody, and that somebody has inherited both what they were doing `
                + 'and who they held it against.'
            );
        }
    } else if (input.wounds.length > 0) {
        const them = state.npcs[at];
        const carried = them.cultivation.untreatedInjuries;
        lines.push(
            `${them.name} is carrying ${carried} untreated ${carried === 1 ? 'wound' : 'wounds'} `
            + 'now, and will still be carrying them the next time anybody meets them.'
        );
    }

    // ── AND WHAT ANYBODY IS NOW OWED ─────────────────────────────────────
    //
    // Decided by the module that owns the table and rendered by the module that
    // owns the rows. Nothing here prices anything: `whatFollowsFromTheBout`
    // reads what the resolver already said and returns a severity and a list of
    // parties, and `theAccountsAFightOpens` turns that into ledger rows.
    //
    // The victim's people come off the handoff, which was computed on the
    // record as it stood at death - the only moment the answer is right.
    // `principalCannotHoldIt` is implicit and is the bout module's rule: the
    // people are read only where the loser died, because the dead hold nothing
    // and somebody ruined and living already holds their own record.
    const theyLeft = handoff
        ? whoTheyLeave({
            dead: state.npcs[at],
            heirs: handoff.heirs,
            stillHere: id => state.npcs.some(n => n.id === id && n.status === 'alive')
        })
        : [];
    const opens = accountsFor(state, input, at, { died, theyLeft }, facts);

    return {
        wrote: true, wounds: input.wounds.length, died, handoff, facts, lines, opens, theyLeft
    };
}

/**
 * The rows a fight leaves, through the one decider both callers share.
 *
 * Split out only so the body above stays readable. Everything it reads is
 * already settled: who lost, whether they died, whose they were, and who they
 * left.
 */
function accountsFor(
    state: WorldState,
    input: WhatTheFightDecided,
    at: number,
    dead: { died: boolean; theyLeft: readonly { id: string; relation: InheritanceRelation }[] },
    facts: readonly HistoricalFact[]
): ObligationInput[] {
    if (!input.lost) return [];
    const them = state.npcs[at];
    const house = them.factionId
        ? state.factions.find(f => f.id === them.factionId) ?? null
        : null;

    const followed = whatFollowsFromTheBout({
        terms: input.terms ?? 'open',
        outcome: input.outcome,
        loserDied: dead.died,
        witnesses: input.witnesses ?? 0,
        theirHouse: house
            ? {
                alignment: house.alignment,
                // Somebody the house has anything invested in. A place on the
                // rank ladder is the world's own statement of that and the one
                // `whenItIsDoneToOneOfOurs` already asks for.
                ranked: them.factionRankIndex >= 0
            }
            : null,
        theirPeople: dead.theyLeft
    });

    return theAccountsAFightOpens({
        followed,
        parties: {
            actor: { id: input.byId, name: input.byName },
            loser: { id: them.id, name: them.name },
            houseId: house?.id ?? null,
            houseName: house?.name ?? null
        },
        onDay: input.day,
        // The death row where there is one, so a reader in forty years can walk
        // from the account to the event and back. A crippling writes no
        // chronicle row of its own and correctly carries none.
        triggeringEventId: facts.find(f => f.kind === 'death')?.id ?? null,
        ...(input.knownTo === undefined ? {} : { knownTo: input.knownTo })
    });
}
