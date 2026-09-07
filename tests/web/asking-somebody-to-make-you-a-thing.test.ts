/**
 * Asking somebody to make you something, which the engine has always been able
 * to answer and nothing has ever asked it.
 *
 * The design owner: *"you should be able to ask your master to cut a slip or
 * craft something for you. And you should also be able to pay someone either $
 * or trade in expensive $ to do it. And you should also be able to do the flip
 * side and do these yourself."*
 *
 * PLAYED, BEFORE ANY OF THIS. "I ask my master to craft me a talisman" filed a
 * REQUISITION AGAINST A HOUSE and answered with a list of sect names, because
 * `STANDING_STOCK_NOUNS` holds "talisman" and `PETITION_ASKING_VERBS` holds
 * "ask". "I make a talisman myself" was not recognised at all. And
 * `commissioning-a-craft.ts` - which answers every part of this properly - was
 * reachable only from a barrel re-export, with no caller anywhere in the game.
 * A module nothing calls is not a feature.
 *
 * WHAT IS WIRED HERE IS THE ASK. The thing is not handed over: a commissioned
 * talisman is a tracked world object rather than a counted pouch row, and
 * bridging those is its own piece of work. What a player gets is the answer -
 * whether those hands can, what it comes to, and what is still short.
 */

import { describe, expect, it } from 'vitest';
import { makeGame } from './harness';
import { parseIntent } from '../../src/web/actions';
import { requestPutToSomebody } from '../../src/web/what-a-request-asks-and-of-whom';
import {
    gradeAskedFor,
    whatTheyWereAskedToMake
} from '../../src/web/what-somebody-was-asked-to-make';

describe('the sentence reaches the hands', () => {
    it('is a request put to a person, not a form filed against a house', () => {
        // The exact sentence the design owner asked for, and the exact one that
        // came back with a list of sect names.
        const plan = parseIntent('I ask my master to craft me a talisman');
        expect(plan.action).toBe('request');
        expect(plan.intent).toBe('a_making');
        expect(plan.target).toBe('my master');
        expect(plan.topic).toBe('talisman');
    });

    it('and reads cutting a slip the same way', () => {
        const plan = parseIntent('I ask my master to cut me a slip');
        expect(plan.action).toBe('request');
        expect(plan.intent).toBe('a_making');
    });

    it('and asking to be TAUGHT to make one is still teaching', () => {
        // The near miss that would have swallowed a different feature.
        const asked = requestPutToSomebody('I ask my master to teach me to cut a slip');
        expect(asked?.kind).toBe('teaching');
    });

    it('and asking for one they are already holding is not a commission', () => {
        // A thing in their hand costs them the thing. A thing they have to make
        // costs them a season, and the two are priced by different machinery.
        const asked = requestPutToSomebody('I ask Elder Fang for a talisman');
        expect(asked?.kind).toBe('a_thing');
    });

    it('and money on the table is still a commission', () => {
        const asked = requestPutToSomebody('I pay Elder Fang 400 stones to make me a talisman');
        expect(asked?.kind).toBe('a_making');
        expect(asked?.person).toBe('Elder Fang');
    });
});

describe('what the words said was wanted', () => {
    it('reads the grade off them, and the cheapest one when they say none', () => {
        // Never the dearest reading of an ambiguous sentence: a player who says
        // "a talisman" is asking for a talisman, and answering with the price
        // of an immortal one would be the engine picking their pocket.
        expect(gradeAskedFor('a talisman')).toBe('mortal');
        expect(gradeAskedFor('an earth grade talisman')).toBe('earth');
        expect(gradeAskedFor('a heaven grade blade')).toBe('heaven');
        expect(gradeAskedFor('an immortal grade sword')).toBe('immortal');
    });

    it('and knows a slip from a made thing, and which kind of slip', () => {
        expect(whatTheyWereAskedToMake('a talisman').slip).toBe('a_strike');
        expect(whatTheyWereAskedToMake('a slip').slip).toBe('a_strike');
        // Both kinds exist. The sentence usually says which.
        expect(whatTheyWereAskedToMake('a talisman that gets me out of here').slip)
            .toBe('a_way_out');
        expect(whatTheyWereAskedToMake('a sword').slip).toBeUndefined();
    });
});

describe('and the answer is the one the engine already had', () => {
    async function askedOf(seed: string, said: (name: string) => string) {
        const { game, repos, db } = makeGame({ seed, worldEnabled: true });
        const { cultivator } = await game.newRun('Apprentice');
        repos.sects.addMember('sect-azure-cloud-pavilion', cultivator.id, 1);
        db.prepare('UPDATE cultivators SET spirit_stones = 9000 WHERE id = ?')
            .run(cultivator.id);
        await game.act('I look around');
        const here = await game.act('who is here') as unknown as { narration: string };
        const name = /^([A-Z]\w+ \w+)/.exec(here.narration)?.[1];
        expect(name, 'nobody was here to ask').toBeDefined();
        const answer = await game.act(said(name!)) as unknown as {
            narration: string;
            toolCalls: { name: string; summary: string }[];
        };
        return {
            name: name!,
            narration: answer.narration,
            structure: answer.toolCalls.map(c => c.summary).join(' ')
        };
    }

    it('names the realm to reach for when the hands cannot', async () => {
        // Every refusal names its own route, which is the whole point of the
        // four the module distinguishes. "No" would be useless.
        const asked = await askedOf(
            'craft-cannot', n => `I ask ${n} to craft me an earth grade talisman`
        );
        expect(asked.narration).toMatch(/cannot make it/i);
        expect(asked.narration).toMatch(/Core Formation/i);
    }, 300_000);

    it('and says what it comes to when nothing was put down', async () => {
        const asked = await askedOf('craft-price', n => `I ask ${n} to cut me a talisman`);
        expect(asked.narration).toMatch(/spirit stones/i);
        expect(asked.narration).toMatch(/covers 0%/i);
    }, 300_000);

    it('and paying in full is not the same as being agreed to', async () => {
        // THE CLAIM IS THAT IT VARIES, which is the whole design: a season of
        // somebody's hands is not something a figure settles on its own, so the
        // same money put to different people comes back differently. A rule
        // that always said yes would make the tie decorative and one that
        // always said no would make the verb pointless.
        //
        // And where it IS refused with the figure met, the player is told what
        // is actually short rather than being left to guess at the number.
        let agreed = 0;
        let refused = 0;
        for (const seed of ['paid-a', 'paid-b', 'paid-c', 'paid-d', 'paid-e', 'paid-f']) {
            const asked = await askedOf(
                seed, n => `I pay ${n} 400 stones to cut me a talisman`
            );
            if (/will make it/i.test(asked.narration)) {
                agreed++;
                continue;
            }
            refused++;
            expect(asked.narration).toMatch(/covers 100%/i);
            expect(asked.narration, 'refused with the figure met and no reason given')
                .toMatch(/regard/i);
        }
        expect(agreed + refused).toBe(6);
        expect(agreed, 'nobody ever agreed, so the verb cannot be used').toBeGreaterThan(0);
        expect(refused, 'everybody agreed, so the tie is decorative').toBeGreaterThan(0);
    }, 900_000);

    it('and it costs the asker nothing to have asked', async () => {
        // Asking is free. What it spends is their patience, which is the
        // ledger's business and not the clock's.
        const { game, repos, db } = makeGame({ seed: 'craft-free', worldEnabled: true });
        const { cultivator } = await game.newRun('Apprentice');
        repos.sects.addMember('sect-azure-cloud-pavilion', cultivator.id, 1);
        db.prepare('UPDATE cultivators SET spirit_stones = 9000 WHERE id = ?')
            .run(cultivator.id);
        await game.act('I look around');
        const before = repos.cultivators.getById(cultivator.id)!;
        const here = await game.act('who is here') as unknown as { narration: string };
        const name = /^([A-Z]\w+ \w+)/.exec(here.narration)?.[1];
        if (!name) return;
        await game.act(`I ask ${name} to cut me a talisman`);
        const after = repos.cultivators.getById(cultivator.id)!;
        expect(after.spiritStones).toBe(before.spiritStones);
    }, 300_000);
});
