/**
 * Superlatives, measured against the catalogs that own the figures.
 *
 * The commonest way this setting goes wrong is a sentence that was true when it
 * was written and is now a claim about a world that has moved. Five were found
 * by measurement in one pass - a house calling itself the only pipeline in the
 * province that reaches a realm six others reach, two houses each claiming the
 * top of the same list neither is on, a court calling itself the only body in
 * its province doing something nine of them do - and every one of them had been
 * sitting in the catalog being read as fact.
 *
 * So this suite does not check prose for style. It takes the specific claims
 * that were wrong, works out from the data what the true version is, and fails
 * if the false version comes back. Each assertion carries the measurement in a
 * comment so that whoever trips it can see what to check rather than being told
 * a string is missing.
 *
 * The rule the whole file is enforcing: A SUPERLATIVE IS A MEASUREMENT, AND
 * WHOEVER WRITES ONE OWES THE READER THE COMPARISON.
 */

import { describe, expect, it } from 'vitest';
import { SECTS, getSect } from '../../src/data/cultivation/sects.js';
import { getFactionCharacter } from '../../src/data/cultivation/faction-character.js';
import { provinceForFaction } from '../../src/data/cultivation/regions.js';
import {
    APEX_INSTITUTIONS,
    COURTS,
    FACTION_PARENTAGE,
    getParentage
} from '../../src/data/cultivation/hierarchy.js';

const reliableOf = (id: string): number =>
    getFactionCharacter(id)?.production.reliableOrdinal ?? -1;

const inLowFall = (id: string): boolean =>
    provinceForFaction(id)?.id === 'province-low-fall';

/** Everything with a row in any of the three catalogs. */
const KNOWN = new Set<string>([
    ...SECTS.map(s => s.id),
    ...COURTS.map(c => c.id),
    ...APEX_INSTITUTIONS.map(a => a.id)
]);

describe('a superlative is a measurement', () => {
    it('does not let the Nine Peaks claim a pipeline three houses beat', () => {
        // Measured: reliable production in the Jade Gorge runs Crimson Abyss 29,
        // Nine Abyss 25, Ashen Forge 23, then a group at 21 that the Order is
        // in. It was calling itself the best pipeline in the province and it is
        // joint fourth. What IS singular is the thing it is short of, and the
        // note now says that instead.
        const order = getSect('sect-nine-peaks-ascetic-order')!;
        const c = getFactionCharacter(order.id)!;
        const better = SECTS.filter(s => inLowFall(s.id) && reliableOf(s.id) > reliableOf(order.id));
        expect(better.length, 'nobody out-produces the Order any more - recheck the claim')
            .toBeGreaterThan(0);
        for (const text of [order.description, c.production.note]) {
            expect(text, 'the Order is claiming the best pipeline again')
                .not.toMatch(/best pipeline in the province/i);
        }
    });

    it('does not let the Nine Abyss claim to be the strongest of anything it is not', () => {
        // Two claims, both false. The Severed stands four rungs above it and is
        // as openly demonic as anything gets; and the Crimson Abyss Hall's
        // pipeline reaches a realm higher.
        const sect = getSect('sect-nine-abyss-flame-sect')!;
        const c = getFactionCharacter(sect.id)!;

        const strongerDemonic = SECTS.filter(
            s => s.alignment === 'demonic' && s.powerOrdinal > sect.powerOrdinal
        );
        expect(strongerDemonic.length, 'nothing demonic outranks it any more - recheck')
            .toBeGreaterThan(0);
        const betterPipeline = SECTS.filter(
            s => inLowFall(s.id) && reliableOf(s.id) > reliableOf(sect.id)
        );
        expect(betterPipeline.length, 'nothing out-produces it any more - recheck')
            .toBeGreaterThan(0);

        for (const text of [sect.description, c.production.note]) {
            expect(text, 'the strongest-demonic claim is back')
                .not.toMatch(/strongest openly demonic/i);
            expect(text, 'the strongest-pipeline claim is back')
                .not.toMatch(/strongest live pipeline in the province/i);
        }
    });

    it('does not let the Frostmirror be the only body gunning for another', () => {
        // Measured: nine Jade Gorge bodies hold an ambition blocked by a peer and
        // have moved on it. What is actually singular is the instrument -
        // nobody else forges their own landlord's paperwork.
        const court = getSect('sect-frostmirror-court')!;
        const gunning = SECTS.filter(s => {
            if (!inLowFall(s.id) || !s.ambition?.movedOn) return false;
            return s.ambition.blockedBy.some(b => KNOWN.has(b) && !b.startsWith('apex-') && !b.startsWith('court-'));
        });
        expect(gunning.length, 'the Jade Gorge has gone quiet - recheck the claim')
            .toBeGreaterThan(1);
        expect(court.description, 'the only-body-gunning claim is back')
            .not.toMatch(/only body in the Jade Gorge/i);
    });

    it('never calls a grant the only pipeline that reaches a realm six houses reach', () => {
        // The governance line that started this. Nascent Soul opens at 21 and
        // more than half the Jade Gorge reaches it.
        const terms = getParentage('sect-nine-peaks-ascetic-order')?.terms;
        expect(terms, 'the Order holds on no terms at all now').toBeTruthy();
        for (const b of terms!.buys) {
            expect(b, 'the only-Nascent-Soul claim is back')
                .not.toMatch(/only pipeline in the Jade Gorge/i);
        }
        const atNascentSoul = SECTS.filter(s => inLowFall(s.id) && reliableOf(s.id) >= 21);
        expect(atNascentSoul.length, 'the province thinned out - recheck').toBeGreaterThan(3);
    });
});

describe('every cross-reference resolves', () => {
    it('names a parent that exists, everywhere one is named', () => {
        for (const [id, p] of Object.entries(FACTION_PARENTAGE)) {
            if (!p.parentFactionId) continue;
            expect(KNOWN.has(p.parentFactionId), `${id} holds from ${p.parentFactionId}, which is nothing`)
                .toBe(true);
        }
    });

    it('names a blocker and a contestant that exist, on every ambition', () => {
        for (const s of SECTS) {
            if (!s.ambition) continue;
            for (const b of s.ambition.blockedBy) {
                expect(KNOWN.has(b), `${s.id} is blocked by ${b}, which is nothing`).toBe(true);
            }
            for (const o of s.ambition.contestedWith) {
                expect(KNOWN.has(o), `${s.id} contests with ${o}, which is nothing`).toBe(true);
            }
        }
    });

    it('keeps the two Sills apart', () => {
        // A live trap, and it has caught somebody before. "Sill" is in the name
        // of a posting under one apex and an ordinary court under the other,
        // and anything about the ground means the Kiln while anything about the
        // third arterial and its grants means the Third Sill.
        const third = COURTS.find(c => c.id === 'court-third-sill')!;
        const rootSill = getSect('sect-kiln-wardens')!;
        const kiln = COURTS.find(c => c.id === 'court-kiln')!;

        expect(third.apexId, 'the Third Sill is an ordinary Long Cut court').toBe('apex-long-cut');
        expect(kiln.apexId, 'the Kiln stayed with the Survey').toBe('apex-deep-survey');
        expect(getParentage(rootSill.id)?.parentFactionId, 'the Root Sill walked to the Long Cut')
            .toBe('apex-long-cut');

        // Only the two halves of the split posting are postings.
        const postings = [
            ...COURTS.filter(c => c.posting).map(c => c.id),
            ...Object.entries(FACTION_PARENTAGE).filter(([, p]) => p.posting).map(([id]) => id)
        ].sort();
        expect(postings, 'a body that is not one of the two is being staffed by appointment')
            .toEqual(['court-kiln', 'sect-kiln-wardens']);

        // And the Third Sill carries no defection material, because it never
        // moved. The only administration that ever changed patrons is the
        // Root Sill.
        expect(third.transferNote, 'the Third Sill has acquired a transfer again').toBeUndefined();
    });

    it('never sends the Storm Tyrant to a court under the wrong apex', () => {
        // It answers the Deep Survey. A Long Cut court cannot be its landlord,
        // cannot have held its probation, and cannot be what it was promoted
        // past - the Survey's own body in that province is the Kiln.
        const tyrant = getSect('sect-storm-tyrant-court')!;
        const p = getParentage(tyrant.id)!;
        expect(p.parentFactionId).toBe('apex-deep-survey');
        expect(p.note, 'the Storm Tyrant is holding from a Long Cut court again')
            .not.toMatch(/Third Sill/);
        expect(tyrant.ambition?.blockedBy, 'the Storm Tyrant is blocked by the wrong Sill')
            .not.toContain('court-third-sill');
    });
});
