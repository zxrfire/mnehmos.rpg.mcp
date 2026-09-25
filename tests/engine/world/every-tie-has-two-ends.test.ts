/**
 * Every relationship runs both ways.
 *
 * The design owner's standing rule. Measured before the writers were fixed, on
 * one pinned world: 154 of 978 ties had nobody at the other end at world open,
 * and 2,919 of 18,561 after forty years. The sources were single-ended writers
 * (a grudge, a passing-over, an inherited account, the people at the top of a
 * house), a crossing that severed a bond on one side only, and a departure that
 * wrote a stale copy of the leaver back over the other half of a tie.
 *
 *   THE WORLD    a seeded world run forward holds no tie without its other end.
 *                This is the test that fails when any writer is one-sided,
 *                because it reads every writer the running world reaches
 *   THE HALVES   the other half of a structure is its named pair, both ways
 *   THE PLAYER   a contact is written on both people's rows
 *   GRIEF        a master carries a dead disciple as a disciple carries a master
 */

import { describe, expect, it } from 'vitest';
import { soakedWorld } from '../../support/soaked-world.js';
import {
    THE_OTHER_END,
    andLetGoAtTheOtherEnd,
    andTheOtherEnd,
    tiesWithNobodyAtTheOtherEnd
} from '../../../src/engine/world/a-tie-has-two-ends.js';
import { createNpc, relationshipWith, upsertRelationship, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { THE_OTHER_HALF, theOtherHalfOf } from '../../../src/engine/social/relationships.js';
import { whoTheyLeave } from '../../../src/engine/world/who-is-left-when-somebody-dies.js';
import { makeGame } from '../../web/harness.js';
import { recordContact, tieFrom } from '../../../src/web/encounters.js';

describe('the world', () => {
    it('holds no tie without its other end, at world open and forty years on', async () => {
        // Kept and shared: see `tests/support/soaked-world.ts`.
        const seeded = await soakedWorld('every-tie-has-two-ends', { years: 0 });
        expect(tiesWithNobodyAtTheOtherEnd(seeded.npcs)).toEqual([]);
        const state = await soakedWorld('every-tie-has-two-ends', { years: 40 });
        const ties = state.npcs.reduce((n, npc) => n + npc.relationships.length, 0);
        expect(ties, 'the world wrote no ties to check').toBeGreaterThan(1000);
        expect(tiesWithNobodyAtTheOtherEnd(state.npcs).slice(0, 10)).toEqual([]);
    }, 300_000);
});

function aPerson(id: string): NpcRecord {
    return createNpc('two-ends', { id, name: id, bornOnDay: 0, onDay: 0 });
}

describe('the halves', () => {
    it('names a pair both ways, in the world and on the player\'s record', () => {
        for (const [kind, other] of Object.entries(THE_OTHER_END)) {
            expect(THE_OTHER_END[other as keyof typeof THE_OTHER_END], kind).toBe(kind);
        }
        for (const [type, other] of Object.entries(THE_OTHER_HALF)) {
            expect(theOtherHalfOf(other!), type).toBe(type);
        }
    });

    it('writes the named other half where it is missing, and never turns a structure into another', () => {
        let student = aPerson('student');
        const teacher = aPerson('teacher');
        student = upsertRelationship(student, { targetId: 'teacher', targetName: 'teacher', kind: 'master', standing: 0.5 }, 1);
        const npcs = [student, teacher];
        andTheOtherEnd(npcs, student, { targetId: 'teacher', kind: 'master', standing: 0.5 }, 1);
        expect(relationshipWith(npcs[1]!, 'student')?.kind).toBe('disciple');

        let wife = aPerson('wife');
        let husband = aPerson('husband');
        husband = upsertRelationship(husband, { targetId: 'wife', targetName: 'wife', kind: 'spouse', standing: 0.7 }, 1);
        wife = upsertRelationship(wife, { targetId: 'husband', targetName: 'husband', kind: 'kin', standing: 0.4 }, 1);
        const household = [wife, husband];
        andTheOtherEnd(household, wife, { targetId: 'husband', kind: 'kin', standing: 0.4 }, 1);
        expect(relationshipWith(household[1]!, 'wife')?.kind).toBe('spouse');
    });

    it('lets go at the other end of a tie somebody no longer holds', () => {
        const before = upsertRelationship(aPerson('crosser'), { targetId: 'friend', targetName: 'friend', kind: 'ally', standing: 0.5 }, 1);
        const friend = upsertRelationship(aPerson('friend'), { targetId: 'crosser', targetName: 'crosser', kind: 'ally', standing: 0.5 }, 1);
        const after = { ...before, relationships: [] };
        const npcs = [after, friend];
        andLetGoAtTheOtherEnd(npcs, before, after);
        expect(relationshipWith(npcs[1]!, 'crosser')).toBeNull();
    });
});

describe('the player\'s record', () => {
    it('writes a contact on both people\'s rows, each holding the other half', async () => {
        const { game, repos } = makeGame({ seed: 'a-contact-has-two-ends' });
        const { cultivator } = await game.newRun('Visitor');
        recordContact(repos, cultivator, 3, {
            kind: 'instruction',
            person: { id: 'npc-someone', name: 'Someone', rankIndex: 3, realmOrdinal: 20, role: 'senior' },
            line: 'Someone showed them a form.',
            interrupts: false,
            tie: {
                type: 'master', strengthDelta: 0.2, significance: 'notable', attitude: 'the beginnings of something',
                eventKind: 'instruction', eventSummary: 'Showed them a form.', roles: []
            }
        });
        expect(tieFrom(repos, cultivator.id, 'npc-someone')?.type).toBe('master');
        expect(tieFrom(repos, 'npc-someone', cultivator.id)?.type).toBe('disciple');
    });
});

describe('who carries a death', () => {
    it('is the master for a dead disciple, as it is the disciple for a dead master', () => {
        const alive = () => true;
        const disciple = upsertRelationship(aPerson('the-disciple'), { targetId: 'the-master', targetName: 'm', kind: 'master', standing: 0.5 }, 1);
        const master = upsertRelationship(aPerson('the-master'), { targetId: 'the-disciple', targetName: 'd', kind: 'disciple', standing: 0.5 }, 1);
        expect(whoTheyLeave({ dead: disciple, heirs: [], stillHere: alive }).map(p => p.id)).toContain('the-master');
        expect(whoTheyLeave({ dead: master, heirs: [], stillHere: alive }).map(p => p.id)).toContain('the-disciple');
    });
});
