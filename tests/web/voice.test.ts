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
 *   here: The Gleaners' Company.
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
import { makeGame, engineCalls } from './harness';
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
        expect(mechanical).toMatch(/Unresolved (?:party|subject)/);
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

        // The sheet is already on screen. Saying it again in a sentence is the
        // failure: no rank name, no age in years, no stone count.
        expect(shown).not.toMatch(/Qi Condensation Layer \d/);
        expect(shown).not.toMatch(/\d+ years old/);
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
