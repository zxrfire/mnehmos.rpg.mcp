/**
 * A price on somebody's head is a piece of paper, and it runs both ways.
 *
 * The ruling this file holds the engine to: a house with something heavy
 * against a person may put a price on them; the price is a paper on its walls,
 * which anybody can read - the person named on it included; anybody may take
 * one up, the player too, and bringing the house the proof pays the purse by
 * the paper's honoured word; and the people who come for the player over one
 * arrive the way anybody with an account arrives. There is no kind of person
 * who does this, only people who read the paper.
 *
 * ── WHAT THESE ASSERTIONS ENCODE ─────────────────────────────────────────
 *
 * THE PAPER GOES UP WHERE THE HOUSE POSTS, AND THE PLAYER CAN READ THEIR OWN.
 * A ledger row a house holds against the player is put up on the next span the
 * world spends (`advanceWorldForCultivator`), and "what is posted here" in a
 * town the house's word reaches prints it, with a line saying the name is
 * theirs. The arrangement is asked of the engine - `whatAHouseWouldPost`
 * picks the house that would post - rather than a seed found by luck.
 *
 * THE PLAYER CAN TAKE ONE UP AND BE PAID. Taking one up writes an oath the way
 * a duty does; a death written through the ordinary killing writer is the
 * proof; bringing it to the house pays the purse out of the treasury, and a
 * claim with nobody dead pays nothing and says so. The house is chosen by the
 * engine's own read of how it honours paper, so `reliably` is what is tested.
 *
 * SOMEBODY WHO TOOK ONE UP ARRIVES AS AN ACCOUNT. `accountsComingDue`, which
 * travel and seclusion hand to the encounter draw, carries a row for them, and
 * the arrival it produces names the purse and whose paper it was.
 *
 * THE ODDS ARE THE CONSTANTS. The posting draw is asserted as a rate over many
 * accounts rather than trusted from one, in a band either side of
 * `A_HOUSE_PUTS_A_PRICE_ON_IT`.
 *
 * RED-CHECKED: dropping the `housesPutUpTheirPaper` call from
 * `advanceWorldForCultivator` fails the first test; dropping the price loop in
 * `accountsComingDue` fails the arrival; dropping the call in the yearly pass fails
 * the world's own killing; paying on `if_witnessed` regardless
 * of the death being seen fails the witness case.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { parseIntent } from '../../src/web/actions.js';
import { REGIONS } from '../../src/data/cultivation/regions.js';
import { SECTS } from '../../src/data/cultivation/sects.js';
import { provinceForFaction } from '../../src/data/cultivation/regions.js';
import { demonicStandingOf } from '../../src/data/cultivation/demonic-sects-and-what-they-are-willing-to-do.js';
import { createObligation } from '../../src/engine/social/grudges.js';
import { writeOneObligation, ledgerAbout } from '../../src/storage/repos/obligation.repo.js';
import { provinceOfPlace, postingGroundOf } from '../../src/engine/world/the-doors-and-walls-a-house-takes-people-at.js';
import { BILLS_A_WALL_CARRIES } from '../../src/engine/world/houses-that-have-to-advertise-for-disciples.js';
import {
    A_HOUSE_PUTS_A_PRICE_ON_IT,
    accountsHousesHoldAgainstThem,
    accountsHousesHoldForTheirDead,
    aPriceIsBroughtIn,
    housesPutUpTheirPaper,
    howThisHouseHonoursItsPaper,
    thePricesStanding,
    whatAHouseWouldPost,
    type AHouseAccount
} from '../../src/engine/world/a-house-puts-a-price-on-somebody.js';
import { whatTheConfrontationDidToThem } from '../../src/engine/world/what-a-confrontation-does-to-somebody-the-world-holds.js';
import { isTheWorldsToMove } from '../../src/engine/world/npc-state.js';
import { accountsComingDue } from '../../src/web/who-comes-to-settle-an-account.js';
import { attemptAnAccount } from '../../src/engine/encounters/an-account-comes-due.js';
import { activityForVerb, placeFor } from '../../src/web/encounters.js';
import { advanceWorldForPlay } from '../../src/engine/world/driver.js';

const WORLD = 'a-price-on-a-head-w';

/** The account the world's own reading gives for one killing. */
function accountsHousesHoldForTheirDeadFor(world: any, deathId: string) {
    return accountsHousesHoldForTheirDead(world, Math.floor(world.currentDay)).filter(a => a.key === deathId);
}

/** A town with a wall in this house's province. */
function aWalledTownOf(houseId: string): string | null {
    const province = provinceForFaction(houseId)?.id ?? null;
    if (!province) return null;
    const town = REGIONS.flatMap(r => r.places).find(p =>
        (p.kind === 'city' || p.kind === 'market_town')
        && provinceOfPlace(p.name) === province
        && BILLS_A_WALL_CARRIES[postingGroundOf(p.name)] > 0);
    return town?.name ?? null;
}

/** Houses that post in public, hold a province with a walled town, and are in the world. */
function housesThatPostPaper(world: any): { id: string; name: string; town: string }[] {
    return SECTS
        .filter(sect => demonicStandingOf(sect.id) === undefined)
        .flatMap(sect => {
            const town = aWalledTownOf(sect.id);
            const live = world.factions.some((f: any) => f.id === sect.id && f.dissolvedOnDay === null);
            return town && live ? [{ id: sect.id, name: sect.name, town }] : [];
        });
}

async function aPlayerInTheWorld(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD }) as any;
    const { cultivator } = await harness.game.newRun('Lan Qiye');
    const world = await harness.game.loadWorld();
    return { ...harness, cultivator, world };
}

/** Spend days on both clocks, the way a handler does. */
async function spend(harness: any, days: number) {
    const run = harness.repos.runs.getActiveRun();
    const after = harness.repos.runs.advanceDays(run.id, days);
    const cultivator = harness.repos.cultivators.getById(harness.cultivator.id);
    await harness.game.advanceWorld(days, cultivator, after);
}

/** A heavy row a house holds against the player, for the first house the engine says would post over it. */
function aHouseThatWouldPostOnThePlayer(harness: any) {
    const { world, cultivator } = harness;
    // The run is entered on the world at its first span, which has not happened yet.
    const began = world.runs.find((r: any) => r.cultivatorId === cultivator.id)?.startedOnDay ?? world.currentDay;
    for (const house of housesThatPostPaper(world)) {
        const row = createObligation({
            kind: 'grudge',
            holderId: house.id,
            subjectId: cultivator.id,
            cause: 'killed_sectmate',
            severity: 'unforgivable',
            onDay: 0,
            description: `Lan Qiye killed one of ${house.name}'s own.`
        });
        const [account] = accountsHousesHoldAgainstThem({
            rows: [row],
            subject: { id: cultivator.id, name: cultivator.name, houseId: null },
            houseIds: new Set(world.factions.map((f: any) => f.id)),
            runStartedOnDay: began
        });
        if (account && whatAHouseWouldPost(world, account)) return { house, row };
    }
    throw new Error('no house in the pinned world would post on the player');
}

describe('the sentences reach it', () => {
    it('reads, takes up and brings in a price, and leaves the market and the board where they were', () => {
        for (const said of ['I take the bounty on Wen Shu', 'I take up the bounty on Wen Shu',
            "I take the price on Wen Shu's head", 'I accept the bounty on Wen Shu']) {
            expect(parseIntent(said), said).toMatchObject({ action: 'sect', intent: 'bounty', target: 'Wen Shu' });
        }
        for (const said of ['I claim the bounty on Wen Shu', 'I collect the price on Wen Shu', 'I claim the purse on Wen Shu']) {
            expect(parseIntent(said), said).toMatchObject({ action: 'sect', intent: 'bounty', topic: 'claim', target: 'Wen Shu' });
        }
        for (const said of ['what bounties are there', 'are there any bounties', 'is there a price on my head']) {
            expect(parseIntent(said), said).toMatchObject({ action: 'look', intent: 'bills' });
        }
        expect(parseIntent('what is the price of millet').action).toBe('market');
        expect(parseIntent('what is the price on this sword')).not.toMatchObject({ intent: 'bills' });
        expect(parseIntent('I put my name down for A Bounty at the Old Price')).toMatchObject({ action: 'sect', intent: 'duty' });
    });
});

describe('a price on the player is a paper they can read', () => {
    it('goes up on the house\'s walls when the world spends a span, and the player reads their own name', async () => {
        const harness = await aPlayerInTheWorld('a-price-read');
        const { house, row } = aHouseThatWouldPostOnThePlayer(harness);
        writeOneObligation(harness.db, row);
        harness.db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(house.town, harness.cultivator.id);

        expect(thePricesStanding(harness.world, harness.world.currentDay)
            .some(p => p.targetId === harness.cultivator.id), 'nothing is up before the world moves').toBe(false);
        await spend(harness, 90);

        const standing = thePricesStanding(harness.world, harness.world.currentDay)
            .filter(p => p.targetId === harness.cultivator.id);
        expect(standing).toHaveLength(1);
        expect(standing[0]!.posterFactionId).toBe(house.id);

        const read = await harness.game.act('what is posted here');
        const said = JSON.stringify(read);
        expect(said).toContain(`${house.name} will pay ${standing[0]!.purseStones} spirit stones for Lan Qiye`);
        expect(said).toContain(`The name on ${house.name}'s price is yours.`);
        // THE PAPER, NOT THE RECORD. How the house honours it is not on it.
        expect(said).not.toMatch(/reliably|if_witnessed|rarely/);
    });

    it('cannot be taken up by the person it names', async () => {
        const harness = await aPlayerInTheWorld('a-price-on-yourself');
        const { house, row } = aHouseThatWouldPostOnThePlayer(harness);
        writeOneObligation(harness.db, row);
        harness.db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(house.town, harness.cultivator.id);
        await spend(harness, 90);

        const tried = await harness.game.act('I take the bounty on Lan Qiye');
        expect(JSON.stringify(tried)).toContain('The name on that paper is yours.');
        expect(ledgerAbout(harness.db, harness.cultivator.id).some(r => r.tags.includes('price'))).toBe(false);
    });
});

describe('somebody who took one up comes as an account', () => {
    it('is on the list the encounter draw is handed, and arrives naming the purse', async () => {
        const harness = await aPlayerInTheWorld('a-price-comes-due');
        const { house, row } = aHouseThatWouldPostOnThePlayer(harness);
        writeOneObligation(harness.db, row);
        await spend(harness, 90);

        const cultivator = harness.repos.cultivators.getById(harness.cultivator.id);
        const coming = accountsComingDue(harness.game, cultivator);
        const forThePurse = coming.filter(a => a.forAPurse?.houseId === house.id);
        expect(forThePurse, 'somebody in the province takes it up').toHaveLength(1);
        const taker = harness.world.npcs.find((n: any) => n.id === forThePurse[0]!.sent.id);
        expect(taker.factionId).not.toBe(house.id);
        expect(isTheWorldsToMove(taker)).toBe(true);

        const input = {
            seed: 'a-price-comes-due',
            startDay: harness.world.currentDay,
            days: 1,
            activity: activityForVerb('move'),
            cultivator: {
                id: cultivator.id, realmOrdinal: cultivator.realmOrdinal, fortune: 1,
                maxHp: cultivator.maxHp, hp: cultivator.hp, spiritStones: cultivator.spiritStones
            },
            place: placeFor(harness.world, cultivator),
            comingForYou: forThePurse
        };
        let arrived = null;
        for (let day = harness.world.currentDay; day < harness.world.currentDay + 3000 && !arrived; day++) {
            arrived = attemptAnAccount(input as any, day, 0, 1, 'test');
        }
        expect(arrived, 'somebody comes within a few years at this weight').not.toBeNull();
        expect(arrived!.event.summary).toContain(`come for the purse ${house.name} put on them`);
        expect(arrived!.event.summary).toContain(taker.name);
        expect(arrived!.grants.some((g: any) => g.kind === 'sect' && g.id === house.id)).toBe(true);
    });
});

describe('the player can take one up and bring it in', () => {
    it('takes a price up, is refused while the person lives, and is paid on the death', async () => {
        const harness = await aPlayerInTheWorld('a-price-taken-up');
        const { world, cultivator } = harness;
        // A house that honours its paper reliably, asked of the engine.
        const house = housesThatPostPaper(world).find(h => howThisHouseHonoursItsPaper(world, h.id) === 'reliably');
        expect(house, 'the pinned world has a house that pays reliably').toBeDefined();
        const target = world.npcs.find((n: any) =>
            n.status === 'alive' && isTheWorldsToMove(n) && n.factionId !== house!.id && n.locationId !== null);
        const account: AHouseAccount = {
            key: 'a-price-taken-up',
            houseId: house!.id,
            subjectId: target.id,
            subjectName: target.name,
            severity: 'unforgivable',
            onDay: world.currentDay - 100,
            forWhat: 'for the death of one of its own'
        };
        const posted = whatAHouseWouldPost(world, account)
            ? housesPutUpTheirPaper(world, [account], world.currentDay)
            : housesPutUpTheirPaper(world, [{ ...account, key: 'a-price-taken-up-2' }], world.currentDay);
        expect(posted, 'the engine puts the paper up').toHaveLength(1);
        const paper = posted[0]!;
        harness.game.theWorldMoved();
        harness.db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(house!.town, cultivator.id);

        const taken = await harness.game.act(`I take the bounty on ${target.name}`);
        expect(JSON.stringify(taken)).toContain(`You take up ${house!.name}'s price on ${target.name}`);
        const word = ledgerAbout(harness.db, cultivator.id).find(r => r.tags.includes(`paper:${paper.id}`));
        expect(word?.status).toBe('open');

        const seat = world.locations.find((l: any) => l.id === world.factions.find((f: any) => f.id === house!.id).seatLocationId);
        harness.db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(seat.name, cultivator.id);
        const tooSoon = await harness.game.act(`I claim the bounty on ${target.name}`);
        expect(JSON.stringify(tooSoon)).toContain(`${target.name} is alive`);

        // THE PROOF IS A DEATH THE ORDINARY KILLING WRITER RECORDS.
        whatTheConfrontationDidToThem(world, {
            npcId: target.id, byId: cultivator.id, byName: cultivator.name,
            day: Math.floor(world.currentDay), wounds: [], outcome: 'lethal', lost: true, finished: true
        });
        harness.game.theWorldMoved();

        const stonesBefore = harness.repos.cultivators.getById(cultivator.id).spiritStones;
        const treasuryBefore = Number(world.factions.find((f: any) => f.id === house!.id).resources.spirit_stones);
        const claimed = await harness.game.act(`I claim the bounty on ${target.name}`);
        expect(JSON.stringify(claimed)).toContain(`${house!.name} pays you ${paper.purseStones} spirit stones`);
        expect(harness.repos.cultivators.getById(cultivator.id).spiritStones).toBe(stonesBefore + paper.purseStones);
        expect(Number(world.factions.find((f: any) => f.id === house!.id).resources.spirit_stones))
            .toBe(treasuryBefore - paper.purseStones);
        const settled = ledgerAbout(harness.db, cultivator.id).find(r => r.tags.includes(`paper:${paper.id}`));
        expect(settled?.status).toBe('settled');

        // AND IT IS PAID ONCE.
        const again = await harness.game.act(`I claim the bounty on ${target.name}`);
        expect(harness.repos.cultivators.getById(cultivator.id).spiritStones).toBe(stonesBefore + paper.purseStones);
        expect(JSON.stringify(again)).toContain('There is no price to bring in.');
    });

    it('if_witnessed pays for a seen death and not for an unseen one', async () => {
        const harness = await aPlayerInTheWorld('a-price-witnessed');
        const { world } = harness;
        const house = housesThatPostPaper(world)[0]!;
        const paper = {
            ...(whatAHouseWouldPost(world, {
                key: 'x', houseId: house.id, subjectId: 'nobody', subjectName: 'Nobody',
                severity: 'unforgivable', onDay: world.currentDay, forWhat: 'for a wrong'
            }) ?? {} as any),
            id: 'paper-witnessed', honoured: 'if_witnessed' as const, purseStones: 100, posterFactionId: house.id,
            targetName: 'Nobody', targetId: 'nobody'
        };
        const death = (visibility: string) => ({ id: `death-${visibility}`, visibility, day: world.currentDay } as any);
        const seen = aPriceIsBroughtIn(world, { paper, claimantId: 'a', claimantName: 'A', death: death('regional'), day: world.currentDay });
        const unseen = aPriceIsBroughtIn(world, { paper: { ...paper, id: 'paper-unseen' }, claimantId: 'b', claimantName: 'B', death: death('secret'), day: world.currentDay });
        expect(seen.paid).toBe(true);
        expect(unseen.paid).toBe(false);
    });
});

describe('the world\'s own killings put paper up in the yearly pass', () => {
    it('a house whose member somebody killed puts a price on the killer', async () => {
        const harness = await aPlayerInTheWorld('a-price-in-the-world');
        const { world } = harness;
        const day = Math.floor(world.currentDay);
        // Asked of the engine: the first killing it says the house would post over.
        let killer: any = null;
        let house: { id: string; name: string } | null = null;
        for (const h of housesThatPostPaper(world)) {
            const victim = world.npcs.find((n: any) => n.status === 'alive' && n.factionId === h.id && isTheWorldsToMove(n));
            const doer = world.npcs
                .filter((n: any) => n.status === 'alive' && isTheWorldsToMove(n) && n.factionId !== h.id)
                .sort((a: any, b: any) => b.cultivation.lifespanEndsOnDay - a.cultivation.lifespanEndsOnDay)[0];
            if (!victim || !doer) continue;
            if (!whatAHouseWouldPost(world, {
                key: 'probe', houseId: h.id, subjectId: doer.id, subjectName: doer.name,
                severity: 'unforgivable', onDay: day, forWhat: ''
            })) continue;
            const wrote = whatTheConfrontationDidToThem(world, {
                npcId: victim.id, byId: doer.id, byName: doer.name, day,
                wounds: [], outcome: 'lethal', lost: true, finished: true
            });
            if (!wrote.died) continue;
            const death = wrote.facts.find((f: any) => f.kind === 'death')!;
            const [account] = accountsHousesHoldForTheirDeadFor(world, death.id);
            if (account && whatAHouseWouldPost(world, account)) {
                killer = doer;
                house = h;
                break;
            }
        }
        expect(house, 'the pinned world has a killing a house would post over').not.toBeNull();

        advanceWorldForPlay(world, { days: 2 * 365 });

        const paper = world.history.facts.find((f: any) =>
            f.kind === 'bounty_posted' && f.data.priceOn === killer.id && f.factionIds[0] === house!.id);
        expect(paper, 'the yearly pass put it up').toBeDefined();
        expect(paper.summary).toContain(`${house!.name} put a price of`);
        expect(paper.summary).toContain(killer.name);
    });
});

describe('how often a house puts paper up', () => {
    it('posts at the stated odds, in a band either side', async () => {
        const harness = await aPlayerInTheWorld('a-price-odds');
        const { world } = harness;
        const houses = housesThatPostPaper(world);
        const people = world.npcs.filter((n: any) => n.status === 'alive' && n.factionId === null).slice(0, 40);
        for (const severity of ['grave', 'unforgivable'] as const) {
            let asked = 0;
            let posted = 0;
            for (const house of houses) {
                for (const person of people) {
                    asked++;
                    if (whatAHouseWouldPost(world, {
                        key: `odds-${severity}-${house.id}-${person.id}`, houseId: house.id,
                        subjectId: person.id, subjectName: person.name, severity,
                        onDay: world.currentDay, forWhat: 'for a wrong'
                    })) posted++;
                }
            }
            // Houses too thin to put up the smallest purse never post, so the
            // rate is at most the constant; the band is the draw's own spread.
            const rate = posted / asked;
            expect(rate, `${severity}: ${posted}/${asked}`).toBeGreaterThan(A_HOUSE_PUTS_A_PRICE_ON_IT[severity] * 0.8);
            expect(rate, `${severity}: ${posted}/${asked}`).toBeLessThan(A_HOUSE_PUTS_A_PRICE_ON_IT[severity] + 0.06);
        }
    });
});
