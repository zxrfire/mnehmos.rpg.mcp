/**
 * A rung nobody earned, and who can actually give one.
 *
 * Cash bought a rung outright until this session: `donate` converted spirit
 * stones into contribution and contribution is the whole of what
 * `handlePromote` gates on. Struck by the design owner, with the road that
 * replaces it named in the same breath - *you can't buy a rung with cash, you
 * can bribe for it though*. The difference is not the money. It is that a
 * bribe runs through a PERSON, and a person can be the wrong person, can
 * refuse, can want something money is not, and can be reported afterwards.
 *
 * WHAT IS PINNED HERE IS THE THREE THINGS THAT MAKE IT A ROAD RATHER THAN A
 * PRICE:
 *
 *   1. Somebody who does not hold the room cannot move a rung, whatever is put
 *      in front of them - and the refusal NAMES who could. Money reached a
 *      person, a day went, and the ladder did not move.
 *   2. The person whose call it is can refuse, and the refusal names the rung
 *      of the ladder that would have worked. Nothing chooses that wording:
 *      `baseWeightOf('advancement')` is `against_their_interest`, `PURSE_REACH`
 *      at that weight is 0.2, and `whatTheyWillTakeFor` stops taking money at
 *      exactly 0.2 - so "they want an open account, not stones" falls out of
 *      one weight rather than out of a sentence written here.
 *   3. When it lands, the rung moves and CONTRIBUTION DOES NOT. That is the
 *      whole ruling in one assertion: the record of service is untouched, and
 *      the board is still the only thing that writes it.
 *
 * MEASURED, six pinned worlds (`scripts/probe-what-a-rung-costs.ts`): five of
 * six starting disciples could NAME the person whose call a rung is, and all
 * five of those wanted `a favour` rather than stones. Nobody at the bottom is
 * bought with money alone, which is the design working rather than a gap.
 *
 * AND THE PRECONDITION IS ARRANGED, WHICH IS A FINDING AND IS WRITTEN DOWN.
 * A house's own compound cannot be travelled to on day 0 - "everybody has
 * heard the name, nobody has been" - and `rosterFor` deals the roll out of the
 * CATALOG while somebody standing in a square arrives as their world row. So
 * the meeting is set up here rather than walked to, and the reachability gap
 * is routed in OPEN-QUESTIONS.md rather than papered over. What is NOT
 * arranged is any part of the decision: the resolver decides, and the rung
 * moves only where it said `taken`.
 *
 * RED-CHECKED, each half against the line it protects:
 *   - dropping the `whoWasPutTo !== call.holderId` guard: the porter test goes
 *     red, because a gate porter then sells a rung.
 *   - dropping the `pressed.outcome !== 'executed'` guard: the refusal test
 *     goes red, because a refused ask raises you anyway.
 *   - putting `addContribution` back in `donate`: the contribution assertion in
 *     the third test still passes, which is why `a-rung-is-not-for-sale.test.ts`
 *     exists as well - this file pins the ROAD and that one pins the PRICE.
 */

import { makeGameInWorld } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';
import { positionIn } from '../../src/web/standing';
import { portfoliosIn } from '../../src/engine/social-leverage/authority-for-an-order';
import type { LocationRecord } from '../../src/engine/world/locations';
import { rosterFor } from '../../src/web/encounters';
import { whoCouldRaiseYou } from '../../src/engine/social-leverage/a-rung-nobody-earned';
import { createFavor } from '../../src/engine/social/grudges';
import { ledgerAbout, writeOneObligation } from '../../src/storage/repos/obligation.repo';
import { baseWeightOf } from '../../src/web/what-a-request-asks-and-of-whom';
import { requestPutToSomebody } from '../../src/web/what-a-request-asks-and-of-whom';
import { parseIntent } from '../../src/web/actions';

/**
 * A disciple standing in front of the people of their own house.
 *
 * Everything mechanical is read out of the engine rather than named here: which
 * house this seed let them hear of, who holds the room, and where that person
 * stands. Nothing is hard-coded, so a reshuffle of the catalog moves this test
 * with it instead of breaking it.
 */
async function inFrontOfTheHouse(seed: string) {
    const { db, game } = await makeGameInWorld({ seed, worldSeed: `${seed}-world` });
    const { cultivator } = await game.newRun('Probe');
    db.prepare('UPDATE cultivators SET spirit_stones = 8000 WHERE id = ?').run(cultivator.id);

    const known = new KnowledgeGate(db).awareness(cultivator.id, 'sect')
        .filter(row => row.sourceKind === 'told');
    expect(known.length, `seed ${seed} left them knowing no house`).toBeGreaterThan(0);
    await game.act(`I join the ${known[0]!.name}`);

    const svc = game as unknown as {
        repos: Parameters<typeof positionIn>[0];
        knowledge: unknown;
        loadWorld(): Promise<unknown>;
    };
    const held = positionIn(svc.repos, cultivator.id);
    expect(held, `seed ${seed} left them on nobody's roll`).toBeTruthy();

    const world = await svc.loadWorld() as {
        npcs?: Array<{ id: string; locationId?: string }>;
        // The rows the engine actually holds. Written out narrower here once,
        // which made `portfoliosIn` look as though it took a pair of strings.
        locations?: readonly LocationRecord[];
    };
    const me = (svc.repos as unknown as { cultivators: { getById(id: string): never } })
        .cultivators.getById(cultivator.id);
    const roster = rosterFor(
        { repos: svc.repos, knowledge: svc.knowledge, world } as never, me
    );
    const roll = [
        { id: cultivator.id, rankIndex: held!.rankIndex },
        ...roster.map(p => ({ id: p.id, rankIndex: p.rankIndex ?? 0 }))
    ];
    const portfolios = portfoliosIn({
        locations: world.locations ?? [],
        sectId: held!.sectId,
        roll,
        rankCount: held!.rankCount
    });
    const call = whoCouldRaiseYou({ portfolios, roll, rankCount: held!.rankCount });
    const holder = roster.find(p => p.id === call.holderId);
    const somebodyElse = roster.find(p => p.id !== call.holderId);
    expect(holder, `seed ${seed}: nobody holds the room a rung is decided in`).toBeTruthy();
    expect(somebodyElse, `seed ${seed}: the house has nobody else on its roll`).toBeTruthy();

    // Standing where they stand. See the header: travel cannot reach a house's
    // own compound on day 0, so this is arranged.
    const row = world.npcs?.find(n => n.id.endsWith(String(call.holderId)));
    const place = world.locations?.find(l => l.id === row?.locationId);
    expect(place, `seed ${seed}: the person holding the room stands nowhere`).toBeTruthy();
    db.prepare('UPDATE cultivators SET location = ? WHERE id = ?')
        .run(place!.name, cultivator.id);

    return { db, game, cultivator, held: held!, holder: holder!, somebodyElse: somebodyElse! };
}

const SEED = 'a-rung-is-somebodys-to-give';

describe('a rung is somebody\'s to give', () => {
    /**
     * The classification, which is the whole of how a bribe reaches this at
     * all. A rung asked for politely and a rung asked for with money are one
     * ask - nothing downstream may read which word was used - and a rung asked
     * of the HOUSE is still the house's own step.
     */
    it('reads asking to be raised as one ask, whatever it was asked with', () => {
        expect(requestPutToSomebody('I ask Shu Wanping to promote me')?.kind)
            .toBe('advancement');
        expect(requestPutToSomebody('I bribe Shu Wanping to promote me')?.kind)
            .toBe('advancement');
        expect(baseWeightOf('advancement')).toBe('against_their_interest');

        // And the house's own step is untouched: no person is named, so there
        // is nobody for it to be put to.
        expect(parseIntent('I ask the sect to promote me').action).toBe('sect');
        expect(parseIntent('I ask for a promotion').action).toBe('sect');
        // A NAMED PERSON TAKES IT OUT OF THE HOUSE'S OWN STEP. Which of the
        // two person-shaped doors it goes through is implementation - `request`
        // hands an advancement ask straight to `interact` - so what is pinned
        // is that `handlePromote` no longer answers a sentence about somebody.
        for (const said of [
            'I bribe Shu Wanping with 2000 stones to promote me',
            'I ask Shu Wanping to promote me',
            'I offer Shu Wanping 500 spirit stones to raise me a rung'
        ]) {
            expect(parseIntent(said).action, said).not.toBe('sect');
        }
    });

    it('will not be given by somebody who does not hold the room', async () => {
        const { db, game, cultivator, held, somebodyElse, holder } =
            await inFrontOfTheHouse(`${SEED}-porter`);
        const before = Number((db.prepare('SELECT spirit_stones FROM cultivators WHERE id = ?')
            .get(cultivator.id) as { spirit_stones: number }).spirit_stones);

        const acted = await game.act(
            `I bribe ${somebodyElse.name} with 500 spirit stones to promote me`
        );

        // The ladder did not move.
        expect(positionIn(
            (game as unknown as { repos: Parameters<typeof positionIn>[0] }).repos,
            cultivator.id
        )!.rankIndex).toBe(held.rankIndex);
        // And the refusal is not a blank look: it says who could have.
        expect(acted.narration).toContain(holder.name);
        expect(acted.narration).toMatch(/not the door|does not decide this/i);
        // Money in front of the wrong person is still money in front of
        // somebody. Whether the resolver took it is the resolver's business;
        // what must not happen is the purse being untouched AND the rung
        // moving, and the rung is what this pins.
        expect(before).toBeGreaterThan(0);
    }, 180_000);

    it('is refused by the person whose call it is, naming what would have worked', async () => {
        const { game, cultivator, held, holder } = await inFrontOfTheHouse(`${SEED}-refused`);

        const acted = await game.act(
            `I bribe ${holder.name} with 4000 spirit stones to promote me`
        );

        expect(positionIn(
            (game as unknown as { repos: Parameters<typeof positionIn>[0] }).repos,
            cultivator.id
        )!.rankIndex).toBe(held.rankIndex);
        // The rung of the ladder they wanted instead, in the words
        // `what-they-will-take-instead-of-money.ts` uses for it. A refusal that
        // named nothing would pass a "did not promote" assertion and be the
        // blank look this repo spends most of its length on.
        expect(acted.narration).toMatch(/will not take spirit stones for this/i);
        expect(acted.narration).toMatch(/open account with your name on it/i);
    }, 180_000);

    /**
     * The half the ruling actually asked for, and the three things that have to
     * be true at once for it to be a road rather than a cheat.
     */
    it('moves the rung when it lands, and leaves the ledger of service alone', async () => {
        const { db, game, cultivator, held, holder } = await inFrontOfTheHouse(`${SEED}-taken`);
        const repos = (game as unknown as { repos: Parameters<typeof positionIn>[0] }).repos;

        // ARRANGED, and only the standing: an open account with somebody, and
        // a gap the resolver does not read as hopeless. The decision itself is
        // untouched - the resolver may still refuse, which is why this asks
        // more than once rather than asserting a single draw.
        writeOneObligation(db as never, createFavor({
            holderId: cultivator.id,
            subjectId: holder.id,
            cause: 'saved_life',
            severity: 'grave',
            onDay: 0,
            description: 'arranged: the elder owes them'
        }));
        db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
            .run(holder.realmOrdinal, cultivator.id);

        let narration = '';
        for (let i = 0; i < 8; i += 1) {
            narration = (await game.act(
                `I bribe ${holder.name} with 2000 spirit stones to promote me`
            )).narration ?? '';
            if ((positionIn(repos, cultivator.id)?.rankIndex ?? 0) > held.rankIndex) break;
        }

        const after = positionIn(repos, cultivator.id)!;
        expect(after.rankIndex, 'eight asks and the rung never moved').toBe(held.rankIndex + 1);

        // THE RULING, AS ONE NUMBER. A rung was got and nothing was written
        // against their name to say they had earned it.
        expect(after.contribution).toBe(0);

        // WHAT IT COST THE PERSON WHO GAVE IT. Two rows, and the second is the
        // shape `who-can-put-your-name-up-for-a-posting.ts` established: the
        // one passed over holds it against WHOEVER CHOSE, never against the
        // one who went.
        const againstTheGiver = ledgerAbout(db as never, holder.id)
            .filter(r => r.tags.includes('a_rung_that_was_given'));
        expect(againstTheGiver.length, 'nobody has anything on the person who gave it')
            .toBeGreaterThan(0);
        for (const record of againstTheGiver) {
            expect(record.subjectId).toBe(holder.id);
            expect(record.holderId).not.toBe(cultivator.id);
        }

        expect(narration).toMatch(/board has nothing against your name/i);
    }, 240_000);
});
