/**
 * What a player does enters the world, and can reach somebody.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `src/engine/world/` holds 28 exported functions that append a fact to the
 * world's history. Four of them were reachable from anywhere else in `src/`,
 * and three of those from a player action: an abode above the Lid, a descent,
 * and a killing. Everything else a played cultivator did that the world should
 * contain went into the SQLite obligation ledger and nowhere else - so a house
 * held a robbery grudge about somebody and the world did not contain the
 * robbery.
 *
 * That is a missing WRITER on one side of every propagation system in the
 * repository. `circulating` reads `state.history.facts` and nothing else.
 * `buildPlayerDigest` reads facts and nothing else. Hearsay, rumour, the market
 * repeat and a stranger's second-hand account are all readers over a table the
 * player could not write to.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THESE ARE PLAYED RATHER THAN UNIT TESTS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * AGENTS.md, *a module nothing calls is not a feature*: the definition of done
 * is that somebody in the running world reaches it by doing something. A unit
 * test on the writer proves the writer writes. These type the sentence a player
 * would type, then go and look for the fact - and then ask whether anybody
 * could hear about it.
 *
 * `worldEnabled: true` throughout. With the world off there is no world state
 * to write a fact into and every assertion here would pass vacuously by
 * measuring a configuration nobody plays.
 */

import { makeGame, cultivatorRow } from './harness';
import { SITES } from '../../src/data/cultivation/inheritance-trials';
import { circulating, whatTheySay } from '../../src/engine/world/what-people-are-saying';
import { buildPlayerDigest, simpleAccess } from '../../src/engine/world/digest';
import type { WorldState } from '../../src/engine/world/world-state';
import type { HistoricalFact } from '../../src/engine/world/history';

interface LedgerRow {
    kind: string;
    cause: string;
    severity: string;
    holder_id: string;
    subject_id: string;
    triggering_event_id: string | null;
}

function ledger(db: ReturnType<typeof makeGame>['db']): LedgerRow[] {
    return db.prepare(
        'SELECT kind, cause, severity, holder_id, subject_id, triggering_event_id FROM obligations'
    ).all() as LedgerRow[];
}

/** Everything the world's own record says about this cultivator. */
function factsNaming(world: WorldState, id: string): HistoricalFact[] {
    return world.history.facts.filter(f => f.actors.some(a => a.id === id));
}

/** Somebody alive who is not the player, preferring one standing where it happened. */
function aTeller(world: WorldState, playerId: string, fact: HistoricalFact) {
    const them = world.npcs.find(n =>
        n.id !== playerId && n.status === 'alive' && n.locationId === fact.locationId)
        ?? world.npcs.find(n => n.id !== playerId && n.status === 'alive')!;
    return {
        id: them.id,
        name: them.name,
        realmOrdinal: them.cultivation.realmOrdinal,
        regionId: null,
        factionId: them.factionId ?? null
    };
}

// ─────────────────────────────────────────────────────────────────────────
// A GIFT
// ─────────────────────────────────────────────────────────────────────────

describe('a gift to a house is a thing the world contains', () => {
    /**
     * The kindness direction, and the one call site where nothing had priced
     * the deed already - so `whatADeedLeaves` prices it, which is what that
     * module is for and what it had no caller in `src/` to do.
     */
    it('writes a fact, priced by what it cost against what they had', async () => {
        const { db, game } = makeGame({ seed: 'gift-deed', worldEnabled: true });
        const { cultivator } = await game.newRun('Probe');
        db.prepare('UPDATE cultivators SET spirit_stones = ? WHERE id = ?').run(400, cultivator.id);
        await game.act('I join the Azure Dew Sect');

        const before = await game.loadWorld();
        expect(factsNaming(before!, cultivator.id)).toHaveLength(0);

        await game.act('I donate 300 spirit stones to the sect');

        const world = (await game.loadWorld())!;
        const mine = factsNaming(world, cultivator.id);
        expect(mine, 'the world contains the gift').toHaveLength(1);
        expect(mine[0].kind).toBe('debt_incurred');
        expect(mine[0].actors.map(a => a.id)).toContain(cultivator.id);
        expect(mine[0].factionIds).toContain('sect-azure-dew-sect');
        // 300 of 400 is most of what they had, so it is not a gesture.
        expect(mine[0].magnitude).toBeGreaterThan(0.5);

        // And no account was opened. A gift is not a grudge, and this file
        // opens neither: `whatADeedLeaves` says what the record WOULD be and
        // the obligation ledger is not the fact writer's to touch.
        expect(ledger(db)).toHaveLength(0);
    });

    /**
     * The distinction the deed module exists for, and the one the sum alone
     * cannot make: the same 300 stones off somebody carrying 30,000 is a
     * gesture, and off somebody carrying 400 it is most of a life.
     */
    it('prices the same sum by what the giver had', async () => {
        const weights: number[] = [];
        for (const purse of [400, 60_000]) {
            const { db, game } = makeGame({ seed: 'gift-scale', worldEnabled: true });
            const { cultivator } = await game.newRun('Probe');
            db.prepare('UPDATE cultivators SET spirit_stones = ? WHERE id = ?')
                .run(purse, cultivator.id);
            await game.act('I join the Azure Dew Sect');
            await game.act('I donate 300 spirit stones to the sect');
            const world = (await game.loadWorld())!;
            weights.push(factsNaming(world, cultivator.id)[0].magnitude);
        }
        expect(weights[0]).toBeGreaterThan(weights[1]);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// A THEFT
// ─────────────────────────────────────────────────────────────────────────

describe('emptying ground a house claims is a thing the world contains', () => {
    /**
     * `tone.md`: "rob the grave and TAKE THE ATTENTION." The grudge half has
     * existed since the site ledger was wired. The world half did not, so the
     * attention had nothing to travel on.
     *
     * This also pins the join. `ObligationRecord.triggeringEventId` has been on
     * the record since the social migration and `grudges.ts` indexes by it, and
     * nothing in `src/web/` had ever set one - because there was never a fact
     * to point at. The ledger and the history are now two views of one event
     * rather than two memories of it.
     */
    it('writes a fact and points the grudge at it', async () => {
        const { db, game } = makeGame({ seed: 'rob-deed', worldEnabled: true });
        const { cultivator } = await game.newRun('Digger');
        db.prepare(
            'UPDATE cultivators SET realm_ordinal = 40, spirit_stones = 50000, hp = 900, '
            + 'max_hp = 900 WHERE id = ?'
        ).run(cultivator.id);

        // Whichever grave admits this cultivator. Which one it is depends on
        // gates the site catalog owns; the property is about what happens after
        // the door.
        let robbed = false;
        for (const site of SITES.filter(s => s.kind === 'grave')) {
            await game.act(`I go to ${site.name}`);
            await game.act('I go inside');
            await game.act(`I rob ${site.name}`);
            if (ledger(db).length > 0) { robbed = true; break; }
        }
        expect(robbed, 'no grave in the catalog admitted an ordinal-40 cultivator').toBe(true);

        const world = (await game.loadWorld())!;
        const theft = factsNaming(world, cultivator.id).find(f => f.kind === 'resource_contested');
        expect(theft, 'the world contains the emptying').toBeDefined();
        expect(theft!.factionIds.length).toBeGreaterThan(0);

        for (const row of ledger(db).filter(r => r.cause === 'robbery')) {
            // One event, two views of it, joined by an id rather than kept as
            // two opinions.
            expect(row.triggering_event_id).toBe(theft!.id);
            // And the severity is the one that was already decided. The fact
            // does not re-price what the ledger priced.
            expect(row.severity).toBe(theft!.data.deedWeight);
        }
    });

    /**
     * The whole point of writing it: somebody in the house whose ground it was
     * can now be told. Before this, the digest had nothing to carry, because
     * the event was not in the table the digest reads.
     */
    it('reaches a member of the house whose ground it was', async () => {
        const { db, game } = makeGame({ seed: 'rob-reach', worldEnabled: true });
        const { cultivator } = await game.newRun('Digger');
        db.prepare(
            'UPDATE cultivators SET realm_ordinal = 40, spirit_stones = 50000, hp = 900, '
            + 'max_hp = 900 WHERE id = ?'
        ).run(cultivator.id);

        for (const site of SITES.filter(s => s.kind === 'grave')) {
            await game.act(`I go to ${site.name}`);
            await game.act('I go inside');
            await game.act(`I rob ${site.name}`);
            if (ledger(db).length > 0) break;
        }

        const world = (await game.loadWorld())!;
        const theft = factsNaming(world, cultivator.id).find(f => f.kind === 'resource_contested')!;
        const house = theft.factionIds[0];
        const member = world.npcs.find(n => n.factionId === house && n.status === 'alive');
        expect(member, `nobody alive in ${house} to be told`).toBeDefined();

        const digest = buildPlayerDigest(
            world.history.facts,
            simpleAccess({
                actorId: member!.id,
                locationId: member!.locationId,
                factionId: member!.factionId ?? null,
                knownNpcIds: world.npcs.map(n => n.id).concat(cultivator.id),
                knownFactionIds: world.factions.map(f => f.id),
                knownPlaceIds: world.locations.map(l => l.id)
            }),
            theft.day - 1,
            theft.day + 1
        );
        expect(digest.lines.some(line => line.text === theft.summary),
            'the theft did not reach anybody in the house it was done to').toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// A BOUT THAT WENT PAST ITS TERMS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The sweep is the same instrument `a-bout-two-people-agreed-to.test.ts` uses
 * and for the same reason: what is asserted is that the event, once it happens,
 * is in the world - and reaching the event at all takes a bout that goes past
 * what was agreed, which is a RATE rather than a certainty. The setup keeps the
 * player standing and gives them the one edge the engine already prices;
 * nothing about the opponent, the rolls or the wounds is touched.
 */
describe('a bout that went past what was agreed', () => {
    it('is in the world, on both their records, in front of witnesses', async () => {
        let found: {
            fact: HistoricalFact;
            world: WorldState;
            playerId: string;
            rows: LedgerRow[];
        } | null = null;

        for (let n = 0; n < 30 && !found; n++) {
            const { db, game, repos } = makeGame({ seed: `deed-bout-${n}`, worldEnabled: true });
            const { cultivator } = await game.newRun('Duellist');
            repos.sects.addMember('sect-azure-cloud-pavilion', cultivator.id, 1);
            await game.act('I look around');

            for (let bouts = 0; bouts < 20 && !found; bouts++) {
                if (!cultivatorRow(db, cultivator.id).alive) break;
                // HEALED, NOT INFLATED. A fight is held open across turns now,
                // and damage is a fraction of the MAXIMUM - so a 5000 pool takes
                // 1000-point blows and the fixture that used to keep somebody
                // alive through one call kills them in five rounds instead.
                db.prepare(
                    'UPDATE cultivators SET hp = max_hp, battles_survived = 400 WHERE id = ?'
                ).run(cultivator.id);
                db.prepare('DELETE FROM cultivator_injuries WHERE cultivator_id = ?')
                    .run(cultivator.id);
                await game.act('I spar with someone of my own rank');

                const world = (await game.loadWorld())!;
                const fact = factsNaming(world, cultivator.id).find(f => f.kind === 'betrayal');
                if (fact) found = { fact, world, playerId: cultivator.id, rows: ledger(db) };
            }
        }

        expect(found, 'no agreed bout across thirty seeds went past its terms').not.toBeNull();
        const { fact, world, playerId, rows } = found!;

        // Both of them are named, and which of them went too far is on the
        // record: a bout the player loses badly is the same event with the
        // names the other way round.
        expect(fact.actors).toHaveLength(2);
        expect(fact.actors.map(a => a.id)).toContain(playerId);
        expect(fact.actors.some(a => a.role === 'went past what was agreed')).toBe(true);
        // The terms are the content. A descendant reading this row and nothing
        // else has to be able to see what was agreed.
        expect(fact.data.boutTerms).toBe('agreed');

        // On the player's own trajectory, so the deed is recoverable from the
        // person who did it and not only from the person it was done to.
        const row = world.npcs.find(n => n.id === playerId)!;
        expect(row.historyFactIds).toContain(fact.id);

        // In front of the room, drawn from the place rather than asserted.
        expect(fact.witnessIds.length).toBeGreaterThan(1);

        // And where a house did open an account, it points at this event.
        for (const account of rows.filter(r => r.kind === 'grudge' || r.kind === 'blood_feud')) {
            expect(account.triggering_event_id).toBe(fact.id);
        }
    }, 900_000);

    /**
     * AGENTS.md's own worked example ends on *"everyone who hears about it now
     * knows something about you that they did not know before"*, and that
     * sentence had no mechanism: news travels on facts, and there was no fact.
     *
     * A house-backed bout is the one asserted because it is the heavy band -
     * `whatFollowsFromTheBout` opens a grave account, the fact carries that
     * weight to `magnitude`, and `airtimeOf`'s first term is the magnitude. A
     * bout that ruined somebody who answered to nobody is a slight fact and is
     * correctly quieter; it is still in the pool, which the second assertion
     * checks separately.
     */
    it('can be repeated by somebody who was not there', async () => {
        let said: { text: string; teller: string } | null = null;
        let everInThePool = false;

        for (let n = 0; n < 30 && !said; n++) {
            const { db, game, repos } = makeGame({ seed: `deed-heard-${n}`, worldEnabled: true });
            const { cultivator } = await game.newRun('Duellist');
            repos.sects.addMember('sect-azure-cloud-pavilion', cultivator.id, 1);
            await game.act('I look around');

            for (let bouts = 0; bouts < 20 && !said; bouts++) {
                if (!cultivatorRow(db, cultivator.id).alive) break;
                // HEALED, NOT INFLATED. A fight is held open across turns now,
                // and damage is a fraction of the MAXIMUM - so a 5000 pool takes
                // 1000-point blows and the fixture that used to keep somebody
                // alive through one call kills them in five rounds instead.
                db.prepare(
                    'UPDATE cultivators SET hp = max_hp, battles_survived = 400 WHERE id = ?'
                ).run(cultivator.id);
                db.prepare('DELETE FROM cultivator_injuries WHERE cultivator_id = ?')
                    .run(cultivator.id);
                await game.act('I spar with someone of my own rank');

                const world = (await game.loadWorld())!;
                const fact = factsNaming(world, cultivator.id).find(f => f.kind === 'betrayal');
                if (!fact) continue;

                const teller = aTeller(world, cultivator.id, fact);
                // In the pool at all is the weaker claim and the one that holds
                // for every band: the world can repeat it.
                if (circulating(world, teller, world.currentDay, 5000)
                    .some(f => f.id === fact.id)) {
                    everInThePool = true;
                }
                const repeated = whatTheySay(world, teller, world.currentDay, 40)
                    .find(r => r.factId === fact.id);
                if (repeated) said = { text: repeated.text, teller: teller.name };
            }
        }

        expect(everInThePool, 'a played deed never even entered what could be repeated')
            .toBe(true);
        expect(said, 'no market teller in thirty seeds ever repeated a played deed')
            .not.toBeNull();
        // Composed from fields rather than from the engine's summary, so a
        // distorted retelling reads as confidently as a true one. The only
        // thing asserted is that it is a sentence about somebody.
        expect(said!.text.length).toBeGreaterThan(20);
    }, 900_000);
});
