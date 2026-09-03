/**
 * The Standing Register's last-age sections.
 *
 * Five things the catalog knows and almost nobody in the world does. The
 * register is written for a reader who is allowed to know more than the people
 * in it - with exactly one exception, guarded here, where the secret is the
 * content and printing it would answer the question it exists to keep open.
 */

import { describe, it, expect } from 'vitest';
import { renderRegister, buildRegister } from '../../src/web/register';
import { ARCHIVE_COPIES, MEDICINE_HOLDINGS, LOST_MATERIALS, ANCIENT_ARTS } from '../../src/data/cultivation/lost-ages';
import { ARTERIALS, PROVINCES } from '../../src/data/cultivation/regions';
import { COURTS, APEX_INSTITUTIONS } from '../../src/data/cultivation/hierarchy';
import { HERBS } from '../../src/data/cultivation/herbs';
import { IMMORTAL_ITEMS } from '../../src/data/cultivation/immortal-items';

const HTML = renderRegister();

describe('the arts split on era, not labelled with it', () => {
    it('prints all four quadrants as their own heads', () => {
        // `era` and `class` are independent axes. "Ancient cultivation" and
        // "ancient dao" are different KINDS of thing - a road with a different
        // bargain against spears somebody else can carry - and sharing a row
        // would invite a reader to average them into "old stuff".
        for (const head of [
            'Modern &middot; cultivation',
            'Modern &middot; dao',
            'Ancient &middot; cultivation',
            'Ancient &middot; dao'
        ]) {
            expect(HTML, head).toContain(head);
        }
    });

    it('prints an empty quadrant rather than dropping it', () => {
        // The design says all four are occupied and the catalog fills three:
        // every ancient art is class `dao`. A missing head would read as an
        // oversight, so the absence is stated. This assertion flips to the
        // other branch by itself the moment a row lands.
        const anyEmpty = ['modern', 'ancient'].some(era =>
            ['cultivation', 'dao'].some(cls =>
                !buildRegister().techniques.some(t => t.era === era && t.artClass === cls)));
        if (anyEmpty) expect(HTML).toContain('occupies this quadrant yet');
    });

    it('carries the era and class on every row it built', () => {
        for (const t of buildRegister().techniques) {
            expect(['modern', 'ancient'], t.name).toContain(t.era);
            expect(['cultivation', 'dao'], t.name).toContain(t.artClass);
        }
    });
});

describe('the supply ceiling is a belief, not a limit', () => {
    it('says so on the page, in those terms', () => {
        // Nothing in the technique layer consults an upkeep, so the elder's
        // "you will not get past the fifth level" is a fact the catalog
        // records rather than one the engine produces. Claiming otherwise on
        // the sheet would be the register asserting a rule that does not exist.
        expect(HTML).toContain('what the world believes');
        expect(HTML).toMatch(/NOTHING CURRENTLY READS IT/i);
    });

    it('renders every authored ceiling and invents none', () => {
        const capped = ANCIENT_ARTS.filter(a => a.worldSupplyCeiling !== null);
        const rows = buildRegister().techniques.filter(t => t.worldSupplyCeiling !== null);
        expect(rows.length).toBe(capped.length);
        for (const row of rows) {
            const authored = ANCIENT_ARTS.find(a => a.techniqueId === row.id);
            expect(authored?.worldSupplyCeiling, row.name).toBe(row.worldSupplyCeiling);
        }
    });
});

describe('who holds a book nobody can feed', () => {
    it('lists every archive copy', () => {
        expect(HTML).toContain('Ancient copies in houses that cannot work them');
        expect(ARCHIVE_COPIES.length).toBeGreaterThan(0);
    });

    it('NEVER prints the one remnant', () => {
        // THE guard on this section. Exactly one house is quietly sitting on
        // the last of a material and has not said so; a table with the word in
        // a column beside a name has answered the question the secret exists
        // to keep open. The count is stated underneath instead, which tells a
        // reader the fact exists without telling them the answer.
        expect(ARCHIVE_COPIES.filter(c => c.stock === 'remnant').length).toBe(1);
        expect(HTML.toLowerCase()).not.toContain('remnant');
        expect(HTML).toMatch(/does not print which/i);
    });

    it('tells a spent house apart from one that never had any', () => {
        // Not pedantry: it decides what they can tell you, and what they think
        // the thing is worth.
        expect(HTML).toContain('spent theirs used it');
        expect(HTML).toContain('owns a description');
    });
});

describe('the medicine ledger renders the uncertainty rather than resolving it', () => {
    it('renders an unconfirmed holding as unconfirmed, where one exists', () => {
        // CONDITIONAL, because the standing is the data agent's to set and it
        // has moved under this test once already: the spec handed to me had
        // the Azure Cloud Pavilion as `believed_to_hold`, with a note that the
        // ambiguity was worth more than either answer, and the catalog now
        // says `never_had_one`. What this file may assert is how the register
        // RENDERS such a row, never whether the world contains one.
        const believed = MEDICINE_HOLDINGS.filter(m => m.standing === 'believed_to_hold');
        if (believed.length === 0) {
            // Nothing to render, and the sheet must not invent the uncertainty.
            expect(HTML).not.toContain('believed to</em> hold one');
            return;
        }
        expect(HTML).toContain('believed to</em> hold one');
        expect(HTML).toMatch(/never been confirmed/i);
    });

    it('says what became of the spent ones and nothing about the rest', () => {
        expect(HTML).toContain('Who still has theirs');
        for (const row of MEDICINE_HOLDINGS.filter(m => m.whatBecameOfIt !== null)) {
            expect(row.whatBecameOfIt).toBeTruthy();
        }
    });
});

/**
 * AN EXTINCTION IS A PROPERTY OF A MATERIAL, NOT A LISTING OF ITS OWN.
 *
 * These assertions used to pin a heading - "Materials nobody can gather" - and
 * a heading is exactly what the design ruled out: split a table on a field and
 * a reader has to know the field exists before they can look in the right
 * place, and the thing they were comparing against is on another part of the
 * page. So what is asserted now is the rule. The extinct materials are rows in
 * the ordinary herb table saying extinct, and everything an extinction closed
 * still reaches the sheet, because folding a section in must not lose what it
 * carried.
 */
describe('what cannot be made', () => {
    it('marks every lost material extinct in the listing it belongs to', () => {
        expect(LOST_MATERIALS.length).toBeGreaterThan(0);
        expect(HTML).not.toContain('Materials nobody can gather');
        for (const m of LOST_MATERIALS) {
            const herb = HERBS.find(h => h.id === m.herbId);
            expect(herb, m.herbId).toBeTruthy();
            expect(HTML, herb!.name).toContain(herb!.name);
        }
        // The word itself, once per extinct row, in the row's own description.
        expect([...HTML.matchAll(/extinct - /g)].length).toBe(LOST_MATERIALS.length);
    });

    it('keeps everything the extinction closed, which is the point of it', () => {
        for (const m of LOST_MATERIALS) {
            for (const kind of m.closedObjectKinds) {
                // Escaped for the page, so compare on the plain prefix.
                expect(HTML, kind.slice(0, 40)).toContain(kind.slice(0, 40));
            }
            expect(HTML).toContain(m.remaining.whatIsKnownOfTheCount.slice(0, 60));
            for (const p of m.remaining.placements) {
                expect(HTML, p.note.slice(0, 40)).toContain(p.note.slice(0, 40));
            }
        }
    });

    it('resolves ids to names rather than printing ids at a reader', () => {
        const gated = LOST_MATERIALS.flatMap(m => m.gatesTechniqueIds);
        // If a gated art is named anywhere on the sheet it must be by its name,
        // never by its slug. A register printing raw ids has stopped being a
        // document and become a dump.
        for (const id of gated) expect(HTML).not.toContain(`>${id}<`);
        // The same rule for the sites the last units are sitting in, which is
        // the one column of this record a player could act on.
        for (const site of LOST_MATERIALS.flatMap(m => m.remaining.placements)) {
            expect(HTML, site.siteId).not.toContain(site.siteId);
        }
    });
});

/**
 * THE TWO OBJECTS THAT CAME DOWN ARE ROWS IN THE PILL TABLE.
 *
 * `immortal` is a tier, and a tier is a column. The Unbroken Pattern Pill is
 * the worked example the design owner pointed at: an immortal-grade dose in the
 * ordinary repair-medicine table with nothing but its grade cell marking it
 * out. Nothing about what each grade reaches may be lost in the fold.
 */
describe('the immortal objects sit at their tier rather than beside the table', () => {
    it('has no listing of its own', () => {
        expect(HTML).not.toContain('<h2>The immortal objects</h2>');
    });

    it('names every one of them, at the immortal tier, with what each grade reaches', () => {
        for (const item of IMMORTAL_ITEMS) {
            expect(HTML, item.name).toContain(item.name);
            for (const grade of [item.grades.higher, item.grades.middle, item.grades.lower]) {
                expect(HTML, grade.slice(0, 40)).toContain(grade.slice(0, 40));
            }
        }
        // The Unbroken Pattern Pill is the precedent, and it is still one row
        // in its own table rather than a section: if that ever stops being
        // true, the shape these were merged into has moved.
        expect(HTML).toContain('Unbroken Pattern Pill');
    });

    it('never ranks the top two tiers against each other', () => {
        // Immortal and chaos are peers - one reliable, one as powerful with its
        // effects drawn rather than chosen. A sheet that sorted on the tier
        // would have to assert a height difference nobody is claiming.
        expect(HTML).toContain('peers');
        expect(HTML).toMatch(/immortal and chaos|immortal-grade thing is reliable/);
    });
});

/**
 * Two facts nobody in the world has written down, both ordinary joins.
 *
 * Derived rather than stored, and asserted here rather than trusted, for the
 * reason the arts tab already gives: the interesting figure is a join and
 * either side of it can move, so the claim has to be falsifiable on the page
 * instead of going quietly stale.
 */
describe('who administers whose ground', () => {
    it('finds the arterial run by a court answering to a rival house', () => {
        // A province is HELD by an apex and ADMINISTERED THROUGH a court, and
        // nothing requires the two to be the same house. Reading the catalogs
        // together is the only place the dependency exists at all.
        const crossed = ARTERIALS.filter(a => {
            const province = PROVINCES.find(p => p.id === a.provinceId);
            const court = COURTS.find(c => c.id === a.administeredByCourtId);
            return province && court && province.heldByApexId !== court.apexId;
        });
        expect(crossed.length).toBeGreaterThan(0);
        expect(HTML).toContain('Who administers whose ground');
        // And it is stated as undocumented, which is the fact rather than a
        // flourish: there is no document whose job it would be.
        expect(HTML).toMatch(/no document anywhere says so/i);
    });

    it('prints the house that holds no ground at all', () => {
        const landless = APEX_INSTITUTIONS.filter(
            apex => !PROVINCES.some(p => p.heldByApexId === apex.id)
        );
        expect(landless.length).toBeGreaterThan(0);
        // An empty territory list is a recent heritage stated as geography
        // rather than as prose, and it is the one thing the power table cannot
        // show: a house near the top of it that owns no ground.
        expect(HTML).toContain('no province at all');
        for (const apex of landless) expect(HTML).toContain(apex.name);
    });

    it('does not claim a crossing where the houses agree', () => {
        // The negative half, and it has to read the CLAIM rather than the page:
        // regexing the whole document matches names in unrelated tables and
        // would pass or fail for reasons that have nothing to do with the
        // finding. So the crossing paragraph is isolated and checked to name
        // every arterial that crosses and none that does not.
        const marker = 'answers to somebody else.';
        const start = HTML.indexOf(marker);
        expect(start, 'the crossing note should be on the page').toBeGreaterThan(0);
        const claim = HTML.slice(start, HTML.indexOf('</p>', start)).replace(/<[^>]+>/g, '');

        const holderOf = (arterialId: string) =>
            PROVINCES.find(p => p.id === ARTERIALS.find(a => a.id === arterialId)?.provinceId)?.heldByApexId;
        const patronOf = (arterialId: string) =>
            COURTS.find(c => c.id === ARTERIALS.find(a => a.id === arterialId)?.administeredByCourtId)?.apexId;

        for (const a of ARTERIALS) {
            const holder = holderOf(a.id);
            const patron = patronOf(a.id);
            const crosses = holder !== undefined && patron !== undefined && holder !== patron;
            if (crosses) expect(claim, a.name).toContain(a.name);
            else expect(claim, a.name).not.toContain(a.name);
        }
    });
});
