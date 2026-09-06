/**
 * A HOUSE KNOWS ITS OWN BY A PLATE AND A TOKEN.
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
    plateIdFor,
    theTokenStillAnswers,
    tokenIdFor,
    whatAHouseMakesOfSilence,
    whatIsLeftOfThem,
    whatThePlateSays
} from '../../../src/engine/world/a-house-knows-its-own-by-a-plate-and-a-token.js';
import { roomAuthorityOf } from '../../../src/engine/world/architecture.js';

describe('what a house issues', () => {
    it('gives every disciple a token to carry and a plate on a wall', async () => {
        const state = seedWorld({
            seed: 'a-plate-and-a-token', catalog: await loadCultivationCatalog()
        }).state;
        const byId = new Map(state.objects.map(o => [o.id, o]));

        const members = state.npcs.filter(npc =>
            npc.status === 'alive'
            && npc.factionId !== null
            && carriesATokenAt(npc.factionRankIndex));
        expect(members.length, 'nobody is on a roll at all').toBeGreaterThan(50);

        for (const member of members) {
            expect(byId.has(tokenIdFor(member.id)), `${member.name} carries no token`).toBe(true);
            expect(byId.has(plateIdFor(member.id)), `${member.name} has no plate`).toBe(true);
        }
    });

    it('leaves the bottom rung without one, which is what the rung means', async () => {
        const state = seedWorld({
            seed: 'a-plate-and-a-token', catalog: await loadCultivationCatalog()
        }).state;
        const ids = new Set(state.objects.map(o => o.id));
        const servants = state.npcs.filter(npc =>
            npc.factionId !== null && npc.factionRankIndex === 0);
        expect(servants.length, 'nobody is on the bottom rung').toBeGreaterThan(0);
        for (const servant of servants) {
            expect(ids.has(tokenIdFor(servant.id)), `${servant.name} was issued one`).toBe(false);
        }
    });

    it('hangs the plates in the hall and keeps the token on the person', async () => {
        const state = seedWorld({
            seed: 'a-plate-and-a-token', catalog: await loadCultivationCatalog()
        }).state;
        const rooms = new Map(state.locations.map(l => [l.id, l]));

        const plates = state.objects.filter(o => o.tags.includes('life-plate'));
        expect(plates.length).toBeGreaterThan(50);
        for (const plate of plates) {
            // Nobody carries a plate: it is evidence the house holds, and it
            // cannot be lost with the person it answers for.
            expect(plate.possessorId, `${plate.name} is being carried`).toBeNull();
            const room = plate.locationId === null ? null : rooms.get(plate.locationId) ?? null;
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

describe('and what death does to them', () => {
    /**
     * DERIVED AND NOT WRITTEN, which is the whole reason it cannot go wrong.
     * `markDead` is called from six places across four files; a stored flag
     * would be six chances to forget, and the one that forgot would leave a
     * whole plate hanging for a dead disciple - the exact signature the world
     * uses to mean somebody is holding them prisoner. The bug would not read as
     * a bug. It would read as a kidnapping.
     */
    it('reads the plate off the person, so no call site can miss it', () => {
        expect(whatThePlateSays(true)).toBe('they_live');
        expect(whatThePlateSays(false)).toBe('they_are_dead');
    });

    it('leaves nothing working on a corpse', () => {
        // The route to a stolen identity that must not exist.
        expect(theTokenStillAnswers(true)).toBe(true);
        expect(theTokenStillAnswers(false)).toBe(false);

        const left = whatIsLeftOfThem({ holderIsAlive: false, holderName: 'Yan Shuling' });
        expect(left!.plate).toMatch(/in pieces/);
        expect(left!.token).toMatch(/Dust/);
        expect(whatIsLeftOfThem({ holderIsAlive: true, holderName: 'Yan Shuling' })).toBeNull();
    });

    /**
     * AND THE WORSE SIGNATURE. A house that knows somebody LIVES and knows they
     * are not answering is looking at something quite different from a death,
     * and it is the state that sends the posters out.
     */
    it('reads a whole plate over a long silence as a captivity', () => {
        const held = {
            theyHaveAPlate: true, holderIsAlive: true,
            daysSinceAnybodySawThem: WHEN_SILENCE_BECOMES_A_CAPTIVE
        };
        expect(whatAHouseMakesOfSilence(held)).toBe('somebody_has_them');
        expect(whatAHouseMakesOfSilence({ ...held, daysSinceAnybodySawThem: 1 })).toBe('nothing_yet');
        // A death closes the question rather than opening the worse one.
        expect(whatAHouseMakesOfSilence({ ...held, holderIsAlive: false })).toBe('they_are_dead');
        // And a house that never issued them one has nothing to read.
        expect(whatAHouseMakesOfSilence({ ...held, theyHaveAPlate: false })).toBe('nothing_yet');
    });
});

describe('whose job it is', () => {
    /**
     * An office in this engine is a SEALED ROOM dealt to a decider. There is no
     * title table and adding one would be a second way of saying who is in
     * charge of what.
     */
    it('is the room, so the office needs no registry', () => {
        expect(THE_ROOM_THE_ROLL_IS_KEPT_IN).toBe('ancestral_hall');
        // Held here because the office machinery only deals SEALED rooms out,
        // so the day this hall is sealed the Keeper becomes a portfolio holder
        // automatically - and until then, deliberately, nobody holds it.
        expect(roomAuthorityOf('ancestral_hall').sealed).toBe(false);
    });
});
