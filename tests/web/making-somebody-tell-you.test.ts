/**
 * The third way the world reaches a player, and the two rules that keep it
 * honest.
 *
 *   "you can DEMAND knowledge. whether it succeeds is whether people respect
 *    you - either via power or something else."
 *
 * The failure mode this file exists to catch is a second resolver: a demand
 * that gets its own odds, its own terms and its own idea of what standing is,
 * drifting away from the pressure model within a month. So the first thing
 * asserted is that `resolveAttempt` is what settled it.
 *
 * The second is the line the coordinator drew and the design rests on:
 * a demand moves what somebody is WILLING to say, and can never move what they
 * hold. Somebody who does not know cannot be made to know.
 */

import { parseIntent } from '../../src/web/actions';
import { askedAbout } from '../../src/web/asked';
import { APPROACH_LEVERAGE_PRESSURE } from '../../src/schema/cultivation';
import {
    WHAT_A_BARE_DEMAND_IS_BACKED_BY,
    WHAT_A_WITHHELD_ANSWER_WEIGHS,
    nothingToBeGotFrom,
    whatLeaningOnThemCost,
    whatStandsInTheWay
} from '../../src/web/making-somebody-tell-you';
import type { Answer } from '../../src/web/asked';
import type { AttemptResult } from '../../src/engine/social-leverage/index';
import { makeGame, engineCalls } from './harness';

const answer = (patch: Partial<Answer>): Answer => ({
    reach: 'answers', couldKnow: true, lines: [], structure: [],
    teaches: false, introduces: false, ...patch
});

describe('which of the three limits is in the way', () => {
    it('reads a limit-one failure as nothing to be got', () => {
        expect(whatStandsInTheWay(answer({ reach: 'blank', couldKnow: false })))
            .toBe('they_do_not_know');
        // An attached speaker who cannot place the question deflects and STILL
        // does not know it. Reach alone would have got this one wrong, which is
        // why the predicate reads `couldKnow` first.
        expect(whatStandsInTheWay(answer({ reach: 'deflects', couldKnow: false })))
            .toBe('they_do_not_know');
    });

    it('reads a deflection from somebody who knows as withholding', () => {
        expect(whatStandsInTheWay(answer({ reach: 'deflects', couldKnow: true })))
            .toBe('they_are_withholding');
    });

    it('reads anybody who was going to answer as exactly that', () => {
        for (const reach of ['answers', 'partial', 'guesses'] as const) {
            expect(whatStandsInTheWay(answer({ reach })), reach).toBe('they_were_going_to_say_it');
        }
    });
});

describe('what a withheld answer weighs', () => {
    /**
     * Not `a_courtesy` - `AskWeight` calls that a name given freely, which is
     * the ordinary polite ask and is already free. And deliberately not
     * `against_their_interest`, which it was until it was measured: at that
     * weight the ask term outweighed the entire standing gap, so no amount of
     * power could ever carry a demand, which inverts the ruling. See the
     * constant for the figures.
     *
     * The guard that matters is the second one: whatever this is set to, the
     * standing gap has to be able to beat it, or "whether people respect you"
     * decides nothing.
     */
    it('is priced as a word put in somewhere, not as self-harm', () => {
        expect(WHAT_A_WITHHELD_ANSWER_WEIGHS).toBe('a_real_favour');
        expect(WHAT_A_WITHHELD_ANSWER_WEIGHS).not.toBe('a_courtesy');
    });

    /**
     * FOUND BY PLAYING, and it was the channel not working at all. A Void
     * Refinement cultivator leaning on somebody "plainly beneath notice" came
     * back refused at 18%, and the resolver's own account said why: "asked
     * interrogate with nothing on the table but the asking". The parser sets
     * `leverage` off words like bribe and threaten; a plain demand uses
     * neither, so every one of them went in at pressure zero and the ruling's
     * first half - "whether people respect you" - was never read.
     *
     * `name` is the enum member for the asker's own reputation, which is what a
     * demand with nothing else on the table actually rests on. Not `force`:
     * that is the credible ability to TAKE it, it is worth twice as much, and
     * it is a threat - a different sentence, which the parser already labels.
     */
    it('is backed by the reputation of whoever is demanding, and never by force', () => {
        expect(WHAT_A_BARE_DEMAND_IS_BACKED_BY).toBe('name');
        expect(APPROACH_LEVERAGE_PRESSURE[WHAT_A_BARE_DEMAND_IS_BACKED_BY]).toBe(1);
        expect(APPROACH_LEVERAGE_PRESSURE.force).toBeGreaterThan(
            APPROACH_LEVERAGE_PRESSURE[WHAT_A_BARE_DEMAND_IS_BACKED_BY]
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE LINE
// ─────────────────────────────────────────────────────────────────────────

describe('standing cannot reach into somebody\'s head', () => {
    const nobody = {
        id: 'npc-1', name: 'A Clerk', realmOrdinal: 2,
        sectId: 'azure-dew-sect', sectName: 'Azure Dew Sect', sectRank: 'Outer Disciple'
    } as never;
    const asker = { attributes: { charm: 3 }, realmOrdinal: 44 } as never;

    /**
     * The invariant, tested at the top of the ladder against the bottom of it.
     * A Tribulation Transcendent leaning on a clerk about something the clerk
     * has never heard of gets the same nothing as anybody else.
     */
    it('cannot compel an answer out of somebody who does not have one', () => {
        const asked = {
            asker, asked: nobody, speakerName: 'A Clerk',
            // The stratum test reads an ordinal off the subject's own
            // structure lines, so a house standing this far up is one an Outer
            // Disciple could not have heard anything true about.
            subject: {
                kind: 'sect', id: 'far-house', name: 'A Far House',
                facts: ['it exists'], structure: ['power ordinal 44']
            },
            rawTopic: 'a far house', holdsIt: false, priorDealings: 0
        } as never;

        const polite = askedAbout(asked);
        const leaned = askedAbout({ ...(asked as object), compelled: true } as never);

        expect(polite.couldKnow).toBe(false);
        expect(leaned.couldKnow).toBe(false);
        expect(leaned.teaches).toBe(false);
        // Byte-identical: `compelled` is read below limit one and cannot reach
        // this branch at all, which is the structural half of the guarantee.
        expect(leaned).toEqual(polite);
    });

    /**
     * And the case it CAN reach: somebody who knows it and is placed not to
     * say. That is limit two, and limit two is what standing is for.
     */
    it('turns a deflection from somebody who does know', () => {
        const asked = {
            asker, asked: nobody, speakerName: 'A Clerk',
            subject: { kind: 'sect', id: 'azure-dew-sect', name: 'Azure Dew Sect', facts: ['a small house'], structure: [] },
            rawTopic: 'azure dew', holdsIt: true, priorDealings: 0
        } as never;

        const polite = askedAbout(asked);
        const leaned = askedAbout({ ...(asked as object), compelled: true } as never);

        expect(polite.reach).toBe('deflects');
        expect(polite.teaches).toBe(false);
        expect(leaned.reach).not.toBe('deflects');
        expect(leaned.teaches).toBe(true);
        expect(leaned.structure.join(' ')).toContain('Compelled');
    });

    /**
     * And what a compelled answer is worth, which is deliberately less than a
     * friendship. Somebody made to talk says the least they can get away with.
     */
    it('gets the minimum out of somebody with a position', () => {
        const leaned = askedAbout({
            asker, asked: nobody, speakerName: 'A Clerk',
            subject: {
                kind: 'sect', id: 'azure-dew-sect', name: 'Azure Dew Sect',
                facts: ['a small house', 'on a thin vein', 'nine members'], structure: []
            },
            rawTopic: 'azure dew', holdsIt: true, priorDealings: 0, compelled: true
        } as never);

        expect(leaned.reach).toBe('partial');
        expect(leaned.lines.join(' ')).toContain('That is as far as it goes');
    });
});

describe('the refusal that is not about standing', () => {
    it('says what it is, and does not read like being turned down', () => {
        const copy = nothingToBeGotFrom('A Clerk', 'the Sill');
        expect(copy.prose).toContain('You can make a person talk. You cannot make them know.');
        expect(copy.structure).toContain('before the resolver ran');
        // It names what would work, which every refusal here owes the player.
        expect(copy.prose).toContain('Somebody who does hold it');
    });
});

describe('leaning on somebody is a different event from asking them', () => {
    const result = (outcome: string): AttemptResult =>
        ({ outcome, odds: 0.4, days: 1 } as never);

    it('charges for leaning on somebody who would have told you', () => {
        const cost = whatLeaningOnThemCost('A Clerk', 'they_were_going_to_say_it', result('taken'));
        expect(cost.lines.join(' ')).toContain('would have told you if you had asked');
    });

    it('says out loud what a refused demand cost, which an ask does not', () => {
        const cost = whatLeaningOnThemCost('A Clerk', 'they_are_withholding', result('refused'));
        expect(cost.lines.join(' ')).toContain('said out loud what you believe you are worth');
        expect(cost.structure.join(' ')).toContain('Different from a refused ASK');
    });

    it('marks a compelled answer as one', () => {
        const cost = whatLeaningOnThemCost('A Clerk', 'they_are_withholding', result('taken'));
        expect(cost.lines.join(' ')).toContain('the alternative was worse');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PLAYED
// ─────────────────────────────────────────────────────────────────────────

describe('played', () => {
    it('parses the phrasing that reaches it', () => {
        const parsed = parseIntent('I question the elder about the Nine Peaks');
        expect(parsed.action).toBe('interact');
        expect(parsed.intent).toBe('interrogate');
        expect(parsed.topic).toBe('Nine Peaks');
    });

    /**
     * THE ONE THAT MATTERS. Before this, a question with weight behind it was
     * routed to `askAround` like any other and answered by willingness alone -
     * so the player's standing, the ledger and everything else the pressure
     * model prices had no bearing on whether they found anything out.
     *
     * The assertion is that `resolveAttempt` settled it, and that there is no
     * second resolver: the demand path's only engine call for the outcome is
     * the same one a bribe and a threat go through.
     */
    it('resolves a demand through the pressure model and nothing else', async () => {
        const { game } = makeGame({ seed: 'demand', worldEnabled: true });
        await game.newRun('Demander');
        await game.act('I look around');

        const asked = await game.act('I question the nearest cultivator about the Azure Dew Sect');
        const calls = engineCalls(asked).map(call => call.name);

        // The pressure model settled it.
        expect(calls, calls.join(', ')).toContain('engine.resolveAttempt');
        // And the willingness read still ran: a demand does not skip the gate,
        // it changes who opens it. It runs UNDER the attempt, not instead.
        expect(calls, calls.join(', ')).toContain('engine.askedAbout');
        // NO SECOND RESOLVER. Nothing on this path settled anything on its own
        // - every call is either the pressure model, the asking read, or one of
        // the ordinary bookkeeping channels a spent span always writes.
        for (const name of calls) {
            expect(name, `${name} looks like a resolver of its own`)
                .not.toMatch(/demand|compel|lean/i);
        }

        // And it SAYS what leaning on somebody cost, whichever of the three
        // ways it went. Deliberately not pinned to one of them: `makeGame`
        // does not pin the WORLD, so which person is standing here and what
        // they are placed to say moves between installations, and asserting one
        // outcome would be pinning a coincidence. Both branches this reached in
        // play are worth recording, because they are the texture the channel is
        // for - at seed `demand` it refused at 2% and the person answered
        // anyway, having been going to; on a different world the same seed
        // refused against somebody who was holding out, and the fourteen days
        // bought a public correction about what the player is worth.
        expect(asked.narration).toMatch(
            /would have told you if you had asked|the alternative was worse|said out loud what you believe you are worth/
        );

        // And the demand went in with the player's own standing behind it,
        // rather than "with nothing on the table but the asking" - which is the
        // sentence the resolver printed for every demand before this.
        const attempt = engineCalls(asked).find(call => call.name === 'engine.resolveAttempt');
        expect(attempt!.summary).not.toContain('nothing on the table but the asking');
    }, 60_000);

    /**
     * And a demand for a thing nobody in the room could know does not spend a
     * day, because it could not have worked. Refused before the resolver, on
     * the same reasoning the missing-sum refusal on a bribe already uses.
     */
    it('spends nothing on a demand that could never have landed', async () => {
        const { game } = makeGame({ seed: 'demand-blank', worldEnabled: true });
        await game.newRun('Demander');
        await game.act('I look around');

        const asked = await game.act(
            'I question the nearest cultivator about the Hollow Court'
        );

        expect(asked.narration).toContain('You cannot make them know');

        // The proof that nothing was spent is the call list itself: one read,
        // and none of the channels a span always writes. No resolver, no time
        // skip, no world advance, so no day, no mark and no grudge.
        expect(engineCalls(asked).map(call => call.name)).toEqual(['engine.askedAbout']);
    }, 60_000);
});
