/**
 * A PLAYER COULD BE GIVEN A PARTY AND COULD NOT ASK FOR ONE.
 *
 * Travelling together worked: `move`, `ride` and `passage` carry whoever is on
 * the road with you, `fold` refuses while anybody is, and who that is has never
 * been stored - it is read off each companion's own `out_with_a_party` activity.
 * The only thing that ever WROTE one of those from the played side was a house
 * ASSIGNING an escort. There was no sentence anybody could type to ask a person
 * to come, and `RequestKind` had no member for it, so every phrasing of it fell
 * through to the thing-fallback and was answered as a negotiation about an
 * object nobody had named.
 *
 * ── THE WEIGHT IS THE DESIGN ─────────────────────────────────────────────
 *
 * `advancement` is `against_their_interest` and that one choice is why money
 * refuses on its own: `PURSE_REACH` at that weight is 0.2, which is where
 * `whatTheyWillTakeFor` stops taking money at all. Asking somebody to walk a
 * road with you is not that. It costs them their DAYS and leaves them no worse
 * off, which is `a_real_favour`'s own definition - and at that weight `PURSE_
 * REACH` is 0.6, so an escort can be hired where a rung cannot be bought, and
 * `DISPOSITION_REACH` is 1, its only entry above 0.35, so an open-handed person
 * says yes more often. Nothing below writes a rule about who would come: every
 * term of it was already in the resolver.
 *
 * ── WHAT THESE PIN ───────────────────────────────────────────────────────
 *
 *   The sentence reaches the ask, in both the form that names somebody and the
 *   form said to their face, and a term and a destination are read off it.
 *   The weight, and the two reach figures that follow from it.
 *   A refusal that a request cannot get past - they are already out with
 *   somebody - names when that ends, which is what would change it.
 *   PLAYED: a yes writes the activity and writes no roster; the party is on the
 *   status read with its term; travelling carries them; a fold will not.
 *
 * They do NOT pin who says yes, how likely one is, or any name or place: all
 * four are the world's and the resolver's, and pinning any of them would fail
 * the next time a seed moves somebody.
 *
 * RED-CHECKED: disabling the `company` branch of `whatTheyAgreedTo` leaves both
 * played tests failing with nobody ever put on a road; returning
 * `against_their_interest` from `baseWeightOf` fails the weight test on the
 * purse reach, which is the figure the whole choice was made on.
 *
 * And one thing the red check found rather than confirmed: taking `company` out
 * of `REQUEST_KINDS` in `asking-verbs.ts` changes NOTHING here, because a plan
 * whose intent that set rejects falls back to re-reading the sentence, which
 * answers `company` anyway. That set is load-bearing only for a model that
 * emits the label against a sentence the table cannot read, so nothing in this
 * file can hold it.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions.js';
import {
    baseWeightOf,
    requestPutToSomebody,
    whereACompanyAskIsBound
} from '../../src/web/what-a-request-asks-and-of-whom.js';
import { whatItWouldCostThem } from '../../src/web/what-asking-this-person-for-this-would-cost-them.js';
import { LEVERAGE_ATTEMPT_CONSTANTS } from '../../src/engine/social-leverage/index.js';
import { A_SEASON_ON_THE_ROAD } from '../../src/engine/world/who-is-on-the-road-with-you.js';
import { makeGameInWorld, type Harness } from './harness.js';

describe('the sentence that asks somebody to come', () => {
    it('reads as its own kind of ask, whoever it names', () => {
        expect(requestPutToSomebody('I ask Jiang Anyi to come with me')?.kind).toBe('company');
        expect(requestPutToSomebody('I beg Jiang Anyi to travel with me')?.kind).toBe('company');
        // The design owner's own word for the act, which was not an asking verb
        // at all before this and reached nothing.
        expect(requestPutToSomebody('I invite Jiang Anyi to come along')?.kind).toBe('company');
        expect(requestPutToSomebody('I ask Jiang Anyi to come with me')?.person)
            .toBe('Jiang Anyi');
    });

    it('is not the ask beside it', () => {
        expect(requestPutToSomebody('I ask Jiang Anyi to teach me')?.kind).toBe('teaching');
        expect(requestPutToSomebody('I ask Jiang Anyi to promote me')?.kind).toBe('advancement');
        // The courtesy that asks for nothing owns the drink, and always did.
        expect(requestPutToSomebody('I ask Jiang Anyi to join me for a drink')?.kind)
            .not.toBe('company');
    });

    /**
     * The way anybody actually asks: turn to the person already in front of you
     * and say it, with no asking verb and no name. `requestPutToSomebody` needs
     * both, which is the same gap the `give me the manual` branch was written
     * for. No target, because naming somebody the sentence did not name is a
     * guess - whoever is being spoken to is resolved downstream.
     */
    it('reaches the ask when it is said to somebody\'s face', () => {
        const plan = parseIntent('come with me');
        expect(plan.action).toBe('request');
        expect(plan.intent).toBe('company');
        expect(plan.target).toBeUndefined();
        expect(parseIntent('will you come with me').intent).toBe('company');
        expect(parseIntent('join me').intent).toBe('company');
    });

    /** Going somewhere with somebody else is not asking them to come. */
    it('leaves travelling alone', () => {
        expect(parseIntent('I travel with her to the ruins').action).toBe('move');
    });

    it('reads where the party is bound, and for how long', () => {
        const plan = parseIntent('I ask Jiang Anyi to come with me to the Salt Road for a month');
        expect(plan.intent).toBe('company');
        expect(plan.topic).toBe('Salt Road');
        expect(plan.days).toBe(30);
    });

    /**
     * A DESTINATION IS ONLY A DESTINATION WHEN IT WAS POINTED AT. Taking
     * everything after the phrase read "travel with me for a month" as a party
     * bound for a place called `month`.
     */
    it('does not read a span as a place', () => {
        expect(whereACompanyAskIsBound('to travel with me for a month')).toBeUndefined();
        expect(whereACompanyAskIsBound('to come with me to the Salt Road')).toBe('Salt Road');
    });
});

describe('what being asked along costs the person asked', () => {
    /**
     * The one choice this whole ask turns on. Their days, not their standing.
     */
    it('is a real favour, and that is what lets money reach it', () => {
        expect(baseWeightOf('company')).toBe('a_real_favour');

        const purse = LEVERAGE_ATTEMPT_CONSTANTS.PURSE_REACH;
        const grain = LEVERAGE_ATTEMPT_CONSTANTS.DISPOSITION_REACH;
        // A road walked for hire is ordinary in this genre and a bought rung is
        // not, and the whole of that difference is these two figures.
        expect(purse[baseWeightOf('company')])
            .toBeGreaterThan(purse[baseWeightOf('advancement')]);
        // And who somebody IS reaches it further than anything else does.
        expect(grain[baseWeightOf('company')]).toBeGreaterThan(grain.against_their_interest);
        expect(grain[baseWeightOf('company')]).toBeGreaterThan(grain.a_courtesy);
    });

    const ASKER = {
        id: 'asker', name: 'Asker', ordinal: 1, factionId: null, holds: []
    };
    const ASKED = {
        id: 'them', name: 'Them', ordinal: 3, factionId: null, holds: []
    };

    it('names the term and the road when nobody else has a claim on them', () => {
        const costing = whatItWouldCostThem({
            kind: 'company',
            asking: ASKER,
            asked: ASKED,
            where: { outWith: null, otherwiseAt: null },
            bound: 'the Salt Road',
            forDays: A_SEASON_ON_THE_ROAD
        });
        expect(costing.refusal).toBeNull();
        expect(costing.ask).toBe('a_real_favour');
        expect(costing.lines.join(' ')).toContain('the Salt Road');
        expect(costing.lines.join(' ')).toContain(`${A_SEASON_ON_THE_ROAD} days`);
    });

    /**
     * The one thing a request to come along cannot get past, and it is not a
     * judgement: a body is in one party at a time. Read off the same activity
     * row the party itself is read off.
     */
    it('cannot be put to somebody already out with a party, and says when that ends', () => {
        const costing = whatItWouldCostThem({
            kind: 'company',
            asking: ASKER,
            asked: ASKED,
            where: {
                outWith: {
                    withIds: ['somebody-else'],
                    untilDay: 240,
                    note: 'Out for the house on a tribute run.'
                },
                otherwiseAt: null
            },
            forDays: A_SEASON_ON_THE_ROAD
        });
        expect(costing.refusal).not.toBeNull();
        // A refusal names what would have changed it. Here that is a day.
        expect(costing.refusal!.prose).toContain('240');
        expect(costing.refusal!.prose).toContain('tribute run');
    });

    it('says so rather than asking twice when they are already with you', () => {
        const costing = whatItWouldCostThem({
            kind: 'company',
            asking: ASKER,
            asked: ASKED,
            where: {
                outWith: { withIds: [ASKER.id], untilDay: 118, note: 'On the road.' },
                otherwiseAt: null
            },
            forDays: A_SEASON_ON_THE_ROAD
        });
        expect(costing.refusal).not.toBeNull();
        expect(costing.refusal!.headline).toContain('already with you');
        expect(costing.refusal!.prose).toContain('118');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PLAYED
//
// The parse is half a verb. Everything below drives the real endpoint in a
// world pinned by its own seed as well as the run's, because a module nothing
// reaches by a typed sentence is not a feature.
// ─────────────────────────────────────────────────────────────────────────

/** Somebody standing here whose name the game itself printed. */
async function anybodyNameable(harness: Harness): Promise<string | null> {
    const said = await harness.game.act('who can teach me') as { narration?: string };
    for (const line of (said.narration ?? '').split(String.fromCharCode(10))) {
        const hit = /^(.+?) stands at .*? above you/.exec(line.trim());
        if (hit) return hit[1];
    }
    return null;
}

/**
 * Ask until one lands.
 *
 * The odds start near the floor for a nobody asking a stranger for a real
 * favour, which is the design rather than a bug, so this asks repeatedly rather
 * than pinning a roll. What is asserted is what happens WHEN one lands.
 */
async function untilSomebodyComes(harness: Harness, sentence: string): Promise<{
    yes: { narration?: string; toolCalls: { name: string; summary: string; ok: boolean }[] } | null;
    no: { narration?: string } | null;
}> {
    let yes = null;
    let no = null;
    for (let i = 0; i < 80; i++) {
        const live = harness.game.currentRun();
        if (live.run.status !== 'active' || !live.cultivator.alive) break;
        // ARRANGED, NOT PLAYED. Eighty asks is eight months, and a cultivator
        // who starves halfway through is measuring hunger rather than this. The
        // repetition is the harness's; nothing about the ask is touched.
        harness.db.prepare('UPDATE cultivators SET satiety = 100, starvation_turns = 0 WHERE id = ?')
            .run(live.cultivator.id);
        const said = await harness.game.act(sentence) as {
            narration?: string;
            toolCalls: { name: string; summary: string; ok: boolean }[];
        };
        const put = (said.toolCalls ?? []).find(call => call.name === 'world.takeThemWithYou');
        if (put?.ok) { yes = said; if (no) break; } else if (!no) { no = said; }
        if (yes) break;
    }
    return { yes, no };
}

describe('asking somebody along, played', () => {
    it('puts them on the road, names them afterwards, and stores no roster', async () => {
        const harness = await makeGameInWorld({
            seed: 'come-along-1', worldSeed: 'come-along-world-1'
        });
        await harness.game.newRun('Asker');
        const who = await anybodyNameable(harness);
        expect(who, 'the pinned world put nobody nameable in the square').not.toBeNull();

        const { yes, no } = await untilSomebodyComes(
            harness, `I ask ${who} to come with me for five days`
        );
        expect(yes, 'nobody agreed in eighty asks').not.toBeNull();

        // WHAT ACTUALLY HAPPENED, on the channel that shows the engine's own
        // account. The claim this design rests on is in it.
        const put = yes!.toolCalls.find(call => call.name === 'world.takeThemWithYou')!;
        expect(put.summary).toContain('out_with_a_party');
        expect(put.summary).toContain('no roster was written');

        // AND IT IS A THING THE ENGINE CAN STATE. Same reading, said rather
        // than used, on the read a player asks with "how am I doing".
        const sheet = await harness.game.act('how am I doing') as { narration?: string };
        expect(sheet.narration ?? '').toContain(who!);
        expect(sheet.narration ?? '').toMatch(/on the road with you/);

        // AND ASKING AGAIN IS NOT A SECOND PARTY.
        const again = await harness.game.act(`I ask ${who} to come with me`) as {
            narration?: string;
        };
        expect(again.narration ?? '').toMatch(/already/i);

        // A refusal names what would have worked. Whatever the roll was, the
        // sentence that came back before the yes has the next move in it.
        if (no) {
            expect(no.narration ?? '').toMatch(
                /buy them a drink|sit with them|wanting nothing|Standing in a house/
            );
        }
    }, 300_000);

    /**
     * `fold` refuses while anybody is with you, and the refusal is
     * `CapabilityGrant.spatial_folding` read out. It was reachable only through
     * a house's escort before; now a player can make it happen.
     */
    it('leaves a fold refusing, because a fold takes one body', async () => {
        const harness = await makeGameInWorld({
            seed: 'come-along-2', worldSeed: 'come-along-world-1'
        });
        await harness.game.newRun('Asker');
        const who = await anybodyNameable(harness);
        expect(who).not.toBeNull();

        const { yes } = await untilSomebodyComes(
            harness, `I ask ${who} to come with me for five days`
        );
        expect(yes, 'nobody agreed in eighty asks').not.toBeNull();

        const folded = await harness.game.act('I fold space to Bronze Bell Cliff') as {
            narration?: string;
        };
        expect(folded.narration ?? '').toContain(who!);
        expect(folded.narration ?? '').toMatch(/not a passenger, at any size/);
    }, 300_000);
});
