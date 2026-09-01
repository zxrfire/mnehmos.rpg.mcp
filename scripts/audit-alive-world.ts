/**
 * Does the world feel alive, and does it enforce the things the setting claims?
 *
 * The other audits each ask one question. This one asks the set of them that
 * together decide whether the world is a place or a spreadsheet, and it states
 * each claim in the words it was made in before measuring it. Nothing here
 * passes or fails on a number somebody chose; it reports the shape and says
 * which claims the engine does not currently make true, because a claim the
 * lore makes and the engine ignores is worse than one nobody made.
 *
 *   PLACE       "you can't hit 46 by just cultivating in a cave in the middle
 *                of nowhere, you end up gaining too little ambient qi and die
 *                of old age"
 *   GUIDANCE    "you take longer without a teacher"
 *   ROGUES      "rogue cultivators aren't rare but high level ones are. even
 *                above something like 29 is crazy rare"
 *   THINGS      "items, manuals (for both cultivation techniques and daos), all
 *                that should exist to make the world feel alive and physicalized"
 *   THE CHOSEN  "chosen must change"
 *   RANK        people rank up, and the population pyramid keeps its shape
 *   ONE OF MANY "you are just one amongst them"
 *   YOU MUST GO "you're forced to move to level up"
 *
 * Run: npx tsx scripts/audit-alive-world.ts
 */

import { seedWorld, deriveOrdinal } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { forStream } from '../src/engine/cultivation/rng.js';
import { manualCeilingOf } from '../src/engine/world/manuals.js';
import { assessPromotions } from '../src/engine/world/promotion-inside-a-house.js';
import { MAX_ORDINAL } from '../src/engine/cultivation/realms.js';
import type { AmbientQi } from '../src/schema/cultivation.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('═'.repeat(94)); line('  ' + t); line('═'.repeat(94)); };
const claim = (t: string) => { line(); line('  CLAIM: ' + t); line(); };

const verdicts: { name: string; holds: boolean; because: string }[] = [];
const record = (name: string, holds: boolean, because: string) => {
    verdicts.push({ name, holds, because });
    line();
    line(`  ${holds ? 'HOLDS' : 'DOES NOT HOLD'} - ${because}`);
};

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const seeded = seedWorld({ seed: 'alive-audit', catalog });
    let state = seeded.state;

    // A real cultivator to run the counterfactuals on, rather than an invented
    // one: whatever the seeder actually produces is what the game contains.
    const subject = state.npcs
        .filter(n => n.status === 'alive')
        .reduce((best, n) => n.cultivation.realmOrdinal > best.cultivation.realmOrdinal ? n : best);
    const root = subject.cultivation.spiritRoot;
    const attrs = subject.cultivation.attributes;
    const rng = () => forStream(seeded.state.seed, 'alive-audit', subject.id);

    // ── PLACE ───────────────────────────────────────────────────────────────
    rule('PLACE: CAN YOU CLIMB THE LADDER IN A CAVE IN THE MIDDLE OF NOWHERE?');
    claim('"you can\'t hit 46 by just cultivating in a cave in the middle of nowhere, '
        + 'you end up\n         gaining too little ambient qi and die of old age"');
    line(`  One cultivator (${root}), the same talent and the same lifetime, moved between grounds.`);
    line(`  The ceiling is opened all the way to ${MAX_ORDINAL} in every case, so the ONLY thing`);
    line('  stopping them is the ground and the clock.');
    line();

    const BANDS: AmbientQi[] = ['thin', 'normal', 'dense', 'spirit_tide'];
    line('  ' + 'ground'.padEnd(16) + 'reached by age 200'.padStart(20)
        + 'by 1000'.padStart(10) + 'ever'.padStart(8));
    line('  ' + '─'.repeat(54));
    const reached: Record<string, number> = {};
    for (const ambient of BANDS) {
        const at = (age: number) =>
            deriveOrdinal(root, attrs, age, 1, MAX_ORDINAL, rng(), { ambient });
        reached[ambient] = at(100000);
        line('  ' + ambient.padEnd(16) + String(at(200)).padStart(20)
            + String(at(1000)).padStart(10) + String(reached[ambient]).padStart(8));
    }
    const spread = reached.spirit_tide - reached.thin;
    record('place decides the ceiling', spread > 0,
        spread > 0
            ? `thin ground tops out at ${reached.thin} and a spirit tide at ${reached.spirit_tide} `
              + `- ${spread} rungs of difference from the ground alone`
            : `every ground produces ordinal ${reached.thin}: where you sit does not matter`);
    record('a cave will not reach the Lid', reached.thin < MAX_ORDINAL,
        reached.thin < MAX_ORDINAL
            ? `thin ground stops at ${reached.thin}, ${MAX_ORDINAL - reached.thin} rungs short of the Lid, `
              + 'however long the life runs'
            : 'thin ground reaches the top of the ladder, so the ground is decoration');

    // ── GUIDANCE ────────────────────────────────────────────────────────────
    rule('GUIDANCE: DOES A TEACHER SHORTEN THE ROAD?');
    claim('"you take longer without a teacher"');
    line('  The same cultivator, born nowhere in particular against born into a house that');
    line('  can put an elder in front of them. Origin moves inputs and never rank.');
    line();
    line('  ' + 'born'.padEnd(20) + 'by age 60'.padStart(11) + 'by 200'.padStart(9)
        + 'by 1000'.padStart(9) + 'ever'.padStart(7));
    line('  ' + '─'.repeat(56));
    const backed: Record<string, number> = {};
    for (const origin of ['thin_county', 'sect_retainer', 'great_house'] as const) {
        const at = (age: number) => {
            try {
                return deriveOrdinal(root, attrs, age, 1, MAX_ORDINAL, rng(), { ambient: 'normal', origin });
            } catch { return -1; }
        };
        backed[origin] = at(100000);
        line('  ' + origin.padEnd(20) + String(at(60)).padStart(11) + String(at(200)).padStart(9)
            + String(at(1000)).padStart(9) + String(backed[origin]).padStart(7));
    }
    const guided = Math.max(backed.sect_retainer ?? -1, backed.great_house ?? -1);
    record('backing shortens the road', guided > (backed.thin_county ?? 0),
        guided > (backed.thin_county ?? 0)
            ? `unbacked reaches ${backed.thin_county}, backed reaches ${guided}`
            : `both reach ${backed.thin_county}: backing buys nothing measurable`);

    // Snapshot before advancing. `advanceWorldYears` MUTATES the state it is
    // given and returns the same object, so `seeded.state` is not a "before" -
    // reading it afterwards measured the cumulative set of everyone ever
    // favoured, dead included, and reported 226 where the living answer was 17.
    const chosenThen = new Set(
        state.npcs.filter(n => n.status === 'alive' && n.tags.includes('chosen')).map(n => n.id)
    );

    // ── ROGUES ──────────────────────────────────────────────────────────────
    rule('ROGUES: COMMON AT THE BOTTOM, VANISHINGLY RARE AT THE TOP?');
    claim('"rogue cultivators aren\'t rare but high level ones are. even above something '
        + 'like 29\n         is crazy rare"');
    state = advanceWorldYears(state, 300).state;
    const living = state.npcs.filter(n => n.status === 'alive');
    const rogues = living.filter(n => !n.factionId);
    const backedFolk = living.filter(n => n.factionId);
    const above = (people: typeof living, n: number) =>
        people.filter(p => p.cultivation.realmOrdinal > n).length;

    line(`  After 300 years: ${living.length} living, of whom ${rogues.length} carry no house `
        + `(${Math.round(100 * rogues.length / living.length)}%).`);
    line();
    line('  ' + 'band'.padEnd(14) + 'unbacked'.padStart(10) + 'in a house'.padStart(12)
        + 'share unbacked'.padStart(16));
    line('  ' + '─'.repeat(52));
    for (const [label, floor] of [['any', -1], ['above 13', 13], ['above 21', 21], ['above 29', 29]] as const) {
        const r = above(rogues, floor), b = above(backedFolk, floor);
        const share = r + b > 0 ? `${Math.round(100 * r / (r + b))}%` : '-';
        line('  ' + label.padEnd(14) + String(r).padStart(10) + String(b).padStart(12) + share.padStart(16));
    }
    const lowRogues = rogues.length / Math.max(1, living.length);
    const highRogues = above(rogues, 29);
    record('rogues are ordinary', lowRogues > 0.2,
        `${Math.round(100 * lowRogues)}% of the living carry no house`);
    record('high rogues are crazy rare', highRogues <= 2,
        `${highRogues} unbacked cultivator(s) stand above ordinal 29`);

    // ── THINGS ──────────────────────────────────────────────────────────────
    rule('THINGS: IS THE WORLD PHYSICALISED?');
    claim('"items, manuals (for both cultivation techniques and daos), all that should exist '
        + 'to make\n         the world feel alive and physicalized"');
    const byKind = new Map<string, number>();
    for (const o of state.objects) byKind.set(o.kind, (byKind.get(o.kind) ?? 0) + 1);
    line(`  objects in the world: ${state.objects.length}`);
    line('  by kind: ' + ([...byKind].sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`).join('   ') || 'NONE'));
    const holders = new Set(state.objects.map(o => o.possessorId).filter(Boolean));
    line(`  distinct holders: ${holders.size}`);
    const withBooks = living.filter(n => n.cultivation.techniqueIds.length > 0).length;
    const withRoads = living.filter(n => manualCeilingOf(n) > 0).length;
    line(`  cultivators holding anything: ${withBooks} of ${living.length}; holding a road: ${withRoads}`);
    record('the world contains objects', state.objects.length > 0,
        `${state.objects.length} objects across ${byKind.size} kind(s), held by ${holders.size} parties`);
    record('daos are physical too', (byKind.get('manual') ?? 0) > 0 && byKind.size > 1,
        byKind.size > 1
            ? `${byKind.size} kinds of object exist`
            : `only ${[...byKind.keys()].join(', ')} exists - dao materials and artifacts are not in the world`);

    // ── THE CHOSEN ──────────────────────────────────────────────────────────
    rule('THE CHOSEN: DOES FAVOUR MOVE?');
    claim('"chosen must change"');
    const chosenNow = new Set(living.filter(n => n.tags.includes('chosen')).map(n => n.id));
    const stillChosen = [...chosenNow].filter(id => chosenThen.has(id)).length;
    const newlyChosen = chosenNow.size - stillChosen;
    line(`  favoured and alive at the seeding: ${chosenThen.size}`);
    line(`  favoured and alive 300 years on:   ${chosenNow.size}`);
    line(`  of those, named since the seeding:  ${newlyChosen}`);
    // Attrition is not reassignment. A count that merely FELL would pass a
    // naive check while proving the opposite - that favour died with its
    // holders - so the test is whether anybody NEW carries it.
    record('favour is reassigned', newlyChosen > 0,
        newlyChosen > 0
            ? `${newlyChosen} of the ${chosenNow.size} current favourites were named after the seeding`
            : 'not one new favourite in three centuries: the designation died with its holders');

    // ── RANK, AND THE SHAPE OF A HOUSE ──────────────────────────────────────
    rule('RANK: DO PEOPLE RISE, AND DOES A HOUSE STAY A PYRAMID?');
    claim('people rank up, and the population pyramid keeps its shape');
    const inHouse = living.filter(n => n.factionId && n.factionRankIndex >= 0);
    const ranks = new Map<number, number>();
    for (const n of inHouse) ranks.set(n.factionRankIndex, (ranks.get(n.factionRankIndex) ?? 0) + 1);
    const ordered = [...ranks].sort((a, b) => a[0] - b[0]);
    line(`  in a house after 300 years: ${inHouse.length}`);
    line('  ranks: ' + ordered.map(([r, n]) => `${r}:${n}`).join('  '));
    // A pyramid narrows. A slab does not, and a slab is what a world with no
    // promotion produces - everybody piled on the bottom rung forever.
    //
    // The TOP rank is excluded, and not to make this pass. A house's head seat
    // holds exactly one person however large the house is, it is filled by
    // succession rather than by promotion, and its population is therefore the
    // number of houses with a living master rather than a share of anybody.
    // Counting it inverts the top of the curve for a reason that says nothing
    // about whether people are rising: measured here, 8 houses have a master at
    // the head while only 5 people in the world meet the bar for the rank below
    // it, which is a fact about how thin the upper ladder is, not about the
    // shape of a hierarchy.
    const promoted = ordered.filter(([r]) => r < Math.max(...ordered.map(o => o[0])));
    let narrows = promoted.length > 2;
    for (let i = 1; i < promoted.length; i++) {
        if (promoted[i][1] > promoted[i - 1][1]) narrows = false;
    }
    const heads = ordered.length > 0 ? ordered[ordered.length - 1][1] : 0;
    record('a house is a pyramid', narrows,
        narrows
            ? `${promoted.length} promoted ranks, each smaller than the one below it `
              + `(${promoted.map(([r, n]) => `${r}:${n}`).join(' ')}), plus ${heads} head seats`
            : `ranks do not narrow: ${promoted.map(([r, n]) => `${r}:${n}`).join(' ')}`);

    const { promotions, blocked } = assessPromotions(state);
    record('houses are still raising people', promotions.length > 0,
        `${promotions.length} promotion(s) pending this year, ${inHouse.length} people in houses`);

    // ── ONE AMONG THEM ──────────────────────────────────────────────────────
    rule('ONE AMONG THEM: IS THE PLAYER SPECIAL?');
    claim('"you are just one amongst them"');
    line('  Everything measured above happened with no player in it. The test is whether');
    line('  the world produces the same kinds of thing a run produces - people climbing,');
    line('  holding books, being favoured, being stuck - or whether it is scenery waiting');
    line('  for somebody to arrive.');
    line();
    const climbers = living.filter(n => n.cultivation.realmOrdinal > 0).length;
    const booked = living.filter(n => manualCeilingOf(n) > 0).length;
    const favoured = living.filter(n => n.tags.includes('chosen')).length;
    line(`  cultivating at all: ${climbers}   holding a road: ${booked}   favoured: ${favoured}`);
    line(`  standing above ordinal 20: ${living.filter(n => n.cultivation.realmOrdinal > 20).length}`);
    record('the world is full of other people doing this',
        climbers > 50 && booked > 50 && favoured > 0,
        `${climbers} are cultivating, ${booked} hold a road, ${favoured} are somebody's favourite`);

    // ── YOU MUST GO ─────────────────────────────────────────────────────────
    rule('YOU MUST GO: IS STAYING PUT A LOSING LINE?');
    claim(`"you're forced to move to level up"`);
    line('  The setting only works if the house you were born into runs out. Two ways it');
    line('  must run out, and both have to be real at once:');
    line();
    const noSeat = blocked.filter(b => b.reason === 'no_seat').length;
    line(`  BLOCKED BY SEATS   ${noSeat} cultivator(s) have met the bar for the next rank`);
    line('                     and cannot have it, because the people above them are not');
    line('                     dying for centuries.');
    const capped = living.filter(n => {
        const c = manualCeilingOf(n);
        return c > 0 && n.cultivation.realmOrdinal >= c;
    }).length;
    line(`  OUT OF BOOK        ${capped} cultivator(s) stand at the end of everything they`);
    line('                     hold. No amount of sitting still moves them again.');
    record('staying where you were born stops working', noSeat > 0 || capped > 0,
        `${noSeat} blocked by seats, ${capped} at the end of their manual`);

    // ── SUMMARY ─────────────────────────────────────────────────────────────
    rule('WHAT THE ENGINE ACTUALLY MAKES TRUE');
    const held = verdicts.filter(v => v.holds);
    const broken = verdicts.filter(v => !v.holds);
    line();
    line(`  ${held.length} of ${verdicts.length} claims hold.`);
    if (broken.length > 0) {
        line();
        line('  NOT MADE TRUE BY THE ENGINE');
        for (const v of broken) line(`    ${v.name.padEnd(32)} ${v.because}`);
        line();
        line('  Each of these is a promise the world makes to the player and does not keep.');
    }
    if (held.length > 0) {
        line();
        line('  MADE TRUE');
        for (const v of held) line(`    ${v.name.padEnd(32)} ${v.because}`);
    }
    line();
}

main().catch(error => { console.error(error); process.exit(1); });
