/**
 * ADMIN <verb> - an ordinary verb with the attempt landing.
 *
 * The rule these pin, in one line:
 *
 *   FORCING DECIDES AN UNCERTAIN OUTCOME. IT DOES NOT MAKE AN ILLEGAL ACTION
 *   LEGAL.
 *
 * Which is two claims, and they fail in opposite directions, so both are here:
 *
 *   A ROLL LANDS   the same house, the same seed and the same day refuses an
 *                  applicant unforced and takes them forced. Everything the
 *                  join writes, it writes - the seat, the stipend clock, the
 *                  membership row - because it is the same `handleJoin`.
 *   A GATE STAYS   `ADMIN breakthrough` on an empty accumulator is refused, and
 *                  the refusal names the actions that would arrange it. A gate
 *                  lifted here would be a second way to do a thing `set_realm`
 *                  already does properly, and the two would drift.
 *
 * And the third, which is what makes a forced run usable as evidence at all:
 * the call is AUDITED, so the run is flagged and never reaches the death ledger
 * or the balance data as though it had earned the success.
 *
 * ── WHY THE SEED IS NAMED IN THE TEST AND NOT SWEPT ──────────────────────
 *
 * The admission roll is `forStream(run.seed, 'sect_admission', day, sectId)`
 * against a chance the row computes, so one seed IS the whole claim: seed 'a'
 * refuses this applicant at this house on this day, deterministically, forever.
 * That is not a rate being asserted on a small sample - it is one draw, pinned.
 * The world is off, deliberately: nothing here asserts anything about the
 * several hundred people seeding one would cost.
 */

import { describe, it, expect } from 'vitest';
import { engineCalls, makeGame, planned } from './harness';
import { readAForcedVerb, readAnItemDescription } from '../../src/server/consolidated/admin-manage';
import {
    FORCEABLE_DECISIONS,
    theRollLands,
    whatWouldArrangeIt,
    withTheAttemptLanding
} from '../../src/server/consolidated/forcing-an-attempt-to-land';
import { ACTION_NAMES, FALLBACK_ACTION, parseIntent } from '../../src/web/actions';

/** ADMIN_MODE is read at call time, so a test can turn it on and put it back. */
async function withAdminMode<T>(on: boolean, fn: () => Promise<T>): Promise<T> {
    const before = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = on ? 'true' : 'false';
    try {
        return await fn();
    } finally {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    }
}

/**
 * A run standing in front of a house it has heard of and could be taken by.
 *
 * `grant_knowledge` first, because a name is a gate of its own and this test is
 * not about that one - the same shape the sect tests already use.
 */
async function aCultivatorAtADoor(seed: string) {
    const harness = makeGame({ adminMode: true, seed });
    await harness.game.newRun('Shen Yuan');
    await harness.game.act('ADMIN grant_knowledge kind=sect');
    return harness;
}

const THE_HOUSE = 'sect-azure-dew-sect';

// ═══════════════════════════════════════════════════════════════════════════
// THE GATE ON THE GATE
// ═══════════════════════════════════════════════════════════════════════════

describe('forcing is unreachable with ADMIN_MODE off', () => {
    it('does not force, and does not quietly run the verb either', async () => {
        await withAdminMode(false, async () => {
            const { game, repos } = makeGame({ adminMode: false, seed: 'a' });
            await game.newRun('Shen Yuan');

            await expect(game.act('ADMIN sect join the Azure Dew Sect')).rejects.toThrow(/ADMIN is off/i);

            const cultivator = repos.cultivators.getById(game.currentRun().cultivator.id)!;
            expect(cultivator.sectId).toBeNull();
        });
    });

    it('leaves the context closed, so a decision site sees nothing', () => {
        // Nothing outside `withTheAttemptLanding` can open it, and that is
        // called in one place behind the mode flag. A decision site asked
        // outside a forced call must answer no.
        expect(theRollLands('a_house_looking_at_an_applicant')).toBe(false);
        expect(theRollLands('a_crossing')).toBe(false);
    });

    it('opens only for the verb that was named', async () => {
        // The context carries which decisions this verb's resolvers reach, so
        // forcing one verb cannot decide another verb's question. Without this
        // a single flag would land every roll anywhere in the turn.
        const seen = await withTheAttemptLanding('breakthrough', async () => ({
            crossing: theRollLands('a_crossing'),
            house: theRollLands('a_house_looking_at_an_applicant')
        }));
        expect(seen.result).toEqual({ crossing: true, house: false });
        expect(seen.forced.landed).toEqual(['a_crossing']);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// READING THE LINE
// ═══════════════════════════════════════════════════════════════════════════

describe('which verb ADMIN was told to run', () => {
    it('takes a playable verb as the leading word', () => {
        expect(readAForcedVerb('sect join the Azure Dew Sect')).toEqual({
            verb: 'sect',
            // The operator's word said WHICH VERB and the rest is a sentence on
            // its own, so the sentence is the rest. `typed` keeps the line.
            sentence: 'join the Azure Dew Sect',
            typed: 'sect join the Azure Dew Sect',
            spelled: false
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // WHICH HALF OF THE LINE THE VERB READS ITS ARGUMENTS OUT OF
    //
    // The design owner, on the gap: "`ADMIN <verb> <sentence>` takes the whole
    // remaining line as the target, so `ADMIN coerce I threaten the nearest
    // cultivator` resolves nobody. Forcing can't carry a player's own sentence
    // into a verb that needs a target out of it."
    //
    // It bit exactly the verbs whose NAME is also the word a person would use.
    // `COERCE_SUBJECT_VERBS` matches "coerce" at position zero and
    // `extractSubject` hands back everything after it, so the player's whole
    // sentence became the name of a person nobody answers to - and the acts
    // most worth forcing are precisely the ones that need a target out of a
    // sentence: coercion, theft, an attack on a named person.
    // ═══════════════════════════════════════════════════════════════════════

    it('drops the operator\'s word when what follows is a sentence of its own', () => {
        // The owner's line. Before this, `target` was the whole sentence.
        const read = readAForcedVerb('coerce I threaten the nearest cultivator');
        expect(read?.verb).toBe('coerce');
        expect(read?.sentence).toBe('I threaten the nearest cultivator');
        expect(parseIntent(read!.sentence).target).toBe('nearest cultivator');

        // And the same for the other verbs named after ordinary English words.
        expect(readAForcedVerb('attack I attack Yun Shizhen')?.sentence)
            .toBe('I attack Yun Shizhen');
        expect(readAForcedVerb('force give I hand Shen Liefeng the manual')?.sentence)
            .toBe('I hand Shen Liefeng the manual');
    });

    it('keeps it when the rest of the line is not a sentence', () => {
        // `Nine Peaks`, `Shen Liefeng my purse` and `The Standing Edge` all
        // reach the parser's fallback on their own, which is what says the
        // operator's word was the sentence's own head rather than a label. Every
        // line of this shape reads exactly as it always did.
        expect(readAForcedVerb('force move Nine Peaks')?.sentence).toBe('move Nine Peaks');
        expect(readAForcedVerb('force give Shen Liefeng my purse')?.sentence)
            .toBe('give Shen Liefeng my purse');
        expect(readAForcedVerb('breakthrough')?.sentence).toBe('breakthrough');
    });

    it('is a lookup against the parser, not a reading of the words', () => {
        // The rule is exactly "does the remainder reach a verb on its own", and
        // the parser is the only thing that answers it. Nothing here inspects a
        // word for what it might have meant - same discipline as PRIMARY_ARG.
        for (const line of [
            'sect join the Azure Dew Sect',
            'coerce I threaten the nearest cultivator',
            'force move Nine Peaks',
            'interact I steal from Yun Shizhen'
        ]) {
            const read = readAForcedVerb(line)!;
            const rest = read.typed.slice(read.typed.split(/\s+/)[0].length).trim();
            const remainderIsASentence = rest.length > 0
                && parseIntent(rest).action !== FALLBACK_ACTION;
            expect(read.sentence, line).toBe(remainderIsASentence ? rest : read.typed);
        }
    });

    it('takes it spelled out, which is the unambiguous form', () => {
        const read = readAForcedVerb('force breakthrough');
        expect(read?.verb).toBe('breakthrough');
        expect(read?.spelled).toBe(true);
    });

    it('yields to a canonical admin word, because the action list is a contract', () => {
        // `move`, `site` and `wait` are playable verbs AND admin aliases. An
        // operator who has been typing `ADMIN move Nine Peaks` must not find
        // that it means something else now.
        for (const line of ['move Nine Peaks', 'site the count that outlived him', 'wait']) {
            expect(readAForcedVerb(line)).toBeNull();
        }
    });

    it('and spelling force is how the playable one is asked for instead', () => {
        expect(readAForcedVerb('force move Nine Peaks')?.verb).toBe('move');
        // The same for `give`, which is an alias of `grant_item` on the admin
        // surface as well as a playable verb.
        expect(readAForcedVerb('give Shen Liefeng my purse')).toBeNull();
        expect(readAForcedVerb('force give Shen Liefeng my purse')?.verb).toBe('give');
    });

    it('reads no verb out of prose, and none out of key=value', () => {
        for (const line of [
            'I would like to join a sect',
            'spawn_encounter ordinal=41',
            'grant_item name=The Standing Edge',
            'nonsense'
        ]) {
            expect(readAForcedVerb(line)).toBeNull();
        }
    });

    it('refuses to force the parser\'s own fallback', () => {
        // `unclear` is what the parser reaches when it understood nothing.
        // Naming it deliberately would be forcing an attempt at doing nothing.
        expect(readAForcedVerb('unclear')).toBeNull();
        expect(readAForcedVerb('force unclear')).toBeNull();
    });

    it('accepts every playable verb that is not also an admin word', () => {
        // `give` joins the three: it is an alias of the admin `grant_item`
        // action, so a bare `ADMIN give ...` is the operator asking for the
        // admin surface and not for the playable verb. Spelling the force word
        // still reaches it - `ADMIN force give ...` - which is the whole of
        // what this collision costs and is asserted below.
        const admin = new Set(['move', 'site', 'wait', 'unclear', 'give']);
        for (const verb of ACTION_NAMES) {
            const read = readAForcedVerb(verb);
            if (admin.has(verb)) expect(read, verb).toBeNull();
            else expect(read?.verb, verb).toBe(verb);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// A ROLL LANDS
// ═══════════════════════════════════════════════════════════════════════════

describe('a roll is what forcing reaches', () => {
    it('the same house on the same day refuses unforced and takes forced', async () => {
        await withAdminMode(true, async () => {
            const plain = await aCultivatorAtADoor('a');
            const refused = await plain.game.act('I join the Azure Dew Sect');
            expect(refused.narration).toMatch(/did not take them/i);
            expect(
                plain.repos.cultivators.getById(plain.game.currentRun().cultivator.id)!.sectId
            ).toBeNull();

            const forced = await aCultivatorAtADoor('a');
            const taken = await forced.game.act('ADMIN sect join the Azure Dew Sect');
            expect(taken.narration).toMatch(/Taken on by Azure Dew Sect/i);

            const after = forced.repos.cultivators.getById(
                forced.game.currentRun().cultivator.id
            )!;
            expect(after.sectId).toBe(THE_HOUSE);
        });
    }, 60_000);

    it('and everything the join writes is written, because it is the same join', async () => {
        await withAdminMode(true, async () => {
            const { game, repos } = await aCultivatorAtADoor('a');
            await game.act('ADMIN sect join the Azure Dew Sect');

            const membership = repos.sects.getMembership(game.currentRun().cultivator.id);
            expect(membership).not.toBeNull();
            // The seat is the seat the ladder gives a stranger at this rung,
            // not a seat admin chose. Nothing here is a second implementation.
            expect(membership!.sectId).toBe(THE_HOUSE);
            expect(membership!.rankIndex).toBe(0);
            expect(membership!.contribution).toBe(0);
        });
    }, 60_000);

    it('which is what the verb behind a membership gate then sees', async () => {
        // The whole purpose, in the design owner's words: "if it works you can
        // then see what happens next". Before the forced admission the duty
        // board says none of it touches anybody's ledger, because the player is
        // on nobody's; after it, the same board is the house asking.
        await withAdminMode(true, async () => {
            const { game } = await aCultivatorAtADoor('a');

            const outside = await game.act('what duties are there');
            expect(outside.narration).toMatch(/you are on nobody's/i);

            await game.act('ADMIN sect join the Azure Dew Sect');

            const inside = await game.act('what duties are there');
            expect(inside.narration).toMatch(/What the house is asking for/i);
            expect(inside.narration).not.toMatch(/you are on nobody's/i);
        });
    }, 60_000);

    it('lands a theft off somebody four realms above, and the world answers', async () => {
        // The design owner's own case, and the reason this exists: "a Qi
        // Condensation stealing from a Nascent Soul. It's very hard, but if it
        // works you can then see what happens next (what that Nascent Soul
        // does)". Ordinary play reaches it about one time in fifty, and what is
        // being tested is not the theft - it is that the reprisal, the standing
        // and the record then have to answer a state they have never met.
        await withAdminMode(true, async () => {
            const { game } = makeGame({ adminMode: true, seed: 'theft-1' });
            await game.newRun('Shen Yuan');
            await game.act('ADMIN spawn_encounter ordinal=29 name=Yun Shizhen');

            const plain = await game.act('I steal from Yun Shizhen');
            expect(plain.narration).toMatch(/refused/i);
            expect(plain.narration).not.toMatch(/spirit stones off Yun Shizhen/);

            const forcedTheft = await game.act('ADMIN interact I steal from Yun Shizhen');
            expect(forcedTheft.narration).toMatch(/spirit stones off Yun Shizhen/);
            // And the price is charged by the verb, not waived by the force:
            // being robbed is answered, and the answer is a real wound.
            expect(forcedTheft.narration).toMatch(/answers being robbed/);
        });
    }, 60_000);

    it('carries the operator\'s own sentence into a verb that needs a target', async () => {
        // THE GAP THE OWNER FOUND, played. `ADMIN coerce <a player sentence>`
        // used to file `engine.resolveParty: Unresolved party "I threaten the
        // nearest cultivator". No exchange was run.` - so the acts most worth
        // forcing were the ones forcing could not reach.
        await withAdminMode(true, async () => {
            const { game } = makeGame({ adminMode: true, seed: 'coerce-1' });
            await game.newRun('Shen Yuan');
            await game.act('ADMIN spawn_encounter ordinal=9 name=Yun Shizhen');

            const forced = await game.act('ADMIN coerce I threaten Yun Shizhen');

            expect(forced.narration).toContain('ADMIN - FORCED COERCE');
            // The target is the person, not the sentence. That one line is the
            // whole fix, and everything below it follows from it.
            expect(planned(forced).summary).toContain('coerce(target="Yun Shizhen")');
            // So the confrontation engine answered, rather than the party
            // lookup filing "Unresolved party" and nothing running at all.
            const calls = engineCalls(forced).map(call => call.name);
            expect(calls).not.toContain('engine.resolveParty');
            expect(calls).toContain('combat.round');
            expect(forced.narration).toContain('Yun Shizhen');
        });
    }, 60_000);

    it('says what it decided, and says it was the only thing decided', async () => {
        await withAdminMode(true, async () => {
            const { game } = await aCultivatorAtADoor('a');
            const taken = await game.act('ADMIN sect join the Azure Dew Sect');
            expect(taken.narration).toContain('ADMIN - FORCED SECT');
            expect(taken.narration).toContain(
                FORCEABLE_DECISIONS.a_house_looking_at_an_applicant.decides
            );
            expect(taken.narration).toMatch(/Nothing was skipped and nothing was made cheaper/);
        });
    }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════════════
// A GATE STAYS A GATE
// ═══════════════════════════════════════════════════════════════════════════

describe('a gate is not what forcing reaches', () => {
    it('a crossing with an empty accumulator is refused, and no rung is given', async () => {
        await withAdminMode(true, async () => {
            const { game, repos } = makeGame({ adminMode: true, seed: 'gate' });
            await game.newRun('Shen Yuan');
            const before = repos.cultivators.getById(game.currentRun().cultivator.id)!;

            const answer = await game.act('ADMIN breakthrough');

            const after = repos.cultivators.getById(game.currentRun().cultivator.id)!;
            expect(after.realmOrdinal).toBe(before.realmOrdinal);
            expect(answer.narration).toMatch(/Nothing was decided/);
            expect(answer.narration).toMatch(/PRECONDITION and not a roll/);
        });
    }, 60_000);

    it('and the refusal names every action that would arrange it', async () => {
        // The design owner: "it should say no, you can do it by setting your
        // realm to 29 and your age." Every route, not the first - an operator
        // handed both does the thing in two calls.
        await withAdminMode(true, async () => {
            const { game } = makeGame({ adminMode: true, seed: 'gate' });
            await game.newRun('Shen Yuan');
            const answer = await game.act('ADMIN breakthrough');
            expect(answer.narration).toContain('ADMIN grant_progress fill=true');
            expect(answer.narration).toContain('ADMIN set_realm ordinal=');
        });
    }, 60_000);

    it('and then the same verb lands once the precondition is arranged', async () => {
        // The two compose, which is the real workflow: arrange the gate with
        // the action that arranges it, and force only what was ever uncertain.
        await withAdminMode(true, async () => {
            const { game, repos } = makeGame({ adminMode: true, seed: 'gate' });
            await game.newRun('Shen Yuan');
            const before = repos.cultivators.getById(game.currentRun().cultivator.id)!;

            await game.act('ADMIN grant_progress fill=true');
            const crossed = await game.act('ADMIN breakthrough');

            const after = repos.cultivators.getById(game.currentRun().cultivator.id)!;
            expect(after.realmOrdinal).toBe(before.realmOrdinal + 1);
            expect(crossed.narration).toContain(FORCEABLE_DECISIONS.a_crossing.decides);
            // And it cost what a crossing costs: the accumulator it was given
            // is spent by the crossing, not left sitting there.
            expect(after.cultivationProgress).toBeLessThan(before.cultivationProgress + 1);
        });
    }, 60_000);

    it('tells a bar from an impossibility, and offers a route only for the bar', () => {
        const bar = whatWouldArrangeIt('engine.canAttemptBreakthrough', null);
        expect(bar.kind).toBe('route');

        const impossible = whatWouldArrangeIt('sect_manage.join', 'admission_requirements_unmet');
        expect(impossible.kind).toBe('no_route');

        // And a refusal in neither table is said to be in neither, rather than
        // guessed at. Guessing is how a bar starts being described as an
        // impossibility, and an impossibility as a bar.
        expect(whatWouldArrangeIt('engine.somethingNobodyHasMapped', 'no_such_code').kind)
            .toBe('unrecorded');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// AND IT IS ALWAYS MARKED
// ═══════════════════════════════════════════════════════════════════════════

describe('a forced success is recorded as one', () => {
    it('writes an audit row naming the verb and what was decided', async () => {
        await withAdminMode(true, async () => {
            const { game, repos } = await aCultivatorAtADoor('a');
            await game.act('ADMIN sect join the Azure Dew Sect');

            const trail = await game.act('ADMIN audit_log');
            expect(trail.narration).toContain('force.sect');
            expect(trail.narration).toContain('a_house_looking_at_an_applicant');

            // Those rows ARE the admin flag, and the flag is what keeps this
            // run out of the death ledger and out of balance data. A played
            // test that cannot tell an arranged success from an earned one is
            // testing nothing.
            const run = repos.runs.getActiveRun()!;
            const row = repos.db.prepare('SELECT admin FROM runs WHERE id = ?').get(run.id) as
                { admin: number };
            expect(row.admin).toBe(1);
        });
    }, 60_000);

    it('records a refused force too, with what refused it', async () => {
        await withAdminMode(true, async () => {
            const { game } = makeGame({ adminMode: true, seed: 'gate' });
            await game.newRun('Shen Yuan');
            await game.act('ADMIN breakthrough');

            const trail = await game.act('ADMIN audit_log');
            expect(trail.narration).toContain('force.breakthrough');
            expect(trail.narration).toContain('"outcome":"refused"');
            expect(trail.narration).toContain('engine.canAttemptBreakthrough');
        });
    }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════════════
// AN ACTION A REFUSAL NAMES HAS TO EXIST
//
// `set_age` is here rather than beside the other arranging actions because it
// exists for this reason and no other. A bar in this world is often age AND
// rung - the Azure Cloud Pavilion sorts its intake on the pair, and the Hollow
// Court's fostering terms are `returnOrdinal: 29` with `returnByAge: 250` - so
// a refusal that honestly names what somebody is short by can name an age, and
// a refusal naming an action nobody built is the defect this whole surface is
// meant to avoid.
// ═══════════════════════════════════════════════════════════════════════════

describe('set_age', () => {
    it('moves the age, and claims no life was lived', async () => {
        await withAdminMode(true, async () => {
            const { game, repos } = makeGame({ adminMode: true, seed: 'age' });
            await game.newRun('Shen Yuan');
            const before = repos.cultivators.getById(game.currentRun().cultivator.id)!;

            const answer = await game.act('ADMIN set_age 40');

            const after = repos.cultivators.getById(game.currentRun().cultivator.id)!;
            expect(after.age).toBe(40);
            expect(after.age).not.toBe(before.age);
            // The clock did not move, which is the whole distinction from
            // `advance_days`: no world ran, nothing happened to them in
            // between, and the answer says so rather than implying a life.
            expect(repos.runs.getActiveRun()!.elapsedDays).toBe(0);
            expect(answer.narration).toMatch(/NO LIFE WAS LIVED AND NONE IS CLAIMED/);
        });
    }, 60_000);

    it('refuses an age past the span of the rung, and names both routes', async () => {
        await withAdminMode(true, async () => {
            const { game, repos } = makeGame({ adminMode: true, seed: 'age' });
            await game.newRun('Shen Yuan');
            const before = repos.cultivators.getById(game.currentRun().cultivator.id)!;

            const answer = await game.act('ADMIN set_age 9000');

            // Not a state the world holds: `resolveSurvival` reads exactly this
            // comparison and would call it `lifespan_exhausted` on the next
            // check. Admin never writes a state the write paths would refuse.
            expect(repos.cultivators.getById(before.id)!.age).toBe(before.age);
            expect(answer.narration).toMatch(/past it/);
            expect(answer.narration).toContain('ADMIN set_realm ordinal=');
            expect(answer.narration).toContain('ADMIN advance_days years=');
        });
    }, 60_000);

    it('is off with the mode off, like everything else here', async () => {
        await withAdminMode(false, async () => {
            const { game } = makeGame({ adminMode: false, seed: 'age' });
            await game.newRun('Shen Yuan');
            await expect(game.act('ADMIN set_age 40')).rejects.toThrow(/ADMIN is off/i);
        });
    }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════════════
// SAYING WHICH THING, IN THE WORDS SOMEBODY WOULD USE
//
// Found by playing. `ADMIN give myself chaos healing pill` was refused with
// "nothing answers to 'myself chaos healing'", which was an honest reading and
// still a failure: an operator does not know the catalog spells it
// `pill-soul-returning-clarity` and should not have to. Three of those four
// words are members of closed sets - a grade, a kind, and a pronoun that is not
// an argument at all - so resolving them is a lookup rather than an invention.
//
// The deterministic tier's bar here is PLAYABLE, not "as good as a model":
// reading the grade and the kind off closed sets and then asking which of seven
// chaos-grade pills you meant is a good answer at this rung.
// ═══════════════════════════════════════════════════════════════════════════

describe('an item said as a description rather than a catalog name', () => {
    it('reads the grade, the kind and the pronoun apart from the name', () => {
        const read = readAnItemDescription('myself chaos grade tribulation');
        expect(read.grades).toEqual(['chaos']);
        expect(read.words).toEqual(['tribulation']);
        expect(read.dropped).toContain('myself');
        expect(read.dropped).toContain('grade');
    });

    it('resolves one that answers all of it, and says which row by id', async () => {
        await withAdminMode(true, async () => {
            const { game } = makeGame({ adminMode: true, seed: 'item' });
            await game.newRun('Shen Yuan');
            const answer = await game.act('ADMIN give myself a chaos grade tribulation pill');
            expect(answer.narration).toContain('pill-tribulation-guiding');
            // The echo is the only defence against a plausible wrong reading,
            // so the row it landed on is printed, not just the parsed argument.
            expect(answer.narration).toMatch(/resolved to the one row that answers all of it/);
        });
    }, 60_000);

    it('and asks which, with the rows it weighed, when nothing answers all of it', async () => {
        await withAdminMode(true, async () => {
            const { game } = makeGame({ adminMode: true, seed: 'item' });
            await game.newRun('Shen Yuan');
            const answer = await game.act('ADMIN give myself chaos healing pill');
            // ADMIN DOES NOT INVENT ITEMS, and the guard that made the original
            // refusal correct is untouched. What changed is that the refusal
            // now teaches the catalog instead of printing three unrelated
            // examples: the rows it narrowed to, spelled the way this surface
            // takes them.
            expect(answer.narration).toMatch(/none of them is named "healing"/);
            expect(answer.narration).toMatch(/Which of them was it\?/);
            expect(answer.narration).toContain('ADMIN grant_item itemId=pill-');
        });
    }, 60_000);

    it('lets a closed-set grade beat letter similarity, which got one wrong', async () => {
        // Measured: "a heaven grade herb" resolved to the Heavenly Tribulation
        // Cinder Fruit at 80/100 on the letters of "heaven", and that fruit is
        // CHAOS grade. Confident, plausible and wrong - the exact failure the
        // echo exists to catch, and now a grade word in the line is a fact
        // about which rows can answer rather than a string to match.
        await withAdminMode(true, async () => {
            const { game } = makeGame({ adminMode: true, seed: 'item' });
            await game.newRun('Shen Yuan');
            const answer = await game.act('ADMIN give me a heaven grade herb');
            expect(answer.narration).not.toContain('herb-heavenly-tribulation-cinder-fruit');
            expect(answer.narration).toMatch(/grade heaven/);
        });
    }, 60_000);

    it('still matches a real catalog name whole, and does not take it apart', async () => {
        await withAdminMode(true, async () => {
            const { game } = makeGame({ adminMode: true, seed: 'item' });
            await game.newRun('Shen Yuan');
            const answer = await game.act('ADMIN give The Standing Edge');
            expect(answer.narration).toContain('artifact-the-standing-edge');
        });
    }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════════════
// EVERY NAMED DECISION HAS A CONSUMER
// ═══════════════════════════════════════════════════════════════════════════

describe('the decision table is not a list of intentions', () => {
    it('every decision names a site, and every verb it claims is playable', () => {
        // A name in the table with no consumer would be worse than an absent
        // one: force would report that it reached something and the roll would
        // have gone its own way. The path is checked as a string here and by
        // the played tests above in behaviour.
        for (const [name, decision] of Object.entries(FORCEABLE_DECISIONS)) {
            expect(decision.where, name).toMatch(/\.ts$/);
            expect(decision.reachedBy.length, name).toBeGreaterThan(0);
            for (const verb of decision.reachedBy) {
                expect(ACTION_NAMES as readonly string[], `${name} -> ${verb}`).toContain(verb);
            }
        }
    });
});
