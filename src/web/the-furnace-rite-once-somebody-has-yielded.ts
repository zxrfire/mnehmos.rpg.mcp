/**
 * The furnace rite, worked on somebody who has been beaten into submission.
 *
 * `coerce/furnace` used to resolve as an ordinary submission and print the word
 * "furnace" beside it; `useFurnaceTechnique` had no caller. This file is that
 * caller, in two halves:
 *
 *   before the fight   `whyTheFurnaceRiteIsRefused` - under age, or either half
 *                      of the rite missing. A refusal here costs no round.
 *   after they yield   `theFurnaceRiteOnSomebodyWhoYielded` - runs the edge and
 *                      writes what it returns: the player's progress, the
 *                      subject's clock, the grudges.
 *
 * A death is NOT written here. It is handed back, and `concludeTheFight` passes
 * the fight's result on as finished, so the killing goes through
 * `whatTheConfrontationDidToThem` like every other killing a fight commits.
 *
 * `conceived` stops at the world fact the edge writes. Nothing in
 * `engine/birth/` takes a conception from outside a birth draw, and making a
 * child here would be a second place children come from.
 */

import { getSect, getTechnique } from '../data/cultivation/index.js';
import { accrueProgress } from '../engine/cultivation/cultivation.js';
import { drawnOffMultiplierOf, physiqueOrNull } from '../engine/cultivation/physiques.js';
import { forStream } from '../engine/cultivation/rng.js';
import {
    FURNACE_MIN_AGE,
    oldEnoughForTheRite
} from '../engine/social-leverage/an-art-that-needs-two-people.js';
import { createObligation } from '../engine/social/grudges.js';
import { ageInYears } from '../engine/world/npc-state.js';
import { indexById } from '../engine/world/world-state.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { writeOneObligation } from '../storage/repos/obligation.repo.js';
import {
    type WhyNot,
    theirHalfOfTheRite,
    whatThisFurnaceIsWorth,
    whyTheRiteWillNotOpen
} from './an-art-that-needs-both-of-them.js';
import type { DatabaseHandle } from './encounters.js';
import type { StandingFight } from './fight-answers.js';
import { useFurnaceTechnique } from './furnace-technique.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/** The refusal for somebody under {@link FURNACE_MIN_AGE}. */
function underAge(name: string, age: number): WhyNot {
    return {
        headline: `${name} is not of age.`,
        said: `${name} is ${age}. The rite is not worked on anybody under ${FURNACE_MIN_AGE}. `
            + 'Nothing happens.',
        account: `coerce/furnace refused: subject age ${age} is under FURNACE_MIN_AGE `
            + `(${FURNACE_MIN_AGE}, the age the world pairs anybody off). No fight was opened.`
    };
}

/** The technique ids on a world row, for somebody with no `cultivators` row. */
function heldOnTheirWorldRow(service: GameService, personId: string): readonly string[] {
    return service.atHand?.npcs.find(npc => npc.id === personId)?.cultivation.techniqueIds ?? [];
}

/**
 * Why the rite cannot be attempted on this target, or null when it can.
 *
 * Age first: a child who also lacks the art is refused for being a child.
 */
export function whyTheFurnaceRiteIsRefused(
    service: GameService,
    cultivator: Cultivator,
    target: string | undefined
): WhyNot | null {
    const whoWith = service.somebodyAtHand(target ?? '', cultivator)
        ?? (target
            ? service.present(cultivator).find(row =>
                row.name.toLowerCase() === target.trim().toLowerCase())
            : undefined);

    if (whoWith && !oldEnoughForTheRite(whoWith.age)) {
        return underAge(whoWith.name, Math.floor(whoWith.age));
    }

    return whyTheRiteWillNotOpen(
        theirHalfOfTheRite(service.repos, cultivator.id),
        whoWith
            ? theirHalfOfTheRite(service.repos, whoWith.id, heldOnTheirWorldRow(service, whoWith.id))
            : { takingArt: null, spendingArt: null, stage: 0 },
        whoWith?.name ?? 'them'
    );
}

/** Say one line to the player and the narrator both. */
function say(execution: Execution, line: string): void {
    execution.facts.lines.push(line);
    execution.facts.prose = [execution.facts.prose, line].join('\n');
}

/**
 * Work the rite on somebody who has just yielded, and write what it did.
 *
 * Returns `died` so the caller can send the death down the fight's own
 * killing path. Everything else is written here.
 */
export function theFurnaceRiteOnSomebodyWhoYielded(
    service: GameService,
    run: Run,
    cultivator: Cultivator,
    held: StandingFight,
    execution: Execution
): { died: boolean } {
    const world = service.atHand;
    const at = world ? indexById(world.npcs, held.party.id) : -1;
    const npc = world && at >= 0 ? world.npcs[at]! : null;

    if (!world || !npc) {
        say(execution, `${held.party.name} is on their knees. The rite is not worked.`);
        execution.facts.structure.push(
            `coerce/furnace: ${held.party.id} has no world row, so there is no record to draw `
            + 'off or write to. Nothing moved.'
        );
        return { died: false };
    }

    const worldDay = Math.floor(world.currentDay);
    const runDay = Math.floor(run.elapsedDays);

    // The gates again, at the moment it happens. The fight may have run for
    // several turns since it opened.
    const age = ageInYears(npc, worldDay);
    if (!oldEnoughForTheRite(age)) {
        const why = underAge(npc.name, age);
        say(execution, why.said);
        execution.facts.structure.push(why.account);
        return { died: false };
    }
    const mine = theirHalfOfTheRite(service.repos, cultivator.id);
    const theirs = theirHalfOfTheRite(service.repos, npc.id, npc.cultivation.techniqueIds);
    const shut = whyTheRiteWillNotOpen(mine, theirs, npc.name);
    if (shut) {
        say(execution, shut.said);
        execution.facts.structure.push(shut.account);
        return { died: false };
    }

    // Everybody else standing here. Counted, not named: a face the player has
    // not been given a name for stays a face.
    const room = service.present(cultivator)
        .filter(row => row.id !== npc.id && row.id !== cultivator.id);
    const theirRow = service.present(cultivator).find(row => row.id === npc.id) ?? null;
    const house = npc.factionId ? getSect(npc.factionId) ?? null : null;

    const outcome = useFurnaceTechnique({
        world,
        actorId: cultivator.id,
        actorName: cultivator.name,
        actorSex: cultivator.sex,
        subjects: [{
            personId: npc.id,
            name: npc.name,
            sex: npc.identity.sex,
            // Separate named streams, so neither draw shifts anything else.
            conceptionSample: forStream(run.seed, 'furnace-conception', npc.id, runDay).next(),
            deathSample: forStream(run.seed, 'furnace-death', npc.id, runDay).next(),
            drawnOff: drawnOffMultiplierOf(physiqueOrNull(npc.identity.physique))
                * whatThisFurnaceIsWorth(theirs)
        }],
        onDay: worldDay,
        locationId: service.worldPlaceOf(cultivator),
        type: 'coerced',
        seenBy: room[0] ? { id: room[0].id, name: room[0].name } : null,
        subjectHouse: house
            ? { alignment: house.alignment, ranked: (theirRow?.sectRank ?? null) !== null }
            : null,
        watchedBy: room.map(row => row.id)
    });

    if (!outcome.happened) {
        say(execution, outcome.line);
        execution.facts.structure.push(`coerce/furnace: ${outcome.line}`);
        return { died: false };
    }
    service.theWorldMoved();

    const row = outcome.each[0]!;

    // ── THE PLAYER: DAYS AT THEIR OWN RATE ──────────────────────────────
    const fresh = service.repos.cultivators.getById(cultivator.id) ?? cultivator;
    const gained = accrueProgress(fresh, outcome.daysStolen, {
        ambient: service.ambientFor(fresh, run)
    });
    service.repos.cultivators.update(cultivator.id, { cultivationProgress: gained.newProgress });

    // ── THE SUBJECT: THE CLOCK THEIR PROGRESS IS READ OFF ───────────────
    //
    // An NPC's progress is the days since `accumulatingSinceDay`, so draining
    // it moves that day forward - the opposite of `creditWhatTheyLearned`.
    // Capped at today: the rite empties what is there and takes no rung.
    const since = npc.cultivation.accumulatingSinceDay || npc.cultivation.lastAdvancedOnDay;
    const movedTo = Math.min(worldDay, since + row.daysGivenUp);
    const drained = Math.max(0, movedTo - since);
    world.npcs[at] = {
        ...npc,
        cultivation: { ...npc.cultivation, accumulatingSinceDay: movedTo },
        updatedOnDay: worldDay
    };

    // ── THE LEDGER ───────────────────────────────────────────────────────
    //
    // On the run's clock, like every other account the fight writes. A house
    // that takes it up is put on the row, which is what `houseIsAParty` asks.
    for (const grudge of outcome.grudges) {
        writeOneObligation(service.db as unknown as DatabaseHandle, createObligation({
            ...grudge,
            onDay: runDay,
            participants: [
                ...(grudge.participants ?? []),
                ...(outcome.factionVerdict?.houseIsAParty && npc.factionId ? [npc.factionId] : [])
            ]
        }));
    }

    // ── WHAT THE PLAYER IS TOLD ─────────────────────────────────────────
    const art = getTechnique(mine.takingArt!)?.name ?? 'the rite';
    say(
        execution,
        `You work ${art} on ${npc.name} and draw off ${Math.round(outcome.daysStolen)} days of `
        + 'cultivation into your own.'
    );
    say(
        execution,
        row.died
            ? `${npc.name} does not survive it.`
            : `${npc.name} lives, with ${drained} days of their own progress gone.`
    );
    // The room, which is what the fight's own room line counts. The fact names
    // at most `BYSTANDERS_AT_MOST` of them, the bound every world fact has.
    // Named, not counted: a tally of the people standing around is not how
    // this genre says a crowd (`a-group-is-named-not-counted.ts`).
    const saw = room.map(person => person.name);
    say(
        execution,
        saw.length === 0 ? 'Nobody else saw it.'
            : saw.length === 1 ? `${saw[0]} saw it.`
            : saw.length === 2 ? `${saw[0]} and ${saw[1]} saw it.`
            : `${saw[0]}, ${saw[1]} and the others saw it.`
    );

    execution.facts.structure.push(
        `coerce/furnace: ${outcome.line} daysStolen=${outcome.daysStolen} at the player's rate `
        + `(progress ${fresh.cultivationProgress.toFixed(1)} -> ${gained.newProgress.toFixed(1)}). `
        + `${npc.id} accumulatingSinceDay ${since} -> ${movedTo} (${drained} of `
        + `${row.daysGivenUp} days there to take). died=${row.died}. `
        + `${outcome.grudges.length} unforgivable grudge(s) written.`,
        `coerce/furnace: ground holder would answer "${outcome.groundResponse}"; their house `
        + `"${outcome.factionVerdict?.response ?? 'none'}". Reported, not enacted here.`,
        `coerce/furnace: conceived=${row.conceived}. On the world fact only - nothing in `
        + 'engine/birth/ takes a conception from outside a birth draw, so no child is made.'
    );
    execution.calls.push({
        name: 'furnace.useFurnaceTechnique',
        action: 'coerce',
        summary: outcome.line,
        ok: true
    });

    return { died: row.died };
}
