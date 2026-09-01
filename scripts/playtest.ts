/**
 * Playtest harness - drives the real engine through whole runs.
 *
 * Not a test suite. The suite asserts invariants; this plays the game and
 * reports what a player would actually experience, so that "is it playable"
 * has an answer somebody can read rather than a green tick.
 *
 * Everything below goes through the same surfaces the web client uses -
 * `newRun`, `act`, `cultivate`, `breakthrough` - with the deterministic
 * narrator, so no network and no model. The intent parser is the real one, so
 * every line of player input here is a line a player could actually type.
 *
 * The one exception is the reachability sweep at the end, which asks a question
 * no single playthrough can answer - whether the top of the ladder is reachable
 * at all - and therefore runs thousands of lives at the engine level.
 */

import { makeGame } from '../tests/web/harness.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    LAST_CROSSING_ORDINAL,
    TRUE_IMMORTAL_ORDINAL,
    lifespanForOrdinal,
    progressRequiredForOrdinal,
    rankName
} from '../src/engine/cultivation/realms.js';
import { attemptBreakthrough } from '../src/engine/cultivation/breakthrough.js';
import { computeCultivationRate } from '../src/engine/cultivation/cultivation.js';
import { treatWorstInjuries } from '../src/engine/cultivation/injuries.js';

import { CultivationRNG } from '../src/engine/cultivation/rng.js';
import { satietyBurnMultiplier } from '../src/engine/cultivation/survival.js';
import { canAttemptBreakthrough } from '../src/engine/cultivation/breakthrough.js';
import { formInsight, recordAchievement } from '../src/engine/cultivation/understanding.js';
import type { Insight } from '../src/schema/cultivation.js';
import { makeCultivator } from '../tests/engine/cultivation/fixtures.js';
import { getSect } from '../src/data/cultivation/sects.js';
import { getHoldingsOf } from '../src/data/cultivation/immortal-items.js';
import {
    handleLeave,
    handlePromote,
    requiredContributionForRank,
    requiredOrdinalForRank
} from '../src/server/consolidated/sect-manage.js';
import {
    SATIETY_COST_PER_ACTION,
    SATIETY_MAX,
    stagnationYearsForOrdinal,
    type Injury
} from '../src/schema/cultivation.js';

type Game = ReturnType<typeof makeGame>['game'];

const line = (s = '') => console.log(s);
const rule = (title: string) => {
    line();
    line('='.repeat(78));
    line('  ' + title);
    line('='.repeat(78));
};
const sub = (title: string) => { line(); line('-- ' + title + ' ' + '-'.repeat(Math.max(0, 72 - title.length))); };

interface Note { scenario: string; kind: 'works' | 'friction' | 'broken'; text: string; }
const notes: Note[] = [];
const note = (scenario: string, kind: Note['kind'], text: string) => notes.push({ scenario, kind, text });

function cur(game: Game): any {
    const s: any = game.state();
    return s.cultivator ?? s;
}

function snapshot(game: Game): string {
    const c = cur(game);
    return [
        c.name,
        `${rankName(c.realmOrdinal)} (${c.realmOrdinal})`,
        `age ${Math.floor(c.age)}`,
        `hp ${c.hp}`,
        `satiety ${c.satiety}`,
        c.sectId ? `${c.sectId}${c.sectRank ? ` / ${c.sectRank}` : ''}` : 'unaffiliated',
        `stones ${c.spiritStones ?? 0}`,
        c.immortalStatus && c.immortalStatus !== 'none' ? c.immortalStatus.toUpperCase() : null,
        c.alive === false ? 'DEAD' : null
    ].filter(Boolean).join(' | ');
}

/** Type a line as a player would, and report what the engine did with it. */
async function play(game: Game, input: string, scenario: string): Promise<any> {
    try {
        const r: any = await game.act(input);
        const calls: any[] = r.calls ?? r.toolCalls ?? [];
        const actions = calls.filter(c => c.name?.startsWith('engine.'));
        const label = actions.map(c => `${c.action}${c.ok === false ? ' REFUSED' : ''}`).join(', ');
        line(`  > ${input}`);
        line(`      -> ${label || '(no engine call)'}`);
        const prose = (r.narration ?? '').replace(/\s+/g, ' ').trim();
        if (prose) line(`         "${prose.slice(0, 140)}${prose.length > 140 ? '...' : ''}"`);
        if (actions.some(c => c.action === 'unclear')) {
            note(scenario, 'friction', `Parser did not understand: "${input}"`);
        }
        return r;
    } catch (err) {
        const msg = (err as Error).message.replace(/\s+/g, ' ');
        line(`  > ${input}`);
        line(`      -> REFUSED: ${msg.slice(0, 140)}`);
        return null;
    }
}

/**
 * Keep the cultivator fed and solvent, the way a player has to.
 *
 * Seclusion does not suspend hunger, so a long climb is a logistics loop before
 * it is anything else: earn, buy the months, then spend them.
 */
async function sustain(game: Game): Promise<boolean> {
    const c = cur(game);
    if (!c.alive) return false;
    try {
        // A NAMED trade. 'take any work I can get' lists the board and does
        // nothing, which is friction worth reporting rather than working around
        // silently - see the findings.
        if ((c.spiritStones ?? 0) < 200) await game.act('I work as a porter for a year');
        await game.act('stock up on two years of rations');
        return cur(game).alive !== false;
    } catch {
        return false;
    }
}

/** The longest seclusion this cultivator can currently eat their way through. */
function bellyDays(realmOrdinal: number, satiety: number): number {
    const multiplier = satietyBurnMultiplier(realmOrdinal);
    if (multiplier <= 0) return Infinity;
    return Math.max(1, Math.floor(satiety / (SATIETY_COST_PER_ACTION * multiplier)));
}

/** Cultivate and strike until the rung is gained, dead, or out of patience. */
async function climb(
    game: Game,
    stopAt: number,
    opts: { chunkDays?: number; maxRounds?: number; quiet?: boolean } = {}
): Promise<{ reached: number; alive: boolean; rounds: number; ended: string | null }> {
    const wanted = opts.chunkDays ?? 360;
    const maxRounds = opts.maxRounds ?? 200;
    let ended: string | null = null;
    let rounds = 0;

    /** What actually killed them, in the engine's own words. */
    const causeOf = (): string => {
        const c = cur(game);
        return c.deathCause ? `died: ${c.deathCause}` : 'died, cause unrecorded';
    };

    for (; rounds < maxRounds; rounds++) {
        const c = cur(game);
        if (!c.alive) { ended = causeOf(); break; }
        if (c.realmOrdinal >= stopAt) break;
        if (c.satiety < SATIETY_MAX / 2 || (c.spiritStones ?? 0) < 50) {
            if (!(await sustain(game))) {
                ended = cur(game).alive === false ? causeOf() : 'ran out of stones and food';
                break;
            }
        }
        const fed = cur(game);
        const chunk = Math.max(1, Math.min(wanted, bellyDays(fed.realmOrdinal, fed.satiety)));
        try {
            await game.cultivate(chunk);
        } catch (err) {
            ended = (err as Error).message.slice(0, 90);
            break;
        }
        if (cur(game).alive === false) { ended = causeOf() + ' (in seclusion)'; break; }

        try {
            const r: any = await game.breakthrough();
            const res = r.result;
            if (!opts.quiet && res) {
                line(`      ${rankName(res.fromOrdinal)} -> ${res.outcome}` +
                    (res.toOrdinal !== undefined ? ` = ${rankName(res.toOrdinal)}` : '') +
                    ` @ ${(res.finalChance * 100).toFixed(1)}%`);
            }
            if (res?.outcome === 'death') { ended = 'struck down at the barrier'; break; }
            if (cur(game).alive === false) { ended = causeOf(); break; }
        } catch {
            /* not eligible yet - keep accumulating */
        }
    }

    const c = cur(game);
    return { reached: c.realmOrdinal, alive: c.alive !== false, rounds, ended };
}

// ─────────────────────────────────────────────────────────────────────────
// 1. THE WANDERER
// ─────────────────────────────────────────────────────────────────────────

async function wanderer() {
    rule('1. THE WANDERER - no sect, no patron, no floor under you');
    const { game } = makeGame({ seed: 'pt-wanderer', worldEnabled: true });
    const { cultivator } = await game.newRun('Ke Yan');
    line(`  dealt:  ${cultivator.spiritRoot}, ${JSON.stringify(cultivator.attributes)}`);
    line(`  start:  ${snapshot(game)}`);

    sub('finding your feet with nothing');
    await play(game, 'I look around', 'wanderer');
    await play(game, 'take any work I can get for a season', 'wanderer');
    await play(game, 'what is for sale at the market?', 'wanderer');
    await play(game, 'stock up on three months of rations', 'wanderer');

    sub('the road');
    await play(game, 'I ask around for word of any sects nearby', 'wanderer');
    await play(game, 'I gather what herbs I can find', 'wanderer');
    await play(game, 'I size up my chances against the barrier', 'wanderer');
    await play(game, 'I cultivate for a month', 'wanderer');

    sub('twenty years alone');
    const r = await climb(game, 13, { chunkDays: 300, maxRounds: 25, quiet: true });
    line(`  ${r.rounds} rounds later: ${snapshot(game)}`);
    if (r.ended) line(`  ended: ${r.ended}`);
    const end = r.ended ?? 'still going';
    if (r.reached >= 1) {
        note('wanderer', 'works',
            `Unaffiliated and unfunded, reached ${rankName(r.reached)} by working and secluding (${end}).`);
    } else {
        note('wanderer', 'friction',
            `A wanderer made no ladder progress in twenty years: ${end}. The early game is a `
            + 'logistics and encounter problem before it is a cultivation one, which is the '
            + 'stated design - worth confirming it is the intended severity rather than a gap.');
    }
}

// ─────────────────────────────────────────────────────────────────────────
// 2-4. THE DISCIPLE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The best start the schema allows, handed over in admin mode.
 *
 * A clean single root, the maximum draw, and enough standing to be worth
 * admitting. This is the "once in a generation" character the ladder is
 * supposed to be climbable by, and the point of giving it to them is that a
 * scenario about sect politics should not keep dying in a ditch at ordinal 2.
 */
function bestStart(repos: ReturnType<typeof makeGame>['repos'], id: string, ordinal: number): void {
    repos.cultivators.update(id, {
        spiritRoot: 'single_fire',
        attributes: { might: 3, insight: 4, fortune: 3, charm: 3 },
        realmOrdinal: ordinal,
        spiritStones: 5_000
    } as any);
}

/**
 * Put a sect's name in the player's head.
 *
 * Admission is gated twice and the gates are easy to confuse. The outer one is
 * KNOWLEDGE: a fresh cultivator has heard of exactly one order, and naming any
 * other gets "knowing a name is not an introduction" - which reads like a
 * refusal on standing and is nothing of the kind. Only past that does the sect's
 * own admission bar apply. Testing the bars means getting past the first gate
 * first, which in play means somebody says the name in front of you.
 */
function hearOf(game: Game, sectId: string, name: string): void {
    (game as any).knowledge.learnIfNew({
        holderId: (cur(game) as any).id,
        kind: 'sect',
        id: sectId,
        name,
        onDay: 0,
        sourceKind: 'told',
        sourceNote: 'a name said in a market town'
    });
}

/** Try to get admitted somewhere, by name, and report what the door said. */
async function tryDoor(game: Game, sectName: string, scenario: string): Promise<boolean> {
    await play(game, `I apply to the ${sectName}`, scenario);
    return cur(game).sectId !== null;
}

async function disciple(): Promise<void> {
    rule('2-5. THE DISCIPLE - joining, climbing, the top seat, and the betrayal');

    // ── 2. admission, at several different doors ─────────────────────────
    sub('2. which doors open, and at what standing');
    line('  Two gates, and they are easy to confuse: you must have HEARD of an order');
    line('  before its admission bar is even consulted. Both are tested here.');
    for (const [sectId, door] of [
        ['sect-azure-dew-sect', 'Azure Dew Sect'],
        ['sect-azure-cloud-pavilion', 'Azure Cloud Pavilion'],
        ['sect-crimson-abyss-hall', 'Crimson Abyss Hall'],
        ['sect-verdant-spring-hall', 'Verdant Spring Hall'],
        ['sect-hollow-court', 'Hollow Court']
    ] as const) {
        const bar = getSect(sectId)?.admissionOrdinal ?? 0;
        for (const [label, ordinal] of [['below the bar', Math.max(0, bar - 1)], ['at the bar', bar]] as const) {
            const { game, repos } = makeGame({
                seed: `pt-door-${sectId}-${ordinal}`, worldEnabled: true, adminMode: true
            });
            const { cultivator } = await game.newRun('Shen Wuyou');
            bestStart(repos, cultivator.id, ordinal);
            hearOf(game, sectId, door);
            const admitted = await tryDoor(game, door, 'joining');
            const c = cur(game);
            line(`  ${door.padEnd(24)} bar ${String(bar).padStart(2)} | ${label.padEnd(13)} `
                + `ordinal ${String(ordinal).padStart(2)} -> `
                + `${admitted ? `ADMITTED as "${c.sectRank}"` : 'refused'}`);
            if (label === 'at the bar') {
                note('joining', admitted ? 'works' : 'friction',
                    `${door}: ${admitted ? `admits at its own bar (${rankName(bar)}) as ${c.sectRank}` : `refuses even at its own bar (${rankName(bar)})`}.`);
            } else if (admitted && bar > 0) {
                note('joining', 'broken', `${door} admitted somebody BELOW its stated bar of ${bar}.`);
            }
        }
    }

    // ── the run that carries on ──────────────────────────────────────────
    const { game, repos } = makeGame({ seed: 'pt-sect', worldEnabled: true, adminMode: true });
    const { cultivator } = await game.newRun('Shen Wuyou');
    bestStart(repos, cultivator.id, 3);
    line(``);
    line(`  carrying on with: ${snapshot(game)}`);
    await play(game, 'I apply to the Azure Cloud Pavilion', 'joining');
    let c = cur(game);
    if (!c.sectId) {
        await play(game, 'I want to join a sect', 'joining');
        c = cur(game);
    }
    if (!c.sectId) {
        note('joining', 'broken', 'No door opened at any standing.');
        return;
    }
    const sect = getSect(c.sectId)!;
    line(`  ${sect.name}: ${sect.ranks.join(' -> ')}`);
    line(`  admission at ${rankName(sect.admissionOrdinal)}; stipend ladder ${JSON.stringify(sect.stipend)}`);

    // ── 3. climbing, in plain English ────────────────────────────────────
    sub('3. climbing the ranks, typed the way a player would type it');
    const top = sect.ranks.length - 1;
    for (let target = 1; target <= top; target++) {
        const needOrdinal = requiredOrdinalForRank(sect.admissionOrdinal, target);
        const needContribution = requiredContributionForRank(target);

        // The realm is the player's own work; admin stands in for the decades.
        repos.cultivators.update(cultivator.id, { realmOrdinal: needOrdinal } as any);

        // Contribution is earned by drawing a stipend, one point a month, and
        // that is the only source in the game. Reaching rung 5 the honest way
        // is 8100 months of service - see the findings.
        const held = repos.sects.getMembership(cultivator.id)!.contribution;
        if (held < needContribution) {
            repos.sects.addContribution(sect.id, cultivator.id, needContribution - held);
        }

        const before = cur(game).sectRank;
        await play(game, 'I ask the sect for a promotion', 'ranks');
        const after = cur(game).sectRank;
        if (after !== before) {
            line(`      ${rankName(needOrdinal).padEnd(36)} ${before} -> ${after}`);
        } else {
            note('ranks', 'broken', `Promotion to rung ${target} did not take.`);
            break;
        }
    }

    const membership = repos.sects.getMembership(cultivator.id)!;
    line(`  final: ${snapshot(game)}`);
    if (membership.rankIndex === top) {
        note('ranks', 'works',
            `Climbed ${sect.ranks[0]} -> ${sect.ranks[top]} through the command bar: `
            + `${top} promotions, each gated on realm and paid for in contribution.`);
    }

    await play(game, 'what is my standing in the sect?', 'ranks');
    await play(game, 'I draw my stipend', 'ranks');

    // ── 4. the top seat ──────────────────────────────────────────────────
    sub('4. acting as the head of the house');
    line(`  ${cur(game).name} holds "${membership.rankTitle}", the top rung of ${sect.name}.`);
    await play(game, 'I ask the sect for a promotion', 'leader');
    const holdings = getHoldingsOf(sect.id);
    line(`  what the house owns: ${holdings.length} immortal object(s)`);
    for (const h of holdings.slice(0, 4)) line(`    - ${h.name} (${h.grade})`);
    await play(game, 'I look over the sect', 'leader');

    // ── does the rank actually DO anything, or is it a title and a stipend? ──
    //
    // Measured rather than asserted. This used to be a hardcoded finding, which
    // meant it went on reporting a defect for as long as the sentence sat in
    // the file - including after the defect was fixed. A playtest that cannot
    // change its mind is a comment.
    const daysBefore = (game.state() as any).run?.elapsedDays ?? 0;
    const beforeOrder = cur(game);
    const ordered = await play(game, 'I order the disciples to gather herbs for a month', 'leader');
    const afterOrder = cur(game);
    const daysAfter = (game.state() as any).run?.elapsedDays ?? 0;
    const orderCalls: any[] = ordered?.calls ?? ordered?.toolCalls ?? [];
    const wentToOrder = orderCalls.some(c => c.name === 'sect_manage.order');

    if (!wentToOrder) {
        note('leader', 'broken',
            'Ordering the rung below has no route from the command bar. The sentence is caught by '
            + 'another verb, so a rank that exists to spend somebody else\'s days spends the '
            + 'player\'s instead.');
    } else if (daysAfter > daysBefore) {
        note('leader', 'broken',
            `An order cost the giver ${daysAfter - daysBefore} of their own days. Ordering is `
            + 'supposed to spend the ordered rung\'s time and nothing of the caller\'s.');
    } else {
        note('leader', 'works',
            'Ordering the rung below is reachable in plain English and costs the giver no days: '
            + 'somebody else\'s month, delivered as real state and paid for in standing.');
    }
    line(`  the order cost the giver ${daysAfter - daysBefore} day(s) and `
        + `${beforeOrder.satiety - afterOrder.satiety} satiety.`);

    // What the seat can do that the command bar still cannot reach. The powers
    // themselves are in `sect_manage` and tested; what is measured here is
    // whether a player typing English can get at them.
    const unreachable: string[] = [];
    for (const [typed, want] of [
        ['I expel an elder from the sect', 'sect_manage.expel'],
        ['I take on new disciples', 'sect_manage.recruit'],
        ['I raise the sect\'s admission standard', 'sect_manage.admission'],
        ['I change what the sect teaches', 'sect_manage.curriculum']
    ] as const) {
        const r = await play(game, typed, 'leader');
        const calls: any[] = r?.calls ?? r?.toolCalls ?? [];
        if (!calls.some(c => c.name === want)) unreachable.push(`"${typed}" -> ${want}`);
    }
    if (unreachable.length > 0) {
        note('leader', 'friction',
            `${unreachable.length} of the seat's powers are implemented and gated in sect_manage `
            + 'but have no route from the command bar, so only a narrator calling the tool can '
            + `use them: ${unreachable.join('; ')}.`);
    } else {
        note('leader', 'works',
            'All four of the seat\'s remaining powers - expel, recruit, admission, curriculum - '
            + 'are reachable in plain English. A sentence that names nobody in particular reaches '
            + 'the listing rather than acting, so a player can see what a dismissal or a change of '
            + 'standard would cost before spending it.');
    }
    await play(game, 'I give the sect treasure to a disciple', 'leader');

    // ── 5. betrayal ──────────────────────────────────────────────────────
    sub('5. robbing the house and running');
    line(`  before: "${membership.rankTitle}", contribution ${repos.sects.getMembership(cultivator.id)!.contribution}, `
        + `stones ${cur(game).spiritStones}, ${holdings.length} holdings on the shelf`);
    // Theft is its own verb now. What is measured is (a) that a theft sentence
    // reaches the siphon rather than falling through, and (b) that it does NOT
    // quietly process a resignation - "I take the sect treasury and leave in the
    // night" once matched on the word "leave" and cancelled the membership
    // without taking anything and without saying so.
    let reachedTheft = 0;
    let resignedByAccident = false;
    const thefts = [
        "I steal the sect's most valuable treasure",
        'I take the sect treasury and leave in the night',
        'I break into the sect vault and take what is there',
        'I siphon the reserves carefully for two years'
    ];
    for (const typed of thefts) {
        const r = await play(game, typed, 'betrayal');
        const calls: any[] = r?.calls ?? r?.toolCalls ?? [];
        const wentToSiphon = calls.some(c => c.name === 'sect_manage.siphon');
        if (wentToSiphon) reachedTheft++;
        // The specific old defect: the word "leave" inside a sentence about the
        // treasury reaching the resignation branch. Only a sentence that did NOT
        // reach the siphon and cost the membership anyway is that bug - being
        // caught siphoning is supposed to end the membership.
        if (!wentToSiphon && !repos.sects.getMembership(cultivator.id)) resignedByAccident = true;
    }
    // Named without an object. Nothing in the closed set answers it, and the
    // fallback is inert, so this costs the player a turn and nothing else.
    await play(game, 'I betray the sect', 'betrayal');

    const stillIn = repos.sects.getMembership(cultivator.id);
    line(`  after ${thefts.length} attempts at theft: ${stillIn ? `still ${stillIn.rankTitle}` : 'no longer a member'}`);

    if (reachedTheft === 0) {
        note('betrayal', 'broken',
            `There is no theft anywhere in the closed action set. ${thefts.length} phrasings, no `
            + 'route, and the sect keeps every object it owns whatever the player types.');
    } else if (reachedTheft < thefts.length) {
        note('betrayal', 'friction',
            `${reachedTheft} of ${thefts.length} theft phrasings reach the reserves; the rest fall `
            + 'through to something else.');
    } else {
        note('betrayal', 'works',
            `All ${thefts.length} theft phrasings reach the reserves, priced as a draw over months `
            + 'with a pace, rather than as a single grab.');
    }
    if (resignedByAccident) {
        note('betrayal', 'broken',
            'A sentence about robbing the house quietly cancelled the membership instead. Asking '
            + 'to steal and being resigned without being told is the one answer worse than a refusal.');
    } else {
        note('betrayal', 'works',
            'A theft sentence containing the word "leave" no longer resigns the membership. '
            + `The membership ${stillIn ? 'is intact' : 'ended only because the house caught them'}.`);
    }
    if (!stillIn) {
        note('betrayal', 'works',
            'Getting caught is a real end: the house expels, the rank goes with the access, and '
            + 'what is still held goes back.');
    }

    // Walking out cleanly, in a run that still has a membership to walk out of.
    const { game: quitter, repos: quitRepos } = makeGame({
        seed: 'pt-quit', worldEnabled: true, adminMode: true
    });
    const quit = (await quitter.newRun('Shen Wuyou')).cultivator;
    bestStart(quitRepos, quit.id, sect.admissionOrdinal);
    hearOf(quitter, sect.id, sect.name);
    await play(quitter, `I apply to the ${sect.name}`, 'betrayal');
    const joined = !!quitRepos.sects.getMembership(quit.id);
    await play(quitter, 'I leave the sect', 'betrayal');
    const gone = quitRepos.sects.getMembership(quit.id);
    line(`  after "I leave the sect": ${gone ? gone.rankTitle : 'no membership'}`);
    if (joined && !gone) {
        note('betrayal', 'works',
            'Walking out is reachable and it costs: the rank goes and the contribution is '
            + 'forfeited rather than carried to the next house.');
    } else if (joined) {
        note('betrayal', 'broken', 'Resigning did not take.');
    }
}

// ─────────────────────────────────────────────────────────────────────────
// 6. IS THE TOP REACHABLE? - engine-level sweep
// ─────────────────────────────────────────────────────────────────────────

/**
 * Deep comprehension. The site alone stalls in the low thirties - understanding
 * standing in for accumulation at a bottleneck is the other half of the
 * conjunction, and a sweep without it is not testing the top of the ladder, it
 * is testing half of it.
 */
function deepInsights(): Insight[] {
    const a = recordAchievement(
        { kind: 'enlightenment', onDay: 1, turn: 1, summary: 'It arrived.' },
        new CultivationRNG('insight')
    );
    const access = { kind: 'teacher' as const, label: 'a teacher' };
    return [
        formInsight({ domain: 'life_death', subject: 'mortality', opening: 'o', access }, 5, a),
        formInsight({ domain: 'karma', subject: 'debt', opening: 'o', access }, 5, a),
        formInsight({ domain: 'void', subject: 'the seam', opening: 'o', access }, 4, a)
    ];
}

/** One whole life at the engine level, everything going right. */
function oneLife(seed: string): { peak: number; outcome: string } {
    let ordinal = 0;
    let progress = 0;
    let age = 16;
    let yearsAtRank = 0;
    let peak = 0;
    let attempt = 0;
    const injuries: Injury[] = [];
    const insights = deepInsights();
    const attributes = { might: 3, insight: 4, fortune: 3, charm: 3 };
    const root = 'single_fire' as const;
    const ambient = 'sealed_vein' as const;

    for (let guard = 0; guard < 4000; guard++) {
        const required = progressRequiredForOrdinal(ordinal);
        if (required === null) return { peak, outcome: 'above the Lid' };

        const rate = computeCultivationRate(
            { spiritRoot: root, injuries, insights, foundationQuality: 'exceptional' },
            ambient,
            { focusMultiplier: 1, techniqueBonus: 1.3, sectBonus: 1.2 }
        ).perDay;
        if (rate <= 0) return { peak, outcome: 'stopped: no rate' };

        const substituted = canAttemptBreakthrough({
            realmOrdinal: ordinal, cultivationProgress: progress,
            spiritRoot: root, insights, alive: true
        }).progressSubstituted;
        const need = Math.max(0, required - substituted - progress);
        const years = Math.max(1 / 365, need / (rate * 365));
        if (yearsAtRank + years >= stagnationYearsForOrdinal(ordinal)) return { peak, outcome: 'settled' };
        if (age + years >= lifespanForOrdinal(ordinal)) return { peak, outcome: 'lifespan' };
        age += years; yearsAtRank += years; progress += need;

        const r = attemptBreakthrough(
            makeCultivator({
                realmOrdinal: ordinal,
                cultivationProgress: progress,
                spiritRoot: root,
                attributes,
                injuries,
                insights,
                foundationQuality: 'exceptional',
                age
            }),
            {
                rng: new CultivationRNG(`${seed}:${attempt++}`), ambient, turn: Math.floor(age),
                pill: { name: 'p', potency: 0.35 }, toll: { candidates: [] }
            }
        );
        progress = Math.max(0, progress - r.progressConsumed);
        for (const j of r.injuriesSustained) injuries.push(j);
        const healed = treatWorstInjuries(injuries, injuries.length);
        injuries.length = 0; injuries.push(...healed.injuries);

        if (r.outcome === 'death') return { peak, outcome: 'struck down' };
        if (r.outcome === 'false_immortal') { peak = Math.max(peak, r.toOrdinal); return { peak, outcome: 'False Immortal' }; }
        if (r.outcome === 'success') {
            ordinal = r.toOrdinal;
            peak = Math.max(peak, ordinal);
            yearsAtRank = 0;
            if (ordinal >= TRUE_IMMORTAL_ORDINAL) return { peak, outcome: 'True Immortal' };
        }
    }
    return { peak, outcome: 'ran out of turns' };
}

function reachability(lives: number) {
    rule('6. THE ONCE-IN-A-GENERATION GENIUS - is the top of the ladder real?');
    line(`  best root, best attributes the schema allows (3/4/3/3), sealed vein,`);
    line(`  pills every attempt, every injury treated. ${lives} lives.`);
    const outcomes = new Map<string, number>();
    let bestPeak = 0;
    let crossings = 0;
    let through = 0;
    for (let i = 0; i < lives; i++) {
        const { peak, outcome } = oneLife(`genius-${i}`);
        outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
        bestPeak = Math.max(bestPeak, peak);
        if (peak >= FALSE_IMMORTAL_ORDINAL) crossings++;
        if (peak >= TRUE_IMMORTAL_ORDINAL) through++;
    }
    sub('what happened to them');
    for (const [k, v] of [...outcomes].sort((a, b) => b[1] - a[1])) {
        line(`    ${String(v).padStart(5)}  ${((v / lives) * 100).toFixed(2).padStart(6)}%  ${k}`);
    }
    line();
    line(`  highest rung anybody reached: ${rankName(bestPeak)} (${bestPeak})`);
    line(`  made the last crossing:       ${crossings} of ${lives}`);
    line(`  came out True Immortal:       ${through} of ${lives}`);

    if (through > 0) note('genius', 'works', `True Immortal (46) is reachable: ${through} of ${lives} best-case lives got through.`);
    else if (crossings > 0) note('genius', 'works', `The crossing is reachable (${crossings}/${lives}), and every one came back False Immortal.`);
    else if (bestPeak >= 41) note('genius', 'friction', `Best case reaches ${rankName(bestPeak)}; nobody reached the crossing itself.`);
    else note('genius', 'broken', `Best case stalls at ${rankName(bestPeak)} (${bestPeak}); the top of the ladder is decorative.`);
    return bestPeak;
}

// ─────────────────────────────────────────────────────────────────────────
// 7. ABOVE THE LID
// ─────────────────────────────────────────────────────────────────────────

async function aboveTheLid() {
    rule('7. ABOVE THE LID - playing a False Immortal, and a True one');
    line('  The crossing itself is covered by the sweep above: at 2% odds and');
    line('  without the preparation, thirteen straight attempts all ended in death,');
    line('  which is the design working. What is tested here is the two STATES.');

    for (const [label, ordinal, status] of [
        ['False Immortal', FALSE_IMMORTAL_ORDINAL, 'false_immortal'],
        ['True Immortal', TRUE_IMMORTAL_ORDINAL, 'true_immortal']
    ] as const) {
        sub(label);
        const { game, repos } = makeGame({
            seed: `pt-lid-${status}`, worldEnabled: true, adminMode: true
        });
        const { cultivator } = await game.newRun('Lu Wangchen');
        repos.cultivators.update(cultivator.id, {
            realmOrdinal: ordinal,
            immortalStatus: status,
            age: 30_000
        } as any);
        line(`  admin-placed: ${snapshot(game)}`);

        await play(game, 'where do I stand?', 'above-the-lid');
        await play(game, 'I strike at the barrier', 'above-the-lid');
        await play(game, 'I look around', 'above-the-lid');
        await play(game, 'I cultivate for a year', 'above-the-lid');
        await play(game, 'I take work as a porter for a year', 'above-the-lid');

        const c = cur(game);
        const d: any = (game.state() as any).derived ?? {};
        line(`  after: ${snapshot(game)}`);
        line(`  progressRequired reported to the client: ${JSON.stringify(d.progressRequired)}`);

        if (!c.alive) {
            note('above-the-lid', 'broken', `${label} died while merely standing about.`);
        } else {
            note('above-the-lid', 'works', `${label} is a playable state: the run continues and the world still answers.`);
        }
        if (d.progressRequired === null) {
            note('above-the-lid', 'works', `${label}: the client is told there is no qi price, rather than a fake number.`);
        } else {
            note('above-the-lid', 'broken', `${label}: client shows progressRequired = ${d.progressRequired}.`);
        }
        if (satietyBurnMultiplier(ordinal) === 0) {
            note('above-the-lid', 'works', `${label} does not eat, so a long seclusion costs nothing but time.`);
        }

        // The other axis. Rank is shut up here permanently and dao is not, so
        // the sheet has to carry it or the page reads as nothing but absences.
        const dao = d.dao;
        line(`  dao block: ${dao ? `${dao.insights.length} insight(s), ${dao.totalDegrees} degrees, `
            + `theOnlyAxisLeft=${dao.theOnlyAxisLeft}` : 'ABSENT'}`);
        if (!dao) {
            note('above-the-lid', 'broken', `${label}: the sheet carries no dao block at all.`);
        } else if (dao.theOnlyAxisLeft !== true) {
            note('above-the-lid', 'broken',
                `${label}: the sheet does not say the dao is the only axis left, though the rank is shut.`);
        } else {
            note('above-the-lid', 'works',
                `${label}: the sheet carries the dao and says outright that it is the only axis still open.`);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────

async function main() {
    await wanderer();
    await disciple();
    reachability(Number(process.env.LIVES ?? 1500));
    await aboveTheLid();

    rule('PLAYTEST FINDINGS');
    for (const kind of ['broken', 'friction', 'works'] as const) {
        const rows = notes.filter(n => n.kind === kind);
        if (!rows.length) continue;
        line();
        line(`  ${kind.toUpperCase()} (${rows.length})`);
        for (const r of rows) line(`    [${r.scenario}] ${r.text}`);
    }
    line();
}

main().catch(err => { console.error(err); process.exit(1); });
