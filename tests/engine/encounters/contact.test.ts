/**
 * Design guards on the people you live with.
 *
 * The claim under test is not that contact fires. It is that a house is a
 * small number of people you keep running into, that meeting the same person
 * twelve times is one relationship and not twelve first meetings, and that
 * none of it is authored here.
 */

import { describe, expect, it } from 'vitest';
import {
    CONTACT_STRENGTH_STEP,
    contactFor,
    kindFor,
    rollEncounters,
    socialWeightFor,
    tieFor,
    withinSocialRange,
    type ContactKind,
    type ContactPerson,
    type EncounterOccurrence,
    type EncounterPlace,
    type Membership
} from '../../../src/engine/encounters/index.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { getMembersOf } from '../../../src/data/cultivation/members.js';

const seat: EncounterPlace = { id: 'v', name: 'Azure Cloud Pavilion', kind: 'sect_seat', danger: 0.15 };
const FACTION = 'sect-azure-cloud-pavilion';

const house: Membership = {
    factionId: FACTION, factionName: 'Azure Cloud Pavilion',
    rankIndex: 1, rankCount: 6, contribution: 0
};

/** The real roster, straight out of the catalog. Nothing invented for the test. */
const roster: ContactPerson[] = getMembersOf(FACTION).map(m => ({
    id: m.id, name: m.name, rankIndex: m.rankIndex, realmOrdinal: m.realmOrdinal, role: m.role,
    wants: m.wants, fears: m.fears, detail: m.detail, goodCompany: m.goodCompany,
    grievance: m.rivalry ? m.rivalry.grievance : null,
    teaches: m.teaching ? m.teaching.knows : null
}));

function who(ordinal: number) {
    return { id: 'c1', realmOrdinal: ordinal, fortune: 1, maxHp: 60, hp: 60, spiritStones: 40 };
}

function contactsOver(seed: string, turns: number, over: Record<string, unknown> = {}) {
    const out: EncounterOccurrence[] = [];
    for (let t = 0; t < turns; t++) {
        out.push(...rollEncounters({
            seed, startDay: t, days: 1, activity: 'abroad',
            cultivator: who(6), place: seat, membership: house, roster,
            locatability: 'known', ...over
        }).occurrences.filter(o => o.source === 'contact'));
    }
    return out;
}

describe('the roster is the cast', () => {
    it('exists without anybody authoring one', () => {
        expect(roster.length).toBeGreaterThan(0);
        for (const person of roster) {
            expect(person.name.length).toBeGreaterThan(0);
            expect(['peer', 'rival', 'master', 'senior']).toContain(person.role);
        }
    });

    it('never invents a person', () => {
        const ids = new Set(roster.map(p => p.id));
        for (const o of contactsOver('cast', 1500)) {
            expect(ids.has(o.contact!.person.id)).toBe(true);
        }
    });

    it('says nothing at all to somebody in no house', () => {
        const rogue = contactsOver('rogue', 2000, { membership: null });
        expect(rogue).toHaveLength(0);
        // And nothing to a member with nobody around them either.
        expect(contactsOver('empty', 2000, { roster: [] })).toHaveLength(0);
    });
});

describe('who turns up', () => {
    it('lets somebody far above notice you, rarely', () => {
        // The "elder who remembers your name" case. Cutting it off entirely -
        // which the first version did - deleted it, because in every real
        // roster the people with something to teach are far above you.
        expect(socialWeightFor(30, 6)).toBeGreaterThan(0);
        expect(socialWeightFor(30, 6)).toBeLessThan(socialWeightFor(7, 6));
    });

    it('drops somebody who has been told to stay out of your way', () => {
        expect(socialWeightFor(2, 30)).toBe(0);
        expect(withinSocialRange([{
            id: 'x', name: 'x', rankIndex: 0, realmOrdinal: 2, role: 'peer'
        }], 30)).toHaveLength(0);
    });

    it('is weighted toward people already known', () => {
        // A house is a small number of people you keep running into, not a
        // stream of strangers.
        const withStanding: ContactPerson[] = roster.map((p, i) => i === 0
            ? { ...p, standing: { type: 'sect_mate', strength: 0.3, times: 4 } }
            : p);

        let familiar = 0;
        let total = 0;
        for (let t = 0; t < 3000; t++) {
            const rng = forStream('known', 'probe', t);
            const met = contactFor({
                ordinal: 6, membership: house, roster: withStanding,
                activity: 'abroad', locatability: 'known', onDay: t, rng
            });
            if (!met) continue;
            total++;
            if (met.person.id === withStanding[0].id) familiar++;
        }
        expect(total).toBeGreaterThan(100);
        expect(familiar / total).toBeGreaterThan(1 / withStanding.length);
    });
});

describe('what kind of contact', () => {
    const base: ContactPerson = { id: 'p', name: 'P', rankIndex: 1, realmOrdinal: 6, role: 'peer' };

    it('reads the member row and never a name', () => {
        expect(kindFor({ ...base, realmOrdinal: 12, teaches: 'the fifth form' }, 6)).toBe('instruction');
        expect(kindFor({ ...base, realmOrdinal: 12 }, 6)).toBe('checked_on');
        expect(kindFor({ ...base, grievance: 'an uncle' }, 6)).toBe('friction');
        expect(kindFor({ ...base, role: 'rival' }, 6)).toBe('friction');
        expect(kindFor({ ...base, realmOrdinal: 2, grievance: 'a promotion' }, 6)).toBe('resentment');
        expect(kindFor({ ...base, realmOrdinal: 2 }, 6)).toBe('asked');
        expect(kindFor({ ...base, goodCompany: true }, 6)).toBe('company');
        expect(kindFor(base, 6)).toBe('errand');
    });

    it('produces more than one kind against a real roster', () => {
        const kinds = new Set(contactsOver('kinds', 3000).map(o => o.contact!.kind));
        expect(kinds.size).toBeGreaterThan(2);
    });

    it('stops the game only for an offer or a challenge', () => {
        for (const o of contactsOver('stop', 2000)) {
            const offer = o.contact!.kind === 'instruction' || o.contact!.kind === 'friction';
            expect(o.interrupts).toBe(offer);
            // Company is never a wound and never a windfall.
            expect(o.deltas).toEqual({ hp: 0, spiritStones: 0, satiety: 0, rations: 0 });
        }
    });

    it('states something true about the person every time', () => {
        for (const o of contactsOver('true', 1200)) {
            const person = o.contact!.person;
            expect(o.event.summary).toContain(person.name);
            expect(o.event.summary).toContain('Azure Cloud Pavilion');
            expect(o.event.summary).not.toMatch(/\{[a-zA-Z]+\}/u);
            expect(o.event.summary).not.toMatch(/\.\./u);
        }
    });
});

describe('accumulation', () => {
    const person: ContactPerson = {
        id: 'p', name: 'Cen Qingzhi', rankIndex: 1, realmOrdinal: 8, role: 'senior', goodCompany: true
    };

    it('deepens fast at first and slowly after', () => {
        let strength = 0;
        const steps: number[] = [];
        for (let n = 0; n < 30; n++) {
            const tie = tieFor('company', {
                ...person, standing: { type: 'sect_mate', strength, times: n }
            }, 100 + n);
            steps.push(tie.strengthDelta);
            strength += tie.strengthDelta;
        }
        expect(steps[0]).toBeCloseTo(CONTACT_STRENGTH_STEP, 4);
        expect(steps[29]).toBeLessThan(steps[0]);
        // Asymptotic: forty years of company does not reach certainty.
        expect(strength).toBeLessThan(1);
        expect(strength).toBeGreaterThan(0.5);
    });

    it('moves the tie up a short ladder as it accumulates', () => {
        const at = (strength: number, times: number, kind: ContactKind = 'company') =>
            tieFor(kind, { ...person, standing: { type: 'sect_mate', strength, times } }, 1).type;

        expect(at(0, 0)).toBe('sect_mate');
        expect(at(0.4, 5)).toBe('senior_brother');
        expect(at(0.9, 20, 'instruction')).toBe('master');
        // Friction runs the other way on the same scale.
        expect(at(0, 0, 'friction')).toBe('faction_rival');
        expect(at(0.3, 4, 'friction')).toBe('rival');
        expect(at(0.8, 12, 'friction')).toBe('enemy');
    });

    it('keeps attitude in words and never as a number', () => {
        for (const times of [1, 3, 6, 12]) {
            const warm = tieFor('company', {
                ...person, standing: { type: 'sect_mate', strength: 0.3, times }
            }, 1);
            expect(warm.attitude).not.toMatch(/[0-9]/u);
            expect(warm.attitude.length).toBeGreaterThan(10);
        }
        // A strong tie and a hostile attitude must be expressible together -
        // the social layer names that combination as the thing one scalar erases.
        const bitter = tieFor('friction', {
            ...person, standing: { type: 'rival', strength: 0.85, times: 14 }
        }, 1);
        expect(bitter.type).toBe('enemy');
        expect(bitter.attitude).toMatch(/hostilit/iu);
    });

    it('raises significance as the tie matters more', () => {
        const low = tieFor('company', { ...person, standing: null }, 1);
        const high = tieFor('company', {
            ...person, standing: { type: 'friend', strength: 0.8, times: 20 }
        }, 1);
        expect(low.significance).toBe('incidental');
        expect(high.significance).toBe('defining');
    });
});

describe('who finds you in a cave', () => {
    function inSeclusion(locatability: 'known' | 'private' | 'hidden') {
        let contact = 0;
        for (let s = 0; s < 60; s++) {
            contact += rollEncounters({
                seed: `sec-${s}`, startDay: 400, days: 20 * 360, activity: 'seclusion',
                cultivator: who(6), place: seat, membership: house, roster,
                locatability, limit: 32
            }).occurrences.filter(o => o.source === 'contact').length;
        }
        return contact;
    }

    it('is usually somebody from your own house, where they can find you', () => {
        // The senior sister who checks on you. This is the counterpart to the
        // locatability work: a `known` seclusion is one people can reach.
        const known = inSeclusion('known');
        const priv = inSeclusion('private');
        const hidden = inSeclusion('hidden');
        expect(known).toBeGreaterThan(0);
        expect(known).toBeGreaterThan(priv);
        expect(priv).toBeGreaterThan(hidden);
    });

    it('leaves somebody who vanished to be found by nobody in particular', () => {
        expect(inSeclusion('hidden')).toBeLessThan(inSeclusion('known') / 2);
    });
});

describe('a summons has a mouth', () => {
    it('is carried by a named person from the house, senior to them', () => {
        let found = 0;
        for (let t = 0; t < 8000 && found < 25; t++) {
            for (const o of rollEncounters({
                seed: 'mouth', startDay: t, days: 1, activity: 'abroad',
                cultivator: who(6), place: seat, membership: house, roster
            }).occurrences) {
                if (o.source !== 'summons') continue;
                found++;
                const mouth = o.duty!.spokenBy;
                expect(mouth, 'an order arrived from nobody in particular').not.toBeNull();
                expect(roster.map(p => p.id)).toContain(mouth!.id);
                expect(mouth!.rankIndex).toBeGreaterThan(house.rankIndex);
                expect(o.event.summary).toContain(mouth!.name);
            }
        }
        expect(found).toBeGreaterThan(0);
    });

    it('falls back to the institution speaking when no roster was supplied', () => {
        for (let t = 0; t < 8000; t++) {
            const sent = rollEncounters({
                seed: 'nomouth', startDay: t, days: 1, activity: 'abroad',
                cultivator: who(6), place: seat, membership: house
            }).occurrences.find(o => o.source === 'summons');
            if (sent) {
                expect(sent.duty!.spokenBy).toBeNull();
                // Still names the house, because `dutyLine` does that.
                expect(sent.event.summary).toContain('Azure Cloud Pavilion');
                return;
            }
        }
    });

    it('does not force the entry own faction slot to the summoning house', () => {
        // The bug this replaces: forcing `{faction}` produced "Azure Cloud
        // Pavilion has not sent anyone" immediately followed by Azure Cloud
        // Pavilion sending this cultivator.
        for (let t = 0; t < 8000; t++) {
            const sent = rollEncounters({
                seed: 'plague', startDay: t, days: 1, activity: 'abroad',
                cultivator: who(6), place: seat, membership: house, roster
            }).occurrences.find(o => o.source === 'summons' &&
                o.event.summary.includes('has not sent anyone'));
            if (sent) {
                expect(sent.event.summary).not.toContain('Azure Cloud Pavilion has not sent anyone');
                return;
            }
        }
    });
});

describe('determinism', () => {
    it('gives the same house the same social life', () => {
        const input = {
            seed: 'fixed', startDay: 900, days: 3600, activity: 'seclusion' as const,
            cultivator: who(6), place: seat, membership: house, roster,
            locatability: 'known' as const, limit: 32
        };
        expect(rollEncounters(input)).toEqual(rollEncounters(input));
    });
});
