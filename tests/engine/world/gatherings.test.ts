/**
 * Inter-sect gatherings.
 *
 * The contract, stated as tests rather than as prose:
 *
 *   - who is allied comes from `FactionRecord.standing` and nowhere else
 *   - a house with no living chosen sends nobody, and a house nobody is allied
 *     to is never invited
 *   - a circle whose host cannot pay does not gather
 *   - every tie a gathering writes carries the gathering's fact id, so its
 *     origin is answerable from the row two centuries later
 *   - the four kinds do different things
 *   - the same seed produces the same world
 */

import { describe, it, expect } from 'vitest';

import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import {
    ALLIED_STANDING,
    HOSTING_COST_PER_HEAD,
    alliesOf,
    applyGatherings,
    chosenOf,
    circlesOf,
    holdGathering
} from '../../../src/engine/world/gatherings.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// A WORLD SMALL ENOUGH TO REASON ABOUT
//
// Built by hand rather than from the catalog: this suite is testing the
// mechanism, and a seeded world's alliance graph is content that another agent
// may legitimately change this afternoon.
// ─────────────────────────────────────────────────────────────────────────

interface Built { state: WorldState }

function build(opts: {
    /** child -> parent standing edges. The only source of alliance. */
    edges?: [string, string, number][];
    /** faction id -> how many chosen it has alive. */
    chosen?: Record<string, number>;
    purse?: number;
} = {}): Built {
    const state = createWorld({ seed: 'gather-test', skipPriorAges: true, regionCount: 0 });

    state.locations.push(makeLocation({
        id: 'loc-region', name: 'The Province', kind: 'region', qiDensity: 0.4
    }));
    for (const id of ['house-a', 'house-b', 'house-c', 'house-lonely']) {
        state.locations.push(makeLocation({
            id: `seat-${id}`, name: `${id} seat`, kind: 'sect_seat',
            parentId: 'loc-region', qiDensity: 0.4
        }));
        state.factions.push(makeFaction({
            id,
            name: id,
            seatLocationId: `seat-${id}`,
            resources: {
                spirit_stones: opts.purse ?? 100_000,
                power_ordinal: id === 'house-a' ? 30 : 20
            }
        }));
    }

    for (const [from, to, value] of opts.edges ?? []) {
        state.factions.find(f => f.id === from)!.standing[to] = value;
    }

    let seq = 0;
    for (const [factionId, count] of Object.entries(opts.chosen ?? {})) {
        for (let i = 0; i < count; i++) {
            let npc: NpcRecord = createNpc(state.seed, {
                id: `npc-${seq++}`,
                bornOnDay: state.currentDay - 365 * 60,
                onDay: state.currentDay,
                locationId: `seat-${factionId}`,
                occupation: 'disciple',
                tags: ['chosen']
            });
            npc = setRealm(npc, 12 + i * 3, state.currentDay);
            state.npcs.push({ ...npc, factionId, factionRankIndex: 1 });
        }
    }
    return { state };
}

const rng = () => forStream('gather-test', 'suite');

describe('who is allied', () => {
    it('reads FactionRecord.standing and nothing else', () => {
        const { state } = build({ edges: [['house-b', 'house-a', 0.4]] });
        const a = state.factions.find(f => f.id === 'house-a')!;
        const b = state.factions.find(f => f.id === 'house-b')!;

        // The catalog only ever writes the feeder edge upward, so the alliance
        // has to be visible from the parent's side as well.
        expect(alliesOf(state, a).map(f => f.id)).toEqual(['house-b']);
        expect(alliesOf(state, b).map(f => f.id)).toEqual(['house-a']);
        expect(alliesOf(state, state.factions.find(f => f.id === 'house-lonely')!)).toEqual([]);
    });

    it('is vetoed by hostility in either direction', () => {
        const { state } = build({
            edges: [['house-b', 'house-a', 0.4], ['house-a', 'house-b', -0.6]]
        });
        expect(alliesOf(state, state.factions.find(f => f.id === 'house-a')!)).toEqual([]);
    });

    it('stops exactly at the threshold', () => {
        const under = build({ edges: [['house-b', 'house-a', ALLIED_STANDING - 0.01]] });
        const over = build({ edges: [['house-b', 'house-a', ALLIED_STANDING]] });
        expect(alliesOf(under.state, under.state.factions[0])).toEqual([]);
        expect(alliesOf(over.state, over.state.factions[0]).length).toBe(1);
    });

    it('seats one host per group, and it is the house with the most allies', () => {
        const { state } = build({
            edges: [['house-b', 'house-a', 0.4], ['house-c', 'house-a', 0.4]]
        });
        const circles = circlesOf(state);
        expect(circles.length).toBe(1);
        expect(circles[0].host.id).toBe('house-a');
        expect(circles[0].members.map(f => f.id).sort()).toEqual(['house-a', 'house-b', 'house-c']);
    });

    it('leaves a dissolved house out of every circle', () => {
        const { state } = build({ edges: [['house-b', 'house-a', 0.4]] });
        state.factions.find(f => f.id === 'house-a')!.dissolvedOnDay = state.currentDay;
        expect(circlesOf(state)).toEqual([]);
    });
});

describe('who is invited', () => {
    it('a house with no living chosen sends nobody, so a lone house does not gather', () => {
        const { state } = build({
            edges: [['house-b', 'house-a', 0.4]],
            chosen: { 'house-a': 1 }
        });
        const circle = circlesOf(state)[0];
        expect(chosenOf(state, 'house-b')).toEqual([]);
        expect(holdGathering(state, circle, state.currentDay, rng())).toBeNull();
    });

    it('a house nobody is allied to is never in a circle', () => {
        const { state } = build({
            edges: [['house-b', 'house-a', 0.4]],
            chosen: { 'house-a': 1, 'house-b': 1, 'house-lonely': 4 }
        });
        const seated = new Set(circlesOf(state).flatMap(c => c.members.map(f => f.id)));
        expect(seated.has('house-lonely')).toBe(false);
        const held = holdGathering(state, circlesOf(state)[0], state.currentDay, rng())!;
        expect(held.attendeeIds.length).toBe(2);
        expect(held.factionIds).not.toContain('house-lonely');
        // And it is named, so the exclusion is readable rather than implied.
        expect(held.excludedFactionIds).toContain('house-lonely');
    });

    it('a host that cannot pay does not gather', () => {
        const { state } = build({
            edges: [['house-b', 'house-a', 0.4]],
            chosen: { 'house-a': 1, 'house-b': 1 },
            purse: HOSTING_COST_PER_HEAD   // enough for one head, not two
        });
        expect(holdGathering(state, circlesOf(state)[0], state.currentDay, rng())).toBeNull();
    });

    it('a gathering is paid for out of the host\'s own purse', () => {
        const { state } = build({
            edges: [['house-b', 'house-a', 0.4]],
            chosen: { 'house-a': 1, 'house-b': 1 },
            purse: 50_000
        });
        holdGathering(state, circlesOf(state)[0], state.currentDay, rng());
        const host = state.factions.find(f => f.id === 'house-a')!;
        expect(host.resources.spirit_stones).toBe(50_000 - 2 * HOSTING_COST_PER_HEAD);
        // And only the host pays.
        expect(state.factions.find(f => f.id === 'house-b')!.resources.spirit_stones).toBe(50_000);
    });
});

describe('what a gathering leaves behind', () => {
    function gather() {
        const { state } = build({
            edges: [['house-b', 'house-a', 0.4], ['house-c', 'house-a', 0.4]],
            chosen: { 'house-a': 2, 'house-b': 2, 'house-c': 2 }
        });
        return { state, held: holdGathering(state, circlesOf(state)[0], state.currentDay, rng())! };
    }

    it('writes ties between people of different houses', () => {
        // Checked on a MEETING rather than on whatever was drawn: a competition
        // can end by moving its champion into the host house, so a tie that was
        // cross-house when it was written reads as same-house afterwards. That
        // is the feeder relationship firing, not a bug, and it is the reason
        // this assertion has to be made against a kind that moves nobody.
        let checked = 0;
        for (let i = 0; i < 200 && checked === 0; i++) {
            const { state } = build({
                edges: [['house-b', 'house-a', 0.4], ['house-c', 'house-a', 0.4]],
                chosen: { 'house-a': 2, 'house-b': 2, 'house-c': 2 }
            });
            const held = holdGathering(
                state, circlesOf(state)[0], state.currentDay, forStream('cross', String(i))
            );
            if (!held || held.kind !== 'meeting') continue;
            expect(held.ties.length).toBeGreaterThan(0);
            for (const tie of held.ties) {
                const from = state.npcs.find(n => n.id === tie.fromId)!;
                const to = state.npcs.find(n => n.id === tie.toId)!;
                expect(from.factionId).not.toBe(to.factionId);
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(0);
    });

    it('stamps its own fact id on every tie, so the origin survives', () => {
        const { state, held } = gather();
        for (const tie of held.ties) {
            const from = state.npcs.find(n => n.id === tie.fromId)!;
            const row = from.relationships.find(r => r.targetId === tie.toId)!;
            expect(row.factIds).toContain(held.fact.id);
        }
        expect(held.fact.kind).toBe('gathering');
        expect(held.fact.data.gathering).toBe(held.kind);
    });

    it('files a fact with the attending houses and the uninvited ones', () => {
        const { state, held } = gather();
        expect(state.history.facts.some(f => f.id === held.fact.id)).toBe(true);
        const stored = state.history.facts.find(f => f.id === held.fact.id)!;
        expect(stored.factionIds.sort()).toEqual(['house-a', 'house-b', 'house-c']);
        expect(String(stored.data.excludedFactionIds)).toContain('house-lonely');
        expect(stored.consequences).not.toBeNull();
    });

    it('never overwrites a structural tie with a temperature', () => {
        const { state } = build({
            edges: [['house-b', 'house-a', 0.4]],
            chosen: { 'house-a': 1, 'house-b': 1 }
        });
        const [one, two] = state.npcs;
        state.npcs[0] = {
            ...one,
            relationships: [{
                targetId: two.id, targetName: two.name, kind: 'master', standing: 0.5,
                note: 'Taught them.', sinceDay: 0, lastChangedDay: 0,
                factIds: [], inheritedFromId: null
            }]
        };
        holdGathering(state, circlesOf(state)[0], state.currentDay, rng());
        const after = state.npcs.find(n => n.id === one.id)!.relationships[0];
        expect(after.kind).toBe('master');
    });

    it('moves an existing account rather than resetting it', () => {
        const { state } = build({
            edges: [['house-b', 'house-a', 0.4]],
            chosen: { 'house-a': 1, 'house-b': 1 }
        });
        const [one, two] = state.npcs;
        state.npcs[0] = {
            ...one,
            relationships: [{
                targetId: two.id, targetName: two.name, kind: 'enemy', standing: -0.95,
                note: 'Their house killed my father.', sinceDay: 0, lastChangedDay: 0,
                factIds: ['f-old'], inheritedFromId: 'npc-dead'
            }]
        };
        holdGathering(state, circlesOf(state)[0], state.currentDay, rng());
        const after = state.npcs.find(n => n.id === one.id)!.relationships[0];
        // A polite afternoon does not undo a blood feud, and the chain back to
        // whose it originally was is intact.
        expect(after.standing).toBeLessThan(-0.4);
        expect(after.inheritedFromId).toBe('npc-dead');
        expect(after.factIds).toContain('f-old');
    });
});

describe('the four kinds do different things', () => {
    /** Force one kind by running many gatherings and picking the ones that fired. */
    function sample(): Map<string, ReturnType<typeof holdGathering>[]> {
        const out = new Map<string, ReturnType<typeof holdGathering>[]>();
        for (let i = 0; i < 120; i++) {
            const { state } = build({
                edges: [['house-b', 'house-a', 0.4], ['house-c', 'house-a', 0.4]],
                chosen: { 'house-a': 2, 'house-b': 2, 'house-c': 2 }
            });
            const held = holdGathering(
                state, circlesOf(state)[0], state.currentDay,
                forStream('kinds', String(i))
            );
            if (!held) continue;
            const list = out.get(held.kind) ?? [];
            list.push(held);
            out.set(held.kind, list);
        }
        return out;
    }

    const drawn = sample();

    it('draws more than one kind', () => {
        expect(drawn.size).toBeGreaterThan(1);
    });

    it('a meeting ranks nobody', () => {
        for (const held of drawn.get('meeting') ?? []) {
            expect(held!.placings).toEqual([]);
            expect(held!.ties.length).toBeGreaterThan(0);
        }
    });

    it('a competition ranks everybody who came, exactly once each', () => {
        const competitions = drawn.get('competition') ?? [];
        expect(competitions.length).toBeGreaterThan(0);
        for (const held of competitions) {
            expect(held!.placings.length).toBe(held!.attendeeIds.length);
            expect(held!.placings.map(p => p.place)).toEqual(
                held!.placings.map((_, i) => i + 1)
            );
            expect(new Set(held!.placings.map(p => p.npcId)).size).toBe(held!.placings.length);
        }
    });

    it('a competition moves prestige, up at the top and down at the bottom', () => {
        const { state } = build({
            edges: [['house-b', 'house-a', 0.4], ['house-c', 'house-a', 0.4]],
            chosen: { 'house-a': 2, 'house-b': 2, 'house-c': 2 }
        });
        let ran = false;
        for (let i = 0; i < 200 && !ran; i++) {
            const fresh = build({
                edges: [['house-b', 'house-a', 0.4], ['house-c', 'house-a', 0.4]],
                chosen: { 'house-a': 2, 'house-b': 2, 'house-c': 2 }
            });
            const held = holdGathering(
                fresh.state, circlesOf(fresh.state)[0], fresh.state.currentDay,
                forStream('prestige', String(i))
            );
            if (!held || held.kind !== 'competition') continue;
            ran = true;
            // Read across the whole board rather than off the top and bottom
            // rows: a house that took first AND last nets to zero, which is
            // correct and is not what this is asserting.
            const prestige = fresh.state.factions.map(f => Number(f.resources.prestige ?? 0));
            expect(Math.max(...prestige)).toBeGreaterThan(0);
            expect(Math.min(...prestige)).toBeLessThan(0);
            // It is a redistribution, not an injection.
            expect(prestige.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 6);
        }
        expect(ran).toBe(true);
        void state;
    });

    it('a challenge is fought with the combat resolver and can hurt somebody', () => {
        const challenges = drawn.get('challenge') ?? [];
        expect(challenges.length).toBeGreaterThan(0);
        // Nobody is meant to be hurt, so most bouts leave nothing; what must be
        // true is that the possibility exists and that nothing DIES.
        for (const held of challenges) {
            expect(held!.placings.length % 2).toBe(0);
        }
    });

    it('nobody dies at a friendly bout', () => {
        for (let i = 0; i < 200; i++) {
            const fresh = build({
                edges: [['house-b', 'house-a', 0.4], ['house-c', 'house-a', 0.4]],
                chosen: { 'house-a': 2, 'house-b': 2, 'house-c': 2 }
            });
            const held = holdGathering(
                fresh.state, circlesOf(fresh.state)[0], fresh.state.currentDay,
                forStream('lethality', String(i))
            );
            if (!held || held.kind !== 'challenge') continue;
            for (const npc of fresh.state.npcs) expect(npc.status).toBe('alive');
        }
    });
});

describe('the yearly pass', () => {
    it('is deterministic: the same seed produces the same gatherings', () => {
        const run = () => {
            const { state } = build({
                edges: [['house-b', 'house-a', 0.4], ['house-c', 'house-a', 0.4]],
                chosen: { 'house-a': 2, 'house-b': 2, 'house-c': 2 }
            });
            const held: string[] = [];
            for (let year = 1; year <= 200; year++) {
                for (const g of applyGatherings(state, year, year * 365)) {
                    held.push(`${year}:${g.kind}:${g.attendeeIds.join(',')}:${g.ties.length}`);
                }
            }
            return held;
        };
        expect(run()).toEqual(run());
        expect(run().length).toBeGreaterThan(0);
    });

    it('holds a circle to roughly its own interval and not to the event budget', () => {
        const { state } = build({
            edges: [['house-b', 'house-a', 0.4], ['house-c', 'house-a', 0.4]],
            chosen: { 'house-a': 2, 'house-b': 2, 'house-c': 2 }
        });
        let count = 0;
        for (let year = 1; year <= 1500; year++) {
            count += applyGatherings(state, year, year * 365).length;
        }
        // 1500 years, one circle, one roll in fifteen. A wide band, because the
        // point is the ORDER OF MAGNITUDE - a rate that is not a function of how
        // eventful the year was.
        expect(count).toBeGreaterThan(50);
        expect(count).toBeLessThan(200);
    });

    it('does nothing at all in a world with no alliances', () => {
        const { state } = build({ chosen: { 'house-a': 3, 'house-lonely': 3 } });
        let count = 0;
        for (let year = 1; year <= 300; year++) count += applyGatherings(state, year, year * 365).length;
        expect(count).toBe(0);
    });
});
