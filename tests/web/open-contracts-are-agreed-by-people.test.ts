/** The old swear verb records one person's word. An open agreement records
 * both literal promises only after both answers, without another contract table.
 * Native people can offer a human terms; silence is never consent. ADMIN's
 * existing landing control pins the positive decision while real reach and seal
 * gates remain live. Unknown ending prose is recorded, never asserted fulfilled. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../src/engine/world/locations.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { offerOpenContract } from '../../src/engine/world/people-agree-open-contracts.js';
import { actualPersonFor } from '../../src/web/the-actual-person-behind-a-world-row.js';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo.js';
import { contractPairOf, bindingOf, endingOf } from '../../src/engine/social/open-contracts.js';
import { withTheAttemptLanding } from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
import { REALM_TIERS, FOUNDATION_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { unfinishedSlaveOrders } from '../../src/engine/world/slave-orders.js';
import { theWholeSentenceAsAPlan } from '../../src/web/a-sentence-can-be-more-than-one-call.js';
import { parseIntent } from '../../src/web/verb-pattern-table.js';

let admin: string | undefined;
beforeEach(() => { admin = process.env.ADMIN_MODE; process.env.ADMIN_MODE = 'true'; });
afterEach(() => { if (admin === undefined) delete process.env.ADMIN_MODE; else process.env.ADMIN_MODE = admin; });
async function prepared() {
    const h = await makeGameInWorld({ seed: 'actual-open-terms', worldSeed: 'actual-open-terms-world' });
    const { cultivator } = await h.game.newRun('Pledger');
    const world = h.game.atHand!, day = routineTime(world);
    const home = makeLocation({ id: 'contract-court', name: 'Contract Court', kind: 'settlement' });
    const road = makeLocation({ id: 'contract-road', name: 'Open Road', kind: 'settlement' });
    linkLocations(home, road, 'road', 2);
    world.locations.push(home, road);
    const other = createNpc(world.seed, { id: 'contract-other', name: 'Li Wei', onDay: day,
        bornOnDay: day - 35 * 365, locationId: home.id,
        cultivation: { realmOrdinal: REALM_TIERS.find(tier => tier.key === 'core_formation')!.ordinalStart } });
    world.npcs.push(other);
    h.game.repos.cultivators.update(cultivator.id, { location: home.name, realmOrdinal: FOUNDATION_ORDINAL });
    h.game.repos.cultivators.standIn(cultivator.id, theAreasOf(world, home).whereIs.get(other.id)!);
    other.activity = { kind: 'talking', withIds: [cultivator.id], sinceDay: day, untilDay: day + 2,
        note: 'Talking over the terms.', standingIn: h.game.currentRun().cultivator.standingIn };
    h.game.theyGaveTheirName(h.game.currentRun().cultivator, h.game.currentRun().run, other);
    h.game.theWorldMoved();
    return { ...h, other, home };
}
describe('personal open contracts', () => {
    it('keeps promises as words without swallowing a distinct following act', async () => {
        const said = 'I offer a contract to Li Wei: I owe a beast from the board; they owe agreement to sing; ends when the third moon falls; binding word; then I look around';
        const plan = await theWholeSentenceAsAPlan(said, [], async clause => parseIntent(clause));
        expect(plan.steps.map(step => step.action.action)).toEqual(['oath', 'look']);
        expect(plan.steps[0].action.contract?.yourTerms).toBe('a beast from the board');
        expect(plan.steps[0].action.contract?.theirTerms).toBe('agreement to sing');
    });
    it('keeps two unrestricted promises and arbitrary ending words, with one SQL authority', async () => {
        const h = await prepared();
        const acted = await withTheAttemptLanding('oath', () => h.game.act(
            'I offer a contract to Li Wei: I owe a song at every eclipse; they owe the names of the northern mountains; ends when the third moon falls; binding word'));
        const words = ledgerAbout(h.db, h.game.currentRun().cultivator.id).filter(word => contractPairOf(word));
        expect(words, acted.result.narration).toHaveLength(2);
        expect(words.map(word => word.terms)).toContain('a song at every eclipse');
        expect(words.map(word => word.terms)).toContain('the names of the northern mountains');
        expect(words.every(word => bindingOf(word) === 'word')).toBe(true);
        expect(endingOf(words[0]).condition).toBe('the third moon falls');
        expect(h.game.atHand!.obligations.some(word => contractPairOf(word))).toBe(false);
    }, 60_000);
    it('a Native offer waits for the human answer, including refusal', async () => {
        const h = await prepared(), world = h.game.atHand!, body = h.game.currentRun().cultivator;
        expect(offerOpenContract(world, h.other, actualPersonFor(h.game, body.id)!, { binding: 'blood',
            firstTerms: 'Protect your family.', secondTerms: 'Keep my confidence.',
            end: { condition: 'Mutual release.' } }, routineTime(world), () => true)).toBe(false);
        h.game.theWorldMoved();
        const look = await h.game.act('look around');
        expect(look.narration).toContain('Do you agree?');
        expect(ledgerAbout(h.db, body.id).filter(word => contractPairOf(word))).toHaveLength(0);
        await h.game.act('I refuse the contract');
        expect(ledgerAbout(h.db, body.id).filter(word => contractPairOf(word))).toHaveLength(0);
        expect(world.history.facts.some(fact => fact.data.openContractReply && fact.data.agreed === false)).toBe(true);
    }, 60_000);
    it('the human can accept a slave service and the real SQL body obeys a Native master', async () => {
        const h = await prepared(), world = h.game.atHand!, body = h.game.currentRun().cultivator;
        offerOpenContract(world, h.other, actualPersonFor(h.game, body.id)!, { binding: 'slave',
            firstTerms: 'Protect you and provide cultivation resources.', secondTerms: 'Serve under the seal, beginning with a day guarding this court.',
            initialOrder: { action: 'guard', destinationId: h.home.id, words: 'Guard Contract Court for a day.', days: 1 },
            end: { condition: 'Until the servant dies.', untilDeathOf: body.id }, boundId: body.id }, routineTime(world), () => true);
        h.game.theWorldMoved();
        const accepted = await h.game.act('I accept the contract');
        expect(h.game.repos.cultivators.getById(body.id)?.qiSeal, accepted.narration).toMatchObject({ kind: 'slave', byId: h.other.id });
        expect(h.game.atHand!.npcs.find(person => person.id === body.id)?.cultivation.seal).toBeNull();
        expect(ledgerAbout(h.db, body.id).filter(word => contractPairOf(word))).toHaveLength(2);
        expect(unfinishedSlaveOrders(h.game.atHand!).some(fact => fact.data.slaveId === body.id)).toBe(true);
        const location = h.game.currentRun().cultivator.location;
        const defied = await h.game.act('I travel to Open Road');
        expect(h.game.currentRun().cultivator.location, defied.narration).toBe(location);
        expect(defied.narration).toContain('slave seal compels');
    }, 60_000);
});
