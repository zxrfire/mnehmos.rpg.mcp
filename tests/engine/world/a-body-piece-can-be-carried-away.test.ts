/**
 * An uncut piece starts free on its ground; a later native party can take it.
 *
 * The old 500-year body census required every origin-tagged piece to remain
 * unclaimed. It failed on a piece held by npc-266. Native hunts deliberately
 * collect their materials, and real source-keyed checkpoints retain the origin
 * mark on carried-out objects. Current custody cannot be inferred from it.
 *
 * No accumulated history is needed for this rule. This is one focused control:
 * 256 fixed fresh scenes, a beast beside one weaker person, through the actual
 * native contact review. Nothing forces a fight or its result. Every actual
 * death must write findable uncut pieces and the ordinary body status. A later
 * capable collector on that same ground takes the same pieces through the
 * native party writer, and the player discovery reader must stop offering them.
 * Nonzero drops prevent an empty loop from proving the claim. The independent
 * long mortality controls remain in a-beast-that-climbs-also-fights-and-dies.
 */
import { expect, it } from 'vitest';
import { BEASTS, materialsOf } from '../../../src/data/cultivation/beasts.js';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import { standUpTheOneOnThisGround } from '../../../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { asItStandsNow } from '../../../src/engine/world/a-beast-climbs-by-sitting-where-it-is.js';
import { hasACore, whatComesOffTheBody } from '../../../src/engine/world/hunting-a-spirit-beast.js';
import { whatIsWorthARowOffABody, DAYS_A_BODY_IS_STILL_THERE } from '../../../src/engine/world/a-beast-that-climbs-also-fights-and-dies.js';
import { settlePracticeOnContact } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import { collectPrivatePartyFinds } from '../../../src/engine/world/private-party-finds.js';
import { isStatusRunningOn } from '../../../src/engine/world/what-is-true-of-a-place-right-now.js';
import { whatIsStandingFreeAt } from '../../../src/web/a-taking-is-decided-by-ownership.js';

it('writes a findable native remnant and lets an actual later collector carry it away', () => {
    const candidates = BEASTS.filter(hasACore).filter(beast =>
        whatIsWorthARowOffABody(beast).some(material => material.harvestOrdinal > beast.ordinal - 1));
    expect(candidates.length, 'the catalog has no tracked body with a part a weaker person cannot cut').toBeGreaterThan(0);
    const species = candidates.reduce((a, b) => a.ordinal < b.ordinal ? a : b);
    let qualifyingContacts = 0, beastDeaths = 0, droppedPieces = 0;
    for (let sample = 0; sample < 256; sample++) {
        const state = createWorld({ seed: 'native-body-custody-' + sample, skipPriorAges: true, regionCount: 0 });
        const ground = makeLocation({ id: 'loc-the-ledge', name: 'The Ledge', kind: 'wilds', qiDensity: .35 });
        state.locations.push(ground);
        const day = state.currentDay;
        const beast = standUpTheOneOnThisGround({ beast: species, locationId: ground.id, seed: state.seed, onDay: day });
        const challenger = setRealm(createNpc(state.seed, { id: 'npc-challenger',
            bornOnDay: day - 30 * 365, onDay: day, locationId: ground.id }), beast.cultivation.realmOrdinal - 1, day);
        const worthARow = new Set(whatIsWorthARowOffABody(species).map(material => material.id));
        const uncut = whatComesOffTheBody({ beast: asItStandsNow(species, beast.cultivation.realmOrdinal),
            takerOrdinal: challenger.cultivation.realmOrdinal, killed: true }).leftBehind
            .filter(piece => worthARow.has(piece.material.id));
        if (!uncut.length) continue;
        qualifyingContacts++;
        state.npcs.push(beast, challenger);
        settlePracticeOnContact(state, new Set([beast.id]));
        const ended = state.npcs.find(person => person.id === beast.id)!;
        if (ended.status === 'alive') continue;
        expect(ended.status).toBe('physically_dead');
        beastDeaths++;
        const pieces = state.objects.filter(object => object.tags.includes('off_a_body_nobody_claimed')
            && object.data.fromNpcId === beast.id);
        expect(pieces.length, 'a native death left no tracked part the weaker killer could not cut').toBeGreaterThan(0);
        droppedPieces += pieces.length;
        for (const piece of pieces) {
            expect(piece.possessorId).toBeNull();
            expect(piece.ownerId).toBeNull();
            expect(piece.locationId).toBe(ground.id);
            expect(whatIsStandingFreeAt(state, ground.id).map(row => row.id)).toContain(piece.id);
        }
        const status = state.statuses.find(row => row.kind === 'a_body_on_the_ground' && row.areaId === ground.id);
        expect(status).toBeDefined();
        expect(status!.reviewOnDay - status!.beganOnDay).toBe(DAYS_A_BODY_IS_STILL_THERE);
        expect(isStatusRunningOn(status!, day)).toBe(true);
        expect(isStatusRunningOn(status!, day + DAYS_A_BODY_IS_STILL_THERE)).toBe(false);
        const death = state.history.facts.find(fact => fact.actors.some(actor => actor.id === beast.id && actor.role === 'died'));
        expect(death).toBeDefined();
        const collector = setRealm(createNpc(state.seed, { id: 'npc-collector', bornOnDay: day - 30 * 365,
            onDay: day, locationId: ground.id }), Math.max(...materialsOf(species.id).map(material => material.harvestOrdinal)), day);
        state.npcs.push(collector);
        const harvest = whatComesOffTheBody({ beast: asItStandsNow(species, ended.cultivation.realmOrdinal),
            takerOrdinal: collector.cultivation.realmOrdinal, killed: true });
        for (const piece of pieces) expect(harvest.taken.map(part => part.material.id)).toContain(piece.data.materialId);
        collectPrivatePartyFinds(state, ground.id, [collector], null, day, death!.id, false, pieces);
        for (const piece of pieces) {
            const taken = state.objects.find(row => row.id === piece.id)!;
            expect(taken.possessorId).toBe(collector.id);
            expect(taken.ownerId).toBe(collector.id);
            expect(taken.data.carriedOutOf).toBe(ground.id);
            expect(taken.data.materialId).toBe(piece.data.materialId);
            expect(whatIsStandingFreeAt(state, ground.id).map(row => row.id)).not.toContain(piece.id);
        }
    }
    expect(qualifyingContacts).toBeGreaterThan(0);
    expect(beastDeaths).toBeGreaterThan(0);
    expect(droppedPieces).toBeGreaterThan(0);
    console.info('[native body custody]', { contacts: 256, qualifyingContacts, beastDeaths, droppedPieces });
});
