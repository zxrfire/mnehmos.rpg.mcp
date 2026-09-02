/**
 * Resolving a sending: binding, the ceiling, the tier, and the news.
 *
 * The decisions pinned here that live only as numbers or as a relationship
 * between two files:
 *
 *   - {@link IMPOSSIBLE_TIERS} is exactly the band a house will not SEND
 *     somebody against and a board may still POST. The pin is against
 *     `duties.ts`'s `summonable`, because the ruling is the disagreement
 *     between the two files rather than either one alone.
 *   - `notFinishedChance` and `lostChance` are derived from `damageMultiplier`
 *     and nothing else. The figures below are what the derivation produces at
 *     each band; if `REGARD_BANDS` is retuned these move with it, and that is
 *     the point of asserting them here rather than writing them down anywhere.
 *   - Party size touches whether anybody came back and never whether the
 *     posting was finished. That is a design boundary AGENTS.md explicitly
 *     leaves open, and a change to it must be a decision rather than a drift.
 */

import { describe, it, expect } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { daysByConveyance } from '../../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import {
    countedHolding,
    requireConveyance
} from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { getSendingReason } from '../../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import {
    ALLIED_STANDING,
    IMPOSSIBLE_TIERS,
    NEED_PREDICATES,
    RIVAL_STANDING,
    isImpossibleTier,
    lostChance,
    magnitudeOf,
    newsOfASending,
    notFinishedChance,
    partyOrdinal,
    postingFor,
    reasonsOpenTo,
    resolveSending,
    tierFor,
    tierNameFor,
    whoTheHouseCanSend,
    type Candidate,
    type HouseAsItStands
} from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import {
    SENDING_REASONS,
    TIER_NAMES,
    getSendingReason
} from '../../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { BEAST_CHANGE_ORDINAL } from '../../../src/data/cultivation/beasts.js';
import { summonable } from '../../../src/engine/encounters/duties.js';
import { ALLIED_STANDING as GATHERINGS_ALLIED } from '../../../src/engine/world/gatherings.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { regardFor } from '../../../src/engine/cultivation/regard.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { REGARD_BANDS } from '../../../src/schema/cultivation.js';

function house(patch: Partial<HouseAsItStands> = {}): HouseAsItStands {
    return {
        id: 'sect-nobody',
        name: 'Nobody',
        holdsGround: false,
        standing: {},
        hasAFind: false,
        ...patch
    };
}

function roster(...ordinals: number[]): Candidate[] {
    return ordinals.map((ordinal, i) => ({ id: `p${i}`, name: `Person ${i}`, ordinal }));
}

// ─────────────────────────────────────────────────────────────────────────

describe('binding a reason to a house that actually has it', () => {
    it('a house with nothing gets only the unconditional reasons', () => {
        const open = reasonsOpenTo(house());
        expect(open.length).toBeGreaterThan(0);
        for (const reason of open) expect(reason.needs).toBe('nothing');
    });

    it('holding ground is what gives a house a tide to stand to', () => {
        const landless = reasonsOpenTo(house()).map(r => r.id);
        const landed = reasonsOpenTo(house({ holdsGround: true })).map(r => r.id);
        expect(landless).not.toContain('sending-to-stand-to');
        expect(landed).toContain('sending-to-stand-to');
    });

    it('an ally opens a marriage and a rival opens a war, off the same map', () => {
        const allied = reasonsOpenTo(house({ standing: { other: ALLIED_STANDING } })).map(r => r.id);
        const hostile = reasonsOpenTo(house({ standing: { other: RIVAL_STANDING } })).map(r => r.id);
        expect(allied).toContain('sending-to-a-marriage');
        expect(allied).not.toContain('sending-to-a-war');
        expect(hostile).toContain('sending-to-a-war');
        expect(hostile).not.toContain('sending-to-a-marriage');
    });

    it('the ally threshold is the one gatherings.ts already uses', () => {
        // Two thresholds for the same word would let a house be an ally in one
        // subsystem and nothing in the next.
        expect(ALLIED_STANDING).toBe(GATHERINGS_ALLIED);
        expect(RIVAL_STANDING).toBe(-GATHERINGS_ALLIED);
    });

    it('a real house with subsidiaries has a tribute round to send somebody on', () => {
        // Read off the governance chain, not off anything authored here. The
        // Pavilion grants to the Mist, so it has somebody to collect from.
        const pavilion = house({ id: 'sect-azure-cloud-pavilion', name: 'Azure Cloud Pavilion' });
        const ids = reasonsOpenTo(pavilion).map(r => r.id);
        expect(ids).toContain('sending-to-collect-tribute');
        expect(ids).toContain('sending-after-a-quiet-subsidiary');
    });

    it('a house at the bottom of a chain answers calls it cannot refuse', () => {
        const dew = house({ id: 'sect-azure-dew-sect', name: 'Azure Dew Sect' });
        expect(reasonsOpenTo(dew).map(r => r.id)).toContain('sending-to-answer-a-call');
    });

    it('there is one predicate per need key and not one per reason', () => {
        const keys = new Set(SENDING_REASONS.map(r => r.needs));
        expect(Object.keys(NEED_PREDICATES).length).toBeLessThan(SENDING_REASONS.length);
        for (const key of keys) expect(typeof NEED_PREDICATES[key]).toBe('function');
    });
});

// ─────────────────────────────────────────────────────────────────────────

describe('the ceiling decides who is at the gate', () => {
    const bodies = roster(4, 9, BEAST_CHANGE_ORDINAL, BEAST_CHANGE_ORDINAL + 1, 38);

    it('nobody above the beast ceiling is put on a beast errand', () => {
        const posting = postingFor({
            reason: getSendingReason('sending-for-materials')!,
            house: house(),
            pitchOrdinal: 12
        });
        const party = whoTheHouseCanSend(posting, bodies);
        expect(party.length).toBeGreaterThan(0);
        for (const member of party) expect(member.ordinal).toBeLessThanOrEqual(BEAST_CHANGE_ORDINAL);
    });

    it('a war party can be anybody, including the strongest body in the house', () => {
        const posting = postingFor({
            reason: getSendingReason('sending-to-a-war')!,
            house: house({ standing: { other: RIVAL_STANDING } }),
            pitchOrdinal: 30
        });
        const party = whoTheHouseCanSend(posting, bodies);
        expect(party.map(m => m.ordinal)).toContain(38);
    });

    it('the party is capped at the hands the reason states', () => {
        const reason = getSendingReason('sending-to-recruit')!;
        const posting = postingFor({ reason, house: house(), pitchOrdinal: 2 });
        expect(whoTheHouseCanSend(posting, roster(1, 2, 3, 4, 5, 6)).length).toBe(reason.hands);
    });

    it('a house with nobody under the ceiling sends nobody', () => {
        const posting = postingFor({
            reason: getSendingReason('sending-to-stand-to')!,
            house: house({ holdsGround: true }),
            pitchOrdinal: 20
        });
        expect(whoTheHouseCanSend(posting, roster(35, 40)).length).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────

describe('the tier is the regard band', () => {
    it('a party is judged at its strongest member and never at its size', () => {
        expect(partyOrdinal(roster(3, 11, 7))).toBe(11);
        expect(partyOrdinal(roster(3, 3, 3, 3, 3, 3, 3, 3))).toBe(3);
        expect(partyOrdinal([])).toBe(0);
    });

    it('is the same band regardFor would give, with no adjustment of its own', () => {
        const posting = postingFor({
            reason: getSendingReason('sending-an-escort')!, house: house(), pitchOrdinal: 18
        });
        expect(tierFor(posting, roster(14)).band).toBe(regardFor(18, 14).band);
    });

    it('the impossible tiers are the two bands a house will not send against', () => {
        // The whole ruling, as the relationship between two files. duties.ts is
        // right to refuse to offer these; this module is right to let a board
        // carry one anyway.
        for (const band of IMPOSSIBLE_TIERS) {
            expect(summonable(band), `${band} should not be summonable`).toBe(false);
            expect(isImpossibleTier(band)).toBe(true);
        }
        expect(IMPOSSIBLE_TIERS).toEqual(['overmatched', 'unreachable']);
    });

    it('nothing a house would actually send you on is impossible', () => {
        for (const row of REGARD_BANDS) {
            if (!summonable(row.band)) continue;
            expect(isImpossibleTier(row.band)).toBe(false);
        }
    });

    it('every band has a board word, and it comes from the catalog', () => {
        for (const row of REGARD_BANDS) {
            expect(tierNameFor(row.band)).toBe(TIER_NAMES[row.band]);
            expect(tierNameFor(row.band).length).toBeGreaterThan(0);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────

describe('what it costs is derived from the band and from nothing else', () => {
    function regardAtBand(band: string) {
        const row = REGARD_BANDS.find(r => r.band === band)!;
        // A gap inside the band's window. Infinite bounds are the ends.
        const gap = Number.isFinite(row.minGap) ? row.minGap : row.maxGap as number;
        return regardFor(20, 20 + gap);
    }

    it('a posting at or beneath your rung is work rather than a gamble', () => {
        for (const band of ['matched', 'assured', 'beneath', 'dismissed']) {
            expect(notFinishedChance(regardAtBand(band)), band).toBe(0);
            expect(lostChance(regardAtBand(band)), band).toBe(0);
        }
    });

    it('the figures the derivation produces, band by band', () => {
        expect(notFinishedChance(regardAtBand('stretch'))).toBeCloseTo(0.375, 3);
        expect(notFinishedChance(regardAtBand('overmatched'))).toBeCloseTo(0.667, 3);
        expect(notFinishedChance(regardAtBand('unreachable'))).toBeCloseTo(0.833, 3);
    });

    it('the impossible band is finished sometimes, and that is deliberate', () => {
        // "Typically does not" is not "never". A posting nine rungs up is
        // finished roughly one attempt in six, which is what makes the person
        // who does it worth talking about.
        const impossible = 1 - notFinishedChance(regardAtBand('unreachable'));
        expect(impossible).toBeGreaterThan(0.1);
        expect(impossible).toBeLessThan(0.25);
    });

    it('coming back is harder than finishing, at every band above you', () => {
        for (const band of ['stretch', 'overmatched', 'unreachable']) {
            expect(lostChance(regardAtBand(band))).toBeLessThan(notFinishedChance(regardAtBand(band)));
            expect(lostChance(regardAtBand(band))).toBeGreaterThan(0);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────

describe('resolving a sending', () => {
    const reason = getSendingReason('sending-an-escort')!;

    function run(pitch: number, party: Candidate[], seed: number) {
        return resolveSending({
            posting: postingFor({ reason, house: house(), pitchOrdinal: pitch }),
            party,
            departsOnDay: 1000,
            rng: forStream('world-seed', 'sending-test', seed)
        });
    }

    it('a posting at the party rung is always finished', () => {
        for (let seed = 0; seed < 60; seed++) {
            expect(run(10, roster(10, 9, 8), seed).outcome).toBe('finished');
        }
    });

    it('is reproducible from the same stream', () => {
        const a = run(30, roster(12, 11), 7);
        const b = run(30, roster(12, 11), 7);
        expect(a.outcome).toBe(b.outcome);
        expect(a.lost.map(m => m.id)).toEqual(b.lost.map(m => m.id));
    });

    it('the term comes off the reason and the party is due back on it', () => {
        expect(run(10, roster(10), 1).returnsOnDay).toBe(1000 + reason.days);
    });

    it('numbers buy a witness and never buy the outcome', () => {
        // Pooled over sixty seeds in both arms, because a threshold on a varied
        // outcome asserted on one draw reports the world moving as the world
        // breaking.
        let aloneFinished = 0, crowdFinished = 0;
        let aloneReported = 0, crowdReported = 0;
        for (let seed = 0; seed < 60; seed++) {
            const alone = run(30, roster(12), seed);
            const crowd = run(30, roster(12, 12, 12, 12, 12, 12), seed);
            if (alone.outcome === 'finished') aloneFinished++;
            if (crowd.outcome === 'finished') crowdFinished++;
            if (alone.outcome === 'came_back_short') aloneReported++;
            if (crowd.outcome === 'came_back_short') crowdReported++;
        }
        // Identical, and not merely close: the finish draw does not see the
        // party at all, so the same stream gives the same answer.
        expect(crowdFinished).toBe(aloneFinished);
        // And the crowd is far likelier to bring back a report of the failure.
        expect(crowdReported).toBeGreaterThan(aloneReported);
    });

    it('an unfinished sending that somebody survives carries a sighting', () => {
        let found = 0;
        for (let seed = 0; seed < 80 && found === 0; seed++) {
            const sending = run(34, roster(10, 10, 10, 10), seed);
            if (sending.outcome !== 'came_back_short') continue;
            found++;
            expect(sending.sighted).not.toBeNull();
            expect(sending.sighted!.seenBy.length).toBeGreaterThan(0);
        }
        expect(found).toBe(1);
    });

    it('a sighting on ground that shuts carries the day it next opens', () => {
        const ruin = makeLocation({
            id: 'loc-the-shut-door', name: 'The Shut Door', kind: 'ruin',
            cycle: { periodDays: 3650, openDays: 60, phaseDay: 0 }
        });
        let checked = 0;
        for (let seed = 0; seed < 120 && checked === 0; seed++) {
            const sending = resolveSending({
                posting: postingFor({
                    reason: getSendingReason('sending-to-open-an-inheritance')!,
                    house: house({ hasAFind: true }),
                    pitchOrdinal: 34,
                    locationId: ruin.id
                }),
                party: roster(10, 10, 10, 10, 10),
                departsOnDay: 1000,
                rng: forStream('world-seed', 'sighting-test', seed),
                location: ruin
            });
            if (sending.outcome !== 'came_back_short') continue;
            checked++;
            const opens = sending.sighted!.opensAgainOnDay;
            expect(opens).not.toBeNull();
            expect(opens!).toBeGreaterThanOrEqual(sending.returnsOnDay);
            expect(opens! % 3650).toBeLessThan(60);
        }
        expect(checked).toBe(1);
    });

    it('nobody sent means nobody comes back, without a special case', () => {
        const sending = run(40, [], 3);
        expect(sending.outcome).toBe('did_not_come_back');
        expect(sending.sighted).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────

describe('and then people talk about it', () => {
    function sendingAt(pitch: number, reasonId: string, seed: number) {
        return resolveSending({
            posting: postingFor({
                reason: getSendingReason(reasonId)!,
                house: house({ id: 'sect-somewhere', name: 'Somewhere' }),
                pitchOrdinal: pitch
            }),
            party: roster(12, 12, 12),
            departsOnDay: 2000,
            rng: forStream('world-seed', 'news-test', seed)
        });
    }

    it('the ledger word comes off the reason, uninterpreted', () => {
        for (const reason of SENDING_REASONS) {
            const fact = newsOfASending(sendingAt(12, reason.id, 1));
            expect(fact.kind).toBe(reason.factKind);
            expect(fact.scale).toBe(reason.scale);
        }
    });

    it('an impossible posting is public whichever way it went', () => {
        const fact = newsOfASending(sendingAt(40, 'sending-an-escort', 1));
        expect(fact.visibility).toBe('public');
        expect(newsOfASending(sendingAt(12, 'sending-an-escort', 1)).visibility).toBe('regional');
    });

    it('a harder posting is a heavier fact, which is the whole of prestige here', () => {
        const easy = magnitudeOf(sendingAt(12, 'sending-an-escort', 1));
        const hard = magnitudeOf(sendingAt(40, 'sending-an-escort', 1));
        expect(hard).toBeGreaterThan(easy);
        expect(hard).toBeLessThanOrEqual(1);
    });

    it('an unfinished sending is filed as a near miss with what was seen on it', () => {
        let found = 0;
        for (let seed = 0; seed < 80 && found === 0; seed++) {
            const sending = sendingAt(34, 'sending-for-materials', seed);
            if (sending.outcome !== 'came_back_short') continue;
            found++;
            const fact = newsOfASending(sending);
            expect(fact.nearMiss).toBe(true);
            expect(fact.nearMissNote).toMatch(/saw it/);
        }
        expect(found).toBe(1);
    });

    it('the party is on the fact by name, so talk can attach the wrong one', () => {
        const sending = sendingAt(12, 'sending-an-escort', 1);
        const fact = newsOfASending(sending);
        expect(fact.actors.map(a => a.id)).toEqual(sending.party.map(m => m.id));
        expect(fact.factionIds).toEqual(['sect-somewhere']);
    });

    it('the summary is factual and states the rung it was pitched at', () => {
        const fact = newsOfASending(sendingAt(19, 'sending-an-escort', 1));
        expect(fact.summary).toContain('ordinal 19');
        expect(fact.summary).toContain('Somewhere');
        // The board's own word for the tier, so the ledger row says how hard
        // it was and not only where it was pitched.
        expect(fact.summary.toLowerCase())
            .toContain(TIER_NAMES[regardFor(19, 12).band].toLowerCase());
    });
});

describe('what the house put them on', () => {
    // THE ROUTED HUNK. The header used to say this module takes no view of
    // travel time, and `days` IS travel time: a house with a hull gets its
    // people back sooner and there was nowhere for that fact to land. Nothing
    // about how far anything covers in a day is decided here - it is
    // `daysByConveyance`, which is the one function in the repo that knows.
    const house: HouseAsItStands = {
        id: 'sect-somewhere', name: 'Somewhere', holdsGround: true, standing: {}, hasAFind: false
    };
    const reason = getSendingReason('sending-an-escort')!;

    it('walks by default, which is exactly the term the reason already stated', () => {
        const on = postingFor({ reason, house, pitchOrdinal: 12 });
        expect(on.days).toBe(reason.days);
        expect(on.walkingDays).toBe(reason.days);
        expect(on.conveyanceId).toBeNull();
    });

    it('shortens the term when the house has something in the yard', () => {
        const carriage = requireConveyance('conv-carriage-earth');
        const rode = postingFor({ reason, house, pitchOrdinal: 12, conveyance: carriage });
        expect(rode.days).toBe(daysByConveyance(reason.days, carriage, null));
        expect(rode.days).toBeLessThan(rode.walkingDays);
        expect(rode.conveyanceId).toBe(carriage.id);
    });

    it('carries the shorter term all the way to the day they are due back', () => {
        // The one number a conveyance moves, and everything downstream reads
        // it: the return date, the sighting's opening day, how long the roster
        // is short.
        const carriage = requireConveyance('conv-carriage-earth');
        const party: Candidate[] = [{ id: 'a', name: 'A', ordinal: 12 }];
        const walked = resolveSending({
            posting: postingFor({ reason, house, pitchOrdinal: 12 }),
            party, departsOnDay: 1000, rng: forStream('s', 'sending', 1)
        });
        const rode = resolveSending({
            posting: postingFor({ reason, house, pitchOrdinal: 12, conveyance: carriage }),
            party, departsOnDay: 1000, rng: forStream('s', 'sending', 1)
        });
        expect(rode.returnsOnDay).toBeLessThan(walked.returnsOnDay);
    });
});

describe('the world actually sends people', () => {
    it('writes news of its houses over five centuries, and loses some of them', async () => {
        // THE TEST THAT COULD NOT HAVE PASSED BEFORE. Every export in this
        // module was zero-reference, so none of the above ever ran in a world:
        // no house ever put a party on the road, nobody was ever lost on one,
        // and nothing a house did became a fact anybody could repeat.
        const catalog = await loadCultivationCatalog();
        let { state } = seedWorld({ seed: 'sendings-are-wired', catalog });
        state = advanceWorldYears(state, 500).state;

        const news = state.history.facts.filter(f => / sent \d+ on /.test(f.summary));
        expect(news.length).toBeGreaterThan(20);
        // The board's own word for the tier is on the row, so a chronicle read
        // in two centuries says how hard it was and not only where it was.
        for (const fact of news.slice(0, 20)) {
            expect(fact.summary).toMatch(/at ordinal \d+/);
            // "a open posting" printed for two of the six band names before
            // the article was derived. A chronicle read in two centuries
            // should not have that in it.
            expect(fact.summary).toMatch(/, an? [a-z ]+ at ordinal \d+/);
        }

        // Some of them did not come back. `markMissing` and not `markDead`:
        // the absence layer owns how long before anybody says it out loud and
        // who inherits, and settling it here would take that decision away.
        expect(state.npcs.some(n => n.status === 'missing')).toBe(true);

        // And a solvent house keeps something in the yard, which is the writer
        // `adjustCountedHolding` never had.
        const live = state.factions.filter(f => f.dissolvedOnDay === null);
        expect(live.some(f => countedHolding(f.resources, 'conv-carriage-earth') > 0)).toBe(true);
    }, 900_000);
});
