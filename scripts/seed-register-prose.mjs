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


    register:
        'The admission column runs against the ordinal column: the strongest faction asks for twenty-nine, the weakest asks for nothing, and three others also take anyone who walks up. Exactly one door is shut. The seals run the same way. Grade tracks strength exactly, the masterworks holding the top of the band and the crude ones the bottom, while publicity runs precisely opposite - so what a province can find out about is reliably the least of what is buried in it.',

    grandascension:
        'Ten stand at this band and only one of them is a faction. The rest are offices, second seats and sealed ancestors: a court is not something anyone joins, an apex second is a person the register has no other row for, and three of the ten are asleep. Count factions alone and the band reads as a single name.',


    items:
        'Seventeen are held and thirty-one were ever known, so nearly half the supply is somewhere nobody is saying. Quantity and quality then part company. The Pavilion holds nine of the seventeen and every one of them is lower grade, while the only higher-grade Step sits with the Deep Survey and the only higher-grade Dealing with the Long Cut. Most of the supply and none of the ceiling.',

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
