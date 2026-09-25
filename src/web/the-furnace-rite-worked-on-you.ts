/**
 * The furnace rite, worked on the player by somebody who beat them into
 * submission. The same core as `the-furnace-rite-once-somebody-has-yielded.ts`
 * with the roles the other way round: the NPC draws, the player is drawn off.
 *
 * Reached only from a fight the NPC opened wanting it (`StandingFight.cameAtYou`),
 * which the NPC wants when they hold an art that draws on another. Breaking off
 * before the end is the way out; a submission is what it is worked on.
 *
 * A death is not written here: it is handed back, and `concludeTheFight` marks
 * the player dead the way a fight's death gate would.
 */

import { getTechnique } from '../data/cultivation/index.js';
import { accrueProgress } from '../engine/cultivation/cultivation.js';
import { drawnOffMultiplierOf, physiqueOrNull } from '../engine/cultivation/physiques.js';
import { forStream } from '../engine/cultivation/rng.js';
import {
    FURNACE_MIN_AGE,
    oldEnoughForTheRite
} from '../engine/social-leverage/an-art-that-needs-two-people.js';
import { createObligation } from '../engine/social/grudges.js';
import {
    DAYS_A_CHILD_IS_CARRIED,
    aChildIsConceived
} from '../engine/world/a-child-an-act-conceived.js';
import { ageInYears } from '../engine/world/npc-state.js';
import { indexById } from '../engine/world/world-state.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { writeOneObligation } from '../storage/repos/obligation.repo.js';
import {
    theirHalfOfTheRite,
    whatThisFurnaceIsWorth,
    whyTheRiteWillNotOpen
} from './an-art-that-needs-both-of-them.js';
import { type DatabaseHandle, recordTheTieAnAttemptLeft } from './encounters.js';
import type { StandingFight } from './fight-answers.js';
import { useFurnaceTechnique } from './furnace-technique.js';
import { positionIn } from './standing.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

function say(execution: Execution, line: string): void {
    execution.facts.lines.push(line);
    execution.facts.required = [...(execution.facts.required ?? []), line];
    execution.facts.prose = [execution.facts.prose, line].join('\n');
}

/**
 * Whether this person would come for the rite: they hold the drawing half, the
 * art answers between the two of them, and both are of age. Null when not, with
 * the reason for the operator channel.
 */
export function wouldTheyWorkTheRiteOnYou(
    service: GameService,
    cultivator: Cultivator,
    theirId: string
): { art: string } | { not: string } {
    const npc = service.atHand?.npcs.find(row => row.id === theirId) ?? null;
    if (!npc) return { not: 'no world row, so no technique list to read' };
    const theirs = theirHalfOfTheRite(service.repos, npc.id, npc.cultivation.techniqueIds);
    if (theirs.takingArt === null) return { not: 'holds no art that draws on another' };
    const age = ageInYears(npc, Math.floor(service.atHand!.currentDay));
    if (!oldEnoughForTheRite(age)) return { not: `is ${age}, under ${FURNACE_MIN_AGE}` };
    if (!oldEnoughForTheRite(cultivator.age)) {
        return { not: `the player is ${Math.floor(cultivator.age)}, under ${FURNACE_MIN_AGE}` };
    }
    if (npc.identity.sex === cultivator.sex) return { not: 'the art does not answer between them' };
    return { art: theirs.takingArt };
}

/**
 * Work the rite on the player, who has just been beaten into submission, and
 * write what it did. Returns whether it killed them.
 */
export function theFurnaceRiteWorkedOnYou(
    service: GameService,
    run: Run,
    cultivator: Cultivator,
    held: StandingFight,
    execution: Execution
): { died: boolean } {
    const world = service.atHand;
    const at = world ? indexById(world.npcs, held.party.id) : -1;
    const npc = world && at >= 0 ? world.npcs[at]! : null;
    if (!world || !npc) return { died: false };

    // The gates again at the moment it happens: the fight may have run for turns.
    const would = wouldTheyWorkTheRiteOnYou(service, cultivator, npc.id);
    if ('not' in would) {
        execution.facts.structure.push(`furnace on the player: not worked, ${npc.name} ${would.not}.`);
        return { died: false };
    }
    const theirs = theirHalfOfTheRite(service.repos, npc.id, npc.cultivation.techniqueIds);
    const mine = theirHalfOfTheRite(service.repos, cultivator.id);
    const shut = whyTheRiteWillNotOpen(theirs, mine, cultivator.name, 'coerced');
    if (shut) {
        execution.facts.structure.push(`furnace on the player: ${shut.account}`);
        return { died: false };
    }

    const worldDay = Math.floor(world.currentDay);
    const runDay = Math.floor(run.elapsedDays);
    const room = service.present(cultivator)
        .filter(row => row.id !== npc.id && row.id !== cultivator.id);
    const position = positionIn(service.repos, cultivator.id);
    const myHouse = position ? service.repos.sects.getById(position.sectId) : null;

    const outcome = useFurnaceTechnique({
        world,
        actorId: npc.id,
        actorName: npc.name,
        actorSex: npc.identity.sex,
        subjects: [{
            personId: cultivator.id,
            name: cultivator.name,
            sex: cultivator.sex,
            conceptionSample: forStream(run.seed, 'furnace-conception', cultivator.id, runDay).next(),
            deathSample: forStream(run.seed, 'furnace-death', cultivator.id, runDay).next(),
            drawnOff: drawnOffMultiplierOf(physiqueOrNull(cultivator.physique))
                * whatThisFurnaceIsWorth(mine, 'coerced')
        }],
        onDay: worldDay,
        locationId: service.worldPlaceOf(cultivator),
        type: 'coerced',
        seenBy: room[0] ? { id: room[0].id, name: room[0].name } : null,
        subjectHouse: myHouse ? { alignment: myHouse.alignment, ranked: true } : null,
        watchedBy: room.map(row => row.id)
    });
    if (!outcome.happened) {
        execution.facts.structure.push(`furnace on the player: ${outcome.line}`);
        return { died: false };
    }
    service.theWorldMoved();
    const row = outcome.each[0]!;

    // THE PLAYER: the days given up, at their own rate, off what they hold. It
    // empties what is there and takes no rung.
    const fresh = service.repos.cultivators.getById(cultivator.id) ?? cultivator;
    const ambient = service.ambientFor(fresh, run);
    const worth = accrueProgress(fresh, row.daysGivenUp, { ambient }).newProgress
        - fresh.cultivationProgress;
    const left = Math.max(0, fresh.cultivationProgress - Math.max(0, worth));
    service.repos.cultivators.update(cultivator.id, { cultivationProgress: left });

    // THE ONE DRAWING: their progress is the days since `accumulatingSinceDay`,
    // so what they drew moves that day back.
    const since = npc.cultivation.accumulatingSinceDay || npc.cultivation.lastAdvancedOnDay;
    const movedTo = Math.round(since - outcome.daysStolen);
    world.npcs[at] = {
        ...npc,
        cultivation: { ...npc.cultivation, accumulatingSinceDay: movedTo },
        updatedOnDay: worldDay
    };

    // THE LEDGER: the player holds it, and their house where it takes it up.
    for (const grudge of outcome.grudges) {
        writeOneObligation(service.db as unknown as DatabaseHandle, createObligation({
            ...grudge,
            onDay: runDay
        }));
    }
    if (myHouse && outcome.factionVerdict?.houseIsAParty) {
        writeOneObligation(service.db as unknown as DatabaseHandle, createObligation({
            kind: 'grudge',
            holderId: myHouse.id,
            subjectId: npc.id,
            cause: 'violated',
            severity: 'unforgivable',
            onDay: runDay,
            description: `${outcome.line} ${cultivator.name} was ${myHouse.name}'s.`,
            participants: [npc.id, cultivator.id],
            tags: ['furnace', 'coerced', 'institutional']
        }));
    }
    if (!row.died) {
        recordTheTieAnAttemptLeft(service.repos, cultivator.id, npc.id, runDay, {
            theirs: { type: 'enemy', strength: 1, significance: 'defining', roles: ['made_a_furnace'] },
            yours: { type: 'enemy', strength: 1, significance: 'defining', roles: ['made_a_furnace'] },
            event: { onDay: runDay, kind: 'furnace', summary: outcome.line }
        });
    }

    // A conception goes to the world's demography, as it does the other way round.
    const handedOn = row.conceived && aChildIsConceived(world, {
        carrierId: cultivator.sex === 'female' ? cultivator.id : npc.id,
        otherParentId: cultivator.sex === 'female' ? npc.id : cultivator.id,
        dueOnDay: worldDay + DAYS_A_CHILD_IS_CARRIED
    });

    const art = getTechnique(would.art)?.name ?? 'an art that draws on another';
    say(
        execution,
        `${npc.name} works ${art} on you and draws off ${Math.round(outcome.daysStolen)} days `
        + 'of cultivation into their own.'
    );
    say(
        execution,
        row.died
            ? 'You do not survive it.'
            : left === 0
                ? 'You live. What you had built toward your next rung is gone.'
                : `You live, with ${Math.round(row.daysGivenUp)} days of your own cultivation gone.`
    );
    if (myHouse && outcome.factionVerdict?.houseIsAParty) {
        say(execution, `${myHouse.name} holds it against ${npc.name}. You are one of theirs.`);
    }

    execution.facts.structure.push(
        `furnace on the player: ${outcome.line} daysGivenUp=${row.daysGivenUp} at ${npc.id}'s rate; `
        + `player progress ${fresh.cultivationProgress.toFixed(1)} -> ${left.toFixed(1)}. `
        + `${npc.id} accumulatingSinceDay ${since} -> ${movedTo}. died=${row.died}, `
        + `conceived=${row.conceived}, handed to the demography pass=${handedOn === true}. `
        + `${outcome.grudges.length} grudge(s) held by the player.`
    );
    execution.calls.push({
        name: 'furnace.useFurnaceTechnique',
        action: 'attack',
        summary: `${outcome.line} Worked by ${npc.name} on the player.`,
        ok: true
    });
    return { died: row.died };
}
