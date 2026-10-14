/** A request for another person uses the same real favour and teaching activity. */
import { ledgerAbout, writeOneObligation } from '../storage/repos/obligation.repo.js';
import type { DatabaseHandle } from './encounters.js';
import { askSomebodyForHelp } from '../engine/world/somebody-calls-on-another-for-help.js';
import { routineOf, routineTime } from '../engine/world/npc-routines.js';
import { isTheWorldsToMove } from '../engine/world/npc-state.js';
import { guidanceMultiplier } from '../engine/cultivation/cultivation.js';
import { whatTheyCannotPutDown, standThemWhereTheStudentIs } from './a-teacher-giving-you-their-attention.js';
import { howCloseTheyStandToTheirWall } from '../engine/world/how-close-somebody-is-to-their-wall.js';
import { standInTheWorld } from './the-player-as-a-row-the-world-can-invite.js';
import { positionIn } from './standing.js';
import { DEFAULT_CULTIVATION_DAYS } from './verb-day-costs.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

export function requestGuidanceForAnother(game: GameService, run: Run, cultivator: Cultivator,
    teacherName: string, pupilName: string, requestedDays?: number): Execution {
    const no = (line: string) => refused('request.guidanceForAnother', 'request', factsForRefusal('No lesson began.', line, line));
    const world = game.atHand;
    const here = game.worldPlaceOf(cultivator);
    if (!world || !here) return no('There is nobody here to receive that request.');
    const present = new Set(game.present(cultivator).map(person => person.id));
    const scope = game.scopeFor(cultivator);
    const teacherParty = game.partyPutTo(cultivator, teacherName, scope);
    const pupilParty = game.partyPutTo(cultivator, pupilName, scope);
    const teacher = world.npcs.find(person => person.id === teacherParty?.id && person.status === 'alive');
    const pupil = world.npcs.find(person => person.id === pupilParty?.id && person.status === 'alive');
    if (!teacher || !present.has(teacher.id)) return no(`${teacherName || 'The teacher'} is not here to hear your request.`);
    if (!pupil || !present.has(pupil.id)) return no(`${pupilName || 'The pupil'} is not here to receive guidance.`);
    if (!isTheWorldsToMove(teacher) || !isTheWorldsToMove(pupil)) return no('A player decides whether to give or receive their own attention.');
    if (teacher.id === pupil.id || guidanceMultiplier(pupil.cultivation.realmOrdinal, teacher.cultivation.realmOrdinal, 1) <= 1)
        return no(`${teacher.name} has no cultivation guidance to give ${pupil.name} from their present standing.`);
    const days = requestedDays ?? DEFAULT_CULTIVATION_DAYS;
    if (!Number.isFinite(days) || days <= 0) return no('A lesson needs a positive span of days.');
    const day = routineTime(world);
    const active = { ...teacher, activity: routineOf(world, teacher).activity };
    if (whatTheyCannotPutDown(active, pupil.id, day)) return no(`${teacher.name} is occupied and cannot put that work down for the lesson.`);
    if (pupil.activity?.houseCareFactId) return no(`${pupil.name} is still resting under medical care.`);
    const place = world.locations.find(row => row.id === here)!;
    if (howCloseTheyStandToTheirWall(world, { ...teacher, locationId: here }, place.ambient, day).ready)
        return no(`${teacher.name} is at their own crossing and has no days to give to the lesson.`);
    const membership = positionIn(game.repos, cultivator.id);
    const actor = standInTheWorld(world, cultivator, { factionId: membership?.sectId ?? null,
        rankIndex: membership?.rankIndex ?? -1, contribution: membership?.contribution ?? 0 }, day);
    if (!actor) return no('This body cannot make that lower-world request.');
    const before = world.history.facts.length;
    const helper = askSomebodyForHelp(world, { askerId: cultivator.id, beneficiaryId: pupil.id, day,
        work: `guide cultivation for ${days} days`, player: { person: actor, placeId: here, present,
            ledger: [...new Map([...world.obligations, ...ledgerAbout(game.repos.db as unknown as DatabaseHandle, cultivator.id)]
                .map(word => [word.id, word])).values()],
            rememberFavour: word => { writeOneObligation(game.repos.db as unknown as DatabaseHandle,
                { ...word, incurredOnDay: run.elapsedDays, recordedOnDay: run.elapsedDays }); } },
        ability: person => person.id === teacher.id ? guidanceMultiplier(pupil.cultivation.realmOrdinal, teacher.cultivation.realmOrdinal, 1) : 0,
        perform: () => {
            const started = game.theyGiveTheirAttention(teacher.id, [pupil.id], days,
                `Guiding ${pupil.name}'s cultivation at ${cultivator.name}'s request.`, here);
            if (!started) return false;
            const at = world.npcs.findIndex(person => person.id === pupil.id);
            standThemWhereTheStudentIs(world, at, here);
            return true;
        } });
    game.theWorldMoved();
    const lines = helper ? [`${teacher.name} agreed to guide ${pupil.name}'s cultivation for ${days} days.`,
        `You owe ${teacher.name} a favour for the lesson.`] : world.history.facts.length > before
        ? [`${teacher.name} did not begin the requested lesson for ${pupil.name}.`]
        : ['No new request was put to anybody.'];
    return game.freeAction(run, 'request', factsForToolResult(helper ? 'Guidance agreed.' : 'Guidance not agreed.', lines));
}
