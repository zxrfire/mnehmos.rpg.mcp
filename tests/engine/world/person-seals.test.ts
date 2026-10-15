/** Slave seals are a second effect of the existing seal, not another power ladder.
 * The holder has one: successful replacement frees the prior slave, who remembers
 * compelled service. Force retains the qi seal's odds and fragments a freed slave's soul. */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, qiStandingOn } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';
import { whatLayingASealTakes, whatBreakingASealTakes } from '../../../src/engine/social/what-laying-a-qi-seal-takes.js';
import { holdsASlaveSeal, whatThisPersonCanDrawFrom } from '../../../src/engine/cultivation/a-qi-seal-is-put-on-a-person.js';
import { layPersonSeal, liftPersonSeal } from '../../../src/engine/world/person-seals.js';
import { commandSlave, settleSlaveOrders } from '../../../src/engine/world/slave-orders.js';

const realm = (key: string) => REALM_TIERS.find(tier => tier.key === key)!.ordinalStart;
function arranged() {
    const world = createWorld({ seed: 'person-seals', regionCount: 0, skipPriorAges: true });
    const home = makeLocation({ id: 'court', name: 'Seal Court', kind: 'settlement' });
    world.locations.push(home);
    const holder = createNpc(world.seed, { id: 'holder', name: 'Lin Wei', onDay: 0, bornOnDay: -30 * 365, locationId: home.id,
        cultivation: { realmOrdinal: realm('nascent_soul') } });
    const slave = createNpc(world.seed, { id: 'slave', name: 'Mo Shan', onDay: 0, bornOnDay: -25 * 365, locationId: home.id,
        cultivation: { realmOrdinal: realm('foundation_establishment'), qi: 10 } });
    const second = createNpc(world.seed, { id: 'second', name: 'Wu Heng', onDay: 0, bornOnDay: -20 * 365, locationId: home.id });
    world.npcs.push(holder, slave, second);
    return { world, home, holder, slave, second };
}
describe('one seal machinery, two effects', () => {
    it('holds a fractional-day service until its real end, then releases the post and keeps the account', () => {
        const a = arranged();
        const laid = layPersonSeal(a.world, a.holder, a.slave, { kind: 'slave', day: 2,
            consentOrSubmission: true, days: 0.5, note: 'half a day' });
        expect(laid.seal?.liftsOnDay).toBe(2.5);
        commandSlave(a.world, a.holder, a.world.npcs.find(person => person.id === a.slave.id)!, {
            action: 'guard', destinationId: a.home.id, words: 'keep this post' }, 2, true);
        expect(holdsASlaveSeal(a.world.npcs.find(person => person.id === a.slave.id)?.cultivation.seal ?? null, a.holder.id, 2.25)).toBe(true);
        settleSlaveOrders(a.world, 3);
        const freed = a.world.npcs.find(person => person.id === a.slave.id)!;
        expect(freed.cultivation.seal).toBeNull();
        expect(freed.activity).toBeNull();
        expect(a.world.obligations.some(word => word.holderId === a.slave.id && word.subjectId === a.holder.id)).toBe(true);
    });
    it('uses the same gap duration, refusing equal realms and missing consent', () => {
        const a = arranged();
        const base = { sealerOrdinal: a.holder.cultivation.realmOrdinal, sealerId: a.holder.id,
            subjectOrdinal: a.slave.cultivation.realmOrdinal, subjectIsThere: true, subjectAlreadySealed: false,
            onDay: 4, subjectMaxQi: 100, forDays: null, note: 'service' };
        const qi = whatLayingASealTakes(base);
        const slave = whatLayingASealTakes({ ...base, kind: 'slave', subjectConsentsOrSubmitted: true });
        expect(slave.seal?.liftsOnDay).toBe(qi.seal?.liftsOnDay);
        expect(slave.poolCutTo).toBeNull();
        expect(whatLayingASealTakes({ ...base, kind: 'slave' }).went).toBe(false);
        expect(whatLayingASealTakes({ ...base, kind: 'slave', subjectConsentsOrSubmitted: true,
            subjectOrdinal: base.sealerOrdinal }).went).toBe(false);
        expect(whatBreakingASealTakes({ how: 'force_of_arms', breakerOrdinal: base.sealerOrdinal,
            casterOrdinal: base.sealerOrdinal, isTheCaster: false }).odds).toBe(0);
    });
    it('leaves slave qi and drawing available, while qi seals retain their cap', () => {
        const a = arranged();
        expect(layPersonSeal(a.world, a.holder, a.slave, { kind: 'slave', day: 0, consentOrSubmission: true, note: 'service' }).went).toBe(true);
        const sealed = a.world.npcs.find(person => person.id === a.slave.id)!;
        expect(qiStandingOn(sealed, 0)).toBe(qiStandingOn(a.slave, 0));
        expect(whatThisPersonCanDrawFrom({ density: 1, seal: sealed.cultivation.seal, onDay: 0 })).toBe(1);
        expect(whatThisPersonCanDrawFrom({ density: 1, seal: { ...sealed.cultivation.seal!, kind: 'qi' }, onDay: 0 })).toBeLessThan(1);
    });
    it('compels a hostile person and releases them with their account on replacement', () => {
        const a = arranged();
        layPersonSeal(a.world, a.holder, a.slave, { kind: 'slave', day: 0, consentOrSubmission: true, note: 'service' });
        const sealed = a.world.npcs.find(person => person.id === a.slave.id)!;
        expect(commandSlave(a.world, a.holder, sealed, { action: 'guard', destinationId: a.home.id,
            words: 'guard the gate', days: 2 }, 0, true)).not.toBeNull();
        expect(a.world.npcs.find(person => person.id === a.slave.id)?.activity?.kind).toBe('stationed');
        expect(layPersonSeal(a.world, a.holder, a.second, { kind: 'slave', day: 1, consentOrSubmission: true, note: 'second' }).went).toBe(true);
        expect(a.world.npcs.find(person => person.id === a.slave.id)?.cultivation.seal).toBeNull();
        expect(a.world.obligations.some(word => word.holderId === a.slave.id && word.subjectId === a.holder.id && word.kind === 'grudge')).toBe(true);
        expect(a.world.npcs.filter(person => holdsASlaveSeal(person.cultivation.seal, a.holder.id, 1))).toHaveLength(1);
    });
    it('allows the caster to release, and a much stronger hand to break with ruin', () => {
        const a = arranged();
        layPersonSeal(a.world, a.holder, a.slave, { kind: 'slave', day: 0, consentOrSubmission: true, note: 'service' });
        expect(liftPersonSeal(a.world, a.second, a.slave.id, 1, 'force_of_arms')?.lifted).toBe(false);
        const rescuer = createNpc(a.world.seed, { id: 'rescuer', name: 'Fang Lei', onDay: 0, bornOnDay: -50 * 365,
            cultivation: { realmOrdinal: realm('body_integration') } });
        a.world.npcs.push(rescuer);
        expect(liftPersonSeal(a.world, rescuer, a.slave.id, 2, 'force_of_arms')?.lifted).toBe(true);
        expect(a.world.npcs.find(person => person.id === a.slave.id)?.soulState).toBe('fragmented');
        layPersonSeal(a.world, a.holder, a.second, { kind: 'slave', day: 2, consentOrSubmission: true, note: 'service' });
        expect(liftPersonSeal(a.world, a.holder, a.second.id, 3, 'the_hand_that_laid_it')?.lifted).toBe(true);
        expect(a.world.npcs.find(person => person.id === a.second.id)?.soulState).toBe('intact');
    });
});
