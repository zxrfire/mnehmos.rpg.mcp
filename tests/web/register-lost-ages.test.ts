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
    it('marks the unconfirmed holding as unconfirmed', () => {
        const believed = MEDICINE_HOLDINGS.filter(m => m.standing === 'believed_to_hold');
        expect(believed.length).toBeGreaterThan(0);
        expect(HTML).toContain('believed to</em> hold one');
        // The authoring note is that the ambiguity is worth more than either
        // answer. A sheet that picked one would be destroying the content.
        expect(HTML).toMatch(/never been confirmed/i);
    });

    it('says what became of the spent ones and nothing about the rest', () => {
        expect(HTML).toContain('Who still has theirs');
        for (const row of MEDICINE_HOLDINGS.filter(m => m.whatBecameOfIt !== null)) {
            expect(row.whatBecameOfIt).toBeTruthy();
        }
    });
});

describe('what cannot be made', () => {
    it('lists every lost material with its downstream closures', () => {
        expect(HTML).toContain('Materials nobody can gather');
        expect(LOST_MATERIALS.length).toBeGreaterThan(0);
    });

    it('resolves ids to names rather than printing ids at a reader', () => {
        const gated = LOST_MATERIALS.flatMap(m => m.gatesTechniqueIds);
        // If a gated art is named anywhere on the sheet it must be by its name,
        // never by its slug. A register printing raw ids has stopped being a
        // document and become a dump.
        for (const id of gated) expect(HTML).not.toContain(`>${id}<`);
    });
});
