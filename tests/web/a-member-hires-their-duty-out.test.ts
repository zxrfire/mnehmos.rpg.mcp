/**
 * A price reader alone did not hire anybody: no worker spent days and no member
 * was held answerable. Arranged at a real mission post, played through the hire
 * sentence, the member pays once and stays on the house's ledger. The contractor
 * spends the remaining days, and completion pays the member only once. Death
 * before completion leaves the member's work unserved on its due day and pays
 * no contribution. An unseen death does not announce that failure early.
 * Two missions accepted on the same day once overwrote each other's oath;
 * each now stays open or settles according to its own contractor's term.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/actions';
import { createNpc } from '../../src/engine/world/npc-state';
import { ledgerAbout, writeOneObligation } from '../../src/storage/repos/obligation.repo';
import { acceptDuty, type DatabaseHandle } from '../../src/web/encounters';
import type { Duty } from '../../src/engine/encounters/types';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { hireForYourDuty, settleTheMissionPostTheyHold, theMissionPostOnTheSheet } from '../../src/web/holding-a-mission-post';
import { theFirstRungOf } from '../../src/engine/encounters/what-a-house-has-on-its-board';

async function atAPost() {
    const h = await makeGameInWorld({ seed: 'private-hire', worldSeed: 'private-hire' });
    const { cultivator, run } = await h.game.newRun('Member');
    const world = (await h.game.loadWorld())!;
    const house = world.factions.find(f => f.id === 'sect-azure-cloud-pavilion')!;
    const place = world.locations.find(p => p.id === house.seatLocationId)!;
    h.repos.sects.addMember(house.id, cultivator.id, 1);
    h.repos.cultivators.update(cultivator.id, { location: place.name });
    h.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: 1000 });
    const worker = { ...createNpc(world.seed, { id: 'npc-worker', name: 'Worker',
        bornOnDay: world.currentDay - 20 * 365, onDay: world.currentDay }),
        locationId: place.id, factionId: house.id, factionRankIndex: 1, activity: null };
    world.npcs = [worker];
    h.game.atHand = world;
    h.repos.cultivators.standIn(cultivator.id, theAreasOf(world, place).whereIs.get(worker.id)!);
    h.game.knowledge.learnIfNew({ holderId: cultivator.id, kind: 'cultivator', id: worker.id,
        name: worker.name, onDay: run.elapsedDays, sourceKind: 'witnessed', stage: 'encountered' });
    const duty: Duty = { origin: 'commission', posture: 'assigned', factionId: house.id,
        factionName: house.name, days: 20, dueOnDay: Math.floor(run.elapsedDays) + 20,
        contribution: 50, stones: 100, pitchOrdinal: 8, scale: 'local', cohort: 0, takingOut: [],
        access: { granted: false, note: '' }, spokenBy: null,
        refusal: { kind: 'grudge', cause: 'broken_oath', severity: 'serious', description: 'Unserved work.' } };
    const sworn = acceptDuty({ repos: h.repos, cultivator, duty, onDay: Math.floor(run.elapsedDays),
        entryId: 'first-post', what: 'Serve the post.' });
    const oath = writeOneObligation(h.db as unknown as DatabaseHandle, { ...sworn,
        tags: [...sworn.tags, `post-at:${place.id}`, 'post-pays:50:100', 'post-pitch:8', 'post-arrived'] });
    h.game.theWorldMoved();
    return { ...h, world, worker, oath, duty, run: h.game.currentRun().run, id: cultivator.id,
        person: () => h.repos.cultivators.getById(cultivator.id)! };
}

describe('a member hires their duty out', () => {
    it('routes explicit hiring, a mission held for hire, and a search report', () => {
        expect(parseIntent('I hire Worker to serve my post')).toMatchObject({ action: 'sect', intent: 'hire_duty', target: 'Worker' });
        expect(parseIntent('I take the pass watch to hire it out')).toMatchObject({ action: 'sect', intent: 'duty', topic: 'hire' });
        expect(parseIntent('I report Worker seen at Clear River Ferry')).toMatchObject({ action: 'sect', intent: 'report_missing', target: 'Worker', topic: 'Clear River Ferry' });
    });
    it('transfers the agreed price, spends no member days, and pays contribution only after completion', async () => {
        const h = await atAPost();
        const before = h.person().spiritStones;
        const days = h.game.state().run.elapsedDays;
        const merit = h.repos.sects.getMembership(h.id)!.contribution;
        const hired = await h.game.act('I hire Worker to serve my post');
        expect(hired.narration).toContain('takes over');
        expect(h.game.state().run.elapsedDays).toBe(days);
        expect(h.person().spiritStones).toBeLessThan(before);
        expect(h.repos.sects.getMembership(h.id)!.contribution).toBe(merit);
        expect(theMissionPostOnTheSheet(h.game, h.person(), true), 'a hire still occupies the member body').toBeNull();
        expect(theMissionPostOnTheSheet(h.game, h.person())).toContain('Hired out:');
        const contract = h.game.atHand!.obligations.find(r => r.tags.includes('hired-duty'))!;
        expect(contract.holderId).toBe(h.worker.id);
        expect(contract.subjectId).toBe(h.id);
        const world = h.game.atHand!;
        const elsewhere = world.locations.find(p => p.kind === 'settlement' && p.id !== h.worker.locationId)!;
        h.repos.cultivators.update(h.id, { location: elsewhere.name });
        expect(settleTheMissionPostTheyHold(h.game, h.person()), 'the member must still remain at the hired post').toBeNull();
        expect(world.npcs.find(n => n.id === h.worker.id)!.locationId).toBe(h.worker.locationId);
        world.currentDay = contract.dueOnDay!;
        h.db.prepare('UPDATE runs SET elapsed_days = ? WHERE id = ?').run(h.oath.dueOnDay, h.run.id);
        const served = settleTheMissionPostTheyHold(h.game, h.person());
        expect(served?.lines.join(' ')).toContain('Your post is served');
        expect(h.repos.sects.getMembership(h.id)!.contribution).toBe(merit + 50);
        const paid = h.person().spiritStones;
        expect(settleTheMissionPostTheyHold(h.game, h.person())).toBeNull();
        expect(h.person().spiritStones).toBe(paid);
    }, 120_000);
    it('holds a short chore for hiring instead of spending its days immediately', async () => {
        const h = await makeGameInWorld({ seed: 'chore-for-hire', worldSeed: 'chore-for-hire' });
        const { cultivator } = await h.game.newRun('Member');
        const world = (await h.game.loadWorld())!;
        const house = world.factions.find(f => f.id === 'sect-azure-cloud-pavilion')!;
        const place = world.locations.find(p => p.id === house.seatLocationId)!;
        h.game.atHand = world;
        h.repos.sects.addMember(house.id, cultivator.id, theFirstRungOf('outer', house.ranks.length)!);
        h.repos.cultivators.update(cultivator.id, { location: place.name, realmOrdinal: 1 });
        h.repos.cultivators.standIn(cultivator.id, theAreasOf(world, place).areas.find(a => a.for === 'board')!.id);
        const before = h.game.state().run.elapsedDays;
        const answer = await h.game.act('I take chores to hire it out');
        expect(answer.narration).toContain('You take up the post');
        expect(h.game.state().run.elapsedDays).toBe(before);
        expect(ledgerAbout(h.db as unknown as DatabaseHandle, cultivator.id)
            .some(r => r.kind === 'oath' && r.status === 'open' && r.tags.includes('duty'))).toBe(true);
    }, 120_000);
    it('settles a shorter hire while an older, longer hire is still being served', async () => {
        const h = await atAPost();
        hireForYourDuty(h.game, h.run, h.person(), h.worker.name);
        const coworker = createNpc(h.world.seed, { id: 'npc-coworker', name: 'Coworker',
            bornOnDay: h.world.currentDay - 20 * 365, onDay: h.world.currentDay,
            locationId: h.worker.locationId });
        h.world.npcs.push(coworker);
        const place = h.world.locations.find(p => p.id === coworker.locationId)!;
        h.repos.cultivators.standIn(h.id, theAreasOf(h.world, place).whereIs.get(coworker.id)!);
        h.game.knowledge.learnIfNew({ holderId: h.id, kind: 'cultivator', id: coworker.id,
            name: coworker.name, onDay: h.run.elapsedDays, sourceKind: 'witnessed', stage: 'encountered' });
        const sworn = acceptDuty({ repos: h.repos, cultivator: h.person(), onDay: Math.floor(h.run.elapsedDays),
            entryId: 'second-post', what: 'Serve another post.', duty: { ...h.duty, days: 5,
                dueOnDay: Math.floor(h.run.elapsedDays) + 5, contribution: 10, stones: 20, pitchOrdinal: 1 } });
        const second = writeOneObligation(h.db as unknown as DatabaseHandle, { ...sworn,
            tags: [...sworn.tags, `post-at:${place.id}`, 'post-pays:10:20', 'post-pitch:1', 'post-arrived'] });
        expect(hireForYourDuty(h.game, h.run, h.person(), coworker.name).outcome).toBe('executed');
        h.world.currentDay += 5;
        h.db.prepare('UPDATE runs SET elapsed_days = ? WHERE id = ?').run(second.dueOnDay, h.run.id);
        settleTheMissionPostTheyHold(h.game, h.person());
        const ledger = ledgerAbout(h.db as unknown as DatabaseHandle, h.id);
        expect(ledger.find(r => r.id === h.oath.id)?.status).toBe('open');
        expect(ledger.find(r => r.id === second.id)?.settlement?.resolution).toBe('oath_fulfilled');
        expect(h.repos.sects.getMembership(h.id)!.contribution).toBe(10);
    }, 120_000);
    it('writes a failed hire on the member and pays no contribution', async () => {
        const h = await atAPost();
        hireForYourDuty(h.game, h.run, h.person(), h.worker.name);
        const world = h.game.atHand!;
        world.npcs[0] = { ...world.npcs[0]!, status: 'physically_dead', diedOnDay: world.currentDay };
        expect(settleTheMissionPostTheyHold(h.game, h.person())).toBeNull();
        world.currentDay += h.oath.dueOnDay! - Math.floor(h.run.elapsedDays);
        h.db.prepare('UPDATE runs SET elapsed_days = ? WHERE id = ?').run(h.oath.dueOnDay, h.run.id);
        const failed = settleTheMissionPostTheyHold(h.game, h.person());
        expect(failed?.lines.join(' ')).toContain('records the failure against you');
        const ledger = ledgerAbout(h.db as unknown as DatabaseHandle, h.id);
        expect(ledger.find(r => r.id === h.oath.id)?.settlement?.resolution).toBe('broken');
        expect(ledger.some(r => r.kind === 'grudge' && r.holderId === h.oath.subjectId && r.subjectId === h.id)).toBe(true);
        expect(h.repos.sects.getMembership(h.id)!.contribution).toBe(0);
    }, 120_000);
});
