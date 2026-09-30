/**
 * Taking the bones off a body: `gather`'s harvest of the dead rather than of the
 * ground.
 *
 * Owner ruling 2026-09-25: demonic cultivators craft from human bones. Nothing
 * here decides what a body yields or who minds - `bones-off-a-body.ts` does - and
 * this file finds the body, spends the time, and writes what came of it:
 *
 *   the body        a dead person whose row lies here, bones not yet taken
 *   the time        `shortSkip`'s one day, bent over it
 *   the bone        into the pouch, and a row saying whose body it came off
 *   who saw it      everybody standing here, or where it was done out of sight,
 *                   the ones `aWitnessSeesThrough`
 *   who holds it    `whoHoldsItAgainstYou`, onto the ledger as `harvested`
 */

import {
    aBodyLiesHere,
    objectForBones,
    theBoneThisBodyYields,
    theBonesAreGone,
    theBonesAreStillThere,
    theyDiedInTheirTribulation,
    whoHoldsItAgainstYou,
    whoSawIt,
    type AWitness
} from '../engine/world/bones-off-a-body.js';
import { rankName } from '../engine/cultivation/realms.js';
import { createGrudge, SEVERITY_IN_WORDS } from '../engine/social/grudges.js';
import { AGAINST_THEIR_OWN } from '../engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import { makeFact } from '../engine/world/history.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import { howAGradeIsStored } from '../engine/world/possessions.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import { addToPouch } from '../server/consolidated/cultivation-support.js';
import { writeOneObligation } from '../storage/repos/obligation.repo.js';
import type { DatabaseHandle } from './encounters.js';
import { factsForRefusal, factsForToolResult, placeName } from './facts.js';
import { thePlayerIsSureItIsThem } from './the-narrator-plays-the-world.js';
import { refused } from './tool-result-prose.js';
import { GATHERING_FOCUS } from './turn-constants.js';
import type { GameService } from './turn-engine.js';
import type { Execution, ToolCallRecord } from './turn-wire-shapes.js';
import { whatYouAreNotShowing } from './what-you-are-not-showing.js';

/** The body the words point at: one named, else the most recent to fall. */
function theBodyMeant(bodies: readonly NpcRecord[], said: string): NpcRecord | null {
    const words = said.toLowerCase();
    const named = bodies.find(npc => words.includes(npc.name.toLowerCase()));
    if (named) return named;
    return [...bodies].sort((a, b) => (b.diedOnDay ?? 0) - (a.diedOnDay ?? 0))[0] ?? null;
}

export async function takingTheBones(
    service: GameService,
    run: Run,
    cultivator: Cultivator,
    ambient: AmbientQi,
    said: string,
    rawInput: string
): Promise<Execution> {
    service.atHand = service.atHand ?? await service.loadWorld();
    const here = service.worldPlaceOf(cultivator);
    const bodies = (service.atHand?.npcs ?? []).filter(npc => aBodyLiesHere(npc, here));
    const body = theBodyMeant(bodies, said);
    const awareness = service.knowledge.awareness(cultivator.id);
    const whoTheyWere = (name: string): string =>
        thePlayerIsSureItIsThem(name, awareness) ? name : 'the dead';

    if (!body) {
        return refused('engine.aBodyLiesHere', 'gather', factsForRefusal(
            'No body lies here.',
            'Bones come off somebody who died, where they fell, and nobody has died here.',
            `take bones: no physically_dead world row at ${here ?? 'no world place'}. Nothing spent.`
        ));
    }
    if (!theBonesAreStillThere(body)) {
        return refused('engine.theBonesAreStillThere', 'gather', factsForRefusal(
            `The bones of ${whoTheyWere(body.name)} are already gone.`,
            'They were taken before. There is nothing more on this body to take.',
            `take bones: ${body.id} already carries its bones-taken mark. Nothing spent.`
        ));
    }

    // WHO IS STANDING HERE WHEN IT STARTS, before the day moves anybody.
    const housesBefore = new Map((service.atHand?.factions ?? []).map(house => [house.id, house]));
    const present: AWitness[] = service.present(cultivator).map(row => ({
        id: row.id,
        ordinal: row.realmOrdinal,
        houseId: row.sectId,
        alignment: row.sectId ? housesBefore.get(row.sectId)?.alignment ?? null : null
    }));

    const spent = await service.shortSkip(run, cultivator, ambient, GATHERING_FOCUS, 'Taking the bones');
    const after = service.repos.cultivators.getById(cultivator.id) ?? cultivator;
    service.atHand = service.atHand ?? await service.loadWorld();
    const world = service.atHand;
    const at = world ? world.npcs.findIndex(npc => npc.id === body.id) : -1;
    const still = world && at >= 0 ? world.npcs[at]! : null;
    if (!after.alive || !world || !still || !theBonesAreStillThere(still)) {
        const facts = factsForToolResult('The bones are not taken.', [...spent.facts.lines]);
        facts.structure.push(`take bones: ${body.id} not reached after the day; nothing written.`);
        return { facts, events: spent.events, timeSkip: spent.timeSkip, breakthrough: null, outcome: 'executed', calls: spent.calls };
    }

    // ── THE BONE ─────────────────────────────────────────────────────────
    const worldDay = Math.floor(world.currentDay);
    const runDay = Math.floor(service.repos.runs.getById(run.id)?.elapsedDays ?? run.elapsedDays);
    const bone = theBoneThisBodyYields(still, theyDiedInTheirTribulation(world, still));
    const dead = { id: still.id, name: still.name, ordinal: still.cultivation.realmOrdinal };
    world.npcs[at] = theBonesAreGone(still, worldDay);
    addToPouch(service.db, after.id, bone.id, 'herb', 1);
    const tracked = howAGradeIsStored(bone.grade) === 'tracked';
    // A ROW AT EVERY GRADE, beside the pouch stack a counter quotes: remains
    // are somebody's, so the row says whose body they came off
    // (`data.deadId`), which a counted stack cannot.
    const record = objectForBones({
        id: `obj-${bone.id}-${still.id}`,
        bone,
        dead,
        takerId: after.id,
        takerName: after.name,
        place: placeName(after),
        onDay: worldDay
    });
    world.objects.push(record);
    service.theWorldMoved();
    const calls: ToolCallRecord[] = [...spent.calls, {
        name: 'storage.addToPouch',
        action: 'gather',
        summary: `${bone.id} x1 (${bone.grade}, ${bone.value} stones) off ${still.id} at ordinal ${dead.ordinal} to ${after.id}.`,
        ok: true
    }, {
        name: 'world.transferPossession',
        action: 'gather',
        summary: `${record.id} (${bone.name}, ${bone.grade}, ${record.significance}) minted off ${still.id} to ${after.id} as looted.`,
        ok: true
    }];

    const lines = [
        ...spent.facts.lines,
        `You take the bones of ${whoTheyWere(still.name)}, who stood at ${rankName(dead.ordinal)}: `
        + `${bone.name}, ${bone.grade} grade, about ${bone.value} stones.`,
        'It is on the record: whose body it came off, and where.'
    ];

    // ── WHO SAW IT, AND WHO HOLDS IT ─────────────────────────────────────
    const houses = new Map(world.factions.map(house => [house.id, house]));
    const outOfSight = whatYouAreNotShowing(rawInput) !== null;
    const saw = whoSawIt(after.realmOrdinal, present, outOfSight);
    const holding = whoHoldsItAgainstYou({ saw, theDeadsHouseId: still.factionId });
    const yourHouse = service.repos.sects.getMembership(after.id)?.sectId ?? null;

    const fact = holding.length === 0 ? null : appendWorldFact(world, makeFact({
        day: worldDay,
        kind: 'grudge_opened',
        locationId: here,
        summary: `${after.name} took the bones of ${still.name}.`,
        witnessIds: [after.id, ...saw.map(one => one.id)],
        actors: [
            { id: after.id, name: after.name, role: 'actor' },
            { id: still.id, name: still.name, role: 'subject' }
        ],
        factionIds: holding.map(row => row.houseId),
        data: { bones: bone.id }
    }));
    for (const row of holding) {
        writeOneObligation(service.db as unknown as DatabaseHandle, createGrudge({
            holderId: row.houseId,
            subjectId: after.id,
            cause: 'harvested',
            severity: row.severity,
            onDay: runDay,
            triggeringEventId: fact?.id ?? null,
            description: `${after.name} took the bones of ${still.name} on day ${runDay}.`,
            terms: null,
            dueOnDay: null,
            participants: [row.houseId],
            tags: ['bones', still.id, ...(row.houseId === yourHouse ? [AGAINST_THEIR_OWN] : [])]
        }));
        calls.push({
            name: 'social.createGrudge',
            action: 'gather',
            summary: `${row.houseId} holds a ${row.severity} harvested grudge about ${after.id} (${row.because}).`,
            ok: true
        });
    }

    lines.push(saw.length === 0
        ? 'Nobody saw it.'
        : `${saw.length === 1 ? 'One person' : `${saw.length} people`} standing here saw it.`);
    for (const row of holding) {
        const house = houses.get(row.houseId);
        const known = house !== undefined && service.knowledge.isAwareOf(after.id, 'sect', row.houseId);
        lines.push(`${known ? house.name : 'A house you cannot name'} holds it against you: `
            + `${SEVERITY_IN_WORDS[row.severity]}.`);
    }

    const facts = factsForToolResult('The bones are taken.', lines);
    facts.structure.push(
        `take bones: ${bone.id} off ${still.id} (ordinal ${dead.ordinal}) by ${after.id}; `
        + `${tracked ? 'tracked' : 'counted'} grade, ${record.id} minted. ${present.length} present, `
        + `${saw.length} saw it${outOfSight ? ' (out of sight: aWitnessSeesThrough)' : ''}; `
        + `${holding.length} house(s) hold it.`
    );
    return { facts, events: spent.events, timeSkip: spent.timeSkip, breakthrough: null, outcome: 'executed', calls };
}
