/**
 * A commission placed with a maker, made on the day it is due, and handed over.
 *
 * `commissioning-a-craft.ts` answers whether somebody will make you a thing and
 * what it comes to, and until this file that answer was the whole of it: they
 * said yes and nothing happened. Here a yes is PLACED:
 *
 *   paid          the stones named, up to what the work is worth to them, move
 *                 from the purse to the maker; what was not paid is a favour
 *                 owed, the ledger row the answer already built
 *   the stuff     the recipe comes off the bench then, out of whichever of the
 *                 two of them was holding it, because it is handed over with
 *                 the order
 *   their days    the maker's activity is `the_work_of_their_rank`, naming the
 *                 thing and whose it is, until the day `daysAtTheWork` gives.
 *                 That one row is what puts them in the room the thing is made
 *                 in, what the busy refusals read, and what the world's other
 *                 passes see as somebody making something
 *
 * AND ON THE DAY, `settleWhatWasPlacedWithAMaker` reads it back after every
 * turn. The work is rolled and minted through the same path a player's own bench
 * uses (`whether-the-work-holds.ts`), at the refining furnace the maker is
 * carrying. The thing goes into the player's hands if they are standing with the
 * maker, and is held for them otherwise, to be handed over when they are.
 *
 * A PAIR OF COMMUNICATION JADE IS TWO THINGS. It is made through the jade module's
 * own pair maker (`aPairOfCommunicationJade`): one half is the commissioner's, and
 * the twin is keyed to whoever they named for it - the maker, when they asked the
 * maker to keep it, somebody else by name, or the commissioner themselves where
 * they named nobody.
 *
 * INTERRUPTIONS ARE THE WORLD'S, AND ARE SAID. A maker who dies before the day
 * took the work with them. A maker whose activity was replaced before the day
 * set the work down: the materials are gone into it, and somebody who was paid
 * owes the thing.
 */

import { isAWorkedGrade } from '../data/cultivation/what-an-artifact-is-made-of.js';
import { forStream } from '../engine/cultivation/rng.js';
import {
    daysAtTheWork,
    howHeavyAnUnpaidCommissionIs,
    type WhatYouAskedThemToMake,
    type WhetherTheyWillMakeIt
} from '../engine/social-leverage/commissioning-a-craft.js';
import { mintAMadeThing, theOddsTheWorkHolds } from '../engine/social-leverage/whether-the-work-holds.js';
import { createObligation } from '../engine/social/grudges.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import { transferPossession } from '../engine/world/possessions.js';
import { theBestVesselToHand } from '../engine/world/the-vessel-somebody-works-at.js';
import { isMakingSomething } from '../engine/world/who-is-given-attention-this-year.js';
import { A_SLIP_CUT_TO_ORDER } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import { readJsonFlag, writeFlag, clearFlag } from '../server/consolidated/cultivation-support.js';
import type { Cultivator } from '../schema/cultivation.js';
import { writeOneObligation } from '../storage/repos/obligation.repo.js';
import { aPairOfCommunicationJade } from '../engine/world/a-pair-of-communication-jade.js';
import type { ObjectRecord } from '../engine/world/possessions.js';
import type { WorldState } from '../engine/world/world-state.js';
import { asksForAPairOfJade } from './what-somebody-was-asked-to-make.js';
import { takeWhatTheRecipeNames } from './taking-the-materials-off-the-bench.js';
import type { GameService } from './turn-engine.js';
import { whatThisPersonHasOnTheBench } from './what-is-on-the-bench.js';

/** The flag the placed commissions are kept under, one JSON list per player. */
export const FLAG_COMMISSIONS_PLACED = 'commissions_placed';

/** The thing id a commissioned piece of work names before the thing exists. */
export const A_COMMISSIONED_WORK = 'commission-work-';

/** One commission, from the player's side of it. */
export interface ACommissionPlaced {
    makerId: string;
    makerName: string;
    ask: WhatYouAskedThemToMake;
    placedOnDay: number;
    dueOnDay: number;
    /** The id the thing will carry, and the id on the maker's activity. */
    thingId: string;
    stonesPaid: number;
    /** True once made and held by the maker until the player is with them. */
    held: boolean;
    /** What the maker is holding for them, where it is more than the one thing. */
    heldIds?: string[];
    /**
     * For a pair of jade: who the twin is keyed to. Null is the commissioner, who
     * keeps both halves.
     */
    twin?: { id: string; name: string } | null;
}

/** The words that give the other half of a pair to somebody. */
const THE_OTHER_HALF_FOR = /\b(?:other half|twin|second half)\b[^.]*?\b(?:for|to)\s+(.+)$/i;
/** The words that ask the maker to keep the other half. */
const KEEP_THE_OTHER_HALF = /\bkeep\b[^.]*\b(?:other half|twin|second half|one)\b/i;

/**
 * Who the twin of a commissioned pair is keyed to, read off what the player said:
 * the maker where they were asked to keep it, a person the world holds where one
 * is named for it, and otherwise nobody else - the commissioner keeps both.
 */
export function whoTheTwinIsFor(
    said: string,
    maker: { id: string; name: string },
    world: Pick<WorldState, 'npcs'>
): { id: string; name: string } | null {
    if (KEEP_THE_OTHER_HALF.test(said)) return maker;
    const named = THE_OTHER_HALF_FOR.exec(said)?.[1]?.toLowerCase() ?? '';
    if (named.length === 0) return null;
    const person = world.npcs
        .filter(n => n.status === 'alive' && named.includes(n.name.toLowerCase()))
        .sort((a, b) => b.name.length - a.name.length || (a.id < b.id ? -1 : 1))[0];
    return person ? { id: person.id, name: person.name } : null;
}

export interface WhatHappenedToIt {
    lines: string[];
    structure: string[];
}

function theList(game: GameService, cultivatorId: string): ACommissionPlaced[] {
    return readJsonFlag<ACommissionPlaced[]>(game.db, cultivatorId, FLAG_COMMISSIONS_PLACED) ?? [];
}

function keepTheList(game: GameService, cultivatorId: string, list: readonly ACommissionPlaced[]): void {
    if (list.length === 0) clearFlag(game.db, cultivatorId, FLAG_COMMISSIONS_PLACED);
    else writeFlag(game.db, cultivatorId, FLAG_COMMISSIONS_PLACED, JSON.stringify(list));
}

/**
 * What this maker is already making, said as the refusal a busy hand gives, or
 * null where they are free to take the work.
 */
export function whatTheMakerIsAlreadyMaking(npc: Pick<NpcRecord, 'activity' | 'name'>, today: number): string | null {
    if (!isMakingSomething(npc.activity, today)) return null;
    const days = Math.max(1, (npc.activity!.untilDay ?? today) - today);
    return `${npc.name} is at work already: ${npc.activity!.note} It is done in ${days} `
        + `day${days === 1 ? '' : 's'}, and nothing else is taken on before then.`;
}

/**
 * Place an agreed commission: take the payment and the materials, and set the
 * maker to the work. Null where there is nothing to place - a ring, which nothing
 * folds to order, or a maker the world does not hold.
 */
export function placeTheCommission(input: {
    game: GameService;
    cultivator: Cultivator;
    makerId: string;
    ask: WhatYouAskedThemToMake;
    answer: WhetherTheyWillMakeIt;
    /** Stones the player named, already held to what they are carrying. */
    stonesOffered: number;
    /** What the player said, for who the twin of a pair of jade is for. */
    said?: string;
}): WhatHappenedToIt | null {
    const { game, cultivator, ask, answer } = input;
    const world = game.atHand;
    if (!answer.agreed || !answer.hands.theyCan || ask.aRing || !world) return null;
    const at = world.npcs.findIndex(row => row.id === input.makerId);
    if (at < 0) return null;
    const maker = world.npcs[at]!;
    const today = Math.floor(world.currentDay);
    const lines: string[] = [];
    const structure: string[] = [];

    // ── THE STUFF, FIRST, so a bench that cannot pay costs nobody anything ──
    if (!ask.slip && isAWorkedGrade(ask.grade)) {
        const bench = [
            ...whatThisPersonHasOnTheBench(game.db, world.objects, cultivator.id),
            ...whatThisPersonHasOnTheBench(game.db, world.objects, maker.id)
        ];
        const took = takeWhatTheRecipeNames({
            db: game.db, objects: world.objects, grade: ask.grade, bench, onDay: today,
            intoWhat: `the ${ask.named} ${maker.name} is making`
        });
        if (took === null) {
            return {
                lines: [`${maker.name} would make it, and the materials it takes are not all to hand, `
                    + 'so nothing was placed and nothing was paid.'],
                structure: [`placeTheCommission: the ${ask.grade} recipe could not be paid off the bench. Not placed.`]
            };
        }
        lines.push(...took.lines);
        structure.push(...took.structure);
    }

    // ── THE STONES, up to what the work is worth to this maker ───────────
    const worth = answer.whatAStoneIsWorthToThem > 0 ? answer.whatAStoneIsWorthToThem : 1;
    const wanted = answer.priceInStones === null ? 0 : Math.ceil(answer.priceInStones / worth);
    const paid = Math.max(0, Math.min(input.stonesOffered, wanted, cultivator.spiritStones));
    if (paid > 0) {
        game.repos.cultivators.update(cultivator.id, { spiritStones: cultivator.spiritStones - paid });
        world.npcs[at] = { ...maker, spiritStones: maker.spiritStones + paid };
        lines.push(`${paid} spirit stone${paid === 1 ? '' : 's'} went to ${maker.name} for it.`);
    }
    if (answer.owed !== null) {
        writeOneObligation(game.db as unknown as Parameters<typeof writeOneObligation>[0], createObligation(answer.owed));
        structure.push(`owed: ${answer.owed.severity} favour held by ${maker.id} over ${cultivator.id}.`);
    }

    // ── THEIR DAYS ───────────────────────────────────────────────────────
    const days = daysAtTheWork(ask.grade, maker.cultivation.realmOrdinal, { aSlip: Boolean(ask.slip) });
    const dueOnDay = today + days;
    const thingId = `${ask.slip ? A_SLIP_CUT_TO_ORDER : A_COMMISSIONED_WORK}${maker.id}-${cultivator.id}-${today}`;
    world.npcs[at] = {
        ...world.npcs[at]!,
        activity: {
            kind: 'the_work_of_their_rank',
            note: `Making ${ask.named} for ${cultivator.name}.`,
            withIds: [],
            sinceDay: today,
            untilDay: dueOnDay,
            thingId
        },
        updatedOnDay: today
    };
    game.theWorldMoved();

    keepTheList(game, cultivator.id, [...theList(game, cultivator.id), {
        makerId: maker.id,
        makerName: maker.name,
        ask,
        placedOnDay: today,
        dueOnDay,
        thingId,
        stonesPaid: paid,
        held: false,
        ...(asksForAPairOfJade(ask.named)
            ? { twin: whoTheTwinIsFor(input.said ?? ask.named, { id: maker.id, name: maker.name }, world) }
            : {})
    }]);
    lines.push(`${maker.name} has set to it. It is done on day ${dueOnDay}, ${days} day${days === 1 ? '' : 's'} from now.`);
    structure.push(
        `placeTheCommission: ${maker.id} at the_work_of_their_rank on ${thingId} from day ${today} to `
        + `${dueOnDay}; ${paid} stone(s) paid.`
    );
    return { lines, structure };
}

/**
 * Read back every commission this player has placed, against the world as it now
 * stands. Null where nothing changed.
 */
export function settleWhatWasPlacedWithAMaker(game: GameService, cultivator: Cultivator): WhatHappenedToIt | null {
    const world = game.atHand;
    if (!world || !cultivator.alive) return null;
    const placed = theList(game, cultivator.id);
    if (placed.length === 0) return null;

    const today = Math.floor(world.currentDay);
    const here = new Set(game.present(cultivator).map(row => row.id));
    const lines: string[] = [];
    const structure: string[] = [];
    const kept: ACommissionPlaced[] = [];

    for (const one of placed) {
        const at = world.npcs.findIndex(row => row.id === one.makerId);
        const maker = at < 0 ? null : world.npcs[at]!;

        // ── MADE, AND WAITING FOR THEM ───────────────────────────────────
        if (one.held) {
            const rows = (one.heldIds ?? [one.thingId]).map(id => world.objects.findIndex(o => o.id === id));
            if (rows.some(row => row < 0 || world.objects[row]!.possessorId !== one.makerId)) {
                lines.push(`${one.ask.named}, which ${one.makerName} made for you, is no longer in their hands.`);
                structure.push(`commission ${one.thingId}: held row gone from ${one.makerId}. Closed.`);
                continue;
            }
            if (!here.has(one.makerId)) { kept.push(one); continue; }
            for (const row of rows) {
                world.objects[row] = transferPossession(world.objects[row]!, {
                    onDay: today, toHolderId: cultivator.id, toHolderName: cultivator.name,
                    how: one.stonesPaid > 0 ? 'bought' : 'gifted', source: one.makerName,
                    note: `Made for them by ${one.makerName} and handed over.`
                });
            }
            game.theWorldMoved();
            lines.push(`${one.makerName} hands you ${one.ask.named}, made for you.`);
            structure.push(`commission ${one.thingId}: handed from ${one.makerId} to ${cultivator.id}.`);
            continue;
        }

        // ── THE MAKER IS GONE ────────────────────────────────────────────
        if (maker === null || maker.status !== 'alive') {
            lines.push(maker !== null && maker.diedOnDay !== null && maker.diedOnDay >= one.dueOnDay
                ? `${one.makerName} died on day ${maker.diedOnDay}, after ${one.ask.named} was due and before `
                  + 'it reached you, and nothing of it was handed over.'
                : `${one.makerName} died before ${one.ask.named} was done, and the work went with them.`);
            structure.push(`commission ${one.thingId}: maker ${one.makerId} not alive before day ${one.dueOnDay}. Closed.`);
            continue;
        }

        const doing = maker.activity;
        const stillOurs = doing !== null && doing.thingId === one.thingId;
        if (stillOurs && today < one.dueOnDay) { kept.push(one); continue; }
        // Something else took them up BEFORE the day: a row started earlier than
        // it, or nothing at all while the day is still ahead. Work begun on or
        // after the day came after the thing was done.
        const setDown = !stillOurs && (doing === null ? today < one.dueOnDay : doing.sinceDay < one.dueOnDay);
        if (setDown) {
            // ── SET DOWN BEFORE THE DAY ──────────────────────────────────
            lines.push(`${one.makerName} set down the work on ${one.ask.named} before it was done.`
                + (doing === null ? '' : ` Now: ${doing.note}`));
            if (one.stonesPaid > 0) {
                const owed = createObligation({
                    kind: 'favor',
                    holderId: cultivator.id,
                    subjectId: one.makerId,
                    cause: 'other',
                    severity: howHeavyAnUnpaidCommissionIs(one.ask.grade),
                    onDay: today,
                    description: `Took ${one.stonesPaid} spirit stones for ${one.ask.named} and did not make it.`,
                    tags: ['commission', 'undelivered', one.ask.grade]
                });
                writeOneObligation(game.db as unknown as Parameters<typeof writeOneObligation>[0], owed);
                lines.push(`They were paid ${one.stonesPaid} spirit stones for it, and owe you the thing.`);
            }
            structure.push(`commission ${one.thingId}: ${one.makerId} took up other work before day ${one.dueOnDay}. Closed.`);
            continue;
        }

        // ── THE DAY HAS COME ─────────────────────────────────────────────
        if (stillOurs) {
            world.npcs[at] = { ...maker, activity: null, updatedOnDay: today };
        }
        const ordinal = maker.cultivation.realmOrdinal;
        const vessel = one.ask.slip ? null : theBestVesselToHand(world.objects, maker.id, 'refining_furnace', ordinal);
        const odds = theOddsTheWorkHolds(one.ask, ordinal, vessel?.grade ?? null);
        const roll = forStream(world.seed, 'a-commission', maker.id, one.dueOnDay, one.thingId).next();
        const oddsSaid = `${(odds.chance * 100).toFixed(1)}%`
            + (vessel === null ? '' : ` at ${vessel.name}, ${vessel.grade} grade`);
        if (odds.rolled && !(roll < odds.chance)) {
            game.theWorldMoved();
            lines.push(`${one.makerName}'s work on ${one.ask.named} did not come off whole, and what went into it is slag.`);
            structure.push(`commission ${one.thingId}: rolled ${roll.toFixed(4)} against ${oddsSaid}. Failed.`);
            continue;
        }
        // ── A PAIR OF JADE IS TWO HALVES, made by the jade module's own maker ──
        if (asksForAPairOfJade(one.ask.named)) {
            const twin = one.twin ?? null;
            const pair = aPairOfCommunicationJade({
                maker: { id: maker.id, name: maker.name, ordinal },
                keeps: { id: cultivator.id, name: cultivator.name },
                gives: twin ?? { id: cultivator.id, name: cultivator.name },
                // Dated from when the work began, so the pair is dated the day it was due.
                onDay: one.placedOnDay,
                locationId: maker.locationId
            });
            const withMaker = !here.has(maker.id);
            const halves: ObjectRecord[] = pair.map(half => withMaker && half.possessorId === cultivator.id
                ? transferPossession(half, {
                    onDay: one.dueOnDay, toHolderId: maker.id, toHolderName: maker.name, how: 'crafted',
                    source: maker.name, note: `Held for ${cultivator.name} until they come for it.`
                })
                : half);
            world.objects.push(...halves);
            game.theWorldMoved();
            const heldIds = halves.filter(half => half.possessorId === maker.id && half.data.keyedTo === cultivator.id)
                .map(half => half.id);
            const twinSaid = twin === null
                ? 'both halves are yours'
                : twin.id === maker.id ? `${maker.name} keeps the other half` : `the other half is ${twin.name}'s`;
            if (heldIds.length === 0) {
                lines.push(`${one.makerName} has finished ${one.ask.named} and hands you your half; ${twinSaid}.`);
            } else {
                const where = world.locations.find(l => l.id === maker.locationId)?.name ?? 'where they are';
                lines.push(`${one.makerName} has finished ${one.ask.named}, and is holding what is yours at ${where}; ${twinSaid}.`);
                kept.push({ ...one, held: true, heldIds });
            }
            structure.push(`commission ${one.thingId}: rolled ${roll.toFixed(4)} against ${oddsSaid}. `
                + `Made as a pair: ${halves.map(h => `${h.id} keyed to ${h.data.keyedTo}, carried by ${h.possessorId}`).join('; ')}.`);
            continue;
        }
        const made = transferPossession(
            mintAMadeThing({
                id: one.thingId,
                ask: one.ask,
                maker: { id: maker.id, name: maker.name, ordinal },
                onDay: one.dueOnDay
            }),
            {
                onDay: one.dueOnDay, toHolderId: maker.id, toHolderName: maker.name, how: 'crafted',
                source: maker.name, note: `Made for ${cultivator.name}.`
            }
        );
        made.ownerId = cultivator.id;
        made.ownerName = cultivator.name;
        const handed = here.has(maker.id)
            ? transferPossession(made, {
                onDay: today, toHolderId: cultivator.id, toHolderName: cultivator.name,
                how: one.stonesPaid > 0 ? 'bought' : 'gifted', source: maker.name,
                note: `Made for them by ${maker.name} and handed over.`
            })
            : made;
        world.objects.push(handed);
        game.theWorldMoved();
        if (handed.possessorId === cultivator.id) {
            lines.push(`${one.makerName} has finished ${one.ask.named} and hands it to you.`);
        } else {
            const where = world.locations.find(l => l.id === maker.locationId)?.name ?? 'where they are';
            lines.push(`${one.makerName} has finished ${one.ask.named}, and is holding it for you at ${where}.`);
            kept.push({ ...one, held: true });
        }
        structure.push(`commission ${one.thingId}: rolled ${roll.toFixed(4)} against ${oddsSaid}. `
            + `Made, ${handed.possessorId === cultivator.id ? 'handed over' : `held by ${maker.id}`}.`);
    }

    const changed = lines.length > 0 || kept.length !== placed.length;
    if (!changed) return null;
    keepTheList(game, cultivator.id, kept);
    return { lines, structure };
}
