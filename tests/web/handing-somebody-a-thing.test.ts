/**
 * The middle act of the owner's own sentence for this feature.
 *
 * *"A person could steal and then hand it to someone else before running
 * away."* Three acts. Two of them were verbs. Six ordinary phrasings of the
 * middle one reached `unclear`: "I hand him the purse", "I give Shen Liefeng my
 * manual", "I press it into her hand", "I pass it to him", "I put ten stones on
 * the table".
 *
 * ── THE ENGINE HALF WAS ALREADY THE RIGHT SHAPE ──────────────────────────
 *
 * `gifted` is a member of `AcquisitionMode` in `possessions.ts`.
 * `gifted_resource` is a member of `FavorCause` in `grudges.ts`. Neither needed
 * adding, and `createObligation` writes the row. What was missing was the
 * sentence.
 *
 * ── FREE, AND IT MEANS IT ────────────────────────────────────────────────
 *
 * Nothing is attempted against the recipient - they are not being asked for
 * anything, there is no leverage on the table and no roll to lose - so there is
 * no day to spend. `PRESSING_SOMEBODY` is the set of things that cost a day
 * WHETHER OR NOT they come off, and this is not one of them. What it costs is
 * the thing, which does not come back, and that is why `give` is on neither
 * `READ_ONLY_ACTIONS` nor `TIME_CONSUMING_ACTIONS`: free is as wrong for it as
 * slow is.
 *
 * ── AND WHAT IT LEAVES ───────────────────────────────────────────────────
 *
 * A favour the GIVER holds, which the taker owes. It is the only account in this
 * engine that opens WITHOUT leverage - every other route runs through
 * `resolveAttempt`, which prices what you leaned on - which is the whole reason
 * the sentence is worth typing, and the reason the owner's example uses it to
 * put stolen goods in somebody else's hands.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent, whatIsBeingHandedOver } from '../../src/web/actions';
import { handOver, theLotTheyMeant, type GiveDeps } from '../../src/web/handing-somebody-a-thing';
import type { Cultivator } from '../../src/schema/cultivation';
import { whichWayItPoints } from '../../src/engine/social/grudges';

const GIVER = { id: 'me', name: 'Wen Shuyi', spiritStones: 40 } as unknown as Cultivator;

function deps(over: Partial<GiveDeps> = {}): GiveDeps {
    return {
        giver: GIVER,
        recipient: { id: 'npc-1', name: 'Shen Liefeng' },
        namedRecipient: 'Shen Liefeng',
        othersHere: ['Shen Liefeng'],
        pouch: [{ itemId: 'herb-qi-grass', kind: 'herb', quantity: 2, name: 'Qi Gathering Grass' }],
        heldArts: [],
        onDay: 100,
        ...over
    };
}

describe('the sentence that had no verb', () => {
    it.each([
        'I hand him the purse',
        'I give Shen Liefeng my manual',
        'I press it into her hand',
        'I pass it to him',
        'I put ten stones on the table',
        'I hand over what I am carrying to her'
    ])('routes it: %s', said => {
        expect(parseIntent(said).action).toBe('give');
    });

    it('names who and what, and neither substitutes for the other', () => {
        const plan = parseIntent('I give Shen Liefeng my manual');
        expect(plan.target).toBe('Shen Liefeng');
        expect(plan.topic).toBe('my manual');
    });

    it('names nobody where the sentence names nobody', () => {
        // "I put ten stones on the table" says who by not saying: whoever is at
        // hand, which is what `interact` already means by an absent target.
        const plan = parseIntent('I put ten stones on the table');
        expect(plan.target).toBeUndefined();
        expect(plan.stones).toBe(10);
    });

    it('carries the count off the sentence, because no model is asked for one', () => {
        expect(parseIntent('I give Shen Liefeng ten stones').stones).toBe(10);
    });
});

/**
 * A player naming their own property is the NORMAL way to say this.
 *
 * Found in the UI against ollama, and it is the worst thing this package can
 * produce. `I hand Tao Chunxi the purse` worked; `hand <person> my <thing>` did
 * not, so the sentence fell through to the theft path:
 *
 *   > I hand Shen Liefeng my two spirit stones
 *   The approach was labelled "steal". Shen Liefeng: countered.
 *   Reprisal: injured. Weighed as serious robbery.
 *
 * A player tried to hand somebody money, was charged with robbery, took a wound
 * for it, and came away carrying a grudge from the person they were being
 * generous to. The bare definite article the first tests used is the LESS
 * common phrasing; a possessive and a count is how anybody says it.
 */
describe('a player naming their own property', () => {
    it.each([
        ['I hand Shen Liefeng my two spirit stones', 'Shen Liefeng', 2],
        // `her` was recorded here as `undefined` when this test was written,
        // because that is what the parser did - not because a pronoun naming
        // nobody was ever the ruling. It is a POINTER, and dropping it sent the
        // stones to the first row of the crowd order. See
        // `the-person-you-hand-it-to-is-the-one-you-named.test.ts`.
        ['I hand her the two stones', 'her', 2],
        ['I give Shen Liefeng ten stones', 'Shen Liefeng', 10]
    ] as ReadonlyArray<readonly [string, string | undefined, number]>)(
        '%s', (said, who, count) => {
            const plan = parseIntent(said);
            expect(plan.action).toBe('give');
            expect(plan.target).toBe(who);
            expect(plan.stones).toBe(count);
        }
    );

    it.each([
        'I hand Shen Liefeng my manual',
        'I give him my last stones',
        'I hand over what I am carrying to her'
    ])('%s is a gift and not a taking', said => {
        const plan = parseIntent(said);
        expect(plan.action).toBe('give');
        expect(plan.intent).not.toBe('steal');
    });
});

describe('a gift has no price on it', () => {
    it('is not a gift the moment the sentence says what is wanted back', () => {
        // "I give him ten stones for the manual" is a purchase. A gift with a
        // price on it is the one thing this verb must never take, because the
        // whole of what it leaves - an account opened without leverage -
        // depends on nothing having been asked for.
        expect(whatIsBeingHandedOver('I give him ten stones for the manual')).toBeNull();
        expect(parseIntent('I give him ten stones for the manual').action).not.toBe('give');
        expect(whatIsBeingHandedOver('I offer what I have in exchange')).toBeNull();
    });
});

describe('and the verbs next door keep what they reach', () => {
    it.each([
        ['I donate 100 spirit stones to the sect', 'sect'],
        ['I give my word to the Azure Dew Sect', 'oath'],
        ['I make an offering', 'offer']
    ])('%s stays %s', (said, want) => {
        expect(parseIntent(said).action).toBe(want);
    });

    it.each([
        'I put in real practice at the method',
        'I put hours into the technique I know',
        'I put my case to the elders'
    ])('does not turn %s into a gift', said => {
        // `put` and `leave` were on the giving verb list for one run of the
        // sweep and cost these three of the corpus's own exemplars. `put` is
        // one of the commonest verbs in English and `leave` belongs to
        // `legacyStep` and to `move`; the sentence `put` was wanted for has its
        // own shape below, with the table in it.
        expect(parseIntent(said).action).not.toBe('give');
    });

    it('leaves a question put to somebody a question', () => {
        // `press` is an asking verb AND half of the commonest way anybody says
        // a gift. The veto is on `into <somebody>`, which cannot be a question,
        // rather than on the whole giving read - which also matches this.
        expect(parseIntent('can I press Bai Jinglu about the Azure Dew Sect').action)
            .toBe('interact');
        expect(parseIntent('I press it into her hand').action).toBe('give');
    });
});

describe('what the engine does with it', () => {
    it('moves stones, spends no day, and opens a favour', () => {
        const out = handOver(deps(), 'the purse', undefined);
        expect(out.refused).toBe(false);
        expect(out.stones).toBe(40);
        expect(out.favour?.kind).toBe('favor');
        expect(out.favour?.cause).toBe('gifted_resource');
        // The account opens the RIGHT way round, and this asserted the wrong
        // one. It read the two id columns and reasoned that "the holder" is
        // whoever is on the hook - which is true of every kind on this ledger
        // EXCEPT the one being written here. A favour is owed TO its holder,
        // so holding it about the giver put the giver in debt for the gift.
        // Asked through `whichWayItPoints`, which is the only thing allowed to
        // answer this: the taker owes.
        expect(out.favour?.holderId).toBe('me');
        expect(out.favour?.subjectId).toBe('npc-1');
        const points = whichWayItPoints(out.favour!);
        expect(points.sense === 'owes' ? points.owerId : null).toBe('npc-1');
    });

    it('refuses more stones than are in the purse, and names the figure', () => {
        const out = handOver(deps(), 'stones', 400);
        expect(out.refused).toBe(true);
        expect(out.facts.headline).toContain('40');
    });

    it('resolves the thing against the pouch and nothing else', () => {
        const out = handOver(deps(), 'the grass', undefined);
        expect(out.refused).toBe(false);
        expect(out.lot?.itemId).toBe('herb-qi-grass');
    });

    it('refuses a tie rather than guessing which thing they meant', () => {
        const two = deps({
            pouch: [
                { itemId: 'pill-a', kind: 'pill', quantity: 1, name: 'Lesser Healing Pill' },
                { itemId: 'pill-b', kind: 'pill', quantity: 1, name: 'Greater Healing Pill' }
            ]
        });
        expect(theLotTheyMeant('healing', two.pouch)).toBe('ambiguous');
        const out = handOver(two, 'the healing pill', undefined);
        expect(out.refused).toBe(true);
        expect(out.facts.lines[0]).toContain('Lesser Healing Pill');
    });

    it('names the room when nobody is there to take it', () => {
        const out = handOver(
            deps({ recipient: null, othersHere: ['Tao Chunxi', 'Ji Wanniang'] }),
            'the purse',
            undefined
        );
        expect(out.refused).toBe(true);
        expect(out.facts.lines[0]).toContain('Tao Chunxi');
    });

    it('refuses a held copy of an art by name, and says where the road is', () => {
        // The third tier, and it does not fall out cheaply. A copy of a manual
        // is a knowledge row with a provenance rather than a counted pouch row,
        // so it cannot move on this verb's two-row arithmetic, and the person
        // in front of the player has no flag to hold one in. Refused by name
        // rather than as "you are not carrying that", which would be a lie.
        const out = handOver(
            deps({ heldArts: ['Lesser Qi-Gathering Manual'] }),
            'the manual',
            undefined
        );
        expect(out.refused).toBe(true);
        expect(out.facts.headline).toContain('Lesser Qi-Gathering Manual');
        expect(out.facts.lines[0]).toContain('writing it out');
    });
});

/**
 * A name the game printed is a name the player can type - the pill half.
 *
 * The Heaven-Ascending Golden Pill became a spendable item and the game began printing its
 * name, and the class noun was still required:
 *
 *   I take the Heaven-Ascending Golden Pill      -> unclear
 *   I swallow the Heaven-Ascending Golden Pill   -> unclear
 *   I take the pill               -> consume_pill
 *
 * The only sentence that reached the effect was the one that did not name the
 * thing. The catalog pattern was already in this file for the petition branch.
 */
describe('a consumable is reachable by its own name', () => {
    it.each([
        'I take the Heaven-Ascending Golden Pill',
        'I swallow the Heaven-Ascending Golden Pill',
        'I use the Root-Recasting Talisman'
    ])('%s reaches the effect', said => {
        expect(parseIntent(said).action).toBe('consume_pill');
    });

    it('still needs the taking verb, so naming one is not taking one', () => {
        expect(parseIntent('what is the Heaven-Ascending Golden Pill').action).not.toBe('consume_pill');
        expect(parseIntent('I ask the Court for the Heaven-Ascending Golden Pill').action).toBe('petition');
        expect(parseIntent('I petition for the Heaven-Ascending Golden Pill').action).toBe('petition');
    });
});

/**
 * A refusal that said only what was missing.
 *
 * FOUND BY MEASURING REFUSALS. `scripts/probe-what-a-refusal-is-still-for.ts`
 * put `give` at 30 chosen, 24 refused, and two of the four sentences behind it
 * carry no object out of the reader at all:
 *
 *     I hand her everything I have
 *     I let him keep it
 *
 * Both arrive as `give()` with an empty `thing`, and the answer was the gap and
 * nothing else - *"the something is the part that was not said"*. The player is
 * holding the answer to the question they were just asked, and the same list
 * `inventory` prints one sentence away was already in `deps`.
 *
 * This does not make either sentence work - carrying the object out of them is
 * the reader's half, and it is not done here. It turns a dead end into a turn
 * the player can answer, which is what a surviving refusal owes them.
 */
describe('naming no object at all', () => {
    it('says what could have gone in the hand', () => {
        const out = handOver(deps(), '', undefined);
        expect(out.refused).toBe(true);
        // The pouch row and the purse, both read off what the giver holds
        // rather than hard-coded: any name the game prints it must accept.
        expect(out.facts.prose).toContain('Qi Gathering Grass');
        expect(out.facts.prose).toMatch(/spirit stones \(40\)/);
    });

    it('says so plainly when there is genuinely nothing', () => {
        const out = handOver(
            deps({
                pouch: [],
                giver: { id: 'me', name: 'Wen Shuyi', spiritStones: 0 } as unknown as Cultivator
            }),
            '',
            undefined
        );
        expect(out.refused).toBe(true);
        expect(out.facts.prose).toMatch(/carrying nothing and your purse is empty/i);
    });

    it('spends nothing either way', () => {
        const out = handOver(deps(), '', undefined);
        expect(out.stones).toBe(0);
        expect(out.lot).toBeNull();
        expect(out.favour).toBeNull();
        expect(out.facts.structure.join(' ')).toMatch(/no time passed/i);
    });
});
