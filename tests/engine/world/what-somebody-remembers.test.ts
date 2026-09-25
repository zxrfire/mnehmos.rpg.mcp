/**
 * What somebody remembers is what they lived, what they were told and what they carry, read off
 * the stores that already hold it for one person at a time. The owner: a house's memories come
 * up in conversation, "but remember a sect is its people".
 *
 * On a seeded world: a house loses somebody, and then the question is put to the people who
 * were there, somebody taken on afterwards, and somebody of another house.
 */
import { describe, expect, it } from 'vitest';

import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { aUniformFor } from '../../../src/engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { LID_CHANNEL_TAG } from '../../../src/engine/world/immortal-world.js';
import { storeMemory } from '../../../src/engine/world/memory.js';
import { markDead, upsertRelationship, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { whatADeathIsWorth } from '../../../src/engine/world/what-a-death-at-this-height-is-worth.js';
import { whatSomebodyRemembers } from '../../../src/engine/world/what-somebody-remembers.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import type { FactionRecord, WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;

function world(): WorldState {
    return seedWorld({ seed: 'remember-a', catalog: fixtureCatalog(), presentYear: 1000, population: 200 }).state;
}

const row = (state: WorldState, id: string) => state.npcs.find(n => n.id === id)!;
const aboutThem = (said: ReturnType<typeof whatSomebodyRemembers>, them: NpcRecord) =>
    said.find(thing => thing.named.some(person => person.id === them.id));
/** The lowest on the ladder and in the rungs, whose death stays inside the house. */
const theLeastOf = (members: readonly NpcRecord[]) =>
    [...members].sort((a, b) => a.cultivation.realmOrdinal - b.cultivation.realmOrdinal)[0]!;
const put = (state: WorldState, npc: NpcRecord) => {
    state.npcs[state.npcs.findIndex(n => n.id === npc.id)] = npc;
};

/** A house with a head and at least four more living people on its roll. */
function aHouseWithPeople(state: WorldState): { house: FactionRecord; head: NpcRecord; members: NpcRecord[] } {
    for (const house of state.factions) {
        const members = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id);
        const head = members.find(n => house.ranks.length > 0 && n.factionRankIndex >= house.ranks.length - 1);
        if (head && members.length >= 5) return { house, head, members: members.filter(n => n.id !== head.id) };
    }
    throw new Error('the seeded world has no house with a head and five people');
}

/** The house loses somebody today, through the same two writes the world's own deaths make. */
function theyDie(state: WorldState, dead: NpcRecord, house: FactionRecord, cause: string) {
    put(state, markDead(dead, state.currentDay, cause));
    const worth = whatADeathIsWorth(dead, house);
    return appendWorldFact(state, makeFact({
        day: state.currentDay,
        kind: 'death',
        scale: worth.scale,
        visibility: worth.visibility,
        actors: [{ id: dead.id, name: dead.name, role: 'deceased' }],
        locationId: dead.locationId,
        factionIds: [house.id],
        summary: `${dead.name} died, ${dead.cultivation.realmOrdinal} rungs up.`
    }), { bystanders: false });
}

/** Somebody off every roll, taken on by this house and robed today. */
function takenOnToday(state: WorldState, house: FactionRecord, rank = 0): NpcRecord {
    const free = state.npcs.find(n => n.status === 'alive' && n.factionId === null && n.relationships.length === 0)
        ?? state.npcs.find(n => n.status === 'alive' && n.factionId === null)!;
    put(state, { ...free, factionId: house.id, factionRankIndex: rank });
    state.objects.push(aUniformFor({ memberId: free.id, houseId: house.id, houseName: house.name, onDay: state.currentDay }));
    return row(state, free.id);
}

describe('what somebody remembers of their house', () => {
    it('is lived by somebody who was on the roll, and says how long ago', () => {
        const state = world();
        const { house, head, members } = aHouseWithPeople(state);
        theyDie(state, head, house, 'Their span ran out.');
        state.currentDay += 12 * YEAR;

        const first = aboutThem(whatSomebodyRemembers(state, members[0]!.id), head);
        expect(first).toMatchObject({ how: 'lived', yearsAgo: 12, beforeTheyJoined: false, toldBy: null });
        expect(first!.what).toBe(`${head.name} died; their span ran out`);
        // The rung count on the ledger's own sentence is not something a person perceives.
        expect(first!.what).not.toMatch(/rung/);
    });

    it('is told to somebody taken on after, when the death carried past the house', () => {
        const state = world();
        const { house, head } = aHouseWithPeople(state);
        const fact = theyDie(state, head, house, 'Their span ran out.');
        expect(['regional', 'continental', 'world'], 'a head dying carries').toContain(fact.scale);
        state.currentDay += 3 * YEAR;
        const newcomer = takenOnToday(state, house);

        const first = aboutThem(whatSomebodyRemembers(state, newcomer.id), head);
        expect(first).toMatchObject({ how: 'told', toldBy: 'their house', beforeTheyJoined: true, yearsAgo: 3 });
    });

    it('reaches somebody taken on after an ordinary death only through a master who lived it', () => {
        const state = world();
        const { house, members } = aHouseWithPeople(state);
        const ordinary = theLeastOf(members);
        const fact = theyDie(state, ordinary, house, 'Died of a fever.');
        expect(fact.scale === 'personal' || fact.scale === 'local', 'an outer disciple dying stays in the house').toBe(true);
        state.currentDay += YEAR;

        const newcomer = takenOnToday(state, house);
        expect(whatSomebodyRemembers(state, newcomer.id).map(t => t.what).join('\n')).not.toContain(ordinary.name);

        const master = members.find(n => n.id !== ordinary.id)!;
        put(state, upsertRelationship(newcomer, {
            targetId: master.id, targetName: master.name, kind: 'master', standing: 0.5, note: 'took them on'
        }, state.currentDay));
        const told = aboutThem(whatSomebodyRemembers(state, newcomer.id), ordinary);
        expect(told).toMatchObject({ how: 'told', toldBy: 'their master', beforeTheyJoined: true });
        expect(told!.what).toBe(`${ordinary.name} died of a fever`);
    });

    it('is told to somebody high on the ladder by whoever in the house lived it', () => {
        const state = world();
        const { house, members } = aHouseWithPeople(state);
        const ordinary = theLeastOf(members);
        theyDie(state, ordinary, house, 'Died of a fever.');
        state.currentDay += YEAR;
        const low = takenOnToday(state, house, 0);
        expect(aboutThem(whatSomebodyRemembers(state, low.id), ordinary)).toBeUndefined();
        const elder = takenOnToday(state, house, Math.ceil(house.ranks.length / 2));

        expect(aboutThem(whatSomebodyRemembers(state, elder.id), ordinary))
            .toMatchObject({ how: 'told', toldBy: 'their house' });
    });

    it('says a killing off its fields, and not a killer the house never learned', () => {
        const state = world();
        const { house, members } = aHouseWithPeople(state);
        const [witness, first, second] = members;
        const killer = state.npcs.find(n => n.status === 'alive' && n.factionId !== house.id)!;
        const killing = (victim: NpcRecord, causeKnown: boolean) => {
            put(state, markDead(victim, state.currentDay, 'Killed.'));
            appendWorldFact(state, makeFact({
                day: state.currentDay, kind: 'death', visibility: 'faction', causeKnown,
                actors: [{ id: killer.id, name: killer.name, role: 'killer' }, { id: victim.id, name: victim.name, role: 'victim' }],
                factionIds: [house.id],
                summary: `${killer.name} killed ${victim.name}, 9 rungs up the ladder.`
            }), { bystanders: false });
        };
        killing(first!, false);
        killing(second!, true);
        const said = whatSomebodyRemembers(state, witness!.id);

        expect(aboutThem(said, first!)!.what).toBe(`${first!.name} was killed, and by whom is not known to them`);
        expect(aboutThem(said, first!)!.named.map(n => n.id)).not.toContain(killer.id);
        expect(aboutThem(said, second!)!.what).toBe(`${second!.name} was killed by ${killer.name}`);

        // And where the killer was the player, the player is who they say did it.
        const player = { id: killer.id, name: killer.name };
        const byYou = aboutThem(whatSomebodyRemembers(state, witness!.id, { player }), second!);
        expect(byYou).toMatchObject({ withThePlayer: true, what: `${second!.name} was killed by the player` });
    });

    it('is nothing to somebody of another house', () => {
        const state = world();
        const { house, head } = aHouseWithPeople(state);
        theyDie(state, head, house, 'Their span ran out.');
        const stranger = state.npcs.find(n => n.status === 'alive' && n.factionId !== null && n.factionId !== house.id)!;
        expect(whatSomebodyRemembers(state, stranger.id).map(t => t.what).join('\n')).not.toContain(head.name);
    });

    it('puts what it was to them first: somebody of theirs, by their word for it', () => {
        const state = world();
        const { house, head, members } = aHouseWithPeople(state);
        const [elder, disciple] = members;
        theyDie(state, head, house, 'Their span ran out.');
        state.currentDay += 5 * YEAR;
        theyDie(state, disciple!, house, 'Died of a fever.');
        put(state, upsertRelationship(row(state, elder!.id), {
            targetId: disciple!.id, targetName: disciple!.name, kind: 'disciple', standing: 0.8, note: 'their own'
        }, state.currentDay - 20 * YEAR));

        const said = whatSomebodyRemembers(state, elder!.id);
        const first = aboutThem(said, disciple!);
        const second = aboutThem(said, head);
        expect(first!.itWasTheir).toBe('their disciple');
        expect(said.indexOf(first!)).toBeLessThan(said.indexOf(second!));
        expect(first!.named[0]).toMatchObject({ id: disciple!.id, otherwise: 'their disciple' });
        expect(second!.named[0]).toMatchObject({ id: head.id, otherwise: 'the head of their house' });
    });
});

describe('what somebody carries', () => {
    it('reads their own memory rows, and keeps a word from above to themselves', () => {
        const state = world();
        const { house, members } = aHouseWithPeople(state);
        const [holder, sender] = members;
        storeMemory(state.memories, {
            ownerId: holder!.id, kind: 'promise', summary: 'Wait at the landing in the year of the ox.',
            onDay: state.currentDay, actorIds: [sender!.id], tags: [LID_CHANNEL_TAG, 'down']
        });
        storeMemory(state.memories, {
            ownerId: holder!.id, kind: 'routine', summary: 'Swept the yard.', onDay: state.currentDay
        });
        const said = whatSomebodyRemembers(state, holder!.id);
        const word = said.find(t => t.what.startsWith('Wait at the landing'));
        expect(word).toMatchObject({ how: 'lived', keptToThemselves: true });
        expect(said.some(t => t.what.includes('Swept the yard'))).toBe(false);
        void house;
    });

    it('does not tell a loss twice when it is both carried and on the ledger', () => {
        const state = world();
        const { house, head, members } = aHouseWithPeople(state);
        const fact = theyDie(state, head, house, 'Their span ran out.');
        storeMemory(state.memories, {
            ownerId: members[0]!.id, kind: 'loss', summary: `${head.name} died. Their span ran out.`,
            onDay: fact.day, actorIds: [head.id], factionIds: [house.id], salience: 0.7
        });
        const about = whatSomebodyRemembers(state, members[0]!.id).filter(t => t.what.includes(head.name));
        expect(about).toHaveLength(1);
        expect(about[0]!.what).toBe(`${head.name} died. Their span ran out`);
    });

    it('writes nothing', () => {
        const state = world();
        const { house, head, members } = aHouseWithPeople(state);
        theyDie(state, head, house, 'Their span ran out.');
        const before = JSON.stringify([state.memories, state.npcs, state.history.facts.length]);
        whatSomebodyRemembers(state, members[0]!.id);
        expect(JSON.stringify([state.memories, state.npcs, state.history.facts.length])).toBe(before);
    });
});

describe('what the player did, remembered by who was there', () => {
    it('comes back to somebody who was standing there, with the player called the player', () => {
        const state = world();
        const { members } = aHouseWithPeople(state);
        const [witness, you] = members;
        const player = { id: you!.id, name: you!.name };
        appendWorldFact(state, makeFact({
            day: state.currentDay,
            kind: 'said_in_public',
            actors: [{ id: you!.id, name: you!.name, role: 'speaker' }],
            witnessIds: [witness!.id],
            summary: `${you!.name} named the man who poisoned the well.`
        }));
        state.currentDay += 2 * YEAR;

        const [first] = whatSomebodyRemembers(state, witness!.id, { player });
        expect(first).toMatchObject({ how: 'lived', withThePlayer: true, yearsAgo: 2 });
        expect(first!.what).toBe('the player named the man who poisoned the well');

        const elsewhere = state.npcs.find(n => n.status === 'alive' && n.id !== witness!.id && n.id !== you!.id)!;
        expect(whatSomebodyRemembers(state, elsewhere.id, { player }).some(t => t.withThePlayer)).toBe(false);
    });

    it('stops at the limit it is given', () => {
        const state = world();
        const { house, head, members } = aHouseWithPeople(state);
        theyDie(state, head, house, 'Their span ran out.');
        theyDie(state, members[1]!, house, 'Died of a fever.');
        theyDie(state, members[2]!, house, 'Died of a fever.');
        expect(whatSomebodyRemembers(state, members[0]!.id, { limit: 2 })).toHaveLength(2);
    });
});
