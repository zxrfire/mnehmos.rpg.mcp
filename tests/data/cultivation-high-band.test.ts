/**
 * The band above Grand Ascension, and the one thing every row in it owes.
 *
 * The Standing Register assembles its top tab from six catalogs at once -
 * `MEMBERS`, the ancestral rolls and their sealed entries, the apex seats, the
 * court rosters, the withdrawn Seats and the crossings - and the tab is the
 * only place in the world where those six are read side by side. Nothing else
 * in the suite tests them as one set, so nothing else notices when one of them
 * puts somebody up there with no way to refer to them.
 *
 * THE RULE, WHICH IS A PROPERTY OF THE BAND AND NOT OF ANY FACTION
 * ---------------------------------------------------------------
 * At or above Grand Ascension, everybody has at least a TITLE. Not a name: a
 * name is a thing the world may genuinely not have, and half the people up here
 * are unnameable on purpose. A title is what the province calls them or the
 * office they hold, and it is available even where the name is withheld -
 * `the Lamp Lord`, `the Second Seat`, `The Keeper who holds the count`,
 * `The one who introduces herself as four bonds and a name`. All of those say
 * what somebody is and what they do while conceding nothing.
 *
 * What is banned is the placeholder: `unnamed`, `strongest member`, a bare
 * count. Those are not facts about the world, they are the catalog declining to
 * answer, and at this altitude there are roughly thirty people total - the
 * register can afford a line for each.
 *
 * A COUNT IS NOT A PERSON
 * -----------------------
 * The second half of the file, and the reason the first half was not enough.
 * The Hollow Court's roll used to carry two entries for six crossings, the
 * second of which read `Five more in succession` - a row shaped like a person
 * holding a number. Everything downstream then had to guess: the register
 * subtracted the roll (2) from the lineage count (6) and reported four
 * anonymous crossings, of which three were printed as names that had gone. They
 * had not gone. They were on the Court's own tablets and the roll had folded
 * them into one line.
 *
 * So a roll may hold fewer people than the lineage count only by one, and that
 * one is the most recent, which lives in `crossings.ts` because it is the only
 * name a house of this kind lets out. Any larger gap is a fold, and a fold is a
 * count wearing a person's row.
 */

import { describe, it, expect } from 'vitest';

import { REALM_TIERS, TRUE_IMMORTAL_ORDINAL } from '../../src/engine/cultivation/realms.js';
import {
    SECTS,
    SECT_ANCESTRY,
    WITHDRAWN_POWERS,
    getSect
} from '../../src/data/cultivation/sects.js';
import {
    APEX_INSTITUTIONS,
    COURTS,
    idsForFaction,
    leaderTitleOf,
    secondTitleOf,
    strongestOfficerOf
} from '../../src/data/cultivation/hierarchy.js';
import { MEMBERS } from '../../src/data/cultivation/members.js';
import { LINEAGE_STANDINGS } from '../../src/data/cultivation/crossings.js';
import { WANDERERS } from '../../src/data/cultivation/wanderers.js';

/**
 * The floor, read off the ladder rather than typed. `realms.ts` is the
 * authority on where Grand Ascension starts and the register takes the same
 * number from the same place.
 */
const FLOOR = REALM_TIERS.find(t => t.key === 'grand_ascension')!.ordinalStart;

/** One person the band can place, and the string anybody would refer to them by. */
interface Placed {
    /** Where the title came from, so a failure names the catalog to open. */
    source: string;
    /** The body that places them, so a repeat can be checked against `idsForFaction`. */
    factionId: string;
    title: string;
    ordinal: number;
}

/**
 * What a title may not be.
 *
 * Placeholders, and counts. `4 who crossed` is the register's own fallback for
 * a lineage the roll cannot cover, and it is exactly the string this band must
 * never need.
 */
const PLACEHOLDER = /^(unnamed|unknown|nameless|anonymous|strongest member|the strongest member|n\/a|none|tbd|\?+|-+)$/i;
const A_COUNT = /^\s*(\d|one |two |three |four |five |six |seven |eight |nine |ten )/i;
const A_FOLD = /\b(more in succession|and the rest|and others|others in|several more)\b/i;

/** Everybody the register can put at or above the floor, from every catalog. */
function placeEveryone(): Placed[] {
    const out: Placed[] = [];

    // 1. The apex seats. Two per apex where the second is high enough, and the
    //    ordinary case for both is a title rather than a name - two of the three
    //    houses have never given an outsider one.
    for (const apex of APEX_INSTITUTIONS) {
        if (apex.powerOrdinal >= FLOOR) {
            out.push({
                source: `hierarchy.ts apex ${apex.id} pinned`,
                factionId: apex.id,
                title: apex.lastRealm.holderName ?? leaderTitleOf(apex),
                ordinal: apex.powerOrdinal
            });
        }
        if (apex.secondStrongestOrdinal >= FLOOR) {
            out.push({
                source: `hierarchy.ts apex ${apex.id} second`,
                factionId: apex.id,
                title: secondTitleOf(apex),
                ordinal: apex.secondStrongestOrdinal
            });
        }
    }

    // 2. The courts: the officer the ordinal actually refers to, and whoever the
    //    court records as having gone highest.
    for (const court of COURTS) {
        if (court.powerOrdinal >= FLOOR) {
            out.push({
                source: `hierarchy.ts court ${court.id} strongest officer`,
                factionId: court.id,
                title: strongestOfficerOf(court).name,
                ordinal: court.powerOrdinal
            });
        }
        const hwm = court.highWaterMark;
        if (hwm && hwm.ordinal >= FLOOR) {
            out.push({
                source: `hierarchy.ts court ${court.id} high-water mark`,
                factionId: court.id,
                title: hwm.name,
                ordinal: hwm.ordinal
            });
        }
    }

    // 3. The withdrawn Seats, which are the clearest case of the rule: four
    //    people with no names anywhere in the catalog and an ordinal position
    //    each, which is a title and is enough.
    for (const [factionId, power] of Object.entries(WITHDRAWN_POWERS)) {
        for (const seat of power.seats) {
            if (seat.ordinal < FLOOR) continue;
            out.push({
                source: `sects.ts WITHDRAWN_POWERS ${factionId}`,
                factionId,
                title: seat.position,
                ordinal: seat.ordinal
            });
        }
    }

    // 4. A sect standing in the band answers for it with somebody. Either it has
    //    withdrawn Seats, or `MEMBERS` carries the outlier the ordinal refers
    //    to; a sect with neither leaves the register printing the office.
    for (const sect of SECTS) {
        if (sect.powerOrdinal < FLOOR) continue;
        if (WITHDRAWN_POWERS[sect.id]) continue;
        const top = MEMBERS
            .filter(m => m.factionId === sect.id && m.outlier)
            .sort((a, b) => b.realmOrdinal - a.realmOrdinal)[0];
        out.push({
            source: `members.ts outlier for ${sect.id}`,
            factionId: sect.id,
            title: top?.name ?? '',
            ordinal: sect.powerOrdinal
        });
    }

    // 5. The rolls: everybody still load-bearing, which is the ascended and the
    //    sealed. Both are recorded with a rung precisely because somebody had to
    //    be able to afford it.
    for (const [hostId, record] of Object.entries(SECT_ANCESTRY)) {
        for (const a of record.ancestors) {
            if ((a.realmOrdinal ?? 0) < FLOOR) continue;
            out.push({
                source: `sects.ts ancestry ${hostId} (${a.fate})`,
                factionId: hostId,
                title: a.name,
                ordinal: a.realmOrdinal as number
            });
        }
    }

    // 6. The crossings a house produced rather than a house was built by. Only
    //    the most recent is named, and that name is the whole entry.
    for (const standing of LINEAGE_STANDINGS) {
        out.push({
            source: `crossings.ts standing ${standing.factionId}`,
            factionId: standing.factionId,
            title: standing.mostRecentCrossingName ?? '',
            ordinal: TRUE_IMMORTAL_ORDINAL
        });
    }

    // 7. And the one person no institution holds.
    for (const w of WANDERERS) {
        if (w.lastOrdinal < FLOOR) continue;
        out.push({
            source: `wanderers.ts ${w.id}`,
                factionId: w.affiliation?.factionId ?? w.id,
            title: w.recordName,
            ordinal: w.lastOrdinal
        });
    }

    return out;
}

describe('everybody at or above Grand Ascension has at least a title', () => {
    const placed = placeEveryone();

    it('places a band worth having a rule about', () => {
        // If this collapses the rest of the file is passing vacuously. Roughly
        // thirty people, and the number is a range because the catalogs move.
        expect(placed.length).toBeGreaterThanOrEqual(25);
        for (const p of placed) expect(p.ordinal).toBeGreaterThanOrEqual(FLOOR);
    });

    it('gives every one of them something to be called', () => {
        for (const p of placed) {
            expect(p.title.trim().length, `${p.source} has nothing to print`).toBeGreaterThan(0);
            expect(PLACEHOLDER.test(p.title.trim()), `${p.source} prints a placeholder: ${p.title}`)
                .toBe(false);
        }
    });

    it('never lets a count stand in for a person', () => {
        for (const p of placed) {
            expect(A_COUNT.test(p.title), `${p.source} opens with a number: ${p.title}`).toBe(false);
            expect(A_FOLD.test(p.title), `${p.source} folds several people into one row: ${p.title}`)
                .toBe(false);
        }
    });

    it('writes a title rather than a bare word, so the row says what somebody is', () => {
        for (const p of placed) {
            expect(p.title.trim().split(/\s+/).length, `${p.source} title is one word: ${p.title}`)
                .toBeGreaterThanOrEqual(2);
        }
    });

    it('repeats a title only where one person is filed under two ids', () => {
        // The Azure Mist is a court and a sect under two ids that `idsForFaction`
        // joins, so its Warden is legitimately placed twice and is one person.
        // A title repeating across bodies that are NOT joined is two people the
        // catalog cannot tell apart, and at this altitude there are thirty of
        // them and no excuse.
        const byTitle = new Map<string, Placed[]>();
        for (const p of placed) {
            const key = p.title.trim().toLowerCase();
            byTitle.set(key, [...(byTitle.get(key) ?? []), p]);
        }
        for (const [title, group] of byTitle) {
            if (group.length === 1) continue;
            const ids = new Set(group.flatMap(p => idsForFaction(p.factionId)));
            const joined = group.every(p => idsForFaction(group[0].factionId).includes(p.factionId));
            expect(joined, `"${title}" is placed by ${[...ids].join(', ')} and they are not the same body`)
                .toBe(true);
        }
        expect(byTitle.size).toBeGreaterThan(20);
    });
});

describe('an ancestral roll holds people, never a count of them', () => {
    it('gives every crossing on a roll the rung it stands at', () => {
        // Ascension lands on one rung and it is the top of the ladder. An
        // ascended ancestor with no ordinal is invisible to anything reading
        // the band by height, which is how five of the Hollow Court's six went
        // missing from a sheet that lists everybody above Grand Ascension.
        for (const [hostId, record] of Object.entries(SECT_ANCESTRY)) {
            for (const a of record.ancestors) {
                if (a.fate !== 'ascended') continue;
                expect(a.realmOrdinal, `${hostId}: ${a.name} crossed and stands nowhere`)
                    .toBe(TRUE_IMMORTAL_ORDINAL);
                expect(a.afterCrossing, `${hostId}: ${a.name} has no recorded outcome above`)
                    .not.toBeNull();
            }
        }
    });

    it('lets a lineage count run at most one ahead of the roll that backs it', () => {
        // One is the legitimate gap and it is the most recent crossing, which
        // `crossings.ts` carries because it is the only one a house of this
        // kind has let out. Two or more means the roll folded people together,
        // and the register will print the difference as names that have gone.
        for (const standing of LINEAGE_STANDINGS) {
            const record = SECT_ANCESTRY[standing.factionId];
            if (!record) {
                // Apexes have no roll at all, which is a different fact and is
                // stated where it matters rather than repaired here.
                expect(getSect(standing.factionId), `${standing.factionId} is a sect with no roll`)
                    .toBeUndefined();
                continue;
            }
            const onTheRoll = record.ancestors.filter(a => a.fate === 'ascended').length;
            expect(onTheRoll, `${standing.factionId} rolls more crossings than it produced`)
                .toBeLessThanOrEqual(standing.count);
            expect(standing.count - onTheRoll,
                `${standing.factionId} counts ${standing.count} crossings and rolls ${onTheRoll}`)
                .toBeLessThanOrEqual(1);
        }
    });

    it('says in the standing note what a count taken across two catalogs is made of', () => {
        // The failure this prevents is a reader adding a roll to a count and
        // getting a number nobody meant. Where a house's crossings are split
        // between its roll and `crossings.ts`, the roll says so.
        for (const standing of LINEAGE_STANDINGS) {
            const record = SECT_ANCESTRY[standing.factionId];
            if (!record) continue;
            const onTheRoll = record.ancestors.filter(a => a.fate === 'ascended').length;
            if (standing.count === onTheRoll) continue;
            expect(record.standingNote, `${standing.factionId} splits its crossings and does not say so`)
                .toMatch(/crossings\.ts/);
        }
    });
});
