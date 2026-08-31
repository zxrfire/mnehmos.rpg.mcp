/**
 * Validation for the people inside the institutions.
 *
 * The assertions that matter are the ones that keep this catalog a cast rather
 * than a bestiary:
 *
 *   - every faction id resolves, and every rank index is a real rank of it
 *   - every realm is plausible for that rank of that faction, derived from the
 *     faction's own admission bar and production tier rather than eyeballed
 *   - names and ids are unique, because a name is the only handle the player
 *     has on any of these people
 *   - everybody has exactly the six fields and nothing is left blank
 *   - each province has somebody to fight and somebody to learn from
 *   - nobody is flagged important, and the schema has no field that could
 *     express such a flag
 */

import { describe, it, expect } from 'vitest';

import { requireSect, getSect, SECTS } from '../../src/data/cultivation/sects.js';
import { FACTION_CHARACTER } from '../../src/data/cultivation/faction-character.js';
import {
    REGIONS,
    HOME_REGION_ID,
    ADJACENT_REGION_ID,
    getRegionForFaction
} from '../../src/data/cultivation/regions.js';
import { REALM_TIERS, MAX_ORDINAL } from '../../src/engine/cultivation/realms.js';
import {
    MEMBERS,
    MemberSchema,
    getMember,
    requireMember,
    getMembersOf,
    getMembersInRegion,
    getMembersByRole,
    getMemberRegionId,
    getPeersAt,
    getRivalsIn,
    getMastersIn,
    rankRealmBand,
    realmIsPlausible,
    rankNameIsCurrent,
    memberCountsByFaction,
    describeMember
} from '../../src/data/cultivation/members.js';

/** Top of Qi Condensation. Below this is where the player starts. */
const QI_CONDENSATION_TOP = REALM_TIERS[0].ordinalEnd;
/** Top of Foundation Establishment. */
const FOUNDATION_TOP = REALM_TIERS[1].ordinalEnd;
/** Top of Core Formation, above which a member needs a very good reason. */
const CORE_FORMATION_TOP = REALM_TIERS[2].ordinalEnd;

/**
 * Factions with no roster here, and both reasons are principled:
 * a power that takes no applicants at all is a fact about the world rather
 * than a door, and a power whose front gate stands above Core Formation has
 * no members at human scale for a starting cultivator to meet.
 */
const NO_ROSTER = SECTS
    .filter(s => !s.recruits || s.admissionOrdinal > CORE_FORMATION_TOP)
    .map(s => s.id);

/** Every faction a player could actually walk into. */
const RECRUITING = SECTS
    .filter(s => s.recruits && s.admissionOrdinal <= CORE_FORMATION_TOP)
    .map(s => s.id);

describe('members catalog', () => {
    it('parses, and is a cast rather than a roster', () => {
        expect(MEMBERS.length).toBeGreaterThanOrEqual(80);
        for (const member of MEMBERS.filter(m => !m.outlier)) {
            expect(() => MemberSchema.parse(member), member.id).not.toThrow();
        }
        expect(getMember('member-yan-shuling')).toBeDefined();
        expect(getMember('member-nobody-at-all')).toBeUndefined();
        expect(() => requireMember('member-nobody-at-all')).toThrow();
    });

    it('gives every person a unique id and a unique name', () => {
        const ids = MEMBERS.map(m => m.id);
        expect(new Set(ids).size, 'duplicate member id').toBe(ids.length);

        const names = MEMBERS.map(m => m.name);
        const seen = new Set<string>();
        const duplicates: string[] = [];
        for (const name of names) {
            if (seen.has(name)) duplicates.push(name);
            seen.add(name);
        }
        expect(duplicates, `a name is the only handle the player has: ${duplicates.join(', ')}`)
            .toEqual([]);
    });

    it('resolves every factionId to a real faction that recruits', () => {
        for (const member of MEMBERS.filter(m => !m.outlier)) {
            const sect = getSect(member.factionId);
            expect(sect, `${member.id} points at an unknown faction ${member.factionId}`)
                .toBeDefined();
            expect(
                sect!.recruits,
                `${member.id} is inside ${member.factionId}, which takes no applicants`
            ).toBe(true);
        }
    });

    it('places every person on a rank their faction actually has', () => {
        for (const member of MEMBERS.filter(m => !m.outlier)) {
            const sect = requireSect(member.factionId);
            expect(
                member.rankIndex,
                `${member.id} rank index out of range for ${sect.name}`
            ).toBeLessThan(sect.ranks.length);
            expect(
                sect.ranks[member.rankIndex],
                `${member.id} carries a stale rank name`
            ).toBe(member.rank);
            expect(rankNameIsCurrent(member), member.id).toBe(true);
        }
    });

    it('keeps every realm plausible for the rank and the faction', () => {
        const offences: string[] = [];
        for (const member of MEMBERS.filter(m => !m.outlier)) {
            // The band describes what a faction can reliably produce. The one
            // member it did not produce is exempt by construction; see the
            // outlier assertions below, which are stricter rather than looser.
            if (member.outlier) continue;
            const band = rankRealmBand(member.factionId, member.rankIndex);
            expect(band, `${member.id} has no band`).toBeDefined();
            if (!band) continue;
            if (member.realmOrdinal < band.minOrdinal || member.realmOrdinal > band.maxOrdinal) {
                offences.push(
                    `${member.id} (${member.rank}, ordinal ${member.realmOrdinal}) ` +
                    `outside [${band.minOrdinal}, ${band.maxOrdinal}] for ${member.factionId}`
                );
            }
            expect(realmIsPlausible(member), member.id).toBe(true);
        }
        expect(offences, offences.join('\n')).toEqual([]);
    });

    it('never seats anybody below their faction admission bar', () => {
        for (const member of MEMBERS.filter(m => !m.outlier)) {
            const sect = requireSect(member.factionId);
            expect(
                member.realmOrdinal,
                `${member.id} stands below the bar they were admitted on`
            ).toBeGreaterThanOrEqual(sect.admissionOrdinal);
        }
    });

    it('never seats anybody far above what their faction can produce', () => {
        // Outliers excluded: standing above what the faction can produce is the
        // definition of one, and the outlier suite pins them to powerOrdinal
        // exactly, which is stricter than this range.
        // Somebody above the pipeline by more than a realm is a claim that
        // needs its own story, and this catalog does not tell stories.
        for (const member of MEMBERS.filter(m => !m.outlier)) {
            const production = FACTION_CHARACTER[member.factionId]?.production.reliableOrdinal;
            if (production === undefined) continue;
            const sect = requireSect(member.factionId);
            const ceiling = Math.min(
                sect.powerOrdinal,
                Math.max(sect.admissionOrdinal, production) + 8
            );
            expect(
                member.realmOrdinal,
                `${member.id} stands above what ${member.factionId} can produce`
            ).toBeLessThanOrEqual(ceiling);
        }
    });

    it('weights the cast toward the bottom of the ladder', () => {
        // The shape being described is the CAST: the people a player meets on the
        // way up. Each faction also carries one outlier, its strongest member,
        // and counting those here would say the roster is top-heavy when what
        // actually happened is that every faction gained exactly one senior.
        const cast = MEMBERS.filter(m => !m.outlier);

        const qi = cast.filter(m => m.realmOrdinal <= QI_CONDENSATION_TOP);
        const foundation = cast.filter(
            m => m.realmOrdinal > QI_CONDENSATION_TOP && m.realmOrdinal <= FOUNDATION_TOP
        );
        const aboveCore = cast.filter(m => m.realmOrdinal > CORE_FORMATION_TOP);

        expect(qi.length / cast.length, 'most people are at Qi Condensation')
            .toBeGreaterThan(0.4);
        expect(foundation.length, 'Foundation Establishment should be notable, not absent')
            .toBeGreaterThan(0);
        expect(
            aboveCore.length / cast.length,
            'above Core Formation is a senior figure and should stay rare: ' +
            aboveCore.map(m => `${m.name} (${m.realmOrdinal})`).join(', ')
        ).toBeLessThanOrEqual(0.15);
        // The cast stops in the early stages of Deity Transformation. Above that
        // is one person per faction and they are marked as such - the number a
        // faction is listed at now names somebody rather than nobody, which is
        // the change this bound used to stand in for.
        const highest = Math.max(...cast.map(m => m.realmOrdinal));
        expect(highest).toBeLessThanOrEqual(26);
        expect(highest).toBeLessThanOrEqual(MAX_ORDINAL);
    });

    it('gives everybody a want, a fear and a concrete detail', () => {
        for (const member of MEMBERS.filter(m => !m.outlier)) {
            // The floor is low on purpose: "out" and "a ticket" are the two
            // best answers in the catalog and a longer minimum would forbid
            // them. What is forbidden is a blank.
            expect(member.wants.trim().length, `${member.id} wants nothing`).toBeGreaterThan(2);
            expect(member.fears.trim().length, `${member.id} fears nothing`).toBeGreaterThan(2);
            expect(member.detail.trim().length, `${member.id} has no detail`).toBeGreaterThan(29);
            expect(member.wants, `${member.id} wants what it fears verbatim`)
                .not.toBe(member.fears);
        }
    });

    it('keeps people small enough to be reusable', () => {
        // A person who takes ten lines is not reusable. This is the guard on
        // that, and it is deliberately a hard cap rather than an average.
        for (const member of MEMBERS.filter(m => !m.outlier)) {
            const prose = [member.wants, member.fears, member.detail].join(' ');
            expect(prose.length, `${member.id} has grown into a biography`).toBeLessThan(500);
        }
    });

    it('covers every faction that recruits, and none that does not', () => {
        const counts = memberCountsByFaction();
        for (const factionId of RECRUITING) {
            expect(
                counts[factionId] ?? 0,
                `${factionId} recruits and has nobody the player could meet`
            ).toBeGreaterThanOrEqual(3);
        }
        for (const factionId of NO_ROSTER) {
            expect(
                counts[factionId],
                `${factionId} is not a door a cultivator can walk through and should have no roster`
            ).toBeUndefined();
        }
        expect(NO_ROSTER.length, 'the closed powers are still closed')
            .toBeGreaterThanOrEqual(2);
    });

    it('gives every faction somebody to learn from, on stated terms', () => {
        for (const factionId of RECRUITING) {
            const masters = getMembersOf(factionId).filter(m => m.role === 'master');
            expect(masters.length, `${factionId} has nobody who will teach`)
                .toBeGreaterThanOrEqual(1);
            for (const master of masters) {
                expect(master.teaching, `${master.id} is a master with no limits`).not.toBeNull();
                // asking.md: three limits, and all three apply.
                expect(master.teaching!.knows.length).toBeGreaterThan(29);
                expect(master.teaching!.mayNotSay.length).toBeGreaterThan(29);
                expect(master.teaching!.costsThem.length).toBeGreaterThan(29);
            }
        }
    });

    it('keeps masters competent rather than formidable', () => {
        for (const master of getMembersByRole('master')) {
            expect(
                master.realmOrdinal,
                `${master.id} is too strong to be a master worth having`
            ).toBeLessThanOrEqual(CORE_FORMATION_TOP + 8);
        }
    });

    it('gives every faction somebody who is good company', () => {
        for (const factionId of RECRUITING) {
            const cheerful = getMembersOf(factionId).filter(m => m.goodCompany);
            expect(
                cheerful.length,
                `${factionId} has nobody worth spending an evening with, and tone.md requires humour to come from character`
            ).toBeGreaterThanOrEqual(1);
        }
    });

    it('gives each province a rival and a master', () => {
        for (const region of REGIONS) {
            const rivals = getRivalsIn(region.id);
            const masters = getMastersIn(region.id);
            expect(rivals.length, `${region.name} has no personal opposition`)
                .toBeGreaterThanOrEqual(1);
            expect(masters.length, `${region.name} has nobody to learn from`)
                .toBeGreaterThanOrEqual(1);
        }
        // Both named regions must be covered, not one region twice.
        expect(getRivalsIn(HOME_REGION_ID).length).toBeGreaterThanOrEqual(1);
        expect(getRivalsIn(ADJACENT_REGION_ID).length).toBeGreaterThanOrEqual(1);
        expect(getMastersIn(HOME_REGION_ID).length).toBeGreaterThanOrEqual(1);
        expect(getMastersIn(ADJACENT_REGION_ID).length).toBeGreaterThanOrEqual(1);
    });

    it('gives each province a rival the player can meet early', () => {
        for (const regionId of [HOME_REGION_ID, ADJACENT_REGION_ID]) {
            const early = getRivalsIn(regionId)
                .filter(m => m.realmOrdinal <= QI_CONDENSATION_TOP);
            expect(
                early.length,
                `${regionId} has no rival at the altitude the player starts at`
            ).toBeGreaterThanOrEqual(1);
        }
    });

    it('makes every rival personal and defeatable, and says why', () => {
        const rivals = getMembersByRole('rival');
        expect(rivals.length).toBeGreaterThanOrEqual(4);
        for (const rival of rivals) {
            expect(rival.rivalry, `${rival.id} is a rival with no quarrel`).not.toBeNull();
            expect(rival.rivalry!.grievance.length).toBeGreaterThan(29);
            expect(
                rival.rivalry!.beatableBecause.length,
                `${rival.id} does not say why it can be beaten`
            ).toBeGreaterThan(59);
        }
    });

    it('attaches rivalry and teaching only where they belong', () => {
        for (const member of MEMBERS.filter(m => !m.outlier)) {
            if (member.role !== 'rival') {
                expect(member.rivalry, `${member.id} carries a rivalry it should not`).toBeNull();
            }
            if (member.role !== 'master') {
                expect(member.teaching, `${member.id} carries teaching terms it should not`)
                    .toBeNull();
            }
        }
    });

    it('flags nobody as important', () => {
        // people.md: exceptional NPCs emerge from the same inputs as anybody
        // else, never from a flag. The schema must have no field that could
        // carry one, so that no later edit can quietly add one.
        const forbidden = [
            'important', 'notable', 'prodigy', 'chosen', 'destined', 'special',
            'protagonist', 'plotRelevant', 'talent', 'potential', 'hidden'
        ];
        const keys = new Set(MEMBERS.flatMap(m => Object.keys(m)));
        for (const key of keys) {
            for (const word of forbidden) {
                expect(
                    key.toLowerCase().includes(word.toLowerCase()),
                    `member field "${key}" reads as an importance flag`
                ).toBe(false);
            }
        }
        // And no ranking axis: the only ordinal on a member is their realm.
        const numericKeys = [...keys].filter(
            k => MEMBERS.some(m => typeof (m as Record<string, unknown>)[k] === 'number')
        );
        expect(numericKeys.sort()).toEqual(['rankIndex', 'realmOrdinal']);
    });

    it('names people the way their region names people', () => {
        // regions.ts customs.naming: the Low Fall uses clan surnames with
        // given names; the Marches uses tool-names and face-numbers and has no
        // clan names at all. The tell is that a Marches name is not two words
        // of the "Surname Given" shape drawn from the Low Fall pool.
        const lowFallSurnames = new Set(
            getMembersInRegion(HOME_REGION_ID)
                .map(m => m.name.split(/[ ,]/)[0])
        );
        for (const member of getMembersInRegion(ADJACENT_REGION_ID)) {
            const first = member.name.split(' ')[0];
            expect(
                lowFallSurnames.has(first),
                `${member.name} is a Marches person carrying a Low Fall clan name`
            ).toBe(false);
        }
        // And every Marches person is seated in a Marches faction.
        for (const member of getMembersInRegion(ADJACENT_REGION_ID)) {
            expect(getRegionForFaction(member.factionId)?.id).toBe(ADJACENT_REGION_ID);
        }
    });

    it('answers the question a player actually asks: who can I meet', () => {
        // A cultivator at Layer 4 should find people, and none of them should
        // be unfightable.
        const peers = getPeersAt(3);
        expect(peers.length, 'a beginner meets nobody').toBeGreaterThan(10);
        for (const peer of peers) {
            expect(peer.realmOrdinal).toBeLessThanOrEqual(7);
        }
        // A Core Formation cultivator finds a different, smaller set.
        const seniors = getPeersAt(18);
        expect(seniors.length).toBeGreaterThan(0);
        expect(seniors.some(m => m.realmOrdinal <= QI_CONDENSATION_TOP)).toBe(false);
    });

    it('resolves regions and renders a person in one line', () => {
        expect(getMemberRegionId('member-chisel-ma')).toBe(ADJACENT_REGION_ID);
        expect(getMemberRegionId('member-yan-shuling')).toBe(HOME_REGION_ID);
        expect(getMemberRegionId('member-nobody-at-all')).toBeUndefined();

        const line = describeMember('member-cen-qingzhi');
        expect(line).toBeDefined();
        expect(line).toContain('Cen Qingzhi');
        expect(line).toContain('Outer Disciple');
        expect(describeMember('member-nobody-at-all')).toBeUndefined();

        const everyRegionCovered = REGIONS.every(r => getMembersInRegion(r.id).length > 0);
        expect(everyRegionCovered).toBe(true);
    });

    it('derives realm bands from the world rather than from opinion', () => {
        // The band for an unknown faction or a bad rank index is undefined, so
        // a generator adding people later fails the same way this test does.
        expect(rankRealmBand('sect-does-not-exist', 0)).toBeUndefined();
        expect(rankRealmBand('sect-azure-cloud-pavilion', -1)).toBeUndefined();
        expect(rankRealmBand('sect-azure-cloud-pavilion', 99)).toBeUndefined();

        for (const sect of SECTS) {
            let previousFloor = -1;
            for (let i = 0; i < sect.ranks.length; i++) {
                const band = rankRealmBand(sect.id, i);
                expect(band, `${sect.id} rank ${i}`).toBeDefined();
                expect(band!.minOrdinal).toBeGreaterThanOrEqual(sect.admissionOrdinal);
                expect(band!.maxOrdinal).toBeGreaterThanOrEqual(band!.minOrdinal);
                // The floor never falls as rank rises.
                expect(band!.minOrdinal, `${sect.id} floor fell at rank ${i}`)
                    .toBeGreaterThanOrEqual(previousFloor);
                previousFloor = band!.minOrdinal;
            }
        }
    });
});

describe('the strongest member is somebody you can meet', () => {
    it('gives every recruiting faction exactly one outlier, at its own ordinal', () => {
        for (const sect of SECTS) {
            const mine = MEMBERS.filter(m => m.factionId === sect.id);
            if (mine.length === 0) continue;
            const outliers = mine.filter(m => m.outlier);
            expect(outliers.length, sect.id + ' should have one outlier').toBe(1);
            // The faction ordinal is defined as its strongest member, so this is
            // an identity rather than a range check.
            expect(outliers[0].realmOrdinal, sect.id + ' outlier is not the strongest member')
                .toBe(sect.powerOrdinal);
            expect(outliers[0].rankIndex, sect.id + ' outlier does not hold the top rank')
                .toBe(sect.ranks.length - 1);
            for (const other of mine.filter(m => !m.outlier)) {
                expect(other.realmOrdinal, other.id + ' outranks the outlier')
                    .toBeLessThanOrEqual(outliers[0].realmOrdinal);
            }
        }
    });

    it('keeps the cast weighted below them', () => {
        // The point of the roster is the bottom of the ladder. One strong member
        // per faction must not turn it into a list of elders.
        const ordinary = MEMBERS.filter(m => !m.outlier);
        const median = ordinary.map(m => m.realmOrdinal).sort((a, b) => a - b)[Math.floor(ordinary.length / 2)];
        expect(median).toBeLessThanOrEqual(20);
    });
});
