/**
 * A price on somebody's head is a piece of paper, and it runs both ways.
 *
 * The ruling this file holds the engine to: a house with something heavy
 * against a person may put a price on them; the price is a paper on its walls,
 * which anybody can read - the person named on it included; and the people who
 * come for the player over one arrive the way anybody with an account arrives.
 *
 * AND A PRICE IS A NOTICE, so the owner's ruling on notices binds it: nobody
 * takes one up or signs on for it. The first to turn in what it asks at the
 * house's gate is paid, the notice comes down everywhere, and whoever comes
 * second gets nothing. Before that ruling a price was taken up as an oath on the
 * ledger and claimed later, the way a duty off a board is.
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
 * A TAKE-UP IS ANSWERED AND CHANGES NOTHING. The answer names the proof and the
 * gate; no stone, ledger row or world fact moves.
 *
 * THE PROOF IS THE KILLING. A death the ordinary killing writer records, naming
 * the player as the killer, turned in at the posting house's gate: refused
 * while the person lives and anywhere but the gate, paid there by the paper's
 * honoured word (`reliably` is what is tested), and then gone from every wall.
 * A death alone does not take the paper down; being turned in does.
 *
 * SOMEBODY ELSE CAN GET THERE FIRST. Somebody else who killed the person brings
 * it in on a day drawn on the notice's own stream; after that day the notice
 * is down and the player is told the second gets nothing. The arrangement asks
 * the engine for a notice whose draw lands, rather than trusting a seed.
 *
 * SOMEBODY WHO GOES AFTER ONE ARRIVES AS AN ACCOUNT. `accountsComingDue`, which
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
 * of the death being seen fails the witness case; putting only papers on the
 * living on the walls fails the turn-in; and never drawing the killer's day
 * fails the one where somebody else was first.
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
import { A_BILL_STAYS_UP_FOR_DAYS, BILLS_A_WALL_CARRIES } from '../../src/engine/world/houses-that-have-to-advertise-for-disciples.js';
import {
    A_HOUSE_PUTS_A_PRICE_ON_IT,
    accountsHousesHoldAgainstThem,
    accountsHousesHoldForTheirDead,
    aPriceIsBroughtIn,
    housesPutUpTheirPaper,
    howThisHouseHonoursItsPaper,
    thePapersStillUp,
    thePricesStanding,
    whatAHouseWouldPost,
    whenThePaperCameDown,
    type AHouseAccount,
    type PersonBounty
} from '../../src/engine/world/a-house-puts-a-price-on-somebody.js';
import { aNoticeId, theDaySomebodyElseTurnsItIn } from '../../src/engine/encounters/a-notice-is-turned-in.js';
import { whatEachHouseHasAPriceOn } from '../../src/web/what-is-posted-on-the-wall-here.js';
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
        for (const said of ['I claim the bounty on Wen Shu', 'I collect the price on Wen Shu', 'I claim the purse on Wen Shu',
            'I turn in the bounty on Wen Shu']) {
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
        expect(said).toContain('It pays at its gate, to the first to turn in');
        // THE PAPER, NOT THE RECORD. How the house honours it is not on it.
        expect(said).not.toMatch(/reliably|if_witnessed|rarely/);

        // AND TAKING IT UP IS ANSWERED LIKE ANYBODY'S: nobody signs on.
        const tried = await harness.game.act('I take the bounty on Lan Qiye');
        expect(tried.narration).toContain('Nobody signs on for a notice.');
        expect(tried.narration).toContain(`The name on ${house.name}'s price is yours.`);
    });
});

/** A paper a house that pays reliably puts on somebody the world moves, asked of the engine. */
function aPaperOnSomebody(harness: any, accept: (paper: PersonBounty, target: any) => boolean = () => true) {
    const { world } = harness;
    // Not the player's own house: its gate is not one they stand at as a stranger.
    const house = housesThatPostPaper(world).find(h =>
        howThisHouseHonoursItsPaper(world, h.id) === 'reliably' && h.id !== harness.cultivator.sectId);
    expect(house, 'the pinned world has a house that pays reliably').toBeDefined();
    // Nobody another house already has paper up on, so the one paper is the only one.
    const priced = new Set(thePricesStanding(world, world.currentDay).map(p => p.targetId));
    const targets = world.npcs.filter((n: any) => n.status === 'alive' && isTheWorldsToMove(n)
        && n.factionId !== house!.id && n.locationId !== null && !priced.has(n.id));
    for (const target of targets) {
        const account: AHouseAccount = {
            key: `a-price-on-${target.id}`,
            houseId: house!.id,
            subjectId: target.id,
            subjectName: target.name,
            severity: 'unforgivable',
            // Long enough ago that the paper went up a year back.
            onDay: Math.floor(world.currentDay) - 400,
            forWhat: 'for the death of one of its own'
        };
        const would = whatAHouseWouldPost(world, account);
        if (!would || !accept(would, target)) continue;
        const [paper] = housesPutUpTheirPaper(world, [account], world.currentDay);
        if (!paper) continue;
        harness.game.theWorldMoved();
        const seat = world.locations.find((l: any) => l.id === world.factions.find((f: any) => f.id === house!.id).seatLocationId);
        return { house: house!, target, paper, seat };
    }
    throw new Error('no paper the pinned world would put up');
}

function standAt(harness: any, place: string) {
    harness.db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(place, harness.cultivator.id);
}

function thePricesOn(world: any, houseId: string): string[] {
    return (whatEachHouseHasAPriceOn(world).get(houseId) ?? []).flatMap((ask: any) => ask.kind === 'wanted' ? [ask.whoId] : []);
}

describe('nobody takes up a price', () => {
    it('answers a take-up with the proof and the gate, and changes nothing', async () => {
        const harness = await aPlayerInTheWorld('a-price-not-taken-up');
        const { world, cultivator } = harness;
        const { house, target, paper, seat } = aPaperOnSomebody(harness);
        standAt(harness, house.town);

        const stones = harness.repos.cultivators.getById(cultivator.id).spiritStones;
        const ledger = ledgerAbout(harness.db, cultivator.id).length;
        const priceFacts = () => world.history.facts.filter((f: any) => f.kind === 'grudge_settled' || f.kind === 'bounty_posted').length;
        const facts = priceFacts();
        const treasury = Number(world.factions.find((f: any) => f.id === house.id).resources.spirit_stones);

        for (const said of [`I take the bounty on ${target.name}`, `I sign up for the bounty on ${target.name}`]) {
            const answered = (await harness.game.act(said)).narration as string;
            expect(answered, said).toContain('Nobody signs on for a notice.');
            expect(answered, said).toContain(`to the first to turn in ${paper.evidence}`);
            expect(answered, said).toContain(`at its gate at ${seat.name}`);
        }

        expect(harness.repos.cultivators.getById(cultivator.id).spiritStones).toBe(stones);
        expect(ledgerAbout(harness.db, cultivator.id)).toHaveLength(ledger);
        expect(priceFacts()).toBe(facts);
        expect(Number(world.factions.find((f: any) => f.id === house.id).resources.spirit_stones)).toBe(treasury);
        expect(thePricesOn(world, house.id)).toContain(target.id);
    });
});

describe('the first to turn it in is paid', () => {
    it('pays the killer at the gate, and the notice is gone from every wall', async () => {
        const harness = await aPlayerInTheWorld('a-price-turned-in');
        const { world, cultivator } = harness;
        const { house, target, paper, seat } = aPaperOnSomebody(harness);

        standAt(harness, seat.name);
        const tooSoon = await harness.game.act(`I turn in the bounty on ${target.name}`);
        expect(tooSoon.narration).toContain(`${target.name} is alive`);

        // THE PROOF IS A DEATH THE ORDINARY KILLING WRITER RECORDS.
        whatTheConfrontationDidToThem(world, {
            npcId: target.id, byId: cultivator.id, byName: cultivator.name,
            day: Math.floor(world.currentDay), wounds: [], outcome: 'lethal', lost: true, finished: true
        });
        harness.game.theWorldMoved();

        // A DEATH DOES NOT TAKE IT DOWN. Being turned in does.
        expect(thePricesOn(world, house.id)).toContain(target.id);
        standAt(harness, house.town);
        const onTheWall = (await harness.game.act('what is posted here')).narration as string;
        expect(onTheWall).toContain(`${house.name} will pay ${paper.purseStones} spirit stones for ${target.name}`);
        const notHere = await harness.game.act(`I turn in the bounty on ${target.name}`);
        expect(notHere.narration).toContain(`turned in at the gate of ${house.name} at ${seat.name}`);

        standAt(harness, seat.name);
        const stonesBefore = harness.repos.cultivators.getById(cultivator.id).spiritStones;
        const treasuryBefore = Number(world.factions.find((f: any) => f.id === house.id).resources.spirit_stones);
        const turned = await harness.game.act(`I hand in proof of ${target.name}'s death`);
        expect(turned.narration).toContain(`pays ${paper.purseStones} spirit stones out of the house's stores. The notice comes down.`);
        expect(harness.repos.cultivators.getById(cultivator.id).spiritStones).toBe(stonesBefore + paper.purseStones);
        expect(Number(world.factions.find((f: any) => f.id === house.id).resources.spirit_stones))
            .toBe(treasuryBefore - paper.purseStones);

        // DOWN EVERYWHERE: every wall and the gate read the one list.
        expect(thePricesOn(world, house.id)).not.toContain(target.id);
        expect(thePapersStillUp(world, world.currentDay).some(p => p.id === paper.id)).toBe(false);
        standAt(harness, house.town);
        const after = (await harness.game.act('what is posted here')).narration as string;
        expect(after).not.toContain(`${house.name} will pay ${paper.purseStones} spirit stones for ${target.name}`);

        // AND IT IS PAID ONCE.
        standAt(harness, seat.name);
        const again = await harness.game.act(`I turn in the bounty on ${target.name}`);
        expect(again.narration).toContain('You turned it in today, and the notice is down.');
        expect(harness.repos.cultivators.getById(cultivator.id).spiritStones).toBe(stonesBefore + paper.purseStones);
    });

    it('tells the player somebody else got there first, and pays nothing', async () => {
        const harness = await aPlayerInTheWorld('a-price-beaten');
        const { world, cultivator } = harness;
        const deathDay = Math.floor(world.currentDay) - 200;
        let killer: any = null;
        // A killing whose notice's own draw has somebody bring it in, asked of the engine.
        const { house, target, paper, seat } = aPaperOnSomebody(harness, (would, person) => {
            killer = world.npcs.find((n: any) => n.status === 'alive' && isTheWorldsToMove(n)
                && n.id !== person.id && n.factionId !== would.posterFactionId);
            return killer !== undefined && theDaySomebodyElseTurnsItIn(world.seed,
                aNoticeId(would.posterFactionId!, person.id, would.postedOnDay), deathDay,
                Math.min(A_BILL_STAYS_UP_FOR_DAYS, would.lapsesOnDay - deathDay)) !== null;
        });
        whatTheConfrontationDidToThem(world, {
            npcId: target.id, byId: killer.id, byName: killer.name,
            day: deathDay, wounds: [], outcome: 'lethal', lost: true, finished: true
        });
        harness.game.theWorldMoved();

        // Up until the drawn day, and the same day however often it is asked.
        const down = whenThePaperCameDown(world, paper, world.currentDay);
        expect(down).toEqual({ onDay: expect.any(Number), byId: killer.id });
        expect(whenThePaperCameDown(world, paper, world.currentDay)).toEqual(down);
        expect(thePapersStillUp(world, down!.onDay - 1).some(p => p.id === paper.id)).toBe(true);
        expect(thePapersStillUp(world, down!.onDay).some(p => p.id === paper.id)).toBe(false);
        expect(thePricesOn(world, house.id)).not.toContain(target.id);

        standAt(harness, seat.name);
        const stones = harness.repos.cultivators.getById(cultivator.id).spiritStones;
        const turned = (await harness.game.act(`I turn in the bounty on ${target.name}`)).narration as string;
        expect(turned).toContain(`Somebody else turned in ${house.name}'s price on ${target.name}`);
        expect(turned).toContain('The second to bring it gets nothing.');
        expect(harness.repos.cultivators.getById(cultivator.id).spiritStones).toBe(stones);
    });

});

describe('somebody who goes after one on the player comes as an account', () => {
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

describe('what a house pays on', () => {
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
