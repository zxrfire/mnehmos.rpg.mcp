/**
 * A PERSON IS SOMEBODY IN PARTICULAR.
 *
 * The design owner, on the side characters of the genre: *"they have
 * personalities. That should fall out."*
 *
 * FALL OUT is the whole assertion. There is no personality field, no table of
 * characters, and nothing anywhere switches on a personality name - what a
 * person is like is a function of what the world already rolled for them, and
 * these tests hold that shape rather than any particular number.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import {
    heightOfTheBirth,
    howFarFromTheStart,
    howHardTheyPush,
    howMuchTheyPlayToTheRoom,
    howTheyGoAtThings,
    howTheyWantItSeen,
    whatSomebodyIsLike
} from '../../../src/engine/world/what-somebody-is-like-and-where-it-came-from.js';
import { openHandednessOf } from '../../../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import type { InnateAttributes } from '../../../src/engine/cultivation/spirit-roots.js';

const MIDDLING: InnateAttributes = { might: 2, insight: 2, fortune: 1, charm: 2 };

describe('what somebody is like', () => {
    it('is a function of them, and says the same thing every time it is asked', () => {
        // The reason this is derived where activity is stored. Personality does
        // not change, so deriving it is what KEEPS it consistent - the same
        // person reads the same way from every angle, in every system, forever.
        const of = { id: 'npc-steady', attributes: MIDDLING, origin: 'market_town' as const, realmOrdinal: 9 };
        const first = howHardTheyPush(of);
        for (let i = 0; i < 20; i++) expect(howHardTheyPush(of)).toBe(first);
        expect(howMuchTheyPlayToTheRoom(of)).toBe(howMuchTheyPlayToTheRoom(of));
    });

    it('separates two people the world rolled the same way', () => {
        // The residue. Two people with the same attributes born in the same
        // county are not the same person, and the difference between them is
        // not a fact about either of them - so it comes off the id.
        const base = { attributes: MIDDLING, origin: 'thin_county' as const, realmOrdinal: 7 };
        const seen = new Set<number>();
        for (let i = 0; i < 40; i++) seen.add(howHardTheyPush({ ...base, id: `twin-${i}` }));
        expect(seen.size).toBeGreaterThan(30);
    });

    it('stays inside its band whatever it is handed', () => {
        for (const might of [1, 2, 3]) {
            for (const insight of [1, 2, 3, 4]) {
                for (const charm of [1, 2, 3]) {
                    for (const origin of ['thin_county', 'dao_house_bloodline'] as const) {
                        for (const realmOrdinal of [0, 7, 22, 44]) {
                            const attributes = { might, insight, fortune: 1, charm };
                            const push = howHardTheyPush({ id: 'x', attributes, origin, realmOrdinal });
                            const room = howMuchTheyPlayToTheRoom({ id: 'x', attributes, origin });
                            expect(push).toBeGreaterThanOrEqual(-1);
                            expect(push).toBeLessThanOrEqual(1);
                            expect(room).toBeGreaterThanOrEqual(-1);
                            expect(room).toBeLessThanOrEqual(1);
                        }
                    }
                }
            }
        }
    });

    it('reads a birth off the table it is written in, not off a list kept here', () => {
        // The ordering is the origin table's own, so a repricing moves every
        // person born to that tier and this file needs no edit.
        expect(heightOfTheBirth('thin_county')).toBeLessThan(heightOfTheBirth('market_town'));
        expect(heightOfTheBirth('market_town')).toBeLessThan(heightOfTheBirth('minor_clan'));
        expect(heightOfTheBirth('minor_clan')).toBeLessThan(heightOfTheBirth('established_clan'));
        expect(heightOfTheBirth('established_clan')).toBeLessThan(heightOfTheBirth('dao_house_bloodline'));
        // And it uses its whole range rather than saturating at the top, which
        // the first version did.
        expect(heightOfTheBirth('thin_county')).toBeLessThanOrEqual(0.01);
        expect(heightOfTheBirth('dao_house_bloodline')).toBeGreaterThanOrEqual(0.99);
        const middles = (['market_town', 'minor_clan', 'sect_retainer', 'established_clan'] as const)
            .map(heightOfTheBirth);
        for (const at of middles) {
            expect(at).toBeGreaterThan(0.05);
            expect(at).toBeLessThan(0.95);
        }
    });

    it('measures a climb against what the birth predicted, not against the top of the world', () => {
        // Measured, and the reason `WHERE_A_BIRTH_PUTS_YOU` is calibrated: a
        // thin-county birth at its own median has climbed nothing, and a dao
        // house bloodline standing at the SAME ordinal has fallen a long way.
        expect(Math.abs(howFarFromTheStart('thin_county', 7))).toBeLessThan(0.15);
        expect(howFarFromTheStart('dao_house_bloodline', 7)).toBeLessThan(-0.9);
        expect(howFarFromTheStart('thin_county', 30)).toBeGreaterThan(0.9);
        expect(Math.abs(howFarFromTheStart('dao_house_bloodline', 22))).toBeLessThan(0.15);
    });

    it('leaves most people unremarkable and marks the rest', async () => {
        // A world where everybody is a character is a world where nobody is.
        // Most people are ordinary on all three axes; the ends are the part
        // worth a sentence.
        const state = seedWorld({ seed: 'is-somebody-in-particular', catalog: await loadCultivationCatalog() }).state;
        const alive = state.npcs.filter(n => n.status === 'alive');
        expect(alive.length).toBeGreaterThan(100);

        let flat = 0;
        let pushes = 0;
        let goesAround = 0;
        for (const npc of alive) {
            const { push, room } = whatSomebodyIsLike(npc);
            if (howTheyGoAtThings(push) === null
                && howTheyWantItSeen(room) === null
                && Math.abs(openHandednessOf(npc.id)) < 0.4) flat++;
            if (push >= 0.4) pushes++;
            if (push <= -0.4) goesAround++;
        }
        const ordinary = flat / alive.length;
        expect(ordinary).toBeGreaterThan(0.2);
        expect(ordinary).toBeLessThan(0.6);

        // AND THE PUSH AXIS IS NOT A SLOPE. The first version compared a birth
        // height on 0..1 against `ordinal / 24` as though those were the same
        // scale, and read four fifths of the world as pushing, because four
        // fifths of the world is born low.
        const lean = Math.abs(pushes - goesAround) / (pushes + goesAround);
        expect(lean).toBeLessThan(0.35);
    });
});

describe('and it shows in what they are doing', () => {
    it('puts the two ends of a sparring yard on the two ends of the axis', async () => {
        // Same yard, same hour, and which end of the practice sword somebody is
        // holding is a thing about them rather than a roll.
        const state = seedWorld({ seed: 'the-two-ends', catalog: await loadCultivationCatalog() }).state;
        let holding = 0;
        let knockedDown = 0;
        for (const npc of state.npcs) {
            const note = npc.activity?.note ?? '';
            if (note.includes('holding the sword in what an inner disciple')) {
                expect(whatSomebodyIsLike(npc).push).toBeGreaterThanOrEqual(0);
                holding++;
            }
            if (note.includes('being knocked down repeatedly')) {
                expect(whatSomebodyIsLike(npc).push).toBeLessThan(0);
                knockedDown++;
            }
        }
        expect(holding + knockedDown).toBeGreaterThan(0);
    });

    it('makes a shakedown out of two real people and keeps it rare', async () => {
        // The outer sect of the genre has its own order in it, kept by people
        // whose whole seniority is a few months. Both ends fall out of numbers
        // already true of these two before they stood on the same square.
        const state = seedWorld({ seed: 'the-arrangement-here', catalog: await loadCultivationCatalog() }).state;
        const alive = state.npcs.filter(n => n.status === 'alive');
        const byId = new Map(state.npcs.map(n => [n.id, n]));
        const squeezed = alive.filter(n => n.activity?.kind === 'squeezing');

        expect(squeezed.length).toBeGreaterThan(0);
        // Rare. A compound where a third of it is being shaken down is as
        // untrue as one where nobody ever is.
        expect(squeezed.length / alive.length).toBeLessThan(0.1);

        for (const npc of squeezed) {
            expect(npc.activity!.withIds).toHaveLength(1);
            const other = byId.get(npc.activity!.withIds[0]!)!;
            // Symmetric, like every other scene: both are in it and both name
            // the other, so it reads the same whichever of them you walked up to.
            expect(other.activity?.kind).toBe('squeezing');
            expect(other.activity?.withIds).toContain(npc.id);
            expect(other.factionId).toBe(npc.factionId);
            // And one of them is over the other, in rank and in how hard they push.
            const overIt = npc.activity!.note.startsWith('explaining') ? npc : other;
            const under = overIt === npc ? other : npc;
            expect(overIt.factionRankIndex).toBeGreaterThanOrEqual(under.factionRankIndex);
            expect(whatSomebodyIsLike(overIt).push).toBeGreaterThan(whatSomebodyIsLike(under).push);
        }
    });
});

describe('the ruling stays in the file that makes it', () => {
    it('says that nothing switches on a personality name', () => {
        // The constraint `an-attempt-to-move-somebody.ts` already states, held
        // here so a refactor cannot quietly turn three scalars into an enum and
        // the world into sixteen people wearing different faces.
        const source = readFileSync(
            'src/engine/world/what-somebody-is-like-and-where-it-came-from.ts', 'utf8');
        expect(source).toContain('Nothing\n * switches on a personality name');
        expect(source).toContain('A new kind of person is a different number, and no code.');
        expect(source).not.toMatch(/^export type \w*Personality/m);
    });

    it('says why this is derived where activity is stored', () => {
        const source = readFileSync(
            'src/engine/world/what-somebody-is-like-and-where-it-came-from.ts', 'utf8');
        expect(source).toContain('Same reason, opposite answer.');
    });
});
