/** NPC contracts use ordinary consent, the same four bindings and the same oath
 * rows. No human answer is sampled. Compelled ordinary service uses real custody,
 * travel and a reached recipient; ending a slave through its seal is a named death. */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, upsertRelationship } from '../../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { offerOpenContract, breakOpenContract, openContractsThisYear, settleOpenContracts } from '../../../src/engine/world/people-agree-open-contracts.js';
import { bindingOf, contractPairOf } from '../../../src/engine/social/open-contracts.js';
import { layPersonSeal, endSlaveThroughSeal } from '../../../src/engine/world/person-seals.js';
import { commandSlave, settleSlaveOrders, unfinishedSlaveOrders } from '../../../src/engine/world/slave-orders.js';
import { resolveAttempt } from '../../../src/engine/social-leverage/an-attempt-to-move-somebody.js';
import { privatePartyOf } from '../../../src/engine/world/private-requests.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';

const realm = (key: string) => REALM_TIERS.find(tier => tier.key === key)!.ordinalStart;
function arranged(seed = 'native-open-service') {
    const world = createWorld({ seed, regionCount: 0, skipPriorAges: true });
    const home = makeLocation({ id: 'home', name: 'Home Court', kind: 'settlement' });
    const town = makeLocation({ id: 'town', name: 'River Town', kind: 'settlement' });
    linkLocations(home, town, 'road', 2);
    world.locations.push(home, town);
    const master = createNpc(seed, { id: 'master', name: 'Li Wei', onDay: 0, bornOnDay: -30 * 365,
        locationId: home.id, cultivation: { realmOrdinal: realm('nascent_soul') } });
    const servant = createNpc(seed, { id: 'servant', name: 'Mo Shan', onDay: 0, bornOnDay: -25 * 365,
        locationId: home.id, cultivation: { realmOrdinal: realm('foundation_establishment') } });
    const recipient = createNpc(seed, { id: 'recipient', name: 'Lin Hui', onDay: 0, bornOnDay: -20 * 365,
        locationId: town.id, cultivation: { realmOrdinal: realm('foundation_establishment') } });
    world.npcs.push(master, servant, recipient);
    return { world, home, town, master, servant, recipient };
}
describe('world people sign and serve', () => {
    it('offers every available binding at contact rates, with the proposer deciding before the other person answers', () => {
        const bindings = new Set<string>();
        for (let seed = 0; seed < 2048 && bindings.size < 4; seed++) {
            const a = arranged(`contract-opportunity-${seed}`);
            for (const person of [a.master, a.servant]) a.world.npcs[a.world.npcs.findIndex(row => row.id === person.id)] = upsertRelationship(person, { targetId: person.id === a.master.id ? a.servant.id : a.master.id,
                targetName: person.id === a.master.id ? a.servant.name : a.master.name, kind: 'ally', standing: 1,
                note: 'An existing close companion.', factIds: [], inheritedFromId: null }, 0);
            openContractsThisYear(a.world, 0, 0.5, new Set([a.master.id, a.servant.id]));
            for (const fact of a.world.history.facts.filter(fact => fact.data.openContractOffer === true))
                bindings.add(JSON.parse(String(fact.data.offer)).binding);
        }
        expect([...bindings].sort()).toEqual(['blood', 'dao', 'slave', 'word']);
    });
    it('does not end a life term while the same person survives without their original body', () => {
        const a = arranged();
        for (let seed = 0; !a.world.obligations.some(word => contractPairOf(word)) && seed < 32; seed++)
            offerOpenContract(a.world, a.master, a.servant, { binding: 'word', firstTerms: 'Protect them.',
                secondTerms: 'Serve.', end: { condition: 'Until the servant dies.', untilDeathOf: a.servant.id } }, seed, () => true);
        const words = a.world.obligations.filter(word => contractPairOf(word));
        expect(words).toHaveLength(2);
        a.world.npcs[a.world.npcs.findIndex(person => person.id === a.servant.id)] = { ...a.servant, status: 'soul_preserved' };
        settleOpenContracts(a.world, 40);
        expect(words.every(word => a.world.obligations.find(row => row.id === word.id)?.status === 'open')).toBe(true);
        a.world.npcs[a.world.npcs.findIndex(person => person.id === a.servant.id)] = { ...a.servant, status: 'physically_dead' };
        settleOpenContracts(a.world, 41);
        expect(words.every(word => a.world.obligations.find(row => row.id === word.id)?.status === 'settled')).toBe(true);
    });
    it('can accept or decline all four bindings without a separate contract store', () => {
        for (const binding of ['word', 'blood', 'dao', 'slave'] as const) {
            let yes = 0, no = 0;
            for (let seed = 0; seed < 32; seed++) {
                const a = arranged(`native-${binding}-${seed}`);
                const agreed = offerOpenContract(a.world, a.master, a.servant, { binding,
                    firstTerms: 'Provide resources and protection.', secondTerms: 'Serve until death.',
                    end: { condition: 'Until the servant dies.', untilDeathOf: a.servant.id }, boundId: a.servant.id }, 0, () => true);
                if (!agreed) { no++; continue; }
                yes++;
                const words = a.world.obligations.filter(word => contractPairOf(word));
                expect(words).toHaveLength(2);
                expect(words.every(word => bindingOf(word) === binding)).toBe(true);
                if (binding === 'slave') expect(a.world.npcs.find(person => person.id === a.servant.id)?.cultivation.seal?.kind).toBe('slave');
                const before = a.world.npcs.find(person => person.id === a.servant.id)!;
                expect(breakOpenContract(a.world, a.servant.id, words.find(word => word.holderId === a.servant.id)!.id, 1)).toBe(true);
                expect(a.world.obligations.some(word => word.cause === 'broken_oath' && word.subjectId === a.servant.id)).toBe(true);
                if (binding === 'slave') expect(a.world.npcs.find(person => person.id === a.servant.id)?.soulState).toBe('fragmented');
                if (binding === 'dao') {
                    const after = a.world.npcs.find(person => person.id === a.servant.id)!;
                    expect(after.cultivation.injuries.length > before.cultivation.injuries.length
                        || after.cultivation.hp !== before.cultivation.hp).toBe(true);
                }
            }
            expect(yes, binding).toBeGreaterThan(0);
            expect(no, binding).toBeGreaterThan(0);
        }
    });
    it('compels even an ordinary betrayal request, with no willingness roll or invented favour', () => {
        const a = arranged();
        layPersonSeal(a.world, a.master, a.servant, { kind: 'slave', day: 0, consentOrSubmission: true, note: 'service' });
        const result = resolveAttempt({ actor: privatePartyOf(a.world, a.master, 0),
            subject: privatePartyOf(a.world, a.world.npcs.find(person => person.id === a.servant.id)!, 0),
            ask: 'a_betrayal', onDay: 0, rng: forStream(a.world.seed, 'ordinary-command') });
        expect(result.outcome).toBe('taken');
        expect(result.odds).toBe(1);
        expect(result.marks.obligation).toBeNull();
        expect(result.marks.counterObligation).toBeNull();
    });
    it('fetches a real object and delivers it back before the order is complete', () => {
        const a = arranged();
        const object = makeObject({ id: 'parcel', name: 'A jade parcel', kind: 'material', ownerId: a.master.id,
            possessorId: null, locationId: a.town.id });
        a.world.objects.push(object);
        layPersonSeal(a.world, a.master, a.servant, { kind: 'slave', day: 0, consentOrSubmission: true, note: 'service' });
        const slave = a.world.npcs.find(person => person.id === a.servant.id)!;
        expect(commandSlave(a.world, a.master, slave, { action: 'fetch', destinationId: a.town.id,
            objectId: object.id, words: 'Fetch the jade parcel.' }, 0, true)).not.toBeNull();
        const outward = a.world.npcs.find(person => person.id === slave.id)?.activity?.untilDay!;
        expect(outward).toBeGreaterThan(0);
        settleSlaveOrders(a.world, outward);
        expect(object.possessorId).toBe(slave.id);
        expect(unfinishedSlaveOrders(a.world)).toHaveLength(1);
        const back = a.world.npcs.find(person => person.id === slave.id)?.activity?.untilDay!;
        expect(back).toBeGreaterThan(outward);
        settleSlaveOrders(a.world, back);
        expect(object.possessorId).toBe(a.master.id);
        expect(unfinishedSlaveOrders(a.world)).toHaveLength(0);
    });
    it('carries a message through the actual journey and can be killed by a Native holder', () => {
        const a = arranged();
        layPersonSeal(a.world, a.master, a.servant, { kind: 'slave', day: 0, consentOrSubmission: true, note: 'service' });
        const slave = a.world.npcs.find(person => person.id === a.servant.id)!;
        commandSlave(a.world, a.master, slave, { action: 'message', destinationId: a.town.id,
            targetId: a.recipient.id, words: 'The master asks you to come home.' }, 0, true);
        expect(a.world.memories.records.some(memory => memory.ownerId === a.recipient.id)).toBe(false);
        settleSlaveOrders(a.world, a.world.npcs.find(person => person.id === slave.id)!.activity!.untilDay!);
        expect(a.world.memories.records.some(memory => memory.ownerId === a.recipient.id && memory.summary === 'The master asks you to come home.')).toBe(true);
        expect(endSlaveThroughSeal(a.world, a.recipient, slave.id, 3)).toBe(false);
        expect(endSlaveThroughSeal(a.world, a.master, slave.id, 3)).toBe(true);
        expect(a.world.npcs.find(person => person.id === slave.id)?.status).toBe('physically_dead');
    });
});
