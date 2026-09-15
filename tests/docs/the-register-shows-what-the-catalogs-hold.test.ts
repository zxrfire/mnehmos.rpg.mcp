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
 * WHAT IS STILL NOT SHOWN, AND WHERE IT WOULD GO
 * ----------------------------------------------
 * The count below is not an anonymous number. These are the catalogs left, and
 * the judgement on each is that it belongs on the sheet and has not been written
 * yet - not that it should stay off:
 *
 *   wounds.ts                     every way a body can be hurt. Belongs with the
 *                                 ladder and the body, not with things somebody
 *                                 holds, which is why it is not in the items
 *                                 module this change extended.
 *   mortal-world.ts               occupations, prices, settlements. The price
 *                                 board is the one table a player checks most.
 *   rogues.ts                     bounties, dealers, auction venues, road
 *                                 customs - most of the player's own peers.
 *   traditions.ts                 two traditions on one ladder. A key-tab fact.
 *   encounters.ts                 the draw tables the time-skip rolls on.
 *   history.ts, named-figures.ts, sealed-ancestors.ts, false-immortals.ts,
 *   the-top-of-the-world.ts       the deep past and the people at the top of it.
 *                                 The History tab exists and carries none of it.
 *   the rest                      catastrophe, contingencies, indentures, what
 *                                 each house makes, why a party goes out, places
 *                                 that teach a dao, rumours, deposit-holders,
 *                                 the three floors, the changed-beast family,
 *                                 cultivators the road finished.
 *
 * A catalog leaving that list leaves by having a section written for it.
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
        + 'catalog twice under two names.'
};

/**
 * Measured, not chosen. Lower these when you add a section; never raise them.
 *
 * The quiet-tree reading when this landed was 21 modules and 68 exports, after
 * the beast materials, the beast table, the tides, the conveyance ladder, the
 * bills of materials, the named craft and the artifact recipes were added - which
 * took the modules from 28 to 24 and the exports from 74 to 68.
 *
 * THEY CARRY NO SLACK, AND THAT IS A DELIBERATE DEPARTURE from the sibling
 * ratchet, which carries a couple of rows because an exact reading off this
 * shared tree went red inside the hour. It was tried here and it took the teeth
 * out: with two rows of slack, hiding the whole beast catalog again - the exact
 * defect this was written for - left the module assertion green, and only the
 * export count caught it. A ratchet that cannot see a section being deleted is
 * not doing the job, so these are exact.
 *
 * WHICH MEANS A RED THAT NOBODY CAUSED IS POSSIBLE. If this fails and you have
 * not touched a register module, run the script: a register module that
 * legitimately stopped importing a catalog raises the first number by one
 * through nobody's fault. Lower it, and say here which import went and why.
 *
 * NEITHER NUMBER MOVED WHEN THE HOUSEHOLDS SECTION LANDED, AND THAT IS THE
 * INTERESTING PART. 27 authored marriages sat in `members.ts` with no section
 * on the sheet, and this ratchet was blind to them twice: the module was
 * already opened for the roster, and `AUTHORED_MARRIAGES` is written as
 * `Object.freeze([...])`, which the row-array pattern did not match. The
 * pattern now matches it. Measured at the time: the same 68 rows either way,
 * because the section names the export - so the widening cost nothing and the
 * next frozen catalog cannot hide the same way.
 */
const NEVER_OPENED = 21;
const NOT_NAMED = 68;

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
