/**
 * The furnace rite, worked on somebody who has been beaten into submission.
 *
 * `coerce/furnace` used to resolve as an ordinary submission and print the word
 * "furnace" beside it; `useFurnaceTechnique` had no caller. This file is that
 * caller, in two halves:
 *
 *   before the fight   `whyTheFurnaceRiteIsRefused` - either of them under age,
 *                      or the player holding no art that draws. A refusal
 *                      here costs no round. The subject's own half is not
 *                      asked: the rite is forced, and forcing it opens it.
 *   after they yield   `theFurnaceRiteOnSomebodyWhoYielded` - runs the edge and
 *                      writes what it returns: the player's progress, the
 *                      subject's clock, the grudges, and a conception.
 *   after the fight    `theyAnswerForTheRite` - the subject, their house and
 *                      whoever holds the ground, written where the engine
 *                      already reads a claim.
 *
 * A death is NOT written here. It is handed back, and `concludeTheFight` passes
 * the fight's result on as finished, so the killing goes through
 * `whatTheConfrontationDidToThem` like every other killing a fight commits.
 *
 * A conception is not made into a child here either: it is handed to
 * `aChildIsConceived`, and the world's demography delivers the child.
 */

import { getSect, getTechnique } from '../data/cultivation/index.js';
import { accrueProgress } from '../engine/cultivation/cultivation.js';
import { drawnOffMultiplierOf, physiqueOrNull } from '../engine/cultivation/physiques.js';
import { forStream } from '../engine/cultivation/rng.js';
import {
    FURNACE_MIN_AGE,
    oldEnoughForTheRite
} from '../engine/social-leverage/an-art-that-needs-two-people.js';
import {
    type IfCaught,
    ifCaughtAtSomethingTheHousePunishes,
    whatYourOwnHouseOpensAboutYou
} from '../engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import {
    type HouseVerdict,
    severityWithHouse
} from '../engine/social-leverage/what-a-house-will-do-about-it.js';
import {
    type ObligationInput,
    type Severity,
    createObligation
} from '../engine/social/grudges.js';
import {
    DAYS_A_CHILD_IS_CARRIED,
    aChildIsConceived
} from '../engine/world/a-child-an-act-conceived.js';
import { ageInYears, upsertRelationship } from '../engine/world/npc-state.js';
import { indexById } from '../engine/world/world-state.js';
import type { Cultivator, Run, SectAlignment } from '../schema/cultivation.js';
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
import { positionIn } from './standing.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/** The refusal for a subject under {@link FURNACE_MIN_AGE}. */
function underAge(name: string, age: number): WhyNot {
    return {
        headline: `${name} is not of age.`,
        said: `${name} is ${age}. The rite is not worked on anybody under ${FURNACE_MIN_AGE}. `
            + 'Nothing happens.',
        account: `coerce/furnace refused: subject age ${age} is under FURNACE_MIN_AGE `
            + `(${FURNACE_MIN_AGE}, the age the world pairs anybody off). No fight was opened.`
    };
}

/**
 * The same refusal for the one working it. The owner: *"both ought to be age
 * gated"* - one bound, read off the same constant, for both halves.
 */
function tooYoungToWorkIt(age: number): WhyNot {
    return {
        headline: 'You are not of age.',
        said: `You are ${age}. The rite is not worked by anybody under ${FURNACE_MIN_AGE}. `
            + 'Nothing happens.',
        account: `coerce/furnace refused: player age ${age} is under FURNACE_MIN_AGE `
            + `(${FURNACE_MIN_AGE}). No fight was opened.`
    };
}

/** The technique ids on a world row, for somebody with no `cultivators` row. */
function heldOnTheirWorldRow(service: GameService, personId: string): readonly string[] {
    return service.atHand?.npcs.find(npc => npc.id === personId)?.cultivation.techniqueIds ?? [];
}

/**
 * Why the rite cannot be attempted on this target, or null when it can.
 *
 * Age first, the player's and then the subject's: a child who also lacks the
 * art is refused for being a child. The subject's own half is not asked - the
 * rite is forced, and forcing it opens that half (`whyTheRiteWillNotOpen`).
 */
export function whyTheFurnaceRiteIsRefused(
    service: GameService,
    cultivator: Cultivator,
    target: string | undefined
): WhyNot | null {
    if (!oldEnoughForTheRite(cultivator.age)) return tooYoungToWorkIt(Math.floor(cultivator.age));

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
        whoWith?.name ?? 'them',
        'coerced'
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
 * killing path, and `answering` for `theyAnswerForTheRite` once the fight's own
 * aftermath is written. Everything else is written here.
 */
export function theFurnaceRiteOnSomebodyWhoYielded(
    service: GameService,
    run: Run,
    cultivator: Cultivator,
    held: StandingFight,
    execution: Execution
): { died: boolean; answering: WhoAnswersForTheRite | null } {
    const nothing = { died: false, answering: null };
    const world = service.atHand;
    const at = world ? indexById(world.npcs, held.party.id) : -1;
    const npc = world && at >= 0 ? world.npcs[at]! : null;

    if (!world || !npc) {
        say(execution, `${held.party.name} is on their knees. The rite is not worked.`);
        execution.facts.structure.push(
            `coerce/furnace: ${held.party.id} has no world row, so there is no record to draw `
            + 'off or write to. Nothing moved.'
        );
        return nothing;
    }

    const worldDay = Math.floor(world.currentDay);
    const runDay = Math.floor(run.elapsedDays);

    // The gates again, at the moment it happens. The fight may have run for
    // several turns since it opened.
    const age = ageInYears(npc, worldDay);
    const tooYoung = !oldEnoughForTheRite(cultivator.age)
        ? tooYoungToWorkIt(Math.floor(cultivator.age))
        : !oldEnoughForTheRite(age) ? underAge(npc.name, age) : null;
    if (tooYoung) {
        say(execution, tooYoung.said);
        execution.facts.structure.push(tooYoung.account);
        return nothing;
    }
    const mine = theirHalfOfTheRite(service.repos, cultivator.id);
    const theirs = theirHalfOfTheRite(service.repos, npc.id, npc.cultivation.techniqueIds);
    const shut = whyTheRiteWillNotOpen(mine, theirs, npc.name, 'coerced');
    if (shut) {
        say(execution, shut.said);
        execution.facts.structure.push(shut.account);
        return nothing;
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
                * whatThisFurnaceIsWorth(theirs, 'coerced')
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
        return nothing;
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

    // ── A CONCEPTION IS HANDED TO THE WORLD, NOT MADE INTO A CHILD HERE ──
    //
    // The one who carries it is whichever of the two is female; the art only
    // answers between a man and a woman. The world's demography delivers the
    // child: see `a-child-an-act-conceived.ts`. Nothing is said to the player -
    // a conception is not a thing anybody can see on the day.
    const dueOnDay = worldDay + DAYS_A_CHILD_IS_CARRIED;
    const handedOn = row.conceived && aChildIsConceived(world, {
        carrierId: cultivator.sex === 'female' ? cultivator.id : npc.id,
        otherParentId: cultivator.sex === 'female' ? npc.id : cultivator.id,
        dueOnDay
    });

    execution.facts.structure.push(
        `coerce/furnace: ${outcome.line} daysStolen=${outcome.daysStolen} at the player's rate `
        + `(progress ${fresh.cultivationProgress.toFixed(1)} -> ${gained.newProgress.toFixed(1)}). `
        + `${npc.id} accumulatingSinceDay ${since} -> ${movedTo} (${drained} of `
        + `${row.daysGivenUp} days there to take). died=${row.died}. `
        + `${outcome.grudges.length} unforgivable grudge(s) written.`,
        `coerce/furnace: conceived=${row.conceived}.`
        + (row.conceived
            ? handedOn
                ? ` Due on world day ${dueOnDay}; the demography pass delivers it.`
                : ' Neither parent has a world row, so nothing carries it.'
            : '')
    );
    execution.calls.push({
        name: 'furnace.useFurnaceTechnique',
        action: 'coerce',
        summary: outcome.line,
        ok: true
    });

    return {
        died: row.died,
        answering: {
            subject: { id: npc.id, name: npc.name },
            died: row.died,
            severity: outcome.grudges[0]?.severity ?? 'unforgivable',
            description: outcome.grudges[0]?.description ?? outcome.line,
            runDay,
            worldDay,
            house: npc.factionId && house
                ? { id: npc.factionId, name: house.name, alignment: house.alignment }
                : null,
            verdict: outcome.factionVerdict,
            ground: outcome.groundHolder,
            groundResponse: outcome.groundResponse,
            seenBy: room[0] ? { id: room[0].id, name: room[0].name } : null
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHO HAS A CLAIM ON IT
// ─────────────────────────────────────────────────────────────────────────

/** What the rite leaves for the people with a claim on it. */
export interface WhoAnswersForTheRite {
    subject: { id: string; name: string };
    died: boolean;
    severity: Severity;
    description: string;
    runDay: number;
    worldDay: number;
    /** The subject's own house, where they have one. */
    house: { id: string; name: string; alignment: SectAlignment | null } | null;
    verdict: HouseVerdict | null;
    /** Whoever holds the ground it was done on. */
    ground: { id: string; name: string; alignment: SectAlignment | null } | null;
    groundResponse: IfCaught;
    seenBy: { id: string; name: string } | null;
}

/**
 * The people with a claim on the rite, acting through what the engine already
 * does with a claim. Nothing here decides an answer: `whenItIsDoneToOneOfOurs`
 * and `ifCaughtAtSomethingTheHousePunishes` decided them in
 * `furnace-technique.ts`, and this writes them where the engine reads them.
 *
 *   THE SUBJECT      an `enemy` tie on their world row, the tie a fight writes
 *                    for somebody maimed. Only if they lived: a killing writes
 *                    its own, through the killing path.
 *   THEIR HOUSE      where the verdict makes the house a party, the account the
 *                    house holds for one of its own (`whatADeedLeaves`' house
 *                    row). If the player is on that same roll, it is the row a
 *                    house opens about its own member instead, which the room
 *                    and the fetch (`a-room-hands-one-down-to-you.ts`,
 *                    `a-house-does-not-wait-for-you-to-spend-a-day.ts`) carry
 *                    out.
 *   THE GROUND       where somebody saw it on held ground, the holder's account,
 *                    carrying what the holder does (`house_does:`). The player's
 *                    own house's ground goes to the room the same way.
 *
 * One account per house: a house that is both the subject's and the ground's
 * holds one row, not two.
 *
 * Called by `concludeTheFight` AFTER `afterAFight`, because that pass writes the
 * loser's tie for a submission ("Lost to them.") and a tie is one row per heat:
 * written before it, this one would be overwritten.
 */
export function theyAnswerForTheRite(
    service: GameService,
    cultivator: Cultivator,
    answering: WhoAnswersForTheRite,
    execution: Execution
): void {
    const { subject, house, verdict, ground, seenBy, runDay } = answering;
    const own = positionIn(service.repos, cultivator.id)?.sectId ?? null;
    const held = new Set<string>();
    const accounts: string[] = [];

    const write = (record: ObligationInput): void => {
        const row = createObligation(record);
        writeOneObligation(service.db as unknown as DatabaseHandle, row);
        held.add(record.holderId);
        accounts.push(`${row.id} held by ${record.holderId} (${record.severity})`);
    };

    // ── THE SUBJECT ─────────────────────────────────────────────────────
    const world = service.atHand;
    const at = world ? indexById(world.npcs, subject.id) : -1;
    if (world && at >= 0 && !answering.died) {
        world.npcs[at] = upsertRelationship(world.npcs[at]!, {
            targetId: cultivator.id,
            targetName: cultivator.name,
            kind: 'enemy',
            standing: -1,
            note: 'Made them a cultivation furnace by force.'
        }, answering.worldDay);
        service.theWorldMoved();
    }

    // ── THEIR HOUSE ─────────────────────────────────────────────────────
    if (house && verdict?.houseIsAParty) {
        const severity = severityWithHouse(answering.severity, verdict.severityFloor);
        const record = house.id === own
            ? whatYourOwnHouseOpensAboutYou({
                houseId: house.id,
                memberId: cultivator.id,
                cause: 'violated',
                severity,
                onDay: runDay,
                description: `${answering.description} ${subject.name} is on its roll.`,
                doing: ifCaughtAtSomethingTheHousePunishes({
                    theirsToPunish: true,
                    alignment: house.alignment
                }),
                knownTo: [subject.id]
            })
            : {
                kind: 'grudge' as const,
                holderId: house.id,
                subjectId: cultivator.id,
                cause: 'violated' as const,
                severity,
                onDay: runDay,
                description: `${answering.description} ${subject.name} was ${house.name}'s.`,
                participants: [cultivator.id, subject.id],
                tags: ['furnace', 'coerced', 'institutional']
            };
        if (record) {
            write(record);
            say(execution, `${house.name} holds it against you. ${subject.name} is one of theirs.`);
        }
    }

    // ── THE GROUND ──────────────────────────────────────────────────────
    if (ground && answering.groundResponse !== 'nothing' && !held.has(ground.id)) {
        const record = ground.id === own
            ? whatYourOwnHouseOpensAboutYou({
                houseId: ground.id,
                memberId: cultivator.id,
                cause: 'violated',
                severity: answering.severity,
                onDay: runDay,
                description: `${answering.description} It was done on the house's ground.`,
                doing: answering.groundResponse,
                ...(seenBy ? { knownTo: [seenBy.id] } : {})
            })
            : {
                kind: 'grudge' as const,
                holderId: ground.id,
                subjectId: cultivator.id,
                cause: 'violated' as const,
                severity: answering.severity,
                onDay: runDay,
                description: `${answering.description} It was done on ground ${ground.name} holds.`,
                participants: [cultivator.id, subject.id, ...(seenBy ? [seenBy.id] : [])],
                tags: ['furnace', 'coerced', `house_does:${answering.groundResponse}`]
            };
        if (record) {
            write(record);
            say(
                execution,
                `${ground.name} holds this ground`
                + (seenBy ? `, ${seenBy.name} saw it,` : '')
                + ` and ${ground.name} holds it against you.`
            );
        }
    }

    execution.facts.structure.push(
        `coerce/furnace: ${subject.id} ${answering.died ? 'died; the killing path wrote their tie' : 'holds an enemy tie at -1'}. `
        + `Their house: "${verdict?.response ?? 'none'}". Ground holder: `
        + `"${answering.groundResponse}"${ground ? ` (${ground.id})` : ''}. `
        + (accounts.length === 0
            ? 'No house account opened.'
            : `Accounts opened: ${accounts.join('; ')}.`)
        + (own !== null && held.has(own)
            ? ` ${own} is the player's own house, so its room and its fetch carry it out.`
            : '')
    );
}
