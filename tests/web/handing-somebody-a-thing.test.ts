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
 * A favour the recipient holds about the giver. It is the only account in this
 * engine that opens WITHOUT leverage - every other route runs through
 * `resolveAttempt`, which prices what you leaned on - which is the whole reason
 * the sentence is worth typing, and the reason the owner's example uses it to
 * put stolen goods in somebody else's hands.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent, whatIsBeingHandedOver } from '../../src/web/actions';
import { handOver, theLotTheyMeant, type GiveDeps } from '../../src/web/handing-somebody-a-thing';
import type { Cultivator } from '../../src/schema/cultivation';

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
        // The account opens the RIGHT way round: the recipient holds it about
        // the giver, not the other way about.
        expect(out.favour?.holderId).toBe('npc-1');
        expect(out.favour?.subjectId).toBe('me');
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
                { itemId: 'pill-a', kind: 'pill', quantity: 1, name: 'Minor Healing Pill' },
                { itemId: 'pill-b', kind: 'pill', quantity: 1, name: 'Greater Healing Pill' }
            ]
        });
        expect(theLotTheyMeant('healing', two.pouch)).toBe('ambiguous');
        const out = handOver(two, 'the healing pill', undefined);
        expect(out.refused).toBe(true);
        expect(out.facts.lines[0]).toContain('Minor Healing Pill');
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
 * The Unearned Step became a spendable item and the game began printing its
 * name, and the class noun was still required:
 *
 *   I take the Unearned Step      -> unclear
 *   I swallow the Unearned Step   -> unclear
 *   I take the pill               -> consume_pill
 *
 * The only sentence that reached the effect was the one that did not name the
 * thing. The catalog pattern was already in this file for the petition branch.
 */
describe('a consumable is reachable by its own name', () => {
    it.each([
        'I take the Unearned Step',
        'I swallow the Unearned Step',
        'I use the Second Dealing'
    ])('%s reaches the effect', said => {
        expect(parseIntent(said).action).toBe('consume_pill');
    });

    it('still needs the taking verb, so naming one is not taking one', () => {
        expect(parseIntent('what is the Unearned Step').action).not.toBe('consume_pill');
        expect(parseIntent('I ask the Court for the Unearned Step').action).toBe('petition');
        expect(parseIntent('I petition for the Unearned Step').action).toBe('petition');
    });
});
