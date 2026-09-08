/**
 * The player-facing voice.
 *
 * Every other test in this directory asserts that a refusal HAPPENED. None of
 * them read what the player is shown, which is how a refusal written for a
 * developer shipped unaltered:
 *
 *   "someone about the Hollow Court" is nobody this cultivator has heard of and
 *   nobody standing in front of them, so there was nobody to approach. The
 *   engine will not conjure a person to have a conversation with, and it will
 *   not say whether such a person exists. Known to this cultivator, or standing
 *   here: Fallen Grain Caravan.
 *
 * Three failures in one sentence: it names the engine, it explains its own
 * policy, and it ends with a list of valid targets. The policy is right. What
 * these tests enforce is that it is invisible - an error message that reaches
 * the player is a scene that failed to get written.
 *
 * So these assert on the STRING, not the outcome. The mechanical version still
 * has to exist, on the structure channel, where a developer or a curious player
 * can go and read it.
 */

import { describe, it, expect } from 'vitest';
import { SECTS } from '../../src/data/cultivation/index';
import { makeGame, engineCalls, ScriptedProvider } from './harness';
import { drawBirth } from '../../src/engine/birth/birth';

/** Where the default harness seed births somebody. Derived, never assumed. */
const HOME_PLACE = drawBirth('test-seed').place.name;

const LOCAL_SECT = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

/** Vocabulary that only exists because a developer wrote the sentence. */
const SYSTEM_VOICE = [
    /\bengine\b/i,
    /\bthe (?:player|caller|handler|repository|schema)\b/i,
    // THE PLAYER IS YOU. `this cultivator` is the engine's own register for
    // them, correct in a ruling and wrong in prose, and it was reaching the
    // narration: "X is somebody this cultivator has already stood in front of",
    // read off a live turn. Nobody in this world says that about the person
    // they are looking at.
    /\bthis cultivator\b/i,
    /\bstate (?:change|changed)\b/i,
    /\bnot (?:yet )?(?:supported|implemented|resolvable)\b/i,
    /\bknowledge record\b/i,
    /\bcapability predicate/i,
    /\bsocial layer\b/i,
    /\bunresolved\b/i,
    /\bordinal\b/i,
    /\bTODO\b/,
    /\{\s*action:/,
    /_manage\(/
];

/** Phrases that explain the rule instead of showing its consequence. */
const POLICY_VOICE = [
    /\bwill not (?:describe|conjure|say whether|confirm)\b/i,
    /\bhas no knowledge of\b/i,
    /\bis not something this cultivator has heard of\b/i,
    /\bnothing was agreed and no state changed\b/i
];

/** The debug dump: a list of things that would have worked. */
const ENUMERATION = [
    /\bKnown to this cultivator\b/i,
    /\bKnown:/,
    /\bIn the pouch:/,
    /\bOn record nearby\b/i,
    /\bName one\b/
];

function offences(text: string, patterns: RegExp[]): string[] {
    return patterns.filter(p => p.test(text)).map(String);
}

/** Everything the player is shown for one action. */
function playerFacing(result: { narration: string }): string {
    return result.narration;
}

describe('refusals read as the world declining', () => {
    /** Every refusal path, exercised through the front door. */
    const refusals: Array<[string, string]> = [
        ['an unknown person', 'I ask someone about the Hollow Court.'],
        ['an unknown thing', 'I examine the Sword of Infinite Nonsense.'],
        ['nobody named', 'I talk to.'],
        ['nowhere named', 'I set out.'],
        ['a formula that does not exist', 'I brew an Elixir of Infinite Nonsense in the cauldron.'],
        ['an art never taught', 'I practise the Nine Severing Threads technique.'],
        ['a barrier that will not move', 'I break through.'],
        ['a meal with an empty purse', 'I buy a meal.'],
        // The economy verbs, added after the sweep and immediately guilty of
        // the same thing: "The work: the engine resolved it." reached a player
        // because nothing was reading these paths.
        ['taking work', 'I take whatever work the village will give me for a season'],
        ['the market board', 'what is for sale here'],
        ['sizing something up', 'could I survive that cave'],
        ['a sentence nothing understood', 'I ponder the nature of the Lid for a while']
    ];

    for (const [label, input] of refusals) {
        it(`never names the system: ${label}`, async () => {
            const { db, game } = makeGame();
            const { cultivator } = await game.newRun('Villager');
            db.prepare('UPDATE cultivators SET spirit_stones = 0, satiety = 40 WHERE id = ?')
                .run(cultivator.id);

            const shown = playerFacing(await game.act(input));

            expect(offences(shown, SYSTEM_VOICE)).toEqual([]);
            expect(offences(shown, POLICY_VOICE)).toEqual([]);
            expect(offences(shown, ENUMERATION)).toEqual([]);
        });
    }

    it('shows a scene rather than a sentence about a rule', async () => {
        const { game } = makeGame();
        await game.newRun('Villager');

        const shown = playerFacing(await game.act('I ask someone about the Hollow Court.'));

        // The reported bug, verbatim, must not come back.
        expect(shown).not.toContain('The engine will not conjure');
        expect(shown).not.toContain('Known to this cultivator');
        // What is there instead is the world: a place, or a person not knowing.
        expect(shown).toMatch(new RegExp(`${HOME_PLACE}|carries on|answers to it|nobody about`, 'i'));
        expect(shown.length).toBeGreaterThan(30);
    });

    it('does not enumerate what would have worked', async () => {
        const { game } = makeGame();
        await game.newRun('Villager');

        const shown = playerFacing(await game.act('I examine the Sword of Infinite Nonsense.'));
        // The one name this cultivator holds must not be offered as a hint.
        expect(shown).not.toContain(LOCAL_SECT.name);
    });

    it('keeps the mechanical account, on the channel built for it', async () => {
        const { game } = makeGame();
        await game.newRun('Villager');

        const result = await game.act('I ask someone about the Hollow Court.');
        const mechanical = engineCalls(result).map(c => c.summary).join(' ') +
            result.state.log.filter(e => e.role === 'engine').map(e => e.text).join(' ');

        // Precision is not lost, it is filed. A developer can still see exactly
        // why nothing happened, and so can a curious player who goes looking.
        //
        // Either wording is that precision. `someone` used to be discarded
        // before the resolver saw it, so the account could only say the party
        // was unresolved; it reaches `somebodyAtHand` now, which answers with
        // the name it tried and why nobody matched it.
        expect(mechanical).toMatch(/Unresolved (?:party|subject)|matched nobody/);
        expect(mechanical).toMatch(/Known to this cultivator|heard of nobody/);
    });
});

describe('the zero-provider narration is a situation, not a sheet', () => {
    it('does not recite the character sheet back at the player', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Wen Shu');
        db.prepare(
            'UPDATE cultivators SET spirit_stones = 0, realm_ordinal = 3, age = 17 WHERE id = ?'
        ).run(cultivator.id);

        const shown = playerFacing(await game.act('I look around.'));

        // WHAT IS BANNED HERE IS THE LADDER INDEX, NOT THE RANK AND NOT THE AGE.
        //
        // This used to refuse `Qi Condensation Layer 4` and `17 years old`, and
        // both are things people in this world say. The design owner: *"layer x
        // is okay (only for qi condensation cuz it goes 1-13, for the rest use
        // the words), x years old is okay, just do not say the ordinal number."*
        // `rankName` already obeys the first half on its own, because Qi
        // Condensation is the one realm whose sub-ranks are numbered and every
        // realm above it names them in words: Sinew, Marrow, First Tempering.
        //
        // The ordinal is the engine's index into the ladder. Nobody in this
        // world says it, and it was reaching the player through the engine log
        // on every reading of anybody's standing.
        expect(shown).not.toMatch(/ordinal \d/i);
        expect(shown).not.toMatch(/\d+ spirit stones to their name/);
    });

    it('notices the situation instead', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Wen Shu');
        db.prepare(
            'UPDATE cultivators SET spirit_stones = 0, satiety = 10, years_at_current_realm = 40 WHERE id = ?'
        ).run(cultivator.id);

        const shown = playerFacing(await game.act('I look around.'));

        expect(shown).toMatch(/purse folds flat/i);
        expect(shown).toMatch(/hunger is back/i);
        expect(shown).toMatch(/long time since anything moved/i);
        expect(offences(shown, SYSTEM_VOICE)).toEqual([]);
    });

    it('has something to say when nothing is wrong', async () => {
        const { game } = makeGame();
        await game.newRun('Wen Shu');

        const shown = playerFacing(await game.act('I look around.'));
        expect(shown.length).toBeGreaterThan(60);
        expect(shown).toContain(HOME_PLACE);
    });
});

describe('no system voice anywhere a player can reach', () => {
    /** A short session across the verbs that produce prose. */
    const session = [
        'I look around.',
        'I cultivate for thirty days.',
        `I examine ${LOCAL_SECT.name}.`,
        'I travel to Clear River Ford.',
        'I wait.',
        'I forage for herbs.',
        'I take work for a season',
        'what is for sale here',
        'could I survive that cave',
        'I do the thing with the thing',
        'status'
    ];

    it('keeps every narration in the world voice', async () => {
        const { game } = makeGame({ seed: 'voice' });
        await game.newRun('Wen Shu');

        for (const input of session) {
            const shown = playerFacing(await game.act(input));
            expect(offences(shown, SYSTEM_VOICE), `input: ${input}\n${shown}`).toEqual([]);
            expect(offences(shown, POLICY_VOICE), `input: ${input}\n${shown}`).toEqual([]);
        }
    });

    it('keeps the play log in the world voice too, except where it is labelled engine', async () => {
        const { game } = makeGame({ seed: 'voice' });
        await game.newRun('Wen Shu');
        await game.act('I look around.');

        const state = game.state();
        const narrator = state.log.filter(e => e.role === 'narrator').map(e => e.text).join('\n');
        expect(offences(narrator, SYSTEM_VOICE)).toEqual([]);

        // Engine rows are allowed to be mechanical. That is what they are for.
        expect(state.log.some(e => e.role === 'engine')).toBe(true);
    });
});


/**
 * THE NARRATOR WRITES TYPOGRAPHY THIS REPO DOES NOT USE.
 *
 * `AGENTS.md` forbids an em-dash and an en-dash, and `terminology.test.ts`
 * enforces it over every file in the tree. None of that reaches the model,
 * which writes them freely. Measured on a live turn against ollama, in prose
 * that was otherwise the best thing the game had produced:
 *
 *   whenever a sword is drawn anywhere within earshot [em] even in a kitchen
 *   [em] the disciples instinctively stand
 *
 * So the one typographic rule the whole repo keeps was being broken on the
 * most read surface in the game, by the one writer nobody had told.
 *
 * `inTheCharactersThePatternsUse` already existed for the other direction,
 * normalising what a PLAYER types so the patterns can match it. The same
 * function serves the way out.
 */
describe("the narrator typography is the repo typography", () => {
    // Built from codepoints, because a test asserting the absence of these
    // characters must not be the file that reintroduces them.
    const EM = String.fromCharCode(0x2014);
    const EN = String.fromCharCode(0x2013);
    const CURLY = String.fromCharCode(0x2019);
    const ELLIPSIS = String.fromCharCode(0x2026);

    it("puts a model dash, quote and ellipsis back to the plain ones", async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"look"}'],
            narrations: [
                `A road ${EM} and nobody on it ${EN} nobody at all${ELLIPSIS} ` +
                `the ferryman${CURLY}s boat is gone.`
            ]
        });
        const { game } = makeGame({ provider });
        await game.newRun('Villager');
        const shown = playerFacing(await game.act('I look around.'));

        // The narration reached the player, so the fixture is being read.
        expect(shown).toContain('A road');

        for (const [name, ch] of [
            ['em dash', EM], ['en dash', EN],
            ['curly apostrophe', CURLY], ['ellipsis character', ELLIPSIS]
        ] as Array<[string, string]>) {
            expect(shown.includes(ch), name).toBe(false);
        }

        // And what replaced them is what the rest of the repo writes.
        expect(shown).toContain('-');
        expect(shown).toContain("ferryman's");
    });
});