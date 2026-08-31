/**
 * Seed the register prose cache with text written in-session.
 *
 * Same shape the runtime generator writes, and the fingerprints are computed by
 * the real `fingerprintFacts`, so these blocks are indistinguishable from
 * generated ones to every consumer: they serve, they go stale when a catalog
 * moves, and `?refresh=1` replaces them with the configured provider's version.
 *
 *   node scripts/seed-register-prose.mjs [cachePath]
 *
 * The rule these paragraphs were written under is the one the runtime prompt
 * enforces: only the facts in `section.facts(reg)`, no restating the table, and
 * nothing asserted that the facts do not carry.
 */

import { buildRegister } from '../dist/web/register.js';
import {
    PROSE_SECTIONS,
    PROSE_SCHEMA_VERSION,
    defaultProsePath,
    fingerprintFacts,
    saveProse
} from '../dist/web/register-prose.js';
import { getDbPath } from '../dist/storage/index.js';

const TEXT = {
    apexes:
        'Strength and supply run opposite ways. The Deep Survey stands highest, at forty-three, and has spent everything it was left. The Pavilion stands lowest, at forty-one, and has spent almost nothing. Courts thin in the same direction, two to one to none. Two of the three cannot be named by anyone starting out. The third has a front gate.',

    channels:
        'The three figures do not move together. The Long Cut crossed longest ago, two thousand six hundred years, and its channel is the least drawn down; the Deep Survey crossed more recently and is heavy. Nor do the tiers follow the counts, six crossings reading as very nearly mythical and one as supreme. The Pavilion holds a personal channel rather than an answering one.',

    register:
        'The admission column runs against the ordinal column. The strongest faction on the sheet asks for twenty-nine; the weakest asks for nothing, and three others also take anyone who walks up. Exactly one door is shut. Six factions could field something stronger than anything they can put in a room, and eleven hold their vein on a grant, which leaves most of the register standing on ground nobody issued.',

    grandascension:
        'Ten stand at this band and only one of them is a faction. The rest are offices, second seats and sleepers: a court is not something anyone joins, an apex second is a person the register has no other row for, and three of the ten are asleep. Count factions alone and the band reads as a single name.',

    sealed:
        'Grade tracks strength exactly. The three masterworks hold the top of the band, the two sound seals the middle, the two crude ones the bottom. Publicity runs precisely opposite: no masterwork is admitted to, and both crude seals are. What a province can find out about is reliably the least of what is buried in it. One sleeper of the seven stands below the house keeping her.',

    items:
        'Every object known to exist is in three hands, with nothing unaccounted for: thirteen Steps and four Dealings, all of them held. The Pavilion holds nine of the seventeen, more than the two older factions together. The youngest institution on the sheet is sitting on most of the supply, and none of it can be replaced.',

    offladder:
        'One name, carried by its last ordinal rather than a current one: forty-four, six hundred and forty years ago, and nothing since. The outcome is the reason a number stops applying, since a crossing that does not complete leaves somebody who did not arrive anywhere. He is on the roll of the four still working on that same crossing.'
};

const reg = buildRegister();
const blocks = {};
const now = new Date().toISOString();

for (const section of PROSE_SECTIONS) {
    const text = TEXT[section.id];
    if (!text) {
        console.warn(`no seed text for section "${section.id}" - it will generate on first open`);
        continue;
    }
    blocks[section.id] = {
        fingerprint: fingerprintFacts(section.facts(reg)),
        text,
        generatedAt: now,
        model: 'authored-in-session'
    };
}

const path = process.argv[2] ?? defaultProsePath(getDbPath());
saveProse(path, { version: PROSE_SCHEMA_VERSION, blocks });

const words = Object.values(blocks).reduce((n, b) => n + b.text.split(/\s+/).length, 0);
console.log(`seeded ${Object.keys(blocks).length} prose blocks (${words} words) -> ${path}`);
