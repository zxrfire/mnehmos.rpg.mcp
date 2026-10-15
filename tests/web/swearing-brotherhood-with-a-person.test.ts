/**
 * The ordinary oath verb formerly wrote only the player's unilateral word.
 * An actual close person may now ask, but no oath or lineage edge exists before
 * the human agrees. Mutual consent writes two serious sworn_brotherhood oaths
 * through the existing ledger and reciprocal sworn_sibling edges exactly once.
 */
import { describe, expect, it, vi } from 'vitest';
import { makeGameInWorld } from './harness';
import { createNpc, upsertRelationship } from '../../src/engine/world/npc-state';
import { makeLocation } from '../../src/engine/world/locations';
import { routineTime } from '../../src/engine/world/npc-routines';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { brotherhoodOfferedOnContact } from '../../src/web/swearing-brotherhood-with-a-person';
import { swornSiblingsOf } from '../../src/engine/world/close-people-go-together';
import { ledgerAbout, writeOneObligation } from '../../src/storage/repos/obligation.repo';
import { createObligation } from '../../src/engine/social/grudges';

async function prepared(invite = true) {
    const h = await makeGameInWorld({ seed: 'actual-sworn-player', worldSeed: 'actual-sworn-player-world' });
    const { cultivator } = await h.game.newRun('Traveller');
    const world = h.game.atHand!, day = routineTime(world);
    const place = makeLocation({ id: 'sworn-court', name: 'Sworn Court', kind: 'settlement' });
    world.locations.push(place);
    let friend = createNpc(world.seed, { id: 'the-close-friend', name: 'Zhou Ming', onDay: day,
        bornOnDay: day - 24 * 365, locationId: place.id });
    friend = upsertRelationship(friend, { targetId: cultivator.id, targetName: cultivator.name,
        kind: 'ally', standing: 1, factIds: [] }, day);
    world.npcs.push(friend);
    const at = world.npcs.findIndex(person => person.id === cultivator.id);
    world.npcs[at] = upsertRelationship(world.npcs[at], { targetId: friend.id, targetName: friend.name,
        kind: 'ally', standing: 1, factIds: [] }, day);
    h.game.repos.cultivators.update(cultivator.id, { location: place.name });
    h.game.repos.cultivators.standIn(cultivator.id, theAreasOf(world, place).whereIs.get(friend.id)!);
    h.game.theyGaveTheirName(h.game.currentRun().cultivator, h.game.currentRun().run, friend);
    h.game.theWorldMoved();
    if (invite) {
        const lines = brotherhoodOfferedOnContact(h.game, h.game.currentRun().cultivator);
        expect(lines.some(line => line.includes('Do you agree?'))).toBe(true);
    }
    return { ...h, friend, body: h.game.currentRun().cultivator };
}

describe('mutual brotherhood includes the player', () => {
    it('asks without swearing for a silent human', async () => {
        const h = await prepared();
        const look = await h.game.act('look around');
        expect(look.narration).toContain('Do you agree?');
        expect(swornSiblingsOf(h.game.atHand!, h.body.id).size).toBe(0);
        expect(ledgerAbout(h.db, h.body.id).some(word => word.cause === 'sworn_brotherhood')).toBe(false);
    });
    it('writes reciprocal ordinary oaths and kin edges after explicit consent, once', async () => {
        const h = await prepared();
        const accepted = await h.game.act('I accept the brotherhood invitation');
        expect(accepted.narration).toContain('sworn siblings');
        expect(swornSiblingsOf(h.game.atHand!, h.body.id).has(h.friend.id)).toBe(true);
        expect(swornSiblingsOf(h.game.atHand!, h.friend.id).has(h.body.id)).toBe(true);
        const words = ledgerAbout(h.db, h.body.id).filter(word => word.cause === 'sworn_brotherhood');
        expect(words.map(word => word.holderId).sort()).toEqual([h.body.id, h.friend.id].sort());
        expect(words.every(word => word.kind === 'oath' && word.severity === 'serious')).toBe(true);
        await h.game.act('I swear brotherhood with Zhou Ming');
        expect(ledgerAbout(h.db, h.body.id).filter(word => word.cause === 'sworn_brotherhood')).toHaveLength(2);
    }, 120000);
    it('declines without manufacturing a bond', async () => {
        const h = await prepared();
        await h.game.act('I decline the brotherhood invitation');
        expect(h.game.atHand!.history.facts.some(fact => typeof fact.data.swornBrotherhoodReply === 'string' && fact.data.accepted === false)).toBe(true);
        expect(swornSiblingsOf(h.game.atHand!, h.body.id).has(h.friend.id)).toBe(false);
        expect(ledgerAbout(h.db, h.body.id).some(word => word.cause === 'sworn_brotherhood')).toBe(false);
    });
    it('forming a private party puts the named invitation to the ordinary company authority', async () => {
        const h = await prepared(), before = h.game.state().cultivator.spiritStones;
        const request = vi.spyOn(h.game, 'request');
        const answer = await h.game.act(`I form a private party with ${h.friend.name} for 2 days`);
        expect(request).toHaveBeenCalled();
        expect(request.mock.calls[0][3]).toBe(h.friend.name);
        expect(request.mock.calls[0][4]).toBe('company');
        request.mockRestore();
        const accepted = answer.toolCalls.some(call => call.name === 'world.takeThemWithYou' && call.ok);
        expect(h.game.whoIsWithYouOnTheRoad(h.game.state().cultivator).some(person => person.id === h.friend.id)).toBe(accepted);
        expect(h.game.state().cultivator.spiritStones).toBe(before);
        expect(swornSiblingsOf(h.game.atHand!, h.body.id).has(h.friend.id)).toBe(false);
    }, 120000);
    it('a player proposal reads an existing ordinary favour and retains the actual NPC answer', async () => {
        const h = await prepared(false), world = h.game.atHand!;
        const favor = createObligation({ kind: 'favor', cause: 'other', holderId: h.body.id, subjectId: h.friend.id,
            severity: 'serious', onDay: routineTime(world), description: 'An existing personal favour.' });
        writeOneObligation(h.db, favor);
        const answer = await h.game.act(`I ask ${h.friend.name} to swear brotherhood`);
        const request = h.game.atHand!.history.facts.find(fact => fact.data.privateRequest === true
            && fact.actors.some(actor => actor.id === h.body.id && actor.role === 'asked'));
        expect(request, answer.narration).toBeDefined();
        const accepted = request!.data.accepted === true;
        expect(swornSiblingsOf(h.game.atHand!, h.body.id).has(h.friend.id), JSON.stringify({ request,
            report: answer.narration, present: h.game.present(h.game.state().cultivator).map(person => person.id),
            day: routineTime(h.game.atHand!) })).toBe(accepted);
        expect(h.game.atHand!.obligations.some(word => word.id === favor.id)).toBe(false);
        expect(ledgerAbout(h.db, h.body.id).find(word => word.id === favor.id)!.status).toBe(accepted ? 'settled' : 'open');
        expect(ledgerAbout(h.db, h.body.id).filter(word => word.cause === 'sworn_brotherhood')).toHaveLength(accepted ? 2 : 0);
    }, 120000);
});
