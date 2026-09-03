/**
 * What a confrontation does to somebody the world holds.
 *
 * The contract, stated as tests:
 *
 *   - the wounds the resolver produced land on the record as ROWS, through the
 *     world's one write path, so the count cannot drift from the list
 *   - a permanent wound gets its day in the ledger; an ordinary one does not
 *   - no hit points are invented anywhere on the record
 *   - losing opens a rival; being finished or maimed opens an enemy
 *   - `finished` against the loser is the whole death gate, and a bout that
 *     empties somebody without meaning to leaves them alive
 *   - a death goes through the world's own settlement: heirs, inherited goals,
 *     and an account the heir now holds against the killer
 *   - somebody the world does not hold, or no longer holds acting, is untouched
 *   - and a death hands back the LEDGER ROWS it opens, which is what makes a
 *     war death and a killing in a square the same event
 */

import { describe, it, expect } from 'vitest';

import { createWorld } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import {
    addGoal,
    createNpc,
    markDead,
    relationshipWith,
    type NpcRecord
} from '../../../src/engine/world/npc-state.js';
import { addLineageEdge, createLineageRecord } from '../../../src/engine/world/lineage.js';
import { createInjury } from '../../../src/engine/cultivation/injuries.js';
import { maxHpForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { whatTheConfrontationDidToThem } from '../../../src/engine/world/what-a-confrontation-does-to-somebody-the-world-holds.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import type { Injury } from '../../../src/schema/cultivation.js';

const DAY = 4_000;

function build(): { state: WorldState; them: NpcRecord } {
    const state = createWorld({ seed: 'fight-world', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({
        id: 'loc-square', name: 'The Square', kind: 'settlement', qiDensity: 0.4
    }));

    const them = createNpc(state.seed, {
        id: 'npc-95',
        name: 'Ren Shu',
        bornOnDay: DAY - 30 * 365,
        onDay: DAY,
        locationId: 'loc-square',
        factionId: 'house-a',
        factionRankIndex: 1,
        cultivation: { realmOrdinal: 6 }
    });
    state.npcs.push(them);
    return { state, them };
}

/** A wound the resolver would actually have produced. */
function wound(severity: Injury['severity'], woundType: string | null = null): Injury {
    return createInjury(
        { severity, source: 'combat', turn: 3, woundType },
        forStream('fight-world', 'wound', severity, woundType ?? 'plain')
    );
}

function fought(state: WorldState, over: {
    wounds?: Injury[];
    outcome?: string;
    lost?: boolean;
    finished?: boolean;
    npcId?: string;
    terms?: 'open' | 'agreed';
    witnesses?: number;
    knownTo?: readonly string[];
} = {}) {
    return whatTheConfrontationDidToThem(state, {
        npcId: over.npcId ?? 'npc-95',
        byId: 'cult-player',
        byName: 'Yun Qi',
        day: DAY,
        wounds: over.wounds ?? [],
        outcome: (over.outcome ?? 'decisive_victory') as never,
        lost: over.lost ?? true,
        finished: over.finished ?? false,
        ...(over.terms ? { terms: over.terms } : {}),
        ...(over.witnesses === undefined ? {} : { witnesses: over.witnesses }),
        ...(over.knownTo === undefined ? {} : { knownTo: over.knownTo })
    });
}

describe('the body', () => {
    it('puts the resolver\'s wounds on the record as rows, not as a count', () => {
        const { state } = build();
        const taken = [wound('serious'), wound('minor')];

        const did = fought(state, { wounds: taken });

        expect(did.wrote).toBe(true);
        expect(did.wounds).toBe(2);

        const after = state.npcs[0];
        expect(after.cultivation.injuries.map(i => i.id).sort())
            .toEqual(taken.map(i => i.id).sort());
        // The count is derived at the write, so it cannot disagree with the list.
        expect(after.cultivation.untreatedInjuries).toBe(2);
    });

    it('leaves an unmarked body as it was, and that is not a lost write', () => {
        const { state } = build();
        const before = JSON.stringify(state.npcs[0].cultivation);

        const did = fought(state, { wounds: [], outcome: 'withdrawal' });

        expect(did.wrote).toBe(true);
        expect(did.wounds).toBe(0);
        expect(JSON.stringify(state.npcs[0].cultivation)).toBe(before);
    });

    /**
     * The claim narrowed, and it narrowed because the world grew a body.
     *
     * This used to assert that the string `"hp"` appeared nowhere on the record
     * at all, on the ruling that the world layer stores no hit points and this
     * module must not be the one to invent them. Half of that has changed and
     * half has not, so the assertion has to say which half.
     *
     * WHAT CHANGED: `NpcCultivation.hp` exists, because a crossing costs the
     * body and there was nothing on an NPC for the toll to come out of - so it
     * bound the player and nobody else. It is not an invention of a second body
     * model either: the POOL is not stored, it is derived from Might and the
     * rung through `maxHpForOrdinal`, which is why there is still no `maxHp`
     * anywhere on the row and why this file can still assert that.
     *
     * WHAT DID NOT: a confrontation still writes no body. What a fight leaves
     * that the world can hold is WOUNDS, and the two tests above are that. If
     * that ever changes it is a separate design decision with its own
     * measurement, because a world where every bout permanently depletes
     * everybody who fought is a different world.
     */
    it('writes wounds and not the body, and stores no second pool', () => {
        const { state } = build();
        const before = state.npcs[0].cultivation.hp;

        fought(state, { wounds: [wound('crippling')], finished: false, outcome: 'crippled' });

        const after = state.npcs[0];
        expect(after.cultivation.hp).toBe(before);
        // The pool is derived, never stored. A `maxHp` on the row would be a
        // cache that can disagree with the ordinal sitting next to it.
        expect(JSON.stringify(after)).not.toMatch(/"maxHp"/);
        expect(after.cultivation.hp)
            .toBe(maxHpForOrdinal(after.cultivation.attributes.might, after.cultivation.realmOrdinal));
    });

    it('gives a permanent wound its day in the ledger and an ordinary one none', () => {
        const { state } = build();
        const before = state.history.facts.length;

        fought(state, { wounds: [wound('minor')] });
        expect(state.history.facts.length).toBe(before);

        // `severed-meridian` is an authored, permanent row in the wound catalog.
        const did = fought(state, { wounds: [wound('crippling', 'severed-meridian')] });
        expect(did.facts.some(f => f.kind === 'injury')).toBe(true);
        expect(state.history.facts.length).toBeGreaterThan(before);
    });
});

describe('the account', () => {
    it('opens a rival for an ordinary loss and not an enmity', () => {
        const { state } = build();
        fought(state, { outcome: 'withdrawal' });

        const tie = relationshipWith(state.npcs[0], 'cult-player');
        expect(tie?.kind).toBe('rival');
        expect(tie?.standing).toBeGreaterThan(-0.4);
    });

    it('opens an enemy where the bout went further than the fight called for', () => {
        const { state } = build();
        fought(state, { outcome: 'crippled', wounds: [wound('crippling')] });

        const tie = relationshipWith(state.npcs[0], 'cult-player');
        expect(tie?.kind).toBe('enemy');
        expect(tie?.standing).toBeLessThan(-0.4);
    });

    it('writes nothing about somebody who won', () => {
        const { state } = build();
        fought(state, { lost: false, outcome: 'withdrawal' });

        expect(relationshipWith(state.npcs[0], 'cult-player')).toBeNull();
    });
});

describe('the death gate', () => {
    it('leaves somebody beaten where the fight was not gone there to finish', () => {
        const { state } = build();
        const did = fought(state, {
            finished: false, outcome: 'crippled', wounds: [wound('crippling')]
        });

        expect(did.died).toBe(false);
        expect(state.npcs[0].status).toBe('alive');
    });

    it('kills where the resolver says the finishing requirement was met', () => {
        const { state } = build();
        const did = fought(state, { finished: true, outcome: 'lethal' });

        expect(did.died).toBe(true);
        expect(state.npcs[0].status).toBe('physically_dead');
        expect(state.npcs[0].diedOnDay).toBe(DAY);
        expect(state.npcs[0].endNote).toContain('Yun Qi');
        expect(did.facts.some(f => f.kind === 'death')).toBe(true);
    });

    it('leaves the account open on the dead, so the heir inherits it', () => {
        const { state, them } = build();

        // Somebody to inherit. The lineage edge is what makes a death a handoff.
        const heir = createNpc(state.seed, {
            id: 'npc-96',
            name: 'Ren Yao',
            bornOnDay: DAY - 18 * 365,
            onDay: DAY,
            locationId: 'loc-square',
            cultivation: { realmOrdinal: 2 }
        });
        state.npcs.push(heir);
        state.lineages.push(addLineageEdge(createLineageRecord({
            id: 'lin-ren',
            surname: 'Ren',
            founderId: them.id,
            foundedOnDay: them.identity.bornOnDay
        }), {
            parentId: them.id,
            childId: heir.id,
            relation: 'descendant',
            onDay: heir.identity.bornOnDay
        }));
        state.npcs[0] = addGoal(state.npcs[0], {
            kind: 'revenge',
            text: 'Find out who took the eastern shelf.',
            priority: 0.9
        }, DAY - 100);

        const did = fought(state, { finished: true, outcome: 'lethal' });

        expect(did.died).toBe(true);
        expect(did.handoff?.primaryHeirId).toBe('npc-96');
        expect(did.handoff?.goalsInherited.length).toBeGreaterThan(0);

        // The dead keep their account. It is what the heir takes.
        expect(relationshipWith(state.npcs[0], 'cult-player')?.standing).toBe(-1);
        const inherited = relationshipWith(state.npcs[1], 'cult-player');
        expect(inherited).not.toBeNull();
        expect(inherited?.inheritedFromId).toBe('npc-95');
    });
});

describe('somebody the world cannot answer for', () => {
    it('writes nothing for an id the world does not hold', () => {
        const { state } = build();
        const did = fought(state, { npcId: 'npc-nobody', finished: true });

        expect(did.wrote).toBe(false);
        expect(state.npcs[0].status).toBe('alive');
    });

    it('writes nothing to somebody already dead, whatever the resolver was told', () => {
        const { state } = build();
        state.npcs[0] = markDead(state.npcs[0], DAY - 10, 'Died of something else.');

        const did = fought(state, { finished: true, wounds: [wound('serious')] });

        expect(did.wrote).toBe(false);
        expect(state.npcs[0].endNote).toBe('Died of something else.');
        expect(state.npcs[0].cultivation.untreatedInjuries).toBe(0);
    });
});

/**
 * A war death is a grudge, by the same code a killing in a square is.
 *
 * The design owner, on the two leaving different things:
 *
 *   > this is bespoke. a war death is still a grudge. fix it.
 *
 * The defect he named is worth keeping in front of whoever reads this: the two
 * callers each ASSEMBLED the ledger rows themselves, so only the one somebody
 * had got round to writing had any. `war-melee.ts` never did, and a world could
 * fight for five hundred years without one of its dead reaching the ledger -
 * so the world was full of killers no record knew about, and the alignment
 * reading over that ledger was measuring the player alone.
 *
 * Both paths now come through this function for the rows, so a war and a square
 * are one event to every line below it.
 */
/** The victim, with somebody to leave it to and a house that would care. */
function withPeople(): { state: WorldState; them: NpcRecord } {
    const { state, them } = build();
    state.factions.push({
        id: 'house-a',
        name: 'The Eastern Shelf',
        alignment: 'righteous'
    } as unknown as WorldState['factions'][number]);
    const heir = createNpc(state.seed, {
        id: 'npc-96',
        name: 'Ren Yao',
        bornOnDay: DAY - 18 * 365,
        onDay: DAY,
        locationId: 'loc-square',
        cultivation: { realmOrdinal: 2 }
    });
    state.npcs.push(heir);
    state.lineages.push(addLineageEdge(createLineageRecord({
        id: 'lin-ren',
        surname: 'Ren',
        founderId: them.id,
        foundedOnDay: them.identity.bornOnDay
    }), {
        parentId: them.id,
        childId: heir.id,
        relation: 'descendant',
        onDay: heir.identity.bornOnDay
    }));
    return { state, them };
}

describe('the accounts it hands back', () => {
    it('opens one against whoever did it, held by the dead one\'s house', () => {
        const { state } = withPeople();
        const did = fought(state, { outcome: 'lethal', finished: true, witnesses: 6 });

        expect(did.died).toBe(true);
        expect(did.opens.length).toBeGreaterThan(0);
        for (const row of did.opens) {
            expect(row.subjectId).toBe('cult-player');
            expect(row.cause).toBe('killed_kin');
            // Findable as what it was rather than as a fight.
            expect(row.tags).toContain('bout');
        }
        expect(did.opens.some(row => row.holderId === 'house-a')).toBe(true);
    });

    /**
     * The severity rules do not care whether it happened in a war, which is
     * exactly the point - if they did, this would be the bespoke thing again.
     * A war is `open` because nobody promised anybody anything, and an open
     * killing is one band under a killing after a given word.
     */
    it('prices a war the way it prices any fight nobody arranged', () => {
        const open = fought(withPeople().state, {
            outcome: 'lethal', finished: true, terms: 'open'
        });
        const agreed = fought(withPeople().state, {
            outcome: 'lethal', finished: true, terms: 'agreed'
        });

        expect(open.opens[0]!.severity).toBe('grave');
        expect(open.opens[0]!.kind).toBe('grudge');
        expect(agreed.opens[0]!.severity).toBe('unforgivable');
        // A killing after a promise runs between LINES, and the ledger keeps
        // that as its own kind rather than as a heavier grudge.
        expect(agreed.opens[0]!.kind).toBe('blood_feud');
    });

    /** `open` unless somebody says otherwise, which is what a war passes. */
    it('defaults to nobody having arranged anything', () => {
        const did = fought(withPeople().state, { outcome: 'lethal', finished: true });
        expect(did.opens[0]!.tags).toContain('open');
    });

    /**
     * One death is one deed however many people end up holding a record of it.
     * The alignment reading collapses rows onto this field, so a victim's
     * family size must not price the killer's character.
     */
    it('stamps every row with the one event behind it', () => {
        const { state } = withPeople();
        const did = fought(state, { outcome: 'lethal', finished: true });
        expect(did.opens.length).toBeGreaterThan(1);
        const events = new Set(did.opens.map(row => row.triggeringEventId));
        expect(events.size).toBe(1);
        expect([...events][0]).toBe(did.facts.find(f => f.kind === 'death')?.id);
    });

    it('opens nothing for somebody who walked away, or for the winner', () => {
        expect(fought(withPeople().state, { outcome: 'withdrawal' }).opens).toEqual([]);
        expect(fought(withPeople().state, {
            outcome: 'lethal', finished: true, lost: false
        }).opens).toEqual([]);
    });

    /**
     * The seam for AGENTS.md's *a fact reaches a person, and reaching them is
     * an event*. Nobody who can be told is nobody who holds anything - and the
     * death is still in the world, still true, still findable the day somebody
     * works it out.
     */
    it('opens nothing for a party nobody has told', () => {
        const did = fought(withPeople().state, {
            outcome: 'lethal', finished: true, knownTo: ['somebody-who-was-not-there']
        });
        expect(did.died).toBe(true);
        expect(did.facts.some(f => f.kind === 'death')).toBe(true);
        expect(did.opens).toEqual([]);
    });
});
