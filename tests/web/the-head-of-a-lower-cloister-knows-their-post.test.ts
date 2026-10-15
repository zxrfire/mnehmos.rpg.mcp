/**
 * Branch leadership was derived and tested but never reached play. The head
 * knows their own responsibility; it belongs in their spoken subject, not in
 * an observation claiming that a stranger can see rank or appointment records.
 * The normal company card reads the actual post. When its holder leaves, the
 * next actual posted person supplies that responsibility without a stored flag.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { templeBranchesOf, whoHeadsTheBranch, THE_TEMPLE_ID } from '../../src/engine/world/a-temple-branch.js';
import { setLocation } from '../../src/engine/world/npc-state.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { getSect } from '../../src/data/cultivation/sects.js';
import { standWhereThePeopleAre } from './standing-where-the-people-are.js';

it('derives the spoken responsibility from whoever actually heads this cloister', async () => {
    const h = await makeGameInWorld({ seed: 'branch-voice', worldSeed: 'dao-houses-in-cities' });
    try {
        await h.game.newRun('Visitor');
        const world = h.game.atHand!;
        const branch = templeBranchesOf(world, THE_TEMPLE_ID).find(branch => whoHeadsTheBranch(world, branch));
        expect(branch).toBeDefined();
        const head = whoHeadsTheBranch(world, branch!)!;
        const me = h.game.currentRun().cultivator;
        h.repos.cultivators.update(me.id, { location: branch!.name });
        await standWhereThePeopleAre(h, me.id, new Set([head.id]));
        expect(h.game.present(h.game.currentRun().cultivator).some(person => person.id === head.id)).toBe(true);
        h.game.noteEncounter(h.game.currentRun().cultivator, h.game.currentRun().run,
            { kind: 'cultivator', id: head.id, name: head.name }, 'told', `${head.name} gave their name.`);
        const card = h.game['company'](h.game.currentRun().cultivator).named.find(person => person.id === head.id);
        expect(card?.chewing?.plainly).toContain('responsible for the lower cloister');
        const at = world.npcs.findIndex(person => person.id === head.id);
        const house = world.factions.find(house => house.id === THE_TEMPLE_ID)!;
        world.npcs[at] = setLocation(world.npcs[at]!, house.seatLocationId, routineTime(world));
        const next = whoHeadsTheBranch(world, branch!)!;
        expect(next).toBeDefined();
        expect(next.id).not.toBe(head.id);
        const spoken = (id: string) => {
            const person = world.npcs.find(person => person.id === id)!;
            return h.game['whatTheyHaveOnTheirMind']({ id, realmOrdinal: person.cultivation.realmOrdinal,
                age: (routineTime(world) - person.identity.bornOnDay) / 365,
                sectRank: getSect(person.factionId!)?.ranks[person.factionRankIndex] ?? null },
            person, new Set(world.factions.map(house => house.id)))?.plainly;
        };
        expect(spoken(head.id) ?? '').not.toContain('responsible for the lower cloister');
        expect(spoken(next.id)).toContain('responsible for the lower cloister');
    } finally { h.db.close(); }
}, 120_000);
