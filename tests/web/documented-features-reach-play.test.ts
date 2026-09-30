/**
 * The audit found public boards without entrants, named disciples routed into
 * generic intake, tenure fixed at zero, and dead lamps without inquiries.
 * These turns pin the resulting records and the facts a player can read.
 * Fixtures set an arrangement; the ordinary turn routes perform each act.
 * Disabling these feature writes made all six assertions fail; restoring them
 * passed in the same command, with the world seed pinned in both arms.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { theDayItFallsIn } from '../../src/engine/world/a-competition-anybody-may-enter.js';
import { whoHasALampBurningIn } from '../../src/engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';

async function game(seed: string) {
    const h = await makeGameInWorld({ seed, worldSeed: 'documented-features' });
    const opened = await h.game.newRun('Visitor');
    const world = h.game.atHand!;
    return { ...h, ...opened, world };
}
function said(turn: { narration: string; toolCalls: { summary: string }[] }) {
    return turn.narration + ' ' + turn.toolCalls.map(c => c.summary).join(' ');
}

describe('documented features reached by player turns', () => {
    it('credits a promotion in face while preserving the original join day', async () => {
        const h = await game('a-promotion-earned-face');
        const house = h.repos.sects.list().find(s => s.ranks.length > 1)!;
        const joined = h.world.currentDay;
        h.repos.sects.addMember(house.id, h.cultivator.id, 0, joined);
        h.repos.sects.addContribution(house.id, h.cultivator.id, 1_000_000);
        h.repos.cultivators.update(h.cultivator.id, { realmOrdinal: 30 });
        const turn = await h.game.act('I ask for a promotion');
        expect(h.repos.sects.getMembership(h.cultivator.id)!.rankIndex, said(turn)).toBeGreaterThan(0);
        expect(h.world.npcs.find(n => n.id === h.cultivator.id)!.face ?? 0).toBeGreaterThan(0);
        expect(h.repos.sects.getMembership(h.cultivator.id)!.joinedOnDay).toBe(joined);
    }, 120_000);

    it('adds face for a talk heard by people below the speaker', async () => {
        const h = await game('a-talk-earned-face');
        const place = h.world.locations.find(l => l.kind === 'settlement' && l.thresholds.entry === 0)!;
        const pupil = createNpc(h.world.seed, { id: 'lecture-listener', name: 'Listener',
            bornOnDay: h.world.currentDay - 20 * 365, onDay: h.world.currentDay });
        pupil.locationId = place.id;
        pupil.cultivation.realmOrdinal = 3;
        h.world.npcs = [pupil];
        h.repos.cultivators.update(h.cultivator.id, { location: place.name, realmOrdinal: 12 });
        h.repos.cultivators.standIn(h.cultivator.id, theAreasOf(h.world, place).whereIs.get(pupil.id)!);
        h.game.theWorldMoved();
        const talk = await h.game.act('I give a dao lecture for one day');
        expect(talk.toolCalls.some(c => c.action === 'teach' && c.ok), said(talk)).toBe(true);
        expect(h.world.npcs.find(n => n.id === h.cultivator.id)!.face ?? 0).toBeGreaterThan(0);
    }, 120_000);

    it('enters a public board by name, records a placing, and never rerolls it on a look', async () => {
        const h = await game('public-board');
        const year = Math.floor(h.world.currentDay / 365);
        const host = h.world.factions.find(f => theDayItFallsIn(h.world.seed, f, year) !== null)!;
        const day = theDayItFallsIn(h.world.seed, host, year)!;
        const seat = h.world.locations.find(l => l.id === host.seatLocationId)!;
        h.world.currentDay = day;
        h.repos.cultivators.update(h.cultivator.id, { location: seat.name, realmOrdinal: 8 });
        h.game.theWorldMoved();
        const entered = await h.game.act('I enter the public competition');
        expect(entered.toolCalls.some(c => c.name === 'engine.enterAnOpenCompetition' && c.ok)).toBe(true);
        const entries = h.world.history.facts.filter(f => f.data.entry === true
            && f.actors.some(a => a.id === h.cultivator.id));
        expect(entries).toHaveLength(1);
        const results = () => h.world.history.facts.filter(f => f.data.openCompetition === true && f.data.result === true
            && f.actors.some(a => a.id === h.cultivator.id));
        expect(results()).toHaveLength(1);
        expect(results()[0]!.data, JSON.stringify({ player: h.world.npcs.find(n => n.id === h.cultivator.id), seat: seat.id }))
            .toEqual(expect.objectContaining({ place: expect.any(Number) }));
        expect(said(entered)).toContain(results()[0]!.summary);
        const board = JSON.stringify(results());
        await h.game.act('I look around');
        expect(JSON.stringify(results())).toBe(board);
    }, 120_000);

    it('accepts the person named, without creating a generic recruit, and writes reciprocal obligations', async () => {
        const h = await game('named-disciple');
        const place = h.world.locations.find(l => l.kind === 'settlement' && l.thresholds.entry === 0)!;
        const today = h.world.currentDay;
        const pupil = { ...createNpc(h.world.seed, { id: 'named-pupil', name: 'Qiu Fen',
            bornOnDay: today - 20 * 365, onDay: today }), locationId: place.id, activity: null };
        pupil.cultivation.realmOrdinal = 3;
        h.world.npcs = [pupil];
        h.repos.cultivators.update(h.cultivator.id, { location: place.name, realmOrdinal: 12 });
        h.repos.cultivators.standIn(h.cultivator.id, theAreasOf(h.world, place).whereIs.get(pupil.id)!);
        h.game.knowledge.learnIfNew({ holderId: h.cultivator.id, kind: 'cultivator', id: pupil.id,
            name: pupil.name, onDay: 0, sourceKind: 'witnessed', stage: 'encountered' });
        h.game.theWorldMoved();
        let accepted = false;
        let last = '';
        for (let attempt = 0; attempt < 40 && !accepted; attempt++) {
            const turn = await h.game.act(`I accept ${pupil.name} as my disciple`);
            last = said(turn);
            expect(turn.toolCalls.some(c => c.name === 'engine.acceptANamedDisciple'), said(turn)).toBe(true);
            accepted = turn.toolCalls.some(c => c.name === 'engine.acceptANamedDisciple' && c.ok);
        }
        expect(accepted, last).toBe(true);
        expect(h.world.npcs.filter(n => n.id !== h.cultivator.id)).toHaveLength(1);
        expect(h.world.npcs.find(n => n.id === pupil.id)!.relationships)
            .toEqual(expect.arrayContaining([expect.objectContaining({ targetId: h.cultivator.id, kind: 'master' })]));
        const obligations = h.db.prepare('SELECT holder_id, subject_id FROM obligations WHERE holder_id IN (?, ?)')
            .all(h.cultivator.id, pupil.id);
        expect(obligations).toEqual(expect.arrayContaining([
            expect.objectContaining({ holder_id: h.cultivator.id, subject_id: pupil.id }),
            expect.objectContaining({ holder_id: pupil.id, subject_id: h.cultivator.id })]));
        expect(h.repos.sects.getMembership(pupil.id)).toBeNull();
    }, 120_000);

    it('uses years since joining to expose a room that the rung alone does not reveal', async () => {
        const h = await game('hidden-room-tenure');
        const room = h.world.locations.find(l => Number(l.data.precinctIndex) > 0 && Number(l.data.obviousness) < 0.4
            && typeof l.data.factionId === 'string')!;
        expect(room).toBeDefined();
        const house = h.repos.sects.getById(String(room.data.factionId))!;
        const seat = h.world.locations.find(l => l.id === h.world.factions.find(f => f.id === house.id)!.seatLocationId)!;
        const joined = h.world.currentDay;
        h.repos.sects.addMember(house.id, h.cultivator.id, 0, joined);
        h.repos.cultivators.update(h.cultivator.id, { location: seat.name, realmOrdinal: 24 });
        const young = await h.game.act(`I go to ${room.name}`);
        expect(said(young)).toContain('Nobody has shown you anywhere called');
        expect(young.toolCalls.some(c => c.name === 'world.walkInsideTheWalls' && c.ok)).toBe(false);
        h.world.currentDay = joined + house.ranks.length * 3 * 365;
        h.game.theWorldMoved();
        const learned = await h.game.act(`I go to ${room.name}`);
        expect(said(learned)).not.toContain('Nobody has shown you anywhere called');
        expect(h.repos.sects.getMembership(h.cultivator.id)!.joinedOnDay).toBe(joined);
    }, 120_000);

    it('opens an unknown lamp death as an inquiry and a remains bounty, once', async () => {
        const h = await game('lamp-inquiry');
        const house = h.world.factions.find(f => [...whoHasALampBurningIn(h.world.objects, f.id)].length > 0)!;
        const id = [...whoHasALampBurningIn(h.world.objects, house.id)][0]!;
        const at = h.world.npcs.findIndex(n => n.id === id);
        const away = h.world.locations.find(l => l.kind === 'ruin' && l.parentId !== house.seatLocationId)!;
        h.world.npcs[at] = { ...h.world.npcs[at]!, status: 'physically_dead', diedOnDay: 0, locationId: away.id };
        h.world.history.facts = h.world.history.facts.filter(f => !f.actors.some(a => a.id === id));
        house.resources.spirit_stones = 100_000;
        h.game.theWorldMoved();
        await h.game.act('I look around');
        const inquiry = h.world.history.facts.find(f => f.data.lampInquiry === id)!;
        expect(inquiry).toBeDefined();
        expect(inquiry.data.causeUnknownToHouse).toBe(true);
        const paper = h.world.history.facts.find(f => f.kind === 'bounty_posted' && f.data.inquiryFactId === inquiry.id)!;
        expect(paper.data.priceOn).toBe(id);
        expect(paper.data.evidence).toContain('bones');
        expect(paper.actors.some(a => a.role === 'killer')).toBe(false);
        await h.game.act('I look around');
        expect(h.world.history.facts.filter(f => f.data.lampInquiry === id)).toHaveLength(1);
    }, 120_000);
});
