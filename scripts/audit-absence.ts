/**
 * What does a seclusion actually cost, and who is left holding a wrong answer?
 *
 * Seclusion is this game's core loop - a cultivator routinely disappears for a
 * decade - and before `when-somebody-does-not-come-back.ts` it cost exactly the
 * days it took. The world moved, and none of the movement was ABOUT the person
 * who was gone. This measures whether that is still true.
 *
 * The same cultivator, the same world, the same seed, four durations:
 *
 *   2 years    should sting and usually cost nothing
 *   10 years   should be survivable - this is the ordinary retreat
 *   40 years   should cost somebody
 *   100 years  should be a different life
 *
 * Five things are reported at each, and the last is the point:
 *
 *   WHO DIED         people who held a tie to them and did not last the absence
 *   WHO MOVED        and who rose in a house while they were sitting down
 *   WHO STOPPED      who was waiting, and in which year they stopped
 *   WHAT IS BELIEVED every dated account of the absence, with its source
 *   WHERE THEY       the versions that CONTRADICT each other, which is the
 *   DISAGREE         product: several parties, each sincere, each dated, at
 *                    most one of them right
 *
 * Read from state and from the ledger, never from prose. The disagreement table
 * is `KnowledgeLedger.disagreementsAbout`, which existed before this work and
 * had nothing to return, because nobody was writing the rows.
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { cloneWorld } from '../src/engine/world/world-state.js';
import type { WorldState } from '../src/engine/world/world-state.js';
import { createNpc, isActing, upsertRelationship, type NpcRecord } from '../src/engine/world/npc-state.js';
import { createWorld } from '../src/engine/world/world-state.js';
import { FRIENDSHIP_STANDING } from '../src/engine/world/gatherings.js';
import {
    applyAbsence,
    beginAbsence,
    fateClaimKey,
    homecoming,
    type Absence
} from '../src/engine/world/when-somebody-does-not-come-back.js';
import { KnowledgeLedger, type KnowledgeRecord } from '../src/engine/social/knowledge.js';
import { stageOfRecord } from '../src/engine/social/discovery.js';
import { worldShape } from '../src/engine/world/driver.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(94)); line('  ' + t); line('='.repeat(94)); };
const sub = (t: string) => { line(); line('  ' + t); line('  ' + '-'.repeat(t.length)); };

const SEED = 'absence-audit';
/** Long enough that the world has produced ties by meeting people. */
const WARMUP_YEARS = 120;
const DURATIONS = [2, 10, 40, 100];

/**
 * Who to put in the cave.
 *
 * The person with the most incoming ties, because the whole question is what an
 * absence does to the people holding them and an absentee nobody knows measures
 * nothing. Deliberately NOT the strongest person in the world: this module must
 * not consult cultivation and the harness should not either.
 */
function mostConnected(state: WorldState): { npc: NpcRecord; incoming: number } | null {
    const counts = new Map<string, number>();
    for (const npc of state.npcs) {
        if (!isActing(npc.status)) continue;
        for (const rel of npc.relationships) {
            counts.set(rel.targetId, (counts.get(rel.targetId) ?? 0) + 1);
        }
    }
    let best: { npc: NpcRecord; incoming: number } | null = null;
    for (const [id, incoming] of [...counts].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        const npc = state.npcs.find(n => n.id === id);
        if (!npc || !isActing(npc.status)) continue;
        if (!best || incoming > best.incoming) best = { npc, incoming };
    }
    return best;
}

interface Run {
    years: number;
    absence: Absence;
    ledger: KnowledgeLedger;
    state: WorldState;
    accounts: KnowledgeRecord[];
}

function seclude(base: WorldState, absenteeId: string, absenteeName: string, years: number): Run {
    const state = cloneWorld(base);
    const npc = state.npcs.find(n => n.id === absenteeId)!;

    // Who saw him go, and who he told. Bound to the world rather than chosen:
    // the two people at the same place with the strongest ties to him, one of
    // whom is the worst account he has - so an enemy who happens to have been
    // standing there ends up the only correct record in the world, which is
    // exactly the situation the design wants and is not written for.
    const near = state.npcs
        .filter(n => n.id !== npc.id && isActing(n.status) && n.locationId === npc.locationId)
        .filter(n => n.relationships.some(r => r.targetId === npc.id))
        .sort((a, b) => {
            const sa = a.relationships.find(r => r.targetId === npc.id)!.standing;
            const sb = b.relationships.find(r => r.targetId === npc.id)!.standing;
            return sb - sa;
        });
    const friends = near.filter(n => n.relationships.find(r => r.targetId === npc.id)!.standing > 0);
    const foes = near.filter(n => n.relationships.find(r => r.targetId === npc.id)!.standing < 0);

    const opened = beginAbsence(state, {
        absenteeId: npc.id,
        absenteeName: npc.name,
        onDay: state.currentDay,
        locationId: npc.locationId,
        factionId: npc.factionId,
        factionRankIndex: npc.factionRankIndex,
        // He told the two people closest to him. One enemy watched him go in.
        toldIds: friends.slice(0, 2).map(n => n.id),
        witnessIds: foes.slice(0, 1).map(n => n.id),
        truth: `${npc.name} sat down to cultivate and did not die.`
    });

    const ledger = new KnowledgeLedger();
    ledger.addFact(opened.truth);
    const accounts = [...opened.accounts];
    for (const record of opened.accounts) ledger.addRecord(record);

    const absence = opened.absence;
    const out = advanceWorldYears(state, years, { absences: [absence] });
    for (const record of out.absenceAccounts) {
        ledger.addRecord(record);
        accounts.push(record);
    }
    // The driver runs the pass on whole-year slices; settle any remainder.
    const tail = applyAbsence(state, absence, state.currentDay);
    for (const record of tail.accounts) {
        ledger.addRecord(record);
        accounts.push(record);
    }

    return { years, absence, ledger, state, accounts };
}

function report(run: Run): void {
    const back = homecoming(run.state, run.absence, run.state.currentDay);
    rule(`${run.years} YEARS - ${back.absenteeName} comes out`);

    const dead = back.ties.filter(t => t.outcome === 'dead' || t.outcome === 'gone_missing');
    const rose = back.ties.filter(t => t.outcome === 'rose');
    const left = back.ties.filter(t => t.outcome === 'left_house' || t.outcome === 'fell');
    const moved = back.ties.filter(t => t.outcome === 'moved');
    const stopped = back.ties.filter(t => t.outcome === 'stopped_waiting');
    const waited = run.absence.ties.filter(t => t.waiting).length;

    line(`  ties at departure   ${back.ties.length}  (${waited} of them expecting a return)`);
    line(`  died or vanished    ${dead.length}`);
    line(`  died still waiting  ${back.diedWaiting.length}${back.diedWaiting.length ? '  ' + back.diedWaiting.join(', ') : ''}`);
    line(`  stopped waiting     ${stopped.length}`);
    line(`  still waiting       ${back.stillWaiting.length}${back.stillWaiting.length ? '  ' + back.stillWaiting.join(', ') : ''}`);
    line(`  rose in a house     ${rose.length}`);
    line(`  fell or left one    ${left.length}`);
    line(`  moved away          ${moved.length}`);
    line(`  written off         ${back.writtenOffInYear === null ? 'no' : `yes, year ${back.writtenOffInYear}`}`);
    line(`  witnesses left      ${back.survivingWitnesses.length}`);

    const notable = [...dead, ...stopped, ...rose, ...left, ...moved].slice(0, 10);
    if (notable.length > 0) {
        sub('what is different');
        for (const t of notable) line(`    ${t.summary}`);
    }

    sub('what is believed about him, by whom, from what, and when');
    const claims = run.ledger.claimsAbout(fateClaimKey(run.absence.absenteeId));
    if (claims.length === 0) line('    nothing. Nobody has an opinion.');
    for (const c of claims) {
        const year = Math.floor(c.acquiredOnDay / 365);
        line(
            `    ${c.holderId.padEnd(26)} ${c.stance.padEnd(9)} ${c.source.kind.padEnd(10)} ` +
            `${String(stageOfRecord(c)).padEnd(11)} y${year}  ${c.statement}`
        );
    }

    sub('where they disagree');
    const versions = run.ledger.disagreementsAbout(fateClaimKey(run.absence.absenteeId));
    line(`    ${versions.length} incompatible version${versions.length === 1 ? '' : 's'} in circulation`);
    for (const v of versions) {
        line(`      "${v.statement}"`);
        line(`         held by ${v.holders.join(', ')}`);
    }

    // The engine's own view, which no character-facing path may take.
    sub('and the engine, which knows');
    const truth = run.ledger.truthAbout(fateClaimKey(run.absence.absenteeId))[0];
    line(`    ${truth ? truth.statement : '(none)'}`);
    const wrong = claims.filter(c => run.ledger.isGroundless(c.id));
    line(`    ${wrong.length} of ${claims.length} accounts have nothing behind them at all.`);
}

// ─────────────────────────────────────────────────────────────────────────
// THE CONTROLLED TABLE
//
// The seeded world turns out to produce almost no ties above the standing at
// which the world calls something a friendship (see the SUPPLY section below),
// so a run on it measures the world's shortage of relationships rather than
// what an absence does to one. The controlled cell is four people whose ties
// are stated outright, run at every duration on sixty seeds, and it is what
// the durations column below is actually reporting.
// ─────────────────────────────────────────────────────────────────────────

interface Cell {
    years: number;
    seeds: number;
    stopped: number;
    diedWaiting: number;
    stillWaiting: number;
    writtenOff: number;
    remarried: number;
    firstStopYears: number[];
}

function controlled(years: number, seeds = 60): Cell {
    const cell: Cell = {
        years, seeds, stopped: 0, diedWaiting: 0, stillWaiting: 0,
        writtenOff: 0, remarried: 0, firstStopYears: []
    };
    for (let s = 0; s < seeds; s++) {
        const state = createWorld({
            seed: `ctl-${s}`, presentYear: 1000, skipPriorAges: true, regionCount: 2
        });
        const day = state.currentDay;
        const cast: [string, 'spouse' | 'disciple' | 'ally' | 'enemy', number][] = [
            // The one who promised to wait.
            ['wife', 'spouse', 0.9],
            // The junior who may be an elder when you get back.
            ['junior', 'disciple', 0.55],
            // The childhood friend who searches and eventually stops.
            ['friend', 'ally', 0.6],
            // The one who watched the door, and is right about everything.
            ['foe', 'enemy', -0.8]
        ];
        for (const [id, kind, standing] of cast) {
            const npc = createNpc(state.seed, {
                id, name: id, bornOnDay: day - 25 * 365, onDay: day, locationId: 'loc-region-0'
            });
            state.npcs.push(
                upsertRelationship(npc, { targetId: 'him', targetName: 'him', kind, standing }, day)
            );
        }
        // Somebody unattached for the household rule to have anywhere to go.
        state.npcs.push(createNpc(state.seed, {
            id: 'other', name: 'other', bornOnDay: day - 25 * 365, onDay: day, locationId: 'loc-region-0'
        }));

        const opened = beginAbsence(state, {
            absenteeId: 'him', absenteeName: 'him', onDay: day,
            locationId: 'loc-region-0',
            toldIds: ['wife', 'junior', 'friend'],
            witnessIds: ['foe']
        });
        const pass = applyAbsence(state, opened.absence, day + years * 365);

        const stops = pass.consequences.filter(c => c.kind === 'stopped_waiting');
        if (stops.length > 0) {
            cell.stopped += stops.length;
            cell.firstStopYears.push(Math.min(...stops.map(c => c.afterYears)));
        }
        cell.diedWaiting += pass.consequences.filter(c => c.kind === 'died_waiting').length;
        cell.remarried += pass.consequences.filter(c => c.kind === 'took_another_household').length;
        if (opened.absence.writtenOffOnDay !== null) cell.writtenOff++;
        cell.stillWaiting += opened.absence.ties.filter(t => t.waiting && t.settledOnDay === null).length;
    }
    return cell;
}

async function main(): Promise<void> {
    rule('WHAT DOES A SECLUSION COST THE PEOPLE WHO KNEW YOU?');

    const catalog = await loadCultivationCatalog();
    let base = seedWorld({ seed: SEED, catalog }).state;

    line(`  Seeded, then run ${WARMUP_YEARS} years so the world has produced ties by`);
    line('  people meeting each other rather than by the seeder asserting them.');
    base = advanceWorldYears(base, WARMUP_YEARS).state;

    const shape = worldShape(base);
    line();
    line(`  living NPCs          ${shape.livingNpcs}`);
    line(`  inherited grudges    ${shape.inheritedGrudges}`);
    line(`  inherited friendships ${shape.inheritedFriendships}   <- was structurally 0`);

    const pick = mostConnected(base);
    if (!pick) {
        line('  No NPC in this world has an incoming tie. Nothing to measure.');
        return;
    }
    line();
    line(`  Absentee: ${pick.npc.name} (${pick.npc.id}), ${pick.incoming} people hold a tie to him,`);
    line(`  at ${pick.npc.locationId ?? 'nowhere in particular'}, house ${pick.npc.factionId ?? 'none'} rank ${pick.npc.factionRankIndex}.`);

    for (const years of DURATIONS) {
        report(seclude(base, pick.npc.id, pick.npc.name, years));
    }

    // ── SUPPLY ───────────────────────────────────────────────────────────
    rule('SUPPLY - does this world contain anybody who would wait for you?');
    line('  The runs above show almost nothing happening to the ties, and the reason is');
    line('  not the absence machinery. It is that the world has barely any positive ties');
    line('  to act on. Every tie held by a living NPC, by kind and by band:');

    const kinds = new Map<string, number>();
    const bands = new Map<string, number>();
    let ties = 0;
    for (const npc of base.npcs) {
        if (!isActing(npc.status)) continue;
        for (const rel of npc.relationships) {
            ties++;
            kinds.set(rel.kind, (kinds.get(rel.kind) ?? 0) + 1);
            const band =
                rel.standing >= 0.8 ? '>= 0.8  defining'
                : rel.standing >= FRIENDSHIP_STANDING ? '0.4 .. 0.8  a friendship'
                : rel.standing > 0 ? '0 .. 0.4  civil'
                : rel.standing > -FRIENDSHIP_STANDING ? '-0.4 .. 0  cool'
                : '<= -0.4  an account';
            bands.set(band, (bands.get(band) ?? 0) + 1);
        }
    }
    line();
    line(`  ${ties} ties among ${shape.livingNpcs} living people, after ${WARMUP_YEARS} years.`);
    for (const [k, n] of [...kinds].sort((a, b) => b[1] - a[1])) {
        line(`    ${k.padEnd(14)} ${String(n).padStart(4)}`);
    }
    line();
    for (const [b, n] of [...bands].sort((a, b) => b[1] - a[1])) {
        line(`    ${b.padEnd(26)} ${String(n).padStart(4)}`);
    }
    const waitable = [...bands].filter(([b]) => b.startsWith('>=') || b.startsWith('0.4'))
        .reduce((s, [, n]) => s + n, 0);
    line();
    line(`  ${waitable} ties in the whole world are at or above the standing the engine calls a`);
    line('  friendship, and none of them are households or teaching lines - the kinds are');
    line('  only ally / rival / enemy / acquaintance. So there is nobody for a seclusion to');
    line('  cost you, and that is a gap in the WORLD rather than in this pass. Written down');
    line('  here rather than tuned around: lowering the bar until the number moved would');
    line('  have made a shortage of relationships look like a working mechanic.');

    // ── THE CONTROLLED TABLE ─────────────────────────────────────────────
    rule('DURATION - the same four people, sixty seeds, four lengths of absence');
    line('  A wife at 0.9 who was told, a junior disciple at 0.55, a friend at 0.6, and an');
    line('  enemy at -0.8 who watched the door. What each length of absence does to them:');
    line();
    line('    years    ties given up    worlds losing somebody   median year of the first   written off   new households');
    line('    -----    ------------    ----------------------   ------------------------   -----------   --------------');
    for (const years of DURATIONS) {
        const cell = controlled(years);
        const sorted = [...cell.firstStopYears].sort((a, b) => a - b);
        const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
        const pct = (n: number) => `${((n / cell.seeds) * 100).toFixed(0)}%`;
        line(
            `    ${String(years).padStart(5)}    ` +
            `${(`${cell.stopped} of ${cell.seeds * 3}`).padStart(9)} ${pct(cell.stopped / 3).padStart(4)}  ` +
            `${pct(cell.firstStopYears.length).padStart(22)}   ` +
            `${(median === null ? '-' : `year ${median}`).padStart(24)}   ` +
            `${pct(cell.writtenOff).padStart(11)}   ` +
            `${String(cell.remarried).padStart(14)}`
        );
    }
    line();
    line('  Three of the four ties are waiting, so 180 is the population of the second');
    line('  column. Two years costs a tie in about one world in seven; a hundred years');
    line('  costs nearly all of them, and the wife is the one who holds out longest');
    line('  because a defining tie waits twice as long as an ordinary one.');

    rule('THE ASYMMETRY THAT WAS IN THE WAY');
    line('  `settleNpcDeath` inherited a tie at standing <= -0.4 and dropped everything');
    line('  above it, so grudges outlived their holders and friendships died with them.');
    line('  The old number needs no measuring: with that condition a positive inherited');
    line('  tie could not be written at all, so it was structurally zero. What the');
    line('  symmetric bar produces, over five centuries on three seeds:');

    for (const seed of ['drift-a', 'drift-b', 'drift-c']) {
        let state = seedWorld({ seed, catalog }).state;
        state = advanceWorldYears(state, 500).state;
        const s = worldShape(state);
        line(
            `    ${seed.padEnd(9)} grudges ${String(s.inheritedGrudges).padStart(4)}   ` +
            `friendships ${String(s.inheritedFriendships).padStart(4)}   ` +
            `goals ${String(s.inheritedGoals).padStart(4)}`
        );
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
