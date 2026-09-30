/**
 * Mechanics lore formerly had only prose assertions in catalog tests. A
 * question now reaches a local speaker, an extinct herb no longer advertises
 * growing ground, and a lost formula explains its missing ingredient.
 * Knowledge still belongs to people: naming an ancient herb does not teach
 * its history, pressure does not teach a speaker, and a regional account does
 * not disclose the unpublished treaty. Historical receipts are not live stock.
 * Local survey names require local standing; price comparisons describe
 * quoted gross earnings rather than money left after living costs.
 */
import { describe, expect, it } from 'vitest';
import { makeGame, makeGameInWorld, ScriptedProvider } from './harness';
import { standWhereThePeopleAre } from './standing-where-the-people-are';
import { BEAST_CHANGE_ORDINAL } from '../../src/data/cultivation/beasts';
import { EXTINCT_HERB_IDS, HERBS } from '../../src/data/cultivation/herbs';
import { getPill } from '../../src/data/cultivation/pills';
import { TRADITION_WAR } from '../../src/data/cultivation/traditions';
import { RECEIPT_HISTORIES } from '../../src/data/cultivation/immortal-items';
import { getLineageStanding } from '../../src/data/cultivation/crossings';
import { DEFERENCE_HOLDINGS } from '../../src/data/cultivation/governance-and-water-rights';
import { whoStandsBehindThem } from '../../src/web/who-stands-behind-them';
import { whatAHouseHasToItsName } from '../../src/web/what-a-house-has-to-its-name';
import { PRICES } from '../../src/data/cultivation/mortal-world';
import { aPaidTerm } from '../../src/data/cultivation/what-a-cultivator-can-earn';
import { arterialsOf, provinceForRegion } from '../../src/data/cultivation/regions/provinces';
import { FOUNDATION_ORDINAL } from '../../src/engine/cultivation/realms';

describe('information from the running verbs', () => {
    it('does not learn an extinction by looking, but can read it at its standing', async () => {
        const { game, repos } = makeGame({ seed: 'extinction-reader' });
        const { cultivator } = await game.newRun('Reader');
        const herb = HERBS.find(row => EXTINCT_HERB_IDS.has(row.id))!;
        repos.cultivators.update(cultivator.id, { realmOrdinal: 0 });
        const low = await game.act(`I investigate ${herb.name}`);
        expect(low.narration).toContain('no account');
        expect(low.narration).not.toContain('no longer grows');
        expect(game.knowledge.isAwareOf(cultivator.id, 'thing', herb.id)).toBe(false);

        repos.cultivators.update(cultivator.id, { realmOrdinal: herb.harvestOrdinal });
        const informed = await game.act(`I investigate ${herb.name}`);
        expect(informed.narration).toContain('no longer grows');
        expect(informed.narration).not.toMatch(/Grows in|Market value/);
        expect(game.knowledge.isAwareOf(cultivator.id, 'thing', herb.id)).toBe(true);
    });

    it('refuses a lost medicine without spending, and gates the ingredient history', async () => {
        const { game, repos } = makeGame({ seed: 'lost-formula-reader' });
        const { cultivator } = await game.newRun('Refiner');
        const pill = getPill('pill-immortal-longevity')!;
        const missing = HERBS.find(row => row.id === 'herb-thousand-autumn-chrysanthemum')!;
        repos.cultivators.update(cultivator.id, { realmOrdinal: 0 });
        const before = game.currentRun();
        await game.act(`I investigate ${pill.name}`);
        const low = await game.act(`I refine ${pill.name}`);
        expect(low.toolCalls.some(call => call.action === 'refine' && !call.ok)).toBe(true);
        expect(low.narration).toContain('no formula');
        expect(low.narration).not.toContain(missing.name);
        expect(game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        expect(game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);

        repos.cultivators.update(cultivator.id, { realmOrdinal: missing.harvestOrdinal });
        const highBefore = game.currentRun();
        const high = await game.act(`I refine ${pill.name}`);
        expect(high.toolCalls.some(call => call.action === 'refine' && !call.ok)).toBe(true);
        expect(high.narration).toContain(missing.name);
        expect(high.narration).toContain('no longer grows');
        expect(game.currentRun().run.elapsedDays).toBe(highBefore.run.elapsedDays);
        expect(game.currentRun().cultivator.spiritStones).toBe(highBefore.cultivator.spiritStones);
    });

    it('hears regional accounts and contract terms through the existing speaker gate', async () => {
        const harness = await makeGameInWorld({ seed: 'local-mechanics', worldSeed: 'local-mechanics-world' });
        const { game, repos } = harness;
        const { cultivator } = await game.newRun('Listener');
        await standWhereThePeopleAre(harness, cultivator.id);
        const here = game.present(game.currentRun().cultivator)[0];
        expect(here).toBeDefined();
        const { run, cultivator: listener } = game.currentRun();
        const scope = game.scopeFor(listener);
        const speaker = { ...here, realmOrdinal: 0, sectId: null, sectName: null, sectRank: null };
        const ask = (topic: string, ordinal: number, location: string | null = speaker.location) =>
            game.askAround(run, listener, { ...speaker, realmOrdinal: ordinal, location }, topic, scope).facts.lines.join(' ');
        const forbidden = TRADITION_WAR.trueAccount;
        for (const [regionId, account] of [
            ['region-low-fall', TRADITION_WAR.lowFallAccount],
            ['region-quiet-marches', TRADITION_WAR.marchesAccount]
        ] as const) {
            const province = game.atHand!.locations.find(row => row.kind === 'region' && row.data.catalogRegionId === regionId)!;
            expect(province).toBeDefined();
            const said = ask('tradition war', 0, province.name);
            expect(said).toContain(account);
            expect(said).not.toContain(forbidden);
        }
        expect(ask('beast contract', 0)).not.toContain('penalty clause');
        const terms = ask('beast contract', BEAST_CHANGE_ORDINAL);
        expect(terms).toContain('two parties');
        expect(terms).toContain('witness');
        const price = PRICES.find(row => row.id === 'price-clear-meridian-pill')!;
        const term = aPaidTerm('contract-beast-culler')!;
        const quotation = game.askAround(run, listener, { ...speaker, realmOrdinal: term.minOrdinal },
            `afford ${price.name} on ${term.name} earnings`, scope);
        const earnings = quotation.facts.lines.join(' ');
        expect(earnings).toContain(`${Number((price.cash / term.cashPerMonth).toFixed(1))} months`);
        expect(earnings).toContain('before food and lodging');
        expect(quotation.facts.structure.join(' ')).toContain('Known by being told:');
        const ground = game.atHand!.locations.find(row => row.kind === 'region'
            && row.data.catalogRegionId === 'region-low-fall')!;
        const artery = arterialsOf(provinceForRegion('region-low-fall')!.id)[0];
        expect(ask('arterials', 0, ground.name)).not.toContain(artery.name);
        expect(ask('arterials', FOUNDATION_ORDINAL, ground.name)).toContain(artery.name);
        const distant = game.atHand!.locations.find(row => row.kind === 'region'
            && row.data.catalogRegionId === 'region-quiet-marches')!;
        expect(ask('arterials', FOUNDATION_ORDINAL, distant.name)).not.toContain(artery.name);
        // Hearing terms changes knowledge, never a cultivation relationship.
        expect(repos.cultivators.getById(listener.id)!.realmOrdinal).toBe(listener.realmOrdinal);
    }, 180_000);

    it('hands the storyteller the claim-source instructions during narration', async () => {
        const provider = new ScriptedProvider({ narrations: ['The square is occupied.'] });
        const { game } = makeGame({ provider, seed: 'claim-source-prompt' });
        await game.newRun('Reader');
        const sent = provider.calls.flatMap(call => call.messages)
            .filter(message => message.role === 'system').map(message => message.content).join('\n');
        expect(sent).toContain('told: Attribute it.');
        expect(sent).toContain('perceived: Describe what they can perceive.');
    });

    it('explains the uncertainty in placing a foreign title', async () => {
        const { game } = makeGame({ seed: 'foreign-title-reader' });
        await game.newRun('Reader');
        const read = await game.act('I investigate Standing Cut');
        expect(read.narration).toContain('placer');
        expect(read.narration).toContain('one in six');
    });
});

describe('public ground and recorded receipts', () => {
    it('shows the recorded deference core without opening its private holdings', () => {
        const holding = DEFERENCE_HOLDINGS[0];
        const read = whatAHouseHasToItsName({ world: null, house: null,
            factionId: holding.factionId, houseName: 'The house', readerOrdinal: 0, today: 0 });
        expect(read.lines.join(' ')).toContain(holding.administeredCore);
        expect(read.lines.join(' ')).toContain('border');
        expect(read.stones).toBeNull();
        expect(read.things).toEqual([]);
    });

    it('attributes receipt figures to the history and keeps them past the public gate', () => {
        const receipt = RECEIPT_HISTORIES.find(row => row.countedByTheRegisters && getLineageStanding(row.factionId))!;
        expect(receipt).toBeDefined();
        const read = (readerOrdinal: number) => whoStandsBehindThem({ factionId: receipt.factionId,
            houseName: 'The recorded house', readerOrdinal }).lines.join(' ');
        expect(read(0)).not.toContain('receipt history');
        expect(read(35)).toContain('when the history was written');
        expect(read(35)).toContain('Private holdings outside their records are not counted');
    });
});
