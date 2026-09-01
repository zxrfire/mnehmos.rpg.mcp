/**
 * The faction history catalog, and the two properties it exists to guarantee.
 *
 * A history file is worth exactly what its cross-references are worth. Prose
 * that says two houses fought is unfalsifiable; a shared event with both
 * parties named, one date, and an account from each is checkable, and this
 * suite is what checks it.
 *
 * Two failure modes are guarded specifically, because both have happened in
 * this repo before:
 *
 *   - A DATE RESTATED IN PROSE. `docs/world/README.md` records a note that
 *     restated a house's power ordinal and had it wrong. Shared events are
 *     dated once, in one field, and nothing else may carry the figure.
 *   - AN ACCOUNT THAT NAMES A PARTY THE EVENT DOES NOT HAVE. The whole value of
 *     partisan accounts is that a reader can go and read the other one, so the
 *     account keys and the party list have to be the same set.
 */

import { describe, expect, it } from 'vitest';
import {
    FACTION_HISTORY,
    FactionHistorySchema,
    SHARED_EVENTS,
    SharedEventSchema,
    historyOf,
    otherPartiesTo,
    sharedEvent,
    sharedEventsFor
} from '../../src/data/cultivation/faction-history.js';
import { SECTS, getSect } from '../../src/data/cultivation/sects.js';
import {
    APEX_INSTITUTIONS,
    COURTS,
    getApexInstitution,
    getCourt
} from '../../src/data/cultivation/hierarchy.js';
import { getFactionCharacter } from '../../src/data/cultivation/faction-character.js';

/** Every id that names a real body, from all three catalogs at once. */
const KNOWN_BODIES = new Set<string>([
    ...SECTS.map(s => s.id),
    ...APEX_INSTITUTIONS.map(a => a.id),
    ...COURTS.map(c => c.id)
]);

const nameOf = (id: string): string =>
    getSect(id)?.name ?? getApexInstitution(id)?.name ?? getCourt(id)?.name ?? id;

describe('the shared events', () => {
    it('parses, and every party is a body that exists', () => {
        for (const e of SHARED_EVENTS) {
            SharedEventSchema.parse(e);
            for (const p of e.parties) {
                expect(KNOWN_BODIES.has(p), `${e.id} names ${p}, which is not in any catalog`).toBe(true);
            }
        }
    });

    it('has one account per party and no account without a party', () => {
        // The property that makes the cross-reference navigable. An account
        // keyed to somebody who is not a party is an account a reader cannot
        // get to from the other side, which is the whole failure this file is
        // built to prevent.
        for (const e of SHARED_EVENTS) {
            const parties = [...e.parties].sort();
            const keys = Object.keys(e.accounts).sort();
            expect(keys, `${e.id} parties and accounts disagree`).toEqual(parties);
        }
    });

    it('gives every id exactly once', () => {
        const ids = SHARED_EVENTS.map(e => e.id);
        expect(new Set(ids).size, 'a shared event id is used twice').toBe(ids.length);
    });

    it('never restates its own date in any account', () => {
        // Dated once, referenced twice. A year written into prose is a year
        // that will drift from the field, and the field is the one anything
        // reads.
        for (const e of SHARED_EVENTS) {
            const figures = [
                String(e.yearsAgo),
                e.yearsAgo.toLocaleString('en-US')
            ];
            for (const [party, text] of Object.entries(e.accounts)) {
                for (const fig of figures) {
                    expect(text.includes(fig), `${e.id}/${party} restates the date`).toBe(false);
                }
            }
        }
    });

    it('is a disagreement about meaning and never about the parties', () => {
        // Two houses remembering the same war differently is the point. Two
        // houses being different numbers of houses is a bug, so every account
        // has to be long enough to actually be an account rather than a
        // one-line concession.
        for (const e of SHARED_EVENTS) {
            expect(e.parties.length, `${e.id} is not shared`).toBeGreaterThanOrEqual(2);
            for (const [party, text] of Object.entries(e.accounts)) {
                expect(text.length, `${e.id}/${party} is too short to be an account`)
                    .toBeGreaterThan(150);
                expect(text, `${e.id}/${party} is the neutral text repeated`).not.toBe(e.what);
            }
        }
    });
});

describe('the per-faction histories', () => {
    it('parses, and every key is a body that exists', () => {
        for (const [id, h] of Object.entries(FACTION_HISTORY)) {
            FactionHistorySchema.parse(h);
            expect(h.factionId, `${id} disagrees with its own key`).toBe(id);
            expect(KNOWN_BODIES.has(id), `${id} is not in any catalog`).toBe(true);
        }
    });

    it('covers every faction in the sect catalog', () => {
        // The whole point is that a reader can open any entry and find out how
        // it got there. A partial pass reads as an authoring accident rather
        // than as a decision.
        const missing = SECTS.filter(s => !FACTION_HISTORY[s.id]).map(s => s.id);
        expect(missing, 'factions with no history').toEqual([]);
    });

    it('lists exactly the shared events it is actually a party to', () => {
        // Both directions, because either alone permits a silent hole: a
        // faction that forgot to list an event it is named in, and a faction
        // claiming an event that does not name it.
        for (const [id, h] of Object.entries(FACTION_HISTORY)) {
            const actual = sharedEventsFor(id).map(e => e.id).sort();
            expect([...h.sharedEvents].sort(), `${nameOf(id)} sharedEvents disagree with SHARED_EVENTS`)
                .toEqual(actual);
        }
    });

    it('names a real event in every reference', () => {
        for (const h of Object.values(FACTION_HISTORY)) {
            for (const id of h.sharedEvents) {
                expect(sharedEvent(id), `${h.factionId} cites unknown event ${id}`).toBeTruthy();
            }
        }
    });

    it('explains the unlit nodes wherever a house holds any, and nowhere else', () => {
        // The field a reader is most likely to check against the sect catalog,
        // because the count is right there. A house with dark nodes and no
        // account of them is the hole this file was written to close; a house
        // with none and an account of them is worse, because it is invented.
        for (const s of SECTS) {
            const h = FACTION_HISTORY[s.id];
            if (!h || !s.compound) continue;
            const dark = s.compound.formationNodesTotal - s.compound.formationNodesLit;
            if (dark > 0) {
                expect(h.whatTheUnlitNodesWere, `${s.name} holds ${dark} dark nodes and explains none`)
                    .toBeTruthy();
            } else {
                expect(h.whatTheUnlitNodesWere, `${s.name} has no dark nodes but explains some`)
                    .toBeNull();
            }
        }
    });

    it('accounts for the gap on every house the character catalog gives one', () => {
        for (const s of SECTS) {
            const c = getFactionCharacter(s.id);
            const h = FACTION_HISTORY[s.id];
            if (!c || !h) continue;
            // Not a claim about the size of the gap - a house at its own peak
            // has one worth explaining too, and three of them do. The claim is
            // only that somebody said why.
            expect(h.whyTheGapIs.length, `${s.name} has production and no account of it`)
                .toBeGreaterThan(150);
        }
    });

    it('never writes an ordinal into prose', () => {
        // The rule from `docs/world/README.md`. Ordinals belong to the ladder
        // and to `powerOrdinal`; a note that restates one has already been
        // wrong once. Bare two-digit numbers in the ladder's range are the
        // shape that mistake takes.
        const ladderFigure = /\b(1[3-9]|2\d|3\d|4[0-6])\b/;
        for (const [id, h] of Object.entries(FACTION_HISTORY)) {
            for (const field of ['origin', 'whyTheGapIs', 'whereTheWrongBeliefComesFrom'] as const) {
                expect(ladderFigure.test(h[field]), `${nameOf(id)}.${field} writes a bare ordinal`)
                    .toBe(false);
            }
        }
    });
});

describe('the two disputed claimants to one lineage', () => {
    it('are both parties to the same dated event', () => {
        // The coherence property the whole file exists for, on the case that
        // motivated it: the two bodies that each say they are the house are
        // both named in one event with one date, and each states its own
        // account of it. Neither carries the date in prose.
        const e = sharedEvent('event-the-reposting');
        expect(e, 'the reposting is not in the catalog').toBeTruthy();
        expect(e!.parties).toContain('court-kiln');
        expect(e!.parties).toContain('sect-kiln-wardens');
        expect(otherPartiesTo(e!, 'court-kiln')).toContain('sect-kiln-wardens');
        expect(otherPartiesTo(e!, 'sect-kiln-wardens')).toContain('court-kiln');

        // And the accounts differ, which is the whole value of holding two.
        expect(e!.accounts['court-kiln']).not.toBe(e!.accounts['sect-kiln-wardens']);
    });

    it('reaches the walking half through the faction catalog and the standing half through the court catalog', () => {
        // One claimant has a row in SECTS and the other a row in COURTS, which
        // is exactly why the account belongs to the body rather than to the
        // table. A lookup that only worked for one of them would make the
        // dispute unreadable from one side.
        expect(historyOf('sect-kiln-wardens')).toBeTruthy();
        expect(getCourt('court-kiln'), 'the standing half is not a court').toBeTruthy();
        expect(getSect('sect-kiln-wardens'), 'the walking half is not a faction').toBeTruthy();
    });
});
