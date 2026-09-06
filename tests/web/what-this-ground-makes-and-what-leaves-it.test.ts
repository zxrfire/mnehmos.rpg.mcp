/**
 * A WHOLE TRADE LAYER, WITH NO SENTENCE THAT REACHED IT.
 *
 * `what-each-house-makes-and-what-crosses-the-water.ts` is one of the most
 * completely written files in the catalog: who makes what and why, three named
 * lanes with weather and landfalls and open months on them, six cargoes each
 * with a maker, a carrier, a buyer and a stated reason it goes by water rather
 * than by road, and four operators who disagree about what they are doing.
 *
 * Every reader in it had no caller outside the catalog's own index -
 * `artisansOf`, `cargoMadeBy`, `cargoCarriedBy`, `cargoOnLane`, `getSeaLane`,
 * `housesWithAWrittenCraft`, `lanesTouchingWater`, `whatEachProvinceMakes` -
 * so a player standing on a quay could not ask where one thing on the counter
 * came from. That file's own header says the trade layer exists precisely so
 * goods have a SOURCE, because *merchants who conjure stock out of nowhere
 * would be exactly the parallel-system mistake AGENTS.md warns about*. The
 * derivation was written, argued at length, and dark.
 *
 * ── WHAT IS BEING PINNED ─────────────────────────────────────────────────
 *
 * That the sentence reaches the read; that the read is a READ - free, moving
 * nothing and pricing nothing, because the market verbs do that; that the
 * derived answer is reported AS derived rather than dressed up as a written
 * craft; and that an inland province gets a true answer rather than an empty
 * one.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { REGIONS } from '../../src/data/cultivation/regions';
import {
    theLinesForWhatIsMadeHere,
    theStructureOfWhatIsMadeHere,
    whatAProvinceMakes,
    whatThisGroundMakes,
    whatThisHouseMakes
} from '../../src/web/what-this-ground-makes-and-what-leaves-it';
import { makeGameInWorld } from './harness';

/** A port that works both lanes it touches. The busiest water in the world. */
const THE_PORT = 'sect-silver-island-market';
/** Refining, with a fixed price list. Its pills go out on a hull. */
const THE_CRUCIBLE = 'sect-cinnabar-crucible-sect';

function ground(houses: { id: string; name: string }[], exports: string[] = []) {
    return {
        provinceId: 'test-province',
        provinceName: 'The Test Province',
        exports,
        housesHere: houses,
        nameOfHouse: (id: string) => houses.find(h => h.id === id)?.name ?? id
    };
}

describe('the sentence', () => {
    it('reaches the read, both ways round', () => {
        for (const said of [
            'what does this province make',
            'what is made here',
            'what do they make around here',
            'what does this region export',
            'what crosses the water',
            'what comes up the river',
            'what is on the hulls'
        ]) {
            const parsed = parseIntent(said);
            expect(parsed.action, said).toBe('look');
            expect(parsed.intent, said).toBe('what_is_made_here');
        }
    });

    /**
     * AND IT DOES NOT EAT THE VERBS AROUND IT. "What is for sale" has a price
     * on it and is a different question; the ground holder read names the same
     * ground and asks something else entirely.
     */
    it('leaves the market and the holder alone', () => {
        expect(parseIntent('what is for sale here').intent).not.toBe('what_is_made_here');
        expect(parseIntent('who holds this ground').intent).toBe('holder');
        expect(parseIntent('what can I buy here').intent).not.toBe('what_is_made_here');
        expect(parseIntent('I buy a Meridian Rebirth Pill').intent).not.toBe('what_is_made_here');
    });
});

describe('the read', () => {
    /**
     * THE FALLBACK IS THE ANSWER AND IT SAYS SO. `artisansOf` returns the
     * province's export list for a house with no written row, and marks it - so
     * a derived craft can never be mistaken for a written one, in the data or
     * in the prose.
     */
    it('tells a written craft apart from the province\'s own list', () => {
        const read = whatThisGroundMakes(ground([
            { id: THE_PORT, name: 'Silver Island Market' }
        ]));
        expect(read.workshops.length).toBe(1);
        expect(read.workshops[0]!.derivedFromProvince).toBe(false);
        expect(read.workshops[0]!.craft).toMatch(/port|transaction/i);
    });

    /**
     * WHAT CROSSES IS WHAT SOMEBODY HERE HAS A HAND IN, in either direction:
     * made by one of these houses, or carried by one of them. Anything else is
     * somebody else's water.
     */
    it('reports the cargo this ground has a hand in, and no other', () => {
        const port = whatThisGroundMakes(ground([
            { id: THE_PORT, name: 'Silver Island Market' }
        ]));
        expect(port.crossings.length).toBeGreaterThan(0);
        for (const crossing of port.crossings) {
            const theirs = crossing.carriedBy === 'Silver Island Market'
                || crossing.madeBy === 'Silver Island Market';
            expect(theirs, crossing.what).toBe(true);
        }
        // And a house that makes something which goes by water is reported for
        // it even though somebody else carries it.
        const crucible = whatThisGroundMakes(ground([
            { id: THE_CRUCIBLE, name: 'Cinnabar Crucible Sect' }
        ]));
        expect(crucible.crossings.some(c => c.madeBy === 'Cinnabar Crucible Sect')).toBe(true);
    });

    /** Inland ground gets a true answer rather than an empty one. */
    it('says outright that nothing here goes by water', () => {
        const dry = whatThisGroundMakes(ground([{ id: 'sect-nowhere', name: 'Nowhere Hall' }]));
        expect(dry.crossings).toEqual([]);
        expect(theLinesForWhatIsMadeHere(dry).join(' ')).toMatch(/Nothing here goes by water/i);
    });

    /**
     * A LANE WITH NOWHERE TO STOP IS THE FACT THAT MATTERS, and it is read off
     * the lane rather than restated: `lane-the-northern-capes` has an empty
     * `intermediateLandfallDays` and loses about one hull in five.
     */
    it('carries the landfalls, because zero of them is the whole risk', () => {
        const port = whatThisGroundMakes(ground([
            { id: THE_PORT, name: 'Silver Island Market' }
        ]));
        const nowhereToStop = port.crossings.find(c => c.landfalls === 0);
        expect(nowhereToStop, 'no lane with nothing in the middle of it').toBeTruthy();
        expect(theLinesForWhatIsMadeHere(port).join(' ')).toMatch(/nowhere to stop/i);
    });

    /**
     * AN EXPORT ROW IS A SENTENCE AND NOT A NOUN. `regions.ts` writes each one
     * as a claim with its own commas in it, so they are said one per line -
     * joined with commas they were a single unreadable run.
     */
    it('says the province list one entry at a time', () => {
        const lines = theLinesForWhatIsMadeHere(whatThisGroundMakes(ground(
            [],
            ['salt, in quantity, and why', 'passage, priced per head']
        )));
        expect(lines.filter(l => l.startsWith('- ')).length).toBe(2);
    });

    /** And the mechanical line says which readings answered. */
    it('reports what it read and what it did not', () => {
        const structure = theStructureOfWhatIsMadeHere(whatThisGroundMakes(ground([
            { id: THE_PORT, name: 'Silver Island Market' }
        ])));
        expect(structure).toMatch(/whatThisGroundMakes/);
        expect(structure).toMatch(/written craft/);
        expect(structure).toMatch(/named lane/);
    });
});

describe('asked about a house rather than about the ground', () => {
    it('answers out of the same catalogs', () => {
        const lines = whatThisHouseMakes(THE_CRUCIBLE, 'Cinnabar Crucible Sect').join(' ');
        expect(lines).toMatch(/Refining/i);
        expect(lines).toMatch(/on the water|carry it/i);
    });

    it('says plainly when nothing on the record answers', () => {
        expect(whatThisHouseMakes('sect-invented', 'Invented Hall').join(' '))
            .toMatch(/Nothing on the record/i);
    });
});

describe('the province list, by id', () => {
    it('answers for a real province and is empty for none', () => {
        const anyRegion = REGIONS.find(r => r.exports.length > 0)!;
        expect(whatAProvinceMakes(anyRegion.id).length).toBeGreaterThan(0);
        expect(whatAProvinceMakes(null)).toEqual([]);
        expect(whatAProvinceMakes('no-such-province')).toEqual([]);
    });
});

describe('played', () => {
    /**
     * IT COSTS NOTHING, which is the half that decides whether a player asks it
     * twice. A read that spends a day is a read nobody uses.
     */
    it('answers where the player is standing, and spends nothing doing it', async () => {
        const { game, repos } = await makeGameInWorld({
            seed: 'made-here', worldSeed: 'world-made-here'
        });
        const { cultivator } = await game.newRun('Factor');
        await game.act('I look around');

        const before = repos.cultivators.getById(cultivator.id)!;
        const said = await game.act('what is made here');
        const after = repos.cultivators.getById(cultivator.id)!;

        const heard = said.error ?? said.narration ?? '';
        // Either the province answers, or it is open road and says so.
        expect(heard).toMatch(/makes|province|nothing here goes by water|No province owns/i);
        expect(after.spiritStones).toBe(before.spiritStones);
        expect(heard).not.toMatch(/days? pass/i);
    }, 200_000);

    /** And on the water it names the hulls, which is the half nothing reached. */
    it('names what crosses, standing on a coast', async () => {
        const harness = await makeGameInWorld({
            seed: 'crosses', worldSeed: 'world-crosses'
        });
        const { game, repos } = harness;
        const { cultivator } = await game.newRun('Factor');
        await game.act('I look around');

        // A province the lanes actually touch, chosen off the catalog rather
        // than hoped for out of a seed.
        const coastal = REGIONS.find(r => r.factionIds.includes(THE_PORT));
        expect(coastal, 'no province seats the port').toBeTruthy();
        repos.cultivators.update(cultivator.id, { location: coastal!.places[0]!.name });

        const said = await game.act('what crosses the water');
        const heard = said.error ?? said.narration ?? '';
        expect(heard).toMatch(/on the water/i);
        expect(heard).toMatch(/carries it/i);
    }, 200_000);
});
