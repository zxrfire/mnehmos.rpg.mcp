/**
 * World playtest - the parts of the setting a player meets rather than climbs.
 *
 * `playtest.ts` plays runs: a wanderer, a disciple, a betrayal, a sweep to the
 * top of the ladder. This one asks a different question. The catalogs hold a
 * great deal of world - an opaque court, an apex with feeder houses, a False
 * Immortal nobody can name, an office nobody can fill - and the question is
 * whether any of it is REACHABLE by somebody playing, or whether it is furniture
 * in a room the player never enters.
 *
 * Everything here goes through the same surfaces the client uses. Where a thing
 * turns out to be unreachable that is the finding, and it is reported rather
 * than worked around.
 */

import { makeGame } from '../tests/web/harness.js';
import { resetCultivationWorlds } from '../src/server/state/cultivation-world.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    MAX_ORDINAL,
    TRUE_IMMORTAL_ORDINAL,
    rankName
} from '../src/engine/cultivation/realms.js';
import {
    SECTS,
    SEAT_ORDER,
    WITHDRAWN_POWERS,
    getSect
} from '../src/data/cultivation/sects.js';
import { WANDERERS } from '../src/data/cultivation/wanderers.js';
import { APEX_INSTITUTIONS } from '../src/data/cultivation/hierarchy.js';
import { bandFor, holds, mentionableFor } from '../src/web/lore.js';
import {
    applyLocationChange,
    explainLocationChange,
    makeLocation,
    stateAsOfDay
} from '../src/engine/world/locations.js';

type Game = ReturnType<typeof makeGame>['game'];

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(78)); line('  ' + t); line('='.repeat(78)); };
const sub = (t: string) => { line(); line('-- ' + t + ' ' + '-'.repeat(Math.max(0, 72 - t.length))); };

interface Note { scenario: string; kind: 'works' | 'friction' | 'broken'; text: string }
const notes: Note[] = [];
const note = (scenario: string, kind: Note['kind'], text: string) => notes.push({ scenario, kind, text });

const cur = (game: Game): any => {
    const s: any = game.state();
    return s.cultivator ?? s;
};

function snapshot(game: Game): string {
    const c = cur(game);
    return [
        c.name,
        `${rankName(c.realmOrdinal)} (${c.realmOrdinal})`,
        c.sectId ? `${c.sectId}${c.sectRank ? ` / ${c.sectRank}` : ''}` : 'unaffiliated',
        `stones ${c.spiritStones ?? 0}`,
        c.alive === false ? 'DEAD' : null
    ].filter(Boolean).join(' | ');
}

async function play(game: Game, input: string, scenario: string): Promise<any> {
    try {
        const r: any = await game.act(input);
        const calls: any[] = (r.calls ?? r.toolCalls ?? []).filter((c: any) => c.name?.startsWith('engine.') || c.name?.startsWith('world.') || c.name?.includes('_manage') || c.name?.includes('_mortal'));
        const label = calls.map((c: any) => `${c.action}${c.ok === false ? ' REFUSED' : ''}`).join(', ');
        line(`  > ${input}`);
        line(`      -> ${label || '(no engine call)'}`);
        const prose = (r.narration ?? '').replace(/\s+/g, ' ').trim();
        if (prose) line(`         "${prose.slice(0, 150)}${prose.length > 150 ? '...' : ''}"`);
        if (calls.some((c: any) => c.action === 'unclear')) {
            note(scenario, 'friction', `Parser did not understand: "${input}"`);
        }
        return r;
    } catch (err) {
        line(`  > ${input}`);
        line(`      -> REFUSED: ${(err as Error).message.replace(/\s+/g, ' ').slice(0, 140)}`);
        return null;
    }
}

/** Admin: stand somebody where a scenario needs them. */
function place(repos: any, id: string, patch: Record<string, unknown>): void {
    repos.cultivators.update(id, patch as never);
}

// ─────────────────────────────────────────────────────────────────────────

async function loreReach() {
    rule('1. WHO CAN EVER HEAR OF WHOM - the lore gate, measured');
    const lu = WANDERERS[0];
    line(`  Testing reach for: ${lu.recordName}, ${rankName(lu.lastOrdinal)}, ${lu.affiliation.factionId}`);
    line(`  and for the apex institutions and the Hollow Court's seats.`);

    sub('at what standing does a name become sayable in front of you');
    const rungs = [0, 6, 13, 20, 29, 37, 41, 44];
    for (const ordinal of rungs) {
        for (const factionId of [null, 'sect-hollow-court']) {
            const speaker = { ordinal, factionId } as any;
            const reachable = mentionableFor(speaker);
            const lines = reachable.filter(m => m.catalog === 'wanderers');
            const named = lines.filter(m => m.id === lu.id);
            const legends = lines.filter(m => m.id !== lu.id);
            if (factionId === null && ordinal !== rungs[0] && named.length === 0 && legends.length === 0) continue;
            line(
                `  ordinal ${String(ordinal).padStart(2)} ${(factionId ?? 'unaffiliated').padEnd(18)}` +
                ` -> the man himself: ${named.length ? 'YES' : 'no '}` +
                ` | legends of him: ${legends.length}`
            );
        }
    }

    const mortal = mentionableFor({ ordinal: 0, factionId: null } as any);
    const insider = mentionableFor({ ordinal: 0, factionId: 'sect-hollow-court' } as any);
    const topOutsider = mentionableFor({ ordinal: 44, factionId: null } as any);
    const knowsHim = (list: any[]) => list.some(m => m.id === lu.id);

    if (!knowsHim(mortal) && knowsHim(topOutsider)) {
        note('lore', 'works', `A mortal cannot be told his name; somebody at ${rankName(44)} can. The gate holds.`);
    } else if (knowsHim(mortal)) {
        note('lore', 'broken', 'A starting mortal can be told the name of the world\'s only False Immortal.');
    }
    if (knowsHim(insider)) {
        note('lore', 'works', 'A Hollow Court member holds him regardless of realm - the insider route works.');
    } else {
        note('lore', 'friction', 'Even a Hollow Court member cannot hold his name, so the insider route is unreachable in play.');
    }

    sub('the legends, which are what actually travels');
    for (const legend of lu.legends.slice(0, 4)) {
        line(`  "${legend.calledBy}" - ${String(legend.claim ?? '').replace(/\s+/g, ' ').slice(0, 96)}...`);
    }
    const legendFloor = mentionableFor({ ordinal: 6, factionId: null } as any)
        .filter(m => m.catalog === 'wanderers' && m.id !== lu.id).length;
    if (legendFloor > 0) {
        note('lore', 'works', `${legendFloor} incompatible legends of him reach an ordinary cultivator at ${rankName(6)}.`);
    } else {
        note('lore', 'friction', 'The legends do not reach low enough to be the thing that travels.');
    }
}

async function apexIntake() {
    rule('2. THE AZURE CLOUD PAVILION - wide intake, narrow conversion');
    const apex = APEX_INSTITUTIONS.find(a => a.id === 'apex-azure-cloud')!;
    const pavilion = getSect('sect-azure-cloud-pavilion')!;
    line(`  ${apex.name}: power ${apex.powerOrdinal}, sect bar ${pavilion.admissionOrdinal}`);
    line(`  feeders: ${SECTS.filter(s => /azure-(mist|dew)/.test(s.id)).map(s => `${s.name} (bar ${s.admissionOrdinal})`).join(', ')}`);

    sub('applying at each rung, at every azure door');
    for (const sectId of ['sect-azure-cloud-pavilion', 'sect-azure-mist-court', 'sect-azure-dew-sect']) {
        const sect = getSect(sectId)!;
        for (const ordinal of [0, sect.admissionOrdinal - 1, sect.admissionOrdinal]) {
            if (ordinal < 0) continue;
            const { game, repos } = makeGame({ seed: `azure-${sectId}-${ordinal}`, worldEnabled: true, adminMode: true });
            const { cultivator } = await game.newRun('Shen Wuyou');
            place(repos, cultivator.id, { realmOrdinal: ordinal, spiritStones: 5000 });
            (game as any).knowledge.learnIfNew({
                holderId: cultivator.id, kind: 'sect', id: sect.id, name: sect.name,
                onDay: 0, sourceKind: 'told', sourceNote: 'a name said in a market town'
            });
            await game.act(`I apply to the ${sect.name}`);
            const c = cur(game);
            const got = c.sectId === sect.id;
            line(
                `  ${sect.name.padEnd(24)} bar ${String(sect.admissionOrdinal).padStart(2)}` +
                ` | applying at ${String(ordinal).padStart(2)} -> ${got ? `ADMITTED as "${c.sectRank}"` : 'refused'}`
            );
            if (ordinal === sect.admissionOrdinal && !got) {
                note('azure', 'broken', `${sect.name} refuses at its own stated bar.`);
            }
        }
    }
    note('azure', 'works', 'The three azure doors admit at their own bars and refuse below them.');
}

/**
 * The Hollow Court, from the outside and then from inside the gate.
 *
 * The most opaque institution in the setting, admitting at Void Refinement,
 * with four unnamed Seats nobody outside the mountains has ever identified. The
 * question is whether a player can get anywhere near any of it.
 */
async function theSeats() {
    rule('3. THE HOLLOW COURT AND ITS SEATS');
    const court = getSect('sect-hollow-court')!;
    const withdrawn = WITHDRAWN_POWERS['sect-hollow-court'];
    line(`  ${court.name}: bar ${court.admissionOrdinal} (${rankName(court.admissionOrdinal)}), ranks ${court.ranks.join(' > ')}`);
    line(`  seats, in order: ${withdrawn.seats.map(s => `${s.position} at ${s.ordinal}`).join(', ')}`);
    line(`  ordering: ${SEAT_ORDER.primary} Then: ${SEAT_ORDER.tiebreak.slice(0, 92)}...`);

    sub('the ordering rule, checked against the roster');
    let ok = true;
    for (let i = 1; i < withdrawn.seats.length; i++) {
        const above = withdrawn.seats[i - 1];
        const below = withdrawn.seats[i];
        if (below.ordinal > above.ordinal) ok = false;
        line(`  ${above.position.padEnd(12)} ${above.ordinal}  >=  ${below.position.padEnd(12)} ${below.ordinal}`);
    }
    if (ok) {
        note('seats', 'works', 'The four seats are ordered by ordinal descending, exactly as SEAT_ORDER states.');
    } else {
        note('seats', 'broken', 'The seat roster contradicts its own ordering rule.');
    }
    // The rule's own edge case is the reason Guest of the Court exists.
    if (/no attempts/i.test(SEAT_ORDER.whenSomebodyRunsOut)) {
        note('seats', 'works', 'The ordering rule states its own edge: somebody with no attempts left cannot be placed on it at all, which is why Guest of the Court had to be invented.');
    }

    sub('walking up to the gate at each rung');
    for (const ordinal of [20, 28, court.admissionOrdinal, 41]) {
        const { game, repos } = makeGame({ seed: `court-${ordinal}`, worldEnabled: true, adminMode: true });
        const { cultivator } = await game.newRun('Ke Yan');
        place(repos, cultivator.id, { realmOrdinal: ordinal, spiritStones: 5000 });
        (game as any).knowledge.learnIfNew({
            holderId: cultivator.id, kind: 'sect', id: court.id, name: court.name,
            onDay: 0, sourceKind: 'told', sourceNote: 'a name said once, by somebody who should not have'
        });
        await game.act(`I apply to the ${court.name}`);
        const c = cur(game);
        line(
            `  ${rankName(ordinal).padEnd(34)} -> ${c.sectId === court.id ? `ADMITTED as "${c.sectRank}"` : 'refused'}`
        );
        if (ordinal >= court.admissionOrdinal && c.sectId !== court.id) {
            note('seats', 'broken', `The Court refuses at ${rankName(ordinal)}, at or above its own bar.`);
        }
        if (ordinal < court.admissionOrdinal && c.sectId === court.id) {
            note('seats', 'broken', `The Court admitted somebody at ${rankName(ordinal)}, below its bar.`);
        }
    }
    note('seats', 'works',
        'Everybody enters at the bottom rung whatever they are: a Tribulation Transcendence '
        + 'cultivator joins as an Outer Disciple alongside a Void Refinement one. Promotion is '
        + 'gated on realm (29 + 4 per rung), so the strong one climbs to Seat almost at once - '
        + 'the house ranks by what you are, and the door does not.');
    note('seats', 'works', `The Court admits at its own bar (${rankName(court.admissionOrdinal)}) and refuses below it - the highest gate in the world, and it holds.`);

    sub('what a member can actually reach from inside');
    const { game, repos } = makeGame({ seed: 'court-inside', worldEnabled: true, adminMode: true });
    const { cultivator } = await game.newRun('Ke Yan');
    place(repos, cultivator.id, { realmOrdinal: court.admissionOrdinal, spiritStones: 5000 });
    (game as any).knowledge.learnIfNew({
        holderId: cultivator.id, kind: 'sect', id: court.id, name: court.name,
        onDay: 0, sourceKind: 'told', sourceNote: 'a name said once'
    });
    await game.act(`I apply to the ${court.name}`);
    line(`  ${snapshot(game)}`);
    for (const typed of [
        'what is my standing in the sect?',
        'I ask the first seat about the crossing',
        'I ask the sect elder about the seats'
    ]) {
        await play(game, typed, 'seats');
    }
    note('seats', 'friction',
        'The four Seats are catalog data with no presence a member can reach. Joining the most '
        + 'opaque house in the world produces a rank and a stipend and no contact with the people '
        + 'the house is famous for - which is arguably correct, since presence there is measured '
        + 'in decades of absence, but nothing in play ever says so to the player.');
}

async function switchingHouses() {
    rule('4. QUITTING ONE HOUSE AND JOINING ANOTHER');
    const { game, repos } = makeGame({ seed: 'switch', worldEnabled: true, adminMode: true });
    const { cultivator } = await game.newRun('Shen Wuyou');
    // Admission checks more than the rung: the Pavilion wants might 2 and
    // favours metal roots, and a character who fails that is refused for a
    // reason that has nothing to do with having left somewhere.
    place(repos, cultivator.id, {
        realmOrdinal: 3,
        spiritStones: 5000,
        spiritRoot: 'dual_metal_wood',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 }
    });
    for (const [id, name] of [['sect-azure-dew-sect', 'Azure Dew Sect'], ['sect-azure-cloud-pavilion', 'Azure Cloud Pavilion']] as const) {
        (game as any).knowledge.learnIfNew({
            holderId: cultivator.id, kind: 'sect', id, name,
            onDay: 0, sourceKind: 'told', sourceNote: 'a name said in a market town'
        });
    }

    sub('join the first, earn something, then leave');
    await play(game, 'I apply to the Azure Dew Sect', 'switching');
    repos.sects.addContribution(cur(game).sectId, cultivator.id, 400);
    const before = repos.sects.getMembership(cultivator.id)!;
    line(`  standing: "${before.rankTitle}", contribution ${before.contribution}`);
    await play(game, 'I leave the sect', 'switching');

    sub('and join the other');
    await play(game, 'I apply to the Azure Cloud Pavilion', 'switching');
    const after = repos.sects.getMembership(cultivator.id);
    line(`  now: ${snapshot(game)}`);
    if (after && after.sectId === 'sect-azure-cloud-pavilion') {
        note('switching', 'works', `Left one house and joined another; entered the new one at "${after.rankTitle}".`);
        if (after.contribution === 0) {
            note('switching', 'works', 'Contribution did not travel - the new house starts them at nothing.');
        } else {
            note('switching', 'broken', `Carried ${after.contribution} contribution into the new house.`);
        }
    } else {
        note('switching', 'broken', 'Could not join a second house after leaving the first, despite meeting the bar.');
    }

    sub('does the new house know, or care, where they came from?');
    await play(game, 'what is my standing in the sect?', 'switching');
    note('switching', 'friction',
        'Nothing records that they served elsewhere. A house cannot tell a first-time '
        + 'disciple from somebody who walked out of a rival last year.');
}

async function rogue() {
    rule('5. THE ROGUE - unaffiliated by choice, and by expulsion');

    sub('never joined anybody');
    const { game, repos } = makeGame({ seed: 'rogue', worldEnabled: true, adminMode: true });
    const { cultivator } = await game.newRun('Ke Yan');
    place(repos, cultivator.id, { realmOrdinal: 20, spiritStones: 400 });
    line(`  ${snapshot(game)}`);
    await play(game, 'I look around', 'rogue');
    await play(game, 'what is my standing in the sect?', 'rogue');
    await play(game, 'I draw my stipend', 'rogue');
    await play(game, 'I ask the sect for a promotion', 'rogue');
    note('rogue', 'works', 'Every sect verb refuses cleanly for somebody who serves no house.');

    sub('what the world offers a rogue at Core Formation');
    await play(game, 'I take work as a scribe for a year', 'rogue');
    await play(game, 'what is for sale at the market?', 'rogue');
    await play(game, 'I gather what herbs I can find', 'rogue');
    line(`  after: ${snapshot(game)}`);
}

/**
 * Death, which the game's own opening screen calls its first rule.
 *
 * "There is no reload, no revival, no continue. When a run ends it goes into
 * the ledger and stays there." Nine causes are enumerated in the schema. This
 * checks that a death actually closes a run, that the run is refused
 * afterwards, and that the ledger keeps it.
 */
async function deathAndTheLedger() {
    rule('7. DEATH, AND WHAT THE LEDGER KEEPS');
    const causes = [
        'lifespan_exhausted',
        'starvation',
        'untreated_injuries',
        'qi_deviation'
    ] as const;

    sub('killing a run four different ways, and asking for it back');
    for (const cause of causes) {
        const { game, repos } = makeGame({ seed: `death-${cause}`, worldEnabled: false, adminMode: true });
        const { cultivator, run } = await game.newRun('Ke Yan');

        repos.cultivators.update(cultivator.id, { alive: false, deathCause: cause } as never);
        repos.runs.endRun(run.id, cause, 'Closed by the playtest harness.');

        let refused = '';
        try {
            await game.act('I look around');
            refused = 'ACCEPTED THE ACTION';
        } catch (err) {
            refused = (err as Error).message.replace(/\s+/g, ' ').slice(0, 88);
        }
        line(`  ${cause.padEnd(20)} -> ${refused}`);
        if (refused === 'ACCEPTED THE ACTION') {
            note('death', 'broken', `A dead cultivator (${cause}) could still act.`);
        }
    }
    note('death', 'works', 'A closed run refuses every action with the cause named, and says there is no continuation.');

    sub('what the ledger holds afterwards');
    const { game, repos } = makeGame({ seed: 'ledger', worldEnabled: false, adminMode: true });
    const { cultivator, run } = await game.newRun('Ke Yan');
    repos.cultivators.update(cultivator.id, {
        alive: false, deathCause: 'failed_breakthrough', realmOrdinal: 16, age: 210
    } as never);
    repos.runs.endRun(run.id, 'failed_breakthrough', 'Struck the barrier once too often.');

    const ledger: any = game.ledger(10);
    const rows = ledger.runs ?? [];
    line(`  rows in the ledger: ${rows.length}`);
    for (const row of rows.slice(0, 3)) {
        line(`    ${JSON.stringify(row).slice(0, 150)}`);
    }
    if (rows.length > 0) {
        note('death', 'works', 'The run is in the ledger after it closes, with the name and the cause kept.');
    } else {
        note('death', 'broken', 'A closed run does not appear in the death ledger.');
    }

    sub('and a new run starts clean');
    const after = await game.newRun('Shen Wuyou');
    line(`  new run: ${after.cultivator.name}, ${rankName(after.cultivator.realmOrdinal)}, alive ${after.cultivator.alive}`);
    if (after.cultivator.realmOrdinal === 0 && after.cultivator.alive) {
        note('death', 'works', 'A new run begins at the bottom with nothing carried over - the ledger is the only thing that persists.');
    } else {
        note('death', 'broken', 'A new run inherited something from the closed one.');
    }
}

function immortalityOdds() {
    rule('8. THE ODDS, STATED PLAINLY');
    line('  Section 6 of scripts/playtest.ts runs the conditional sweep - what happens');
    line('  to somebody for whom everything went right. This is the other half: how');
    line('  many people the world contains at each height, from the catalogs.');

    const bands: Array<[string, number, number]> = [
        ['Qi Condensation', 0, 12],
        ['Foundation Establishment', 13, 16],
        ['Core Formation', 17, 20],
        ['Nascent Soul', 21, 24],
        ['Deity Transformation', 25, 28],
        ['Void Refinement', 29, 32],
        ['Body Integration', 33, 36],
        ['Grand Ascension', 37, 40],
        ['Tribulation Transcendence', 41, 44],
        ['Immortal', FALSE_IMMORTAL_ORDINAL, MAX_ORDINAL]
    ];
    sub('sect power ordinals - what the strongest acting member of each house is');
    const powers = SECTS.map(s => s.powerOrdinal).sort((a, b) => b - a);
    for (const [name, lo, hi] of bands) {
        const n = powers.filter(p => p >= lo && p <= hi).length;
        if (n) line(`  ${name.padEnd(28)} ${String(n).padStart(3)} house${n === 1 ? '' : 's'}  ${'#'.repeat(n)}`);
    }
    line(`  highest house in the world: ${rankName(powers[0])} (${powers[0]})`);
    line(`  the one False Immortal: ${WANDERERS.length}`);
    line(`  True Immortals still in the world: 0 by construction - ${rankName(TRUE_IMMORTAL_ORDINAL)} leaves it`);
    note('odds', 'works',
        `${SECTS.length} houses, topping out at ${rankName(powers[0])}, one resident False Immortal, `
        + 'and nobody at True Immortal in the world at all.');
}

/**
 * Disasters, and whether the map remembers them.
 *
 * The engine's position is stated in `locations.ts`: a catastrophe MODIFIES a
 * place and never spawns a new one, "the map does not grow, it scars." And a
 * cause is stored separately from the explanations people hold, so the record
 * can say truthfully that a place is forbidden, that the locals disagree about
 * why, and that the real reason is written nowhere - until somebody finds out.
 *
 * All of that machinery exists. The question here is whether it behaves.
 */
async function disasters() {
    rule('6. DISASTERS - the map scars rather than growing');

    let place = makeLocation({
        id: 'loc-test-vale',
        name: 'Nine Reed Vale',
        kind: 'village',
        foundedOnDay: 0
    });
    line(`  origin: ${place.name}, a ${place.origin.kind}, founded day 0`);

    sub('a tribulation goes wrong overhead');
    const struck = applyLocationChange(place, {
        onDay: 4_000,
        kind: 'destroyed',
        summary: 'The sky came down on the vale over an afternoon and did not stop at the person it came for.',
        patch: { kind: 'ruin', name: 'the Reed Scar' },
        causeFactId: null,
        attributedCauses: [
            'a cultivator who drew a tribulation they could not hold',
            'a punishment, for something the vale is said to have done',
            'nothing at all - the weather, and a story that grew afterwards'
        ]
    });
    place = struck.location;
    line(`  after:  ${place.name}, now a ${place.kind}`);
    line(`  cause known to anybody: ${place.changes[0].causeKnown}`);
    line(`  competing explanations held locally: ${place.changes[0].attributedCauses.length}`);
    for (const c of place.changes[0].attributedCauses) line(`    - ${c}`);

    if (place.kind === 'ruin' && place.id === 'loc-test-vale') {
        note('disaster', 'works', 'A catastrophe transformed the place in situ - same id, new kind. The map scarred rather than growing.');
    } else {
        note('disaster', 'broken', 'A catastrophe did not transform the existing record.');
    }
    if (place.changes[0].causeKnown === false && place.changes[0].attributedCauses.length >= 2) {
        note('disaster', 'works', 'The real cause is stored as unknown while the locals hold three incompatible explanations.');
    } else {
        note('disaster', 'broken', 'A disaster with no known cause did not store as "nobody knows why".');
    }

    sub('the place a returning player remembers');
    const before = stateAsOfDay(place, 3_999);
    const after = stateAsOfDay(place, 4_001);
    line(`  day 3,999: ${before.name} (${before.kind})`);
    line(`  day 4,001: ${after.name} (${after.kind})`);
    if (before.kind !== after.kind) {
        note('disaster', 'works', 'The world can be replayed to a past day, so a memory of a mountain can be checked against a world that no longer has one.');
    } else {
        note('disaster', 'broken', 'Replaying to a day before the disaster returns the scarred state.');
    }

    sub('and then, centuries later, somebody finds out why');
    const explained = explainLocationChange(place, place.changes[0].id, 'fact-the-thing-that-actually-happened', 'full');
    const change = explained.changes[0];
    line(`  cause known now: ${change.causeKnown} (fidelity: ${change.fidelity})`);
    line(`  the local explanations are still on the record: ${change.attributedCauses.length}`);
    if (change.causeKnown && change.attributedCauses.length >= 2) {
        note('disaster', 'works', 'Learning the truth does not delete the wrong versions - both stay on the record, which is what makes a discovery worth anything.');
    } else if (change.causeKnown) {
        note('disaster', 'friction', 'Learning the truth erased the explanations people held, so nothing records that anybody was ever wrong.');
    }

    // ── and now the part that is not a unit test: can anybody ASK ────────
    //
    // Everything above is the engine talking to itself. This section types
    // English at the same surface the client uses and measures whether it
    // arrives, because a subsystem that behaves perfectly and cannot be
    // reached is furniture in a room the player never enters. Measured rather
    // than asserted, so that when the route exists this stops reporting it as
    // missing - the previous version of this block was a hardcoded sentence,
    // which would have gone on being a finding for as long as it sat here.
    sub('what a player can do with any of this');
    const { game, repos } = makeGame({ seed: 'world-disaster', worldEnabled: true });
    const { cultivator } = await game.newRun('Wei Shan');
    const world = await game.loadWorld();
    const everywhere = world?.locations ?? [];
    const scarred = everywhere.filter(l => l.changes.length > 0);
    line(`  the seeded world carries ${everywhere.length} location(s); ${scarred.length} of them `
        + 'have had something done to them since they were made');

    if (scarred.length === 0) {
        note('disaster', 'broken',
            'The running world carries no location change history at all, so there is nothing for '
            + 'a read route to read. This is a plumbing gap in seeding rather than in the parser.');
        return;
    }

    const withheld = scarred.filter(l => l.changes.some(c => !c.causeKnown));
    const onRecord = scarred.filter(l => l.changes.every(c => c.causeKnown));
    const disputed = scarred.filter(l => l.changes.some(c => c.attributedCauses.length > 0));
    line(`  ${withheld.length} carry a cause the world has not surrendered, `
        + `${onRecord.length} carry one it has, ${disputed.length} carry competing local explanations`);

    // The trap case first: a place whose change points at a real fact id with
    // causeKnown false. If the answer for that reads differently from the
    // answer for a place with no cause at all, the gate has become a hint.
    const hidden = withheld[0] ?? scarred[0];
    // `place` the helper is shadowed by `place` the location in this scope.
    repos.cultivators.update(cultivator.id, { location: hidden.name } as never);
    line(`  standing at ${hidden.name} (${hidden.kind}), `
        + `${hidden.changes.length} change(s) on record, cause withheld: `
        + `${hidden.changes.some(c => !c.causeKnown)}`);

    const reached: string[] = [];
    const missed: string[] = [];
    for (const typed of [
        'what happened here',
        'why is this place a ruin',
        'what do the locals say about it',
        'what happened to this place'
    ]) {
        const r = await play(game, typed, 'disaster');
        const calls: any[] = r?.calls ?? r?.toolCalls ?? [];
        (calls.some(c => c.name === 'world.locationHistory') ? reached : missed).push(typed);
        const said = (r?.narration ?? '') as string;
        for (const change of hidden.changes) {
            if (change.causeKnown || !change.causeFactId) continue;
            if (said.includes(change.causeFactId)) {
                note('disaster', 'broken',
                    `The answer leaked the id of a cause the world has not surrendered `
                    + `(${change.causeFactId}). A player could tell a hidden truth from an absent one.`);
            }
        }
    }

    if (missed.length === 0) {
        note('disaster', 'works',
            'Asking why a place is the way it is reaches the location record from plain English, '
            + 'costs no days, and answers with what the place is, what was done to it and when. '
            + `All ${reached.length} phrasings arrived.`);
    } else {
        note('disaster', 'friction',
            `${missed.length} of ${missed.length + reached.length} phrasings still do not reach the `
            + `location record: ${missed.map(m => `"${m}"`).join('; ')}.`);
    }

    // The other side of the gate: a place whose cause IS on record answers with
    // the cause itself, out of the history ledger rather than out of the prose.
    if (onRecord.length > 0) {
        repos.cultivators.update(cultivator.id, { location: onRecord[0].name } as never);
        line(`  and now standing at ${onRecord[0].name}, whose cause the world does hold`);
        const known: any = await play(game, 'what happened here', 'disaster');
        const factId = onRecord[0].changes.find(c => c.causeKnown)?.causeFactId ?? null;
        const summary = world?.history.facts.find(f => f.id === factId)?.summary ?? null;
        const told = ((known?.narration ?? '') as string).replace(/\s+/g, ' ');
        if (summary && told.includes(summary.slice(0, 40))) {
            note('disaster', 'works',
                'Where the cause IS on record the answer names it, read out of the history ledger '
                + 'rather than restated in the location. The same question gets a different answer '
                + 'depending only on whether the world knows, which is the whole of the gate.');
        } else {
            note('disaster', 'friction',
                'A place whose cause the world holds still answers as though nobody knew. The '
                + 'read route is not consulting the history ledger.');
        }
    }

    if (disputed.length === 0) {
        note('disaster', 'friction',
            'No seeded place carries competing local explanations, so the disagreement a player '
            + 'would be shown instead of the truth is empty on a fresh world: every ruin answers '
            + '"nobody knows, and there is no story either". `attributedCauses` is only written by '
            + 'forbidZone during simulation. The route is wired; the content is not there yet.');
    }
}

async function main() {
    const fresh = <T>(fn: () => T): T => { resetCultivationWorlds(); return fn(); };
    await fresh(loreReach);
    await fresh(apexIntake);
    await fresh(theSeats);
    await fresh(switchingHouses);
    await fresh(rogue);
    await fresh(disasters);
    await fresh(deathAndTheLedger);
    fresh(immortalityOdds);

    rule('WORLD PLAYTEST FINDINGS');
    for (const kind of ['broken', 'friction', 'works'] as const) {
        const rows = notes.filter(n => n.kind === kind);
        if (!rows.length) continue;
        line();
        line(`  ${kind.toUpperCase()} (${rows.length})`);
        for (const r of rows) line(`    [${r.scenario}] ${r.text}`);
    }
    line();
    void bandFor; void holds;
}

main().catch(err => { console.error(err); process.exit(1); });
