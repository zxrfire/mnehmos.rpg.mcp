import { describe, expect, it } from 'vitest';

import {
    askingWhatItWouldTake,
    baseWeightOf,
    puttingSomethingDownFor,
    requestPutToSomebody
} from '../../src/web/what-a-request-asks-and-of-whom.js';

/**
 * THE SENTENCE THE DESIGN OWNER ASKED FOR, AND THE WAYS SOMEBODY WRITES IT.
 *
 * `AGENTS.md`: *"if a near-synonym works, the phrasing that fails is a bug."*
 * Every one of these reached `{"action":"unclear"}` or resolved a party whose
 * name had half the sentence stuck to it before this existed.
 */
describe('asking what it would take', () => {
    const named: readonly [string, string, string][] = [
        [
            'ask Elder Xu what she wants for a Meridian Rebirth Pill',
            'Elder Xu', 'Meridian Rebirth Pill'
        ],
        [
            'I ask Elder Xu her price for a Meridian Rebirth Pill',
            'Elder Xu', 'Meridian Rebirth Pill'
        ],
        [
            'ask Elder Xu how much she wants for the Meridian Rebirth Pill',
            'Elder Xu', 'Meridian Rebirth Pill'
        ],
        [
            'ask Elder Xu what it would take for a Meridian Rebirth Pill',
            'Elder Xu', 'Meridian Rebirth Pill'
        ],
        [
            'what would Elder Xu take for a Meridian Rebirth Pill',
            'Elder Xu', 'Meridian Rebirth Pill'
        ],
        [
            'what would Elder Xu accept in exchange for a Meridian Rebirth Pill',
            'Elder Xu', 'Meridian Rebirth Pill'
        ],
        [
            "what is Elder Xu's price for a Meridian Rebirth Pill",
            'Elder Xu', 'Meridian Rebirth Pill'
        ],
        [
            'what would it take to get a Meridian Rebirth Pill from Elder Xu',
            'Elder Xu', 'Meridian Rebirth Pill'
        ]
    ];

    for (const [sentence, person, thing] of named) {
        it(`reads a person and a thing out of "${sentence}"`, () => {
            const read = askingWhatItWouldTake(sentence);
            expect(read).not.toBeNull();
            expect(read?.kind).toBe('terms');
            expect(read?.person).toBe(person);
            expect(read?.object).toBe(thing);
        });
    }

    /**
     * The owner's own words, which name nobody because they are said to
     * whoever you are dealing with. `someone` is a member of `POINTING` in
     * `game.ts`, so it resolves to a face the player could walk up to - the
     * same way every other nameless approach in the game resolves.
     */
    it("takes the owner's own sentence, which names nobody", () => {
        for (const sentence of [
            "I need a Meridian Rebirth Pill, what's your price?",
            'I need a Meridian Rebirth Pill. What is your price?',
            'I am after a Meridian Rebirth Pill - what would be your price for it?'
        ]) {
            const read = askingWhatItWouldTake(sentence);
            expect(read, sentence).not.toBeNull();
            expect(read?.kind).toBe('terms');
            expect(read?.object).toBe('Meridian Rebirth Pill');
            expect(read?.person).toBe('someone');
        }
    });

    it('is reached through the parser everything else is reached through', () => {
        const read = requestPutToSomebody('what would Elder Xu take for a Meridian Rebirth Pill');
        expect(read?.kind).toBe('terms');
    });

    /** Asking a price costs them a sentence, which is what a courtesy is. */
    it('weighs as a courtesy', () => {
        expect(baseWeightOf('terms')).toBe('a_courtesy');
    });

    // ── AND IT STEALS NOTHING ────────────────────────────────────────────
    //
    // `AGENTS.md` records what happened the last time a pattern in this file
    // was widened: it took sentences from `investigate` and from place
    // resolution. Every sentence below reached something before and must reach
    // the same thing now.
    it('leaves every neighbouring sentence exactly where it was', () => {
        const unchanged: readonly [string, string | null][] = [
            ['I ask Jiang Anyi to teach me the Iron Bell', 'teaching'],
            ['ask Jiang Anyi for the Lesser Qi-Gathering Manual', 'a_thing'],
            ['I bribe Han Peiru with 60 spirit stones to teach me', 'teaching'],
            ['I buy Han Peiru a drink', 'nothing'],
            ['beg Jiang Anyi to take me as a disciple', 'discipleship'],
            ['ask Jiang Anyi to introduce me to the elder', 'introduction'],
            // Questions rather than requests, which have their own machinery.
            ['I ask her about the ruins', null],
            ['what does she know about the vein', null],
            ['who can teach me', null],
            ['what is she carrying', null],
            // A bribe with a sum and no object keeps its own guiding refusal.
            ['I bribe the gate steward', null]
        ];

        for (const [sentence, kind] of unchanged) {
            expect(requestPutToSomebody(sentence)?.kind ?? null, sentence).toBe(kind);
        }
    });
});

describe('putting something down that is not money', () => {
    const trades: readonly [string, string, string, string][] = [
        [
            'I offer Elder Xu the Iron Bell Manual for a Meridian Rebirth Pill',
            'Elder Xu', 'Iron Bell Manual', 'Meridian Rebirth Pill'
        ],
        [
            'trade Elder Xu the Iron Bell Manual for the Meridian Rebirth Pill',
            'Elder Xu', 'Iron Bell Manual', 'Meridian Rebirth Pill'
        ],
        [
            'I offer Elder Xu a favour owed in exchange for a Meridian Rebirth Pill',
            'Elder Xu', 'favour owed', 'Meridian Rebirth Pill'
        ],
        [
            'offer Elder Xu a place for her daughter in return for the Meridian Rebirth Pill',
            'Elder Xu', 'place for her daughter', 'Meridian Rebirth Pill'
        ]
    ];

    for (const [sentence, person, put, wanted] of trades) {
        it(`reads both halves of "${sentence}"`, () => {
            const read = puttingSomethingDownFor(sentence);
            expect(read, sentence).not.toBeNull();
            expect(read?.kind).toBe('a_trade');
            expect(read?.person).toBe(person);
            expect(read?.putDown).toBe(put);
            expect(read?.object).toBe(wanted);
        });
    }

    /**
     * One object is one of the shapes that already worked. A sentence that
     * names a sum and nothing to spend it on keeps its own answer, which says
     * what the sentence with an object looks like.
     */
    it('takes nothing that has only one object in it', () => {
        for (const sentence of [
            'I offer Han Peiru 60 spirit stones',
            'I offer Han Peiru 60 spirit stones to teach me',
            'give Han Peiru a gift'
        ]) {
            expect(puttingSomethingDownFor(sentence), sentence).toBeNull();
        }
    });

    /**
     * `items.md`: offering money above the line *"reads as not understanding
     * what you are looking at"*. That is a sentence somebody should get back,
     * so the parser must let the move be made rather than preventing it.
     */
    it('lets somebody offer stones for a thing stones do not buy', () => {
        const read = puttingSomethingDownFor(
            'I offer Elder Xu 400000 spirit stones for a Meridian Rebirth Pill'
        );
        expect(read?.kind).toBe('a_trade');
        expect(read?.putDown).toContain('400000');
    });

    it('is reached through the parser everything else is reached through', () => {
        const read = requestPutToSomebody(
            'I offer Elder Xu the Iron Bell Manual for a Meridian Rebirth Pill'
        );
        expect(read?.kind).toBe('a_trade');
    });
});
