/**
 * ADMIN, typed the way a person actually types it.
 *
 * ══ WHY THIS EXISTS ═══════════════════════════════════════════════════════
 *
 * Two real sessions, both refused, both asking for something the surface could
 * already do:
 *
 *   ADMIN spawn NPC tribulation transcender in front of me
 *     -> Unknown action "spawn". Did you mean: "spawn_site" (50%),
 *        "spawn_encounter" (33%), "set_ambient" (27%)?
 *
 *   ADMIN I run into a 45 weapon
 *     -> Unknown action "I". Did you mean: "audit_log" (11%), ...
 *
 * The first one is `spawn_encounter ordinal=41` and always was. The operator
 * named the realm instead of its ordinal, put a noun in front of it, and lost
 * a coin-flip between two actions that both begin with "spawn". The second is
 * worse: `I` is not a near-miss for `audit_log` at 11% or at any other figure,
 * and a percentage-ranked list of unrelated action names is not an answer to
 * anything. AGENTS.md: "if a near-synonym works, the phrasing that fails is a
 * bug", and "a filename is the only documentation everyone reads" has a sibling
 * here - the error message is the only documentation an operator gets.
 *
 * ══ WHY ACCEPTING PROSE IS NOT A SOFTENING ════════════════════════════════
 *
 * `admin-manage.ts` used to say, in a comment, that explicit `key=value` pairs
 * were "the whole safety property: there is no inference here to be wrong". The
 * concern behind that is right and the conclusion was too strong. What makes
 * ADMIN safe is that every action performs a real deterministic mutation and
 * returns what the engine actually did - not that the operator had to spell the
 * request in the schema's own vocabulary. The rest of this game answers a player
 * in their own words; there is no reason the operator surface should be the one
 * place that does not.
 *
 * So inference is allowed, under two conditions that keep it honest:
 *
 *   1. WHAT WAS INFERRED IS ALWAYS PRINTED BACK, as the `key=value` line that
 *      would have produced it. The operator can see the guess and correct it,
 *      and nothing is done quietly on their behalf. `asTyped` carries it.
 *   2. AMBIGUITY REFUSES RATHER THAN PICKS. A sentence with no subject noun in
 *      it, or with two, does not get a coin-flip - it gets a refusal that names
 *      the commands that would work. That is the standard everywhere else in
 *      this build and the admin errors were failing it.
 *
 * This layer NEVER reaches an outcome. It rewrites a sentence into an existing
 * action with existing arguments, and every schema, gate and refusal downstream
 * of it is untouched. There is no sentence that opens a door `key=value` does
 * not already open.
 *
 * ══ WHAT IT IS NOT ════════════════════════════════════════════════════════
 *
 * Not a grammar, not an intent model, and deliberately not a list of sentences.
 * It reads three things out of a line - a SUBJECT (what kind of thing is being
 * asked for), a RUNG (a number, or a realm the ladder knows by name), and a
 * NAME (whatever is left, when the subject wants one) - and those three
 * compose. A fourth subject is a row in one table below, not a new branch.
 */

import { REALM_TIERS, MAX_ORDINAL, realmForOrdinal } from '../../engine/cultivation/realms.js';

// ═══════════════════════════════════════════════════════════════════════════
// SUBJECTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The kinds of thing an operator asks for, and which action serves each.
 *
 * `words` are matched as whole words against the line, longest first, so
 * "cultivator" beats "cave" and a sentence naming two different subjects is
 * caught rather than resolved. These are the nouns somebody reaches for, not
 * synonyms of the action names - "NPC" and "guy" are here because they were
 * typed, and "spawn_encounter" is not, because the router already knows it.
 */
interface Subject {
    action: string;
    /** Where a bare number in the sentence goes. */
    ordinalKey: 'ordinal';
    /**
     * Where leftover words go, when the subject takes a name at all.
     *
     * `set_location` is deliberately NOT a subject here. A place is named
     * rather than typed, so the noun that would trigger it - "place", "town" -
     * is the least likely word to be in the sentence, and putting it in this
     * table made "place an NPC here" name two subjects and refuse. AGENTS.md:
     * fix the gap that was demonstrated, not the one you imagined.
     */
    nameKey: 'name' | null;
    words: readonly string[];
    /** Extra fixed arguments this subject implies. */
    fixed?: Record<string, string>;
}

const SUBJECTS: readonly Subject[] = [
    {
        // A person to stand in front of you. `spawn_encounter` has always done
        // this; the fuzzy matcher offered it at 33% and lost to `spawn_site`.
        action: 'spawn_encounter',
        ordinalKey: 'ordinal',
        nameKey: 'name',
        // "immortal" is deliberately NOT here. It is a realm the ladder knows
        // by name, so `ordinalNamed` already reads it as a rung, and having it
        // be a subject word as well would make "a 45 immortal weapon" name two
        // subjects and refuse a sentence that is perfectly clear.
        words: [
            'npc', 'cultivator', 'enemy', 'opponent', 'person', 'someone',
            'somebody', 'transcender', 'elder', 'bandit', 'guy',
            'fighter', 'attacker', 'foe',
            // `SPAWN A CORE FORMATION GIRL` was refused, and it is the plainest
            // sentence anybody sent. A person is a person however they are
            // described; see `PERSON_DESCRIBED_AS` for what the description can
            // and cannot reach.
            'girl', 'woman', 'lady', 'boy', 'man', 'fellow', 'youth', 'child'
        ]
    },
    {
        // A thing to carry. The owner's "a 45 weapon" - and the reason a weapon
        // is a `grant_item` rather than an action of its own is that the pouch
        // is where everything a person carries already lives.
        action: 'grant_item',
        ordinalKey: 'ordinal',
        nameKey: 'name',
        words: [
            'weapon', 'artifact', 'blade', 'sword', 'sabre', 'spear', 'object',
            'treasure', 'item', 'relic'
        ],
        fixed: { kind: 'artifact' }
    },
    {
        action: 'grant_item',
        ordinalKey: 'ordinal',
        nameKey: 'name',
        words: ['pill', 'medicine', 'elixir'],
        fixed: { kind: 'pill' }
    },
    {
        action: 'grant_item',
        ordinalKey: 'ordinal',
        nameKey: 'name',
        words: ['herb', 'ingredient', 'plant'],
        fixed: { kind: 'herb' }
    },
    {
        action: 'spawn_site',
        ordinalKey: 'ordinal',
        nameKey: 'name',
        words: ['grave', 'tomb', 'trial', 'site', 'cave', 'ruin', 'inheritance']
    }
];

/**
 * The words that mean "me", and the lowest-priority subject there is.
 *
 * `ADMIN I am ordinal 44` is the third of three sessions lost to the first
 * token being taken as the action name, and `set_realm` has always done exactly
 * what it asked for. But "I" cannot be a subject word beside the others,
 * because it is in almost every sentence an operator types - "I run into a 45
 * weapon" is about the weapon and not about me.
 *
 * So the self is read only when NOTHING ELSE in the line named a kind of thing,
 * and only when a rung was named as well. That ordering is the whole rule:
 * everything else in the sentence is a better clue than the pronoun, and a bare
 * "I am tired" names no rung and is correctly refused.
 */
const SELF = new Set(['i', 'me', 'my', 'myself', 'im', 'self']);

/**
 * Nouns that describe a person rather than name a role, and what they reach.
 *
 * `SPAWN A CORE FORMATION GIRL` is unambiguous about three things - an action,
 * a band on the ladder, and a woman - and the engine has a field for exactly
 * two of them. **There is no sex on `Cultivator` and none on `NpcCultivation`,
 * anywhere in the schema.** So the honest handling is neither to drop the word
 * nor to invent a field for it: the description goes into the NAME, which is
 * free text the action already takes, and the response says plainly that
 * nothing else about the cultivator differs because there is nothing else for
 * it to differ in.
 *
 * That is the agency rule applied to a word: the wording changes what the
 * operator INTENDED and what the world will call her, and changes nothing about
 * what the engine then does - which is correct, because a rolled spirit root
 * and a rolled set of attributes do not know or care.
 */
const PERSON_DESCRIBED_AS = new Set([
    'girl', 'woman', 'lady', 'boy', 'man', 'fellow', 'youth', 'child', 'elder'
]);

/**
 * Words that carry no subject and no argument, stripped before what is left is
 * read as a name.
 *
 * "in front of me" is the whole reason this list exists: it is how everybody
 * says "here", it means the default, and left in the string it becomes part of
 * an NPC's name. The verbs are here for the same reason - an operator writes
 * "spawn", "give me", "I run into", and none of those three change what is
 * being asked for once the subject noun is known.
 */
const NOISE = new Set([
    'a', 'an', 'the', 'me', 'my', 'i', 'in', 'front', 'of', 'to', 'at', 'on',
    'here', 'there', 'with', 'and', 'for', 'into', 'onto', 'up', 'please',
    'spawn', 'give', 'grant', 'put', 'make', 'add', 'run', 'find', 'get',
    'want', 'need', 'place', 'summon', 'create', 'drop', 'hand', 'bring',
    'is', 'am', 'be', 'it', 'that', 'this', 'some', 'stage'
]);

// ═══════════════════════════════════════════════════════════════════════════
// THE RUNG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The ordinal a phrase names, or null.
 *
 * A bare number first, because that is what "a 45 weapon" is. Otherwise a realm
 * BY NAME, read off `REALM_TIERS` rather than restated here - AGENTS.md is
 * explicit that `realms.ts` is the authority and that the ladder must never be
 * written down twice. A realm names a band of four or thirteen rungs and this
 * takes its FIRST, because "a Tribulation Transcender" means somebody in that
 * realm and the bottom of it is the weakest reading of the claim: an operator
 * who wanted the top of the band can say so with a number, and one who did not
 * should not silently get the harder thing.
 *
 * Sub-rank names are matched too, so "Qi Condensation Layer 5" lands on 4
 * rather than on 0.
 */
export function ordinalNamed(
    phrase: string
): { ordinal: number; how: string; /** The words that named it, for stripping. */ words: string[] } | null {
    const line = phrase.toLowerCase();

    const bare = /(?:^|\s)(\d{1,2})(?=\s|$)/.exec(line);
    if (bare) {
        const n = Number(bare[1]);
        if (n >= 0 && n <= MAX_ORDINAL) {
            return { ordinal: n, how: `the number ${n} in the sentence`, words: [bare[1]] };
        }
    }

    // Longest realm name first, so "Tribulation Transcendence" is not shadowed.
    const tiers = [...REALM_TIERS].sort((a, b) => b.name.length - a.name.length);

    // ── THE MOST SPECIFIC READING FIRST ───────────────────────────────────
    //
    // Realm PLUS sub-rank before realm alone, in a pass of its own. Written the
    // other way round, "Core Formation Mid" matched the bare realm on the first
    // tier it reached and returned 17 before the sub-rank was ever looked at -
    // so naming a rung exactly and naming its band gave the same answer, and
    // the more precise sentence was the one being ignored.
    for (const tier of tiers) {
        for (let i = 0; i < tier.subRanks.length; i++) {
            const sub = tier.subRanks[i].toLowerCase();
            if (sub.length >= 3 && line.includes(`${tier.name.toLowerCase()} ${sub}`)) {
                return {
                    ordinal: tier.ordinalStart + i,
                    how: `"${tier.name} ${tier.subRanks[i]}" is ordinal ${tier.ordinalStart + i}`,
                    words: `${tier.name} ${tier.subRanks[i]}`.toLowerCase().split(/\s+/)
                };
            }
        }
    }

    // ── THE SHORTHAND PEOPLE ACTUALLY TYPE ────────────────────────────────
    //
    // `ADMIN I AM TT` was refused, and TT is what the design owner calls
    // Tribulation Transcendence throughout - `manuals.ts` quotes them using it.
    // There is no table of abbreviations anywhere in the repo and there must not
    // be one: an abbreviation is the INITIALS of a realm name, so it is derived
    // from `REALM_TIERS` here and a realm renamed tomorrow abbreviates correctly
    // with nobody remembering to update a list.
    //
    // Two letters minimum, which is not an arbitrary floor - it is what keeps
    // "Immortal" from abbreviating to "I" and swallowing the commonest pronoun
    // in every sentence an operator types.
    for (const tier of tiers) {
        const initials = tier.name.split(/\s+/).map(w => w[0]).join('').toLowerCase();
        if (initials.length >= 2 && new RegExp(`(?:^|\\s)${initials}(?=\\s|$)`).test(line)) {
            return {
                ordinal: tier.ordinalStart,
                how: `"${initials.toUpperCase()}" is the shorthand for ${tier.name}, ordinals ` +
                    `${tier.ordinalStart}-${tier.ordinalEnd}; the first rung of the band was taken. ` +
                    'Say a number for any other rung.',
                words: [initials]
            };
        }
    }

    for (const tier of tiers) {
        // "Transcendence" and "Transcender" and "Transcending" are the same
        // word to an operator. Match on the stem the realm name actually has.
        const stem = tier.name.toLowerCase().replace(/(ence|ance|ion|ing)$/, '');
        if (stem.length >= 4 && line.includes(stem)) {
            return {
                ordinal: tier.ordinalStart,
                how: `"${tier.name}" names ordinals ${tier.ordinalStart}-${tier.ordinalEnd}; ` +
                    'the first rung of the band was taken, because a realm named without a rung ' +
                    'is the weakest reading of it. Say a number for any other rung.',
                words: tier.name.toLowerCase().split(/\s+/)
            };
        }
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE READING
// ═══════════════════════════════════════════════════════════════════════════

export interface SentenceReading {
    /** The action to route to. */
    action: string;
    /** Arguments, all strings, to be merged over the parsed `key=value` pairs. */
    args: Record<string, string | number>;
    /**
     * The equivalent command line, printed back to the operator so the guess is
     * visible. This is the whole reason inference is allowed here.
     */
    asTyped: string;
    /** Why each part was read the way it was. For the response, never a claim. */
    because: string[];
}

export interface SentenceRefusal {
    /** Nothing in the line said what kind of thing was wanted. */
    reason: 'no_subject' | 'two_subjects';
    /** The subjects that collided, when two did. */
    collided: string[];
}

/**
 * Read an ADMIN line that did not begin with an action.
 *
 * Returns a reading, a refusal, or null when the line is empty. It never
 * partially applies: a line it cannot read in full is refused so the caller can
 * say what would have worked, rather than executing half of a guess.
 */
export function readAdminSentence(line: string): SentenceReading | SentenceRefusal | null {
    const clean = line.trim();
    if (clean.length === 0) return null;

    const words = clean.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 0);
    if (words.length === 0) return null;

    // ── Which subject. Two different ones is a refusal, not a tie-break. ──
    const found: Subject[] = [];
    for (const subject of SUBJECTS) {
        if (subject.words.some(word => words.includes(word))) found.push(subject);
    }
    const distinct = [...new Set(found.map(s => `${s.action}${s.fixed?.kind ? `:${s.fixed.kind}` : ''}`))];

    // ── THE SELF, when nothing else was named. ────────────────────────────
    if (found.length === 0) {
        const rung = ordinalNamed(clean);
        if (rung !== null && words.some(w => SELF.has(w))) {
            return {
                action: 'set_realm',
                args: { ordinal: rung.ordinal },
                asTyped: `set_realm ordinal=${rung.ordinal}`,
                because: [
                    'the sentence is about you and names a rung, and nothing else in it named a ' +
                    'kind of thing',
                    rung.how,
                    'set_realm goes through advanceRealm like every other rank change: the peak is ' +
                    'stamped, accumulated progress is cleared, the stagnation clock restarts. No ' +
                    'breakthrough was rolled and none is claimed.'
                ]
            };
        }
        return { reason: 'no_subject', collided: [] };
    }
    if (distinct.length > 1) return { reason: 'two_subjects', collided: distinct };

    const subject = found[0];
    const because: string[] = [];
    const args: Record<string, string | number> = { ...(subject.fixed ?? {}) };

    const matchedWords = new Set(subject.words.filter(word => words.includes(word)));
    because.push(
        `"${[...matchedWords].join('", "')}" is a ${subject.action.replace(/_/g, ' ')} subject`
    );

    // ── The rung. ─────────────────────────────────────────────────────────
    const rung = ordinalNamed(clean);
    if (rung) {
        args[subject.ordinalKey] = rung.ordinal;
        because.push(rung.how);
    }

    // ── The name, out of whatever is left. ────────────────────────────────
    //
    // Everything that was a subject word, a noise word, or the number already
    // read is removed. What survives is a name somebody typed on purpose, and
    // an empty remainder is correct rather than a failure: "spawn an NPC at 41"
    // has no name in it and the action defaults one.
    if (subject.nameKey !== null) {
        // THE WORDS THAT NAMED THE RUNG ARE NOT ALSO A NAME. "spawn NPC
        // tribulation transcender" was giving `name=tribulation`, because
        // "transcender" was removed as a subject word and "tribulation" was
        // not - so half of a realm name survived into what the world would
        // call the person. `ordinalNamed` reports the words it matched on and
        // they are struck out here, which is the general fix rather than one
        // more word in the noise list.
        const rungWords = new Set(rung?.words ?? []);
        const rest = clean
            .split(/\s+/)
            .filter(raw => {
                const w = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (w.length === 0) return false;
                if (NOISE.has(w)) return false;
                if (matchedWords.has(w)) return false;
                if (rungWords.has(w)) return false;
                if (/^\d+$/.test(w)) return false;
                return true;
            })
            .join(' ')
            .trim();
        // A realm name that was already read as the rung is not also a name.
        const namedRung = rung !== null && ordinalNamed(rest) !== null;
        if (rest.length > 0 && !namedRung) {
            args[subject.nameKey] = rest;
            because.push(`what was left of the line - "${rest}" - was read as ${subject.nameKey}=`);
        } else if (subject.action === 'spawn_encounter') {
            // Nothing was left to be a name, but the noun that was used may
            // still describe who is standing there. `A Core Formation girl` is
            // the operator's own word carried through to what the world calls
            // her - not a field, because there is no field.
            const described = [...matchedWords].find(w => PERSON_DESCRIBED_AS.has(w));
            if (described && rung !== null) {
                args[subject.nameKey] = `A ${realmForOrdinal(rung.ordinal).name} ${described}`;
                because.push(
                    `"${described}" describes the person rather than naming them, so it became the ` +
                    'name. THE ENGINE HAS NO SEX FIELD on a cultivator, so nothing else about them ' +
                    'differs - the spirit root and the attributes are rolled from the run seed either way.'
                );
            }
        }
    }

    const asTyped = [
        subject.action,
        ...Object.entries(args).map(([key, value]) => `${key}=${value}`)
    ].join(' ');

    return { action: subject.action, args, asTyped, because };
}

/** True when a refusal came back rather than a reading. */
export function isSentenceRefusal(
    value: SentenceReading | SentenceRefusal | null
): value is SentenceRefusal {
    return value !== null && 'reason' in value;
}
