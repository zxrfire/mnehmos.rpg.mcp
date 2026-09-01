/**
 * Can you say WHY any given person is where they are?
 *
 * Aggregates can look alive while nothing underneath them means anything. A
 * rank histogram with a nice slope, a plausible spread of book ceilings and a
 * count of favoured disciples are all satisfiable by a world that shuffles
 * numbers, and none of them answer the question that decides whether this is a
 * setting or a spreadsheet:
 *
 *     PICK SOMEBODY AT RANDOM. CAN THE ENGINE SAY WHY THEY ARE STUCK,
 *     AND WHAT THEY WOULD HAVE TO DO ABOUT IT?
 *
 * So this takes real people out of a simulated world and reconstructs each
 * one's situation from state alone - no prose, no narrator, nothing authored
 * per person. Every clause below is read off a field. If the account is thin,
 * the world is thin, and no amount of description at the front end will fix it.
 *
 * Three kinds of person, because they are stuck for different reasons and the
 * setting only works if all three reasons are real:
 *
 *   THE FAVOURED      handed the top of a shelf years before their rank would
 *                     reach it. Their problem is that favour is not a rank.
 *   THE ORDINARY      an outer disciple among hundreds. Their problem is that
 *                     the seats above them are held by people who will not die
 *                     for centuries.
 *   THE UNBACKED      no house, so no shelf, so no materials. Their problem is
 *                     that the ladder above a certain height is not for sale.
 *
 * Run: npx tsx scripts/audit-why-they-are-there.ts
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { manualCeilingOf, BOOKLESS_CEILING } from '../src/engine/world/manuals.js';
import { assessPromotions, seatsAtRank, abundanceOf } from '../src/engine/world/promotion-inside-a-house.js';
import { rankName } from '../src/engine/cultivation/realms.js';
import { whatTheyCallARogue } from '../src/data/cultivation/rogues.js';
import { getTechnique } from '../src/data/cultivation/techniques.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('═'.repeat(92)); line('  ' + t); line('═'.repeat(92)); };

/** Every clause here is read off a field. Nothing is authored per person. */
function account(state: WorldState, npc: NpcRecord, blocked: Map<string, string>): string[] {
    const out: string[] = [];
    const house = npc.factionId ? state.factions.find(f => f.id === npc.factionId) : null;
    const ord = npc.cultivation.realmOrdinal;
    const cap = manualCeilingOf(npc);

    out.push(`${npc.name}, ${rankName(ord)} (ordinal ${ord}), age ${Math.round(
        (state.currentDay - npc.identity.bornOnDay) / 365)}`);

    if (house) {
        const rank = house.ranks[Math.min(npc.factionRankIndex, house.ranks.length - 1)] ?? '?';
        const members = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id);
        const above = members.filter(n => n.factionRankIndex === npc.factionRankIndex + 1).length;
        const seats = seatsAtRank(npc.factionRankIndex + 1, house.ranks.length, members.length,
            abundanceOf(house));
        out.push(`  ${rank} of the ${house.name}${npc.tags.includes('chosen') ? ', and favoured' : ''}`);
        out.push(`  the rank above holds ${above} of ${seats === Number.MAX_SAFE_INTEGER ? 'unlimited' : seats} seats`);
    } else {
        const band = whatTheyCallARogue(ord);
        out.push(`  no house. The province would call them ${band.called}.`);
        out.push(`  ${band.because}`);
    }

    if (cap === 0) {
        out.push(`  HOLDS NO ROAD. Circulating by feel carries anybody to about ${BOOKLESS_CEILING}`
            + ' and then stops, because everything above it needs a method somebody wrote down.');
    } else {
        const best = npc.cultivation.techniqueIds
            .map(id => getTechnique(id) as { name?: string; cap?: number | null; class?: string } | undefined)
            .filter(t => t && t.class === 'cultivation' && t.cap != null)
            .sort((a, b) => Number(b!.cap) - Number(a!.cap))[0];
        out.push(`  practising ${best?.name ?? 'something'}, which carries to ${cap}`);
        if (ord >= cap) {
            out.push('  AT THE END OF THE BOOK. No amount of sitting still moves them again.');
        } else {
            out.push(`  ${cap - ord} rung(s) of paper left`);
        }
    }

    const why = blocked.get(npc.id);
    if (why) out.push(`  QUALIFIED FOR THE NEXT RANK AND CANNOT HAVE IT: ${why}`);

    return out;
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    let { state } = seedWorld({ seed: 'why-they-are-there', catalog });
    state = advanceWorldYears(state, 300).state;

    const { blocked } = assessPromotions(state);
    const why = new Map(blocked.map(b => [b.npcId,
        b.reason === 'no_seat'
            ? 'every seat above them is taken, and the people in them are not dying soon'
            : 'somebody better is ahead of them in the same queue']));

    const living = state.npcs.filter(n => n.status === 'alive');
    const pick = (f: (n: NpcRecord) => boolean, n: number) => living.filter(f).slice(0, n);

    rule('THE FAVOURED');
    for (const p of pick(n => n.tags.includes('chosen'), 3)) {
        for (const l of account(state, p, why)) line('  ' + l);
        line();
    }

    rule('THE ORDINARY');
    for (const p of pick(n => !!n.factionId && n.factionRankIndex === 0
        && n.cultivation.realmOrdinal > 0, 3)) {
        for (const l of account(state, p, why)) line('  ' + l);
        line();
    }

    rule('STUCK, AND THE REASON IS A SEAT RATHER THAN A FAILING');
    for (const p of pick(n => why.has(n.id), 3)) {
        for (const l of account(state, p, why)) line('  ' + l);
        line();
    }

    rule('THE UNBACKED');
    for (const p of pick(n => !n.factionId && n.cultivation.realmOrdinal > 3, 3)) {
        for (const l of account(state, p, why)) line('  ' + l);
        line();
    }

    rule('WHETHER THE WORLD IS MADE OF REASONS');
    const inHouse = living.filter(n => n.factionId);
    const accounted = living.filter(n =>
        why.has(n.id)                                        // stuck behind a seat
        || manualCeilingOf(n) > 0                            // has a road, so has a ceiling
        || !n.factionId                                      // unbacked, which is itself the reason
        || n.cultivation.realmOrdinal === 0                  // has not started
    ).length;
    line();
    line(`  living: ${living.length}   in a house: ${inHouse.length}   favoured: `
        + `${living.filter(n => n.tags.includes('chosen')).length}`);
    line(`  people whose position the engine can account for: ${accounted} of ${living.length}`
        + ` (${Math.round(100 * accounted / living.length)}%)`);
    line();
    line('  Every line above was read off a field. If any of it reads like a person, that is');
    line('  the systems producing a person rather than anybody having written one.');
    line();
}

main().catch(error => { console.error(error); process.exit(1); });
