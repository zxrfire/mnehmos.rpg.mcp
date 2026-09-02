/**
 * Discovery has a second channel, and this file is the guard on the line
 * between them.
 *
 *   "at higher ranks you should just be able to fly and look around. why should
 *    the entire thing be dependent on asking? that's a mortal's POV."
 *
 * Two claims have to hold at once and they pull opposite ways, which is why
 * they are tested together rather than in two files:
 *
 *   THE GATE STILL BINDS AT THE BOTTOM. A low cultivator learns the world by
 *   being told about it, and nothing here may hand them anything.
 *   THE GATE SCALES. A high one sees the world without anybody's help.
 *
 * And the invariant that survives every height: PERCEPTION GIVES YOU THE WORLD
 * AND NOT PEOPLE. No name, no holder, no ceiling, at any rung, ever.
 */

import { REGIONS } from '../../src/data/cultivation/regions';
import { TECHNIQUES } from '../../src/data/cultivation/techniques';
import {
    ABOVE_THE_WEATHER,
    HORIZON_AT_FIRST_FLIGHT,
    LEAVES_THE_GROUND,
    horizonInDays,
    whatCanBeSeenFromUpThere,
    whichWay,
    withinSight,
    type Sighting
} from '../../src/web/what-you-can-see-from-up-there';
import { MAX_ORDINAL, realmForOrdinal } from '../../src/engine/cultivation/realms';
import { makeGame } from './harness';

// ─────────────────────────────────────────────────────────────────────────
// THE ANCHORS ARE THE CATALOG'S, NOT THIS MODULE'S
// ─────────────────────────────────────────────────────────────────────────

describe('the floor is where the world already puts flight', () => {
    /**
     * The whole reason the module may state two bare numbers. If a content pass
     * moves either art, this fails and says which one - which is the drift the
     * constants would otherwise acquire silently, and the honest alternative to
     * importing a technique id into a presentation module.
     */
    it('matches the two flight arts in the technique catalog', () => {
        const first = TECHNIQUES.find(art => art.id === 'gale-riding-sword-flight');
        const sustained = TECHNIQUES.find(art => art.id === 'thousand-li-cloud-tread');

        expect(first, 'gale-riding-sword-flight is gone from the catalog').toBeDefined();
        expect(sustained, 'thousand-li-cloud-tread is gone from the catalog').toBeDefined();

        expect(LEAVES_THE_GROUND).toBe(first!.requiredOrdinal);
        expect(ABOVE_THE_WEATHER).toBe(sustained!.requiredOrdinal);
    });

    /**
     * Flight is not a realm grant here and this module must not become the
     * place one gets minted. Checked against the capability layer rather than
     * asserted in a comment.
     */
    it('adds no capability grant anywhere', async () => {
        const capability = await import('../../src/engine/world/capability.js');
        const grants = JSON.stringify(capability.CLASS_GRANTS ?? {});
        expect(grants).not.toContain('fl');
        expect(grants).not.toContain('sight');
        expect(grants).not.toContain('horizon');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ONE SCALE
// ─────────────────────────────────────────────────────────────────────────

describe('the horizon is one curve and has no rungs in it', () => {
    it('is zero for anybody who cannot get off the ground', () => {
        for (let ordinal = 0; ordinal < LEAVES_THE_GROUND; ordinal++) {
            expect(horizonInDays(ordinal), `ordinal ${ordinal}`).toBe(0);
            expect(withinSight(horizonInDays(ordinal), null), `ordinal ${ordinal}`).toBe(false);
            expect(withinSight(horizonInDays(ordinal), 6), `ordinal ${ordinal}`).toBe(false);
        }
    });

    it('never goes backwards, and never stops growing, all the way up', () => {
        for (let ordinal = LEAVES_THE_GROUND; ordinal < MAX_ORDINAL; ordinal++) {
            expect(horizonInDays(ordinal + 1)).toBeGreaterThan(horizonInDays(ordinal));
        }
    });

    /**
     * The two anchors, read against the roads the catalog actually prices.
     *
     * The shortest road in the world is six days, so first flight sees its own
     * province and nothing past it; sustained flight reaches the near
     * provinces and not the far ones. Both are read off `REGIONS` rather than
     * retyped, so a gazetteer change that closes the gap fails here.
     */
    it('puts first flight inside its own province and no further', () => {
        const roads = REGIONS.flatMap(region => region.connections.map(link => link.travelDays));
        const shortest = Math.min(...roads);

        expect(HORIZON_AT_FIRST_FLIGHT).toBeLessThan(shortest);
        expect(withinSight(horizonInDays(LEAVES_THE_GROUND), null)).toBe(true);
        expect(withinSight(horizonInDays(LEAVES_THE_GROUND), shortest)).toBe(false);
    });

    it('puts sustained flight over the near provinces and short of the far ones', () => {
        const horizon = horizonInDays(ABOVE_THE_WEATHER);
        const roads = [...new Set(
            REGIONS.flatMap(region => region.connections.map(link => link.travelDays))
        )].sort((a, b) => a - b);

        expect(withinSight(horizon, roads[0])).toBe(true);
        expect(withinSight(horizon, roads[roads.length - 1])).toBe(false);
    });

    /**
     * The curve saturates against the map rather than against a constant. By
     * Deity Transformation the whole world is inside it, which is the
     * cultivation README's own claim about that realm arrived at from the
     * travel catalog instead of written to match it.
     */
    it('reaches the far side of the world inside Deity Transformation, with no cap anywhere', () => {
        const furthest = Math.max(
            ...REGIONS.flatMap(region => region.connections.map(link => link.travelDays))
        );
        let first = LEAVES_THE_GROUND;
        while (first <= MAX_ORDINAL && !withinSight(horizonInDays(first), furthest)) first++;

        // The band is read off the ladder rather than retyped, so a change to
        // where Deity Transformation sits moves this with it.
        expect(realmForOrdinal(first).key, `the world closes at ordinal ${first}`)
            .toBe('deity_transformation');

        // And nothing clamps it, so a rung above the top is strictly more.
        expect(horizonInDays(MAX_ORDINAL)).toBeGreaterThan(horizonInDays(MAX_ORDINAL - 1));
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHERE IT LIES
// ─────────────────────────────────────────────────────────────────────────

describe('a bearing is only stated where the map supports one', () => {
    it('reads an arm off the centre as a plain direction', () => {
        expect(whichWay('centre', 'north')).toBe('to the north');
    });

    it('sends somebody on an arm back down the road to the centre', () => {
        expect(whichWay('north', 'centre')).toContain('back down the road');
        expect(whichWay('north', 'centre')).toContain('south');
    });

    /**
     * Arm to arm there is no road, and this world's whole geography is that
     * fact. Claiming a direction would be claiming a line nobody travels.
     */
    it('refuses to invent a direction between two arms', () => {
        expect(whichWay('north', 'east')).toContain('across the centre');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE READ
// ─────────────────────────────────────────────────────────────────────────

const GROUND: readonly Sighting[] = [
    { kind: 'vein', bearing: 'centre', days: null, ambient: 'dense', inhabited: false },
    { kind: 'sect_seat', bearing: 'north', days: 11, ambient: 'normal', inhabited: true },
    { kind: 'city', bearing: 'east', days: 34, ambient: 'thin', inhabited: true }
];

describe('what a look from up there comes back with', () => {
    /**
     * The refusal, and it owes the player the next move. Both of them: the rung
     * that would open this channel, and the reminder that the other channel is
     * open now.
     */
    it('refuses below the floor and names what would work', () => {
        const read = whatCanBeSeenFromUpThere({
            ordinal: LEAVES_THE_GROUND - 1, from: 'centre', onTheGround: GROUND
        });

        expect(read.seen).toBe(0);
        expect(read.lines.join(' ')).toContain('foundation');
        expect(read.lines.join(' ')).toContain('Ask');
        expect(read.structure.join(' ')).toContain('the horizon is zero');
    });

    it('shows the near ground at first flight and not the far', () => {
        const read = whatCanBeSeenFromUpThere({
            ordinal: LEAVES_THE_GROUND, from: 'centre', onTheGround: GROUND
        });

        expect(read.seen).toBe(1);
        expect(read.lines.join(' ')).toContain('the air over it is heavy');
        expect(read.lines.join(' ')).toContain('Nothing is living on it');
    });

    it('shows more of it further up, with no branch on the height', () => {
        const low = whatCanBeSeenFromUpThere({ ordinal: 16, from: 'centre', onTheGround: GROUND });
        const high = whatCanBeSeenFromUpThere({ ordinal: 30, from: 'centre', onTheGround: GROUND });
        expect(high.seen).toBeGreaterThan(low.seen);
        expect(high.seen).toBe(GROUND.length);
    });

    /**
     * THE LINE. A sect seat is seen as walls and never as a sect, at any
     * height, and the type is what makes that true rather than this assertion -
     * there is no field a name could arrive in.
     */
    it('gives the world and never gives people, at the top of the ladder', () => {
        const read = whatCanBeSeenFromUpThere({
            ordinal: MAX_ORDINAL, from: 'centre', onTheGround: GROUND
        });
        const said = read.lines.join(' ');

        expect(said).toContain('compound somebody built to be defended');
        expect(said).not.toMatch(/sect|Sect|pavilion|Pavilion|house|House/);
        expect(said).toContain('somebody has to say out loud');
    });

    /** Dead ground and forbidden ground are one bald patch from a thousand feet. */
    it('cannot tell apart two things that look the same from above', () => {
        const at = (kind: string): string => whatCanBeSeenFromUpThere({
            ordinal: 30,
            from: 'centre',
            onTheGround: [{ kind, bearing: 'centre', days: null, ambient: null, inhabited: null }]
        }).lines[0];

        expect(at('scar')).toBe(at('forbidden_zone'));
    });

    /** Stable: the same look twice reads the same way. */
    it('is deterministic', () => {
        const once = whatCanBeSeenFromUpThere({ ordinal: 30, from: 'centre', onTheGround: GROUND });
        const twice = whatCanBeSeenFromUpThere({ ordinal: 30, from: 'centre', onTheGround: GROUND });
        expect(once).toEqual(twice);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PLAYED
// ─────────────────────────────────────────────────────────────────────────

describe('played at two heights', () => {
    /**
     * The bottom of the ladder is unchanged, which is the constraint that makes
     * this a design rather than a hole. A starting cultivator asking where they
     * could go gets what they always got, plus a refusal that says why there is
     * no more of it and what would change that.
     */
    it('a starting cultivator is still refused, and told what would work', async () => {
        const { game } = makeGame({ worldEnabled: true, seed: 'horizon-low' });
        await game.newRun('Wei Zhaoxun');

        const where = await game.act('where can I go');
        const said = where.narration ?? '';

        expect(said).toContain('You cannot get above it');
        expect(said).toContain('Ask, and keep asking');
        expect(said).not.toContain('day of road away');
        expect(said).not.toContain('days of road away');
    }, 60_000);

    /**
     * And the same question at a height that can answer it. The ordinal is set
     * directly - a fixture, and said so: nothing in a test can climb twenty
     * rungs, and what is being measured is the read rather than the climb.
     */
    it('a high cultivator sees ground nobody ever told them about', async () => {
        const { game, repos } = makeGame({ worldEnabled: true, seed: 'horizon-high' });
        const created = await game.newRun('Wei Zhaoxun');
        repos.cultivators.update(created.cultivator.id, { realmOrdinal: 30 } as never);

        const where = await game.act('where can I go');
        const said = where.narration ?? '';

        expect(said).toMatch(/things down there nobody has told you about|One thing down there/);
        expect(said).toMatch(/day[s]? of road away|inside this province/);
        expect(said).toContain('somebody has to say out loud');
    }, 60_000);

    /**
     * The invariant, measured rather than asserted: everything the perceptual
     * channel printed for a cultivator at height, checked against every place
     * name in the gazetteer they hold no record for.
     *
     * This is the test that would catch the mistake this whole design is at
     * risk of - a later change deciding that since the player can see it, they
     * may as well be told what it is called.
     */
    it('prints no name it was not already going to print', async () => {
        const { game, repos } = makeGame({ worldEnabled: true, seed: 'horizon-names' });
        const created = await game.newRun('Wei Zhaoxun');

        const before = await game.act('where can I go');
        repos.cultivators.update(created.cultivator.id, { realmOrdinal: 30 } as never);
        const after = await game.act('where can I go');

        const wasNamed = before.narration ?? '';
        const nowNamed = after.narration ?? '';

        // Every settlement in the world. Any of them that the low read did not
        // print must not appear in the high read either: height buys distance
        // and shape, and it does not buy the gazetteer.
        const everywhere = REGIONS.flatMap(region => region.places.map(place => place.name));
        const leaked = everywhere.filter(name => !wasNamed.includes(name) && nowNamed.includes(name));

        expect(leaked, `perception leaked names: ${leaked.join(', ')}`).toEqual([]);

        // And no province ceiling, which is the other thing altitude must not
        // buy - it is a fact about what people there have managed, not about
        // what the ground looks like.
        const seen = nowNamed.slice(nowNamed.indexOf('down there'));
        expect(seen).not.toMatch(/carries anybody|ceiling/i);
    }, 60_000);
});
