/**
 * Courts, drive, and the houses as families.
 *
 * Three things are asserted here that nothing else in the suite covers:
 *
 *   1. A COURT HAS PEOPLE IN IT. `powerOrdinal` on a court is defined as its
 *      strongest acting member, which is a claim about a person, so somebody in
 *      the roster has to be standing at exactly that number and nobody may be
 *      above it. Court offices are named for the work rather than for a rung,
 *      and every officer carries a second standing inside the apex that posted
 *      them - a title from that apex's own ladder, because a court is a posting.
 *
 *   2. A FACTION WANTS SOMETHING, AND SOMEBODY IS IN THE WAY. `ambition` scales
 *      with what the house actually is: a body at the bottom of the table does
 *      not name a court or an apex as its obstacle, because a road militia does
 *      not have a quarrel with an arterial. Contested claims are symmetric, the
 *      way rivalries are, and the four factions with no ambition at all are the
 *      four that make no claims.
 *
 *   3. A HOUSE IS A FAMILY. The seven dao houses take nobody at a gate: the
 *      only route in is adoption, on a prodigy in that house's own dao, and
 *      everybody on the roll carries the family's name because the house's name
 *      is what the family does rather than the other way round.
 *
 * This file is deliberately separate from `cultivation-governance.test.ts` and
 * `cultivation-world.test.ts`, which are owned elsewhere.
 */

import { describe, it, expect } from 'vitest';
import {
    COURTS,
    CourtSchema,
    CourtOfficerSchema,
    getCourt,
    getCourtOfficer,
    getApexInstitution,
    courtOfficers,
    strongestOfficerOf,
    leaderTitleOfCourt,
    getParentage,
    APEX_INSTITUTIONS,
    THE_KILN_SCHISM
} from '../../src/data/cultivation/hierarchy.js';
import {
    SECTS,
    DAO_HOUSES,
    getSect,
    intakeRouteOf,
    contestedClaimsOf
} from '../../src/data/cultivation/sects.js';

/** Anything the world can point at: a sect, a court or an apex. */
function resolves(id: string): boolean {
    return Boolean(getSect(id) || getCourt(id) || getApexInstitution(id));
}

/** Sentence-ish count. Crude on purpose; it only has to catch one-liners. */
function sentences(text: string): number {
    return (text.match(/[.!?](?:\s|$)/g) ?? []).length;
}

// ─────────────────────────────────────────────────────────────────────────
// COURT ROSTERS
// ─────────────────────────────────────────────────────────────────────────

describe('a court is a handful of people doing a job on somebody else\'s vein', () => {
    it('stands somebody in every office, and parses', () => {
        for (const court of COURTS) {
            expect(() => CourtSchema.parse(court), court.id).not.toThrow();
            expect(court.roster.length, `${court.id} is an empty office`)
                .toBeGreaterThanOrEqual(3);
            for (const officer of court.roster) {
                expect(() => CourtOfficerSchema.parse(officer), officer.id).not.toThrow();
            }
        }
    });

    it('defines the court ordinal as a person rather than a rating', () => {
        for (const court of COURTS) {
            const strongest = strongestOfficerOf(court);
            expect(strongest.realmOrdinal, `${court.id} names nobody at its own ordinal`)
                .toBe(court.powerOrdinal);
            for (const officer of court.roster) {
                expect(officer.realmOrdinal, `${officer.id} outranks its own court`)
                    .toBeLessThanOrEqual(court.powerOrdinal);
            }
        }
    });

    it('gives the court ordinal to whoever holds the top office', () => {
        // The office named by `leaderTitleOfCourt` is not decorative: it belongs
        // to somebody, and that somebody is the number. The exception is a court
        // that is embodied by a faction in the sect catalog, which uses that
        // faction's own top rank instead - the province has been looking at the
        // real title for nine hundred years without knowing what it is.
        for (const court of COURTS) {
            const embodied = court.embodiedByFactionId
                ? getSect(court.embodiedByFactionId)
                : undefined;
            const top = embodied
                ? embodied.ranks[embodied.ranks.length - 1]
                : leaderTitleOfCourt(court);
            const holder = court.roster.find(o => o.title === top);
            expect(holder, `${court.id} has no ${top}`).toBeDefined();
            expect(holder!.realmOrdinal).toBe(court.powerOrdinal);
        }
    });

    it('names every office for the work and never for a rung', () => {
        const seen = new Set<string>();
        for (const court of COURTS) {
            for (const officer of court.roster) {
                // Disciple ladders belong to sects. A court does not teach.
                expect(officer.title, `${officer.id} borrows a disciple ladder`)
                    .not.toMatch(/disciple|servant|novice|apprentice/i);
                // 'Seat' is the Hollow Court's word and nobody else's.
                expect(officer.title, `${officer.id} borrows the Court vocabulary`)
                    .not.toMatch(/Seat/i);
                const key = `${court.id}::${officer.title}`;
                expect(seen.has(key), `duplicate office ${key}`).toBe(false);
                seen.add(key);
                expect(officer.office.length).toBeGreaterThan(60);
            }
        }
    });

    it('makes every officer a posting rather than a local growth', () => {
        for (const court of COURTS) {
            const apex = getApexInstitution(court.apexId);
            expect(apex, court.apexId).toBeDefined();
            const ladder = new Set(apex!.ranks.map(r => r.title));
            for (const officer of court.roster) {
                expect(
                    ladder.has(officer.apexRank),
                    `${officer.id} holds ${officer.apexRank}, which is not a ${apex!.name} rank`
                ).toBe(true);
            }
        }
    });

    it('keeps the office and the apex standing genuinely independent', () => {
        // The whole point of two columns is that they disagree. If sorting by
        // realm reproduced the office order everywhere, the second column would
        // be decoration.
        const disagreements = COURTS.filter(court => {
            const byRealm = [...court.roster].sort((a, b) => b.realmOrdinal - a.realmOrdinal);
            const apex = getApexInstitution(court.apexId)!;
            const rankOf = (title: string) => apex.ranks.findIndex(r => r.title === title);
            return byRealm.some((o, i) =>
                i > 0 && rankOf(o.apexRank) > rankOf(byRealm[i - 1].apexRank)
            );
        });
        expect(disagreements.length, 'realm and apex standing never once disagree')
            .toBeGreaterThanOrEqual(1);
    });

    it('gives every officer a wanting, a fear and one concrete thing', () => {
        const ids = new Set<string>();
        for (const court of COURTS) {
            for (const officer of court.roster) {
                expect(ids.has(officer.id), `duplicate officer id ${officer.id}`).toBe(false);
                ids.add(officer.id);
                expect(getCourtOfficer(officer.id), officer.id).toBeDefined();
                expect(officer.wants.length, `${officer.id} wants nothing`).toBeGreaterThan(2);
                expect(officer.fears.length, `${officer.id} fears nothing`).toBeGreaterThan(2);
                expect(officer.detail.length, `${officer.id} has no detail`).toBeGreaterThan(30);
            }
        }
    });

    it('sorts officers by realm on the way out, which is not the office order', () => {
        for (const court of COURTS) {
            const sorted = courtOfficers(court.id);
            expect(sorted.length).toBe(court.roster.length);
            for (let i = 1; i < sorted.length; i++) {
                expect(sorted[i].realmOrdinal).toBeLessThanOrEqual(sorted[i - 1].realmOrdinal);
            }
        }
        expect(courtOfficers('court-does-not-exist')).toEqual([]);
    });

    it('keeps a court out of the sect catalog even now that it has people', () => {
        for (const court of COURTS) {
            expect(getSect(court.id), `${court.id} must not be joinable`).toBeUndefined();
            for (const officer of court.roster) {
                // Court people live here, never in the member catalog, because
                // that catalog's invariants resolve a faction id through
                // `getSect` and a court id does not resolve.
                expect(getSect(officer.id)).toBeUndefined();
            }
        }
    });

    it('says why each court names its offices the way it does', () => {
        for (const court of COURTS) {
            expect(court.officesNote.length, `${court.id} offices note`).toBeGreaterThan(120);
        }
    });

    it('keeps the Warden titles on the half that kept the ground', () => {
        // This used to assert that the court and the sect were one body under
        // two names, by reading the court's offices out of the sect's rank
        // ladder through embodiedByFactionId. They are two bodies now - see
        // THE_KILN_SCHISM - so the join is gone and the titles have to stand on
        // their own. They still do: the Warden ranks the province has been
        // reading off that gate for nine hundred years are this court's
        // offices, and the people using them are the ones who stayed.
        const kiln = getCourt('court-kiln')!;
        expect(kiln.name).toBe('The Kiln Court');
        expect(kiln.embodiedByFactionId, 'the two halves must not be joined').toBeNull();

        // The swap guard.
        //
        // Both halves are named for one of the house's two old names, and the
        // names are the whole content of the split - so a reader looking at
        // either record in isolation cannot tell whether they have been put on
        // the right body. This pins the pairing in both directions at once.
        //
        // It nearly went wrong: the court's own id was `court-root-sill` while
        // its name was 'The Kiln Court', so the half that kept the ground was
        // calling itself by its sibling's name in its own id and in its own
        // officesNote. That is the schism written down wrong, not the schism,
        // and it is exactly the mistake this assertion exists to catch.
        const walked = getSect('sect-kiln-wardens')!;
        expect(walked.name, 'the half that walked keeps the Survey\'s word for the posting')
            .toBe('The Root Sill Court');
        expect(kiln.name).not.toBe(walked.name);
        // The half that STAYED is under the old apex; the half that WALKED is
        // under the Long Cut. If these two ever read the same way round as each
        // other, the bodies have been swapped.
        expect(kiln.apexId, 'the half on the datum stayed with the Survey').toBe('apex-deep-survey');
        expect(
            getParentage('sect-kiln-wardens')?.parentFactionId,
            'the half that walked went to the Long Cut'
        ).toBe('apex-long-cut');
        // And the prose says the same thing the rows do.
        expect(THE_KILN_SCHISM.whoIsWhere).toContain('The Kiln Court holds the datum');
        expect(THE_KILN_SCHISM.whoIsWhere).toContain('The Root Sill Court is four provinces away');

        const titles = kiln.roster.map(o => o.title);
        expect(titles.some(t => /Keeper of the Kiln/.test(t)), 'the Keeper stayed').toBe(true);
        for (const officer of kiln.roster) {
            expect(officer.title.length, `${officer.id}`).toBeGreaterThan(3);
        }
        expect(strongestOfficerOf(kiln).realmOrdinal).toBe(kiln.powerOrdinal);
    });

    it('stands somebody on the ground the Ninth Face lost a candidate to', () => {
        // A court that took somebody to the last crossing and buried the ground
        // instead is a court with a posting nobody wants. It should be filled.
        const ninth = getCourt('court-ninth-face')!;
        expect(ninth.highWaterMark!.end).toBe('attempted');
        const scarPost = ninth.roster.find(o => /eleven li/i.test(o.title + o.office));
        expect(scarPost, 'nobody holds the scar').toBeDefined();
        expect(scarPost!.detail).toMatch(new RegExp(ninth.highWaterMark!.name));
    });
});

// ─────────────────────────────────────────────────────────────────────────
// DRIVE
// ─────────────────────────────────────────────────────────────────────────

const WITH_AMBITION = SECTS.filter(s => s.ambition);

describe('a faction wants something, and somebody is in the way', () => {
    it('gives most of the catalog a drive and leaves the abstainers explicit', () => {
        expect(WITH_AMBITION.length).toBeGreaterThanOrEqual(20);
        const silent = SECTS.filter(s => !s.ambition).map(s => s.id).sort();
        // The four that make no claims, and the reason is written into each of
        // them: a temple with no stated grievance, a grove that holds a
        // grievance to be a claim, staff with no interests of their own, and
        // four people with nothing left to be afraid of.
        expect(silent).toEqual([
            'sect-hollow-court',
            'sect-kiln-wardens',
            'sect-standing-grove',
            'sect-sweptground-temple'
        ]);
    });

    it('names a real body as the obstacle, never a circumstance', () => {
        for (const sect of WITH_AMBITION) {
            const a = sect.ambition!;
            expect(a.blockedBy.length, `${sect.id} is blocked by nobody`).toBeGreaterThan(0);
            for (const id of a.blockedBy) {
                expect(resolves(id), `${sect.id} is blocked by unknown ${id}`).toBe(true);
                expect(id, `${sect.id} blocks itself`).not.toBe(sect.id);
            }
        }
    });

    it('prices the wanting, and says how far it has actually gone', () => {
        for (const sect of WITH_AMBITION) {
            const a = sect.ambition!;
            expect(a.wants.length, `${sect.id} wants something vague`).toBeGreaterThan(40);
            expect(a.wouldCost.length, `${sect.id} pays nothing for it`).toBeGreaterThan(80);
            expect(a.movedOn.length, `${sect.id} has done nothing about it`).toBeGreaterThan(40);
        }
    });

    it('scales the ambition to what the house actually is', () => {
        // The rule that stops every entry becoming a bid for an arterial: a body
        // near the bottom of the power table does not have a quarrel with a
        // court or an apex, because it has never been in a room with one.
        // The one legitimate exception is a body whose own parent is a court:
        // naming your landlord is not reaching above your weight, it is the
        // only conversation you are actually in.
        for (const sect of WITH_AMBITION) {
            if (sect.powerOrdinal > 21) continue;
            const parent = getParentage(sect.id)?.parentFactionId ?? null;
            for (const id of sect.ambition!.blockedBy) {
                if (id === parent) continue;
                expect(
                    getCourt(id) ?? getApexInstitution(id),
                    `${sect.id} at ${sect.powerOrdinal} picks a fight with ${id}`
                ).toBeUndefined();
            }
        }
        // And the top of the table does reach that high, or the tier is inert.
        const reaching = WITH_AMBITION.filter(
            s => s.powerOrdinal >= 33 &&
                s.ambition!.blockedBy.some(id => getCourt(id) || getApexInstitution(id))
        );
        expect(reaching.length, 'nobody strong is gunning for anything')
            .toBeGreaterThanOrEqual(3);
    });

    it('keeps contested claims symmetric, the way rivalries are', () => {
        const offences: string[] = [];
        for (const sect of WITH_AMBITION) {
            for (const other of sect.ambition!.contestedWith) {
                expect(resolves(other), `${sect.id} contests unknown ${other}`).toBe(true);
                expect(other, `${sect.id} contests itself`).not.toBe(sect.id);
                const back = getSect(other)?.ambition?.contestedWith ?? [];
                if (!back.includes(sect.id)) {
                    offences.push(`${sect.id} contests ${other}, which does not contest back`);
                }
            }
        }
        expect(offences, offences.join('; ')).toEqual([]);
    });

    it('carries at least one contested claim that is not also a feud', () => {
        // Rivalry and contest are different objects. If every contested claim
        // sat on an existing rivalry the field would be a second `rivals`.
        const notFeuds = WITH_AMBITION.filter(s =>
            s.ambition!.contestedWith.some(id => !s.rivals.includes(id))
        );
        expect(notFeuds.length).toBeGreaterThanOrEqual(4);
    });

    it('finds contested claims from either end', () => {
        const frost = contestedClaimsOf('sect-frostmirror-court').map(s => s.id);
        expect(frost).toContain('sect-storm-tyrant-court');
        expect(contestedClaimsOf('sect-storm-tyrant-court').map(s => s.id))
            .toContain('sect-frostmirror-court');
        expect(contestedClaimsOf('sect-sweptground-temple')).toEqual([]);
    });

    it('puts three claimants on the one arterial the Third Sill administers', () => {
        // The most useful thing a register can carry is a claim two or more
        // parties have their hands on, and this is the biggest one in the world.
        const claimants = SECTS.filter(
            s => s.ambition?.blockedBy.includes('court-third-sill') &&
                s.ambition.contestedWith.length >= 2
        );
        expect(claimants.map(s => s.id).sort()).toContain('sect-frostmirror-court');
        expect(claimants.length).toBeGreaterThanOrEqual(3);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// EVERY FACTION SAYS MORE THAN ONE THING ABOUT ITSELF
// ─────────────────────────────────────────────────────────────────────────

describe('descriptions carry facts rather than a headline', () => {
    it('gives every faction at least three real sentences', () => {
        for (const sect of SECTS) {
            expect(sentences(sect.description), `${sect.id} is a one-liner`)
                .toBeGreaterThanOrEqual(3);
            expect(sect.description.length, `${sect.id} description is thin`)
                .toBeGreaterThan(500);
        }
    });

    it('does not simply restate the structured fields', () => {
        for (const sect of SECTS) {
            // The rank ladder and the admission bar are already columns.
            expect(sect.description, `${sect.id} recites its own ladder`)
                .not.toContain(sect.ranks.join(', '));
            expect(sect.description, `${sect.id} restates its admission ordinal`)
                .not.toMatch(new RegExp(`admissionOrdinal|ordinal ${sect.admissionOrdinal}\\b`));
        }
    });

    it('names the dao in every house entry', () => {
        for (const house of DAO_HOUSES) {
            expect(house.description.toLowerCase(), `${house.id} never says its dao`)
                .toContain(house.principle);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// A HOUSE IS A FAMILY
// ─────────────────────────────────────────────────────────────────────────

describe('the dao houses take nobody at a gate', () => {
    it('offers exactly one route in, and it is adoption', () => {
        for (const house of DAO_HOUSES) {
            expect(house.admission.route).toBe('adoption');
            expect(intakeRouteOf(house.id), house.id).toBe('adoption');
        }
    });

    it('leaves the boolean flag alone, because the engine reads it as one', () => {
        // `recruits` answers whether there is a way in at all, and for a house
        // the honest answer is yes. The three-valued read lives in
        // `intakeRouteOf`, which is the one place to widen if the engine, the
        // tool layer and the register ever want the distinction.
        for (const house of DAO_HOUSES) {
            expect(house.recruits, `${house.id} would vanish from every admission path`)
                .toBe(true);
        }
        expect(intakeRouteOf('sect-kiln-wardens')).toBe('closed');
        expect(intakeRouteOf('sect-azure-cloud-pavilion')).toBe('open');
        expect(intakeRouteOf('nobody')).toBeUndefined();
    });

    it('requires a prodigy in that house\'s own dao and nothing else', () => {
        for (const house of DAO_HOUSES) {
            const a = house.admission;
            expect(a.prodigyIn.length, `${house.id} takes general talent`).toBeGreaterThan(60);
            expect(a.marriage.length).toBeGreaterThan(60);
            expect(a.surrendered.length, `${house.id} asks for nothing`).toBeGreaterThan(60);
            expect(a.lastTaken.length, `${house.id} does not date its last adoption`)
                .toBeGreaterThan(30);
        }
    });

    it('states what the form costs a house that cannot hire', () => {
        for (const house of DAO_HOUSES) {
            expect(house.admission.costOfTheForm.length, `${house.id} pays nothing for being a family`)
                .toBeGreaterThan(80);
        }
    });

    it('gives every house one family name, and they are all different', () => {
        const seen = new Set<string>();
        for (const house of DAO_HOUSES) {
            expect(house.houseSurname.length, `${house.id} has no family name`)
                .toBeGreaterThan(1);
            expect(seen.has(house.houseSurname), `two houses named ${house.houseSurname}`)
                .toBe(false);
            seen.add(house.houseSurname);
            expect(house.admission.naming, `${house.id} does not use its own family name`)
                .toContain(house.houseSurname);
        }
    });

    it('holds everything in its own name, outside the pyramid', () => {
        // A sect can be leaned on through whoever renews it. A house cannot be
        // leaned on at all, which is why its territory is never a grant.
        for (const house of DAO_HOUSES) {
            expect(house.territory.toLowerCase(), `${house.id} holds on a grant`)
                .not.toMatch(/\bgrant(ed)?\b|at sufferance|on terms from/);
        }
    });

    it('keeps a house measurable against the sects it is not', () => {
        for (const house of DAO_HOUSES) {
            expect(SECTS.some(s => s.id === house.id), `${house.id} missing from SECTS`).toBe(true);
        }
        expect(DAO_HOUSES.length).toBe(7);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE TIER MARKER IN A NAME
// ─────────────────────────────────────────────────────────────────────────

describe('a name in the pyramid says which tier it is', () => {
    it('marks the court that spent nine hundred years not looking like one', () => {
        // The house split and each half kept one of its two names. This one
        // walked; the body still on the datum is the Kiln Court under the Deep
        // Survey. Nothing else about it changed - still closed, still teaching
        // nothing - which is why it is still filed here rather than as a sect.
        const walked = getSect('sect-kiln-wardens')!;
        expect(walked.name).toBe('The Root Sill Court');
        expect(walked.recruits).toBe(false);
        expect(walked.teaches.length).toBe(0);
        expect(walked.description).toContain('Kiln Wardens');
    });

    it('stops a feeder claiming a tier its roster cannot cover', () => {
        // Every body in the world called a Court sits at 34 or above except the
        // Hollow Court's own separate meaning of the word. A feeder at 27 that
        // administers nothing and issues nothing is a sect, and its name now
        // says so - while the vestigial rank at the top of its ladder is the
        // fossil of the founder who called it a Court.
        const mist = getSect('sect-azure-mist-court')!;
        // Raised from twenty-seven, where it was three realms under every
        // other court in the catalog and could not carry the name. It stands
        // at thirty-seven now, it is the Pavilion's own court in COURTS, and the
        // name came back with the standing.
        expect(mist.name).toBe('Azure Mist Court');
        expect(mist.powerOrdinal).toBe(37);
        expect(mist.ranks).toContain('Court Warden');
        expect(mist.description).toMatch(/Court/);
    });

    it('keeps every body actually called a Court above the feeder band', () => {
        const named = SECTS.filter(s => /\bCourt\b/.test(s.name));
        for (const s of named) {
            expect(s.powerOrdinal, `${s.id} is called a Court at ${s.powerOrdinal}`)
                .toBeGreaterThanOrEqual(34);
        }
        expect(named.length).toBeGreaterThanOrEqual(4);
    });

    it('leaves the bodies outside the pyramid unmarked, which is honest', () => {
        // A tier marker on something that is not in the stack would be a lie.
        for (const house of DAO_HOUSES) {
            expect(house.name, `${house.id} claims a tier it is not in`)
                .not.toMatch(/\bCourt\b|\bSect\b/);
        }
        expect(getSect('sect-the-severed')!.name).toBe('The Severed');
    });

    it('leaves the apex free to be called anything', () => {
        expect(APEX_INSTITUTIONS.length).toBe(3);
        expect(APEX_INSTITUTIONS.map(a => a.name)).toContain('The Deep Survey');
    });
});
