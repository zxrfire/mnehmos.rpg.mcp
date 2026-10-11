/**
 * The proxy reader minted full qi and discarded cooldowns on every read. The
 * actual cast writer looked only for NPC bodies, so a presence's numeric receipt
 * spent nothing. These controls resolve ordinary native rounds for a world
 * person's presence and the SQL player's presence. Their own spent resource
 * must persist without charging the maker's body or refilling it on a read.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, PLAYER_ROW_TAG } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { sendAProxy, proxyCombatant, whereYouCanActFrom } from '../../../src/engine/world/something-acting-in-your-place.js';
import { combatantOf } from '../../../src/engine/world/gatherings.js';
import { writeTheNpcArtsActuallyUsed } from '../../../src/engine/world/the-arts-an-npc-actually-uses-in-a-fight.js';
import { assessPower, resolveConfrontationRound, type RoundParty } from '../../../src/engine/cultivation/combat.js';
import { NASCENT_SOUL_ORDINAL } from '../../../src/engine/cultivation/existence.js';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';

function fixture(player = false) {
    const world = createWorld({ seed: 'a-presence-spends-its-actual-art', regionCount: 0, skipPriorAges: true });
    world.currentDay = 1000;
    world.currentHour = 0;
    const place = makeLocation({ id: 'actual-presence-ground', name: 'A practice ground', kind: 'wilds' });
    world.locations.push(place);
    const art = TECHNIQUES.find(row => row.category === 'attack' && row.qiCost > 0
        && row.cooldown > 0 && row.requiredOrdinal < NASCENT_SOUL_ORDINAL);
    if (!art) throw Error('The catalog has no eligible combat art.');
    const body = (id: string, ordinal: number, arts: string[]) => createNpc(world.seed, {
        id, name: id, bornOnDay: -30 * 365, onDay: world.currentDay, locationId: place.id,
        cultivation: { realmOrdinal: ordinal, spiritRoot: 'single_fire',
            attributes: { might: 2, insight: 2, fortune: 1, charm: 2 }, techniqueIds: arts }
    });
    const maker = body('maker', NASCENT_SOUL_ORDINAL + 20, [art.id]);
    if (player) maker.tags.push(PLAYER_ROW_TAG);
    const target = body('target', maker.cultivation.realmOrdinal - 1, []);
    world.npcs.push(maker, target);
    const sent = sendAProxy(world, maker, 'soul', place.id);
    if (!sent.proxy) throw Error(sent.line);
    return { world, maker, target, proxy: sent.proxy, art };
}

function round(h: ReturnType<typeof fixture>) {
    const input = proxyCombatant(h.world, h.proxy)!;
    const against = combatantOf(h.target, h.world);
    const side = (body: typeof input, act: RoundParty['act']): RoundParty => ({
        input: body, power: assessPower(body, { ambient: 'normal' }), act, edges: [], vector: 'body'
    });
    return resolveConfrontationRound(side(input, 'strike'), side(against, 'guard'),
        { [input.id]: input.hp, [against.id]: against.hp }, { [input.id]: [], [against.id]: [] },
        { rng: forStream(h.world.seed, 'actual-presence-cast'), ambient: 'normal', turn: 1,
            opening: false, fromConcealment: false, willWithdraw: false });
}

for (const player of [false, true]) {
    it(`a ${player ? 'player' : 'world person'} presence spends a real cast once without charging its maker`, () => {
        const h = fixture(player), before = structuredClone(h.world);
        const input = proxyCombatant(h.world, h.proxy)!;
        expect(input.technique?.id).toBe(h.art.id);
        expect(h.world).toEqual(before);
        const exchanges = round(h).exchanges.map((exchange, index) => ({ ...exchange, index }));
        expect(exchanges.some(exchange => exchange.attackerId === h.proxy.id
            && exchange.artUse?.techniqueId === h.art.id)).toBe(true);
        expect(h.world).toEqual(before);
        writeTheNpcArtsActuallyUsed(h.world, exchanges, 'actual-presence-round', h.world.currentDay);
        expect(proxyCombatant(h.world, h.proxy)!.qi).toBe(input.qi - h.art.qiCost);
        expect(proxyCombatant(h.world, h.proxy)!.techniqueCooldowns?.[h.art.id]).toBe(h.art.cooldown);
        expect(proxyCombatant(h.world, h.proxy)!.technique).toBeNull();
        expect(h.maker).toEqual(before.npcs[0]);
        const saved = structuredClone(h.world);
        const restored = structuredClone(saved);
        writeTheNpcArtsActuallyUsed(restored, exchanges, 'actual-presence-round', restored.currentDay);
        expect(restored).toEqual(saved);
    });
}

it('elapsed cooldown restores readiness without restoring spent qi', () => {
    const h = fixture(), input = proxyCombatant(h.world, h.proxy)!;
    const exchanges = round(h).exchanges.map((exchange, index) => ({ ...exchange, index }));
    expect(exchanges.some(exchange => exchange.artUse)).toBe(true);
    writeTheNpcArtsActuallyUsed(h.world, exchanges, 'actual-presence-cooldown', h.world.currentDay);
    h.world.currentHour = 3;
    expect(proxyCombatant(h.world,h.proxy)!.techniqueCooldowns?.[h.art.id]).toBe(h.art.cooldown);
    h.world.currentDay += h.art.cooldown;
    const cooled = proxyCombatant(h.world, h.proxy)!;
    expect(cooled.qi).toBe(input.qi - h.art.qiCost);
    expect(cooled.techniqueCooldowns?.[h.art.id]).toBe(0);
    expect(cooled.technique?.id).toBe(h.art.id);
});

it('an exhausted presence retains zero and can still strike without an art', () => {
    const h = fixture();
    h.proxy.data.qi = 0;
    const before = structuredClone(h.world), input = proxyCombatant(h.world, h.proxy)!;
    expect(input.qi).toBe(0);
    expect(input.technique).toBeNull();
    const physical = round(h);
    expect(physical.exchanges.length).toBeGreaterThan(0);
    expect(physical.exchanges.some(exchange => exchange.artUse)).toBe(false);
    expect(h.world).toEqual(before);
});

it('the player and a world person sustain the same presence for the same native span', () => {
    const npc = fixture(), player = fixture(true);
    expect(player.proxy.data.lapsesOnDay).toBe(npc.proxy.data.lapsesOnDay);
    expect(player.proxy.data.qi).toBe(npc.proxy.data.qi);
    for (const h of [npc, player]) {
        const lapses = Number(h.proxy.data.lapsesOnDay);
        expect(whereYouCanActFrom(h.world,h.maker.id,lapses - 0.01)?.id).toBe(h.proxy.id);
        expect(whereYouCanActFrom(h.world,h.maker.id,lapses)).toBeNull();
        h.world.currentDay = lapses;
        const before = structuredClone(h.world);
        const requested = sendAProxy(h.world,h.maker,'soul',h.target.locationId!,
            lapses - Number(h.proxy.data.madeOnDay) + 1);
        expect(requested.proxy).toBeNull();
        expect(h.world).toEqual(before);
    }
});

it('a body-only art above the presence rung is not borrowed by its lower body', () => {
    const h = fixture();
    const art = TECHNIQUES.find(row => row.category === 'attack'
        && row.requiredOrdinal >= NASCENT_SOUL_ORDINAL && row.qiCost > 0);
    if (!art) throw Error('The catalog has no higher combat art.');
    h.maker.cultivation.realmOrdinal = art.requiredOrdinal;
    h.maker.cultivation.techniqueIds = [art.id];
    h.proxy.power = art.requiredOrdinal - 1;
    expect(proxyCombatant(h.world,h.proxy)!.technique).toBeNull();
});
