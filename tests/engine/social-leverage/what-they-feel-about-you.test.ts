/**
 * What one person feels about another, off the same rows that say what they are.
 *
 * The design owner:
 *
 *   > emotion needs to be tracked, that's where llm's are beautiful ... for
 *   > every npc you do stuff to, of course. and emotions can change - like if i
 *   > rob her, she's sad. if i kill her father she's despondent (and acts that
 *   > way) but if i give her something good, she's conflicted like why???
 *   >
 *   > this should fall out of what's available today
 *
 * Every case below is that sequence, and none of it is stored: the ledger
 * already holds what was done, and a feeling is a reading of it.
 */

import { describe, expect, it } from 'vitest';

import {
    ENOUGH_TO_MUDDY_IT,
    howTheyCarryIt,
    whatTheyFeelAboutYou
} from '../../../src/engine/social-leverage/what-they-feel-about-you';
import type { ObligationRecord, Severity } from '../../../src/engine/social/grudges';

const HER = 'her';
const ME = 'me';

let minted = 0;

/** One row of the ledger, in the shape the repository hands back. */
function row(over: Partial<ObligationRecord> & { kind: ObligationRecord['kind'] }): ObligationRecord {
    minted += 1;
    return {
        id: `row-${minted}`,
        holderId: HER,
        subjectId: ME,
        originHolderId: HER,
        cause: 'robbery',
        severity: 'serious' as Severity,
        incurredOnDay: minted,
        status: 'open',
        description: '',
        participants: [],
        tags: [],
        generation: 0,
        inheritance: [],
        triggeringEventId: `event-${minted}`,
        ...over
    } as ObligationRecord;
}

const feeling = (ledger: readonly ObligationRecord[]) =>
    whatTheyFeelAboutYou({ theirId: HER, aboutId: ME, ledger }).feeling;

describe('what she feels, deed by deed', () => {
    it('feels nothing about somebody nothing has passed with', () => {
        expect(feeling([])).toBe('nothing_either_way');
        expect(howTheyCarryIt(whatTheyFeelAboutYou({ theirId: HER, aboutId: ME, ledger: [] })))
            .toBeNull();
    });

    /** *if i rob her, she's sad* */
    it('is bitter about a robbery', () => {
        expect(feeling([row({ kind: 'grudge', cause: 'robbery', severity: 'serious' })]))
            .toBe('bitter');
    });

    /** And a small thing is a small thing, which is not the same feeling. */
    it('is only sore about something slight', () => {
        expect(feeling([row({ kind: 'grudge', cause: 'slander', severity: 'slight' })]))
            .toBe('sore');
    });

    /** *if i kill her father she's despondent* */
    it('is despondent about something that cannot be given back', () => {
        expect(feeling([row({ kind: 'grudge', cause: 'killed_kin', severity: 'grave' })]))
            .toBe('despondent');
    });

    it('reads the giving side with the same machinery', () => {
        expect(feeling([row({ kind: 'favor', cause: 'gifted_resource', severity: 'slight' })]))
            .toBe('warm');
        expect(feeling([row({ kind: 'favor', cause: 'sheltered', severity: 'serious' })]))
            .toBe('grateful');
        expect(feeling([row({ kind: 'favor', cause: 'saved_life', severity: 'grave' })]))
            .toBe('devoted');
    });
});

describe('and the case that is not a middle', () => {
    /**
     * *but if i give her something good, she's conflicted like why???*
     *
     * The whole reason taking and giving are two axes rather than one scale.
     * Somebody robbed and then given something good has not moved back along a
     * line towards neutral - they are holding two things at once.
     */
    it('is conflicted when both directions are heavy', () => {
        expect(feeling([
            row({ kind: 'grudge', cause: 'killed_kin', severity: 'grave' }),
            row({ kind: 'favor', cause: 'saved_life', severity: 'grave' })
        ])).toBe('conflicted');

        expect(howTheyCarryIt(whatTheyFeelAboutYou({
            theirId: HER,
            aboutId: ME,
            ledger: [
                row({ kind: 'grudge', cause: 'robbery', severity: 'serious' }),
                row({ kind: 'favor', cause: 'sheltered', severity: 'serious' })
            ]
        }))).toContain('two things about this one at once');
    });

    /**
     * AND A TOKEN DOES NOT BUY IT OFF. Twenty spirit stones against a robbery
     * is not a person in two minds, it is a person who was robbed and then
     * handed something. Measured in play: robbery 0.25 against a gift of 0.05,
     * and she stays bitter.
     */
    it('is not muddied by something small against something serious', () => {
        expect(feeling([
            row({ kind: 'grudge', cause: 'robbery', severity: 'serious' }),
            row({ kind: 'favor', cause: 'gifted_resource', severity: 'slight' })
        ])).toBe('bitter');
    });

    /** The threshold is lower than settling, because being confused is easier. */
    it('takes less to muddy somebody than to settle them', () => {
        expect(ENOUGH_TO_MUDDY_IT).toBeLessThan(1);
    });
});

describe('whose feeling it is', () => {
    /**
     * A grudge somebody is the SUBJECT of is a thing they DID, and what
     * somebody did is not what they feel about the person they did it to. That
     * is `personal-alignment.ts`'s question, and reading it here would have
     * every robber resenting the person they robbed.
     */
    it('never reads what they did as what they feel', () => {
        expect(feeling([
            row({ kind: 'grudge', holderId: ME, subjectId: HER, severity: 'grave' })
        ])).toBe('nothing_either_way');
    });

    it('ignores a settled account and anybody else\'s', () => {
        expect(feeling([row({ kind: 'grudge', status: 'settled' })])).toBe('nothing_either_way');
        expect(feeling([row({ kind: 'grudge', subjectId: 'somebody-else' })]))
            .toBe('nothing_either_way');
    });

    /**
     * Two people grieving one killing are one killing, and one deed copied to
     * four heirs is one deed. The same dedupe `personal-alignment.ts` does, and
     * for the same reason: without it a victim's family size prices the feeling.
     */
    it('counts a deed once however many rows carry it', () => {
        const one = { kind: 'grudge' as const, severity: 'serious' as Severity };
        const twice = [
            row({ ...one, triggeringEventId: 'the-same-night' }),
            row({ ...one, triggeringEventId: 'the-same-night' })
        ];
        expect(whatTheyFeelAboutYou({ theirId: HER, aboutId: ME, ledger: twice }).taken)
            .toBe(whatTheyFeelAboutYou({
                theirId: HER, aboutId: ME, ledger: [twice[0]!]
            }).taken);
    });
});
