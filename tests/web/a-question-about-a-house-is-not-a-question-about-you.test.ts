/**
 * "Who runs the sect" was answered with the asker's own rank and contribution.
 *
 * Reported from a played run, unaffiliated:
 *
 *     > who runs the sect
 *     Unaffiliated. No stipend, no array, no elder, and nobody to notice if
 *     this run ends badly.
 *
 * True, and not what was asked. `verb-pattern-table.ts` routes every who-leads
 * phrasing to `sect/standing`, and `handleStanding` takes a cultivator id and
 * nothing else, so every answer it can give is an answer about the asker.
 *
 * ── WHAT THE MEASUREMENT ACTUALLY SAID, WHICH IS NOT WHAT WAS REPORTED ────
 *
 * The report was made unaffiliated and the routing was blamed. Played again
 * from INSIDE a house, the same sentence came back:
 *
 *     Inner Disciple of Azure Dew Sect, 0 contribution, 26 spirit stones a
 *     month.
 *     Shu Wanping stands highest in it, at Nascent Soul Perfection and titled
 *     Sect Warden.
 *     Dew Elder wants 900 contribution, none of it booked yet.
 *
 * The second line is the answer, and it is there on purpose: `tool-result-
 * prose.ts` derives the head off the house's roll for exactly this sentence.
 * So the routing is RIGHT for a member of the house being asked about, and
 * rerouting it would have deleted a working answer.
 *
 * ── AND THE READ IT WAS GOING TO BE REROUTED TO CANNOT ANSWER IT ──────────
 *
 * The proposal was to send these sentences to `investigate`, on the grounds
 * that "who is the patriarch" already goes there. Measured, both affiliated
 * and unaffiliated:
 *
 *     > who is the patriarch
 *     You go over Sweet Spring Island looking for it and nothing here answers
 *     to it.
 *
 * `investigate` looks for a thing by that name and finds none, because
 * `patriarch` is a title and not a name. Routing the working sentences there
 * would have traded an answer for a blank look.
 *
 * ── SO THE DEFECT IS NARROWER, AND IT IS THAT THE HOUSE WAS THROWN AWAY ───
 *
 * The branch returned `{ action: 'sect', intent: 'standing' }` and dropped the
 * house the sentence named. Two cases fell out of that, and the standing read
 * answered both with the asker:
 *
 *     a member of one house asking about another   their own rank sheet
 *     somebody of no house asking about a named one   "Unaffiliated. No
 *                                                      stipend, no array..."
 *
 * The ruling: a question that NAMES a house other than your own is a question
 * about that house, and is answered by the read that already answers "tell me
 * about <house>". A question that names no house, or names your own, keeps the
 * standing read and the head it derives.
 *
 * ── WHY A STRANGER IS NOT SIMPLY TOLD THE NAME ───────────────────────────
 *
 * The roll is in the catalog and the head could be read off it for anybody.
 * The world already decided otherwise: `what-joining-tells-you.ts` hands the
 * head's name over ON JOINING and says so in the sentence it writes, "you were
 * told when you joined; you have not met them". Who leads a house is something
 * you are told from inside it. So the outside answer is the register's, which
 * gates on what the asker has heard of, and a house nobody has heard of comes
 * back "something you cannot place" rather than as the asker's own rank.
 *
 * Measured after, same two arms:
 *
 *     unaffiliated, "who leads the Azure Dew Sect"
 *       -> "Azure Dew Sect. Azure Dew Sect takes people on early enough that
 *          being taken is not something anyone boasts about..."
 *     a member of one house, "who is in charge of the Frostmirror Court"
 *       -> "Something you cannot place."
 *     a member, "who runs the sect"  -> unchanged, still names the head
 *     nobody, "who runs the sect"    -> unchanged, still "Unaffiliated"
 *
 * ── WHAT IS STILL MISSING, WRITTEN DOWN AS A GAP RATHER THAN LICENSED ────
 *
 * The register does not name who answers for a SECT. It names who answers for
 * a COURT - `register.ts` builds that line off `answersForTheCourt` - and the
 * sect row carries an ordinal with no person behind it. So a stranger asking
 * who leads a house they have heard of is now answered about the right house
 * and still not told the name. That is a gap in the register, not in the
 * routing, and closing it is its own piece of work.
 *
 * The second gap, found while pinning the phrasings below and left alone for
 * the same reason: "I ask who leads my sect" is talking to whoever is in front
 * of you, about a person called "who leads my sect". The house branch vetoes
 * itself when the question is put to somebody, which is right when a person is
 * named and wrong when nobody is; and the pass that rescues those sentences,
 * `theQuestionRatherThanTheBystander`, cannot rescue this one, because it only
 * accepts a read that costs nothing and `sect` is not one. Every other
 * phrasing in this file reaches the read. That one does not, and it is not
 * this fix.
 */

import { parseIntent } from '../../src/web/actions';
import { getMembersOf } from '../../src/data/cultivation/members';
import { SECTS } from '../../src/data/cultivation/sects';
import { makeGameInWorld } from './harness';

const A_HOUSE = 'sect-azure-dew-sect';
const WORLD = 'world-who-leads';

const routed = (line: string) => {
    const plan = parseIntent(line) as { action: string; intent?: string };
    return `${plan.action}${plan.intent ? `/${plan.intent}` : ''}`;
};

/**
 * A house of the catalog that is not the one the player is put in, named the
 * way the parser will actually recognise it.
 *
 * Asked of the parser rather than picked by hand: a name only reaches the
 * house branch if it is in the catalog's own spelling and has a space in it,
 * and a hand-picked second house that failed that would make this arm pass by
 * testing nothing.
 *
 * THE VERB IS CHECKED AS WELL AS THE TARGET, and that is not belt and braces.
 * Breaking the fix on purpose to see this file go red, the first cut of this
 * helper handed back Lantern Hall, whose name routes to `legacy/counters` and
 * carries a target of its own - so two arms went on passing over a broken
 * engine, having asked a question that never reached the branch they exist to
 * cover.
 */
function anotherHouseTheParserCanSee(): string {
    for (const sect of SECTS) {
        if (sect.id === A_HOUSE) continue;
        const plan = parseIntent(`who leads the ${sect.name}`) as {
            action: string; intent?: string; target?: string;
        };
        if (plan.action === 'sect' && plan.intent === 'standing' && plan.target) return sect.name;
    }
    throw new Error('no second house in the catalog is reachable by name');
}

async function ofTheHouse(seed: string) {
    const h = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await h.game.newRun('Joiner');
    h.db.prepare('UPDATE cultivators SET realm_ordinal = 12 WHERE id = ?').run(cultivator.id);
    h.game.repos.sects.addMember(A_HOUSE, cultivator.id, 2);
    return h;
}

async function ofNowhere(seed: string) {
    const h = await makeGameInWorld({ seed, worldSeed: WORLD });
    await h.game.newRun('Rogue');
    return h;
}

describe('asking who leads a house', () => {
    /**
     * The near neighbours, which is where a widening of the house branch would
     * show up first. Every one of these is a different question sharing most of
     * its vocabulary with the one above, and one of them being taken is the
     * likeliest way this fix fails.
     */
    it('leaves the questions next to it alone', () => {
        expect(routed('where do I stand')).toBe('status');
        expect(routed('what rank am I')).toBe('status');
        expect(routed('what do people think of me')).toBe('sect/standing');
        expect(routed('what is my standing')).toBe('sect/standing');
        expect(routed('who is the strongest here')).toBe('look/company');
        expect(routed('who is in charge here')).toBe('look/holder');
        expect(routed('who likes me')).toBe('look/warmth');
        // The authority read, kept off `standing` by `asking-is-not-doing.ts`.
        // This fix is the same defect one branch over and must not undo it.
        expect(routed('what do I run')).toBe('sect/authority');
        expect(routed('what does my hall teach')).toBe('sect/curriculum');
        // A title is not a name, and the read that looks for a thing by name
        // is where it belongs. It answers badly, which is recorded in the
        // header and is why nothing was rerouted to it.
        expect(routed('who is the patriarch')).toBe('investigate');
    });

    /**
     * The house the sentence named survives, and only where a house was named.
     *
     * "the sect" is a type noun and means the asker's own, so it must keep
     * carrying nothing. A catalog name is a different house until the engine
     * has looked at the membership row, which the parser cannot do.
     */
    it('carries the house a sentence names, and only then', () => {
        for (const bare of ['who runs the sect', 'who leads this house', 'who leads my sect']) {
            expect(routed(bare), bare).toBe('sect/standing');
            expect((parseIntent(bare) as { target?: string }).target, bare).toBeUndefined();
        }

        const named = anotherHouseTheParserCanSee();
        for (const line of [
            `who leads the ${named}`,
            // The same sentence with the punctuation a player types, which
            // travels a second road: `asking-is-not-doing.ts` rebuilds the plan
            // for anything ending in a question mark, and used to rebuild it
            // without the house.
            `who runs the ${named}?`,
            `who is in charge of the ${named}`
        ]) {
            const plan = parseIntent(line) as { action: string; intent?: string; target?: string };
            expect(`${plan.action}/${plan.intent}`, line).toBe('sect/standing');
            expect(plan.target, line).toBeTruthy();
        }
    });

    /**
     * THE ANSWER THAT ALREADY WORKED, AND WHICH A REROUTE WOULD HAVE DELETED.
     *
     * The name is read out of the output and checked against the house's roll
     * rather than written down here: who stands highest is derived from realm
     * ordinals over the catalog, and pinning the person would pin an
     * arrangement the catalog is free to change.
     */
    it('names the head, to a member, for their own house', async () => {
        const h = await ofTheHouse('own-house');
        const roll = getMembersOf(A_HOUSE).map(person => person.name);
        expect(roll.length, 'the house has nobody on its roll to be its head').toBeGreaterThan(0);

        for (const line of ['who runs the sect', 'who leads the sect', 'who is in charge of my sect']) {
            const said = (await h.game.act(line)).narration;
            const head = /(.+?) stands highest in it, at /.exec(said);
            expect(head, `${line} did not name anybody`).toBeTruthy();
            expect(roll, `${line} named somebody who is not on the roll`)
                .toContain(head![1].split('\n').pop()!.trim());
        }
    }, 180_000);

    /**
     * And by the house's own name, which is the sentence that now carries a
     * target. The membership row is what decides it is the same house, so this
     * is the arm that proves the engine checks the row rather than the words.
     */
    it('still names the head when a member says their own house by name', async () => {
        const h = await ofTheHouse('own-house-by-name');
        const mine = SECTS.find(sect => sect.id === A_HOUSE)!;
        const said = (await h.game.act(`who leads the ${mine.name}`)).narration;
        expect(said).toMatch(/stands highest in it, at /);
    }, 180_000);

    /**
     * The defect, from the side it was reported on. A house was named, and the
     * answer was about the person asking.
     */
    it('answers about the house a stranger names, not about the stranger', async () => {
        const h = await ofNowhere('stranger-names-a-house');
        const mine = SECTS.find(sect => sect.id === A_HOUSE)!;
        const said = (await h.game.act(`who leads the ${mine.name}`)).narration;

        expect(said, 'answered with the asker having no house').not.toMatch(/Unaffiliated/i);
        expect(said, 'answered with the asker having no house')
            .not.toMatch(/no stipend, no array/i);
        expect(said, 'the house asked about is not in the answer').toContain(mine.name);
    }, 180_000);

    /**
     * The same defect the other way round: a member asking about somebody
     * else's house was handed their own rank sheet.
     */
    it('answers about the other house when a member asks about one', async () => {
        const h = await ofTheHouse('member-asks-elsewhere');
        const named = anotherHouseTheParserCanSee();
        const said = (await h.game.act(`who is in charge of the ${named}`)).narration;

        expect(said, 'answered with the asker\'s own rung').not.toMatch(/Inner Disciple of/i);
        expect(said, 'answered with the asker\'s own contribution')
            .not.toMatch(/wants \d+ contribution/i);
    }, 180_000);

    /**
     * AND THE FIX DID NOT WIDEN.
     *
     * Somebody of no house asking about no house in particular is asking about
     * a house they do not have, and the honest answer is the one they already
     * got. This is the arm that catches the fix reaching sentences that name
     * nothing.
     */
    it('still tells somebody of no house that they are of no house', async () => {
        const h = await ofNowhere('nobody-asks-about-nothing');
        const said = (await h.game.act('who runs the sect')).narration;
        expect(said).toMatch(/unaffiliated|belong to nothing|no house/i);
    }, 180_000);
});
