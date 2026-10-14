/**
 * A cultivator is what they have done, not what they practise and not whose
 * roll they are on.
 *
 * The design owner:
 *
 *   > you should be able to get to 44 using plain english, as a neutral,
 *   > righteous, or demonic/evil cultivator.
 *   >
 *   > also note that these are independent of techniques - you could cultivate
 *   > a righteous sect's technique and be evil, you'd just be hunted down (or
 *   > too powerful for them to touch you)
 *
 * Played, in plain English, through the ordinary verbs. Every assertion is on
 * state - the word the derivation returns, the rows behind it, and who is in a
 * position to act - and none is on prose.
 *
 * ADMIN arranges the rung, awareness of actual present people, and successful
 * attempts. The fixture also arranges contact at each person's current room.
 * `docs/admin.md`: *the admin panel can set preconditions,
 * but it allows me to test outcomes.* Nothing here forces an outcome the engine
 * did not then write for itself - the records asserted on are the ones the
 * ordinary `interact` path wrote.
 * Each wrong now spends time and may change daily placement. The test meets
 * each previously named target in their current area before the next wrong;
 * it still requires every distinct deed to be written to the same ledger.
 * The later cost-based pricing leaves the original three-person career at
 * 1.45 against the unchanged method line of 2. The fixture now meets eight
 * actual people and preserves the demonic, pursuit and distinct-deed claims.
 * Census diagnostics measured 24 distinct ordinary wrongs worth 3.60, with
 * two actual pursuers. No severity or alignment threshold is changed.
 */

// Load the played entry point before reading the catalogs it initializes.
import { makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/sects';
import { TECHNIQUES } from '../../src/data/cultivation/techniques';
import { whoseArt } from '../../src/engine/world/manuals';
import { whatFollowsFromTheBout } from '../../src/engine/social-leverage/going-further-than-an-agreed-bout-allowed';
import { activeWorld } from '../../src/server/state/cultivation-world';
import type { AHolder } from '../../src/engine/social-leverage/being-hunted';
import { whatTheWorldHoldsAbout } from '../../src/web/personal-record';
import type { GameService } from '../../src/web/game';
import { worldLocationFor } from '../../src/web/entities';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { standWhereThePeopleAre } from './standing-where-the-people-are';
import { whereCompoundsAre, whereTheyAreStanding } from '../../src/engine/world/where-inside-a-house-somebody-is-standing';

/** High enough to be seen and dealt with, before anybody is stood level with. */
const IN_PLAIN_SIGHT = 12;
/** Far enough above the province that nothing in it could answer. */
const PAST_ANYBODY_HERE = 40;

/**
 * The rung to stand at so the people here can answer for what is done to them.
 *
 * A pinned number pinned a coincidence. The square this seed opens on holds
 * people at ordinals two to five, and a cultivator stood at twelve among them
 * reads `overmatched` on every account they open, so a whole career of wrongs
 * produced a ledger nobody in it was in a position to act on. Level with the
 * strongest of them is the question these tests are actually asking, and it is
 * read off the world rather than declared.
 */
async function levelWith(names: readonly string[]): Promise<number> {
    const world = await activeWorld();
    const rungs = names.map(name =>
        world.state.npcs.find(npc => npc.name === name)?.cultivation.realmOrdinal ?? 0);
    return Math.max(1, ...rungs);
}

/**
 * Somewhere the world holds people who would be missed, and who they are.
 *
 * The square a run opens on is not that. This seed stands three people there
 * with no house, no family and no tie of any kind, and killing all three of
 * them correctly leaves the ledger empty - *still leaves nothing where the dead
 * left nobody*, below, is that same rule asserted directly. An account needs
 * somebody left to hold it, so a test about the account goes where there is
 * somebody, and takes the world's own answer for who that is.
 */
async function whereSomebodyWouldBeMissed(): Promise<{ locationId: string; placeName: string; victims: string[] }> {
    const world = await activeWorld();
    const alive = new Set(world.state.npcs.filter(n => n.status === 'alive').map(n => n.id));
    const missed = world.state.npcs.filter(npc =>
        alive.has(npc.id)
        && npc.relationships.some(tie => WOULD_MISS_THEM.has(tie.kind) && alive.has(tie.targetId)));

    const byPlace = new Map<string, string[]>();
    for (const npc of missed) {
        // Somebody the world holds nowhere in particular is nowhere to go and do
        // this, so they are not a place.
        if (npc.locationId === null) continue;
        byPlace.set(npc.locationId, [...(byPlace.get(npc.locationId) ?? []), npc.name]);
    }
    const [locationId, names] = [...byPlace].sort(
        (a, b) => (b[1].length - a[1].length) || a[0].localeCompare(b[0])
    )[0] ?? ['', []];
    // THE ADMIN VERBS TAKE A PLACE'S NAME, never its id: `set_location` looks
    // the text up in a gazetteer of names. Measured on `world-align`: the
    // busiest place is now a house's grounds, `loc-house-immovable-mountain-
    // ground` tied five precinct names and was refused, the player never moved,
    // and all three killings resolved to nobody - so the ledger was empty
    // because nothing happened, not because a killing wrote nothing.
    const placeName = world.state.locations.find(l => l.id === locationId)?.name ?? locationId;
    return { locationId, placeName, victims: names };
}

/** Ties that leave somebody holding it. The engine's set, not a second one. */
const WOULD_MISS_THEM = new Set(['kin', 'spouse', 'parent', 'child']);

/** Who is standing here, and the rung that puts the cultivator among them. */
async function standingAmongThem(
    game: { act(text: string): Promise<{ narration: string }> } & Pick<GameService, 'atHand' | 'currentRun' | 'repos' | 'present' | 'knowledge'>
): Promise<{ neighbours: string[]; rung: number }> {
    const neighbours = await whoIsHere(game);
    // Collect actual people across the place's existing areas.
    const place = game.atHand ? worldLocationFor(game.atHand, game.currentRun().cultivator.location) : null;
    for (const area of place && game.atHand ? theAreasOf(game.atHand, place).areas : []) {
        if (neighbours.length >= 8) break;
        game.repos.cultivators.standIn(game.currentRun().cultivator.id, area.id);
        // Knowing these actual faces is an arranged precondition. This file
        // tests what wrongdoing writes, while the greeting file tests how a
        // person gives their name. No name is invented or pinned to the seed.
        for (const person of game.present(game.currentRun().cultivator)) {
            await game.act(`ADMIN grant_knowledge kind=cultivator name=${person.name}`);
        }
        for (const name of await whoIsHere(game)) if (!neighbours.includes(name)) neighbours.push(name);
    }
    const career = neighbours.slice(0, 8);
    expect(career.length, 'the ordinary career needs eight actual people, not repeated charges against one').toBe(8);
    return { neighbours: career, rung: await levelWith(career) };
}

/** Arrange contact at their actual room immediately before each dated act. */
async function meetThem(game: GameService, who: string): Promise<void> {
    const world = (await game.loadWorld())!;
    const target = world.npcs.find(person => person.name === who)!;
    const physical = whereTheyAreStanding(world, whereCompoundsAre(world), target,
        new Set(world.npcs.map(person => person.id)));
    const place = world.locations.find(location => location.id === physical)!;
    const body = game.currentRun().cultivator;
    game.repos.cultivators.update(body.id, { location: place.name });
    await standWhereThePeopleAre({ game, repos: game.repos }, body.id, new Set([target.id]));
    expect(game.present(game.currentRun().cultivator).some(person => person.id === target.id),
        'the next wrong requires its named target to be present').toBe(true);
}

/** Four ordinary verbs, none of which is a special case anywhere. */
const WHAT_THEY_DID = ['rob', 'threaten', 'deceive', 'interrogate'];

/** Actual present people whose names this fixture has arranged to know. */
async function whoIsHere(game: { act(text: string): Promise<{ narration: string }> }
    & Pick<GameService, 'present' | 'currentRun' | 'knowledge'>): Promise<string[]> {
    // Arrival prose and a census need not introduce every face. This career
    // tests deeds rather than introductions, so read actual presence and the
    // existing awareness authority. Names remain drawn from the real world.
    await game.act('who else is here');
    const body = game.currentRun().cultivator;
    return game.present(body)
        .filter(person => game.knowledge.isAwareOf(body.id, 'cultivator', person.id))
        .map(person => person.name);
}

/** ADMIN_MODE is read at call time, so a test can turn it on and put it back. */
function withAdmin(): void {
    const before = process.env.ADMIN_MODE;
    beforeAll(() => { process.env.ADMIN_MODE = 'true'; });
    afterAll(() => {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    });
}

/**
 * Who each id on the ledger actually is, off the world's own roster.
 *
 * Nothing is invented: an id the world does not hold comes back null and
 * `whoIsComingForYou` leaves it out of both lists.
 */
async function rosterLookup(): Promise<(id: string) => AHolder | null> {
    const world = await activeWorld();
    const byId = new Map(world.state.npcs.map(n => [n.id, n]));
    return (id: string) => {
        const npc = byId.get(id);
        if (!npc) return null;
        return {
            id: npc.id,
            name: npc.name,
            ordinal: npc.cultivation.realmOrdinal,
            houseId: npc.factionId
        };
    };
}

describe('becoming something by acting', () => {
    withAdmin();

    it('starts as nobody, and nobody is not righteous', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'record', worldSeed: 'world-record', adminMode: true
        });
        const { cultivator } = await game.newRun('Nobody');

        const read = whatTheWorldHoldsAbout({
            db: db as never,
            person: { id: cultivator.id, ordinal: cultivator.realmOrdinal, backing: 'none' },
            lookUpHolder: await rosterLookup()
        });

        // The old reading was `mySect?.alignment ?? null`, and a cultivator on
        // no roll therefore had no alignment at all. This one always answers.
        expect(read.is.alignment).toBe('neutral');
        expect(read.is.nothingEitherWay).toBe(true);
        expect(read.is.taken).toBe(0);
        expect(read.is.paid).toBe(0);
        // And nobody is hunting them, which for once is true rather than a
        // stored array nothing has ever written to.
        expect(read.hunted.hunted).toBe(false);
        expect(read.feuds).toHaveLength(0);
    }, 180_000);

    it('is demonic after a run of ordinary wrongs, off the ledger the verbs wrote', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'record', worldSeed: 'world-align', adminMode: true
        });
        const { cultivator } = await game.newRun('Taker');
        await game.act(`ADMIN set_realm ${IN_PLAIN_SIGHT}`);
        const { neighbours, rung } = await standingAmongThem(game);
        expect(neighbours.length, 'nobody was standing here to wrong').toBeGreaterThanOrEqual(3);
        await game.act(`ADMIN set_realm ${rung}`);

        const before = whatTheWorldHoldsAbout({
            db: db as never,
            person: { id: cultivator.id, ordinal: rung, backing: 'none' },
            lookUpHolder: await rosterLookup()
        });
        expect(before.is.alignment).toBe('neutral');

        for (const who of neighbours) {
            for (const verb of WHAT_THEY_DID) {
                await meetThem(game, who);
                await game.act(`ADMIN interact I ${verb} ${who}`);
                // The reprisals cost the body, and a dead cultivator cannot go
                // on being anything. Arranging, not deciding.
                await game.act(`ADMIN set_realm ${rung}`);
            }
        }

        const after = whatTheWorldHoldsAbout({
            db: db as never,
            person: { id: cultivator.id, ordinal: rung, backing: 'none' },
            lookUpHolder: await rosterLookup()
        });

        expect(after.is.alignment).toBe('demonic');
        // Three distinct wrongs per person. The ledger keys a record on the
        // pair AND the cause, so doing the same thing to the same person twice
        // is one standing fact - which is why a career has to be spread rather
        // than ground.
        expect(after.is.wrongs).toBe(neighbours.length * 3);
        expect(after.is.paid).toBe(0);
        expect(after.is.nothingEitherWay).toBe(false);

        // And the world now reads them differently: people who could not have
        // been said to be hunting anybody are now in a position to act.
        expect(after.hunted.hunted).toBe(true);
        expect(after.feuds.length).toBeGreaterThan(0);
        for (const pursuer of after.hunted.coming) {
            expect(pursuer.acting).toBe('they_can_act');
            expect(pursuer.bother).toBe('worth_mounting');
        }
    }, 300_000);
});

describe('and what the people holding it can do about it', () => {
    withAdmin();

    /**
     * The owner's two halves, off ONE ledger. The same nine records, read for
     * somebody standing among their victims and for somebody standing well
     * past anything in the province.
     */
    it('hunts them where it can reach them and writes the name down where it cannot', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'record', worldSeed: 'world-align', adminMode: true
        });
        const { cultivator } = await game.newRun('Taker');
        await game.act(`ADMIN set_realm ${IN_PLAIN_SIGHT}`);
        const { neighbours, rung } = await standingAmongThem(game);
        await game.act(`ADMIN set_realm ${rung}`);
        for (const who of neighbours) {
            for (const verb of WHAT_THEY_DID) {
                await meetThem(game, who);
                await game.act(`ADMIN interact I ${verb} ${who}`);
                await game.act(`ADMIN set_realm ${rung}`);
            }
        }

        const lookUpHolder = await rosterLookup();
        const amongThem = whatTheWorldHoldsAbout({
            db: db as never,
            person: { id: cultivator.id, ordinal: rung, backing: 'none' },
            lookUpHolder
        });
        const pastThem = whatTheWorldHoldsAbout({
            db: db as never,
            person: { id: cultivator.id, ordinal: PAST_ANYBODY_HERE, backing: 'none' },
            lookUpHolder
        });

        // What they ARE does not move. Standing higher is not an answer to
        // anything they did.
        expect(pastThem.is.alignment).toBe(amongThem.is.alignment);
        expect(pastThem.is.taken).toBe(amongThem.is.taken);

        // What can be DONE about it moves entirely.
        expect(amongThem.hunted.hunted).toBe(true);
        expect(amongThem.hunted.coming.length).toBeGreaterThan(0);
        expect(pastThem.hunted.hunted).toBe(false);
        expect(pastThem.hunted.coming).toHaveLength(0);

        // Nothing was dropped on the way. Every account that could be acted on
        // from among them is still open from above them - it has only moved
        // into the list of names with nothing behind them.
        const total = (r: typeof amongThem) =>
            r.hunted.coming.length + r.hunted.namesWithNothingBehindThem.length;
        expect(total(pastThem)).toBe(total(amongThem));
        for (const row of pastThem.hunted.namesWithNothingBehindThem) {
            expect(row.bother).toBe('beyond_them');
        }

        // And not one of them is lighter for having become unenforceable. The
        // gap is temporary; the record is not.
        const weights = (r: typeof amongThem) => [
            ...r.hunted.coming, ...r.hunted.namesWithNothingBehindThem
        ].map(p => `${p.holderId}:${p.severity}`).sort();
        expect(weights(pastThem)).toEqual(weights(amongThem));
    }, 300_000);
});

describe('practising an art makes you nothing', () => {
    withAdmin();

    /**
     * The owner's explicit example. Holding a house's road is a question about
     * PERMISSION - `unauthorisedPractice` names who would want a word, and
     * The house alignment decides what they do - and it is not a question about
     * character. Nothing in either direction moves the reading.
     */
    it('leaves the reading exactly where it was, either way', async () => {
        // An art a house can actually call its own, rather than one so widely
        // held that nobody could claim it. `noHouseCanCallItTheirs` is the
        // question and the ownership read is where it is asked.
        const anArtWithAnOwner = TECHNIQUES.find(t => {
            const owners = whoseArt(t.id);
            return owners.length > 0;
        });
        expect(anArtWithAnOwner, 'no house in the catalog can claim an art').toBeDefined();
        const owners = whoseArt(anArtWithAnOwner!.id);
        const owner = SECTS.find(s => s.id === owners[0]);

        const { db, game } = await makeGameInWorld({
            seed: 'record', worldSeed: 'world-align', adminMode: true
        });
        const { cultivator } = await game.newRun('Student');
        await game.act(`ADMIN set_realm ${IN_PLAIN_SIGHT}`);

        const lookUpHolder = await rosterLookup();
        const person = { id: cultivator.id, ordinal: IN_PLAIN_SIGHT, backing: 'none' as const };
        const before = whatTheWorldHoldsAbout({ db: db as never, person, lookUpHolder });

        // Arrange the precondition: they are now carrying somebody else's road.
        db.prepare('UPDATE cultivators SET known_techniques = ? WHERE id = ?')
            .run(JSON.stringify([anArtWithAnOwner!.id]), cultivator.id);

        const after = whatTheWorldHoldsAbout({ db: db as never, person, lookUpHolder });
        expect(after.is).toEqual(before.is);
        expect(after.is.alignment).toBe('neutral');
        // Including where the house that owns it is one of the demonic ones -
        // there is no path from a shelf to a character in either direction.
        expect(['righteous', 'neutral', 'demonic']).toContain(owner?.alignment ?? 'neutral');
    }, 180_000);
});

describe('and it binds anybody', () => {
    withAdmin();

    /**
     * The same call, asked about somebody who is not the player, off the same
     * rows. A world in which only the player has a reputation is a world in
     * which nobody else has done anything.
     */
    it('answers about the victims off the same ledger', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'record', worldSeed: 'world-align', adminMode: true
        });
        const { cultivator } = await game.newRun('Taker');
        await game.act(`ADMIN set_realm ${IN_PLAIN_SIGHT}`);
        const { neighbours, rung } = await standingAmongThem(game);
        const theOneTheyPicked = neighbours[0];
        expect(theOneTheyPicked, 'nobody was standing here').toBeDefined();
        await game.act(`ADMIN set_realm ${rung}`);
        for (const verb of WHAT_THEY_DID) {
            await meetThem(game, theOneTheyPicked);
            await game.act(`ADMIN interact I ${verb} ${theOneTheyPicked}`);
            await game.act(`ADMIN set_realm ${rung}`);
        }

        const lookUpHolder = await rosterLookup();
        const world = await activeWorld();
        const victim = world.state.npcs.find(n => n.name === theOneTheyPicked);
        expect(victim, 'the person who was robbed is not on the roster').toBeDefined();

        const theirs = whatTheWorldHoldsAbout({
            db: db as never,
            person: {
                id: victim!.id,
                ordinal: victim!.cultivation.realmOrdinal,
                backing: victim!.factionId ? 'backed' : 'none'
            },
            lookUpHolder
        });

        // They hold the records; they are the subject of none of them. Being
        // wronged is not a thing that makes somebody anything.
        expect(theirs.is.wrongs).toBe(0);
        expect(theirs.is.alignment).toBe('neutral');
        expect(theirs.hunted.hunted).toBe(false);
        expect(theirs.ledger.length).toBeGreaterThan(0);

        // And the person who did it reads off the very same rows.
        const mine = whatTheWorldHoldsAbout({
            db: db as never,
            person: { id: cultivator.id, ordinal: rung, backing: 'none' },
            lookUpHolder
        });
        expect(mine.is.wrongs).toBeGreaterThan(0);
    }, 300_000);
});

describe('the dead hold nothing, so the people they left do', () => {
    withAdmin();

    /**
     * THE HOLE, MEASURED BEFORE IT WAS CLOSED. A cultivator killed two people
     * in front of eight witnesses and `obligations` held ZERO rows afterwards,
     * while `interact` opened one for a robbery every single time. So the
     * heaviest thing a player could do to somebody was the one thing that left
     * nothing on the ledger - the agency rule's softening in its most invisible
     * form - and the world's own report of the same killing had named an heir
     * on the way past.
     */
    it('opens an account against the killer, held by the people the dead left', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'record', worldSeed: 'world-align', adminMode: true
        });
        const { cultivator } = await game.newRun('Taker');
        // Far enough above them that the killing is not in doubt. Arranging.
        await game.act('ADMIN set_realm 30');
        const { placeName, victims } = await whereSomebodyWouldBeMissed();
        expect(victims.length, 'nobody in this world has anybody').toBeGreaterThanOrEqual(3);
        await game.act(`ADMIN grant_knowledge kind=place name=${placeName}`);
        await game.act(`ADMIN set_location ${placeName}`);

        const theDead = victims.slice(0, 3);
        for (const who of theDead) await game.act(`I kill ${who}`);

        const lookUpHolder = await rosterLookup();
        const read = whatTheWorldHoldsAbout({
            db: db as never,
            person: { id: cultivator.id, ordinal: 30, backing: 'none' },
            lookUpHolder
        });

        // Somebody holds it, and it is at the weight the bout table decided for
        // a killing on open terms rather than at a floor.
        const killings = read.ledger.filter(
            row => row.subjectId === cultivator.id && row.cause === 'killed_kin'
        );
        expect(killings.length).toBeGreaterThan(0);
        for (const row of killings) {
            expect(row.severity).toBe('grave');
            expect(row.status).toBe('open');
            expect(row.holderId).not.toBe(cultivator.id);
            // Every row says how its holder comes to be holding it, in the
            // ledger's own word for the connection.
            expect(row.tags.some(t => t === 'institutional' || t.startsWith('carried:')))
                .toBe(true);
        }

        // Three killings is a method, and it does not matter that one victim
        // had two sons: the copies collapse onto the deed behind them.
        //
        // COLLAPSING IS THE CLAIM, AND THE COUNT IS NOT. This asked for exactly
        // one wrong per killing, which assumes every victim leaves somebody
        // alive to hold it - and the picker only guarantees that at the moment
        // it picks, not after the other two are dead. Two of these people can
        // be each other's survivor, and the design owner's ruling on that is
        // that there is no reason a victim cannot themselves be a survivor. A
        // killing the last of somebody's people did not live through opens no
        // account, which is the world being right rather than a count being
        // short. So: never more than one per deed, and at least one.
        expect(read.is.alignment).toBe('demonic');
        expect(read.is.wrongs).toBeGreaterThan(0);
        expect(read.is.wrongs).toBeLessThanOrEqual(theDead.length);
    }, 300_000);

    /**
     * The other half of the same defect: the world held the killing at the
     * lowest band it has, because the weight fell through to a floor meant for
     * an event nobody was owed anything for. A killing is not `slight` to
     * anybody.
     */
    it('puts the killing into the world at what it was worth', async () => {
        const { game } = await makeGameInWorld({
            seed: 'record', worldSeed: 'world-align', adminMode: true
        });
        await game.newRun('Taker');
        await game.act('ADMIN set_realm 30');
        const [first] = await whoIsHere(game);
        await game.act(`I kill ${first}`);

        const world = await activeWorld();
        const killings = world.state.history.facts.filter(
            fact => fact.data?.howFar === 'killed'
        );
        expect(killings.length, 'the killing is not in the world').toBeGreaterThan(0);
        for (const fact of killings) {
            expect(fact.data?.deedWeight).not.toBe('slight');
            // And it travels. `circulating` and the digest both filter on this.
            expect(fact.magnitude).toBeGreaterThan(0.5);
        }
    }, 300_000);

    /**
     * Somebody with nobody stays the cheapest killing in the world, and that
     * has to stay reachable or the ledger stops meaning anything. Asserted on
     * the engine rather than by hunting for a friendless NPC in a seed.
     */
    it('still leaves nothing where the dead left nobody', () => {
        const followed = whatFollowsFromTheBout({
            terms: 'open',
            outcome: 'lethal',
            loserDied: true,
            witnesses: 4,
            theirHouse: null
        });
        expect(followed.against).toBeNull();
        expect(followed.heldBy).toEqual([]);
    });
});

describe('the sheet finally says something true', () => {
    withAdmin();

    /**
     * `Cultivator.feuds` has one writer in all of `src/`, on the MCP path, so
     * the panel has said *"No one is currently hunting you"* for the whole life
     * of this game whatever the player did. This is the acceptance for the
     * reading: the line changes because the player acted, and changes back
     * because they climbed past everybody holding it.
     */
    it('names who is hunting, and stops when nobody can reach them', async () => {
        const { game } = await makeGameInWorld({
            seed: 'record', worldSeed: 'world-align', adminMode: true
        });
        await game.newRun('Taker');
        await game.act(`ADMIN set_realm ${IN_PLAIN_SIGHT}`);

        expect(game.state().cultivator.feuds).toEqual([]);

        const { neighbours, rung } = await standingAmongThem(game);
        await game.act(`ADMIN set_realm ${rung}`);
        for (const who of neighbours) {
            for (const verb of WHAT_THEY_DID) {
                await meetThem(game, who);
                await game.act(`ADMIN interact I ${verb} ${who}`);
                await game.act(`ADMIN set_realm ${rung}`);
            }
        }

        const hunting = game.state().cultivator.feuds;
        expect(hunting.length).toBeGreaterThan(0);
        // People, not records. Somebody holding three accounts is one person on
        // the road behind you.
        expect(new Set(hunting).size).toBe(hunting.length);

        // And it is not a stored list: climbing past everybody who holds
        // something empties it, without a single row being settled or deleted.
        await game.act(`ADMIN set_realm ${PAST_ANYBODY_HERE}`);
        expect(game.state().cultivator.feuds).toEqual([]);
    }, 300_000);
});
