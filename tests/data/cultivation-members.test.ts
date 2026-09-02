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

import {
    requireSect,
    getSect,
    SECTS,
    WITHDRAWN_POWERS
} from '../../src/data/cultivation/sects.js';
import { FACTION_CHARACTER } from '../../src/data/cultivation/faction-character.js';
import {
    HOLLOW_COURT_ROSTER,
    HOW_THE_COURT_IS_SEEN,
    workingNamesInCirculation
} from '../../src/data/cultivation/hollow-court-roster.js';
import { mayBeNamed } from '../../src/data/cultivation/hierarchy.js';
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
 * Houses that hold a power the province cannot reach, and therefore cannot see.
 *
 * THIS USED TO BE A LIST OF FACTIONS WITH NO ROSTER, AND THAT WAS THE DEFECT.
 * The guard below required the Hollow Court's member count to be `undefined`,
 * which encodes "the Court has no members". What the design means is "nobody
 * outside the Court knows who its members are", and **absent and withheld are
 * different facts**. The test had the wrong one, and while it stood it forced
 * the seeder to build the Court by a second code path - so the world held a
 * dozen anonymous bodies on those mountains and the register printed a dozen
 * named ones, and they were not the same people.
 *
 * The ground truth is a number and the engine knows it. What is withheld is
 * withheld on the `Awareness` ladder that gates every other name in the world,
 * and the guard now asserts that instead.
 */
const WITHDRAWN = SECTS
    .filter(s => WITHDRAWN_POWERS[s.id])
    .map(s => s.id);

/**
 * Every faction a player could actually walk into.
 *
 * Still keyed on `recruits`, because that is the question `recruits` answers.
 * It governs the admission path and nothing else; whether a faction is
 * populated is asked separately, above and below.
 */
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

    it('resolves every factionId, and keeps a closed faction unjoinable rather than empty', () => {
        for (const member of MEMBERS) {
            const sect = getSect(member.factionId);
            expect(sect, `${member.id} points at an unknown faction ${member.factionId}`)
                .toBeDefined();
        }
        // The guard that used to live here asserted `sect.recruits` for every
        // member, which said a faction with a closed gate had no people. It is
        // gone; `recruits` governs the admission path and is asserted where the
        // admission path is.
        //
        // What survives is the altitude rule, which is what the old guard was
        // reaching for and got by accident. A faction whose FLOOR stands above
        // Core Formation supplies nobody a beginner can stand level with, fight
        // or apprentice to - four realms is not a rivalry - so everybody in one
        // is a rank-holder you deal with and nothing else.
        for (const member of MEMBERS) {
            const sect = requireSect(member.factionId);
            if (sect.admissionOrdinal <= CORE_FORMATION_TOP) continue;
            expect(
                member.role,
                `${member.id} is inside ${member.factionId}, whose gate stands at ` +
                `${sect.admissionOrdinal}, so they can be dealt with but not ` +
                'joined, fought or learned from'
            ).toBe('senior');
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

    it('never seats an admitted disciple below their faction admission bar', () => {
        // Rank 0 is the menial tier - servants, hands, applicants - and those
        // people are not on the disciple track, so the disciple bar does not
        // govern them. They have a bar of their own and it is never zero:
        // `servantBarOf`, pinned by
        // `tests/data/a-house-admits-at-three-floors-not-one.test.ts`.
        for (const member of MEMBERS.filter(m => !m.outlier && m.rankIndex > 0)) {
            const sect = requireSect(member.factionId);
            expect(
                member.realmOrdinal,
                `${member.id} stands below the bar they were admitted on`
            ).toBeGreaterThanOrEqual(sect.admissionOrdinal);
        }
    });

    it('keeps servants off the disciple bar rather than exempt from sense', () => {
        // The exemption above must not become a hole: somebody on the menial
        // tier still cannot out-cultivate their own house.
        for (const member of MEMBERS.filter(m => !m.outlier && m.rankIndex === 0)) {
            const sect = requireSect(member.factionId);
            expect(
                member.realmOrdinal,
                `${member.id} is a servant standing above their house's strength`
            ).toBeLessThan(sect.powerOrdinal);
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

    it('puts somebody inside every faction, and three inside every one you can join', () => {
        const counts = memberCountsByFaction();

        // The floor for a faction a player can walk into is three, because a
        // dossier with one name in it is a card that is not worth opening.
        for (const factionId of RECRUITING) {
            expect(
                counts[factionId] ?? 0,
                `${factionId} recruits and has nobody the player could meet`
            ).toBeGreaterThanOrEqual(3);
        }

        // And the floor for EVERY faction is one, because `powerOrdinal` is
        // defined as the strongest member who will actually answer, which is a
        // claim that a person exists. A faction with a power figure and no
        // person is a number naming nobody. NO FACTION IS EXEMPT FROM THIS ANY
        // MORE - the one that was is the reason the rule exists.
        for (const sect of SECTS) {
            expect(
                counts[sect.id] ?? 0,
                `${sect.id} stands at ${sect.powerOrdinal} and names nobody`
            ).toBeGreaterThanOrEqual(1);
        }

        expect(WITHDRAWN.length, 'the withdrawn power is still withdrawn')
            .toBeGreaterThanOrEqual(1);
    });

    it('withholds the Court rather than emptying it', () => {
        // THE REFORMULATED GUARD. What used to be asserted here was that the
        // Court's member count is `undefined`. That was a data constraint
        // standing in for a knowledge one, and it was the wrong fact: the
        // engine knows exactly who is on those mountains, and what is true is
        // that nobody outside can put a name to any of them.
        const counts = memberCountsByFaction();
        for (const factionId of WITHDRAWN) {
            expect(counts[factionId] ?? 0, `${factionId} is withheld, not empty`)
                .toBeGreaterThanOrEqual(1);
        }

        // The province holds two things it cannot join, and the ladder of
        // knowing says exactly that: it may name the fact that somebody walked
        // up, and may not name which of the masked figures they became.
        const held = HOW_THE_COURT_IS_SEEN.whatTheProvinceHolds;
        expect(mayBeNamed(held.thatSomebodyWalkedUp), 'admission is public').toBe(true);
        expect(mayBeNamed(held.whichOfThemIsWhich), 'standing is not').toBe(false);

        // And what actually circulates is aliases, which cannot be joined to
        // people: never the person's own name, and fewer of them than there
        // are people, so the two lists do not match up even in principle.
        const aliases = workingNamesInCirculation();
        const names = new Set(HOLLOW_COURT_ROSTER.map(m => m.name));
        for (const alias of aliases) {
            expect(names.has(alias), `${alias} is somebody's actual name`).toBe(false);
        }
        expect(aliases.length, 'every member has an alias, so the lists could be matched')
            .toBeLessThan(HOLLOW_COURT_ROSTER.length);

        // The alias is a courtesy from strangers rather than a reading of this
        // house's ladder, so at least one of them has to be wrong about tier.
        // If they were all accurate the alias WOULD be evidence of standing.
        const misleading = HOLLOW_COURT_ROSTER.filter(
            m => m.worksOutsideAs !== null && !m.worksOutsideAs.startsWith(m.tier));
        expect(misleading.length, "every alias states the holder's real tier")
            .toBeGreaterThanOrEqual(1);
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
        //
        // A HOUSE THAT WITHHOLDS NAMES CONTRIBUTES NO CLAN NAMES TO THE POOL.
        // The Hollow Court's Seats are carried as positions - `First Seat` is
        // what stands in for a name, because no name of theirs leaves those
        // mountains - so feeding them in would put `First` and `Third` into the
        // Low Fall clan pool and make the Marches face-number `Third Face Ren`
        // read as somebody's clan. Keyed off `WITHDRAWN_POWERS` rather than off
        // one sect id: withholding is what produces positions-instead-of-names,
        // and any house that ever did it would do the same thing here.
        const lowFallSurnames = new Set(
            getMembersInRegion(HOME_REGION_ID)
                .filter(m => !WITHDRAWN_POWERS[m.factionId])
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
            // Starts at rank 1, because rank 0 is not the bottom rung of this
            // ladder - it is a different layer with a floor of its own, and at
            // three houses that floor stands above the disciple bar. See
            // `a-house-admits-at-three-floors-not-one.test.ts`, which pins the
            // rank-0 floor from below and explains why a servant's bar can be
            // dearer than a disciple's. The monotone rule still holds for every
            // rung of the disciple ladder, which is where it means something.
            let previousFloor = -1;
            for (let i = 0; i < sect.ranks.length; i++) {
                const band = rankRealmBand(sect.id, i);
                expect(band, `${sect.id} rank ${i}`).toBeDefined();
                expect(band!.minOrdinal).toBeGreaterThanOrEqual(sect.admissionOrdinal);
                expect(band!.maxOrdinal).toBeGreaterThanOrEqual(band!.minOrdinal);
                if (i >= 1) {
                    // The floor never falls as rank rises.
                    expect(band!.minOrdinal, `${sect.id} floor fell at rank ${i}`)
                        .toBeGreaterThanOrEqual(previousFloor);
                    previousFloor = band!.minOrdinal;
                }
            }
        }
    });
});

describe('the strongest member is somebody you can meet', () => {
    it('names somebody at every faction ordinal, and allows a core above the pipeline', () => {
        for (const sect of SECTS) {
            const mine = MEMBERS.filter(m => m.factionId === sect.id);
            if (mine.length === 0) {
                // The one faction with no roster still has to put somebody on
                // its own number. The Hollow Court does it with positions
                // rather than names, on purpose, so the claim is asserted
                // against the seats instead of against a member.
                const withdrawn = WITHDRAWN_POWERS[sect.id];
                expect(withdrawn, `${sect.id} names nobody anywhere`).toBeDefined();
                expect(withdrawn.seats.length, `${sect.id} seat count`).toBe(withdrawn.count);
                expect(
                    Math.max(...withdrawn.seats.map(s => s.ordinal)),
                    `${sect.id} seats nobody at its own ordinal`
                ).toBe(sect.powerOrdinal);
                continue;
            }
            // At least one, not exactly one. Remnants come in cores: a sect
            // squatting in somebody else's compound frequently squats in it with
            // somebody else's elders, so a faction can carry a whole band its own
            // ground could never have produced.
            const outliers = mine.filter(m => m.outlier)
                .sort((a, b) => b.realmOrdinal - a.realmOrdinal);
            expect(outliers.length, sect.id + ' names nobody at its own ordinal')
                .toBeGreaterThanOrEqual(1);
            // The faction ordinal is defined as its strongest member, so this is
            // an identity rather than a range check.
            expect(outliers[0].realmOrdinal, sect.id + ' strongest outlier is not the strongest member')
                .toBe(sect.powerOrdinal);
            expect(outliers[0].rankIndex, sect.id + ' strongest outlier does not hold the top rank')
                .toBe(sect.ranks.length - 1);
            for (const o of outliers) {
                expect(o.outlierReason, o.id + ' is an outlier for no stated reason').not.toBeNull();
            }
            for (const other of mine.filter(m => !m.outlier)) {
                expect(other.realmOrdinal, other.id + ' outranks every outlier')
                    .toBeLessThanOrEqual(outliers[outliers.length - 1].realmOrdinal);
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

describe('a dao house is a family', () => {
    /**
     * A house does not recruit; it adopts, and adoption here is the name. So a
     * house roll is one surname repeated, and the surname is the founder's -
     * Yan Duo of the Ninefold Ledger, Cao Xun of the Narrow Hour, Lin Zhao of
     * the Bound Word, Gu Yao of Held Names, Fu Chang of the Measured Span, Xu
     * Ping of the Anchorhold. The Quiet Cut's founder is unrecorded and the Chu
     * are known by nothing except that they are all Chu.
     *
     * The exception is a woman who married in and declined to change, and it is
     * only legible while it stays rare - so this pins the count from above as
     * well as asserting the rule.
     */
    const HOUSES = SECTS.filter(s => s.id.startsWith('house-'));

    it('gives everybody on a house roll the house name', () => {
        expect(HOUSES.length, 'the dao houses moved').toBeGreaterThanOrEqual(7);
        const keptTheirOwn: string[] = [];

        for (const house of HOUSES) {
            const roll = MEMBERS.filter(m => m.factionId === house.id);
            expect(roll.length, `${house.id} is a family with nobody in it`)
                .toBeGreaterThanOrEqual(3);

            // The surname the house actually uses, taken from the roll itself
            // by majority so this test does not have to restate the mapping.
            const tally = new Map<string, number>();
            for (const m of roll) {
                const surname = m.name.split(' ')[0];
                tally.set(surname, (tally.get(surname) ?? 0) + 1);
            }
            const [surname, count] = [...tally.entries()]
                .sort((a, b) => b[1] - a[1])[0];

            expect(
                count,
                `${house.id} has ${tally.size} surnames on a roll of ${roll.length}, ` +
                'which reads as a sect roster rather than a family'
            ).toBeGreaterThanOrEqual(roll.length - 1);

            for (const m of roll.filter(m => m.name.split(' ')[0] !== surname)) {
                keptTheirOwn.push(`${m.name} (${house.id})`);
                // Somebody carrying another name owes the reader the reason,
                // in their own entry, in one clause.
                expect(
                    /married in/i.test(m.detail),
                    `${m.id} does not carry the ${surname} and does not say why`
                ).toBe(true);
            }

            // Nobody is left with a rank in the name field. A house head called
            // "The Last Cut" beside a rank column that also says "The Last Cut"
            // is a person with no name.
            for (const m of roll) {
                expect(
                    m.name,
                    `${m.id} has its rank in the name field`
                ).not.toBe(m.rank);
                expect(
                    m.name.startsWith(m.rank),
                    `${m.id} has its title baked into the name field`
                ).toBe(false);
            }
        }

        // Two, across seven houses. Three would stop reading as a refusal.
        expect(
            keptTheirOwn.length,
            `too many kept their own name for it to mean anything: ${keptTheirOwn.join(', ')}`
        ).toBeLessThanOrEqual(2);
        expect(keptTheirOwn.length, 'nobody declined to be absorbed').toBeGreaterThanOrEqual(1);
    });

    it('agrees with the surname the house catalog declares', () => {
        // `sects.ts` carries `houseSurname` on each dao house. The two files
        // must not drift: a roll of Fus inside a house that says it is a house
        // of Kes is a bug that no other assertion here would catch.
        for (const house of HOUSES) {
            const declared = (house as { houseSurname?: string }).houseSurname;
            if (!declared) continue;
            const roll = MEMBERS.filter(m => m.factionId === house.id);
            const carrying = roll.filter(m => m.name.split(' ')[0] === declared);
            expect(
                carrying.length,
                `${house.id} declares the ${declared} and its roll is ` +
                `${roll.map(m => m.name).join(', ')}`
            ).toBeGreaterThanOrEqual(roll.length - 1);
        }
    });
});

describe('remnants come in cores', () => {
    it('has at least one faction carrying a band it could not have produced', () => {
        const cores = SECTS
            .map(s => ({ s, r: MEMBERS.filter(m => m.factionId === s.id && m.outlierReason === 'remnant') }))
            .filter(x => x.r.length >= 2);
        expect(cores.length, 'nobody inherited people, only compounds').toBeGreaterThanOrEqual(1);

        for (const { s, r } of cores) {
            // The point of a core is that it is not one person, and that the
            // faction's own pipeline is visibly below it.
            const production = FACTION_CHARACTER[s.id]?.production.reliableOrdinal ?? 0;
            for (const m of r) {
                expect(m.realmOrdinal, m.id + ' is not actually above the pipeline')
                    .toBeGreaterThan(production);
            }
        }
    });
});
