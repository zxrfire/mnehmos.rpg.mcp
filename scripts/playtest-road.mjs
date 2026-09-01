/**
 * THE SHAPE OF THE CLIMB.
 *
 * The claim under test is a sentence about the whole game rather than about any
 * one mechanic: *the road towards 44 is not easy, is not simple, it's fraught,
 * but it's interesting.* Nothing else in this repo measures it, because every
 * other harness measures a subsystem in isolation and the interesting/merely-
 * lethal distinction only exists at the level of a whole life.
 *
 * The distinction this harness is built to draw:
 *
 *   FRAUGHT AND INTERESTING  a life ends for a reason the player could see
 *                            coming, could have played differently, and can
 *                            learn from. Varied causes. Real decisions with
 *                            real costs.
 *   MERELY LETHAL            a life ends to a coin flip the player could not
 *                            influence, to the same cause every time, or so
 *                            early that nothing happened first.
 *
 * ── HOW IT MEASURES DECISION VERSUS DICE ────────────────────────────────
 *
 * By ARMS, not by introspection. Four policies play the same engine and their
 * outcome distributions are compared. Arms are interleaved round-robin WITHIN
 * each worker's database rather than given databases of their own, because a
 * run begins in the world the last one left behind (`planNextRun`): separate
 * databases would compare policies across different worlds, and the between-
 * world variance is large enough to swamp the effect. They are not paired on a
 * seed - no two arms ever play the same life - so read the arms as samples from
 * one world, not as a matched trial.
 *
 *   drift   the player who does nothing but sit down. No manual, no money, no
 *           healer, no house. Cultivate, and cultivate again.
 *   rogue   the informed player with no institution: learns what is on offer,
 *           earns when the purse is low, treats wounds, goes looking for
 *           another book when the one in hand runs out.
 *   sect    the same informed player who also joins a house AND uses it: draws
 *           the stipend, takes commissions off the board, asks to be promoted.
 *   mended  a COUNTERFACTUAL, held out of every pooled figure. See POLICIES.
 *
 * If `drift` and `rogue` end the same way, the road is dice and the verbs are
 * decoration. If `rogue` and `sect` end the same way, membership is a label.
 * Neither conclusion can be reached by reading the code, and both were false
 * readings taken from harnesses that only ever played one policy.
 *
 * ── WHAT IT REFUSES TO DO ────────────────────────────────────────────────
 *
 * NO PROGRESS TOP-UP. `scripts/ttrun.mjs`-shaped drivers write the progress bar
 * up to the rung requirement so that a life can reach the top in reasonable
 * wall-clock. That is legitimate for asking "what does the crossing at 44 cost",
 * and it makes every question this harness asks unanswerable: a topped-up bar
 * walks straight through the technique ceiling, the ground ceiling, guidance
 * and the whole accrual economy without noticing they exist. Every qi-unit here
 * was accrued by the engine.
 *
 * NO COMBAT RESOLUTION. The driver never issues `attack`. `Confrontation.
 * engageable` is false for `above` and `beneath`, and a driver that resolves
 * those as battles manufactures a lethality the game does not have - which is
 * how the encounter layer once became the leading cause of death in a report.
 * Every `combat_defeat` counted here was initiated by the engine.
 *
 * NO REPLAYED CORPSES. `POST /api/run/new` answers 409 while a run is alive -
 * runs end when the cultivator dies; there is no abandoning one. A driver that
 * ignores that replays one exhausted body and reports it as many lives (this
 * produced a "100% starvation" reading once). Every life here is checked for a
 * live predecessor before it starts, the 409 is surfaced, and a life that ends
 * by running out of harness budget rather than by dying is recorded as
 * `budget_exhausted` and is NEVER counted as a death.
 *
 *   node scripts/playtest-road.mjs --lives 240 --workers 6
 *   node scripts/playtest-road.mjs --lives 60 --workers 3 --arms drift,sect
 *
 * Requires a build: it spawns `dist/web/server.js`. The narrator is the
 * deterministic one (no provider configured), so every sentence the driver
 * reads is the engine's own account out of facts.ts.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');

const { rankName, realmForOrdinal, isRealmBoundary, MAX_ORDINAL } =
    await import(new URL('../dist/engine/cultivation/realms.js', import.meta.url).href);
const { daoRequirementCurve, DAO_GATE_FROM_ORDINAL } =
    await import(new URL('../dist/engine/cultivation/breakthrough.js', import.meta.url).href);

// ─────────────────────────────────────────────────────────────────────────
// ARGUMENTS
// ─────────────────────────────────────────────────────────────────────────

function arg(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

const LIVES = Number(arg('lives', 120));
const WORKERS = Number(arg('workers', 4));
const BASE_PORT = Number(arg('port', 8850));
const ARMS = String(arg('arms', 'drift,rogue,sect')).split(',').map(s => s.trim()).filter(Boolean);
const OUT = arg('out', join(tmpdir(), 'road-report.json'));
const WORKDIR = arg('workdir', join(tmpdir(), `road-${process.pid}`));

/** Days requested per seclusion. Interrupts cut it short; this is the ceiling. */
const CHUNK_DAYS = Number(arg('chunk', 3650));
/** Hard stop on API turns for one life. Reaching it is a finding, not a death. */
const TURN_BUDGET = Number(arg('turnBudget', 300));
/** Hard stop on simulated years for one life. Same. */
const YEAR_BUDGET = Number(arg('yearBudget', 3000));
/** Work when the purse falls below this. Provisions are bought out of it. */
const POOR_BELOW = 150;

// ─────────────────────────────────────────────────────────────────────────
// SERVER
// ─────────────────────────────────────────────────────────────────────────

function startServer(port, dbPath) {
    const child = spawn(process.execPath, [join(repo, 'dist', 'web', 'server.js')], {
        cwd: repo,
        env: {
            ...process.env,
            PORT: String(port),
            HOST: '127.0.0.1',
            RPG_MCP_DB_PATH: dbPath,
            ADMIN_MODE: 'false',
            // Deliberately blanked. A configured provider would put an LLM in
            // phase 1 and phase 3, which makes the run non-reproducible and
            // costs a request per turn for prose nothing here reads.
            ANTHROPIC_API_KEY: '',
            OPENAI_API_KEY: '',
            OPENROUTER_API_KEY: ''
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', () => {});
    child.stderr.on('data', () => {});
    return child;
}

async function waitForHealth(port, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const r = await fetch(`http://127.0.0.1:${port}/api/health`);
            if (r.ok) return await r.json();
        } catch { /* not up yet */ }
        await new Promise(r => setTimeout(r, 200));
    }
    throw new Error(`server on ${port} never became healthy`);
}

// ─────────────────────────────────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────────────────────────────────

function clientFor(port) {
    const base = `http://127.0.0.1:${port}`;
    const post = async (path, body) => {
        const r = await fetch(base + path, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        return { status: r.status, body: await r.json() };
    };
    return {
        state: async () => (await fetch(base + '/api/state')).json(),
        newRun: name => post('/api/run/new', { name }),
        act: input => post('/api/act', { input }),
        // Deliberately unused for the climb - see the banner at the seclusion
        // call. Kept because it is part of the surface under test and a future
        // arm comparing the click path against the typed path needs it.
        cultivate: days => post('/api/cultivate', { days }),
        breakthrough: () => post('/api/breakthrough')
    };
}

// ─────────────────────────────────────────────────────────────────────────
// READING THE ENGINE'S OWN ACCOUNT
//
// Every string parsed below comes from facts.ts with the deterministic
// narrator in place, so it is the engine's sentence and not a model's. Each
// parse is deliberately anchored on a fixed prefix the engine emits, and every
// one of them records a miss so a silently-changed sentence shows up as a
// counted parse failure rather than as a policy that quietly stopped acting.
// ─────────────────────────────────────────────────────────────────────────

const parseMisses = new Map();
const miss = what => parseMisses.set(what, (parseMisses.get(what) ?? 0) + 1);

/**
 * "  Lesser Qi-Gathering Manual (mortal grade)."
 *
 * Only the first block. The listing has a second one - "And these, which fight
 * the root rather than run with it ... Learning one can tear the meridians on
 * the spot" - printed as "  Name, of element." with no grade, which is why the
 * grade is what the pattern anchors on. Nothing suitable on offer is a real
 * answer and not a parse failure, so the miss is recorded only when the engine
 * printed a block this driver could not read.
 */
function techniquesOffered(narration) {
    const text = String(narration ?? '');
    const out = [];
    for (const line of text.split('\n')) {
        const m = /^\s{2,}(.+?)\s+\((mortal|earth|heaven|immortal|chaos)[- ]grade\)/i.exec(line);
        if (m) out.push({ name: m[1].trim(), grade: m[2].toLowerCase() });
    }
    if (out.length === 0 && /could take up/i.test(text)) miss('techniques_offered');
    return out;
}

/** "  What a Poor District Has: 20 days, 10 contribution and 13 spirit stones on completion." */
function commissionsOn(narration) {
    const out = [];
    for (const line of String(narration ?? '').split('\n')) {
        const m = /^\s{2,}(.+?):\s*(\d+) days?,\s*(\d+) contribution and (\d+) spirit stones/i.exec(line);
        if (m) out.push({ name: m[1].trim(), days: +m[2], contribution: +m[3], stones: +m[4] });
    }
    if (out.length === 0 && /house is asking for/i.test(String(narration ?? ''))) miss('commissions');
    return out;
}

/** "  Innkeeper, and a month of it keeps them about 3 months (low)." */
function jobsOffered(narration) {
    const out = [];
    for (const line of String(narration ?? '').split('\n')) {
        const m = /^\s{2,}(.+?), and a month of it keeps them about ([\d.]+) months?/i.exec(line);
        if (m) out.push({ name: m[1].trim(), months: Number(m[2]) });
    }
    if (out.length === 0) miss('jobs_offered');
    return out;
}

/** "There is one name you have for this: Azure Dew Sect." / a bulleted roll. */
function sectsNamed(narration) {
    const text = String(narration ?? '');
    const out = [];
    const single = /name you have for this: ([^.\n]+)\./.exec(text);
    if (single) out.push(single[1].trim());
    for (const line of text.split('\n')) {
        const m = /^\s{2,}([A-Z][^,.(]*?(?:Sect|Court|Hall|Pavilion|Palace|House|Clan|School|Order))\b/.exec(line);
        if (m) out.push(m[1].trim());
    }
    // Having heard of nobody is the commonest opening state in this game and is
    // an answer, not a failure to read one.
    if (out.length === 0 && !/no (?:name|house|sect)|nobody|not one|you have no/i.test(text)) {
        miss('sects_named');
    }
    return [...new Set(out)];
}

/**
 * The rung the strike was made FROM, and the odds it was made against.
 *
 * Read out of `SimEvent.data`, which `time-skip.ts` populates with
 * `fromOrdinal` and `finalChance` on both the success and the failure push -
 * NOT out of the summary sentence. The prose carries the odds only on success
 * (`resolveSuccess` writes "Odds were ..."; `resolveFailure` does not), so a
 * harness reading the sentence sees every failure as an unknown and reports
 * 100% success in every odds bucket. This one did, for one run.
 */
function strikeFrom(event) {
    const d = event?.data ?? {};
    const chance = typeof d.finalChance === 'number' ? d.finalChance * 100 : null;
    return {
        ok: event.kind === 'breakthrough_success',
        fromOrdinal: typeof d.fromOrdinal === 'number' ? d.fromOrdinal : null,
        odds: chance,
        summary: String(event.summary ?? '').slice(0, 140)
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE THREE POLICIES
//
// Each is a function of the sheet the API returns and nothing else. None of
// them reads a catalog, a seed, or any engine internal - a policy that knows
// which manual is the good one is not measuring a player.
// ─────────────────────────────────────────────────────────────────────────

const POLICIES = {
    /** Sits down and does not get up. The floor the other two are measured against. */
    drift: { manual: false, money: false, treat: false, sect: false, rebook: false, mend: false },
    /** Everything a player can do for themselves, and no institution. */
    rogue: { manual: true, money: true, treat: true, sect: false, rebook: true, mend: false },
    /**
     * The same, inside a house, and USING it.
     *
     * Joining and then never speaking to the house again would test the
     * membership row rather than the membership. `sect_manage` carries duty,
     * stipend, standing and promote, all four reachable from plain English, so
     * this arm takes the board, draws the stipend and asks to be moved up. If
     * a member who does all of that still lives a rogue's life, the finding is
     * about the institution and not about the policy that failed to use it.
     */
    sect: { manual: true, money: true, treat: true, sect: true, rebook: true, mend: false },
    /**
     * ── A COUNTERFACTUAL, AND IT IS NOT THE GAME ─────────────────────────
     *
     * The `sect` policy with one thing added that the game does not have: hp
     * returned to full between stretches, written straight into the row.
     *
     * This is the exact move this harness's header forbids, and it is here on
     * purpose and fenced off. Nothing in `src/engine/cultivation` restores hp -
     * not the time skip, not a realm advance, not `treat`, which buys a month
     * under a physician, marks wounds closed and writes no hp at all - and the
     * six `heal_hp` pills in `data/cultivation/pills.ts` have no verb in
     * `ACTION_NAMES` that swallows one. So hp is a strictly decreasing resource
     * over a life, and the question that matters to whoever owns that defect is
     * not "is it a defect" but "is it THE defect": if hp came back, would the
     * road become a road, or would the next thing kill everybody at the same
     * rung?
     *
     * Its numbers are reported in their own section and are NEVER pooled with
     * the other arms. Anything sourced from this arm is a statement about a
     * game that does not exist yet.
     */
    mended: { manual: true, money: true, treat: true, sect: true, rebook: true, mend: true }
};

// ─────────────────────────────────────────────────────────────────────────
// ONE LIFE
// ─────────────────────────────────────────────────────────────────────────

const EMPTY_LIFE = () => ({
    arm: null,
    seed: null,
    spiritRoot: null,
    origin: null,
    birthplace: null,
    attributes: null,
    finalOrdinal: 0,
    peakOrdinal: 0,
    age: 0,
    alive: false,
    ending: null,
    endedAtOrdinal: 0,
    endedOnBoundary: false,
    turns: 0,
    simulatedYears: 0,
    seclusions: 0,
    // Did anything happen, and was it a decision or a number moving?
    events: {},
    interrupts: 0,
    interruptReasons: {},
    // The dice: every barrier strike the engine resolved, with its own odds.
    strikes: [],
    // The gates.
    zeroRateSeclusions: 0,
    zeroRateDays: 0,
    /** Stretches that went backwards, and how much banked qi they cost. */
    progressDestroyedStretches: 0,
    progressDestroyed: 0,
    cappedAtOrdinal: null,
    capLifted: false,
    manualsHeld: 0,
    manualsLearned: 0,
    guided: false,
    joinedSect: null,
    sectRank: null,
    dutiesOffered: 0,
    stipendsDrawn: 0,
    dutiesTaken: 0,
    contributionEarned: 0,
    promotions: 0,
    // Understanding, which is what the dao gate would read if it were switched on.
    roadsWalked: 0,
    insightCount: 0,
    // What the player was refused, by engine routine.
    refusals: {},
    // Money, which is the only thing standing between provisioning and starving.
    workedYears: 0,
    treatments: 0,
    endedPurse: 0,
    /**
     * The stretch the life died in, as the engine described it.
     *
     * The whole interesting/merely-lethal distinction lives here. `combat_defeat`
     * as a bare cause says only that hp reached zero; whether that was a fight
     * the player walked into, a hazard that chipped them to one and then a
     * deviation, or a wound they declined to treat, is the difference between a
     * death worth having and a coin flip. `incidentalDeltas` floors non-
     * interrupting encounter damage at `hp - 1` and never kills, so a
     * combat_defeat is always something else finishing what an encounter
     * started - and this is the only place that shows which.
     */
    deathScene: null
});

const bump = (obj, key, by = 1) => { obj[key] = (obj[key] ?? 0) + by; };

async function liveOne(api, arm, name, mender = null) {
    const policy = POLICIES[arm];
    const life = EMPTY_LIFE();
    life.arm = arm;

    // A live predecessor means the previous life never ended. Do not start on
    // top of it - the 409 exists for a reason and swallowing it is how one body
    // gets reported as forty.
    const before = await api.state().catch(() => null);
    if (before?.cultivator?.alive) return { blocked: 'predecessor_alive' };

    const started = await api.newRun(name);
    if (started.status !== 201) return { blocked: `new_run_${started.status}:${started.body?.error ?? ''}` };

    let s = started.body.cultivator;
    life.seed = started.body.run?.seed ?? null;
    life.spiritRoot = s.spiritRoot;
    life.origin = s.origin;
    life.birthplace = s.location;
    life.attributes = s.attributes;

    const note = result => {
        for (const call of result?.toolCalls ?? []) {
            if (call.ok === false && call.name !== 'narrator.plan') {
                bump(life.refusals, `${call.name}`);
            }
        }
    };

    const say = async input => {
        life.turns++;
        const r = await api.act(input);
        note(r.body);
        return r.body;
    };

    // ── opening moves ───────────────────────────────────────────────────
    if (policy.sect) {
        const listed = await say('what sects are there');
        const names = sectsNamed(listed.narration);
        for (const sect of names.slice(0, 3)) {
            const applied = await say(`I apply to the ${sect}`);
            const joined = (applied.toolCalls ?? []).some(c => c.name === 'sect_manage.join' && c.ok);
            if (joined) { life.joinedSect = sect; break; }
        }
    }
    if (policy.manual) await learnWhatIsOffered(say, life);

    // ── the climb ───────────────────────────────────────────────────────
    let sinceProgress = 0;
    while (life.turns < TURN_BUDGET && life.simulatedYears < YEAR_BUDGET) {
        s = (await api.state()).cultivator;
        if (!s.alive) break;

        // Earning and being treated are both short skips: real days, real
        // encounters, and either can end the life. Re-read the sheet before
        // spending a turn on a cultivator who is no longer breathing, or the
        // next call answers 409 and the death is attributed to the wrong verb.
        // What a member does that a rogue cannot. Every other stretch, so the
        // house is part of the life rather than a row written once at 18.
        if (policy.sect && life.joinedSect && life.seclusions % 2 === 1) {
            const stipend = await say('I collect my stipend');
            if ((stipend.toolCalls ?? []).some(c => c.name === 'sect_manage.stipend' && c.ok)) life.stipendsDrawn++;
            // The board is a READ - "I look for sect work" returns
            // `engine.readState` and takes nothing on. A commission has to be
            // named, and the sentence has to carry a duty noun or `parseIntent`
            // sends it to the INTERACT table, which goes looking for a person
            // with that name. Counting the read as a board visit reported
            // "board visits answered: 0" while the board was working fine.
            const board = await say('I look for sect work');
            const commission = commissionsOn(board.narration)[0];
            if (commission) {
                const took = await say(`I take the commission ${commission.name}`);
                if ((took.toolCalls ?? []).some(c => c.name === 'encounters.acceptDuty' && c.ok)) {
                    life.dutiesTaken++;
                    life.contributionEarned += commission.contribution;
                }
            }
            const up = await say('I ask for a promotion');
            if ((up.toolCalls ?? []).some(c => c.name === 'sect_manage.promote' && c.ok)) life.promotions++;
            if (!(await api.state()).cultivator.alive) break;
        }

        if (policy.money && s.spiritStones < POOR_BELOW) await earn(say, life);
        if (policy.treat) {
            const st = await api.state();
            if (!st.cultivator.alive) break;
            if (st.derived.untreatedInjuries > 0) { await say('I look for a healer'); life.treatments++; }
        }
        // The sheet as it stands the instant before the door shuts. Everything
        // the seclusion did is read as the difference against this, because the
        // richer of the two seclusion endpoints does not return deltas.
        const pre = await api.state();
        if (!pre.cultivator.alive) break;
        s = pre.cultivator;
        const prevRun = pre.run;

        // THE COUNTERFACTUAL, and nothing else in this loop writes to the row.
        // See the `mended` policy for why it exists and why its numbers stay in
        // their own section.
        if (policy.mend && mender) {
            mender(s.id);
            s = (await api.state()).cultivator;
        }

        // ── THE SECLUSION GOES THROUGH `act`, NOT `/api/cultivate` ──────
        //
        // They run the same routine - both land in `GameService.runSeclusion` -
        // but they return different things, and the difference is the entire
        // encounter layer.
        //
        //   Execution.events = [...skip.events, ...enc2.events]
        //   ActResult        carries `events`, so a typed seclusion returns both
        //   CultivateResult  carries `timeSkip` only, so a CLICKED seclusion
        //                    returns `skip.events` and nothing from
        //                    `recordEncounters`
        //
        // A driver on `/api/cultivate` therefore sees `simulateTimeSkip`'s own
        // internal random events and none of the encounter layer's - no
        // summons, no arrival, no contact. This harness was on that endpoint
        // and reported "summonses the house sent, across every life: 0" over
        // two hundred lives, which was a statement about the endpoint rather
        // than about the houses: `summonsPool` returns one to four candidates
        // at every rung a Dew Servant of the Azure Dew Sect ever stands on.
        //
        // The deltas `timeSkip` was being read for are all recoverable from the
        // two sheets, so nothing is lost by taking the richer channel.
        const before = { days: prevRun.elapsedDays, progress: s.cultivationProgress };
        life.turns++;
        const c = await say(`I cultivate for ${Math.round(CHUNK_DAYS / 365)} years`);
        const afterState = await api.state();
        const ts = {
            events: c.events ?? [],
            simulatedDays: Math.max(0, afterState.run.elapsedDays - before.days),
            deltas: {
                cultivationProgress: afterState.cultivator.cultivationProgress - before.progress,
                hp: afterState.cultivator.hp - s.hp,
                injuriesGained: Math.max(0, (afterState.cultivator.injuries ?? []).length - (s.injuries ?? []).length)
            },
            died: !afterState.cultivator.alive,
            deathCause: afterState.cultivator.deathCause
        };
        ts.interrupted = ts.simulatedDays < CHUNK_DAYS - 1;
        ts.interruptReason = ts.died ? `death:${ts.deathCause}` : ts.interrupted ? 'cut_short' : null;
        life.seclusions++;
        life.simulatedYears += ts.simulatedDays / 365;

        for (const e of ts.events ?? []) {
            bump(life.events, e.kind, e.occurrences ?? 1);
            if (e.kind === 'breakthrough_success' || e.kind === 'breakthrough_failure') {
                life.strikes.push(strikeFrom(e));
            }
            // A summons, detected on `dutyLine`'s own fixed clauses rather than
            // on the event kind. A duty is a READING of an ordinary encounter
            // row (duties.ts authors no catalog), so it arrives under whatever
            // kind that row carries - `sect_event` for a muster, but `bandits`
            // for a caravan under attack and `misfortune` for a plague. Keying
            // on the kind counts a fraction of them and reports "membership
            // does nothing" from a filter rather than from the game.
            if (/spirit stones on completion|has said where to be|has given this to them|is waiting on an answer/i
                .test(e.summary ?? '')) {
                life.dutiesOffered++;
            }
        }
        if (ts.interrupted) {
            life.interrupts++;
            bump(life.interruptReasons, ts.interruptReason ?? 'unknown');
        }

        if (ts.died) {
            life.deathScene = {
                cause: ts.deathCause,
                hpAtStart: s.hp,
                maxHp: s.maxHp,
                hpDelta: ts.deltas.hp,
                injuriesGained: ts.deltas.injuriesGained,
                untreatedGoingIn: (s.injuries ?? []).filter(i => !i.treated).length,
                days: ts.simulatedDays,
                events: (ts.events ?? []).map(e => `${e.kind}: ${String(e.summary ?? '').slice(0, 110)}`)
            };
        }

        // THE HARD CEILINGS, observed rather than inferred - and DISTINGUISHED
        // from being robbed, which is a different thing that looks identical in
        // the delta.
        //
        // A rate of zero is a multiplier of zero somewhere in
        // `computeCultivationRate`, and only two factors there can produce one:
        // `ground_ceiling` and `technique_ceiling`. A qi deviation, by
        // contrast, DESTROYS banked progress - "Qi deviation: a serious
        // meridian injury, 14 qi-units of cultivation destroyed" - so a stretch
        // that accrued perfectly well and then lost more than it gained comes
        // back with a negative delta and no ceiling anywhere near it.
        //
        // Testing `<= 0` conflates the two. It reported the manual ceiling
        // biting at rungs 2 to 5, where no manual in the catalog caps and the
        // barren-ground ceiling does not start until 12, off 300 lives - which
        // is a harness artefact wearing a finding's clothes.
        // Two things other than a ceiling produce a non-positive delta, and
        // both have to be excluded or the metric reports rungs where no
        // ceiling exists:
        //   a DEVIATION destroys banked progress, so a stretch that accrued
        //     perfectly well comes back negative;
        //   a SUCCESSFUL STRIKE consumes `progressRequired`, so a stretch that
        //     accrued exactly one rung's worth comes back at or near zero.
        // The first was reporting the manual ceiling at rungs 2 to 5 across
        // 300 lives; the second left exactly one life at rung 2 in the run
        // after that, which is how it was found.
        const spent = (ts.events ?? []).some(
            e => e.kind === 'qi_deviation' || e.kind === 'breakthrough_success'
        );
        const stalledHard = ts.simulatedDays >= 30 && ts.deltas.cultivationProgress === 0 && !spent;
        if (ts.deltas.cultivationProgress < 0) {
            life.progressDestroyedStretches++;
            life.progressDestroyed += -ts.deltas.cultivationProgress;
        }
        if (stalledHard) {
            life.zeroRateSeclusions++;
            life.zeroRateDays += ts.simulatedDays;
            if (life.cappedAtOrdinal === null) life.cappedAtOrdinal = (await api.state()).cultivator.realmOrdinal;
            if (policy.rebook) {
                const learned = await learnWhatIsOffered(say, life);
                if (learned > 0) life.capLifted = true;
            }
        }
        // The stop condition stays on "nothing is moving" in the broad sense:
        // a life losing progress to deviation as fast as it gains it is also
        // going nowhere, and should not spend the whole turn budget proving it.
        sinceProgress = ts.deltas.cultivationProgress > 0 ? 0 : sinceProgress + 1;

        s = (await api.state()).cultivator;
        if (!s.alive) break;

        // Seclusion runs `autoBreakthrough`, so an explicit strike is only
        // needed when the bar filled and the door opened at the same moment.
        const st = await api.state();
        if (st.derived.breakthroughReady) {
            life.turns++;
            const b = await api.breakthrough();
            if (b.status === 200) {
                const res = b.body.result;
                life.strikes.push({
                    ok: !!res?.success,
                    fromOrdinal: typeof res?.fromOrdinal === 'number' ? res.fromOrdinal : null,
                    odds: typeof res?.finalChance === 'number' ? res.finalChance * 100 : null,
                    summary: 'explicit strike'
                });
            } else {
                bump(life.refusals, `breakthrough_${b.status}`);
            }
        }

        // Nothing is moving and nothing will. Stop spending turns on it; the
        // life is recorded as stalled, which is a finding about the road.
        if (sinceProgress >= 6) break;
    }

    // ── the ledger ──────────────────────────────────────────────────────
    const end = await api.state();
    s = end.cultivator;
    life.finalOrdinal = s.realmOrdinal;
    life.peakOrdinal = end.run?.peakOrdinal ?? s.realmOrdinal;
    life.age = s.age;
    life.alive = s.alive;
    life.endedPurse = s.spiritStones;
    life.manualsHeld = (s.knownTechniques ?? []).length;
    life.insightCount = (s.insights ?? []).length;
    life.roadsWalked = new Set((s.insights ?? []).filter(i => i.domain !== 'element').map(i => i.domain)).size;
    life.sectRank = s.sectRank ?? null;
    life.guided = !!s.sectId;
    life.endedAtOrdinal = s.realmOrdinal;
    life.endedOnBoundary = isRealmBoundary(s.realmOrdinal) || isRealmBoundary(s.realmOrdinal + 1);
    life.ending = !s.alive
        ? s.deathCause
        : life.turns >= TURN_BUDGET || life.simulatedYears >= YEAR_BUDGET
            ? 'budget_exhausted'
            : 'stalled';

    return { life };
}

/**
 * Learn everything currently on offer that SUITS the root.
 *
 * `techniquesOffered` matches only the first block of the listing - the arts
 * printed with a grade. The second block, printed as "these, which fight the
 * root rather than run with it ... Learning one can tear the meridians on the
 * spot", is deliberately not taken: an informed player who has been told that
 * in those words does not take one, and a driver that ignores the warning is
 * measuring its own recklessness rather than the game's.
 *
 * THE PHRASING IS A WORKAROUND, not a preference. `parseIntent`'s learn branch
 * requires a class noun in the sentence, so "I learn the <name>" resolves to
 * `unclear` for 92 of the 103 arts in the catalog - every one whose own name
 * does not happen to contain the word Manual, Art, Scripture or Canon. See the
 * report for the defect; the suffix is here so the harness can measure the
 * technique layer at all.
 */
async function learnWhatIsOffered(say, life) {
    const listed = await say('what techniques can I learn');
    const offered = techniquesOffered(listed.narration);
    let taken = 0;
    for (const t of offered.slice(0, 4)) {
        const r = await say(`I study the ${t.name} technique`);
        if ((r.toolCalls ?? []).some(c => c.name === 'technique_manage.learn' && c.ok)) {
            taken++;
            life.manualsLearned++;
        }
    }
    return taken;
}

/** Take the best-paying job on the board for a year. */
async function earn(say, life) {
    const board = await say('I work for a year');
    const jobs = jobsOffered(board.narration);
    if (jobs.length === 0) return;
    const best = jobs.reduce((a, b) => (b.months > a.months ? b : a));
    await say(`I work as a ${best.name} for a year`);
    life.workedYears++;
}

// ─────────────────────────────────────────────────────────────────────────
// THE RUN
// ─────────────────────────────────────────────────────────────────────────

/**
 * The one write the `mended` counterfactual makes, and the only statement in
 * this file that touches a row.
 *
 * Opened lazily, so a run whose arms do not include `mended` never loads
 * better-sqlite3 and never opens the file the server is using.
 */
function menderFor(dbPath) {
    if (!ARMS.includes('mended')) return null;
    const require = createRequire(join(repo, 'package.json'));
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);
    const stmt = db.prepare('update cultivators set hp = max_hp where id = ? and alive = 1');
    return id => { try { stmt.run(id); } catch { /* the row may have just died */ } };
}

async function worker(index, count, results) {
    const port = BASE_PORT + index;
    const dbPath = join(WORKDIR, `road-${index}.db`);
    const child = startServer(port, dbPath);
    let mender = null;
    try {
        await waitForHealth(port);
        mender = menderFor(dbPath);
        for (let i = 0; i < count; i++) {
            const arm = ARMS[(index * count + i) % ARMS.length];
            const out = await liveOne(api(port), arm, `Seeker ${index}-${i}`, mender);
            if (out.blocked) {
                results.blocked.push({ worker: index, life: i, arm, why: out.blocked });
                // A blocked life means the DB still holds a live run. Nothing
                // this worker does afterwards is measuring a fresh life, so it
                // stops rather than reporting the same body again.
                break;
            }
            results.lives.push(out.life);
            process.stderr.write(
                `[w${index}] ${String(i + 1).padStart(3)}/${count} ${arm.padEnd(5)} `
                + `ord ${String(out.life.finalOrdinal).padStart(2)} age ${String(Math.round(out.life.age)).padStart(4)} `
                + `${out.life.ending}\n`
            );
        }
    } finally {
        child.kill();
    }
}

const apiCache = new Map();
function api(port) {
    if (!apiCache.has(port)) apiCache.set(port, clientFor(port));
    return apiCache.get(port);
}

// ─────────────────────────────────────────────────────────────────────────
// THE REPORT
// ─────────────────────────────────────────────────────────────────────────

const pct = (n, d) => (d === 0 ? '  -  ' : `${((100 * n) / d).toFixed(1)}%`);
const mean = xs => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const median = xs => {
    if (xs.length === 0) return 0;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
};

function tally(lives, key) {
    const m = new Map();
    for (const l of lives) m.set(l[key], (m.get(l[key]) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
}

function report(results) {
    // The counterfactual arm is held out of every figure below. It is a
    // measurement of a game that does not exist, and pooling it would put a
    // number in this report that no player could ever produce.
    const lives = results.lives.filter(l => l.arm !== 'mended');
    const counterfactual = results.lives.filter(l => l.arm === 'mended');
    const realArms = ARMS.filter(a => a !== 'mended');
    const deaths = lives.filter(l => !l.alive);
    const out = [];
    const say = line => out.push(line);

    say('');
    say('══════════════════════════════════════════════════════════════════');
    say(`THE SHAPE OF THE ROAD - ${lives.length} lives, ${deaths.length} of them ended by the engine`);
    say(`ladder: 0..${MAX_ORDINAL}   the crossing under test: 44 (${rankName(44)})`);
    say('══════════════════════════════════════════════════════════════════');

    // ── 1. where lives end ──────────────────────────────────────────────
    say('');
    say('── WHERE LIVES END ──────────────────────────────────────────────');
    say('');
    say('rung  rank                                lives  boundary  causes');
    const byOrdinal = new Map();
    for (const l of lives) {
        if (!byOrdinal.has(l.endedAtOrdinal)) byOrdinal.set(l.endedAtOrdinal, []);
        byOrdinal.get(l.endedAtOrdinal).push(l);
    }
    for (const [ord, group] of [...byOrdinal].sort((a, b) => a[0] - b[0])) {
        const causes = tally(group, 'ending').map(([c, n]) => `${c} x${n}`).join(', ');
        say(`${String(ord).padStart(4)}  ${rankName(ord).padEnd(34)} ${String(group.length).padStart(5)}`
            + `  ${isRealmBoundary(ord) ? '   yes  ' : '        '}  ${causes}`);
    }

    say('');
    say('── HOW LIVES END ────────────────────────────────────────────────');
    say('');
    for (const [cause, n] of tally(lives, 'ending')) {
        say(`  ${String(cause).padEnd(24)} ${String(n).padStart(4)}  ${pct(n, lives.length)}`);
    }
    const onBoundary = deaths.filter(l => isRealmBoundary(l.endedAtOrdinal)).length;
    say('');
    say(`  deaths standing on a realm boundary: ${onBoundary} of ${deaths.length}  (${pct(onBoundary, deaths.length)})`);
    say('  The ladder legend calls these the rungs that kill, so clustering is');
    say('  intended. Total domination by them is not - a road where every death');
    say('  is the same event is one event, not a road.');

    // ── 1b. what the death actually was ─────────────────────────────────
    //
    // A cause label is not a cause. `combat_defeat` means hp reached zero, and
    // the interesting question is what took it there and whether the player had
    // a hand on it at any point.
    say('');
    say('── WHAT THE DEATH ACTUALLY WAS ──────────────────────────────────');
    say('');
    const scened = deaths.filter(l => l.deathScene);
    say(`  deaths with the engine's own account of the fatal stretch: ${scened.length} of ${deaths.length}`);
    for (const [cause] of tally(scened, 'ending')) {
        const g = scened.filter(l => l.ending === cause);
        const kinds = new Map();
        for (const l of g) {
            for (const line of l.deathScene.events) {
                const k = line.split(':')[0];
                kinds.set(k, (kinds.get(k) ?? 0) + 1);
            }
        }
        say('');
        say(`  ${cause}  (${g.length})`);
        say(`    went in at ${mean(g.map(l => (100 * l.deathScene.hpAtStart) / Math.max(1, l.deathScene.maxHp))).toFixed(0)}% hp, `
            + `with ${mean(g.map(l => l.deathScene.untreatedGoingIn)).toFixed(2)} untreated wounds, `
            + `and lived ${mean(g.map(l => l.deathScene.days)).toFixed(0)} days of the stretch`);
        say(`    what else was in that stretch: `
            + [...kinds].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} x${n}`).join(', '));
        const sample = g[0].deathScene.events.slice(-3);
        for (const line of sample) say(`      | ${line}`);
    }

    // ── 2. decision versus dice ─────────────────────────────────────────
    say('');
    say('── DECISION VERSUS DICE ─────────────────────────────────────────');
    say('');
    say('The arms play the same engine. Any difference between them is what the');
    say("player's decisions are worth; any similarity is the dice.");
    say('');
    say('arm     lives  reached  median  best  mean yrs  deaths  ending');
    say('               ordinal  ord     ord   lived');
    for (const arm of realArms) {
        const a = lives.filter(l => l.arm === arm);
        if (a.length === 0) continue;
        const ords = a.map(l => l.peakOrdinal);
        const top = tally(a, 'ending')[0];
        say(`${arm.padEnd(7)} ${String(a.length).padStart(5)}  `
            + `${mean(ords).toFixed(1).padStart(7)}  ${String(median(ords)).padStart(6)}  `
            + `${String(Math.max(...ords)).padStart(4)}  ${mean(a.map(l => l.simulatedYears)).toFixed(0).padStart(8)}  `
            + `${String(a.filter(l => !l.alive).length).padStart(6)}  ${top ? `${top[0]} x${top[1]}` : '-'}`);
    }

    const strikes = lives.flatMap(l => l.strikes);
    const withOdds = strikes.filter(s => typeof s.odds === 'number' && Number.isFinite(s.odds));
    say('');
    say(`  barrier strikes resolved: ${strikes.length}  (${strikes.filter(s => s.ok).length} succeeded, `
        + `${strikes.filter(s => !s.ok).length} failed)`);
    if (withOdds.length > 0) {
        const buckets = [[0, 25], [25, 50], [50, 75], [75, 90], [90, 101]];
        say('  the odds the engine was rolling against, when it said:');
        for (const [lo, hi] of buckets) {
            const b = withOdds.filter(s => s.odds >= lo && s.odds < hi);
            if (b.length === 0) continue;
            say(`    ${String(lo).padStart(3)}-${String(hi - 1).padEnd(3)}%  ${String(b.length).padStart(5)} strikes, `
                + `${pct(b.filter(s => s.ok).length, b.length)} succeeded`);
        }
        say(`  mean odds faced: ${mean(withOdds.map(s => s.odds)).toFixed(1)}%`);
    }

    // Per rung: what the barrier costs where it is actually being struck. A
    // rung where every attempt succeeds is not a wall; a rung where the odds
    // are the same as its neighbours is not a boundary in play, whatever the
    // legend says.
    say('');
    say('  the barrier, rung by rung   (* = realm boundary)');
    say('    rung   strikes  succeeded  mean odds  killed  rank');
    const byRung = new Map();
    for (const s of strikes) {
        if (s.fromOrdinal === null) continue;
        if (!byRung.has(s.fromOrdinal)) byRung.set(s.fromOrdinal, []);
        byRung.get(s.fromOrdinal).push(s);
    }
    const killedAt = new Map();
    for (const l of deaths) {
        if (l.ending !== 'failed_breakthrough' && l.ending !== 'heavenly_tribulation') continue;
        killedAt.set(l.endedAtOrdinal, (killedAt.get(l.endedAtOrdinal) ?? 0) + 1);
    }
    for (const [ord, group] of [...byRung].sort((a, b) => a[0] - b[0])) {
        const odds = group.map(s => s.odds).filter(o => typeof o === 'number');
        say(`    ${String(ord).padStart(4)}${isRealmBoundary(ord) ? '*' : ' '}  ${String(group.length).padStart(7)}  `
            + `${pct(group.filter(s => s.ok).length, group.length).padStart(9)}  `
            + `${(odds.length ? mean(odds).toFixed(1) + '%' : '-').padStart(9)}  `
            + `${String(killedAt.get(ord) ?? 0).padStart(6)}  ${rankName(ord)}`);
    }

    // ── 3. do the gates bite ────────────────────────────────────────────
    say('');
    say('── DO THE GATES BITE ────────────────────────────────────────────');
    say('');
    const capped = lives.filter(l => l.zeroRateSeclusions > 0);
    say(`  THE MANUAL CEILING (hard: rate x0, and no deviation in the stretch)`);
    say(`    lives stopped dead by a rate of zero: ${capped.length} of ${lives.length}`
        + `  (${pct(capped.length, lives.length)})`);
    if (capped.length > 0) {
        say(`    they stopped at rung: ${tally(capped, 'cappedAtOrdinal').map(([o, n]) => `${o}x${n}`).join(' ')}`);
        say(`    lifted it by finding another book: ${capped.filter(l => l.capLifted).length}`);
        say(`    years burned at zero rate: ${(capped.reduce((a, l) => a + l.zeroRateDays, 0) / 365).toFixed(0)}`);
    }
    say('');
    const robbed = lives.filter(l => l.progressDestroyedStretches > 0);
    say(`  BEING ROBBED, which is not a ceiling and reads identically in the delta`);
    say(`    lives that lost banked qi to a deviation: ${robbed.length} of ${lives.length}  (${pct(robbed.length, lives.length)})`);
    say(`    stretches that ended with less than they started: ${lives.reduce((a, l) => a + l.progressDestroyedStretches, 0)}`);
    say(`    qi-units destroyed across every life: ${Math.round(lives.reduce((a, l) => a + l.progressDestroyed, 0))}`);
    say('');
    say(`  THE DAO GATE`);
    say(`    DAO_GATE_FROM_ORDINAL = ${DAO_GATE_FROM_ORDINAL}, MAX_ORDINAL = ${MAX_ORDINAL}`);
    say(`    -> inert by construction: every rung on the ladder is below the switch.`);
    say('    What it WOULD ask, against what lives actually held when they got there:');
    say('');
    say('    rung  curve asks  lives reaching it  median roads held  would pass');
    // The rungs the curve actually charges at, asked of the curve rather than
    // guessed. Hard-coding a boundary list here is how a table ends up printing
    // "asks 0" at every row and reading as a gate that does nothing.
    const asking = [];
    for (let ord = 1; ord <= MAX_ORDINAL; ord++) if (daoRequirementCurve(ord) > 0) asking.push(ord);
    for (const ord of asking) {
        const need = daoRequirementCurve(ord);
        const reached = lives.filter(l => l.peakOrdinal >= ord);
        if (reached.length === 0) {
            say(`    ${String(ord).padStart(4)}  ${String(need).padStart(10)}  ${String(0).padStart(17)}  ${'-'.padStart(17)}  ${'-'.padStart(10)}`);
            continue;
        }
        const roads = reached.map(l => l.roadsWalked);
        const pass = reached.filter(l => l.roadsWalked >= need).length;
        say(`    ${String(ord).padStart(4)}  ${String(need).padStart(10)}  ${String(reached.length).padStart(17)}  `
            + `${String(median(roads)).padStart(17)}  ${pct(pass, reached.length).padStart(10)}`);
    }
    say('');
    say(`  UNDERSTANDING AT ALL`);
    const anyInsight = lives.filter(l => l.insightCount > 0);
    say(`    lives that ever comprehended anything: ${anyInsight.length} of ${lives.length}  (${pct(anyInsight.length, lives.length)})`);
    say(`    median insights held at the end: ${median(lives.map(l => l.insightCount))}`);
    say(`    median roads besides their own: ${median(lives.map(l => l.roadsWalked))}`);

    // ── 4. does membership matter ───────────────────────────────────────
    say('');
    say('── DOES MEMBERSHIP MATTER ───────────────────────────────────────');
    say('');
    const inHouse = lives.filter(l => l.joinedSect);
    const outside = lives.filter(l => l.arm !== 'drift' && !l.joinedSect);
    say(`  lives that got into a house: ${inHouse.length}`);
    say(`  informed lives that did not: ${outside.length}`);
    if (inHouse.length > 0 && outside.length > 0) {
        const row = (label, xs) => say(
            `    ${label.padEnd(12)} peak ord ${mean(xs.map(l => l.peakOrdinal)).toFixed(2).padStart(6)}  `
            + `years ${mean(xs.map(l => l.simulatedYears)).toFixed(0).padStart(5)}  `
            + `insights ${mean(xs.map(l => l.insightCount)).toFixed(2).padStart(5)}  `
            + `duties ${mean(xs.map(l => l.dutiesOffered)).toFixed(2).padStart(5)}  `
            + `manuals ${mean(xs.map(l => l.manualsHeld)).toFixed(2).padStart(5)}`
        );
        row('in a house', inHouse);
        row('outside', outside);
    }
    say('');
    say(`  sect ranks reached: ${tally(inHouse, 'sectRank').map(([r, n]) => `${r} x${n}`).join(', ') || 'none'}`);
    say(`  summonses the house sent, across every life: ${lives.reduce((a, l) => a + l.dutiesOffered, 0)}`);
    say(`  stipends drawn: ${lives.reduce((a, l) => a + l.stipendsDrawn, 0)}   `
        + `commissions taken off the board: ${lives.reduce((a, l) => a + l.dutiesTaken, 0)}   `
        + `contribution earned: ${lives.reduce((a, l) => a + l.contributionEarned, 0)}   `
        + `promotions granted: ${lives.reduce((a, l) => a + l.promotions, 0)}`);

    // ── 5. does anything happen ─────────────────────────────────────────
    say('');
    say('── DOES ANYTHING HAPPEN ─────────────────────────────────────────');
    say('');
    const years = lives.reduce((a, l) => a + l.simulatedYears, 0);
    const kinds = new Map();
    for (const l of lives) for (const [k, n] of Object.entries(l.events)) kinds.set(k, (kinds.get(k) ?? 0) + n);
    say(`  simulated years lived: ${years.toFixed(0)}   seclusions entered: ${lives.reduce((a, l) => a + l.seclusions, 0)}`);
    say('');
    say('  event kind              total   per year');
    for (const [k, n] of [...kinds].sort((a, b) => b[1] - a[1])) {
        say(`  ${k.padEnd(24)} ${String(n).padStart(5)}   ${(n / Math.max(1, years)).toFixed(3)}`);
    }
    const secl = lives.reduce((a, l) => a + l.seclusions, 0);
    const intr = lives.reduce((a, l) => a + l.interrupts, 0);
    say('');
    say(`  seclusions cut short of the ${Math.round(CHUNK_DAYS / 365)} years asked for: `
        + `${intr} of ${secl}  (${pct(intr, secl)})`);
    say('  NOT directly comparable to the ~90% design figure for skip interruption.');
    say('  That figure counts `TimeSkipResult.interrupted`, and NO endpoint returns');
    say('  both it and the encounter events: `/api/act` carries the merged event');
    say('  stream and no `interruptReason`; `/api/cultivate` carries `interruptReason`');
    say('  and drops `recordEncounters` output. This line is the union - a stretch');
    say('  ends early either because the skip was interrupted or because');
    say('  `daysActuallySpent` truncated the window before the skip ever ran.');
    const reasons = new Map();
    for (const l of lives) for (const [k, n] of Object.entries(l.interruptReasons)) reasons.set(k, (reasons.get(k) ?? 0) + n);
    for (const [k, n] of [...reasons].sort((a, b) => b[1] - a[1])) say(`    ${k.padEnd(24)} ${String(n).padStart(5)}`);

    // ── 6. what the player was refused ──────────────────────────────────
    say('');
    // ── 6b. the counterfactual ──────────────────────────────────────────
    if (counterfactual.length > 0) {
        const base = lives.filter(l => l.arm === 'sect');
        say('');
        say('── A GAME THAT DOES NOT EXIST: hp returned between stretches ────');
        say('');
        say('  NOT A MEASUREMENT OF THIS GAME. The `mended` arm plays the `sect`');
        say('  policy with hp written back to full between stretches - which no');
        say('  verb, pill, month of care or realm advance in the engine does. It');
        say('  is here to answer one question and only that one: is the missing');
        say('  restore path THE thing holding the ladder down, or merely one of');
        say('  several? Read the difference, never the absolute numbers.');
        say('');
        const row = (label, xs) => say(
            `    ${label.padEnd(20)} n=${String(xs.length).padStart(4)}  `
            + `peak ord ${mean(xs.map(l => l.peakOrdinal)).toFixed(2).padStart(6)}  `
            + `best ${String(Math.max(0, ...xs.map(l => l.peakOrdinal))).padStart(3)}  `
            + `years ${mean(xs.map(l => l.simulatedYears)).toFixed(0).padStart(5)}  `
            + `insights ${mean(xs.map(l => l.insightCount)).toFixed(2).padStart(5)}`
        );
        row('sect (real)', base);
        row('mended (fiction)', counterfactual);
        say('');
        say('    how the mended arm ended:');
        for (const [cause, n] of tally(counterfactual, 'ending')) {
            say(`      ${String(cause).padEnd(24)} ${String(n).padStart(4)}  ${pct(n, counterfactual.length)}`);
        }
        const cfBoundary = counterfactual.filter(l => !l.alive && isRealmBoundary(l.endedAtOrdinal)).length;
        const cfDeaths = counterfactual.filter(l => !l.alive).length;
        say(`      deaths on a realm boundary: ${cfBoundary} of ${cfDeaths}  (${pct(cfBoundary, cfDeaths)})`);
    }

    // ── 7. what the player was refused ──────────────────────────────────
    say('');
    say('── WHAT THE ENGINE REFUSED ──────────────────────────────────────');
    say('');
    const refusals = new Map();
    for (const l of lives) for (const [k, n] of Object.entries(l.refusals)) refusals.set(k, (refusals.get(k) ?? 0) + n);
    for (const [k, n] of [...refusals].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
        say(`  ${k.padEnd(34)} ${String(n).padStart(5)}`);
    }

    // ── harness honesty ─────────────────────────────────────────────────
    say('');
    say("── THE HARNESS'S OWN ACCOUNT ────────────────────────────────────");
    say('');
    say(`  lives blocked before they started: ${results.blocked.length}`);
    for (const b of results.blocked.slice(0, 10)) say(`    w${b.worker} life ${b.life} (${b.arm}): ${b.why}`);
    say(`  parse misses (an engine sentence this driver could not read):`);
    if (parseMisses.size === 0) say('    none');
    for (const [k, n] of parseMisses) say(`    ${k.padEnd(24)} ${String(n).padStart(5)}`);
    say('');
    say('  Not measured here, and say so rather than implying otherwise:');
    say("  - no life resolved a battle by the driver's choice; 'attack' is never issued.");
    say('  - no progress bar was written to. Every qi-unit was accrued.');
    say('  - a `budget_exhausted` or `stalled` ending is NOT a death and is not counted as one.');
    say('  - NO POLICY EVER TRAVELS. Every life is lived on the ground it was born on, so');
    say('    the ground bonus, crowding, the barren-ground ceiling and the `abroad`/`travel`');
    say('    encounter pools are all held fixed at whatever the birthplace supplies. A player');
    say('    who moves is playing a game this harness has not measured, and the encounter');
    say('    rates below are seclusion rates (exposure 0.035 / arrival 0.55), not the');
    say('    catalog-wide figure. Adding a travelling arm is the obvious next measurement.');
    say('  - the `sect` arm draws its stipend, takes commissions off the board and asks for');
    say('    promotion; it does not petition, posture, seal, offer, or enter an inheritance');
    say('    site. Those verbs exist and nothing here exercises them.');
    say('');

    return out.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────

async function main() {
    mkdirSync(WORKDIR, { recursive: true });
    const results = { lives: [], blocked: [] };
    const per = Math.ceil(LIVES / WORKERS);
    process.stderr.write(`[road] ${WORKERS} workers x ${per} lives, arms=${ARMS.join('/')}, db=${WORKDIR}\n`);
    await Promise.all(
        Array.from({ length: WORKERS }, (_, i) => worker(i, per, results))
    );
    const text = report(results);
    console.log(text);
    writeFileSync(OUT, JSON.stringify({
        generatedAt: new Date().toISOString(),
        arms: ARMS,
        lives: results.lives,
        blocked: results.blocked,
        parseMisses: [...parseMisses]
    }, null, 1));
    process.stderr.write(`\n[road] raw records: ${OUT}\n`);
    try { rmSync(WORKDIR, { recursive: true, force: true }); } catch { /* windows holds the handle */ }
}

await main();
