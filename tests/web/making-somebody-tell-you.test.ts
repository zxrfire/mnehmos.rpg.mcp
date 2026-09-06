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
    LEVERAGE_ATTEMPT_CONSTANTS,
    LEVERAGE_TRIED_IN_THIS_ORDER,
    whatAnAnswerCosts,
    whatYouBringToBear
} from '../../src/engine/social-leverage/index';
import {
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

/**
 * BOTH OF THESE WERE CONSTANTS IN `making-somebody-tell-you.ts` AND BOTH WERE
 * ONE ANSWER WIDE. What a withheld answer weighed did not depend on what was
 * asked, and what a demand was backed by did not depend on who was asking. The
 * tests that pinned those two values are gone with them; what is asserted now
 * is the rule each of them was standing in for.
 */
describe('what a withheld answer weighs', () => {
    /**
     * The bound that has to hold whatever the reader returns: the standing gap
     * must be able to beat the ordinary case, or "whether people respect you"
     * decides nothing. A stranger's whereabouts is the ordinary case.
     */
    it('prices a stranger low enough that standing can still carry it', () => {
        const ask = whatAnAnswerCosts({ nearness: 'distant', theyWouldHaveSaidIt: false }).ask;
        const { ASK_RESISTANCE } = LEVERAGE_ATTEMPT_CONSTANTS;
        expect(ASK_RESISTANCE[ask]).toBeLessThan(0.3);
        expect(ask).not.toBe('a_courtesy');
    });

    /** And it is not one price. What it costs them is who they are being asked about. */
    it('costs more the nearer the thing asked about stands to them', () => {
        const { ASK_RESISTANCE } = LEVERAGE_ATTEMPT_CONSTANTS;
        const at = (nearness: 'distant' | 'tied' | 'household') =>
            ASK_RESISTANCE[whatAnAnswerCosts({ nearness, theyWouldHaveSaidIt: false }).ask];
        expect(at('distant')).toBeLessThan(at('tied'));
        expect(at('tied')).toBeLessThan(at('household'));
    });

    /** Somebody who was going to say it is not being asked for anything. */
    it('costs nothing at all when they were going to say it', () => {
        expect(whatAnAnswerCosts({ nearness: 'household', theyWouldHaveSaidIt: true }).ask)
            .toBe('a_courtesy');
    });
});

describe('what a bare demand is backed by', () => {
    const nobody = {
        actorId: 'a', subjectId: 'b', realmsOverThem: 0,
        yourHouse: null, theirHouse: null
    };

    /**
     * FOUND BY PLAYING, and it was the channel not working at all. A Void
     * Refinement cultivator leaning on somebody "plainly beneath notice" came
     * back refused at 18%, and the resolver's own account said why: "asked
     * interrogate with nothing on the table but the asking". The parser sets
     * `leverage` off words like bribe and threaten; a plain demand uses
     * neither, so every one of them went in at pressure zero.
     *
     * `name` is the enum member for the asker's own reputation, and standing
     * that far over somebody IS their reputation in the room. What it must not
     * be is `force`: that is the credible ability to TAKE it, it is worth twice
     * as much, and it is a threat - a different sentence, which the parser
     * already labels. Backing a demand with force off a background alone would
     * let every player make an implicit threat without saying so.
     */
    it('is the reputation of somebody who plainly outranks them, never force', () => {
        const over = whatYouBringToBear({ ...nobody, realmsOverThem: 3 });
        expect(over.leverage).toBe('name');
        expect(APPROACH_LEVERAGE_PRESSURE[over.leverage]).toBe(1);
        expect(APPROACH_LEVERAGE_PRESSURE.force).toBeGreaterThan(
            APPROACH_LEVERAGE_PRESSURE[over.leverage]
        );
    });

    /**
     * And the half the constant was hiding: somebody with no rung over them, no
     * house and nothing owed has nothing on the table but the asking, and the
     * engine has to be able to say so. Handing them `name` was the softening -
     * a nobody demanding things read as somebody worth listening to.
     */
    it('is nothing at all when there is nothing behind it', () => {
        expect(whatYouBringToBear(nobody).leverage).toBe('none');
    });

    /**
     * THE RATCHET THE ORDER IS WRITTEN AGAINST, which the file promises exists
     * rather than restating the pressures beside its own list.
     *
     * `whatYouBringToBear` returns the FIRST true row, so the order has to be
     * non-increasing in what the resolver pays for each one. A member whose
     * pressure was raised without being moved up the list would be silently
     * outranked by a lighter thing tried before it, and nothing about the
     * derivation would look wrong: it would keep returning a true fact, just
     * not the heaviest one.
     */
    it('tries them heaviest first, whatever the pressures are set to', () => {
        const pressures = LEVERAGE_TRIED_IN_THIS_ORDER.map(
            leverage => APPROACH_LEVERAGE_PRESSURE[leverage]
        );
        for (let i = 1; i < pressures.length; i++) {
            expect(pressures[i], `${LEVERAGE_TRIED_IN_THIS_ORDER[i]} is tried after `
                + `${LEVERAGE_TRIED_IN_THIS_ORDER[i - 1]} and is worth more`)
                .toBeLessThanOrEqual(pressures[i - 1]!);
        }
    });

    /**
     * And the three it does not derive, which is the file's own line and is the
     * half that keeps this from being a cheat. `coin`, `attachment` and `secret`
     * are things the asker DOES - a sum put down, an approach made, a thing
     * produced - and the parser labels the act that does them. Deriving one off
     * a background would put money on the table that nobody spent.
     */
    it('derives only what somebody IS, and never what they would have to do', () => {
        for (const done of ['coin', 'attachment', 'secret'] as const) {
            expect(LEVERAGE_TRIED_IN_THIS_ORDER, done).not.toContain(done);
        }
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
        // The PRINCIPLE, not the sentence. What the refusal has to say is
        // that weight moves what somebody will tell you and never what they
        // have to tell - the wording moved when the old one was found to be
        // inventing a mechanism ("your presence does not reach into their
        // head"), and a test pinning that wording would have pinned the defect.
        expect(copy.prose).toContain('has not heard of');
        expect(copy.prose).toContain('It does not change what they have to tell.');
        // And it says nothing about reaching into anybody. The refusal reports
        // a state of the world; it does not explain itself with a mechanism the
        // world does not have.
        expect(copy.prose).not.toContain('into their head');
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

        // And what the demand went in WITH is not asserted here, because on
        // this world it cannot be. The line that used to stand at the bottom of
        // this test read `not.toContain('nothing on the table but the asking')`,
        // and it was correct for exactly as long as a bare demand was backed by
        // the departed constant `WHAT_A_BARE_DEMAND_IS_BACKED_BY = 'name'`:
        // every demand carried something because every demand carried the same
        // thing. `whatYouBringToBear` reads it off the asker instead, and a
        // freshly born cultivator at the bottom of the ladder, in no house and
        // owed nothing by the stranger in front of them, genuinely has nothing
        // on the table but the asking. `makeGame` does not pin the WORLD, so
        // whether the person standing here outranks them is a coincidence, and
        // that line was pinning it.
        //
        // The rule it was standing in for - that the leverage is read off the
        // two people and is not a constant - is asserted where it can be:
        // `what-you-bring-to-bear-is-read-off-what-you-are.test.ts` runs both
        // arms of each comparison in one command against one pinned world.
        //
        // What holds on ANY world is the other half of that rule, and it is
        // asserted instead: the derivation reads only what somebody IS, so a
        // demand that put nothing down can never come out carrying something
        // the player would have had to spend, offer or produce.
        const attempt = engineCalls(asked).find(call => call.name === 'engine.resolveAttempt');
        const onTheTable = /asked interrogate with ([^:]+):/.exec(attempt!.summary)?.[1];
        expect(onTheTable, attempt!.summary).toBeTruthy();
        for (const notPutDown of [
            'money on the table',
            'themselves',
            'something they would pay not to have said aloud'
        ]) {
            expect(onTheTable, notPutDown).not.toBe(notPutDown);
        }
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

        expect(asked.narration).toContain('It does not change what they have to tell.');

        // The proof that nothing was spent is the call list itself: one read,
        // and none of the channels a span always writes. No resolver, no time
        // skip, no world advance, so no day, no mark and no grudge.
        expect(engineCalls(asked).map(call => call.name)).toEqual(['engine.askedAbout']);
    }, 60_000);
});
