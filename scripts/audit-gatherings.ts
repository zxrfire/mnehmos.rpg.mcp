/**
 * Do the chosen of allied houses ever actually meet, and does anything survive it?
 *
 * The world simulated deaths, births, goals, grudges and disasters, and its
 * people never met. The measurable form of that, from `audit-world-drift.ts`:
 * 221 inherited grudges after five centuries, every one of them descending from
 * a death or a catastrophe, and NOT ONE originating in two people who met and
 * disliked each other.
 *
 * `gatherings.ts` is the mechanism that was missing. This asks whether it works,
 * and it reports shape rather than a pass/fail, because "how many gatherings a
 * century is right" is a question for a person and "none" is not.
 *
 * Six questions, because they fail differently:
 *
 *   RATE         how many of each kind fire, and is the rate stable across five
 *                centuries or does it drift? A feature that fires forty times in
 *                the first century and twice in the fifth is not a calendar.
 *   SUPPLY       how many people a circle can actually put in a room. A kind
 *                that needs more entrants than the world ever produces is dead
 *                code, and this is where that shows up rather than in RATE.
 *   ORIGIN       how many relationships in the world began at a gathering rather
 *                than at a death? This is the number that was zero. It is read
 *                off the relationship rows themselves - every tie a gathering
 *                writes carries the gathering's fact id in `factIds` - so it is
 *                measured from state, never from prose.
 *   FAIRNESS     does the same house always win? If the placings correlate
 *                perfectly with `power_ordinal` the scoring reads one number and
 *                is not worth having.
 *   EXCLUSION    is anybody ever left out, and what does it cost them? Compares
 *                the cross-house ties held by people who were in the room at
 *                least once against those held by chosen who never were.
 *   COST         does the yearly pass stay a constant? The driver walks five
 *                centuries routinely and a pass that grows with the roster makes
 *                that impossible.
 *
 * Three seeds, and everything after RATE is summed across all three. One seed
 * is a story; the rarer kinds fire a handful of times per world and a single
 * run cannot tell "rare" from "never".
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { alliesOf, circlesOf, chosenOf } from '../src/engine/world/gatherings.js';
import type { HistoricalFact } from '../src/engine/world/history.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(92)); line('  ' + t); line('='.repeat(92)); };

const CENTURIES = 5;
const SEEDS = ['gather-audit', 'gather-audit-2', 'gather-audit-3'];

interface Era {
    century: number;
    kinds: Record<string, number>;
    circles: number;
    housesWithChosen: number;
    seconds: number;
}

interface Run {
    seed: string;
    eras: Era[];
    state: WorldState;
}

const gatheringsIn = (state: WorldState): HistoricalFact[] =>
    state.history.facts.filter(f => f.kind === 'gathering');

function housesWithChosen(state: WorldState): number {
    const out = new Set<string>();
    for (const n of state.npcs) {
        if (n.status === 'alive' && n.factionId && n.tags.includes('chosen')) out.add(n.factionId);
    }
    return out.size;
}

/** The house id inside a placing row: "1. Somebody (sect-x)". */
const houseIn = (row: string): string => row.slice(row.indexOf('(') + 1, row.lastIndexOf(')'));

async function main(): Promise<void> {
    rule('DO THE CHOSEN OF ALLIED HOUSES EVER MEET, AND DOES ANYTHING SURVIVE IT?');
    line('  Before this module: 221 inherited grudges over 500 years, 0 of them from anybody');
    line('  who had ever met anybody.');

    const catalog = await loadCultivationCatalog();

    // ── 1. RATE ──────────────────────────────────────────────────────────
    rule('1. RATE - how many of each kind, and does it hold across five centuries?');

    const runs: Run[] = [];

    for (const seed of SEEDS) {
        let state = seedWorld({ seed, catalog }).state;
        const eras: Era[] = [];
        let seen = 0;

        for (let century = 1; century <= CENTURIES; century++) {
            const started = Date.now();
            state = advanceWorldYears(state, 100).state;
            const seconds = (Date.now() - started) / 1000;

            const kinds: Record<string, number> = {
                meeting: 0, challenge: 0, competition: 0, expedition: 0
            };
            const facts = gatheringsIn(state);
            for (const f of facts.slice(seen)) {
                const k = String(f.data.gathering ?? 'unknown');
                kinds[k] = (kinds[k] ?? 0) + 1;
            }
            seen = facts.length;

            eras.push({
                century,
                kinds,
                circles: circlesOf(state).length,
                housesWithChosen: housesWithChosen(state),
                seconds
            });
        }
        runs.push({ seed, eras, state });
    }

    line();
    line(`  ${'seed'.padEnd(16)}${'century'.padStart(8)}${'circles'.padStart(9)}`
        + `${'w/chosen'.padStart(10)}${'meeting'.padStart(9)}${'chall.'.padStart(8)}`
        + `${'comp.'.padStart(7)}${'exped.'.padStart(8)}${'secs'.padStart(8)}`);
    line('  ' + '-'.repeat(83));
    for (const { seed, eras } of runs) {
        for (const era of eras) {
            line(`  ${(era.century === 1 ? seed : '').padEnd(16)}${String(era.century).padStart(8)}`
                + `${String(era.circles).padStart(9)}${String(era.housesWithChosen).padStart(10)}`
                + `${String(era.kinds.meeting ?? 0).padStart(9)}${String(era.kinds.challenge ?? 0).padStart(8)}`
                + `${String(era.kinds.competition ?? 0).padStart(7)}${String(era.kinds.expedition ?? 0).padStart(8)}`
                + `${era.seconds.toFixed(1).padStart(8)}`);
        }
        line();
    }

    const century = (n: number) =>
        runs.map(r => Object.values(r.eras[n].kinds).reduce((a, b) => a + b, 0));
    line(`  first century, all kinds:  ${century(0).join(', ')}`);
    line(`  fifth century, all kinds:  ${century(CENTURIES - 1).join(', ')}`);
    line();
    line('  DRIFT is real and its cause is not this module. A circle exists only while both');
    line('  ends of an alliance edge are alive, and the world dissolves institutions:');
    line('  measured on a plain seeded world, 13 of the 15 seeded alliance edges have a dead');
    line('  end by year 500. The standing VALUES do not erode - they are still 0.4 - the');
    line('  partners do. Nothing anywhere in `pressure.ts` creates a positive standing edge,');
    line('  so the alliance graph can only shrink; `settleHouseStanding` is the only');
    line('  countervailing force and it can only move houses already near the line.');

    // ── 2. SUPPLY ────────────────────────────────────────────────────────
    rule('2. SUPPLY - how many people can a circle actually put in a room?');

    let seatCircles = 0, seatHouses = 0, seatChosen = 0;
    for (const { state } of runs) {
        for (const circle of circlesOf(state)) {
            seatCircles++;
            seatHouses += circle.members.length;
            for (const m of circle.members) seatChosen += chosenOf(state, m.id).length;
        }
    }

    const sizes: number[] = [];
    for (const { state } of runs) {
        for (const fact of gatheringsIn(state)) sizes.push(fact.witnessIds.length);
    }
    const histogram = new Map<number, number>();
    for (const n of sizes) histogram.set(n, (histogram.get(n) ?? 0) + 1);

    line();
    line(`  circles standing at year 500 across 3 seeds   ${seatCircles}`);
    line(`  houses in them                                ${seatHouses}`
        + `  (${seatCircles === 0 ? 0 : (seatHouses / seatCircles).toFixed(1)} per circle)`);
    line(`  chosen those houses could send                ${seatChosen}`
        + `  (${seatHouses === 0 ? 0 : (seatChosen / seatHouses).toFixed(2)} per house)`);
    line();
    line('  attendees per gathering, over every gathering in all three worlds:');
    for (const size of [...histogram.keys()].sort((a, b) => a - b)) {
        line(`    ${String(size).padStart(3)} people   ${'#'.repeat(Math.min(60, histogram.get(size)!))}`
            + ` ${histogram.get(size)}`);
    }
    line();
    line('  THIS IS THE BINDING CONSTRAINT AND IT IS NOT IN THIS MODULE. `chosenCount`');
    line('  gives almost every house exactly one favourite - it is min(copies of the top');
    line('  manual, members/25), and a house of twenty members lands on one however deep');
    line('  its shelf is - and an alliance circle is two or three houses. So the ordinary');
    line('  gathering seats TWO PEOPLE, a competition needs three to have a first, a last');
    line('  and a middle, and competitions are correspondingly rare. Either a delegation is');
    line('  more than the chosen, or `chosenCount` is too tight. Both are design questions.');

    // ── 3. ORIGIN ────────────────────────────────────────────────────────
    rule('3. ORIGIN - how many relationships began at a gathering rather than at a death?');

    let gatherings = 0, allRels = 0, allGrudges = 0, inheritedGrudges = 0;
    let born = 0, friendships = 0, accounts = 0, passedOn = 0;
    let ambitions = 0;

    for (const { state } of runs) {
        const ids = new Set(gatheringsIn(state).map(f => f.id));
        gatherings += ids.size;
        for (const npc of state.npcs) {
            for (const goal of npc.goals) {
                if (goal.note.startsWith('Measured at a friendly bout')) ambitions++;
            }
            for (const rel of npc.relationships) {
                allRels++;
                if (rel.standing <= -0.4) allGrudges++;
                if (rel.inheritedFromId !== null && rel.standing < 0) inheritedGrudges++;
                if (!rel.factIds.some(id => ids.has(id))) continue;
                born++;
                if (rel.standing >= 0.4) friendships++;
                if (rel.standing <= -0.4) accounts++;
                if (rel.inheritedFromId !== null) passedOn++;
            }
        }
    }

    line();
    line(`  gatherings filed, 3 worlds x 500 years  ${gatherings}`);
    line(`  relationship rows in those worlds       ${allRels}`);
    line(`  of those, carrying a gathering fact id  ${born}`
        + `  (${allRels === 0 ? 0 : Math.round(100 * born / allRels)}%)`);
    line(`    friendships (standing >= +0.4)        ${friendships}`);
    line(`    accounts    (standing <= -0.4)        ${accounts}`);
    line(`    already passed to an heir             ${passedOn}`);
    line();
    line(`  ambitions opened by being outclassed    ${ambitions}`);
    line(`  every grudge in those worlds            ${allGrudges}`);
    line(`  inherited grudges (the drift audit's)   ${inheritedGrudges}`);
    line();
    line('  Measured off the relationship ROWS, not off narration: every tie a gathering');
    line('  writes carries that gathering\'s fact id in `factIds`, so "did this begin at a');
    line('  gathering or at a death" is answerable from the row alone two centuries later.');
    line();
    line('  ASYMMETRY WORTH KNOWING: an account at -0.4 or worse is inherited by');
    line('  `settleNpcDeath`; a friendship at +0.9 is not, and dies with its holder. So a');
    line('  gathering\'s grudges outlive it and its friendships do not. That is the existing');
    line('  contract in `time.ts`, not a decision made here, and it is worth a look.');

    // ── 4. FAIRNESS ──────────────────────────────────────────────────────
    rule('4. FAIRNESS - does the same house always win?');

    const wins = new Map<string, number>();
    const entries = new Map<string, number>();
    let ranked = 0, upsets = 0, selectedUpward = 0;
    let haul = 0, proof = 0;

    for (const { state } of runs) {
        for (const fact of gatheringsIn(state)) {
            const scoring = String(fact.data.scoring ?? '');
            if (scoring === 'haul') haul++;
            if (scoring === 'proof') proof++;
            if (fact.data.selectedUpwardId) selectedUpward++;

            const placings = String(fact.data.placings ?? '');
            if (placings.length === 0) continue;
            ranked++;
            const rows = placings.split(' | ');
            for (const row of rows) {
                const house = houseIn(row);
                entries.set(house, (entries.get(house) ?? 0) + 1);
            }
            const firstHouse = houseIn(rows[0] ?? '');
            wins.set(firstHouse, (wins.get(firstHouse) ?? 0) + 1);

            // An upset is a first place taken by a house that is NOT the
            // strongest in the room, read off `power_ordinal` - the one number
            // a lazy scoring function would have used and nothing else.
            const powers = rows.map(r => ({
                id: houseIn(r),
                power: Number(state.factions.find(f => f.id === houseIn(r))?.resources.power_ordinal ?? 0)
            }));
            const strongest = powers.reduce((a, b) => (b.power > a.power ? b : a), powers[0]);
            if (strongest && strongest.id !== firstHouse) upsets++;
        }
    }

    line();
    line(`  scored gatherings (challenge, competition, expedition)  ${ranked}`);
    line(`  distinct houses that took a first place                 ${wins.size}`);
    line(`  distinct houses that entered anything                   ${entries.size}`);
    line(`  firsts taken by a house that was NOT the strongest      ${upsets}`
        + `  (${ranked === 0 ? 0 : Math.round(100 * upsets / ranked)}%)`);
    line(`  disciples selected upward into a host house             ${selectedUpward}`);
    line(`  expeditions scored on the haul / on a proof             ${haul} / ${proof}`);
    line();
    const top = [...wins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    for (const [house, count] of top) {
        line(`    ${house.padEnd(42)}${String(count).padStart(4)} firsts of ${entries.get(house) ?? 0} entries`);
    }
    line();
    line('  0% upsets would mean the ranking reads `power_ordinal` and nothing else, and is');
    line('  not worth having. 100% would mean the showing roll has swamped `assessPower` and');
    line('  a Qi Condensation disciple is beating Core Formation, which is worse.');

    // ── 5. EXCLUSION ─────────────────────────────────────────────────────
    rule('5. EXCLUSION - is anybody left out, and what does it cost them?');

    let liveHouses = 0, everSent = 0, neverSent = 0, namedUninvited = 0;
    let inPeople = 0, inTies = 0, outPeople = 0, outTies = 0;

    for (const { state } of runs) {
        const facts = gatheringsIn(state);
        const sent = new Set<string>();
        const attended = new Set<string>();
        for (const fact of facts) {
            for (const id of fact.factionIds) sent.add(id);
            for (const id of fact.witnessIds) attended.add(id);
            if (String(fact.data.excludedFactionIds ?? '').length > 0) namedUninvited++;
        }
        const live = state.factions.filter(f => f.dissolvedOnDay === null);
        liveHouses += live.length;
        everSent += sent.size;
        neverSent += live.filter(f => !sent.has(f.id)).length;

        // Measured over LIFETIMES rather than at the last day, because circles
        // collapse and a snapshot of year 500 compares two people to fourteen.
        for (const npc of state.npcs) {
            const wasThere = attended.has(npc.id);
            const isChosen = npc.factionId !== null && npc.tags.includes('chosen');
            if (!wasThere && !isChosen) continue;
            let ties = 0;
            for (const rel of npc.relationships) {
                const other = state.npcs.find(n => n.id === rel.targetId);
                if (other && other.factionId && other.factionId !== npc.factionId) ties++;
            }
            if (wasThere) { inPeople++; inTies += ties; }
            else { outPeople++; outTies += ties; }
        }
    }

    line();
    line(`  live houses at year 500, 3 worlds             ${liveHouses}`);
    line(`  houses that ever sent anybody to a gathering  ${everSent}`);
    line(`  houses that never did                         ${neverSent}`);
    line(`  gatherings that named an uninvited neighbour  ${namedUninvited} of ${gatherings}`);
    line();
    line(`  ${'people who...'.padEnd(38)}${'people'.padStart(8)}${'cross-house ties'.padStart(18)}${'per head'.padStart(10)}`);
    line('  ' + '-'.repeat(74));
    line(`  ${'were in the room at least once'.padEnd(38)}${String(inPeople).padStart(8)}`
        + `${String(inTies).padStart(18)}`
        + `${(inPeople === 0 ? 0 : inTies / inPeople).toFixed(2).padStart(10)}`);
    line(`  ${'are chosen and never were'.padEnd(38)}${String(outPeople).padStart(8)}`
        + `${String(outTies).padStart(18)}`
        + `${(outPeople === 0 ? 0 : outTies / outPeople).toFixed(2).padStart(10)}`);
    line();
    line('  The cost of exclusion is not a penalty applied to anybody. It is that their');
    line('  chosen do not know anyone, which is the ratio above, and it is the whole');
    line('  difference between a house inside the pyramid and a house outside it.');

    // ── 6. COST ──────────────────────────────────────────────────────────
    rule('6. COST - does the yearly pass stay a constant?');
    line();
    line(`  ${'seed'.padEnd(16)}${'c1'.padStart(8)}${'c2'.padStart(8)}${'c3'.padStart(8)}`
        + `${'c4'.padStart(8)}${'c5'.padStart(8)}   seconds per 100 simulated years`);
    line('  ' + '-'.repeat(80));
    for (const { seed, eras } of runs) {
        line(`  ${seed.padEnd(16)}` + eras.map(e => e.seconds.toFixed(1).padStart(8)).join(''));
    }
    line();
    line('  A rising row means the pass is scanning something that grows. A flat one means');
    line('  the circle scan and the bounded per-gathering work are doing what they claim.');

    rule('WHAT IS FLAT AND WHAT MOVED');
    const moved: string[] = [];
    const flat: string[] = [];
    const note = (ok: boolean, text: string) => (ok ? moved : flat).push(text);

    note(born > 0, `ties originating at a gathering: 0 -> ${born}`);
    note(accounts > 0, `accounts opened at a gathering: 0 -> ${accounts}`);
    note(passedOn > 0, `gathering ties already passed to an heir: ${passedOn}`);
    note(ambitions > 0, `ambitions opened by being outclassed: ${ambitions}`);
    note(upsets > 0, `firsts taken by a house that was not the strongest: ${upsets}`);
    note(selectedUpward > 0, `disciples selected upward: ${selectedUpward}`);
    note(haul > 0 && proof > 0, `both expedition scoring modes fired: ${haul} haul, ${proof} proof`);
    note(neverSent > 0, `houses that never sent anybody anywhere: ${neverSent}`);

    line();
    for (const m of moved) line(`  MOVED  ${m}`);
    for (const f of flat) line(`  FLAT   ${f}`);
    line();
}

main().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
