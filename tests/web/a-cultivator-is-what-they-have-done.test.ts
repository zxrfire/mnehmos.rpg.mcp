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
 * ADMIN is used twice and only to ARRANGE: it sets the rung so the cultivator
 * survives the reprisals, and it lands the attempts so the run does not turn
 * on nine coin flips. `docs/admin.md`: *the admin panel can set preconditions,
 * but it allows me to test outcomes.* Nothing here forces an outcome the engine
 * did not then write for itself - the records asserted on are the ones the
 * ordinary `interact` path wrote.
 */

import { SECTS } from '../../src/data/cultivation/sects';
import { TECHNIQUES } from '../../src/data/cultivation/techniques';
import { ifCaughtPractising, whoseArt } from '../../src/engine/world/manuals';
import { whatFollowsFromTheBout } from '../../src/engine/social-leverage/going-further-than-an-agreed-bout-allowed';
import { activeWorld } from '../../src/server/state/cultivation-world';
import type { AHolder } from '../../src/engine/social-leverage/being-hunted';
import { whatTheirRecordMakesThem } from '../../src/engine/social-leverage/personal-alignment';
import { obligationFromRow } from '../../src/storage/repos/obligation.repo';
import { whatTheWorldHoldsAbout } from '../../src/web/personal-record';
import { makeGameInWorld } from './harness';

/** The rung the cultivator is stood at. Their victims stand around twelve. */
const AMONG_PEERS = 12;
/** Far enough above the province that nothing in it could answer. */
const PAST_ANYBODY_HERE = 40;

/** Four ordinary verbs, none of which is a special case anywhere. */
const WHAT_THEY_DID = ['rob', 'threaten', 'deceive', 'interrogate'];

/**
 * Who the game just said was standing here, in the words it used.
 *
 * Read out of the narration rather than pinned, because the run seed decides
 * where somebody is born and a hard-coded name is a coincidence waiting to be
 * asserted. It is also the thing a player does: AGENTS.md - *any name the game
 * prints is a name the game must accept.*
 */
async function whoIsHere(game: { act(text: string): Promise<{ narration: string }> }): Promise<string[]> {
    const look = await game.act('I look around');
    const line = /^(.*?) (?:is|are) here\./m.exec(look.narration);
    if (!line) return [];
    return line[1].split(/,| and /).map(s => s.trim()).filter(Boolean);
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
        await game.act(`ADMIN set_realm ${AMONG_PEERS}`);
        const neighbours = await whoIsHere(game);
        expect(neighbours.length, 'nobody was standing here to wrong').toBeGreaterThanOrEqual(3);

        const before = whatTheWorldHoldsAbout({
            db: db as never,
            person: { id: cultivator.id, ordinal: AMONG_PEERS, backing: 'none' },
            lookUpHolder: await rosterLookup()
        });
        expect(before.is.alignment).toBe('neutral');

        for (const who of neighbours) {
            for (const verb of WHAT_THEY_DID) {
                await game.act(`ADMIN interact I ${verb} ${who}`);
                // The reprisals cost the body, and a dead cultivator cannot go
                // on being anything. Arranging, not deciding.
                await game.act(`ADMIN set_realm ${AMONG_PEERS}`);
            }
        }

        const after = whatTheWorldHoldsAbout({
            db: db as never,
            person: { id: cultivator.id, ordinal: AMONG_PEERS, backing: 'none' },
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
        await game.act(`ADMIN set_realm ${AMONG_PEERS}`);
        for (const who of await whoIsHere(game)) {
            for (const verb of WHAT_THEY_DID) {
                await game.act(`ADMIN interact I ${verb} ${who}`);
                await game.act(`ADMIN set_realm ${AMONG_PEERS}`);
            }
        }

        const lookUpHolder = await rosterLookup();
        const amongThem = whatTheWorldHoldsAbout({
            db: db as never,
            person: { id: cultivator.id, ordinal: AMONG_PEERS, backing: 'none' },
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
     * `ifCaughtPractising` says what they do - and it is not a question about
     * character. Nothing in either direction moves the reading.
     */
    it('leaves the reading exactly where it was, either way', async () => {
        // An art a house can actually call its own, rather than one so widely
        // held that nobody could claim it. `noHouseCanCallItTheirs` is the
        // question and `ifCaughtPractising` is where it is asked.
        const anArtWithAnOwner = TECHNIQUES.find(t => {
            const owners = whoseArt(t.id);
            return owners.length > 0 && ifCaughtPractising(t.id, owners[0]!) !== 'nothing';
        });
        expect(anArtWithAnOwner, 'no house in the catalog can claim an art').toBeDefined();
        const owners = whoseArt(anArtWithAnOwner!.id);
        const owner = SECTS.find(s => s.id === owners[0]);

        const { db, game } = await makeGameInWorld({
            seed: 'record', worldSeed: 'world-align', adminMode: true
        });
        const { cultivator } = await game.newRun('Student');
        await game.act(`ADMIN set_realm ${AMONG_PEERS}`);

        const lookUpHolder = await rosterLookup();
        const person = { id: cultivator.id, ordinal: AMONG_PEERS, backing: 'none' as const };
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
        await game.act(`ADMIN set_realm ${AMONG_PEERS}`);
        const theOneTheyPicked = (await whoIsHere(game))[0];
        expect(theOneTheyPicked, 'nobody was standing here').toBeDefined();
        for (const verb of WHAT_THEY_DID) {
            await game.act(`ADMIN interact I ${verb} ${theOneTheyPicked}`);
            await game.act(`ADMIN set_realm ${AMONG_PEERS}`);
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
            person: { id: cultivator.id, ordinal: AMONG_PEERS, backing: 'none' },
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
        const standingHere = await whoIsHere(game);
        expect(standingHere.length).toBeGreaterThanOrEqual(3);

        for (const who of standingHere) await game.act(`I kill ${who}`);

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
        expect(read.is.alignment).toBe('demonic');
        expect(read.is.wrongs).toBe(standingHere.length);
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
        await game.act(`ADMIN set_realm ${AMONG_PEERS}`);

        expect(game.state().cultivator.feuds).toEqual([]);

        for (const who of await whoIsHere(game)) {
            for (const verb of WHAT_THEY_DID) {
                await game.act(`ADMIN interact I ${verb} ${who}`);
                await game.act(`ADMIN set_realm ${AMONG_PEERS}`);
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

describe('and the world\'s own killers are on the ledger too', () => {
    withAdmin();

    /**
     * The design owner, on a war leaving nothing where a played killing left a
     * grudge: *this is bespoke. a war death is still a grudge. fix it.*
     *
     * Played, because that is the only way this was ever going to be found:
     * the world's wars ran for centuries writing an inherited tie into
     * `WorldState` and nothing at all into the table this reading is over. So
     * the reading measured the player alone, in a world full of killers no
     * record knew about.
     *
     * The span is arranged with ADMIN and nothing else is: the player sits
     * still, and every row asserted on was written by the world fighting its
     * own wars.
     */
    it('writes a war\'s dead into the same table a player\'s killing reaches', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'war-ledger', worldSeed: 'vol-a', adminMode: true
        });
        const { cultivator } = await game.newRun('Bystander');
        // Rations for the span, and a rung that survives it. Arranging.
        db.prepare('UPDATE cultivators SET spirit_stones = 90000000 WHERE id = ?')
            .run(cultivator.id);
        await game.act('ADMIN set_realm 30');

        expect((db.prepare('SELECT COUNT(*) AS n FROM obligations')
            .get() as { n: number }).n).toBe(0);

        for (let i = 0; i < 6; i++) {
            await game.act('ADMIN advance_days years=50 rations=9000');
            await game.act('ADMIN set_realm 30');
        }

        const rows = (db.prepare('SELECT * FROM obligations').all() as never[])
            .map(obligationFromRow);
        const fromAFight = rows.filter(r => r.tags.includes('bout'));
        expect(fromAFight.length).toBeGreaterThan(0);

        // Nobody arranged a war, so every one of them is priced as the open
        // killing it was - the same band a killing in a square gets.
        for (const row of fromAFight) {
            expect(row.tags).toContain('open');
            expect(row.subjectId).not.toBe(cultivator.id);
            expect(['grave', 'serious']).toContain(row.severity);
        }
        expect(fromAFight.some(r => r.severity === 'grave')).toBe(true);

        // One battle, many dead, and each death ONE deed rather than one row
        // per griever. This is the dedupe the reading depends on: without it a
        // victim's family size would price the killer's character.
        const deeds = new Set(fromAFight.map(r => r.triggeringEventId));
        expect(deeds.size).toBeGreaterThan(0);
        expect(deeds.size).toBeLessThan(fromAFight.length);

        // And the reading answers about them, off the same rows and the same
        // function the player is read with. A world in which only the player
        // has a reputation is a world in which nobody else has done anything.
        const killers = [...new Set(fromAFight.map(r => r.subjectId))];
        const readings = killers.map(id =>
            whatTheirRecordMakesThem({ personId: id, ledger: rows }));
        expect(readings.some(r => r.alignment === 'demonic')).toBe(true);
        expect(readings.every(r => r.alignment !== 'righteous')).toBe(true);
    }, 900_000);
});
