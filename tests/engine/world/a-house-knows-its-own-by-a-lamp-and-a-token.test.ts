/**
 * A HOUSE KNOWS ITS OWN BY A LAMP AND A TOKEN.
 *
 * `docs/world/houses/trust.md` has carried this design under its own heading
 * since it was written - *"Tokens shatter, so somebody has to be taken alive"* -
 * and NOTHING in the engine ever made one. `'token'` was a value of `ObjectKind`
 * that nothing produced.
 *
 * The load-bearing part is the shattering, and the document says why: because
 * the token dies with its holder, the obvious route to a stolen identity - kill
 * somebody and take their proof - does not exist. An identity has to be taken
 * ALIVE and kept alive, which turns a clean killing into an ongoing crime with a
 * living victim and somebody who can be rescued.
 */

import { describe, expect, it } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { purposeOf } from '../../../src/engine/world/architecture.js';
import {
    THE_ROOM_THE_ROLL_IS_KEPT_IN,
    WHEN_SILENCE_BECOMES_A_CAPTIVE,
    carriesATokenAt,
    lampIdFor,
    theTokenStillAnswers,
    tokenIdFor,
    whatAHouseMakesOfSilence,
    whatIsLeftOfThem,
    whatTheLampSays,
    couldLightALamp,
    lampsAreLitAt,
    thisHouseCanIssue,
    whatALampIsMadeFrom,
    wouldMakeALamp
} from '../../../src/engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { BEAST_MATERIALS } from '../../../src/data/cultivation/beasts.js';
import { roomAuthorityOf } from '../../../src/engine/world/architecture.js';
import { whoAnswersAbout, whoIsInChargeOfWhat } from '../../../src/engine/social-leverage/what-an-elder-is-in-charge-of.js';
import Database from 'better-sqlite3';
import { migrate } from '../../../src/storage/migrations.js';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo.js';
import { fixtureCatalog } from './fixtures.js';

describe('what a house issues', () => {
    it('gives every disciple a token to carry and a lamp burning', async () => {
        const state = seedWorld({
            seed: 'a-lamp-and-a-token', catalog: await loadCultivationCatalog()
        }).state;
        const byId = new Map(state.objects.map(o => [o.id, o]));

        const members = state.npcs.filter(npc =>
            npc.status === 'alive'
            && npc.factionId !== null
            && carriesATokenAt(npc.factionRankIndex));
        expect(members.length, 'nobody is on a roll at all').toBeGreaterThan(50);

        for (const member of members) {
            expect(byId.has(tokenIdFor(member.id)), `${member.name} carries no token`).toBe(true);
            expect(byId.has(lampIdFor(member.id)), `${member.name} has no lamp`).toBe(true);
        }
    });

    it('leaves the bottom rung without one, which is what the rung means', async () => {
        const state = seedWorld({
            seed: 'a-lamp-and-a-token', catalog: await loadCultivationCatalog()
        }).state;
        const ids = new Set(state.objects.map(o => o.id));
        const servants = state.npcs.filter(npc =>
            npc.factionId !== null && npc.factionRankIndex === 0);
        expect(servants.length, 'nobody is on the bottom rung').toBeGreaterThan(0);
        for (const servant of servants) {
            expect(ids.has(tokenIdFor(servant.id)), `${servant.name} was issued one`).toBe(false);
        }
    });

    it('lights the lamps in the hall and keeps the token on the person', async () => {
        const state = seedWorld({
            seed: 'a-lamp-and-a-token', catalog: await loadCultivationCatalog()
        }).state;
        const rooms = new Map(state.locations.map(l => [l.id, l]));

        const lamps = state.objects.filter(o => o.tags.includes('life-lamp'));
        expect(lamps.length).toBeGreaterThan(50);
        for (const lamp of lamps) {
            // Nobody carries a lamp: it is evidence the house holds, and it
            // cannot be lost with the person it answers for.
            expect(lamp.possessorId, `${lamp.name} is being carried`).toBeNull();
            const room = lamp.locationId === null ? null : rooms.get(lamp.locationId) ?? null;
            if (room !== null && purposeOf(room) !== null) {
                expect(purposeOf(room)).toBe(THE_ROOM_THE_ROLL_IS_KEPT_IN);
            }
        }

        const tokens = state.objects.filter(o => o.tags.includes('identity'));
        for (const token of tokens) {
            // Carried by their holder and OWNED by the house: issued, not
            // given, which is why a house can cancel one.
            expect(token.possessorId).not.toBeNull();
            expect(token.ownerId).not.toBe(token.possessorId);
        }
    });
});

describe('and only a house that can cut one has any', () => {
    it('needs a Foundation hand on the roll, not a Foundation recipient', () => {
        // A house-level gate: somebody here has to be able to CUT one. A house
        // with nobody at that rung has no lamps at all, for anybody.
        expect(couldLightALamp(lampsAreLitAt())).toBe(true);
        expect(couldLightALamp(lampsAreLitAt() - 1)).toBe(false);
        expect(thisHouseCanIssue([1, 2, lampsAreLitAt()])).toBe(true);
        expect(thisHouseCanIssue([1, 2, 3])).toBe(false);
        expect(thisHouseCanIssue([])).toBe(false);
    });
});

describe('and what one is cut from', () => {
    it('wants the best grade the cutting hand can actually work', () => {
        // Derived from the rung rather than named here, so the two move
        // together: a Foundation hand works mortal grade, because earth wants
        // Core Formation - a realm above the hand doing the cutting.
        expect(whatALampIsMadeFrom().grade).toBe('mortal');
        expect(whatALampIsMadeFrom().itIsBone).toBe(true);
    });

    it('finds bone in the catalog under the names the catalog uses', () => {
        // There is no material called a bone. The mortal-grade bone of a beast
        // big enough to cut a tag from is the Ironhide Tusk; antler, horn, fang
        // and tooth are all earth grade and a realm too high.
        const would = BEAST_MATERIALS.filter(m => wouldMakeALamp(m));
        expect(would.length, 'nothing in the catalog could light a lamp').toBeGreaterThan(0);
        for (const material of would) expect(material.grade).toBe('mortal');
        // And the earth-grade bones are refused, which is the point of the grade.
        const antler = BEAST_MATERIALS.find(m => m.name === 'Vein Deer Antler')!;
        expect(wouldMakeALamp(antler)).toBe(false);
    });
});

describe('and what death does to them', () => {
    /**
     * DERIVED AND NOT WRITTEN, which is the whole reason it cannot go wrong.
     * `markDead` is called from six places across four files; a stored flag
     * would be six chances to forget, and the one that forgot would leave a
     * lamp still burning for a dead disciple - the exact signature the world
     * uses to mean somebody is holding them prisoner. The bug would not read as
     * a bug. It would read as a kidnapping.
     */
    it('reads the lamp off the person, so no call site can miss it', () => {
        expect(whatTheLampSays(true)).toBe('they_live');
        expect(whatTheLampSays(false)).toBe('they_are_dead');
    });

    it('leaves nothing working on a corpse', () => {
        // The route to a stolen identity that must not exist.
        expect(theTokenStillAnswers(true)).toBe(true);
        expect(theTokenStillAnswers(false)).toBe(false);

        const left = whatIsLeftOfThem({ holderIsAlive: false, holderName: 'Yan Shuling' });
        expect(left!.lamp).toMatch(/gone out/);
        expect(left!.token).toMatch(/Dust/);
        expect(whatIsLeftOfThem({ holderIsAlive: true, holderName: 'Yan Shuling' })).toBeNull();
    });

    /**
     * AND THE WORSE SIGNATURE. A house that knows somebody LIVES and knows they
     * are not answering is looking at something quite different from a death,
     * and it is the state that sends the posters out.
     */
    it('reads a lamp still burning over a long silence as a captivity', () => {
        const held = {
            theyHaveALamp: true, holderIsAlive: true,
            daysSinceAnybodySawThem: WHEN_SILENCE_BECOMES_A_CAPTIVE
        };
        expect(whatAHouseMakesOfSilence(held)).toBe('somebody_has_them');
        expect(whatAHouseMakesOfSilence({ ...held, daysSinceAnybodySawThem: 1 })).toBe('nothing_yet');
        // A death closes the question rather than opening the worse one.
        expect(whatAHouseMakesOfSilence({ ...held, holderIsAlive: false })).toBe('they_are_dead');
        // And a house that never issued them one has nothing to read.
        expect(whatAHouseMakesOfSilence({ ...held, theyHaveALamp: false })).toBe('nothing_yet');
    });
});

describe('whose job it is', () => {
    /**
     * An office in this engine is a SEALED ROOM dealt to a decider. There is no
     * title table and adding one would be a second way of saying who is in
     * charge of what.
     */
    it('is the room, so the office needs no registry', () => {
        expect(THE_ROOM_THE_ROLL_IS_KEPT_IN).toBe('life_lamp_hall');
        // AN OFFICE, SO THE INTERNAL AFFAIRS ELDER IS A PERSON. It could not be
        // one while offices were dealt round-robin deepest-first: adding a room
        // shifted every holder by one and moved discipline permanently past the
        // rung that held it. It is dealt in a later round now
        // (`officeAddedInRound`), after every office the deal started with.
        expect(roomAuthorityOf('life_lamp_hall').office).toBe(true);
        expect(roomAuthorityOf('life_lamp_hall').sealed).toBe(false);
    });

    it('moved nobody off an office they already held when it became one', () => {
        const rooms = ['under_hall', 'treasury', 'archive', 'punishment_hall', 'tribute_room', 'mission_hall'] as const;
        const roll = [
            { id: 'head', rankIndex: 5 }, { id: 'elder-a', rankIndex: 4 },
            { id: 'elder-b', rankIndex: 4 }, { id: 'elder-c', rankIndex: 4 }
        ];
        const before = whoIsInChargeOfWhat({ rooms, roll, rankCount: 6 });
        const after = whoIsInChargeOfWhat({ rooms: [...rooms, 'life_lamp_hall'], roll, rankCount: 6 });
        for (const office of before) {
            expect(after.find(p => p.purpose === office.purpose)!.holderId, office.purpose).toBe(office.holderId);
        }
        expect(whoAnswersAbout(after, THE_ROOM_THE_ROLL_IS_KEPT_IN)).not.toBeNull();
    });
});

describe('and a save from when they were plates', () => {
    /**
     * THE DESIGN OWNER RENAMED THEM, AND A SAVE DOES NOT KNOW. Every life lamp
     * in a world saved before the rename is stored under its old id, tag and
     * field. Read back unmapped, every house in that world reads nobody off its
     * lamps and never misses anybody again. Red-checked by returning the row
     * unmapped in `world-state.repo.ts`: this goes red.
     */
    it('reads the old rows back as lamps', () => {
        const state = seedWorld({ seed: 'a-lamp-and-a-token', catalog: fixtureCatalog(), population: 120 }).state;
        const lamps = state.objects.filter(o => o.tags.includes('life-lamp'));
        expect(lamps.length, 'the fixture world lit no lamps').toBeGreaterThan(0);

        const OLD = 'life-plate';
        const asSaved = {
            ...state,
            objects: state.objects.map(o => {
                if (!o.tags.includes('life-lamp')) return o;
                const { litOnDay, ...rest } = o.data;
                return {
                    ...o,
                    id: o.id.replace(/^life-lamp-/, `${OLD}-`),
                    name: o.name.replace(/^the life lamp of /, 'the life plate of '),
                    tags: o.tags.map(t => (t === 'life-lamp' ? OLD : t)),
                    data: { ...rest, hungOnDay: litOnDay ?? null }
                };
            })
        };

        const db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
        migrate(db);
        const repo = new WorldStateRepository(db);
        repo.saveWorld(asSaved);
        const loaded = repo.loadWorld(state.id)!;

        const back = loaded.objects.filter(o => o.tags.includes('life-lamp'));
        expect(back).toEqual(lamps);
        expect(loaded.objects.some(o => o.id.startsWith(`${OLD}-`))).toBe(false);
    });
});
