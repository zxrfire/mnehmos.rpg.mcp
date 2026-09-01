/**
 * Every position in the world, asked the things worth asking.
 *
 * The list is the designer's: join an ordinary sect, an apex, the Hollow
 * Court; start a war; wake a sealed ancestor legally and illegally; call down
 * an immortal ancestor. Asked by a rogue at the bottom, a rogue at the top, a
 * False Immortal, a True Immortal down for fifteen breaths, and every rung of a
 * house from servant to the seat.
 *
 * ── WHAT COUNTS AS PASSING ────────────────────────────────────────────────
 * Most of these should be refused. A refusal that names its reason is the win
 * condition, not the failure - it teaches the shape of the world:
 *
 *   as a rogue        "serves no house and has nobody to give an order to."
 *   as a servant      "does not do that here. It opens at Sect Warden, and not before."
 *   above the Lid     "Not from here."
 *   as the seat       it happens, and the outcome states what it cost.
 *
 * ── HOW THIS HARNESS HAS BEEN WRONG BEFORE, TWICE ─────────────────────────
 * Both failures were the scorer, and both produced tables that read as
 * findings. They are recorded here because the shape recurs.
 *
 * 1. A REGEX OVER PROSE CANNOT BE THE SCORER. The previous version tested the
 *    narration against /does not do that|not before|serves no house|opens at|
 *    admits from|takes no|there is no|has never/ and called anything else
 *    `done`. Above the Lid the engine answers "Not from here." - a correct,
 *    deliberate, structurally-grounded refusal that matches none of those
 *    alternatives - so every mortal-world verb at ordinals 45 and 46 scored as
 *    having HAPPENED. `I attack the Deep Survey` scored `done` while the engine
 *    was saying "No exchange was run." The refusal vocabulary of this codebase
 *    is not a closed set and never will be, because it is written per situation
 *    on purpose.
 *
 * 2. `done` MEANT "SAID SOMETHING", NOT "DID SOMETHING". Nothing checked
 *    whether the database moved, so an ask swallowed by `interact` and answered
 *    with scenery was indistinguishable from an ask that enrolled you in a
 *    sect.
 *
 * So this version scores on three mechanical facts and no prose at all:
 *
 *   - WHICH VERB RAN, off `toolCalls[].action`. A transgression that routes to
 *     `interact` was not refused, it was swallowed.
 *   - WHETHER THE DATABASE MOVED, off a whole-schema fingerprint taken either
 *     side of the turn. Not one field: every table, so a write to
 *     `sect_members` or `world_history` or a knowledge row counts.
 *   - WHAT THE ENGINE FILED, off `EngineFacts.structure` - the engine's own
 *     machine-readable channel, which reaches the play log as `role: engine`
 *     rows and carries `below_admission_ordinal`,
 *     `existence.canExistBeyondTheLid = true`, `theOnlyAxisLeft=true` and the
 *     rest. Where a verb has no state consequence, this is the evidence, and
 *     it is written by the code rather than composed for a reader.
 *
 * The narration is printed under `-v` so a human can check the machine, and it
 * is never scored.
 *
 * ── WHAT THIS MEASURES, AND WHAT IT DOES NOT ──────────────────────────────
 * `makeGame` with no provider installs the `DeterministicNarrator`, so phase 1
 * is the KEYWORD PARSER at the bottom of `web/actions.ts` and never a model.
 * That is the right default - it is reproducible, it costs nothing, and the
 * parser is the fallback every real session drops to when a model answers
 * badly - but it is a narrower reader than the router a player actually meets.
 * A cell that lands on `unclear` here is a sentence the parser cannot see; the
 * model may well route it. Where the two are known to disagree it is said in
 * place, and no `unclear` in this table should be reported as "the game has no
 * answer for this" without checking the same sentence against a real router.
 */

import { readdirSync, statSync } from 'node:fs';

import type Database from 'better-sqlite3';

import { makeGame } from '../tests/web/harness.js';
import { SECTS, DAO_HOUSES, getSect } from '../src/data/cultivation/sects.js';
import { COURTS, APEX_INSTITUTIONS } from '../src/data/cultivation/hierarchy.js';
import { NAMED_FIGURES } from '../src/data/cultivation/named-figures.js';
import { WANDERERS } from '../src/data/cultivation/wanderers.js';
import { rankName } from '../src/engine/cultivation/realms.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(112)); line('  ' + t); line('='.repeat(112)); };

/** `-v` prints, per cell, the routed verb, what was written, and what was said. */
const VERBOSE = process.argv.includes('-v');
/** `--asks=a,b` runs only the asks whose text contains one of these. */
const ONLY = (process.argv.find(a => a.startsWith('--asks='))?.slice(7) ?? '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

type Kind = 'works' | 'friction' | 'broken';
const notes: { kind: Kind; text: string }[] = [];
/** Verb -> the error it raised, so a broken build reports as a build problem. */
const threw = new Map<string, string>();
const note = (kind: Kind, text: string) => notes.push({ kind, text });

type Game = ReturnType<typeof makeGame>['game'];
const cur = (game: Game): any => { const s: any = (game as any).state(); return s.cultivator ?? s; };

/** The house used for every seated position, because its ladder is public. */
const HOUSE = getSect('sect-azure-dew-sect')!;

// ═════════════════════════════════════════════════════════════════════════
// DID ANYTHING ACTUALLY HAPPEN
// ═════════════════════════════════════════════════════════════════════════

/**
 * A fingerprint of the entire database, cheap enough to take twice a turn.
 *
 * Row counts for everything, plus the full contents of any table small enough
 * to dump - which covers the ones an ask would move in place rather than
 * append to: `cultivators`, `sect_members`, `sects`, `runs`. A world-enabled
 * game carries several hundred NPCs and a few thousand history rows, and those
 * are counted rather than dumped.
 *
 * The point of doing it over the whole schema rather than over the cultivator
 * is that most of these asks are supposed to move something ELSE. Declaring a
 * war, waking an ancestor, filing a requisition and taking a disciple all leave
 * the player's own row untouched if they work at all, and a harness that
 * watches only the player would report every one of them as a no-op.
 */
const DUMP_LIMIT = 64;

function fingerprint(db: Database.Database): Map<string, string> {
    const out = new Map<string, string>();
    const tables = db.prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
    ).all() as { name: string }[];

    for (const { name } of tables) {
        let count = 0;
        try {
            count = (db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get() as { n: number }).n;
        } catch { continue; }
        if (count > DUMP_LIMIT) { out.set(name, `n=${count}`); continue; }
        try {
            const rows = db.prepare(`SELECT * FROM "${name}"`).all();
            // `updated_at` moves on any touch and would report every read as a
            // write, which is the opposite of the mistake this is here to catch.
            const scrubbed = rows.map(r => {
                const copy: Record<string, unknown> = { ...(r as object) };
                delete copy.updated_at;
                delete copy.created_at;
                return copy;
            });
            out.set(name, `n=${count} ${JSON.stringify(scrubbed)}`);
        } catch {
            out.set(name, `n=${count}`);
        }
    }
    return out;
}

/** Every table whose contents differ, which is the proof that a verb did a thing. */
function tablesTouched(before: Map<string, string>, after: Map<string, string>): string[] {
    const moved: string[] = [];
    for (const [table, value] of after) {
        if (before.get(table) !== value) moved.push(table);
    }
    for (const table of before.keys()) if (!after.has(table)) moved.push(`-${table}`);
    // The turn counter advances on literally every action including refusals
    // and pure reads, so it proves nothing and drowns the signal.
    return moved.filter(t => t !== 'web_play_log' && t !== 'runs');
}

// ═════════════════════════════════════════════════════════════════════════
// THE POSITIONS
// ═════════════════════════════════════════════════════════════════════════

interface Position {
    label: string;
    ordinal: number;
    /** The house whose ladder this position sits on, or null for a rogue. */
    houseId?: string;
    /** Index into that house's own `ranks`, or null for somebody who serves nobody. */
    rank: number | null;
    /** Above the Lid changes what a person IS, not only how strong they are. */
    status: 'none' | 'false_immortal' | 'true_immortal';
    /** Standing is partly what you can pay. Default is comfortable; some are not. */
    stones?: number;
}

/**
 * Every position a player can occupy, built from the three things standing is
 * actually made of: where you stand on the ladder, what rung of whose house you
 * hold, and what you can pay.
 *
 * The first two are deliberately independent - the catalog is emphatic that a
 * stronger cultivator can be junior to a weaker one. The third was missing from
 * the first version of this table, which gave every position fifty thousand
 * spirit stones and therefore could not tell a gate that reads standing from a
 * gate that reads a purse.
 */
const POSITIONS: Position[] = [
    // Every rung of the ladder, unattached. A rogue is the honest baseline:
    // whatever a person can do with nothing but their own cultivation behind
    // them is the floor every seated position is measured against.
    ...[0, 13, 17, 21, 25, 29, 33, 37, 41].map(ordinal => ({
        label: `rogue ${ordinal}`, ordinal, rank: null, status: 'none' as const
    })),
    // The two rungs above the ladder. A False Immortal lives here permanently
    // and can be met; a True Immortal is in the middle of being expelled the
    // entire time they are below the Lid, so anything they try is a thing that
    // has to fit inside ten to fifteen breaths.
    { label: 'false immortal', ordinal: 45, rank: null, status: 'false_immortal' },
    { label: 'descended 46', ordinal: 46, rank: null, status: 'true_immortal' },
    // And every rung of a house, so rank is exercised against realm rather
    // than one masking the other.
    ...HOUSE.ranks.map((title, i) => ({
        label: title.toLowerCase(),
        ordinal: [4, 13, 17, 25, 33][i] ?? 33,
        rank: i,
        status: 'none' as const
    })),

    // ── ADDED, because the first table could not see these axes at all ─────

    /**
     * A False Immortal holding a seat.
     *
     * The catalog insists rank and realm are independent, and the first table
     * only ever tested that in one direction - a WEAK person holding a high
     * rung. The other direction is the one the world is full of: somebody the
     * institution cannot promote any further, cannot outrank, and cannot
     * refuse, sitting on its top rung. If standing is read at all, this is the
     * position where it should read loudest.
     */
    { label: 'seated false immortal', ordinal: 45, rank: 4, status: 'false_immortal' },
    /**
     * The strongest possible applicant to the top of the world.
     *
     * The Hollow Court admits from ordinal 29 and has NO ceiling, and
     * `handleJoin` files every new member at rank index 0. So the single most
     * powerful applicant in existence enrols as an Outer Disciple, on the same
     * rung as somebody sixteen rungs below them. This position exists to catch
     * that, and `theApexDoor` below asserts it directly.
     */
    { label: 'hollow court outer', ordinal: 41, houseId: 'sect-hollow-court', rank: 0, status: 'none' },
    { label: 'hollow court seat', ordinal: 41, houseId: 'sect-hollow-court', rank: 3, status: 'none' },
    /**
     * Strong and broke.
     *
     * Fifty thousand stones on every row meant a gate that reads a purse and a
     * gate that reads a rung were indistinguishable, and this world has both.
     * A Nascent Soul cultivator with four stones is an ordinary figure in it.
     */
    { label: 'penniless 21', ordinal: 21, rank: null, status: 'none', stones: 4 },
    /**
     * Rich and nobody.
     *
     * The mirror of the above, and the position a player actually arrives at
     * after one good inheritance trial: enough to buy anything on the board and
     * no standing whatsoever. Every "I buy my way in" sentence is asked from
     * here.
     */
    { label: 'rich nobody 4', ordinal: 4, rank: null, status: 'none', stones: 5_000_000 }
];

// ═════════════════════════════════════════════════════════════════════════
// THE ASKS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Everything a player might actually try, including the things they should not
 * be allowed to do.
 *
 * Grouped by what kind of thing it is, because the failure modes differ: a
 * transgression should be refused by somebody who could stop you, an ambition
 * should be refused by a standard you have not met, and a crime should be
 * possible and expensive. None of them should be met with silence, and none of
 * them should be met with a `done` that wrote nothing.
 */
const ASKS: [string, string][] = [
    // ── doors ────────────────────────────────────────────────────────────
    ['I apply to the Azure Dew Sect', 'an ordinary door'],
    ['I apply to the Azure Cloud Pavilion', 'an apex with a front gate'],
    ['I apply to the Hollow Court', 'the highest bar in the world'],
    ['I apply to the Deep Survey', 'an apex nobody can join at all'],
    ['I ask the House of Held Names to adopt me', 'the only way into a dao house'],

    // ── violence ─────────────────────────────────────────────────────────
    ['I kill the elder', 'murder, inside your own house'],
    ['I murder a disciple of the Nine Abyss Flame Sect', 'murder, outside it'],
    ['I attack the Nine Abyss Flame Sect', 'assaulting a whole house'],
    ['I assassinate the Third Lord', 'killing a named court officer'],
    ['I attack the Deep Survey', 'walking at an apex'],

    // ── theft ────────────────────────────────────────────────────────────
    ['I steal the sect treasury and leave in the night', 'the theft that already works'],
    ['I steal the Datum Lamp', 'taking the most valuable object in the world'],
    ['I rob the grave of Shen Guyi', 'grave robbing, which the catalog is built for'],
    ['I break the seal under the Kiln Court', 'stealing an ancestor that is not yours'],

    // ── asking for what cannot be bought ─────────────────────────────────
    ['I ask the Deep Survey for an Unearned Step', 'the pill that carries you a realm'],
    ['I ask the Azure Cloud Pavilion for a Second Dealing', 'the talisman that rewrites a root'],
    ['I file a Requisition Against Standing Stock', 'the form, by name'],
    ['I ask the Deep Survey for one of its pills', 'the same thing in plain words'],
    ['I ask the Hollow Court for a dao protector', 'asking the top of the world for a favour'],

    // ── the world's institutions ─────────────────────────────────────────
    ['I declare war on the Nine Abyss Flame Sect', 'starting a war'],
    ['I offer an alliance to the Frostmirror Court', 'the visible half of a conspiracy'],
    ['I demand tribute from the Azure Dew Sect', 'being owed'],
    ['I petition the Third Sill Court for a grant', 'the currency of the whole pyramid'],
    ['I defect to the Long Cut', 'what two courts have already done'],

    // ── the dead, and the ones above the Lid ─────────────────────────────
    ['I wake our sealed ancestor', 'the seal under your own mountain'],
    ['I make an offering to our ascended ancestor', 'calling on the one who crossed'],
    ['I claim descent from Ru Anjing', 'a false lineage, which the Ledger audits'],

    // ── legacy ───────────────────────────────────────────────────────────
    ['I take a disciple', 'passing anything on'],
    ['I teach the flying blade to a disciple', 'the same, named'],
    ['I carve my dao into the stone', 'what a False Immortal exists to do'],

    // ═══════════════════════════════════════════════════════════════════
    // ADDED. The original list is explicitly non-exhaustive, and everything
    // below is a sentence a player types because of where they are standing
    // rather than because it is on a list of ambitions.
    // ═══════════════════════════════════════════════════════════════════

    // ── the small ordinary asks, which are the control group ─────────────
    // Every ask above is enormous, so a table of refusals is the expected
    // result and proves nothing about whether standing is being read. These
    // are the ones that SHOULD change with a rung, and they are the sharpest
    // possible test of the headline: if even these answer identically to a
    // servant and to a Sect Warden, standing is not wired to anything.
    ['I ask my sect for my stipend', 'the wage the ladder literally publishes'],
    ['I ask the sect to teach me its manual', 'the ordinary in-house grant'],
    ['I ask the elder to take me on personally', 'the thing every disciple wants'],
    ['I leave the sect', 'the exit, which should differ from never having joined'],
    ['I ask the sect for a cave on the vein', 'a resource the house rations by rank'],

    // ── what a False Immortal does, since rank is closed to them ──────────
    // "A False Immortal cannot climb in rank and can still climb in dao" is the
    // load-bearing claim about the position. These are the sentences that
    // claim is supposed to make available, and they are asked from every height
    // so that the answer at 45 can be compared against the answer at 13.
    ['what is my dao', 'the only axis left, asked in words'],
    ['I sit with the thing I have never understood', 'working the axis rather than reading it'],
    ['I write down everything I know and leave it where it will be found',
        'the other way to spend an eternity'],
    ['I give my name to a disciple and make them my heir', 'succession, from the top'],

    // ── what fits in ten or fifteen breaths ──────────────────────────────
    // A descended True Immortal is being expelled for the whole time they are
    // below the Lid, so a verb that takes days is not a verb they have. Each of
    // these is a single act. If the answer to all four is the same sentence
    // about there being no people here, the position is a state and not a
    // playable one.
    ['I kill the Third Lord where he stands', 'one strike, and the whole reason to come down'],
    ['I say one sentence to my descendant', 'the other reason anyone comes down'],
    ['I take the Datum Lamp and go', 'the errand, done at speed'],
    ['I go back up before the Lid closes', 'leaving, which should be the cheap direction'],

    // ── standing as a purse rather than a rung ───────────────────────────
    ['I buy my way into the Azure Dew Sect with fifty thousand spirit stones',
        'whether money is a door'],
    ['I hire someone to kill the Third Lord', 'violence bought rather than done'],

    // ── being on the receiving end ───────────────────────────────────────
    // Every ask above is the player acting on the world. Nothing tested what
    // the world does back, and standing is at least half a question about who
    // can reach YOU.
    ['who would come after me if I did that', 'consequence, asked before the act'],
    ['what am I owed', 'the ledger read from the other side']
];

// ═════════════════════════════════════════════════════════════════════════
// SCORING
// ═════════════════════════════════════════════════════════════════════════

/**
 * Five outcomes, and three of them are different defects.
 *
 * THREW is the engine falling over, which is not evidence about the design -
 * conflating it with silence once produced a table of ninety silences from a
 * half-landed edit, every one of them false.
 *
 * SILENT is the game answering with nothing, which teaches a player it is small.
 *
 * WROTE is the ask happening. RULED is the ask not happening and the engine
 * filing a structured account of why, which is the win condition for most of
 * this table. SHRUG is the ask not happening, with no structured account
 * filed - the false positive the old scorer reported as `done`.
 */
type Verdict = 'WROTE' | 'RULED' | 'UNFOUND' | 'SHRUG' | 'SILENT' | 'THREW';

/**
 * The engine's own word for "I could not find the noun you named".
 *
 * This is a THIRD thing, and collapsing it into `refused` is how the previous
 * report came to say that attacking a sect and attacking an apex were "two
 * correct refusals". They are not refusals. `I attack the Deep Survey` files
 *
 *     Unresolved party "Deep Survey" for a confrontation. No exchange was run.
 *
 * at every position from ordinal 0 to a descended True Immortal. Nothing about
 * standing was consulted, because the ask never reached anything that could
 * consult it - the resolver takes a person and a faction is not one. A refusal
 * says you may not; this says the engine did not know what you meant. The
 * player sees the same shrug either way, which is precisely the problem.
 *
 * Matched on the STRUCTURED channel only. These are code-authored lines with a
 * fixed leading token, not narration, and the distinction is the whole reason
 * this harness reads `EngineFacts.structure` instead of prose.
 */
const UNRESOLVED = /^Unresolved (party|faction|sect|price|subject|name|technique|site)\b/;

/** Everything one cell of the matrix produced, in mechanical terms only. */
interface Cell {
    verdict: Verdict;
    /** Which member of the closed action set actually ran. */
    routed: string;
    /** Tables whose contents changed. Empty means nothing happened. */
    wrote: string[];
    /** `EngineFacts.structure`, the engine's own machine-readable account. */
    rulings: string[];
    /** Printed under -v, never scored. */
    said: string;
}

/**
 * Verbs that are the engine's way of saying "I did not understand you well
 * enough to have an opinion". A transgression that lands here was swallowed,
 * not refused, whatever the prose says.
 */
const GENERIC = new Set(['interact', 'investigate', 'look', 'assess', 'move', 'unclear']);

async function ask(game: Game, db: Database.Database, text: string): Promise<Cell> {
    const before = fingerprint(db);
    let said = '';
    let routed = '?';
    let rulings: string[] = [];
    let logBefore = 0;

    try {
        logBefore = ((game as any).state().log ?? []).length;
    } catch { /* a closed run has no log; the act below will say so */ }

    try {
        const r: any = await (game as any).act(text);
        said = String(r?.narration ?? '');
        const calls: any[] = r?.toolCalls ?? [];
        routed = String(
            calls.find(c => c.name !== 'narrator.plan' && c.name !== 'narrator.narrate'
                && c.name !== 'engine.structure')?.action
            ?? calls[0]?.action ?? '?'
        );
        // `EngineFacts.structure` reaches the play log as `role: engine` rows.
        // That is the channel the engine writes for machines - it carries
        // `below_admission_ordinal`, `existence.canExistBeyondTheLid = true`,
        // `theOnlyAxisLeft=true` - and it is the only thing here that decides a
        // verdict, because it is authored by the code rather than for a reader.
        const log: any[] = r?.state?.log ?? [];
        rulings = log.slice(logBefore).filter(e => e.role === 'engine').map(e => String(e.text));
    } catch (error) {
        const message = (error as Error).message;
        // A closed run throwing is a real answer about a dead cultivator.
        if (/is dead|run is closed/i.test(message)) {
            return { verdict: 'RULED', routed: 'run_closed', wrote: [], rulings: [message], said: message };
        }
        threw.set(text, message);
        return { verdict: 'THREW', routed: '-', wrote: [], rulings: [message], said: message };
    }

    const wrote = tablesTouched(before, fingerprint(db));

    if (said.trim().length === 0 || routed === 'unclear') {
        return { verdict: 'SILENT', routed, wrote, rulings, said };
    }
    if (wrote.length > 0) return { verdict: 'WROTE', routed, wrote, rulings, said };

    // Nothing moved. The question is whether the engine MEANT that.
    //
    // A deliberate refusal files a structured line - the admission ordinal it
    // failed, the predicate that put the cultivator above the Lid, the rank the
    // verb opens at. A sentence that fell through to `interact` and was
    // answered with scenery files a description of who is standing nearby. So
    // the discriminator is: did a specific verb run, and did it file anything?
    if (rulings.some(r => UNRESOLVED.test(r.trim()))) {
        return { verdict: 'UNFOUND', routed, wrote, rulings, said };
    }
    const ruled = rulings.length > 0 && !GENERIC.has(routed);
    return { verdict: ruled ? 'RULED' : 'SHRUG', routed, wrote, rulings, said };
}

// ═════════════════════════════════════════════════════════════════════════
// SEATING
// ═════════════════════════════════════════════════════════════════════════

/**
 * Put a run into one position and prove it took.
 *
 * The knowledge gate is the hazard here and it is silent when it fires: a
 * cultivator who has never heard of the Hollow Court gets "nobody by that
 * name", and a matrix that has not defeated the gate measures the gate at every
 * single cell instead of the height it thinks it is varying. Every sect in the
 * catalog is written in as a heard name before anything is asked, and
 * `seatedCorrectly` below checks the seat rather than assuming it.
 */
async function seat(position: Position): Promise<{ game: Game; db: Database.Database }> {
    const { game, db, repos } = makeGame({ seed: 'one-world', worldEnabled: true });
    await (game as any).newRun('Somebody');
    const me = cur(game);

    repos.cultivators.update(me.id, {
        spiritRoot: 'single_fire',
        // Legal sheet: `might` caps at 3 and `insight` at 4 in the schema, so a
        // 5/5/5/5 probe is not measuring this game.
        attributes: { might: 3, insight: 4, fortune: 3, charm: 3 },
        realmOrdinal: position.ordinal,
        immortalStatus: position.status,
        spiritStones: position.stones ?? 50_000
    });

    // ── DEFEAT THE KNOWLEDGE GATE, ALL OF IT ─────────────────────────────
    //
    // The gate answers before the height does, and its refusal is deliberately
    // shaped like every other refusal, so a matrix that has not defeated it
    // measures the gate at every cell and reports it as standing.
    //
    // Learning `SECTS` alone is not enough and the first version of this file
    // did exactly that. `factionMeant` resolves a name against THREE catalogs -
    // `SECTS`, `COURTS` and `APEX_INSTITUTIONS` - and `DAO_HOUSES` is a fourth,
    // all under the `sect` awareness kind. So `I ask the Deep Survey for an
    // Unearned Step` came back "Unresolved faction 'Deep Survey': no knowledge
    // record. 32 faction name(s) held by this cultivator" at every single
    // position, and read as a flat row about the immortal pills when it was a
    // flat row about a catalog the harness had not taught.
    //
    // People are a separate awareness kind and are learned too, or every ask
    // naming the Third Lord or Shen Guyi measures the same gate again.
    const learn = (kind: string, id: string, name: string) =>
        (game as any).knowledge.learnIfNew({
            holderId: me.id, kind, id, name,
            onDay: 0, sourceKind: 'told', sourceNote: 'a name said in a market town'
        });

    for (const s of SECTS) learn('sect', s.id, s.name);
    for (const c of COURTS) learn('sect', c.id, c.name);
    for (const a of APEX_INSTITUTIONS) learn('sect', a.id, a.name);
    for (const h of DAO_HOUSES) learn('sect', h.id, h.name);
    for (const f of NAMED_FIGURES) learn('cultivator', f.id, f.name);
    for (const w of WANDERERS) learn('cultivator', w.id, w.recordName);

    if (position.rank !== null) {
        const house = getSect(position.houseId ?? HOUSE.id)!;
        repos.sects.upsert(house as never);
        repos.sects.addMember(house.id, me.id, position.rank);
    }

    // ── PRIME THE WORLD, or every cell reads as a write ──
    //
    // `act()` lazily seeds the world on its first call, so the first thing
    // typed in a fresh game writes seventeen `world_*` tables no matter what it
    // was. The first version of this scorer took that as proof the ask had
    // happened, and reported `I apply to the Hollow Court` as WROTE at a rung
    // where the engine had just answered "Not a name you hold."
    //
    // A pure read pays that cost up front. Everything the real ask writes
    // afterwards is the real ask - including a genuine write to `world_factions`
    // or `world_chronicle`, which is exactly what declaring a war should do and
    // which blanket-excluding the world tables would have hidden.
    // Priming is repeated until the fingerprint stops moving, rather than done
    // once. Above the Lid the first `status` is answered by the transit check
    // before the world is loaded, so a single prime left the seeding to be paid
    // by the real ask - and `descended 46` was the ONLY position that scored
    // WROTE on "I steal the sect treasury", on the strength of seventeen
    // world_* tables appearing. It had not stolen anything. It had been the
    // first sentence in that world.
    for (let pass = 0; pass < 4; pass++) {
        const before = fingerprint(db);
        await (game as any).act(pass === 0 ? 'status' : 'I look around').catch(() => undefined);
        if (tablesTouched(before, fingerprint(db)).length === 0) break;
    }
    return { game, db };
}

/** The seat, read back out of the game rather than assumed. */
function seatedCorrectly(game: Game, position: Position): string | null {
    const s: any = (game as any).state();
    const c = s.cultivator;
    if (c.realmOrdinal !== position.ordinal) {
        return `realmOrdinal is ${c.realmOrdinal}, wanted ${position.ordinal}`;
    }
    if ((c.immortalStatus ?? 'none') !== position.status) {
        return `immortalStatus is ${c.immortalStatus}, wanted ${position.status}`;
    }
    if (position.rank !== null) {
        const house = getSect(position.houseId ?? HOUSE.id)!;
        if (c.sectId !== house.id) return `sectId is ${c.sectId}, wanted ${house.id}`;
        if (c.sectRank !== house.ranks[position.rank]) {
            return `sectRank is ${c.sectRank}, wanted ${house.ranks[position.rank]}`;
        }
    } else if (c.sectId) {
        return `sectId is ${c.sectId}, wanted none`;
    }
    return null;
}

// ═════════════════════════════════════════════════════════════════════════
// THE NAMED ASSERTIONS
// Three things observed in the live UI that a matrix of verdicts cannot
// express, because each is about the CONTENT of a write rather than whether
// there was one. Asserted directly, and each one prints the numbers.
// ═════════════════════════════════════════════════════════════════════════

async function theApexDoor(): Promise<void> {
    rule('A. THE HIGHEST BAR IN THE WORLD, AND NO CEILING ABOVE IT');

    const court = getSect('sect-hollow-court')!;
    line(`  ${court.name}: admits from ordinal ${court.admissionOrdinal} `
        + `(${rankName(court.admissionOrdinal)}), ranks ${court.ranks.join(' < ')}`);
    line();
    line(`  ${'applicant'.padEnd(28)}${'joined'.padEnd(10)}rank filed`);
    line('  ' + '-'.repeat(72));

    const applicants: Position[] = [
        { label: 'rogue 25 (below the bar)', ordinal: 25, rank: null, status: 'none' },
        { label: 'rogue 29 (exactly the bar)', ordinal: 29, rank: null, status: 'none' },
        { label: 'rogue 41 (top of the ladder)', ordinal: 41, rank: null, status: 'none' },
        { label: 'false immortal 45', ordinal: 45, rank: null, status: 'false_immortal' }
    ];

    const filed: string[] = [];
    for (const applicant of applicants) {
        const { game, db } = await seat(applicant);
        // Phrasing matters and is not a detail: the name parser takes the whole
        // trailing string, so "join the Hollow Court AS A DISCIPLE" is looked up
        // as a house called "Hollow Court as a disciple", is not found, and the
        // knowledge gate answers instead of the admission gate.
        const cell = await ask(game, db, 'I apply to the Hollow Court');
        const after: any = (game as any).state().cultivator;
        const rank = after.sectRank ?? '-';
        if (after.sectId === court.id) filed.push(String(rank));
        line(`  ${applicant.label.padEnd(28)}${(after.sectId === court.id ? 'yes' : 'no').padEnd(10)}`
            + `${rank}   [${cell.verdict} via ${cell.routed}]`);
        if (VERBOSE) for (const r of cell.rulings) line(`      ${r}`);
    }

    if (filed.length > 1 && new Set(filed).size === 1) {
        note('broken',
            `The Hollow Court files every admitted applicant at "${filed[0]}" - the bottom rung - `
            + `whether they stand at ordinal ${court.admissionOrdinal} or above the Lid at 45. `
            + `\`handleJoin\` calls addMember(sect, cultivator, 0) unconditionally, and `
            + `\`admissionOrdinal\` is a FLOOR with no ceiling anywhere beside it. The strongest `
            + 'applicant in existence enrols on the same rung as somebody sixteen rungs below them, '
            + 'which is the clearest single demonstration that the ladder is not read on entry.');
    } else if (filed.length > 1) {
        note('works', `Admission files applicants at different rungs: ${filed.join(', ')}.`);
    }
}

async function theSecondDoor(): Promise<void> {
    rule('B. WHAT HAPPENS TO THE FIRST HOUSE WHEN YOU JOIN A SECOND');

    const { game, db } = await seat({ label: 'x', ordinal: 33, rank: null, status: 'none' });
    const first = await ask(game, db, 'I apply to the Azure Dew Sect');
    const afterFirst: any = (game as any).state().cultivator;
    line(`  joined first : ${afterFirst.sectId} as ${afterFirst.sectRank}  [${first.verdict}]`);

    const second = await ask(game, db, 'I apply to the Nine Peaks Ascetic Order');
    const afterSecond: any = (game as any).state().cultivator;
    line(`  joined second: ${afterSecond.sectId} as ${afterSecond.sectRank}  [${second.verdict}]`);
    line(`  tables written by the second join: ${second.wrote.join(', ') || 'none'}`);
    for (const r of second.rulings) line(`      ${r}`);

    const rows = db.prepare('SELECT sect_id FROM sect_members WHERE cultivator_id = ?')
        .all(afterSecond.id) as { sect_id: string }[];
    line(`  sect_members rows now held: ${rows.length} (${rows.map(r => r.sect_id).join(', ') || 'none'})`);

    if (afterFirst.sectId && afterSecond.sectId && afterFirst.sectId !== afterSecond.sectId
        && rows.length === 1) {
        const announced = second.rulings.some(r => /defect|left|former|forfeit/i.test(r));
        note(announced ? 'friction' : 'broken',
            `Joining a second house DELETES the membership in the first. The \`sect_members\` row `
            + `for ${afterFirst.sectId} is gone and the cultivator now holds exactly one row. `
            + (announced
                ? 'The engine does file something about it, so the act is at least on the record.'
                : 'Nothing in the structured channel mentions the house that was left: no defection, '
                + 'no forfeited contribution, no grudge seeded. Leaving a sect is one of the most '
                + 'consequential things in this world and it is currently a side effect of an '
                + 'application form.'));
    }
}

async function theOnlyAxisLeft(): Promise<void> {
    rule('C. THE ONE AXIS A FALSE IMMORTAL HAS LEFT');

    line('  A False Immortal cannot climb in rank again. The claim is that dao is still open to');
    line('  them, so the question is whether the verb exists AND whether there is anything in it.');
    line();

    for (const position of [
        { label: 'rogue 13', ordinal: 13, rank: null, status: 'none' as const },
        { label: 'rogue 41', ordinal: 41, rank: null, status: 'none' as const },
        { label: 'false immortal 45', ordinal: 45, rank: null, status: 'false_immortal' as const }
    ]) {
        const { game, db } = await seat(position);
        const carve = await ask(game, db, 'I carve my dao into the stone');
        const recall = await ask(game, db, 'what is my dao');
        line(`  ${position.label.padEnd(20)}carve: ${carve.verdict}/${carve.routed}`.padEnd(56)
            + `recall: ${recall.verdict}/${recall.routed}`);
        for (const r of [...carve.rulings, ...recall.rulings]) line(`      ${r}`);

        if (position.status === 'false_immortal') {
            const axis = [...carve.rulings, ...recall.rulings]
                .find(r => /theOnlyAxisLeft/.test(r));
            if (axis) {
                note('works', `The dao axis is genuinely implemented above the Lid and the engine `
                    + `says so in its own structured channel: "${axis.slice(0, 140)}". A previous `
                    + 'run of this harness reported "I carve my dao into the stone" as SILENT at '
                    + 'every height; that was the prose scorer, and it was wrong.');
                const degrees = /totalDegrees=(\d+)/.exec(axis);
                if (degrees && degrees[1] === '0') {
                    note('friction',
                        'The axis is open and empty: totalDegrees=0 for a freshly-seated False '
                        + 'Immortal, so the one thing left to a person at the ceiling has nothing '
                        + 'in it until they have comprehended something. That is correct behaviour '
                        + 'and it means the position cannot be playtested by seating somebody at '
                        + '45 - insights have to be earned first, and no harness here does that.');
                }
            } else {
                note('broken', 'Nothing in the structured channel mentions the dao axis at ordinal 45.');
            }
        }
    }
}

// ═════════════════════════════════════════════════════════════════════════
// THE MATRIX
// ═════════════════════════════════════════════════════════════════════════

/**
 * Was the tree standing still while this ran?
 *
 * Several agents work this repo at once and the routing table is one of the
 * busiest files in it. A matrix measured across a landing edit is a mixture of
 * two builds: one run of this harness saw `I apply to the Azure Dew Sect` route
 * to `petition` and write nothing at all twelve heights, and four minutes later
 * saw the same sentence route to `sect` and enrol the cultivator every time.
 * Neither was a finding about the design.
 */
function treeStamp(): string {
    // The WHOLE of src, not the three files this harness leans on hardest.
    //
    // A first version watched only `src/web/`, and a run then came back with
    // forty-eight asks throwing and a stamp that had not moved - because the
    // half-landed edit was in `src/data/cultivation/mortal-world.ts`, several
    // imports away. A guard that watches the files you thought of is a guard
    // against the failure you already know about.
    const root = new URL('../src/', import.meta.url);
    const walk = (dir: URL): string[] => {
        const out: string[] = [];
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
            if (entry.isDirectory()) out.push(...walk(child));
            else if (entry.name.endsWith('.ts')) out.push(String(statSync(child).mtimeMs));
        }
        return out;
    };
    try { return walk(root).join(','); } catch { return 'unreadable'; }
}

async function theMatrix(): Promise<void> {
    rule('D. EVERY POSITION, EVERY ASK');

    line(`  the house: ${HOUSE.name} - ${HOUSE.ranks.join(' < ')}`);
    line(`  ${POSITIONS.length} positions x ${ASKS.length} asks`);
    line();
    line('  WROTE  = the database moved. The ask happened.');
    line('  RULED  = nothing moved, a specific verb ran, and the engine filed a structured reason.');
    line('  UNFOUND= the right verb ran and could not resolve the noun. NOT a refusal on standing.');
    line('  SHRUG  = nothing moved and no verb with an opinion ran. THE FALSE POSITIVE.');
    line('  SILENT = no narration, or routed to `unclear`.');
    line('  THREW  = a build problem. Not evidence about anything.');
    line();
    line('  Phase 1 here is the DETERMINISTIC KEYWORD PARSER, not a model. A SILENT cell is a');
    line('  sentence that parser cannot see, which is a narrower claim than "the game has no');
    line('  answer for this" - check it against a real router before reporting it as the latter.');
    line();
    line('  `answers` counts DISTINCT mechanical answers across the positions. 1 means a True');
    line('  Immortal, a Sect Warden and a sixteen-year-old at ordinal 0 got the same ruling.');
    line();

    const asks = ONLY.length === 0
        ? ASKS
        : ASKS.filter(([t]) => ONLY.some(o => t.toLowerCase().includes(o)));

    // Seat every position once and reuse nothing: an ask must not see the state
    // left by the ask before it, or the matrix measures its own row order.
    const shrugs: string[] = [];
    const silences: string[] = [];
    const standingBlind: string[] = [];
    const unfound = new Map<string, number>();
    const reportsButDoesNot: string[] = [];

    line('  ' + 'ask'.padEnd(48) + 'rulings'.padEnd(9) + 'effects'.padEnd(9)
        + 'verdicts across all positions');
    line('  ' + '-'.repeat(110));

    for (const [text] of asks) {
        const cells = new Map<string, Cell>();
        for (const position of POSITIONS) {
            const { game, db } = await seat(position);
            const wrong = seatedCorrectly(game, position);
            if (wrong) {
                note('broken', `The seat did not take for "${position.label}": ${wrong}. `
                    + 'The whole matrix is measuring the wrong people.');
                return;
            }
            const cell = await ask(game, db, text);
            cells.set(position.label, cell);
            firstPass.set(`${text} @@ ${position.label}`,
                `${cell.verdict}|${cell.routed}|${cell.wrote.join('+')}`);
            if (cell.verdict === 'SHRUG') shrugs.push(`"${text}" as ${position.label}`);
            if (cell.verdict === 'SILENT') silences.push(`"${text}" as ${position.label}`);
            if (cell.verdict === 'UNFOUND') {
                unfound.set(text, (unfound.get(text) ?? 0) + 1);
            }
        }

        // THE HEADLINE. An ask reads standing when the engine's own mechanical
        // account of it differs between two positions. Prose is not part of the
        // fingerprint - a narrator that varies its adjectives would otherwise
        // look like a game that varies its rulings.
        const fingerprints = new Set(
            [...cells.values()].map(c => `${c.verdict}|${c.routed}|${c.wrote.join('+')}|`
                + c.rulings.join(' ').replace(/\d+/g, '#'))
        );
        if (fingerprints.size === 1) standingBlind.push(text);

        // ── THE SHARPER QUESTION ─────────────────────────────────────────
        //
        // An ask can read standing perfectly, SAY so in the structured
        // channel, and still do the same nothing at every rung. `I ask the
        // Hollow Court for a dao protector` files nine different rulings -
        // "There is no rank on the letter", "Sent over Seat of The Hollow
        // Court (rank_index=3 of 4)" - and the answer to all nine is "It is
        // done. Nothing about it drew attention." with no byte written.
        //
        // Counting distinct RULINGS scores that as nine answers. Counting
        // distinct EFFECTS scores it as one, which is what a player
        // experiences. Both are printed because the gap between them is the
        // interesting number.
        const effects = new Set([...cells.values()].map(c => `${c.verdict}|${c.wrote.join('+')}`));
        // The test is "nothing was ever written", not "the verdicts matched".
        // An earlier version also required `effects.size === 1`, and the moment
        // the position above the Lid started answering differently - a correct
        // change - the check stopped firing on eight asks it had been right
        // about. What matters is that no rung, anywhere, made the act happen.
        if (fingerprints.size > 2 && [...cells.values()].every(c => c.wrote.length === 0)) {
            reportsButDoesNot.push(text);
        }

        const shape = new Map<Verdict, string[]>();
        for (const [label, cell] of cells) {
            shape.set(cell.verdict, [...(shape.get(cell.verdict) ?? []), label]);
        }
        const summary = [...shape.entries()]
            .map(([v, who]) => who.length === POSITIONS.length ? `${v} everywhere` : `${v}: ${who.join(', ')}`)
            .join('  |  ');
        line('  ' + text.slice(0, 46).padEnd(48)
            + String(fingerprints.size).padEnd(9)
            + String(effects.size).padEnd(9)
            + summary.slice(0, 92));

        if (VERBOSE) {
            for (const [label, cell] of cells) {
                line(`      ${label.padEnd(24)}${cell.verdict.padEnd(8)}${cell.routed.padEnd(16)}`
                    + `[${cell.wrote.join(',') || '-'}]  ${cell.said.replace(/\s+/g, ' ').slice(0, 90)}`);
                for (const r of cell.rulings.slice(0, 3)) line(`          ${r.slice(0, 130)}`);
            }
        }
    }

    // ── the report ──
    if (threw.size > 0) {
        line();
        line('  The engine raised an error on these, which is a build problem rather than a design');
        line('  one. Nothing about them is evidence until the tree is whole:');
        for (const [text, message] of threw) line(`    ${text}\n      ${message}`);
        note('broken', `${threw.size} ask(s) made the engine throw. Fix the tree before reading any row.`);
    }

    const total = asks.length * POSITIONS.length;

    // ── NOTHING BELOW THIS LINE IS EVIDENCE IF THE BUILD WAS BROKEN ──
    //
    // A run against a half-landed edit in a file three imports away threw on
    // all forty-eight asks and then reported "47 of 47 asks produce an
    // IDENTICAL mechanical answer at all 21 positions", which is true and
    // means nothing: they were identical because every one of them was the
    // same stack trace. That headline is exactly the finding this harness
    // exists to produce, so it is the one that must never be manufactured by
    // a broken tree.
    if (threw.size > 0) {
        note('broken', 'The verdict summary below is SUPPRESSED: asks threw, so the cells are not '
            + 'measurements. Nothing about standing can be concluded from this run.');
        return;
    }

    if (shrugs.length > 0) {
        note('broken',
            `${shrugs.length} of ${total} cells are SHRUGS: the game answered, no verb with an `
            + 'opinion ran, and not one byte of the database moved. A player cannot tell these from '
            + `a refusal. First few: ${shrugs.slice(0, 3).join('; ')}`);
    }
    if (silences.length > 0) {
        note('broken',
            `${silences.length} of ${total} cells resolve to nothing at all. First few: `
            + silences.slice(0, 3).join('; '));
    }
    // "At every position" is too strict a bar and quietly hides the finding.
    //
    // A descended True Immortal is refused every mortal-world verb before the
    // verb runs, so an ask that cannot resolve its target at all nineteen
    // positions below the Lid scores 19 of 21 and falls out of an
    // equality check. The claim is about the ladder, so the bar is the ladder.
    const BELOW_THE_LID = POSITIONS.filter(p => p.status !== 'true_immortal').length;
    const everywhereUnfound = [...unfound.entries()].filter(([, n]) => n >= BELOW_THE_LID);
    if (everywhereUnfound.length > 0) {
        note('broken',
            `${everywhereUnfound.length} ask(s) fail to RESOLVE THEIR TARGET at all `
            + `${BELOW_THE_LID} positions on the ladder. The right verb ran and the noun did not exist to it, so `
            + 'standing was never consulted and a refusal was never issued. These must not be read as '
            + `gated - they are unreachable: ${everywhereUnfound.map(([t]) => `"${t}"`).join('; ')}`);
    }
    if (standingBlind.length > 0) {
        note(standingBlind.length > asks.length / 2 ? 'broken' : 'friction',
            `${standingBlind.length} of ${asks.length} asks produce an IDENTICAL mechanical answer at `
            + `all ${POSITIONS.length} positions - same verb, same tables written, same structured `
            + 'ruling - so a True Immortal, a Sect Warden and a sixteen-year-old at ordinal 0 are '
            + `indistinguishable to them: ${standingBlind.slice(0, 6).map(s => `"${s}"`).join('; ')}`);
    } else {
        note('works', `Every one of the ${asks.length} asks answers differently from at least two `
            + 'positions. Standing is read somewhere in all of them.');
    }
    if (reportsButDoesNot.length > 0) {
        note('friction',
            `${reportsButDoesNot.length} ask(s) READ standing, FILE a different structured ruling for `
            + 'three or more positions, and then produce the same nothing at every one of them - no '
            + 'row written anywhere, whether the sender was a rogue at ordinal 0 or the Seat of the '
            + 'Hollow Court. The ladder is being consulted and it is not being obeyed: '
            + reportsButDoesNot.map(s => `"${s}"`).join('; '));
    }
}

/**
 * Every cell, keyed, so a second pass can be compared against the first.
 *
 * Filled by `theMatrix` and read only by `theSameCellsAgain`.
 */
const firstPass = new Map<string, string>();

/**
 * The tree moved. Did any ANSWER move with it?
 *
 * Three agents work this repository at once and the source under `src/` is
 * saved every few seconds, so "no file changed during the run" is a bar that
 * cannot be met and a guard built on it either never passes or gets quietly
 * lowered until it means nothing. Neither is honest.
 *
 * A file changing is not the defect. A CELL changing is. So when the stamp
 * moves, a spread of the table is re-run against the tree as it now stands and
 * compared, cell for cell, against what it said the first time. A table whose
 * sampled cells all reproduce was not affected by whatever landed underneath
 * it, and says so; one that does not reproduce is a mixture of two builds and
 * says THAT, which is the only case where a number here must not be quoted.
 */
async function theSameCellsAgain(): Promise<void> {
    rule('E. THE TREE MOVED - RE-RUNNING A SPREAD OF THE TABLE AGAINST IT');

    const keys = [...firstPass.keys()];
    // A deterministic spread rather than a random sample, so a re-run of the
    // harness re-checks the same cells and a disagreement can be chased.
    const stride = Math.max(1, Math.floor(keys.length / 24));
    const sample = keys.filter((_, i) => i % stride === 0).slice(0, 24);

    const disagreed: string[] = [];
    for (const key of sample) {
        const [text, label] = key.split(' @@ ');
        const position = POSITIONS.find(p => p.label === label);
        if (!position) continue;
        const { game, db } = await seat(position);
        const cell = await ask(game, db, text);
        const now = `${cell.verdict}|${cell.routed}|${cell.wrote.join('+')}`;
        if (now !== firstPass.get(key)) {
            disagreed.push(`${key}: was ${firstPass.get(key)}, now ${now}`);
        }
    }

    line(`  ${sample.length} cells re-run. ${sample.length - disagreed.length} reproduced.`);
    for (const d of disagreed) line(`    DISAGREED  ${d}`);

    if (disagreed.length === 0) {
        note('works', `src/ changed while this ran - it changes constantly with several agents in `
            + `the repository - but all ${sample.length} re-sampled cells reproduced exactly, so `
            + 'nothing that landed underneath the run altered an answer in it. The table stands.');
    } else {
        note('broken',
            `THE TABLE ABOVE IS A MIXTURE OF TWO BUILDS. ${disagreed.length} of ${sample.length} `
            + 're-sampled cells now answer differently than they did earlier in this same run, so '
            + 'the rows are not all measurements of the same engine and no number in them should be '
            + `quoted. Re-run against a still tree. First: ${disagreed[0]}`);
    }
}

async function main(): Promise<void> {
    const stampBefore = treeStamp();

    await theApexDoor();
    await theSecondDoor();
    await theOnlyAxisLeft();
    await theMatrix();

    if (treeStamp() !== stampBefore) await theSameCellsAgain();

    rule('FINDINGS');
    for (const kind of ['broken', 'friction', 'works'] as Kind[]) {
        const hits = notes.filter(n => n.kind === kind);
        if (hits.length === 0) continue;
        line(`\n  ${kind.toUpperCase()} (${hits.length})`);
        for (const h of hits) line(`    ${h.text}`);
    }
    line();
}

main().catch(error => { console.error(error); process.exit(1); });
