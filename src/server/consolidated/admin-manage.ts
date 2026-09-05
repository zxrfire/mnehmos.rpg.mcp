/**
 * Consolidated Admin Tool - `admin_manage`
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { SessionContext } from '../types.js';
import { createActionRouter, ActionDefinition, McpResponse } from '../../utils/action-router.js';
import {
    AmbientQiSchema,
    SectAlignmentSchema,
    STARTING_SPIRIT_STONES,
    TechniqueGradeSchema,
    type AmbientQi,
    type TechniqueGrade
} from '../../schema/cultivation.js';
import { ACTIONS_PER_FULL_SATIETY } from '../../engine/cultivation/survival.js';
import { DAYS_PER_YEAR } from '../../engine/cultivation/cultivation.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    MAX_ORDINAL,
    OBJECT_CEILING_BELOW_THE_LID,
    REALM_TIERS,
    TRUE_IMMORTAL_ORDINAL,
    canAttemptBreakthrough,
    effectiveLifespanYears,
    forStream,
    getSpiritRoot,
    progressRequiredForOrdinal,
    rankName,
    realmForOrdinal,
    rollAttributes,
    rollSpiritRoot
} from '../../engine/cultivation/index.js';
import { PILLS, getPill } from '../../data/cultivation/pills.js';
import { HERBS, getHerb } from '../../data/cultivation/herbs.js';
import { ARTIFACTS, getArtifact } from '../../data/cultivation/artifacts.js';
import { REGIONS } from '../../data/cultivation/regions.js';
import { SECTS } from '../../data/cultivation/sects.js';
import { SITES, type Site } from '../../data/cultivation/inheritance-trials.js';
import { MATCH_THRESHOLD, matchScore } from '../../web/entities.js';
// The closed set of playable verbs. Imported rather than restated so that a
// verb added to the game is forceable the day it exists, and a verb removed
// stops being a word this surface accepts. `actions.ts` imports nothing from
// here, so the direction is one-way.
import { ACTION_NAMES, FALLBACK_ACTION, parseIntent, type ActionName } from '../../web/actions.js';
import { isSentenceRefusal, ordinalNamed, readAdminSentence } from './admin-said-as-a-sentence.js';
import { KnowledgeGate, loosePlaceKey } from '../../web/knowledge.js';
import { SiteLedger } from '../../web/trials.js';
import { handleCultivate, RATION_COST_STONES } from './cultivation-manage.js';
import { worldForRun } from '../state/cultivation-world.js';
import {
    AMBIENT_BLOCK_DAYS,
    addToPouch,
    adminAuditTrail,
    carriedArtifact,
    aliasForAmbient,
    describeCultivator,
    ensureCultivationDb,
    guidingError,
    isAdminRun,
    isGuidingErrorBody,
    resolveActiveRun,
    writeAdminAudit,
    type CultivationRepos
} from './cultivation-support.js';

const ACTIONS = [
    'roster', 'spawn_encounter', 'spawn_site', 'grant_item',
    'set_ambient', 'set_location', 'advance_days', 'grant_progress', 'set_realm',
    'set_age', 'audit_log', 'grant_knowledge', 'force', 'help'
] as const;
type AdminAction = typeof ACTIONS[number];

// WHAT ADMIN CAN DO, IN THE WORDS SOMEBODY WOULD TYPE

interface Recipe {
    /** What an operator wants, said as a want rather than as an action name. */
    want: string;
    /** A line that really works, copy-pasteable. */
    line: string;
}

const RECIPES: readonly Recipe[] = Object.freeze([
    { want: 'Put a person in front of me at a rung I could never meet',
      line: 'ADMIN spawn_encounter ordinal=41' },
    { want: '...and give them a name and a mood',
      line: 'ADMIN spawn_encounter ordinal=41 name=Yun Shizhen disposition=wary' },
    { want: 'Put a rated object in my pouch',
      line: 'ADMIN grant_item ordinal=45 kind=artifact' },
    { want: '...or a specific one, by the name the catalog prints',
      line: 'ADMIN grant_item name=The Standing Edge' },
    { want: 'Put a pill or a herb in my pouch',
      line: 'ADMIN grant_item itemId=<catalog id> quantity=3' },
    { want: 'Make a catalogued grave or trial nameable',
      line: 'ADMIN spawn_site ordinal=41 kind=grave' },
    { want: 'Stand somewhere else on the map',
      line: 'ADMIN set_location location=The Jade Face' },
    { want: 'Stand somewhere the engine derives a chosen ambient band for',
      line: 'ADMIN set_ambient band=dense' },
    { want: 'Move myself on the ladder',
      line: 'ADMIN set_realm ordinal=41' },
    { want: '...and be old enough, or young enough, for a door that asks',
      line: 'ADMIN set_age 250' },
    { want: 'Reach a crossing ATTEMPT from where I stand (rolls nothing)',
      line: 'ADMIN grant_progress fill=true' },
    { want: 'Make an ordinary verb LAND, when the thing in the way was a roll',
      line: 'ADMIN sect join the Azure Dew Sect' },
    { want: '...spelled out, when the verb is also an admin word',
      line: 'ADMIN force move Nine Peaks' },
    { want: 'Let real time pass, with real aging, hunger and death checks',
      line: 'ADMIN advance_days years=50 rations=2000' },
    { want: 'See every cultivator in the world',
      line: 'ADMIN roster' },
    { want: 'Know the name of every place, so I can travel anywhere',
      line: 'ADMIN grant_knowledge kind=place' },
    { want: 'Know the name of every house',
      line: 'ADMIN grant_knowledge kind=sect' },
    { want: 'See what ADMIN has done to this run',
      line: 'ADMIN audit_log' }
]);

/**
 * The things ADMIN deliberately cannot do, and the honest route to each.
 */
const NOT_HERE: ReadonlyArray<{ asked: string; instead: string }> = Object.freeze([
    {
        asked: 'set_hp / kill / revive',
        instead:
            'ADMIN spawn_encounter ordinal=<well above you> and fight it, or ' +
            'ADMIN advance_days years=200 with rations=0 and starve. Death is truth, so it is ' +
            'reached by dying rather than by being declared.'
    },
    {
        asked: 'declare a breakthrough / promote somebody past a precondition',
        instead:
            'ADMIN <verb> forces the ROLL and never the GATE, so ADMIN breakthrough on an empty ' +
            'accumulator is refused and names what to do instead. ADMIN grant_progress fill=true ' +
            'makes the attempt legal, and then ADMIN breakthrough lands it. ADMIN set_realm is ' +
            'the action for standing at a rung without crossing to it.'
    },
    {
        asked: 'heal / clear injuries',
        instead:
            'ADMIN grant_item with the medicine the wound needs, then take it in play. What a wound ' +
            'needs is the engine\'s answer, not this surface\'s.'
    },
    {
        asked: 'invent an item, a site or a place',
        instead:
            'Every one of those is chosen from an authored catalog. ADMIN reveals and grants what ' +
            'exists; it does not author. Add the row to the catalog if it should exist.'
    }
]);

const HelpSchema = z.object({
    action: z.literal('help'),
    /** Narrow the answer to lines mentioning this word. */
    about: z.string().optional(),
    /**
     * A line the sentence reader could not turn into an action. Set only by
     * `parseAdminCommand`, and it turns this from a listing into a refusal:
     * an operator who typed something and got a menu has not been answered.
     */
    unreadable: z.string().optional(),
    ambiguity: z.enum(['no_subject', 'two_subjects', 'a_change_not_a_creation']).optional(),
    collided: z.array(z.string()).optional()
});

/**
 * Which part of the sheet was asked for.
 */
function sectionAsked(about?: string): 'what' | 'refusals' | 'actions' | null {
    const word = (about ?? '').trim().toLowerCase();
    if (word.length === 0) return 'what';
    if (/^(refus|cannot|can.?t|wont|will.?not|no|forbid)/.test(word)) return 'refusals';
    if (/^(action|verb|command|list|all)/.test(word)) return 'actions';
    return null;
}

/** The capability sheet, as a response body. Shared by `help` and every refusal. */
function whatAdminCanDo(about?: string): Record<string, unknown> {
    const needle = (about ?? '').trim().toLowerCase();
    const section = sectionAsked(about);
    const recipes = needle.length === 0 || section !== null
        ? RECIPES
        : RECIPES.filter(r => `${r.want} ${r.line}`.toLowerCase().includes(needle));
    return {
        section: section ?? 'what',
        adminMode: true,
        help: true,
        // The purpose first and the law second, because the law read alone is a
        // list of prohibitions and says nothing about what the tool is for. The
        // design owner's sentence does both halves at once, and the "but" is
        // the load-bearing word: the restriction is what makes the tool useful.
        purpose: 'The admin panel can set preconditions, but it allows me to test outcomes. ' +
            'If it could set outcomes there would be nothing left to test.',
        law: 'ADMIN bypasses GATES, not TRUTH. Every action performs a real deterministic mutation ' +
            'and returns what the engine actually did. The test for any new action: does it ' +
            'ARRANGE A SITUATION, or does it ASSERT A RESULT? Arrange, and it belongs.',
        documentation: 'docs/admin.md',
        actions: ACTIONS.map(name => ({
            action: name,
            does: definitions[name]?.description ?? '',
            takes: Object.keys(
                (definitions[name]?.schema as unknown as { shape?: Record<string, unknown> })?.shape ?? {}
            ).filter(key => key !== 'action')
        })),
        canDo: (recipes.length > 0 ? recipes : RECIPES).map(r => ({ want: r.want, line: r.line })),
        cannotDo: NOT_HERE,
        vocabulary:
            'Arguments are key=value and a value runs to the NEXT key, so a multi-word name needs no ' +
            'quoting. A line that does not begin with an action is read as a sentence instead - ' +
            '"spawn an NPC at Tribulation Transcendence", "give me a 45 weapon" - and the equivalent ' +
            'key=value line is always printed back so the reading is visible and correctable.',
        filteredBy: needle.length > 0 && recipes.length > 0 ? about : null,
        note: 'Read-only. Nothing here writes state and this call is not audited as a change.'
    };
}

export async function handleHelp(args: z.infer<typeof HelpSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('help');
    if (args.unreadable === undefined) return whatAdminCanDo(args.about);

    // ── THE REFUSAL ───────────────────────────────────────────────────────
    //
    // Reached only from a typed line that named no capability, or named two.
    // It is an error rather than a listing on purpose: the operator asked for
    // something and did not get it, and a menu returned as a success reads as
    // though the request was honoured.
    const twoWays = args.ambiguity === 'two_subjects';

    // A CHANGE TO SOMEBODY ALREADY THERE IS AN ABSENCE, NOT A MISREADING
    if (args.ambiguity === 'a_change_not_a_creation') {
        return guidingError(
            'no_action_for_changing_somebody_present',
            `"${args.unreadable}" asks to CHANGE somebody who is already there, and ADMIN has no ` +
            'action that does that. Nothing was created and nothing was changed. ' +
            'spawn_encounter makes a NEW person; set_realm and set_age move the PLAYER.',
            {
                asked: args.unreadable,
                wouldHaveCreated: args.collided ?? [],
                ...whatAdminCanDo(),
                arrangeInstead: [
                    'ADMIN spawn_encounter ordinal=<rung> name=<what they are> - stands a new person ' +
                    'up with the description in the name, which is the field that is free text.',
                    'ADMIN roster - what is actually standing in the world right now, with ids.'
                ],
                hint:
                    'This is a real gap rather than a phrasing problem, and it is worth reporting as ' +
                    'one: what a spawned person IS - a bloodline, an art, a house, a want - is not ' +
                    'something spawn_encounter can be told, and there is no verb for editing one ' +
                    'afterwards. See docs/admin.md.'
            }
        );
    }

    return guidingError(
        twoWays ? 'admin_sentence_ambiguous' : 'admin_sentence_unreadable',
        twoWays
            ? `"${args.unreadable}" asks for two different things at once ` +
              `(${(args.collided ?? []).join(' and ')}), and ADMIN will not pick one for you.`
            : `"${args.unreadable}" does not name anything ADMIN does. Nothing was changed.`,
        {
            asked: args.unreadable,
            ...whatAdminCanDo(),
            hint: twoWays
                ? 'Ask for one of them, or spell it as key=value - a line with an = in it is taken ' +
                  'exactly as typed and nothing is inferred.'
                : 'ADMIN reads a sentence by the KIND OF THING in it - a person, an object, a site, a ' +
                  'place - and the rung, as a number or as a realm name. A line with none of those in ' +
                  'it has nothing to read. Every line listed above works as written.'
        }
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// THE GATE
// ═══════════════════════════════════════════════════════════════════════════

export function isAdminModeEnabled(): boolean {
    // Read at call time, not module load: the flag is an operator decision and
    // must be togglable without restarting a test suite or a server process.
    return String(process.env.ADMIN_MODE ?? '').toLowerCase() === 'true';
}

function adminDisabled(action: string) {
    return guidingError(
        'admin_mode_disabled',
        'admin_manage is unavailable: ADMIN_MODE is not enabled for this process.',
        {
            action,
            requires: 'ADMIN_MODE=true',
            hint:
                'This is an operator setting, not an in-play permission. Nothing you say in the ' +
                'conversation turns it on, and there is no fallback path that performs the action anyway.'
        }
    );
}

// THE COMMAND LINE

/**
 * A key boundary: `key=` at the start of the string or after whitespace.
 */
const ADMIN_ARG_KEY = /(?:^|\s)([A-Za-z_][A-Za-z0-9_]*)=/g;

/** Strip one matched pair of surrounding quotes, and nothing else. */
function unquote(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length < 2) return trimmed;
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' || first === '\'' || first === '`') && first === last) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
}

export interface ParsedAdminCommand {
    /**
     * The action to route to.
     */
    action: string;
    /** Every `key=value` pair, numbers coerced where the whole value is one. */
    args: Record<string, unknown>;
}

/**
 * The action names and aliases a leading word may be, for the sentence check.
 */
let LEADING_WORDS: Map<string, string> | null = null;
function actionWordFor(word: string): string | null {
    if (LEADING_WORDS === null) {
        LEADING_WORDS = new Map<string, string>();
        for (const [name, def] of Object.entries(definitions)) {
            LEADING_WORDS.set(name.toLowerCase(), name);
            for (const alias of def.aliases ?? []) LEADING_WORDS.set(alias.toLowerCase(), name);
        }
    }
    return LEADING_WORDS.get(word.trim().toLowerCase()) ?? null;
}

/**
 * Key under which an inferred reading rides along to the renderer.
 */
export const INFERRED_KEY = '__inferredFromASentence';

/**
 * The one free-text argument each action would mean, when prose follows its name.
 */
/**
 * `<field> <value>` pairs written without the equals sign.
 */
function bareFieldPairs(
    action: AdminAction,
    prose: string
): { pairs: Array<[string, unknown]>; proseLeft: string } {
    const nothing = { pairs: [] as Array<[string, unknown]>, proseLeft: prose };
    const shape = (definitions[action]?.schema as unknown as { shape?: Record<string, unknown> })?.shape;
    if (!shape) return nothing;
    const fields = Object.keys(shape).filter(key => key !== 'action');
    if (fields.length === 0) return nothing;

    const boundary = new RegExp(`(?:^|\\s)(${fields.join('|')})(?=\\s)`, 'gi');
    const found: Array<{ field: string; from: number; at: number }> = [];
    for (let m = boundary.exec(prose); m !== null; m = boundary.exec(prose)) {
        const canonical = fields.find(f => f.toLowerCase() === m![1].toLowerCase())!;
        found.push({ field: canonical, at: m.index, from: m.index + m[0].length });
    }

    if (found.length === 0) return nothing;

    const pairs: Array<[string, unknown]> = [];
    for (let i = 0; i < found.length; i++) {
        const end = i + 1 < found.length ? found[i + 1].at : prose.length;
        const raw = unquote(prose.slice(found[i].from, end));
        if (raw === '') continue;
        if (raw === 'true' || raw === 'false') { pairs.push([found[i].field, raw === 'true']); continue; }
        const asNumber = Number(raw);
        pairs.push([found[i].field, Number.isFinite(asNumber) ? asNumber : raw]);
    }
    // Everything from the first field name onward has been read as pairs, so
    // what is left for the sentence layer is only what came BEFORE it. Without
    // this, `grant_item ordinal 45 kind artifact` had "artifact" read as a
    // subject noun, the whole line handed to the name extractor, and came out
    // as `name=grant_item ordinal kind` - the field names themselves ending up
    // in the field the world calls somebody by.
    return { pairs, proseLeft: prose.slice(0, found[0].at).trim() };
}

/**
 * Where a bare number goes, when the action is named and a number is all that
 * follows it.
 */
const BARE_NUMBER_ARG: Partial<Record<AdminAction, string>> = {
    spawn_encounter: 'ordinal',
    spawn_site: 'ordinal',
    grant_item: 'ordinal',
    set_realm: 'ordinal',
    set_age: 'age',
    advance_days: 'days'
};

const PRIMARY_ARG: Partial<Record<AdminAction, string>> = {
    help: 'about',
    set_location: 'location',
    set_ambient: 'band',
    spawn_site: 'name',
    grant_item: 'name',
    spawn_encounter: 'name'
};

// ADMIN <VERB> - AN ORDINARY VERB, WITH THE ATTEMPT LANDING

/** The words that say "run the verb after this, and let the attempt land". */
const FORCE_WORDS = /^(?:force|force_action|forced|succeed|land|do|play)(?![a-z_])[:\s-]*/i;

export interface ForcedVerbLine {
    /** The playable verb, a member of `ACTION_NAMES`. */
    verb: ActionName;
    /**
     * The sentence the verb resolves against, as a player would have typed it.
     */
    sentence: string;
    /** The whole line after the force word, exactly as the operator typed it. */
    typed: string;
    /** Whether the operator spelled a force word rather than only the verb. */
    spelled: boolean;
}

/**
 * Which half of `ADMIN <verb> <rest>` the verb reads its ARGUMENTS out of.
 */
function theSentenceTheVerbResolvesAgainst(rest: string): string {
    const head = rest.split(/\s+/)[0] ?? '';
    const remainder = rest.slice(head.length).trim();
    if (remainder.length === 0) return rest;
    return parseIntent(remainder).action === FALLBACK_ACTION ? rest : remainder;
}

/**
 * Read `ADMIN <verb> ...` - or `ADMIN force <verb> ...` - into a playable verb.
 */
export function readAForcedVerb(request: string): ForcedVerbLine | null {
    const line = request.trim();
    if (line.length === 0) return null;

    const forceWord = FORCE_WORDS.exec(line);
    const spelled = forceWord !== null;
    const rest = spelled ? line.slice(forceWord![0].length).trim() : line;
    if (rest.length === 0) return null;

    // `key=value` is the surface's own vocabulary and belongs to the admin
    // actions. A line carrying one is not a player sentence.
    const head = rest.split(/\s+/)[0] ?? '';
    if (head.includes('=')) return null;

    const wanted = head.toLowerCase().replace(/-/g, '_');
    const verb = ACTION_NAMES.find(name => name === wanted) ?? null;
    if (verb === null) return null;
    // `unclear` is the fallback the parser reaches when it understood nothing.
    // Naming it deliberately would force an attempt at doing nothing.
    if (verb === 'unclear') return null;
    if (!spelled && actionWordFor(head) !== null) return null;

    return { verb, sentence: theSentenceTheVerbResolvesAgainst(rest), typed: rest, spelled };
}

const ForceSchema = z.object({
    action: z.literal('force'),
    /** The playable verb. Read from the line by `readAForcedVerb`, not by this. */
    verb: z.string().optional(),
    sentence: z.string().optional()
});

/**
 * `force` on the TOOL path, which is the one place it cannot run.
 */
export async function handleForce(args: z.infer<typeof ForceSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('force');
    return guidingError(
        'force_runs_in_play',
        'Forcing runs an ORDINARY VERB, and an ordinary verb runs inside a run. This tool holds ' +
        'repositories, not a run, so there is nothing here to run it in - and building a second ' +
        'way to execute a verb is what would make the forced path and the played path drift.',
        {
            asked: args.verb ?? args.sentence ?? null,
            reachableAs: 'ADMIN <verb> <the sentence>, typed at the game, for example: ' +
                'ADMIN sect join the Azure Dew Sect',
            law:
                'Forcing decides an uncertain outcome. It does not make an illegal action legal. A ' +
                'refusal that was a precondition still refuses, and names the action that arranges it.',
            verbs: ACTION_NAMES.filter(name => name !== 'unclear'),
            hint: 'ADMIN help actions for the arranging actions this tool does hold.'
        }
    );
}

/**
 * Parse an ADMIN command line into an action and its arguments.
 */
export function parseAdminCommand(request: string): ParsedAdminCommand {
    const line = request.trim();
    const args: Record<string, unknown> = {};

    ADMIN_ARG_KEY.lastIndex = 0;
    const keys: Array<{ name: string; valueFrom: number; keyFrom: number }> = [];
    for (let m = ADMIN_ARG_KEY.exec(line); m !== null; m = ADMIN_ARG_KEY.exec(line)) {
        keys.push({
            name: m[1],
            keyFrom: m.index,
            valueFrom: m.index + m[0].length
        });
    }

    const action = (keys.length > 0 ? line.slice(0, keys[0].keyFrom) : line).trim().split(/\s+/)[0] ?? '';

    for (let i = 0; i < keys.length; i++) {
        const end = i + 1 < keys.length ? keys[i + 1].keyFrom : line.length;
        const raw = unquote(line.slice(keys[i].valueFrom, end));
        if (raw === '') {
            args[keys[i].name] = '';
            continue;
        }
        // `fill=true` and `includeDead=false` are how a person writes a flag,
        // and every boolean field in this surface's schemas rejects the string.
        // Only the two exact words, so a site called "True Something" is safe.
        if (raw === 'true' || raw === 'false') {
            args[keys[i].name] = raw === 'true';
            continue;
        }
        const asNumber = Number(raw);
        args[keys[i].name] = Number.isFinite(asNumber) && raw.trim() !== '' ? asNumber : raw;
    }

    // A LINE THAT DOES NOT BEGIN WITH AN ACTION IS A SENTENCE
    const prose = (keys.length > 0 ? line.slice(0, keys[0].keyFrom) : line).trim();
    const known = action === '' ? null : actionWordFor(action);
    const hasProse = /\s/.test(prose);

    // ── PAIRS WITH THE EQUALS SIGN LEFT OUT, READ FIRST ───────────────────
    //
    // Before the sentence layer, so an explicitly named field always beats an
    // inferred one and the words that formed a pair are not offered to the
    // sentence reader a second time. See `bareFieldPairs`.
    const bare = known === null
        ? { pairs: [] as Array<[string, unknown]>, proseLeft: prose }
        : bareFieldPairs(known as AdminAction, prose);
    for (const [field, value] of bare.pairs) {
        if (args[field] === undefined) args[field] = value;
    }

    if (action !== '' && (known === null || hasProse)) {
        // THE ACTION WORD IS NOT ALSO A NAME. When the operator typed it,
        // `grant_item ordinal 45 kind artifact` left "grant_item" as the whole
        // remainder, and the sentence reader - which knows "item" as a subject
        // noun and has never heard of "grant_item" - read it as what to call
        // the thing, giving `name=grant_item`. The word did its job identifying
        // the action; it is not a second argument.
        const readable = known === null
            ? bare.proseLeft
            : bare.proseLeft.replace(new RegExp(`^\\s*${action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '');
        const reading = readAdminSentence(readable);
        const usable =
            reading !== null &&
            !isSentenceRefusal(reading) &&
            // A NAMED action wins over an inferred one. When the operator wrote
            // `audit log`, the action is `audit_log` and the sentence reader's
            // opinion about the rest is not wanted; when they wrote `npc at Core
            // Formation`, the alias and the reading agree and the reading is
            // carrying the argument.
            (known === null
                || known === reading.action
                || !ACTIONS.includes(action.trim().toLowerCase() as AdminAction));
        if (usable) {
            const merged = { ...(reading as { args: Record<string, unknown> }).args, ...args };
            const chosen = (reading as { action: string }).action;
            return {
                action: chosen,
                args: {
                    ...merged,
                    [INFERRED_KEY]: JSON.stringify({
                        typed: line,
                        asTyped: `ADMIN ${[
                            chosen,
                            ...Object.entries(merged).map(([k, v]) => `${k}=${v}`)
                        ].join(' ')}`,
                        because: (reading as { because: string[] }).because
                    })
                }
            };
        }
        // THE ACTION WAS NAMED AND PROSE FOLLOWED IT
        if (known !== null && hasProse && bare.pairs.length === 0) {
            const field = PRIMARY_ARG[known as AdminAction];
            const rest = prose.slice(prose.indexOf(action) + action.length).trim();
            // A bare number is that action's number, not its name. See
            // `BARE_NUMBER_ARG` for why this is a lookup and not a guess.
            const numeric = BARE_NUMBER_ARG[known as AdminAction];
            if (numeric !== undefined && /^\d+$/.test(rest) && args[numeric] === undefined) {
                args[numeric] = Number(rest);
            } else if (field !== undefined && rest.length > 0 && args[field] === undefined) {
                args[field] = rest;
            }
        }

        // A prose line that named no action AND could not be read gets the
        // capability sheet rather than a ranked list of action names. A SINGLE
        // unknown word falls through to the router instead, because a single word
        // is usually a typo and the fuzzy matcher is genuinely good at those -
        // `spawn_encountr` should be corrected, not answered with a menu. And a
        // line that DID name an action is routed as that action, so `advance_days
        // 50 years` still reaches `advance_days` and is refused there, by the
        // action, in that action's own words.
        if (known === null && hasProse) {
            return {
                action: 'help',
                args: {
                    unreadable: line,
                    ambiguity: reading !== null && isSentenceRefusal(reading) ? reading.reason : 'no_subject',
                    collided: reading !== null && isSentenceRefusal(reading) ? reading.collided : []
                }
            };
        }
    }

    // A RUNG MAY BE NAMED RATHER THAN NUMBERED
    if (typeof args.ordinal === 'string') {
        const named = ordinalNamed(args.ordinal);
        if (named) args.ordinal = named.ordinal;
    }

    // AND NO LEANING IS READ OUT OF LOOSE PROSE

    return { action, args };
}

// SCHEMAS

/**
 * A rung, as a number or as a name the ladder knows.
 */
function ordinalArg(description: string) {
    return z.preprocess(
        value => {
            if (typeof value !== 'string') return value;
            const named = ordinalNamed(value);
            return named === null ? value : named.ordinal;
        },
        // "THERE IS NO SUCH RUNG", NOT "TOO HIGH"
        z.number().int()
            .min(0, { message: `The ladder starts at 0. There is no rung below it.` })
            .max(MAX_ORDINAL, {
                message:
                    `The ladder ends at ${MAX_ORDINAL}. There is no such rung above it - not a ` +
                    'limit, an absence, and nothing in this world has a meaning for one.'
            })
    ).describe(
        `${description} Accepts a number 0-${MAX_ORDINAL}, or a realm by name ` +
        `(${REALM_TIERS.map(t => t.name).join(', ')}), or a realm plus its sub-rank ` +
        '("Core Formation Early"). A realm name alone means the first rung of that band.'
    );
}

const RosterSchema = z.object({
    action: z.literal('roster'),
    includeDead: z.boolean().optional().default(true)
});

const SpawnEncounterSchema = z.object({
    action: z.literal('spawn_encounter'),
    ordinal: ordinalArg('How strong this person is. The one argument with no sensible default.'),
    name: z.string().min(1).max(100).optional()
        .describe('What to call them. Defaults to "A <realm> cultivator".'),
    location: z.string().optional()
        .describe('Where they are standing. DEFAULTS TO WHERE THE PLAYER IS - "in front of me" needs no argument.'),
    // `friendly` is here because the surface could not arrange a kind encounter at
    // all: every person ADMIN could stand in front of the player was hostile, wary
    // or indifferent, so "spawn somebody who will help me" had no spelling and the
    // whole cooperative half of the game was unreachable from the operator side. It
    // reaches exactly what the other three reach - the knowledge record, and
    // nothing else. See `dispositionReaches`: there is still no store for how
    // somebody is disposed toward the player right now, and this does not invent
    // one.
    disposition: z.enum(['hostile', 'wary', 'indifferent', 'friendly']).optional().default('hostile')
        .describe('How they are disposed toward the player. Defaults to hostile.'),
    // Which house answers for them, and so how far they go when wronged. See
    // the comment beside `sectId` in the handler.
    alignment: SectAlignmentSchema.optional()
        .describe('Puts them in a real house of that leaning, which decides what they do about being threatened or robbed. Omitted leaves them on no roll at all.')
});

const SpawnSiteSchema = z.object({
    action: z.literal('spawn_site'),
    kind: z.enum(['grave', 'trial', 'any']).optional().default('any'),
    ordinal: ordinalArg('What rung to aim at. The nearest catalogued site to it is revealed.').optional(),
    name: z.string().min(1).max(120).optional()
        .describe('Name a specific catalogued site instead. Its own name, or the phrase in its id.')
});

const GrantItemSchema = z.object({
    action: z.literal('grant_item'),
    itemId: z.string().optional()
        .describe('A catalog pill, herb or artifact id. Nothing outside the catalogs exists.'),
    /**
     * Aim at a rung instead of naming an id. The nearest catalogued ARTIFACT to it
     * is granted, exactly the way `spawn_site` aims at a site: a rated object is on
     * the realm ladder and "a 45 weapon" is how anybody asks for one. Pills and
     * herbs are graded 1-9, not laddered, so this is artifact-only and says so
     * rather than quietly meaning something different per kind.
     */
    ordinal: ordinalArg('ARTIFACTS ONLY: grant the catalogued object nearest this rung. This is how "a 45 weapon" is asked for.').optional(),
    /** Narrow what a name or an ordinal is searched against. */
    kind: z.enum(['pill', 'herb', 'artifact', 'any']).optional().default('any'),
    /** A catalog entry by its own name, rather than by its id. */
    name: z.string().min(1).max(160).optional(),
    quantity: z.number().int().min(1).max(999).optional().default(1),
    cultivatorId: z.string().optional()
});

const SetAmbientSchema = z.object({
    action: z.literal('set_ambient'),
    band: AmbientQiSchema,
    cultivatorId: z.string().optional()
});

const SetLocationSchema = z.object({
    action: z.literal('set_location'),
    location: z.string().min(1).max(200),
    cultivatorId: z.string().optional()
});

const AdvanceDaysSchema = z.object({
    action: z.literal('advance_days'),
    days: z.number().min(1).max(3_650_000).optional(),
    months: z.number().min(0).max(120_000).optional(),
    years: z.number().min(0).max(10_000).optional(),
    /**
     * Days of food bought up front, at the ordinary price, out of the ordinary
     * purse. Zero is the default and it is why a long span stops short: an
     * unprovisioned body empties its belly in fifty turns and the simulation
     * correctly refuses to keep going. This is not a gate ADMIN may lift -
     * starvation is truth - so what it gets instead is the ability to pay.
     */
    rations: z.number().int().min(0).max(10_000).optional().default(0),
    cultivatorId: z.string().optional()
});

const GrantProgressSchema = z.object({
    action: z.literal('grant_progress'),
    /** Qi-units to add. Omit and `fill` decides. */
    amount: z.number().min(0).max(1e12).optional(),
    /** Fill to exactly what the current rung requires for an attempt. */
    fill: z.boolean().optional(),
    cultivatorId: z.string().optional()
});

const SetRealmSchema = z.object({
    action: z.literal('set_realm'),
    ordinal: ordinalArg('The rung to stand the cultivator at. Up or down; both go through advanceRealm.'),
    cultivatorId: z.string().optional()
});

/**
 * How old the cultivator is.
 */
const SetAgeSchema = z.object({
    action: z.literal('set_age'),
    age: z.number().min(0).max(1e7)
        .describe('Age in years. Absolute, not a delta - up or down, both go through applyDeltas.'),
    cultivatorId: z.string().optional()
});

const GrantKnowledgeSchema = z.object({
    action: z.literal('grant_knowledge'),
    /**
     * PLACES AND HOUSES ONLY, AND THE OMISSION IS THE POINT.
     */
    kind: z.enum(['place', 'sect', 'any']).optional().default('any')
        .describe('Narrow to places or to houses. Omit for both. Never events: an event is a claim about history.'),
    name: z.string().min(1).max(160).optional()
        .describe('One entry by its own name, instead of everything of a kind.')
});

const AuditLogSchema = z.object({
    action: z.literal('audit_log'),
    runId: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional().default(50)
});

// THE GAZETTEER

interface Gazetteer {
    /** Canonical display names, deduplicated, in catalog order. */
    names: string[];
    /** Where each register's entries came from, for the response. */
    sources: Record<string, number>;
}

async function gazetteerFor(
    repos: ReturnType<typeof ensureCultivationDb>,
    run: { id: string; seed: string } & Record<string, unknown>
): Promise<Gazetteer> {
    const seen = new Map<string, string>();
    const sources: Record<string, number> = { regionCatalog: 0, world: 0, occupied: 0 };

    const add = (name: string | null | undefined, source: string): void => {
        const clean = (name ?? '').trim();
        if (clean.length === 0) return;
        const key = loosePlaceKey(clean);
        if (key === 'unnamed' || seen.has(key)) return;
        seen.set(key, clean);
        sources[source] = (sources[source] ?? 0) + 1;
    };

    // 1. The authored catalog. Always present, world driver or no world driver.
    for (const region of REGIONS) {
        add(region.name, 'regionCatalog');
        for (const place of region.places) add(place.name, 'regionCatalog');
    }

    // 2. The generated world's own locations, when there is a world.
    try {
        const world = await worldForRun(run as never);
        for (const location of world.locations) add(location.name, 'world');
    } catch {
        // A run with no world is a run in a game the world layer is not part
        // of. The authored catalog still holds, so this is not a failure.
    }

    // 3. Anywhere somebody is standing. A place with people in it is a place.
    for (const row of repos.cultivators.roster()) add(row.location, 'occupied');

    return { names: [...seen.values()], sources };
}

interface PlaceLookup {
    /** The gazetteer's own spelling, so what is stored is what the world calls it. */
    canonical: string | null;
    /** Best near misses, for the refusal. Never more than five. */
    nearest: string[];
}

/**
 * Which place on the map a typed name means.
 */
function lookUpPlace(wanted: string, gazetteer: Gazetteer): PlaceLookup {
    const needle = wanted.trim();
    const key = loosePlaceKey(needle);

    const exact = gazetteer.names.find(name => loosePlaceKey(name) === key);
    if (exact) return { canonical: exact, nearest: [] };

    const scored = gazetteer.names
        .map(name => ({ name, score: matchScore(needle, name) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score);

    if (scored.length > 0 && scored[0].score >= MATCH_THRESHOLD) {
        // One clear winner only. Two candidates tied at the top is exactly the
        // case where guessing picks the wrong one.
        const tied = scored.filter(entry => entry.score === scored[0].score);
        if (tied.length === 1) return { canonical: scored[0].name, nearest: [] };
    }

    return { canonical: null, nearest: scored.slice(0, 5).map(entry => entry.name) };
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleRoster(args: z.infer<typeof RosterSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('roster');
    const repos = ensureCultivationDb();

    const rows = repos.cultivators
        .roster()
        .filter(entry => (args.includeDead ?? true) || entry.alive);

    // Read-only observability writes no state, but it still lands in the audit
    // log: knowing that someone looked at the whole world is part of knowing
    // that a run was played with the lid off.
    const run = repos.runs.getActiveRun();
    writeAdminAudit(repos, 'roster', run?.id ?? null, { rows: rows.length });

    return {
        adminMode: true,
        count: rows.length,
        roster: rows.map(entry => ({
            ...entry,
            rank: rankName(entry.realmOrdinal),
            realm: realmForOrdinal(entry.realmOrdinal).name,
            spiritRootName: getSpiritRoot(entry.spiritRoot).name
        })),
        note: 'Read-only projection. Nothing here is writable through this action.'
    };
}

/**
 * What rung a catalogued site is pitched at.
 */
function siteOrdinalOf(site: Site): number {
    if (site.kind === 'grave') return site.occupantOrdinal;
    let hardest = 0;
    for (const gate of site.interior.gates) {
        if (gate.kind === 'strength' && gate.ordinal > hardest) hardest = gate.ordinal;
    }
    return hardest > 0 ? hardest : site.outside.advertisedOrdinal ?? 0;
}

/** The id slug as a person would say it: `grave-shen-guyi` -> `shen guyi`. */
function sitePhrase(siteId: string): string {
    return siteId.replace(/^(?:trial|grave)-/, '').replace(/^the-/, '').replace(/-/g, ' ');
}

/**
 * ADMIN over the sites the player can actually reach.
 */
export async function handleSpawnSite(args: z.infer<typeof SpawnSiteSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('spawn_site');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, {});
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const kind = args.kind ?? 'any';
    const pool = SITES.filter(site => kind === 'any' || site.kind === kind);

    if (pool.length === 0) {
        return guidingError(
            'no_such_site_kind',
            `The catalog holds no sites of kind "${kind}".`,
            { kinds: [...new Set(SITES.map(s => s.kind))] }
        );
    }

    // ── Which site. Named beats aimed-at; aimed-at beats the seed. ────────
    let site: Site | null = null;
    let how = '';

    if (args.name) {
        const scored = pool
            .map(entry => ({
                entry,
                score: Math.max(matchScore(args.name!, entry.name), matchScore(args.name!, sitePhrase(entry.id)))
            }))
            .sort((a, b) => b.score - a.score);
        if (scored.length === 0 || scored[0].score < MATCH_THRESHOLD) {
            return guidingError(
                'unknown_site',
                `No catalogued site answers to "${args.name}".`,
                {
                    asked: args.name,
                    nearest: scored.slice(0, 5).map(s => s.entry.name),
                    catalogSize: SITES.length,
                    hint:
                        'ADMIN reveals sites that exist; it does not author them. Omit name= and pass ' +
                        'ordinal=N to be given the catalogued site nearest that rung.'
                }
            );
        }
        site = scored[0].entry;
        how = `named by the caller and matched to the catalog at ${scored[0].score}/100`;
    } else if (args.ordinal !== undefined) {
        const wanted = args.ordinal;
        let best = pool[0];
        let bestGap = Math.abs(siteOrdinalOf(best) - wanted);
        for (const entry of pool) {
            const gap = Math.abs(siteOrdinalOf(entry) - wanted);
            // Ties break toward the harder site, so aiming high never lands low.
            if (gap < bestGap || (gap === bestGap && siteOrdinalOf(entry) > siteOrdinalOf(best))) {
                best = entry;
                bestGap = gap;
            }
        }
        site = best;
        how =
            bestGap === 0
                ? `catalogued at ordinal ${wanted} exactly`
                : `nearest catalogued site to ordinal ${wanted}; it stands at ${siteOrdinalOf(best)}, ` +
                  `${bestGap} rung(s) away. The catalog is authored and has no entry at every rung.`;
    } else {
        // Nothing named and nothing aimed at: the run's own seed picks, so two
        // calls on one run are reproducible rather than arbitrary.
        const nonce = repos.db
            .prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'admin_manage.spawn_site'")
            .get() as { n: number };
        site = forStream(run.seed, 'admin_site', nonce.n).pick(pool);
        how = 'picked from the run seed - no ordinal and no name were given';
    }

    const chosen: Site = site;
    const ordinal = siteOrdinalOf(chosen);
    const knowledge = new KnowledgeGate(repos.db);
    const ledger = new SiteLedger(repos.db);
    const alreadyHeld = knowledge.isAwareOf(cultivator.id, 'place', chosen.id);
    const onDay = Math.max(0, Math.floor(run.elapsedDays));

    repos.db.transaction(() => {
        // The knowledge record is the gate. `witnessed` is the honest source:
        // an operator put the name in front of this cultivator, and the audit
        // row says so in the same transaction.
        knowledge.learnIfNew({
            holderId: cultivator.id,
            kind: 'place',
            id: chosen.id,
            name: chosen.name,
            onDay,
            sourceKind: 'witnessed',
            sourceNote: 'ADMIN revealed this site. The awareness gate was lifted; nothing inside it was.',
            statement: `${chosen.name} exists and can be found.`
        });
        // Sought, not entered. This is what makes a bare "I go inside" resolve
        // to this site rather than to nothing, and it claims no entry.
        ledger.write(run.id, chosen, run.elapsedDays, { soughtOnDay: onDay });
        writeAdminAudit(repos, 'spawn_site', run.id, {
            cultivatorId: cultivator.id,
            siteId: chosen.id,
            siteName: chosen.name,
            kind: chosen.kind,
            siteOrdinal: ordinal,
            selection: how,
            awarenessAlreadyHeld: alreadyHeld,
            gateLifted: `awareness only; player stands at ordinal ${cultivator.realmOrdinal}`
        });
    })();

    return {
        adminMode: true,
        spawned: true,
        revealed: true,
        site: {
            id: chosen.id,
            catalogId: chosen.id,
            kind: chosen.kind,
            name: chosen.name,
            ordinal,
            rank: rankName(ordinal),
            marker: chosen.outside.marker,
            advertisedOrdinal: chosen.outside.advertisedOrdinal,
            startingAwareness: chosen.outside.startingAwareness,
            awarenessAlreadyHeld: alreadyHeld
        },
        selection: how,
        // AGENTS.md: any name the game prints is a name the game must accept.
        // These two both resolve through `resolveSite`.
        sayThis: [`approach ${chosen.name}`, `approach the ${sitePhrase(chosen.id)}`],
        gateLifted: {
            playerOrdinal: cultivator.realmOrdinal,
            siteOrdinal: ordinal,
            what: 'awareness',
            note:
                'A content gate was lifted, not a truth. This is a real catalogued site and it is now ' +
                'nameable by this cultivator; the strength bar, the comprehension bar and every claim ' +
                'condition inside it are untouched and will refuse exactly as they would have. ' +
                'Nothing was rolled, nothing was granted, and nothing was invented.'
        },
        runFlagged: true
    };
}

export async function handleSpawnEncounter(
    args: z.infer<typeof SpawnEncounterSchema>
): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('spawn_encounter');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, {});
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;

    // A real cultivator, with talent rolled from the run seed exactly as the
    // player's was. Nothing about this opponent is asserted.
    const nonce = repos.cultivators.list().length;
    const rootRng = forStream(run.seed, 'admin_encounter_root', nonce, args.ordinal);
    const attrRng = forStream(run.seed, 'admin_encounter_attrs', nonce, args.ordinal);
    const spiritRoot = rollSpiritRoot(rootRng.next());
    const attributes = rollAttributes([
        attrRng.next(), attrRng.next(), attrRng.next(), attrRng.next()
    ]);

    const maxHp = 20 + attributes.might * 10 + args.ordinal * 5;
    const maxQi = 10 + attributes.insight * 5 + args.ordinal * 4;
    const opponentId = randomUUID();
    const siteId = randomUUID();
    const location = args.location ?? cultivator.location ?? 'the open road';
    const name = args.name ?? `A ${realmForOrdinal(args.ordinal).name} cultivator`;
    const disposition = args.disposition ?? 'hostile';
    // The house that answers for them, found by the alignment asked for and
    // pitched as near this person's rung as the catalog allows - a Void
    // Refinement elder belongs to a house that has Void Refinement people in
    // it. Deterministic: same alignment and same rung, same house, every time.
    const house = args.alignment === undefined
        ? null
        : SECTS
            .filter(s => s.alignment === args.alignment)
            .slice()
            .sort((a, b) =>
                Math.abs(a.powerOrdinal - args.ordinal) - Math.abs(b.powerOrdinal - args.ordinal)
                || a.id.localeCompare(b.id))[0] ?? null;
    const knowledge = new KnowledgeGate(repos.db);

    repos.db.transaction(() => {
        repos.cultivators.create({
            id: opponentId,
            runId: run.id,
            name,
            kind: 'enemy',
            spiritRoot: spiritRoot.key,
            attributes,
            realmOrdinal: 0,
            hp: maxHp,
            maxHp,
            qi: maxQi,
            maxQi,
            age: 20 + args.ordinal * 4,
            location,
            // AND WHOSE THEY ARE, WHICH DECIDES WHAT THEY DO TO YOU. The
            // entry rank comes with the house: a house answers for somebody it
            // has invested in, and `ranked` is how every reader asks that, so a
            // house membership with no rung on it would leave this person's
            // house doing nothing at all about whatever is done to them.
            ...(house ? { sectId: house.id, sectRank: house.ranks[0] } : {}),
            spiritStones: STARTING_SPIRIT_STONES * (1 + args.ordinal)
        });
        // The rank change takes the same road every rank change takes.
        if (args.ordinal > 0) repos.cultivators.advanceRealm(opponentId, args.ordinal);

        // THE PLAYER HAS TO BE ABLE TO NAME THEM
        knowledge.learnIfNew({
            holderId: cultivator.id,
            kind: 'cultivator',
            id: opponentId,
            name,
            onDay: Math.max(0, Math.floor(run.elapsedDays)),
            sourceKind: 'witnessed',
            sourceNote: 'ADMIN put this person in front of the cultivator. The awareness gate was ' +
                'lifted; nothing about who they are or what they can do was.',
            stance: 'knows',
            confidence: 1,
            statement: disposition === 'hostile'
                ? `${name} is standing here, at ${rankName(args.ordinal)}, and means harm.`
                : `${name} is standing here, at ${rankName(args.ordinal)}, and is ${disposition}.`
        });

        repos.db.prepare(`
            INSERT INTO cultivation_sites
                (id, run_id, kind, name, ordinal, location, contents, admin_spawned, discovered, created_on_day)
            VALUES (?, ?, 'encounter', ?, ?, ?, ?, 1, 0, ?)
        `).run(
            siteId, run.id, name, args.ordinal, location,
            JSON.stringify({
                opponentCultivatorId: opponentId,
                disposition
            }),
            run.elapsedDays
        );

        writeAdminAudit(repos, 'spawn_encounter', run.id, {
            encounterId: siteId,
            opponentCultivatorId: opponentId,
            ordinal: args.ordinal,
            spiritRoot: spiritRoot.key,
            attributes,
            location,
            gateLifted: `player stands at ordinal ${cultivator.realmOrdinal}`
        });
    })();

    const opponent = repos.cultivators.getById(opponentId)!;

    return {
        adminMode: true,
        spawned: true,
        encounterId: siteId,
        opponent: describeCultivator(repos, opponent, run),
        disposition,
        location,
        // AGENTS.md: any name the game prints is a name the game must accept.
        // These reach the person through the ordinary player verbs, and they
        // work because the knowledge record above made them nameable.
        sayThis: [`who is here`, `look at ${name}`, `talk to ${name}`, `attack ${name}`],
        // WHAT THE DISPOSITION REACHES, AND WHAT IT DOES NOT
        dispositionReaches: {
            said: 'On the knowledge record. "what do I know about them" answers it.',
            notSaid:
                'Not volunteered by look or by who is here, and nothing makes them act on it. There ' +
                'is no store for a present disposition toward the player, and no grudge was written ' +
                'because no cause exists - nothing happened, somebody was placed. This is a gap in ' +
                'the world, not in ADMIN, and it is reported rather than faked.'
        },
        gateLifted: {
            playerOrdinal: cultivator.realmOrdinal,
            opponentOrdinal: args.ordinal,
            // A RATIO IS NOT TWELVE DECIMAL PLACES
            powerRatio: roundRatio(
                realmForOrdinal(args.ordinal).powerMultiplier /
                realmForOrdinal(cultivator.realmOrdinal).powerMultiplier
            ),
            howTheyCompare: comparePower(
                realmForOrdinal(args.ordinal).powerMultiplier /
                realmForOrdinal(cultivator.realmOrdinal).powerMultiplier
            ),
            note:
                'This opponent is a real persisted cultivator with engine-rolled talent. If the player ' +
                'fights it, the engine decides what happens.'
        },
        runFlagged: true
    };
}

/**
 * A catalog artifact by name, or by the rung it was made at.
 */
function artifactNearest(
    wanted: number
): { record: (typeof ARTIFACTS)[number]; gap: number } | null {
    let best: (typeof ARTIFACTS)[number] | null = null;
    let bestGap = Infinity;
    for (const record of ARTIFACTS) {
        if (record.power === null) continue;
        const gap = Math.abs(record.power - wanted);
        if (gap < bestGap || (gap === bestGap && best !== null && record.power > (best.power ?? 0))) {
            best = record;
            bestGap = gap;
        }
    }
    return best === null ? null : { record: best, gap: bestGap };
}

/**
 * Put something the catalogs really hold into the real pouch.
 */
/**
 * A power ratio at a precision somebody can hold.
 */
function roundRatio(ratio: number): number {
    if (!Number.isFinite(ratio) || ratio <= 0) return 0;
    if (ratio >= 100) return Math.round(ratio);
    if (ratio >= 1) return Number(ratio.toFixed(1));
    return Number(ratio.toPrecision(2));
}

/**
 * The same ratio as a sentence, because a number alone answers nothing.
 */
function comparePower(ratio: number): string {
    if (!Number.isFinite(ratio) || ratio <= 0) return 'not comparable';
    if (ratio >= 1.05) {
        return `they are worth about ${roundRatio(ratio).toLocaleString('en')} of you`;
    }
    if (ratio <= 0.95) {
        return `you are worth about ${roundRatio(1 / ratio).toLocaleString('en')} of them`;
    }
    return 'you are worth about the same as each other';
}

// SAYING WHICH THING, IN THE WORDS SOMEBODY WOULD USE

/**
 * Words in a `name=` that are not part of any name.
 */
const NOT_PART_OF_A_NAME = new Set([
    'me', 'my', 'myself', 'i', 'mine', 'us', 'our', 'ourselves', 'player',
    'the', 'a', 'an', 'some', 'to', 'for', 'of',
    // And the word that qualifies a grade rather than naming anything: "chaos
    // grade" is one fact about the pool, not a name word that has to be found
    // in a row. Kept here as well as in the sentence reader's noise list
    // because `name=` can be typed directly and never goes through that.
    'grade', 'graded', 'grades', 'tier', 'rated', 'level'
]);

/**
 * Words that say which CATALOG rather than which row.
 */
const A_WORD_FOR_A_CATALOG: Readonly<Record<string, 'pill' | 'herb' | 'artifact'>> = Object.freeze({
    pill: 'pill', pills: 'pill', medicine: 'pill', elixir: 'pill', pellet: 'pill',
    herb: 'herb', herbs: 'herb', plant: 'herb', root: 'herb', ingredient: 'herb',
    artifact: 'artifact', weapon: 'artifact', sword: 'artifact', blade: 'artifact',
    treasure: 'artifact', object: 'artifact'
});

/** How a name is broken into words for matching. Lowercase, punctuation out. */
function wordsOf(text: string): string[] {
    return text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 0);
}

/**
 * What an operator's description of an item actually said.
 */
interface WhatWasDescribed {
    /** Grade words found, e.g. `chaos`. Narrows the pool; never names a row. */
    grades: TechniqueGrade[];
    /** Catalog words found. Narrows the pool the same way `kind=` does. */
    kinds: Array<'pill' | 'herb' | 'artifact'>;
    /** Everything left, which is what a name is matched against. */
    words: string[];
    /** The words dropped as not being part of any name, for the echo. */
    dropped: string[];
}

export function readAnItemDescription(name: string): WhatWasDescribed {
    const grades: TechniqueGrade[] = [];
    const kinds: Array<'pill' | 'herb' | 'artifact'> = [];
    const words: string[] = [];
    const dropped: string[] = [];
    const gradeNames = TechniqueGradeSchema.options as readonly string[];

    for (const word of wordsOf(name)) {
        if (NOT_PART_OF_A_NAME.has(word)) { dropped.push(word); continue; }
        if (gradeNames.includes(word)) {
            if (!grades.includes(word as TechniqueGrade)) grades.push(word as TechniqueGrade);
            continue;
        }
        const kind = A_WORD_FOR_A_CATALOG[word];
        if (kind !== undefined) {
            if (!kinds.includes(kind)) kinds.push(kind);
            continue;
        }
        words.push(word);
    }
    return { grades, kinds, words, dropped };
}

/** One catalog row, flattened so the three catalogs can be scored together. */
interface CatalogRow {
    id: string;
    name: string;
    kind: 'pill' | 'herb' | 'artifact';
    grade: TechniqueGrade | null;
    /** A rated object's rung, where it has one. */
    power: number | null;
}

function everyItemRow(): CatalogRow[] {
    return [
        ...PILLS.map(p => ({
            id: p.id, name: p.name, kind: 'pill' as const,
            grade: (p as { grade?: TechniqueGrade }).grade ?? null, power: null
        })),
        ...HERBS.map(h => ({
            id: h.id, name: h.name, kind: 'herb' as const,
            grade: (h as { grade?: TechniqueGrade }).grade ?? null, power: null
        })),
        ...ARTIFACTS.map(a => ({
            id: a.id, name: a.name, kind: 'artifact' as const,
            grade: null, power: (a as { power?: number | null }).power ?? null
        }))
    ];
}

/**
 * How well one row answers a description.
 */
function howWellItAnswers(described: WhatWasDescribed, row: CatalogRow): number {
    if (described.words.length === 0) return 0;
    const inTheName = new Set([...wordsOf(row.name), ...wordsOf(row.id)]);
    const hit = described.words.filter(w => inTheName.has(w)).length;
    const whole = hit / described.words.length;
    return whole * 100 + matchScore(described.words.join(' '), row.name) / 1000;
}

export async function handleGrantItem(args: z.infer<typeof GrantItemSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('grant_item');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const want = args.kind ?? 'any';
    const asked = args.itemId ?? args.name;

    // ── WHICH THING. Id beats name; name beats rung. ──────────────────────
    let pill = want === 'pill' || want === 'any' ? getPill(args.itemId ?? '') : undefined;
    let herb = !pill && (want === 'herb' || want === 'any') ? getHerb(args.itemId ?? '') : undefined;
    let artifact =
        !pill && !herb && (want === 'artifact' || want === 'any')
            ? getArtifact(args.itemId ?? '')
            : undefined;
    let how = asked !== undefined ? `catalog id "${args.itemId}"` : '';

    // What a description narrowed the catalog to, kept out here so the refusal
    // below can list the same near misses the match was chosen from.
    let described: WhatWasDescribed | null = null;
    let narrowed: CatalogRow[] = [];

    if (!pill && !herb && !artifact && args.name) {
        const named = args.name;

        // WHICH OF THE TWO THIS IS, DECIDED BY A CLOSED SET
        described = readAnItemDescription(named);
        const isADescription = described.grades.length > 0 || described.kinds.length > 0;

        if (!isADescription) {
            const whole = everyItemRow()
                .filter(row => want === 'any' || row.kind === want)
                .map(row => ({ row, score: matchScore(named, row.name) }))
                .sort((a, b) => b.score - a.score);
            if (whole.length > 0 && whole[0].score >= MATCH_THRESHOLD) {
                const hit = whole[0].row;
                if (hit.kind === 'pill') pill = getPill(hit.id);
                else if (hit.kind === 'herb') herb = getHerb(hit.id);
                else artifact = getArtifact(hit.id);
                how = `named "${named}" and matched to the catalog at ${whole[0].score}/100`;
            }
            narrowed = whole.map(w => w.row);
            described = null;
        }

        if (!pill && !herb && !artifact && described !== null) {
            const kinds = described.kinds.length > 0
                ? described.kinds
                : want === 'any' ? [] : [want as 'pill' | 'herb' | 'artifact'];

            narrowed = everyItemRow()
                .filter(row => kinds.length === 0 || kinds.includes(row.kind))
                .filter(row => described!.grades.length === 0
                    || (row.grade !== null && described!.grades.includes(row.grade)));

            const scored = narrowed
                .map(row => ({ row, score: howWellItAnswers(described!, row) }))
                .sort((a, b) => b.score - a.score);

            // A WHOLE WORD, OR NOTHING. The bar is that every free word in the
            // description is in the row's own name or id, and that no second row
            // answers as well - two rows tied on the same words is an ambiguity and
            // this surface refuses those rather than picking, the same rule the
            // sentence reader follows. Under the bar, the pool is listed instead,
            // which is the useful answer: "these seven are what chaos-grade pills
            // there are" teaches the catalog.
            const clear = scored.length > 0
                && scored[0].score >= 100
                && (scored.length === 1 || scored[1].score < 100);
            if (clear) {
                const hit = scored[0].row;
                if (hit.kind === 'pill') pill = getPill(hit.id);
                else if (hit.kind === 'herb') herb = getHerb(hit.id);
                else artifact = getArtifact(hit.id);
                how =
                    `described as "${named}", read as ` +
                    [
                        described.kinds.length > 0 ? `kind ${described.kinds.join('/')}` : null,
                        described.grades.length > 0 ? `grade ${described.grades.join('/')}` : null,
                        described.words.length > 0 ? `name word(s) "${described.words.join(' ')}"` : null
                    ].filter(Boolean).join(', ') +
                    `, and resolved to the one row that answers all of it: ${hit.id}`;
            } else {
                // Ordered for the refusal, so the near misses it prints are the
                // ones this actually weighed rather than the head of a catalog.
                narrowed = scored.map(s => s.row);
            }
        }
    }

    if (!pill && !herb && !artifact && args.ordinal !== undefined) {
        if (want === 'pill' || want === 'herb') {
            return guidingError(
                'not_on_the_ladder',
                `A ${want} is graded 1-9, not rated on the realm ladder, so ordinal=${args.ordinal} does not ` +
                `name one. Only an artifact has a rung.`,
                {
                    hint:
                        `ADMIN grant_item kind=artifact ordinal=${args.ordinal} grants the nearest rated object. ` +
                        'For a pill or a herb, pass itemId= or name=.'
                }
            );
        }
        const nearest = artifactNearest(args.ordinal);
        if (nearest) {
            artifact = nearest.record;
            how =
                nearest.gap === 0
                    ? `catalogued at ordinal ${args.ordinal} exactly`
                    : `nearest catalogued object to ordinal ${args.ordinal}; it is rated ` +
                      `${nearest.record.power}, ${nearest.gap} rung(s) away. The catalog is authored ` +
                      'and has no entry at every rung.';
        }
    }

    if (!pill && !herb && !artifact) {
        // A REFUSAL LISTS THE CANDIDATES IT WEIGHED
        const nearMisses = (narrowed.length > 0
            ? narrowed
            : everyItemRow().filter(row => want === 'any' || row.kind === want)
        ).slice(0, 8);
        const spelled = nearMisses.map(row =>
            `ADMIN grant_item itemId=${row.id}` +
            `   (${row.name}${row.grade ? `, ${row.grade} grade` : ''}` +
            `${row.power !== null ? `, rated ${row.power}` : ''})`
        );
        const narrowing = described === null ? null : {
            gradesRead: described.grades,
            kindsRead: described.kinds,
            nameWordsLeft: described.words,
            wordsDropped: described.dropped,
            narrowedTo: narrowed.length
        };

        return guidingError(
            'unknown_item',
            asked === undefined && args.ordinal === undefined
                ? 'grant_item needs something to grant: a catalog itemId=, a name=, or - for a rated ' +
                  'object - an ordinal= on the realm ladder.'
                : `Nothing in the pill, herb or artifact catalogs answers to "${asked ?? args.ordinal}"` +
                  (narrowing !== null && narrowing.narrowedTo > 0
                      ? `. ${narrowing.narrowedTo} row(s) match what was read from it` +
                        `${described!.grades.length > 0 ? ` (grade ${described!.grades.join('/')})` : ''}` +
                        `${described!.kinds.length > 0 ? ` (kind ${described!.kinds.join('/')})` : ''}` +
                        (described!.words.length > 0
                            ? `, and none of them is named ${described!.words.map(w => `"${w}"`).join(' or ')}. ` +
                              'Which of them was it?'
                            : ', and nothing in the line says which. Which of them was it?')
                      : '.'),
            {
                asked: asked ?? args.ordinal,
                kind: want,
                readAs: narrowing,
                catalogSizes: { pills: PILLS.length, herbs: HERBS.length, artifacts: ARTIFACTS.length },
                // Named `nearest` so the renderer prints it the way it prints
                // every other list of candidates on this surface.
                nearest: nearMisses.map(row => row.name),
                arrangeInstead: spelled,
                hint:
                    'Admin lifts gates on things that exist. It does not invent items. Copy one of the ' +
                    'lines above, or say it another way: ordinal=45 kind=artifact takes the nearest ' +
                    'rated object to a rung, and name= takes a catalog entry by its own name.'
            }
        );
    }

    const kind = pill ? ('pill' as const) : herb ? ('herb' as const) : ('artifact' as const);
    const id = pill?.id ?? herb?.id ?? artifact!.id;
    // A rated object is singular. Two of the same one is not a thing the world
    // has, and granting 999 of a sent-down blade would be inventing a stock the
    // catalog explicitly does not have - see `HOW_A_FORTY_FIVE_EXISTS`.
    const quantity = kind === 'artifact' ? 1 : args.quantity ?? 1;

    repos.db.transaction(() => {
        addToPouch(repos.db, cultivator.id, id, kind, quantity);
        writeAdminAudit(repos, 'grant_item', run.id, {
            cultivatorId: cultivator.id,
            itemId: id,
            kind,
            quantity,
            selection: how,
            ratedAt: artifact?.power ?? null
        });
    })();

    const carried = carriedArtifact(repos.db, cultivator.id);

    return {
        adminMode: true,
        granted: true,
        item: pill
            ? { kind, id: pill.id, name: pill.name, grade: pill.grade, effect: pill.effect, potency: pill.potency }
            : herb
                ? { kind, id: herb.id, name: herb.name, grade: herb.grade, biome: herb.biome }
                : {
                    kind,
                    id: artifact!.id,
                    name: artifact!.name,
                    ordinal: artifact!.power,
                    rank: artifact!.power === null ? null : rankName(artifact!.power),
                    significance: artifact!.significance,
                    description: artifact!.description
                },
        quantity,
        selection: how,
        cultivatorId: cultivator.id,
        // AGENTS.md: any name the game prints is a name the game must accept.
        // AGENTS.md: any name the game prints is a name the game must accept.
        // For a rated object the only surface that reads it back today is this
        // one, which is why `ADMIN audit_log` is the line offered rather than a
        // player verb that would come back empty.
        sayThis: kind === 'artifact'
            ? ['ADMIN audit_log']
            : ['look in my pouch'],
        carrying: carried
            ? { id: carried.id, name: carried.name, ordinal: carried.power, rank: rankName(carried.power) }
            : null,
        // A RUNG THE WORLD SAYS CANNOT STAY HERE
        aboveTheCeiling: kind === 'artifact' && (artifact!.power ?? 0) > OBJECT_CEILING_BELOW_THE_LID
            ? {
                ceiling: OBJECT_CEILING_BELOW_THE_LID,
                ratedAt: artifact!.power,
                theWorldSays:
                    'Nothing rated above the ceiling can be held below the Lid. It should go up, and ' +
                    'take whoever is holding it, inside ten to fifteen breaths.',
                whatActuallyHappens:
                    'It stays. evaluateLayerCrossing is the rule and its only caller is the world ' +
                    'simulation, for NPC descents - nothing reads what a PLAYER carries. This is a ' +
                    'gap in the world, not in ADMIN, and it is reported rather than papered over.'
            }
            : null,
        // ── WHAT IT IS WORTH, AND WHO SAYS SO ─────────────────────────────
        worthInAFight: kind === 'artifact'
            ? {
                enginePrice: 'CombatantInput.weapon.power - a second body of that rank beside you',
                readBy:
                    'combatantFromCultivator in combat-manage.ts, through carriedArtifact; the ' +
                    'same field bestObjectHeldBy fills for an NPC, priced by the same resolver',
                consequence:
                    'The object is really in cultivator_pouch, it is really priced in the next ' +
                    'fight, and it can really be broken there - swung far under the rung it is ' +
                    'swung into, it comes apart, by the ordinary rule and not by one written for ' +
                    'a granted thing. What the grant does NOT do is touch the world register: the ' +
                    'house that owns it still owns it, which is what carrying somebody else\'s ' +
                    'artifact is.'
            }
            : null,
        runFlagged: true,
        note: kind === 'artifact'
            ? 'A real catalogued object, chosen from the artifact table and not invented, in the real ' +
              'pouch. Quantity is 1 whatever was asked for: a rated object is singular and the catalog ' +
              'has no stock of one. Nothing about who is entitled to carry it was checked, which is the ' +
              'gate ADMIN lifted; nothing about what it does was asserted.'
            : undefined
    };
}

export async function handleSetAmbient(args: z.infer<typeof SetAmbientSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('set_ambient');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const day = Math.floor(run.elapsedDays);
    const base = cultivator.location ?? 'the open road';

    // Ambient qi is a pure function of (seed, place, day). The honest way to
    // change it is therefore to change the place - and to a place the engine
    // really does compute this band for, not to a claim about the old one.
    const alias = aliasForAmbient(run.seed, base, day, args.band as AmbientQi);
    if (!alias) {
        return guidingError(
            'ambient_alias_not_found',
            `No aliased site near "${base}" derives ${args.band} on this block. The search is bounded on purpose.`,
            { band: args.band, location: base, day }
        );
    }

    const blockEnd = Math.floor(day / AMBIENT_BLOCK_DAYS) * AMBIENT_BLOCK_DAYS + AMBIENT_BLOCK_DAYS - 1;

    repos.db.transaction(() => {
        repos.db.prepare(`
            INSERT INTO ambient_aliases (run_id, location, alias, band, from_day, to_day)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(run.id, base, alias, args.band, day, blockEnd);
        writeAdminAudit(repos, 'set_ambient', run.id, {
            cultivatorId: cultivator.id,
            location: base,
            alias,
            band: args.band,
            fromDay: day,
            toDay: blockEnd
        });
    })();

    return {
        adminMode: true,
        set: true,
        location: base,
        alias,
        band: args.band,
        fromDay: day,
        toDay: blockEnd,
        note:
            'The gate lifted is "you must happen to be somewhere with this band". The band itself is still ' +
            `derived by the engine from (seed, "${alias}", day) - it was found, not declared. It holds for ` +
            'this 30-day ambient block only, then the world goes back to being what it is.',
        runFlagged: true
    };
}

export async function handleSetLocation(args: z.infer<typeof SetLocationSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('set_location');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const from = cultivator.location;

    // ── The destination has to be somewhere. ──────────────────────────────
    const gazetteer = await gazetteerFor(repos, run);
    const found = lookUpPlace(args.location, gazetteer);
    if (!found.canonical) {
        return guidingError(
            'unknown_place',
            `"${args.location}" is not a place. The map has no entry for it under that name or ` +
            'anything close enough to be sure of.',
            {
                asked: args.location,
                nearest: found.nearest,
                gazetteerSize: gazetteer.names.length,
                registers: gazetteer.sources,
                hint:
                    found.nearest.length > 0
                        ? `Did you mean one of: ${found.nearest.join(', ')}? Names are matched with ` +
                          'or without a leading "the", and a multi-word name needs no quoting.'
                        : 'ADMIN lifts content gates, not truth. It moves the cultivator to somewhere ' +
                          'that exists; it does not invent a location. The region catalog is the ' +
                          'authority and it is present whether or not the world driver is running.'
            }
        );
    }

    const to = found.canonical;
    const renamed = loosePlaceKey(to) !== loosePlaceKey(args.location) || to !== args.location.trim();

    const updated = repos.db.transaction(() => {
        const result = repos.cultivators.update(cultivator.id, { location: to });
        writeAdminAudit(repos, 'set_location', run.id, {
            cultivatorId: cultivator.id,
            from,
            asked: args.location,
            to
        });
        return result;
    })();

    return {
        adminMode: true,
        moved: true,
        from,
        to,
        asked: args.location,
        // Stored under the gazetteer's spelling, not the operator's, so every
        // later lookup - ambient, ground standing, who is co-located - joins.
        normalised: renamed,
        cultivator: updated ? describeCultivator(repos, updated, run) : null,
        runFlagged: true,
        note:
            'Checked against the region catalog, the world\'s own locations and everywhere somebody ' +
            'is standing. No travel time passed and nothing on the road happened: this is a ' +
            'placement, not a journey, and it is in the audit log as one.'
    };
}

export async function handleAdvanceDays(
    args: z.infer<typeof AdvanceDaysSchema>
): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('advance_days');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;

    // A span is the one argument this action cannot default. Zero is not a
    // sensible "advance nothing", and guessing a length would be picking how
    // much of somebody's life to spend.
    if (args.days === undefined && args.months === undefined && args.years === undefined) {
        return guidingError(
            'no_span_given',
            'advance_days needs a span. Nothing was advanced.',
            {
                hint:
                    'Any one of these, and they add:\n' +
                    '  ADMIN advance_days days=30\n' +
                    '  ADMIN advance_days years=50 rations=2000\n' +
                    'Unprovisioned, a body gets about fifty turns before the belly empties and the ' +
                    'simulation stops - that is truth, not a clamp, and rations=N is how you pay ' +
                    'for the span rather than lift it.'
            }
        );
    }

    // ONE SPAN, AS MANY STRETCHES AS IT TAKES
    const totals = {
        requested: null as number | null,
        simulated: 0,
        injuries: [] as unknown[],
        events: [] as Record<string, unknown>[]
    };
    const stretches: { days: number; reason: string | null }[] = [];
    let carriedRations = 0;
    let last: Record<string, unknown> | null = null;
    let failed: object | null = null;

    for (let stretch = 0; stretch < MAX_ADVANCE_STRETCHES; stretch += 1) {
        const first = stretch === 0;
        const remaining = totals.requested === null
            ? null
            : Math.max(0, totals.requested - totals.simulated);
        if (remaining !== null && remaining < 1) break;

        const leg = await handleCultivate({
            action: 'cultivate',
            cultivatorId: cultivator.id,
            // The first stretch is the span as the operator wrote it, so the
            // engine does the days/months/years arithmetic once and this side
            // never keeps a second copy of it. Every stretch after is whatever
            // is left of what the engine said it was asked for.
            ...(first
                ? { days: args.days, months: args.months, years: args.years }
                : { days: remaining! }),
            focus: 'idle',
            // Bought once. Food is charged per stretch, so what is left in the
            // pack is carried rather than re-bought - the rule
            // `src/web/README.md` states for the seclusion crossroads, applied
            // here for the same reason.
            rations: first ? args.rations ?? 0 : 0,
            carriedRations: first ? 0 : carriedRations,
            autoBreakthrough: false,
            randomEvents: false
        } as Parameters<typeof handleCultivate>[0]);

        if (isGuidingErrorBody(leg)) {
            // A refusal on the first stretch is the operator's answer. A
            // refusal partway is not - the stretches already run are real and
            // stay - so it is reported beside them rather than instead of them.
            if (first) { failed = leg; break; }
            stretches.push({ days: 0, reason: 'refused' });
            break;
        }

        const legBody = leg as Record<string, unknown>;
        last = legBody;
        if (totals.requested === null && typeof legBody.requestedDays === 'number') {
            totals.requested = legBody.requestedDays;
        }
        const legDays = typeof legBody.simulatedDays === 'number' ? legBody.simulatedDays : 0;
        const legReason = typeof legBody.interruptReason === 'string' ? legBody.interruptReason : null;
        // Event offsets are relative to the stretch that produced them. Rebased
        // onto the whole span, because a digest whose day numbers restart at
        // zero three times over is worse than no digest.
        const base = totals.simulated;
        for (const event of (Array.isArray(legBody.events) ? legBody.events : []) as Record<string, unknown>[]) {
            const offset = typeof event.dayOffset === 'number' ? event.dayOffset : 0;
            totals.events.push({
                ...event,
                dayOffset: base + offset,
                yearOffset: Math.round(((base + offset) / DAYS_PER_YEAR) * 100) / 100
            });
        }
        if (Array.isArray(legBody.injuriesSustained)) totals.injuries.push(...legBody.injuriesSustained);
        totals.simulated += legDays;
        carriedRations = typeof legBody.rationsRemaining === 'number' ? legBody.rationsRemaining : 0;
        stretches.push({ days: legDays, reason: legReason });

        if (totals.requested !== null && totals.simulated >= totals.requested) break;
        if (!isResumableInterrupt(legReason)) break;
        // A stretch that moved nothing will move nothing next time either.
        // Never spin on one.
        if (legDays <= 0) break;
    }

    writeAdminAudit(repos, 'advance_days', run.id, {
        cultivatorId: cultivator.id,
        days: args.days,
        months: args.months,
        years: args.years,
        rations: args.rations ?? 0,
        stretches,
        result: failed ?? { advanced: true, simulatedDays: totals.simulated }
    });

    if (failed) return failed;
    if (last === null) return guidingError(
        'nothing_to_advance',
        'The span resolved to no days at all. Nothing was advanced.',
        { hint: 'ADMIN advance_days days=30' }
    );

    // THE SPAN THAT WAS ASKED FOR AND THE SPAN THAT HAPPENED
    const requested = totals.requested;
    const simulated = totals.simulated;
    const reason = typeof last.interruptReason === 'string' ? last.interruptReason : null;
    const short = requested !== null && simulated < requested;
    // Only the ones that actually stopped a stretch and were carried on past.
    // The last stretch's reason is what STOPPED the span and is not one of them.
    const resumedPast = stretches
        .slice(0, -1)
        .map(s => s.reason)
        .filter((r): r is string => r !== null);

    return {
        adminMode: true,
        advanced: true,
        // The last stretch's shape, then every field it can only speak for
        // itself about put back as the whole span's. A `simulatedDays` that
        // reports the tail of a century is the same defect this action already
        // had once, one level in.
        ...last,
        requestedDays: requested,
        simulatedDays: simulated,
        simulatedYears: Math.round((simulated / DAYS_PER_YEAR) * 100) / 100,
        stoppedEarly: short,
        injuriesSustained: totals.injuries,
        events: totals.events,
        // What it drove through, in order, so the shortfall is auditable rather
        // than asserted. One entry is the ordinary case.
        stretches,
        resumedPast,
        stoppedShort: short
            ? {
                requestedDays: requested,
                simulatedDays: simulated,
                unsimulatedDays: requested! - simulated,
                reason,
                explanation: explainInterrupt(reason),
                limit: interruptLimitFor(reason),
                // THE LINE THAT WOULD HAVE WORKED, WITH ITS NUMBER IN IT. "Pass
                // rations=N" left the operator to work N out, and N is a division
                // this side already has both terms of. A refusal that names what
                // would work should name it exactly.
                tryThis: reason === 'provisions_exhausted' || reason === 'starvation_begun'
                    ? provisioningLine(repos, cultivator.id, requested!)
                    : reason === 'iteration_limit'
                        ? 'ADMIN advance_days again for the rest of the span; the ceiling is per call.'
                        : null
            }
            : null,
        note: (short
            ? `The span asked for was ${requested} day(s) and ${simulated} were simulated. ` +
              `${explainInterrupt(reason)} This is not a clamp on how much time ADMIN may advance - ` +
              'it is the simulation refusing to run past something that happened. '
            : 'The whole span asked for was simulated; nothing was skipped except the gain. ') +
            'Time was advanced through simulateTimeSkip at idle focus: no cultivation progress, but ' +
            'real aging, real hunger, real stagnation and real death checks. No qi deviation - that ' +
            'is the price of drawing qi, and a body that is not draws no wounds out of the air.' +
            (resumedPast.length > 0
                ? ` Carried on past ${resumedPast.length} interrupt(s) that hand a PLAYER control back ` +
                  `and do not stop an operator: ${resumedPast.join(', ')}.`
                : ''),
        runFlagged: true
    };
}

/**
 * How many stretches one `advance_days` will drive before it stops.
 */
const MAX_ADVANCE_STRETCHES = 64;

/**
 * Whether an interrupt is a bulletin an operator may be carried past.
 */
function isResumableInterrupt(reason: string | null): boolean {
    if (reason === null) return false;
    if (reason.startsWith('death:')) return false;
    // A survivable failure that was wounding enough to interrupt. It happened
    // and it is in the digest; there is nothing for an operator to decide.
    if (reason.startsWith('breakthrough_')) return true;
    return reason === 'lethal_injury_threshold'
        || reason === 'major_encounter'
        || reason === 'toll_charged'
        || reason === 'iteration_limit';
}

/**
 * How many rations cover a span, so the refusal can print the number.
 */
function rationsForDays(days: number): number {
    return Math.max(1, Math.ceil(days / ACTIONS_PER_FULL_SATIETY));
}

/**
 * The provisioning line, priced against the purse that would have to pay it.
 */
function provisioningLine(repos: CultivationRepos, cultivatorId: string, days: number): string {
    const needed = rationsForDays(days);
    const cost = needed * RATION_COST_STONES;
    const held = repos.cultivators.getById(cultivatorId)?.spiritStones ?? 0;
    const command = `ADMIN advance_days days=${days} rations=${needed}`;
    if (cost <= held) return command;
    return `${command} - which costs ${cost} spirit stones against the ${held} in the purse, so it ` +
        'will be refused as it stands. Provisions are bought and ADMIN does not lift that; a shorter ' +
        'span, or a rung whose body eats less, is what fits the money.';
}

/**
 * What stopped the span, in a sentence.
 */
function explainInterrupt(reason: string | null): string {
    if (reason === null) return 'The simulation stopped without recording a reason, which is itself worth a look.';
    if (reason.startsWith('death:')) {
        return `The cultivator died (${reason.slice('death:'.length)}) and the run closed. Time stops there.`;
    }
    if (reason.startsWith('breakthrough_')) {
        return `A breakthrough resolved (${reason.slice('breakthrough_'.length)}) and it was wounding enough to stop the span.`;
    }
    switch (reason) {
        case 'provisions_exhausted':
            return 'The provisions ran out. Pass rations=N to buy N rations up front, at the ordinary price out of the ordinary purse - unprovisioned, a body gets about fifty turns. The line printed under this one has the figure in it.';
        case 'starvation_begun':
            return 'The belly emptied and starvation began. Pass rations=N to provision the span; the line printed under this one has the figure in it.';
        case 'hostile_ground':
            return 'The ground where the cultivator is standing is killing them. Move somewhere survivable first with ADMIN set_location.';
        case 'lethal_injury_threshold':
            // The name is the engine's and is older than the ruling. Open channels
            // are not fatal any more - `engine/cultivation/README.md` records the
            // retirement - so this says what is actually true: the body has stopped
            // coping, and it does not improve on its own.
            return 'Untreated meridian wounds reached the count at which the body stops coping. ' +
                'Nothing about it is fatal and nothing about it heals on its own - a physician or a ' +
                'healing pill is what closes them.';
        case 'major_encounter':
            return 'Somebody walked in. The span stops so the encounter can be played.';
        case 'toll_charged':
            return 'The Price of Advancement fell due at a realm boundary and was charged.';
        case 'iteration_limit':
            return `The simulation reached its own hard ceiling of ${MAX_SIMULATION_CHUNKS.toLocaleString('en')} chunks in one call. This one IS a limit, it exists so a single call cannot hang the process, and the way past it is to call advance_days again.`;
        default:
            return `The simulation reported "${reason}".`;
    }
}

/**
 * The hard chunk ceiling inside `simulateTimeSkip`, restated here only so the
 * one interrupt that genuinely IS a limit can name its own number.
 */
const MAX_SIMULATION_CHUNKS = 100_000;

/** The numeric limit behind a reason, where one exists. Null where none does. */
function interruptLimitFor(reason: string | null): number | null {
    return reason === 'iteration_limit' ? MAX_SIMULATION_CHUNKS : null;
}

/**
 * Fill the accumulator the engine already reads, and roll nothing.
 */
export async function handleGrantProgress(
    args: z.infer<typeof GrantProgressSchema>
): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('grant_progress');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const required = progressRequiredForOrdinal(cultivator.realmOrdinal);

    if (required === null) {
        return guidingError(
            'not_denominated_in_qi',
            `${cultivator.name} stands at ${rankName(cultivator.realmOrdinal)}. Whatever is above ` +
            'this is not bought with qi, and there is no amount of this currency that would do.',
            {
                ordinal: cultivator.realmOrdinal,
                hint:
                    'Above the Lid the progress ladder returns null rather than a number, because a ' +
                    'figure here would be a lie with a lot of digits in it. Nothing to grant.'
            }
        );
    }

    const before = cultivator.cultivationProgress;
    const wantsFill = args.fill === true || args.amount === undefined;
    const amount = wantsFill ? Math.max(0, required - before) : args.amount!;

    if (amount <= 0) {
        return guidingError(
            'already_at_the_bar',
            `${cultivator.name} already holds ${before} of the ${required} qi-units the attempt from ` +
            `${rankName(cultivator.realmOrdinal)} needs.`,
            { progress: before, required, hint: 'Pass amount=N to add anyway.' }
        );
    }

    const updated = repos.db.transaction(() => {
        const result = repos.cultivators.update(cultivator.id, {
            cultivationProgress: before + amount
        });
        writeAdminAudit(repos, 'grant_progress', run.id, {
            cultivatorId: cultivator.id,
            ordinal: cultivator.realmOrdinal,
            before,
            granted: amount,
            after: before + amount,
            required,
            mode: wantsFill ? 'fill_to_the_bar' : 'explicit_amount'
        });
        return result;
    })();

    // Read back through the engine's own eligibility check. Reported, never
    // acted on: whether the attempt is legal is the engine's answer and this
    // action does not attempt anything.
    const after = updated ?? cultivator;
    const eligibility = canAttemptBreakthrough(after);

    return {
        adminMode: true,
        granted: true,
        ordinal: after.realmOrdinal,
        rank: rankName(after.realmOrdinal),
        progressBefore: before,
        progressGranted: amount,
        progressAfter: after.cultivationProgress,
        progressRequired: required,
        mode: wantsFill ? 'fill_to_the_bar' : 'explicit_amount',
        eligibility: {
            eligible: eligibility.eligible,
            reason: eligibility.eligible ? null : eligibility.reason,
            progressAvailable: eligibility.progressAvailable,
            progressRequired: eligibility.progressRequired,
            daoRequired: eligibility.daoRequired,
            daoHeld: eligibility.daoHeld
        },
        runFlagged: true,
        note:
            'Qi-units were added to the accumulator through CultivatorRepository.update. NO BREAKTHROUGH ' +
            'WAS ROLLED AND NONE IS CLAIMED: the eligibility above is a read of what the engine now ' +
            'thinks, and the attempt itself still has to be made and can still fail or kill. Nothing ' +
            'else moved - not the rung, not the peak, not the stagnation clock, not the foundation.'
    };
}

export async function handleSetRealm(args: z.infer<typeof SetRealmSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('set_realm');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const from = cultivator.realmOrdinal;
    const delta = args.ordinal - from;

    if (delta === 0) {
        return guidingError(
            'already_at_ordinal',
            `${cultivator.name} already stands at ${rankName(from)}.`,
            { ordinal: from }
        );
    }

    // THE RUNG AND THE CROSSING ARE TWO SEPARATE FACTS
    const status =
        args.ordinal === TRUE_IMMORTAL_ORDINAL
            ? ('true_immortal' as const)
            : args.ordinal === FALSE_IMMORTAL_ORDINAL
                ? ('false_immortal' as const)
                : null;
    const statusBefore = cultivator.immortalStatus;

    const updated = repos.db.transaction(() => {
        // The same road every rank change takes: peak_ordinal is stamped,
        // accumulated progress is cleared, the stagnation clock restarts.
        let result = repos.cultivators.advanceRealm(cultivator.id, delta);
        // `recordImmortalStatus` refuses to overwrite a status already held, so
        // somebody who genuinely crossed keeps the crossing they made.
        if (status !== null && statusBefore === 'none') {
            result = repos.cultivators.recordImmortalStatus(cultivator.id, status) ?? result;
        }
        writeAdminAudit(repos, 'set_realm', run.id, {
            cultivatorId: cultivator.id,
            fromOrdinal: from,
            toOrdinal: args.ordinal,
            delta,
            immortalStatusBefore: statusBefore,
            immortalStatusWritten: status !== null && statusBefore === 'none' ? status : null,
            via: 'CultivatorRepository.advanceRealm'
        });
        return result;
    })();

    const runAfter = repos.runs.getById(run.id)!;
    const statusWritten = status !== null && statusBefore === 'none' ? status : null;

    return {
        adminMode: true,
        set: true,
        fromOrdinal: from,
        fromRank: rankName(from),
        toOrdinal: args.ordinal,
        toRank: rankName(args.ordinal),
        progressCleared: true,
        stagnationClockReset: true,
        peakOrdinal: runAfter.peakOrdinal,
        immortalStatus: updated?.immortalStatus ?? statusBefore,
        immortalStatusWritten: statusWritten,
        cultivator: updated ? describeCultivator(repos, updated, runAfter) : null,
        runFlagged: true,
        note:
            'No breakthrough was rolled and none is claimed. This is a bookkeeping write through ' +
            'advanceRealm, it is in the audit log, and this run is excluded from the death ledger.' +
            (statusWritten
                ? ` The two rungs above the Lid are the two landings of one crossing, so immortalStatus ` +
                  `was set to "${statusWritten}" in the same transaction: a rung without a status is a ` +
                  'state the engine has no reading for, and everything downstream misreads it. NO ' +
                  'CROSSING WAS ATTEMPTED AND NONE IS CLAIMED - the tribulation was not rolled, ' +
                  'nothing was survived, and the ledger of what a crossing takes away is empty ' +
                  'because nothing was taken.'
                : '')
    };
}

export async function handleSetAge(args: z.infer<typeof SetAgeSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('set_age');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const from = cultivator.age;
    const wanted = Math.round(args.age);
    const span = effectiveLifespanYears(cultivator.realmOrdinal, cultivator.immortalStatus ?? 'none');

    if (wanted === from) {
        return guidingError(
            'already_that_age',
            `${cultivator.name} is already ${from}.`,
            { age: from, lifespanYears: span }
        );
    }

    // AN AGE PAST THE SPAN IS A CORPSE, NOT AN ARRANGEMENT
    const immortal = cultivator.immortalStatus === 'true_immortal';
    if (!immortal && wanted >= span) {
        return guidingError(
            'past_the_span_of_that_rung',
            `${rankName(cultivator.realmOrdinal)} carries ${span} years and ${wanted} is past it. ` +
            'That is not an age, it is a death by old age that has not been asked about yet.',
            {
                asked: wanted,
                age: from,
                ordinal: cultivator.realmOrdinal,
                rank: rankName(cultivator.realmOrdinal),
                lifespanYears: span,
                overBy: wanted - span + 1,
                arrangeInstead: [
                    'ADMIN set_realm ordinal=<higher rung> - a rung buys span, and the age then fits.',
                    'ADMIN advance_days years=<n> - if the point is to die of it, time is what does that, ' +
                    'and the survival check says so in its own words.'
                ],
                hint: 'ADMIN sets preconditions. Death is truth, so it is reached by dying.'
            }
        );
    }

    const updated = repos.db.transaction(() => {
        // The same road every aging write takes. `applyDeltas` clamps at zero
        // and re-parses through the schema, so nothing here can store an age
        // the contract would reject.
        const result = repos.cultivators.applyDeltas(cultivator.id, { age: wanted - from });
        writeAdminAudit(repos, 'set_age', run.id, {
            cultivatorId: cultivator.id,
            fromAge: from,
            toAge: wanted,
            delta: wanted - from,
            ordinal: cultivator.realmOrdinal,
            lifespanYears: span,
            via: 'CultivatorRepository.applyDeltas'
        });
        return result;
    })();

    const runAfter = repos.runs.getById(run.id)!;
    return {
        adminMode: true,
        set: true,
        fromAge: from,
        toAge: updated?.age ?? wanted,
        lifespanYears: span,
        yearsLeft: span - (updated?.age ?? wanted),
        rank: rankName(cultivator.realmOrdinal),
        cultivator: updated ? describeCultivator(repos, updated, runAfter) : null,
        runFlagged: true,
        note:
            'One number moved, through the repository\'s own delta path, and nothing else did. NO ' +
            'LIFE WAS LIVED AND NONE IS CLAIMED: the years between are years in which nothing ' +
            'happened - no wounds, no hunger, no stagnation, no world. ADMIN advance_days is the ' +
            'action that actually spends a life, with every check the engine runs on one.'
    };
}

/**
 * Every place, or every house, or one of either, made nameable.
 */
export async function handleGrantKnowledge(
    args: z.infer<typeof GrantKnowledgeSchema>
): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('grant_knowledge');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, {});
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const want = args.kind ?? 'any';
    const onDay = Math.max(0, Math.floor(run.elapsedDays));
    const knowledge = new KnowledgeGate(repos.db);

    // ── WHAT THERE IS TO KNOW ─────────────────────────────────────────────
    //
    // Places come from the authored region catalog, which is present in every
    // configuration, plus the generated world's own locations when a world is
    // running - the same two registers `gazetteerFor` reads, and for the same
    // reason. Houses come from the sect catalog.
    const entries: Array<{ kind: 'place' | 'sect'; id: string; name: string }> = [];
    if (want === 'place' || want === 'any') {
        for (const region of REGIONS) {
            entries.push({ kind: 'place', id: region.name, name: region.name });
            for (const place of region.places) {
                entries.push({ kind: 'place', id: place.name, name: place.name });
            }
        }
        try {
            const world = await worldForRun(run as never);
            for (const location of world.locations) {
                entries.push({ kind: 'place', id: location.id, name: location.name });
            }
        } catch {
            // No world driver is a real configuration, not a failure. The
            // authored catalog still holds.
        }
    }
    if (want === 'sect' || want === 'any') {
        for (const sect of SECTS) entries.push({ kind: 'sect', id: sect.id, name: sect.name });
    }

    // ── ONE, WHEN ONE WAS NAMED ───────────────────────────────────────────
    let chosen = entries;
    let how = want === 'any' ? 'every place and every house' : `every ${want}`;
    if (args.name) {
        const scored = entries
            .map(entry => ({ entry, score: matchScore(args.name!, entry.name) }))
            .sort((a, b) => b.score - a.score);
        if (scored.length === 0 || scored[0].score < MATCH_THRESHOLD) {
            return guidingError(
                'nothing_of_that_name',
                `Nothing in the ${want === 'any' ? 'place or house' : want} catalogs answers to "${args.name}".`,
                {
                    asked: args.name,
                    nearest: scored.slice(0, 5).map(s => s.entry.name),
                    hint:
                        'ADMIN reveals what exists; it does not author. Omit name= to be given ' +
                        'everything, or kind=place / kind=sect for one register.'
                }
            );
        }
        chosen = [scored[0].entry];
        how = `named "${args.name}" and matched to the catalog at ${scored[0].score}/100`;
    }

    let learned = 0;
    const alreadyHeld: string[] = [];
    repos.db.transaction(() => {
        for (const entry of chosen) {
            const isNew = knowledge.learnIfNew({
                holderId: cultivator.id,
                kind: entry.kind,
                id: entry.id,
                name: entry.name,
                onDay,
                // The honest source: somebody told them. It is what the
                // discovery system already uses for being told, and it is what
                // actually happened - an operator said the name in front of
                // this cultivator. The note carries the rest.
                sourceKind: 'told',
                // AND `placed`, WHICH IS WHERE THE ACTION MEANT TO PUT THEM
                stage: 'placed',
                sourceNote:
                    'ADMIN lifted the awareness gate. Nothing about admission, standing or what ' +
                    'anybody there will do was granted.',
                statement: `${entry.name} exists and can be named.`
            });
            if (isNew) learned++;
            else if (alreadyHeld.length < 5) alreadyHeld.push(entry.name);
        }
        writeAdminAudit(repos, 'grant_knowledge', run.id, {
            cultivatorId: cultivator.id,
            kind: want,
            selection: how,
            offered: chosen.length,
            learned
        });
    })();

    return {
        adminMode: true,
        granted: true,
        knowledge: true,
        kind: want,
        selection: how,
        offered: chosen.length,
        learned,
        alreadyHeld: chosen.length - learned,
        examples: chosen.slice(0, 8).map(e => e.name),
        sayThis: want === 'sect'
            ? ['what sects are there', 'tell me about <a house by name>']
            : ['where can I go', 'travel to <a place by name>'],
        runFlagged: true,
        note:
            'The AWARENESS gate was lifted and nothing else was. These places and houses already ' +
            'existed with their own admission bars, trial requirements and opinions; what changed is ' +
            'whether this cultivator may say their names. Knowing the name of an apex does not open ' +
            'its door. Written as ordinary knowledge rows through learnIfNew, so every gated read ' +
            'sees them exactly as it sees any other - there is no admin-knows-everything flag, on ' +
            'purpose, because a flag that read as knowledge would be a second source of truth.'
    };
}

export async function handleAuditLog(args: z.infer<typeof AuditLogSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('audit_log');
    const repos = ensureCultivationDb();
    const run = args.runId ? repos.runs.getById(args.runId) : repos.runs.getActiveRun();

    return {
        adminMode: true,
        runId: run?.id ?? null,
        runFlagged: run ? isAdminRun(repos.db, run.id) : false,
        entries: adminAuditTrail(repos.db, run?.id ?? null, args.limit ?? 50),
        note: 'These rows are the admin flag. run_manage.ledger reads them to exclude these runs.'
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

// ALIASES ARE THE CHEAPEST FIX ON THIS SURFACE
const definitions: Record<AdminAction, ActionDefinition> = {
    roster: {
        schema: RosterSchema,
        handler: handleRoster,
        aliases: ['world', 'everyone', 'all_cultivators', 'who', 'people', 'list'],
        description: 'READ. Lists every cultivator that exists right now - name, rung, root, sect, where they are standing, alive or dead. Writes nothing. Use it to find an id, or to see what the world is holding.'
    },
    spawn_encounter: {
        schema: SpawnEncounterSchema,
        handler: handleSpawnEncounter,
        aliases: [
            'encounter', 'spawn_enemy', 'spawn_npc', 'spawn_person',
            'spawn_cultivator', 'npc', 'enemy', 'opponent', 'stage_encounter'
        ],
        description: 'CREATES A PERSON. A real, persisted NPC cultivator at any strength you name, standing where the player is standing unless told otherwise, with spirit root and attributes rolled from the run seed and advanced through advanceRealm like anybody else. This is the action for "put an X in front of me" - a fight, a conversation, a threat. It does NOT create a place; that is spawn_site.'
    },
    spawn_site: {
        schema: SpawnSiteSchema,
        handler: handleSpawnSite,
        aliases: ['site', 'spawn_grave', 'grave', 'reveal_site', 'reveal', 'tomb', 'trial'],
        description: 'REVEALS A PLACE. Makes an existing catalogued grave or trial nameable by this cultivator - it lifts the awareness gate and nothing else, so the strength bar, the comprehension bar and every claim condition inside still stand and still refuse. It does NOT put a person in front of you; that is spawn_encounter.'
    },
    grant_item: {
        schema: GrantItemSchema,
        handler: handleGrantItem,
        aliases: [
            'grant', 'give_item', 'give', 'item', 'grant_artifact',
            'give_weapon', 'weapon', 'artifact'
        ],
        description: 'GIVES AN OBJECT. Puts a real catalog pill, herb or rated artifact into the real pouch. Ask by catalog id, by the name the catalog prints, or - for an artifact - by the rung it is rated at, which is how "a 45 weapon" is said. Invents nothing: a miss is refused with what actually exists.'
    },
    set_ambient: {
        schema: SetAmbientSchema,
        handler: handleSetAmbient,
        aliases: ['ambient', 'set_qi', 'qi', 'band', 'set_band'],
        description: 'CHANGES THE AIR. Finds a place near the cultivator that the engine genuinely derives the requested ambient qi band for, and stands them in it for this 30-day block. The band is found, never declared. Use it to test cultivation rate, breakthrough odds or hostile ground.'
    },
    set_location: {
        schema: SetLocationSchema,
        handler: handleSetLocation,
        aliases: ['move', 'teleport', 'relocate', 'go', 'travel', 'goto', 'stand'],
        description: 'MOVES THE PLAYER. Places the cultivator at a named location that is really on the map - checked against the region catalog, the world\'s own locations, and everywhere somebody is standing. No travel time passes and nothing happens on the road. Refuses a place that does not exist.'
    },
    advance_days: {
        schema: AdvanceDaysSchema,
        handler: handleAdvanceDays,
        aliases: ['advance', 'skip_time', 'fast_forward', 'wait', 'time', 'age', 'skip', 'days', 'years'],
        description: 'PASSES TIME. Runs real in-world time through simulateTimeSkip at idle focus: real aging, real hunger, real stagnation, real death checks, and no cultivation gain. Reports how much of the span actually ran and what stopped it. Pass rations=N to provision the span - unprovisioned, a body gets about fifty turns.'
    },
    grant_progress: {
        schema: GrantProgressSchema,
        handler: handleGrantProgress,
        aliases: ['progress', 'grant_qi', 'fill_progress', 'fill', 'qi_units', 'top_up'],
        description: 'FILLS THE TANK. Adds qi-units to the accumulator the engine already reads, so a breakthrough can be ATTEMPTED from where the cultivator stands. It rolls no breakthrough and claims none - the attempt is still made in play and can still fail or kill. Use with set_realm to test a crossing FROM any rung.'
    },
    set_realm: {
        schema: SetRealmSchema,
        handler: handleSetRealm,
        aliases: ['realm', 'set_ordinal', 'set_rank', 'ordinal', 'rank', 'rung', 'promote', 'demote'],
        description: 'SETS THE PLAYER RUNG. Moves the cultivator up or down the ladder through advanceRealm, the same road every rank change takes: the peak is stamped, accumulated progress is cleared, the stagnation clock restarts. No breakthrough is rolled and none is claimed. This is how "I am ordinal 44" is said.'
    },
    set_age: {
        schema: SetAgeSchema,
        handler: handleSetAge,
        aliases: ['age', 'set_years', 'make_older', 'make_younger', 'years_old'],
        description: 'SETS THE PLAYER AGE. Moves one number through the repository\'s own delta path, up or down, and nothing else moves with it - no life was lived and none is claimed. Exists because a bar in this world is often age AND rung, so a refusal that names what somebody is short by can name an age. Refuses an age past what the rung\'s lifespan supports, because that is a death rather than a situation.'
    },
    force: {
        schema: ForceSchema,
        handler: handleForce,
        aliases: ['force_action', 'succeed', 'land_it'],
        description: 'RUNS AN ORDINARY VERB WITH THE ATTEMPT LANDING. Typed at the game as ADMIN <verb> <sentence> - "ADMIN sect join the Azure Dew Sect". It decides an UNCERTAIN OUTCOME and never makes an illegal action legal: a refusal that was a precondition still refuses, and names the action that arranges it. Not runnable from this tool, which holds repositories rather than a run.'
    },
    grant_knowledge: {
        schema: GrantKnowledgeSchema,
        handler: handleGrantKnowledge,
        aliases: ['know', 'knowledge', 'reveal_all', 'learn', 'grant_names', 'names'],
        description: 'LIFTS THE AWARENESS GATE WIDE. Makes every place, every house, or one named ' +
            'either, nameable by this cultivator - as ordinary knowledge rows, not a bypass flag. ' +
            'They already exist; what changes is whether their names can be said. Admission bars, ' +
            'trial requirements and whether anybody will talk to you are all untouched.'
    },
    audit_log: {
        schema: AuditLogSchema,
        handler: handleAuditLog,
        aliases: ['audit', 'log', 'trail', 'history', 'what_did_i_do'],
        description: 'READ. The admin audit trail for this run - every ADMIN call, in order, with what it did. These rows ARE the admin flag: run_manage.ledger reads them to exclude this run from the death ledger and from balance data.'
    },
    help: {
        schema: HelpSchema,
        handler: handleHelp,
        aliases: ['?', 'commands', 'actions', 'usage', 'options', 'can', 'how'],
        description: 'READ. What ADMIN can do, as lines you can copy, and what it deliberately cannot with the honest route to each. Call this first if you are not sure which action you want.'
    }
};

const router = createActionRouter({ actions: ACTIONS, definitions, threshold: 0.6 });

export const AdminManageTool = {
    name: 'admin_manage',
    description: `ADMIN - exploratory testing surface. Requires ADMIN_MODE=true in the environment;
every other call is refused with a clear error and no fallback path.

ADMIN LIFTS GATES, NOT TRUTH. Revealing a Tribulation Transcender's grave to a Qi Condensation
player is a content gate being lifted: the site is a real catalogued site, and every gate inside
it - strength, comprehension, the claim conditions - still stands and still refuses.

There is NO action here - and there must never be one - that takes an outcome as input and
records it. No declare, no force_success, no set_hp, no revive. Every action below performs a real
deterministic mutation and returns what the engine actually did.

- help             what ADMIN can do, as lines you can type, and what it deliberately cannot
- roster           every cultivator in the world with rank, location, sect, standing (read-only)
- spawn_site       reveals a real catalogued site by ordinal or by name; awareness gate only
- spawn_encounter  a REAL persisted NPC cultivator with engine-rolled talent at any ordinal
- grant_item       catalog pills, herbs and ARTIFACTS into the real pouch. A rated object can be
                   asked for by rung - 'ordinal=45 kind=artifact' - or by its catalog name
- set_ambient      relocates to a place the engine genuinely derives that band for, this block only
- set_location     move the cultivator; the destination is checked against the real gazetteer
- advance_days     real time through simulateTimeSkip: real aging, hunger, stagnation, death.
                   Says how much of the span it actually simulated and what stopped it.
- grant_progress   fills the qi-unit accumulator so a crossing can be ATTEMPTED; rolls nothing
- set_realm        goes through advanceRealm like any other rank change; logged and flagged
- set_age          moves the age through the repository's own delta path; refuses past the span
- force            runs an ORDINARY VERB with the attempt landing. Typed at the game as
                   'ADMIN <verb> <sentence>'; not runnable from this tool, which has no run
- audit_log        the admin trail for this run

FORCING DECIDES AN UNCERTAIN OUTCOME. IT DOES NOT MAKE AN ILLEGAL ACTION LEGAL. A refusal that
was a precondition still refuses and names the action that arranges it; a refusal that was a
roll is the thing force reaches.

Arguments are key=value. A value runs to the next key, so a multi-word name needs no quoting:
  ADMIN set_location location=The Jade Face
  ADMIN spawn_site ordinal=41 kind=grave

A line that does not begin with an action is read as a SENTENCE instead, by the kind of thing in
it and the rung it names - as a number or as a realm the ladder knows by name:
  ADMIN spawn an NPC at Tribulation Transcendence   ->  spawn_encounter ordinal=41
  ADMIN I run into a 45 weapon                      ->  grant_item kind=artifact ordinal=45
The equivalent key=value line is always printed back, so the reading is visible and correctable,
and a line naming two different things refuses rather than picking one.

Every call is audited, and the run is flagged so it is excluded from the death ledger and from
balance statistics.

Actions: ${ACTIONS.join(', ')}`,
    actionSchemas: router.actionSchemas,
    inputSchema: z.object({
        action: z.string().describe(`Action: ${ACTIONS.join(', ')}`),
        cultivatorId: z.string().optional(),
        runId: z.string().optional(),
        // A rung is a number OR a realm name at this layer too, so a caller
        // reading only the top-level schema is not told it must be numeric.
        ordinal: z.union([z.number().int(), z.string()]).optional()
            .describe(`A rung: 0-${MAX_ORDINAL}, or a realm by name.`),
        // Two actions take a `kind` and they mean different things by it -
        // `spawn_site` a site kind, `grant_item` a catalog. The union is
        // declared here and each action's own schema narrows it, which is where
        // a wrong one is caught with a message naming that action's options.
        kind: z.enum(['grave', 'trial', 'pill', 'herb', 'artifact', 'place', 'sect', 'any']).optional(),
        name: z.string().optional(),
        location: z.string().optional(),
        disposition: z.enum(['hostile', 'wary', 'indifferent', 'friendly']).optional(),
        alignment: SectAlignmentSchema.optional(),
        itemId: z.string().optional(),
        about: z.string().optional(),
        quantity: z.number().int().optional(),
        band: AmbientQiSchema.optional(),
        days: z.number().optional(),
        months: z.number().optional(),
        years: z.number().optional(),
        rations: z.number().int().optional(),
        amount: z.number().optional(),
        age: z.number().optional().describe('Age in years, for set_age. Absolute, not a delta.'),
        verb: z.string().optional().describe('A playable verb, for force. Runs in play, not here.'),
        sentence: z.string().optional(),
        fill: z.boolean().optional(),
        includeDead: z.boolean().optional(),
        limit: z.number().int().optional()
    })
};

/**
 * The routed result as an object, before it is written out for a reader.
 */
export async function adminResult(args: unknown): Promise<Record<string, unknown>> {
    const response = await router(args as Record<string, unknown>);
    const text = response.content[0]?.text ?? '{}';
    try {
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        return { error: 'unreadable_admin_result', message: text };
    }
}

// RENDERING - PLAIN TEXT, BECAUSE THAT IS WHAT THE SURFACE RENDERS

/** Join blocks with the blank line that is this surface's only separator. */
function blocks(...parts: Array<string | null | undefined>): string {
    return parts.filter(p => typeof p === 'string' && p.trim().length > 0).join('\n\n');
}

/** A heading, in the one register plain text has for one. */
function heading(text: string): string {
    return `ADMIN · ${text.toUpperCase()}`;
}

/** `name: value` lines, one block each so the surface keeps them apart. */
function fields(pairs: Record<string, unknown>): string {
    return Object.entries(pairs)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n\n');
}

/** What a want and the line that serves it look like as two blocks. */
function recipeBlock(want: string, line: string): string {
    return `${want}\n\n    ${line}`;
}

/**
 * What an ADMIN call did, beside the prose describing it.
 */
export interface AdminOutcome extends McpResponse {
    /** Whether this call altered anything, as opposed to reporting on it. */
    changed: boolean;
}

export async function handleAdminManage(
    args: unknown,
    _ctx?: SessionContext
): Promise<AdminOutcome> {
    const response = await router(args as Record<string, unknown>);
    try {
        const jsonText = response.content[0]?.text;
        if (!jsonText) return { ...response, changed: false };
        const data = JSON.parse(jsonText);

        const out: string[] = [];

        // ── WHAT WAS INFERRED, ABOVE WHATEVER IT DID ──────────────────────
        //
        // Printed first and always, because the whole licence for reading a
        // sentence at all is that the reading is visible. An operator who meant
        // something else sees the line they should have typed, in the same
        // breath as the result of the line they did not.
        const inferredRaw = (args as Record<string, unknown> | null)?.[INFERRED_KEY];
        if (typeof inferredRaw === 'string') {
            try {
                const inferred = JSON.parse(inferredRaw) as {
                    typed: string; asTyped: string; because: string[];
                };
                out.push(heading('read as'));
                out.push(`You typed:  ${inferred.typed}`);
                out.push(`ADMIN ran:  ${inferred.asTyped}`);
                out.push(inferred.because.join('\n\n'));
                out.push(
                    'Nothing was inferred that key=value could not have said. If the reading is ' +
                    'wrong, type the line above with the argument you meant.'
                );
            } catch {
                // A malformed rider is not worth failing a real call over.
            }
        }

        if (data.error === 'admin_mode_disabled') {
            out.push(heading('off'));
            out.push(String(data.message));
            out.push(String(data.hint));
        } else if (data.error === true || typeof data.error === 'string') {
            out.push(heading('refused'));
            out.push(String(data.message ?? 'Unknown error'));
            if (Array.isArray(data.nearest) && data.nearest.length > 0) {
                out.push(`Nearest: ${data.nearest.join(', ')}`);
            }
            // A wrong ARGUMENT was reported as "Validation failed" and nothing
            // else, because this renderer read `message` and dropped `issues`.
            // `formatValidationError` already folds the issues into `message`,
            // so repeating them underneath printed the same sentence twice -
            // "kind: Invalid enum value..." once as the refusal and once as its
            // own detail. Shown only when the message did not already carry it.
            if (Array.isArray(data.issues) && data.issues.length > 0) {
                const detail = data.issues
                    .map((i: { path: string; message: string }) =>
                        i.path === '(root)' ? i.message : `${i.path}: ${i.message}`)
                    .join('\n\n');
                if (!String(data.message ?? '').includes(detail)) out.push(detail);
            }
            // `message` already ends with the list when the floor suppressed
            // the suggestions - printing it again underneath was the answer
            // twice, which reads as a stutter and doubles the wall.
            const listed = typeof data.message === 'string' && data.message.includes('The actions are:');
            if (Array.isArray(data.validActions) && data.validActions.length > 0) {
                if (!listed) out.push(`The actions are: ${(data.validActions as string[]).join(', ')}.`);
                out.push('ADMIN help says what each one does, with a line you can copy.');
            }
            // The worked line for the action that refused, straight from the
            // capability sheet, so a wrong argument answers itself.
            if (typeof data.action === 'string') {
                const worked = RECIPES.filter(r => r.line.includes(` ${data.action} `));
                if (worked.length > 0) {
                    out.push('Lines that work:');
                    for (const r of worked) out.push(`    ${r.line}`);
                }
            }
            // A REFUSAL THAT WAS A PRECONDITION CARRIES ITS ROUTE
            if (Array.isArray(data.arrangeInstead) && data.arrangeInstead.length > 0) {
                out.push('What would arrange it:');
                for (const line of data.arrangeInstead as string[]) out.push(`    ${line}`);
            }
            if (Array.isArray(data.canDo) && data.canDo.length > 0) {
                out.push('ADMIN help lists everything this surface can arrange.');
            }
            // The router's generic hint names `validActions`, which is a JSON
            // field and not a thing anybody can type. When the list is already
            // on screen it adds nothing but jargon.
            if (data.hint && !(listed && String(data.hint).includes('validActions'))) {
                out.push(String(data.hint));
            }
        } else if (data.help === true) {
            out.push(...renderHelp(data));
        } else if (data.roster) {
            out.push(heading(`world roster - ${data.count}`));
            for (const r of data.roster as Array<Record<string, unknown>>) {
                out.push(
                    `${r.name} - ${r.rank}, ${r.spiritRootName}` +
                    `${r.sectName ? `, ${r.sectName}` : ''}, at ${r.location ?? 'nowhere recorded'}` +
                    `${r.alive ? '' : ', dead'}`
                );
            }
        } else if (Array.isArray(data.entries)) {
            // The trail itself was never rendered - `audit_log` came back as
            // "Action performed: read" and nothing else, so the one action
            // whose entire content is a list printed no list.
            out.push(heading(`admin trail - ${data.entries.length}`));
            if (data.entries.length === 0) {
                out.push('Nothing. ADMIN has not touched this run.');
            } else {
                for (const e of data.entries as Array<Record<string, any>>) {
                    out.push(
                        `${String(e.action).replace(/^admin_manage\./, '')} ` +
                        `at ${e.timestamp}\n\n    ${JSON.stringify(e.details ?? {})}`
                    );
                }
            }
            // `data.note` is pushed once, at the bottom, for every branch. It
            // used to be pushed here as well, so the audit trail printed its
            // own footer twice - visible in any played transcript that reads
            // the log, and invisible in a unit test that asserts the string is
            // present.
        } else if (data.site) {
            out.push(heading(`site revealed - ${data.site.name}`));
            out.push(fields({
                'Catalog id': data.site.catalogId ?? data.site.id,
                'Kind': data.site.kind,
                'Pitched at': `ordinal ${data.site.ordinal} (${data.site.rank})`,
                'Chosen because': data.selection,
                'Was already nameable': data.site.awarenessAlreadyHeld ? 'yes' : 'no'
            }));
            if (Array.isArray(data.sayThis)) {
                out.push('Say this:');
                for (const line of data.sayThis) out.push(`    ${line}`);
            }
            out.push('Awareness gate lifted, and nothing else. Every gate inside this site still stands.');
        } else if (data.knowledge === true) {
            out.push(heading(`names learned - ${data.learned}`));
            out.push(fields({
                'Register': data.kind,
                'Chosen because': data.selection,
                'Offered': data.offered,
                'Newly nameable': data.learned,
                'Already known': data.alreadyHeld
            }));
            if (Array.isArray(data.examples) && data.examples.length > 0) {
                out.push(`For example: ${(data.examples as string[]).join(', ')}`);
            }
            if (Array.isArray(data.sayThis)) {
                out.push('Say this:');
                for (const line of data.sayThis) out.push(`    ${line}`);
            }
        } else if (data.granted === true && data.item) {
            out.push(heading(`granted - ${data.item.name}`));
            out.push(fields({
                'Catalog id': data.item.id,
                'Kind': data.item.kind,
                'Rated at': data.item.ordinal === undefined || data.item.ordinal === null
                    ? undefined
                    : `ordinal ${data.item.ordinal} (${data.item.rank})`,
                'Grade': data.item.grade,
                'Quantity': data.quantity,
                'Chosen because': data.selection || undefined
            }));
            if (Array.isArray(data.sayThis) && data.sayThis.length > 0) {
                out.push(`Say this: ${data.sayThis.join('   ')}`);
            }
            if (data.aboveTheCeiling) out.push(String(data.aboveTheCeiling.whatActuallyHappens));
            if (data.worthInAFight) out.push(String(data.worthInAFight.consequence));
        } else if (data.encounterId) {
            out.push(heading('encounter spawned'));
            out.push(fields({
                'Opponent': data.opponent?.name,
                'Rank': data.opponent?.realm?.name ?? data.opponent?.rank,
                'Standing at': data.location,
                'Disposition': data.disposition,
                'How they compare': data.gateLifted?.howTheyCompare,
                'Power ratio': data.gateLifted?.powerRatio
            }));
            if (Array.isArray(data.sayThis)) {
                out.push('Say this:');
                for (const line of data.sayThis) out.push(`    ${line}`);
            }
            out.push(String(data.gateLifted?.note ?? ''));
        } else if (data.set === true && data.band) {
            // This fell through to a generic "Action performed: set" shrug,
            // which is the invisible-fallback defect: the alias the engine
            // actually found - the whole content of the action - was never
            // printed, only asserted in the note underneath.
            out.push(heading(`ambient set - ${data.band}`));
            out.push(fields({
                'Standing at': data.location,
                'Band derived from': data.alias,
                'Holds': `day ${data.fromDay} to day ${data.toDay}, then the world goes back`
            }));
        } else if (data.moved) {
            out.push(heading('moved'));
            out.push(fields({
                'From': data.from ?? '(nowhere recorded)',
                'To': data.to,
                'Asked for': data.normalised ? data.asked : undefined
            }));
        } else if (data.advanced) {
            const stretches = Array.isArray(data.stretches) ? data.stretches : [];
            const resumedPast = Array.isArray(data.resumedPast) ? data.resumedPast : [];
            out.push(heading('time advanced'));
            out.push(fields({
                'Requested': `${data.requestedDays} day(s)`,
                'Simulated': `${data.simulatedDays} day(s), ${data.simulatedYears} years`,
                'Stopped short by': data.stoppedShort
                    ? `${data.stoppedShort.unsimulatedDays} day(s) - ${data.stoppedShort.reason}`
                    : 'nothing; the whole span ran',
                // What it drove through to get there. Absent for the ordinary
                // one-stretch span rather than printed as "1", because a line
                // that is always there stops being read.
                'Stretches': stretches.length > 1
                    ? stretches
                        .map((s: { days: number; reason: string | null }) =>
                            `${s.days}d${s.reason ? ` (${s.reason})` : ''}`)
                        .join(' then ')
                    : undefined,
                'Carried on past': resumedPast.length > 0 ? resumedPast.join(', ') : undefined
            }));
            if (data.stoppedShort) {
                out.push(String(data.stoppedShort.explanation));
                if (data.stoppedShort.tryThis) out.push(`    ${data.stoppedShort.tryThis}`);
            }
        } else if (data.granted === true && data.progressAfter !== undefined) {
            out.push(heading('progress granted'));
            out.push(fields({
                'Standing at': `ordinal ${data.ordinal} (${data.rank})`,
                'Progress': `${data.progressBefore} to ${data.progressAfter}, of ${data.progressRequired} required`,
                'Attempt now legal': data.eligibility?.eligible
                    ? 'yes'
                    : `no - ${data.eligibility?.reason ?? 'the engine says not'}`,
                'Dao roads': `${data.eligibility?.daoHeld} held, ${data.eligibility?.daoRequired} required`
            }));
        } else if (data.set === true && data.toAge !== undefined) {
            out.push(heading(`age set - ${data.toAge}`));
            out.push(fields({
                'From': `${data.fromAge}`,
                'To': `${data.toAge}`,
                'Standing at': data.rank,
                'Lifespan at that rung': `${data.lifespanYears} years`,
                'Years left': data.yearsLeft
            }));
        } else if (data.set === true && data.toRank) {
            out.push(heading(`rung set - ${data.toRank}`));
            out.push(fields({
                'From': `${data.fromOrdinal} (${data.fromRank})`,
                'To': `${data.toOrdinal} (${data.toRank})`,
                'Immortal status': data.immortalStatus,
                'Status written here': data.immortalStatusWritten ?? 'no - the rung is below the Lid',
                'Progress cleared': data.progressCleared ? 'yes' : 'no',
                'Peak stamped': data.peakOrdinal
            }));
        } else {
            out.push(heading('done'));
            out.push(fields({
                'Action performed': Object.keys(data).find(k =>
                    ['granted', 'moved', 'set', 'advanced', 'spawned'].includes(k)
                ) ?? 'read',
                'Run flagged': data.runFlagged ?? false
            }));
        }

        if (data.note) out.push(String(data.note));

        // NO SERIALISED STATE OBJECT
        out.push(
            'ADMIN - out of world. Nothing above is narration, and no part of it is a claim about ' +
            `what a character perceives. Run flagged: ${data.runFlagged === true ? 'yes' : 'no'}.`
        );

        // DID THE WORLD MOVE, OR WAS IT ONLY ASKED ABOUT
        const changed = !data.error && (
            data.runFlagged === true ||
            ['granted', 'moved', 'set', 'advanced', 'spawned', 'encounterId', 'site']
                .some(k => data[k] !== undefined && data[k] !== false)
        );

        return { content: [{ type: 'text', text: blocks(...out) }], changed };
    } catch {
        return { ...response, changed: false };
    }
}

/**
 * Help, in sections, because all of it at once is more than anybody reads.
 */
function renderHelp(data: Record<string, any>): string[] {
    const section = String(data.section ?? 'what');
    const out: string[] = [];

    if (section === 'refusals') {
        out.push(heading('what admin will not do'));
        out.push(String(data.purpose));
        for (const entry of data.cannotDo as Array<{ asked: string; instead: string }>) {
            out.push(`${entry.asked}\n\n    ${entry.instead}`);
        }
        out.push('ADMIN help for what it will do.');
        return out;
    }

    if (section === 'actions') {
        out.push(heading('the actions'));
        for (const a of data.actions as Array<{ action: string; does: string; takes: string[] }>) {
            out.push(`${a.action}(${a.takes.join(', ')})\n\n    ${a.does}`);
        }
        out.push(String(data.vocabulary));
        return out;
    }

    out.push(heading('what admin can do'));
    out.push(String(data.purpose));
    for (const entry of data.canDo as Array<{ want: string; line: string }>) {
        out.push(recipeBlock(entry.want, entry.line));
    }
    out.push(String(data.law));
    out.push(
        'ADMIN help refusals - what it will not do, and the honest route to each.\n\n' +
        'ADMIN help actions - every action, what it does and what it takes.\n\n' +
        `Written up in full: ${data.documentation}`
    );
    return out;
}
