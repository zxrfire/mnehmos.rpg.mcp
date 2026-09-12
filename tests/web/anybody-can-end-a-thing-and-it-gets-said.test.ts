/**
 * Destruction is a world capability, not a player verb, and somebody says so.
 *
 * The design owner, on who the rule is for: *"it's ANYONE can destroy
 * (including me)."* So the primitive takes an ACTOR and the player's sentence
 * is one caller of it. This file holds that: the same function, an NPC on the
 * other end of it, somewhere no player has been, and the news still travels.
 *
 * WHAT WAS BROKEN BEFORE THIS. `ruin` has been the destruction primitive since
 * the possessions layer was written and it takes a `factId`. Its callers were:
 *
 *     combat-verbs.ts        a blade broken swinging it        factId: absent
 *     war-melee.ts           a blade broken in a war           factId: absent
 *     what-a-year-of-war...  a ward beaten down in a siege     factId: absent
 *     gatherings.ts          broken at a tournament            factId: absent
 *     estate-at-death.ts     what was on the body              factId: absent
 *     object-damage.ts x2    threaded through, never supplied
 *
 * Nothing ever appended a row to `state.history.facts`, which is the only table
 * `circulating` and `buildPlayerDigest` read. A thing being destroyed was, to
 * everybody who was not standing there, something that had not happened.
 *
 * THE TWO THINGS ASSERTED, and they are the two halves of the ruling:
 *
 *   the record    a tracked thing keeps its row, ruined, and the row carries
 *                 the id of the fact - so the wreck and the rumour are one
 *                 event seen from two ends.
 *   the telling   somebody with no part in it repeats the fact and NAMES what
 *                 was broken. `sentenceFor` composes a rumour out of the
 *                 fact's own columns and never out of the summary, which is
 *                 why `brokeWhat` is a column.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { aBreakingEntersTheWorld } from '../../src/engine/world/a-thing-somebody-ended-is-a-fact.js';
import { makeObject, isRuined } from '../../src/engine/world/possessions.js';
import { whatTheySay } from '../../src/engine/world/what-people-are-saying.js';
import { buildPlayerDigest, MARKET_MAGNITUDE } from '../../src/engine/world/digest.js';
import type { WorldState } from '../../src/engine/world/world-state.js';

const WORLD = 'anybody-can-end-a-thing';

/** Somebody the world already holds, standing tall enough to be worth repeating. */
function theTallestPersonAlive(world: WorldState) {
    return [...world.npcs]
        .filter(npc => npc.status === 'alive')
        .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal)[0];
}

async function aWorld() {
    const harness = await makeGameInWorld({ seed: 'anybody', worldSeed: WORLD });
    await harness.game.newRun('Bystander');
    return await harness.game.loadWorld();
}

describe('an NPC ending a thing is the same event as a player ending one', () => {
    it('files the fact and ruins the row, with nobody playing', async () => {
        const world = await aWorld();
        const breaker = theTallestPersonAlive(world);
        const blade = makeObject({
            id: 'obj-a-blade-somebody-broke',
            name: 'The Nine-Mile Rain',
            kind: 'artifact',
            significance: 'legendary',
            power: 40,
            possessorId: breaker.id,
            locationId: breaker.locationId
        });
        world.objects.push(blade);

        const gone = aBreakingEntersTheWorld(world, {
            actor: { id: breaker.id, name: breaker.name, role: 'broke it' },
            object: blade,
            day: Math.floor(world.currentDay),
            locationId: breaker.locationId,
            how: 'put through something it could not go through'
        });

        expect(gone).not.toBeNull();
        const row = world.objects.find(object => object.id === blade.id)!;
        expect(isRuined(row)).toBe(true);
        // The field nobody had ever supplied.
        expect(row.provenance[row.provenance.length - 1].factId).toBe(gone!.fact.id);
        expect(gone!.addressable).toBe(true);
    });

    it('is repeated by somebody with no part in it, who can name what broke', async () => {
        const world = await aWorld();
        const breaker = theTallestPersonAlive(world);
        const blade = makeObject({
            id: 'obj-a-blade-people-talk-about',
            name: 'The Nine-Mile Rain',
            kind: 'artifact',
            significance: 'legendary',
            power: 40,
            possessorId: breaker.id,
            locationId: breaker.locationId
        });
        world.objects.push(blade);

        const gone = aBreakingEntersTheWorld(world, {
            actor: { id: breaker.id, name: breaker.name, role: 'broke it' },
            object: blade,
            day: Math.floor(world.currentDay),
            locationId: breaker.locationId,
            how: 'put through something it could not go through'
        })!;

        // Somebody at the bottom of the ladder who was not there.
        const teller = [...world.npcs]
            .filter(npc => npc.status === 'alive' && npc.id !== breaker.id
                && !gone.fact.witnessIds.includes(npc.id))
            .sort((a, b) => a.cultivation.realmOrdinal - b.cultivation.realmOrdinal)[0];

        const said = whatTheySay(world, {
            id: teller.id,
            name: teller.name,
            realmOrdinal: teller.cultivation.realmOrdinal,
            regionId: null,
            factionId: teller.factionId ?? null
        }, world.currentDay);

        const about = said.filter(rumour => rumour.factId === gone.fact.id);
        expect(about.length).toBeGreaterThan(0);
        // NAMED, not "somebody did something". The whole of "it can be talked
        // about" is that the sentence contains the thing.
        expect(about.some(rumour => rumour.text.includes(blade.name))).toBe(true);
    });
});

describe('the grading does not care who did it', () => {
    it('carries a legendary ending to a stranger and keeps a mundane one local', async () => {
        const world = await aWorld();
        const breaker = theTallestPersonAlive(world);
        const day = Math.floor(world.currentDay);

        const loud = aBreakingEntersTheWorld(world, {
            actor: { id: breaker.id, name: breaker.name, role: 'broke it' },
            object: (() => {
                const row = makeObject({
                    id: 'obj-loud', name: 'The Nine-Mile Rain', kind: 'artifact',
                    significance: 'legendary', power: 40, possessorId: breaker.id,
                    locationId: breaker.locationId
                });
                world.objects.push(row);
                return row;
            })(),
            day,
            locationId: breaker.locationId,
            how: 'broken'
        })!;

        const quiet = aBreakingEntersTheWorld(world, {
            actor: { id: breaker.id, name: breaker.name, role: 'broke it' },
            counted: { itemId: 'pill-minor-healing', name: 'a cheap pill', significance: 'mundane' },
            day,
            locationId: breaker.locationId,
            how: 'ground under a heel'
        })!;

        expect(loud.fact.magnitude).toBeGreaterThanOrEqual(MARKET_MAGNITUDE);
        expect(quiet.fact.magnitude).toBeLessThan(MARKET_MAGNITUDE);
        // EARTH PEOPLE STILL GOSSIP. The small one is not secret and it is not
        // silent: it is in the record, the people there saw it, and it does not
        // travel.
        expect(quiet.fact.visibility).not.toBe('secret');
        expect(quiet.fact.witnessIds.length).toBeGreaterThan(0);
        expect(quiet.addressable).toBe(false);

        const stranger = {
            actorId: 'npc-nobody-at-all',
            locationId: 'nowhere-in-particular',
            visibleLocationIds: [] as string[],
            factionId: null,
            knowsFaction: () => false,
            knowsNpc: () => false,
            knowsPlace: () => false,
            confidantIds: [] as string[]
        };
        const digest = buildPlayerDigest(world.history.facts, stranger, 0, day + 1);
        expect(digest.lines.some(line => line.factId === loud.fact.id)).toBe(true);
        expect(digest.lines.some(line => line.factId === quiet.fact.id)).toBe(false);
    });
});
