/**
 * A ratchet on the Standing Register going stale.
 *
 * The sheet is the one place anybody can read what is in this world without
 * reading the code, and it fails silently. A catalog gets authored, wired into
 * the engine and tested, and no section is ever added - so the register keeps
 * rendering, keeps passing every test it has, and describes a smaller world than
 * the one the game runs. Nothing goes red, because nothing was ever asserted
 * about what the sheet is supposed to contain.
 *
 * MEASURED WHEN THIS WAS WRITTEN. 28 of the 54 catalog modules in
 * `src/data/cultivation/` were not imported by a single register module, and 74
 * of the 97 exports that are tables of rows were not named by one. The design
 * owner found three of them by reading the published sheet: *"i don't see spirit
 * beast material and crafting in the standing register nor do i see spirit boats
 * etc"*, and *"it's missing too much"*. Every one of the three was in the
 * catalogs, in the engine, and invisible.
 *
 * So: both numbers may fall and neither may rise. When this fails, the fix is
 * almost never to raise the baseline - it is to add the section, or to say in
 * the allow-list below that the catalog is machinery a reader should not be
 * shown, and why.
 *
 *     node scripts/find-catalogs-the-register-does-not-show.mjs
 *     node scripts/find-catalogs-the-register-does-not-show.mjs --exports
 *
 * WHAT THE TWO NUMBERS MEAN
 * -------------------------
 * The MODULE count asks whether any register module imports the file, with
 * re-exports followed. It cannot produce a false positive - a file nothing
 * imports is not on the sheet - and it is blunt: one line of `beasts.ts` shown
 * would clear the whole of it.
 *
 * The EXPORT count is the finer one and is the reading the owner's complaint
 * actually needed. `beasts.ts` holds the bestiary, the material table and the
 * tides, and a sheet naming only the first reads exactly like a sheet that shows
 * beasts. It is a proxy and it says so: a table reached through a reader
 * function rather than by name is reported unnamed, which is why it ratchets
 * rather than forbidding.
 *
 * THE MODULE COUNT IS NOW NOUGHT, AND THE LIST THAT USED TO BE HERE IS GONE
 * -------------------------------------------------------------------------
 * This header carried a list of the catalogs still waiting for a section, each
 * with a note saying where it would go. Every one of them now has one, across
 * five new register modules: the deep past and the people in it on History, the
 * mortal world and the unaffiliated on a new Below tab, the two traditions and
 * the dao houses on Teaching, the wound table and what a catastrophe reaches on
 * People, and what a house makes, ships, lodges and plans across Factions,
 * Holdings and Ties.
 *
 * So the first number is nought and carries no slack at all. A new catalog
 * module reds this test on the day it is added, which is the rule the test was
 * always written under said at its strongest: add the section, or say below why
 * a reader should never see it.
 *
 * WHAT WAS DELIBERATELY NOT SHOWN, WHICH IS THE INTERESTING PART
 * --------------------------------------------------------------
 * Four of the 24, and only one of them is a judgement rather than bookkeeping:
 * `encounters.ts`. The other three are two re-export shims and the name pool.
 * The reasoning on the encounter table is in the allow-list below and it
 * DISAGREES with what this header used to say about it - the old note listed it
 * among the catalogs that belong on the sheet. Both readings are recorded
 * because the decision is arguable and the next person should see that it was
 * argued rather than forgotten.
 *
 * The honest split, for anybody counting: 20 shown, 4 withheld. A pass that
 * showed all 24 would not have exercised any judgement at all.
 */

import { describe, expect, it } from 'vitest';

import {
    findCatalogsTheRegisterNeverOpens,
    findRowCatalogsTheRegisterDoesNotName
} from '../../scripts/find-catalogs-the-register-does-not-show.mjs';

/**
 * Catalogs the register is right never to show, and the reason for each.
 *
 * A reason is required and it is the point of the list. "Not shown" and "should
 * never be shown" look identical in a count, and the first is a defect while the
 * second is a decision - so the decision is written down where the count is, and
 * anything not written down here is admitted to be work outstanding.
 */
const NOT_THE_REGISTER_S_BUSINESS: Readonly<Record<string, string>> = {
    'place-names.ts':
        'the single source of truth for what places are CALLED. The register '
        + 'prints its output on every tab; printing the pool is printing the dictionary.',
    'fallen.ts':
        'a re-export shim kept so that other people\'s import lines need not be '
        + 'rewritten into their unstaged work. It holds nothing of its own.',
    'standoff.ts':
        'the same shim, for `the-top-of-the-world.ts`. Showing it would show that '
        + 'catalog twice under two names.',
    'encounters.ts':
        'the draw table, and not one row of it is a thing that exists. An entry is '
        + 'a weight, an ordinal window and a summary with {token} slots the engine '
        + 'fills at draw time, so there is no bandit at {place} for a reader to find '
        + 'and no number in it that describes the world rather than the sampling. '
        + 'The register prints what STANDS somewhere; this is the shape a moment is '
        + 'poured into. Printing it would put the sampling weights on a sheet whose '
        + 'every other column is a fact about somebody. The earlier judgement, in '
        + 'this file\'s own header, was that it belongs on the sheet; it is recorded '
        + 'there so the disagreement is visible rather than lost.'
};

/**
 * Measured, not chosen. Lower these when you add a section; never raise them.
 *
 * THE READING THAT PRODUCED THESE. 24 modules unopened and 68 row-exports
 * unnamed at the start of the pass, of which 3 modules were already allow-listed
 * - so the first number stood at 21. Five register modules later the script
 * reports 4 unopened, all four allow-listed, and 13 unnamed. The 55 exports that
 * left did so by being named in a section that reads them.
 *
 * WHAT IS LEFT IN THE SECOND NUMBER IS A DIFFERENT KIND OF ROW. One of the 13 is
 * `ENCOUNTERS`, which is withheld on purpose and has no module to hide behind.
 * The other 12 are all in modules the register already opens and reaches through
 * a reader function rather than by name - `DEMONIC_STANDINGS` through
 * `demonicStandingOf`, `FAVOUR_STANCES` through the favour reader, and so on.
 * Those rows are the proxy admitting what it is, and closing them means changing
 * how the sheet reads a catalog rather than adding content nobody can see.
 *
 * THEY CARRY NO SLACK, AND THAT IS A DELIBERATE DEPARTURE from the sibling
 * ratchet, which carries a couple of rows because an exact reading off this
 * shared tree went red inside the hour. It was tried here and it took the teeth
 * out: with two rows of slack, hiding the whole beast catalog again - the exact
 * defect this was written for - left the module assertion green, and only the
 * export count caught it. A ratchet that cannot see a section being deleted is
 * not doing the job, so these are exact.
 *
 * WHICH MEANS A RED THAT NOBODY CAUSED IS POSSIBLE, and at nought it is more
 * likely rather than less: a new catalog module reds this the day it lands. That
 * is the intended behaviour and not an accident of the number. The fix is a
 * section or an allow-list entry, never a raised baseline.
 *
 * NEITHER NUMBER MOVED WHEN THE HOUSEHOLDS SECTION LANDED, AND THAT IS WHY THE
 * ROW PATTERN IS SHAPED AS IT IS. 27 authored marriages sat in `members.ts` with
 * no section on the sheet, and this ratchet was blind to them twice: the module
 * was already opened for the roster, and `AUTHORED_MARRIAGES` is written as
 * `Object.freeze([...])`, which the row-array pattern did not match. The pattern
 * now matches it, the section is on the Factions tab, and the widening cost
 * nothing at the time.
 */
const NEVER_OPENED = 0;
const NOT_NAMED = 13;

describe('the standing register shows what the catalogs hold', () => {
    it('does not leave a whole catalog module off the sheet', () => {
        const rows = findCatalogsTheRegisterNeverOpens() as Array<{ file: string }>;
        const unexplained = rows.filter(r => !(r.file in NOT_THE_REGISTER_S_BUSINESS));
        expect(
            unexplained.length,
            `Catalogs no register module opens rose above ${NEVER_OPENED}. Add the section, `
            + 'or say in NOT_THE_REGISTER_S_BUSINESS why a reader should never be shown it.'
            + unexplained.map(r => `\n  ${r.file}`).join('')
        ).toBeLessThanOrEqual(NEVER_OPENED);
    });

    it('does not show half a catalog and call it shown', () => {
        const rows = findRowCatalogsTheRegisterDoesNotName() as Array<{ file: string; name: string }>;
        const worst = [...rows]
            .reduce((acc, r) => acc.set(r.file, (acc.get(r.file) ?? 0) + 1), new Map<string, number>());
        const top = [...worst.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([f, n]) => `\n  ${n}  ${f}`).join('');
        expect(
            rows.length,
            `Row-catalogs the register does not name rose above ${NOT_NAMED}. A table of rows `
            + `nobody can find on the sheet is content nobody knows the world has.${top}`
        ).toBeLessThanOrEqual(NOT_NAMED);
    });

    it('makes the allow-list carry a reason rather than a name', () => {
        // A bare list of filenames is how a deliberate exclusion and a forgotten
        // one become the same row. Every entry states what the catalog is and
        // why a reader is better off without it.
        for (const [file, why] of Object.entries(NOT_THE_REGISTER_S_BUSINESS)) {
            expect(why.length, `${file} is excluded with no reason given`).toBeGreaterThan(40);
        }
    });

    it('keeps the allow-list to catalogs that still exist', () => {
        // An entry for a deleted file is an exemption nobody can see the effect
        // of, and it would quietly cover the next catalog to take that name.
        const rows = findCatalogsTheRegisterNeverOpens() as Array<{ file: string }>;
        const unopened = new Set(rows.map(r => r.file));
        for (const file of Object.keys(NOT_THE_REGISTER_S_BUSINESS)) {
            expect(unopened, `${file} is allow-listed and is not unopened`).toContain(file);
        }
    });
});
