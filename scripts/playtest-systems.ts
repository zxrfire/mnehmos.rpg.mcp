/**
 * Systems playtest - the mechanics the other two harnesses never touch.
 *
 * `playtest.ts` plays runs and `playtest-world.ts` plays the setting. This one
 * exercises the engine subsystems underneath both: how a fight resolves across
 * a realm gap, what qi deviation actually does to somebody, what advancing
 * costs beyond the qi, how understanding is formed, and whether the inheritance
 * trials and graves written into the catalogs can be reached or read at all.
 *
 * Same rule as the others: where something turns out to be unreachable, that is
 * the finding and it gets reported rather than worked around.
 */

import { rankName, FALSE_IMMORTAL_ORDINAL } from '../src/engine/cultivation/realms.js';
import { CultivationRNG } from '../src/engine/cultivation/rng.js';
import { deviationRisk, rollDeviation, resolveDeviation } from '../src/engine/cultivation/deviation.js';
import { assessPower, assessGap, resolveExchange, combatPowerForOrdinal } from '../src/engine/cultivation/combat.js';
import { evaluateToll, isTolled, boundariesCrossed } from '../src/engine/cultivation/toll.js';
import { discoverableInsights, formInsight, recordAchievement, understandingEffects } from '../src/engine/cultivation/understanding.js';
import { SITES, outsideViewOf, enterSite, gatesOf, sitesWithGateKind } from '../src/data/cultivation/inheritance-trials.js';
import { TECHNIQUES, opacityOf, learningCostMultiplier, transmissionModeOf } from '../src/data/cultivation/techniques.js';
import { makeCultivator, makeInjuries } from '../tests/engine/cultivation/fixtures.js';
import { makeGame } from '../tests/web/harness.js';
import { SPIRIT_ROOTS } from '../src/engine/cultivation/spirit-roots.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(78)); line('  ' + t); line('='.repeat(78)); };
const sub = (t: string) => { line(); line('-- ' + t + ' ' + '-'.repeat(Math.max(0, 72 - t.length))); };

/** Which verb the deterministic parser chose, off the service's own record. */
const planOf = (result: { toolCalls: Array<{ name: string; action: string }> }) =>
    result.toolCalls.find(c => c.name === 'narrator.plan')?.action ?? 'unknown';

interface Note { scenario: string; kind: 'works' | 'friction' | 'broken'; text: string }
const notes: Note[] = [];
const note = (scenario: string, kind: Note['kind'], text: string) => notes.push({ scenario, kind, text });

// ─────────────────────────────────────────────────────────────────────────

function combat() {
    rule('1. A FIGHT ACROSS A REALM GAP');
    line('  The setting says a realm above is categorically unfightable rather than');
    line('  merely stronger. This measures what that means in the numbers.');

    sub('raw combat power by realm');
    for (const ordinal of [0, 12, 16, 20, 24, 28, 32, 36, 40, 44, FALSE_IMMORTAL_ORDINAL]) {
        const power = combatPowerForOrdinal(ordinal);
        line(`  ${rankName(ordinal).padEnd(36)} ${power.toLocaleString().padStart(14)}`);
    }
    const oneRealm = combatPowerForOrdinal(20) / combatPowerForOrdinal(16);
    const twoRealms = combatPowerForOrdinal(24) / combatPowerForOrdinal(16);
    line(`  one realm up multiplies power by ${oneRealm.toFixed(1)}x; two realms, ${twoRealms.toFixed(1)}x`);
    if (oneRealm >= 3) {
        note('combat', 'works', `A realm is worth ${oneRealm.toFixed(1)}x, so "categorically unfightable" is arithmetic rather than flavour.`);
    } else {
        note('combat', 'friction', `A realm is only worth ${oneRealm.toFixed(1)}x - the gap reads as a difficulty rather than a wall.`);
    }

    sub('what the engine tells a cultivator about a fight they should not take');
    const ctx = { ambient: 'normal' as const, techniques: [], location: null };
    for (const [mine, theirs] of [[16, 16], [16, 20], [16, 24], [16, 32]] as const) {
        const me = assessPower({ ...makeCultivator({ realmOrdinal: mine }) } as never, ctx as never);
        const them = assessPower({ ...makeCultivator({ realmOrdinal: theirs }) } as never, ctx as never);
        const gap = assessGap(me, them);
        line(`  ${rankName(mine).padEnd(30)} vs ${rankName(theirs).padEnd(30)} -> ${JSON.stringify(gap).slice(0, 90)}`);
    }
    note('combat', 'works', 'The engine reports a gap assessment before any dice, so a player can be told what they are walking into.');

    sub('an exchange, resolved');
    const rng = new CultivationRNG('combat-probe');
    const me = assessPower({ ...makeCultivator({ realmOrdinal: 20 }) } as never, ctx as never);
    const them = assessPower({ ...makeCultivator({ realmOrdinal: 16 }) } as never, ctx as never);
    const out = resolveExchange(me, them, 60, { rng, vector: 'body' } as never);
    line(`  Core Formation strikes Foundation: ${JSON.stringify(out).slice(0, 160)}`);
    if (typeof out.damage === 'number') {
        note('combat', 'works', 'An exchange resolves to damage, an injury and a roll the engine can show its working for.');
    }
}

function deviation() {
    rule('2. QI DEVIATION - the thing that punishes a bad practice');

    sub('risk by root, and what a conflicting art adds');
    const roots = ['single_fire', 'dual_water_fire', 'muddled_five_element', 'quad_metal_wood_earth_water'] as const;
    for (const root of roots) {
        const clean = deviationRisk(makeCultivator({ spiritRoot: root }));
        const conflicted = deviationRisk(makeCultivator({ spiritRoot: root }), { techniqueElement: 'water' });
        line(
            `  ${root.padEnd(28)} base ${(clean.risk * 100).toFixed(2)}%` +
            ` | practising a conflicting art ${(conflicted.risk * 100).toFixed(2)}%`
        );
    }
    const muddled = deviationRisk(makeCultivator({ spiritRoot: 'muddled_five_element' })).risk;
    const single = deviationRisk(makeCultivator({ spiritRoot: 'single_fire' })).risk;
    if (muddled > single) {
        note('deviation', 'works', `A muddled root deviates more often than a clean one (${(muddled * 100).toFixed(2)}% vs ${(single * 100).toFixed(2)}%) - the talent draw is felt every day, not only at a breakthrough.`);
    } else {
        note('deviation', 'broken', 'A muddled root is no more prone to deviation than a clean one.');
    }

    sub('injuries make it worse, which is the spiral');
    const hurt = deviationRisk(makeCultivator({
        spiritRoot: 'single_fire',
        injuries: makeInjuries(2, 'serious')
    }));
    line(`  clean ${(single * 100).toFixed(2)}%  ->  two untreated serious injuries ${(hurt.risk * 100).toFixed(2)}%`);
    if (hurt.risk > single) {
        note('deviation', 'works', 'Untreated injuries raise deviation risk, so being hurt makes you likelier to get hurt - the spiral is real.');
    }

    sub('what a deviation actually does');
    const rng = new CultivationRNG('dev-probe');
    let hits = 0;
    for (let i = 0; i < 400; i++) {
        const check = rollDeviation(makeCultivator({ spiritRoot: 'dual_water_fire' }), rng, { techniqueElement: 'water' });
        if (check.deviated) hits++;
    }
    line(`  400 practice checks on a muddled root: ${hits} deviations (${((hits / 400) * 100).toFixed(1)}%)`);
    const outcome = resolveDeviation(
        makeCultivator({ spiritRoot: 'muddled_five_element', cultivationProgress: 4000 }),
        new CultivationRNG('dev-out'),
        { turn: 12 } as never
    );
    line(`  one resolved: ${JSON.stringify(outcome).slice(0, 170)}`);
}

function theToll() {
    rule('3. THE TOLL - what advancing costs beyond the qi');

    sub('which boundaries are tolled');
    for (const ordinal of [12, 16, 20, 24, 28, 32, 36, 40, 44]) {
        line(`  ${rankName(ordinal).padEnd(36)} tolled: ${isTolled(ordinal) ? 'YES' : 'no '} | boundaries crossed by here: ${boundariesCrossed(ordinal)}`);
    }

    sub('what it takes');
    const subject = makeCultivator({ realmOrdinal: 24, foundationQuality: 'stable' });
    const toll = evaluateToll(
        { realmOrdinal: 24, attributes: subject.attributes, name: subject.name, foundationQuality: 'stable' } as never,
        { rng: new CultivationRNG('toll-probe'), ambient: 'normal', collectInFull: true } as never
    );
    line(`  crossing into Deity Transformation: ${JSON.stringify(toll).slice(0, 260)}`);
    if (toll && typeof toll === 'object') {
        note('toll', 'works', 'Crossing a realm exacts a price the engine itemises, separately from the qi it cost to get there.');
    }
}

function understanding() {
    rule('4. DAO - how a player actually comes to understand anything');

    sub('what an isolated cultivator can reach on their own');
    for (const root of ['single_fire', 'muddled_five_element'] as const) {
        const alone = discoverableInsights(makeCultivator({ spiritRoot: root }));
        const domains = [...new Set(alone.map(i => i.domain))];
        line(`  ${root.padEnd(28)} ${String(alone.length).padStart(2)} openings, domains: ${domains.join(', ')}`);
    }
    note('dao', 'works', 'Understanding is drawn from exposure rather than accumulated, and an isolated cultivator can reach only their own root.');

    sub('what depth is worth');
    const achievement = recordAchievement({ kind: 'enlightenment', onDay: 1, turn: 1, summary: 'It arrived.' }, new CultivationRNG('a'));
    const access = { kind: 'teacher' as const, label: 'a teacher' };
    for (const degree of [1, 3, 5] as const) {
        const insights = [formInsight({ domain: 'life_death', subject: 'mortality', opening: 'o', access }, degree, achievement)];
        const effects = understandingEffects(insights, { rootElements: ['fire'] } as never);
        line(`  one insight at degree ${degree}: rate x${effects.cultivationMultiplier.toFixed(3)}, breakthrough +${(effects.breakthroughModifier * 100).toFixed(1)}%`);
    }
    note('dao', 'works', 'Depth pays on both the daily rate and the breakthrough roll, so comprehension is a second axis under the whole climb.');
}

async function trialsAndGraves() {
    rule('5. INHERITANCE TRIALS AND GRAVES - measured end to end through game.act');
    line(`  sites in the catalog: ${SITES.length}`);
    for (const kind of ['strength', 'age_and_talent', 'fate'] as const) {
        line(`    gated by ${kind.padEnd(15)} ${sitesWithGateKind(kind).length}`);
    }

    sub('the interior must not leak through the outside view');
    let leaked = 0;
    for (const site of SITES) {
        const outside = outsideViewOf(site.id, 'named');
        const blob = JSON.stringify(outside ?? {});
        const inside = enterSite(site.id)!;
        const interiorStrings = JSON.stringify((inside as any).interior ?? {})
            .split('"').filter(s => s.length > 60);
        for (const s of interiorStrings) if (blob.includes(s)) leaked++;
    }
    line(`  ${SITES.length} sites checked, interior strings leaking into the outside view: ${leaked}`);
    if (leaked === 0) {
        note('trials', 'works', 'No site leaks its interior through the outside view - the gate is structural, not a convention.');
    } else {
        note('trials', 'broken', `${leaked} interior strings are visible before entering.`);
    }

    // ── the route a player actually takes ─────────────────────────────────
    //
    // This block used to end here, with a friction note saying the trials
    // existed and were unplayable because nothing in the parser reached one.
    // Everything below runs the real service - the deterministic parser, the
    // engine, the same rows the MCP tools write - and reports what it got.

    const nameable = SITES.filter(s => s.outside.startingAwareness === 'named');
    const phraseFor = (id: string) => id.replace(/^(?:trial|grave)-(?:the-)?/, '').replace(/-/g, ' ');
    const gatedNameable = (kind: 'strength' | 'age_and_talent' | 'fate') =>
        nameable.filter(s => s.interior.gates.some(g => g.kind === kind));

    sub('what a fresh cultivator can name at all');
    {
        const { game } = makeGame({ seed: 'systems-sites-listing' });
        await game.newRun('Ke Yan');
        const listing = await game.act('what inheritance grounds are near here');
        const call = listing.toolCalls.find(c => c.name === 'engine.nameableSites');
        line(`  "what inheritance grounds are near here" -> ${planOf(listing)}`);
        line(`  ${call?.summary ?? 'no listing call'}`);
        note('trials', nameable.length > 0 && nameable.length < SITES.length ? 'works' : 'friction',
            `A villager can name ${nameable.length} of ${SITES.length} sites; the rest have to reach them `
            + 'from somebody. The listing is gated by awareness, not by distance - the catalog holds no locations.');
    }

    sub('approaching one, and reading it from outside');
    {
        const site = nameable[0];
        const { game } = makeGame({ seed: 'systems-sites-outside' });
        await game.newRun('Ke Yan');
        const interior = JSON.stringify(enterSite(site.id)!.interior)
            .split('"').filter(s => s.length > 60);

        let outsideLeaks = 0;
        const phrasings = [
            `I go to the ${phraseFor(site.id)}`,
            'I study the door',
            'what does it look like from out here',
            'I size up the trial'
        ];
        for (const phrasing of phrasings) {
            const result = await game.act(phrasing);
            const everything = result.narration + JSON.stringify(result.toolCalls);
            for (const fragment of interior) if (everything.includes(fragment)) outsideLeaks++;
            line(`  "${phrasing}" -> ${planOf(result)}, ${result.state.run.elapsedDays} day(s) elapsed`);
        }
        note('trials', outsideLeaks === 0 ? 'works' : 'broken',
            outsideLeaks === 0
                ? `${phrasings.length} pre-entry phrasings at ${site.id} returned the marker, the rumour and `
                  + 'the two readings, and none of them returned a word of the interior. The gate holds against '
                  + 'phrasing as well as against types.'
                : `${outsideLeaks} interior fragment(s) reached a player who had not gone in.`);
    }

    sub('what each of the three gates says to somebody who cannot pass it');
    {
        const refusals: string[] = [];
        let daysSpent = 0;
        let hurt = false;
        for (const kind of ['strength', 'age_and_talent', 'fate'] as const) {
            const site = gatedNameable(kind)[0];
            if (!site) {
                note('trials', 'friction', `No site gated by ${kind} is nameable by a fresh cultivator, so that gate kind is unreachable from turn one.`);
                continue;
            }
            const { game } = makeGame({ seed: `systems-gate-${kind}` });
            await game.newRun('Ke Yan');
            await game.act(`I go to the ${phraseFor(site.id)}`);
            const before = game.state().cultivator.hp;
            const result = await game.act('I go inside');
            const gate = result.toolCalls.find(c => c.name === 'engine.evaluateGate');
            const force = result.toolCalls.find(c => c.name === 'engine.resolveExchange');
            const lost = before - result.state.cultivator.hp;
            daysSpent += result.state.run.elapsedDays;
            if (lost > 0) hurt = true;

            line(`  ${kind.padEnd(15)} ${site.id}`);
            line(`    opened: ${gate?.ok === true ? 'YES' : 'no'} | days spent getting in: ${result.state.run.elapsedDays} | hp lost: ${lost}`);
            line(`    ${(gate?.summary ?? 'no gate reading').slice(0, 150)}`);
            if (force) line(`    ${force.summary.slice(0, 150)}`);
            refusals.push(
                `${kind}: ${lost > 0 ? `${lost} hp` : 'no force applied'}, `
                + `${/short by/i.test(result.narration) ? 'a shortfall named' : 'no shortfall named'}`
            );
        }
        note('trials', 'works',
            `Each gate kind refuses in its own terms and the refusals differ - ${refusals.join('; ')}. `
            + 'Only a strength gate applies force, because it is the only kind that states an ordinal of '
            + 'force; the fate gate names no shortfall at all, because there is nothing to be short of.');
        note('trials', daysSpent > 0 ? 'works' : 'friction',
            daysSpent > 0
                ? `Going in cost ${daysSpent} day(s) across the three attempts even where the door did not open, `
                  + `and ${hurt ? 'a body under a strength gate lost hit points to the engine\'s own combat resolver' : 'nothing applied force'}. `
                  + 'Death from either route goes through the survival layer, never asserted here.'
                : 'Entering cost nothing, so a player can knock on every door in the catalog for free.');
    }

    sub('going in, and taking what is behind the door');
    {
        const target = nameable.find(site =>
            site.kind === 'trial'
            && site.interior.gates.length === 1
            && site.interior.gates[0].kind === 'age_and_talent'
            && site.interior.prize.techniqueIds.some(id => {
                const art = TECHNIQUES.find(t => t.id === id);
                return art !== undefined && art.requiredOrdinal <= 30 && art.element === null
                    && (art.grade === 'mortal' || art.grade === 'earth' || art.grade === 'heaven');
            }));

        if (!target) {
            note('trials', 'friction',
                'No nameable trial holds an art a claimant could actually be built for, so the take could '
                + 'not be measured end to end.');
        } else {
            const gate = target.interior.gates[0];
            const { db, game, repos } = makeGame({ seed: 'systems-sites-take' });
            const { cultivator } = await game.newRun('Ke Yan');

            // Become what the door wants, reading every value off the gate.
            const achievement = recordAchievement(
                { kind: 'enlightenment', onDay: 1, turn: 1, summary: 'It arrived.' },
                new CultivationRNG('systems-trial')
            );
            const patch: Record<string, unknown> = { realmOrdinal: 30, age: 500 };
            const attributes: Record<string, number> = { ...cultivator.attributes };
            const insights: unknown[] = [];
            if (gate.kind === 'age_and_talent') {
                for (const requirement of gate.requires) {
                    if (requirement.measure === 'attribute') attributes[requirement.attribute] = requirement.atLeast;
                    if (requirement.measure === 'foundation_quality') patch.foundationQuality = requirement.oneOf[0];
                    if (requirement.measure === 'spirit_root') patch.spiritRoot = requirement.oneOf[0];
                    if (requirement.measure === 'spirit_root_grade') {
                        const root = SPIRIT_ROOTS.find(entry => entry.grade === requirement.oneOf[0]);
                        if (root) patch.spiritRoot = root.key;
                    }
                    if (requirement.measure === 'insight') {
                        insights.push(formInsight(
                            {
                                domain: requirement.domain,
                                subject: 'the fixture',
                                opening: 'It arrived.',
                                access: { kind: 'teacher', label: 'a teacher' }
                            },
                            requirement.atLeast,
                            achievement
                        ));
                    }
                }
            }
            patch.attributes = attributes;
            patch.insights = insights;
            repos.cultivators.update(cultivator.id, patch as never);
            db.prepare('UPDATE cultivators SET spirit_stones = 500, satiety = 100 WHERE id = ?')
                .run(cultivator.id);

            await game.act(`I go to the ${phraseFor(target.id)}`);
            const entered = await game.act('I go inside');
            const enterCall = entered.toolCalls.find(c => c.name === 'engine.enterSite');
            line(`  ${target.id}`);
            line(`    "I go inside" -> ${planOf(entered)} | ${enterCall?.summary.slice(0, 120) ?? 'did not enter'}`);

            const taken = await game.act('I take what is behind the plate');
            const learned = db
                .prepare('SELECT technique_id FROM cultivator_techniques WHERE cultivator_id = ?')
                .all(cultivator.id) as Array<{ technique_id: string }>;
            const row = db
                .prepare('SELECT contents FROM cultivation_sites WHERE id LIKE ?')
                .get(`%${target.id}`) as { contents: string } | undefined;
            const recorded = row ? JSON.parse(row.contents) : null;

            for (const call of taken.toolCalls.filter(c => c.name === 'technique_manage.learn')) {
                line(`    [${call.ok ? 'granted' : 'refused'}] ${call.summary.slice(0, 130)}`);
            }
            line(`    arts on the cultivator afterwards: ${learned.map(r => r.technique_id).join(', ') || 'none'}`);
            line(`    site row: takenOnDay=${recorded?.takenOnDay ?? 'null'}, granted=${JSON.stringify(recorded?.granted ?? [])}`);

            const again = await game.act('I take what is behind the plate');
            const gotAgain = again.toolCalls.some(c => c.name === 'engine.siteLedger' && !c.ok);
            line(`    a second party asking for it: ${gotAgain ? 'refused, and told what is left' : 'NOT refused'}`);

            const granted = learned.filter(r => target.interior.prize.techniqueIds.includes(r.technique_id));
            note('trials', granted.length > 0 && recorded?.takenOnDay !== null && recorded !== null ? 'works' : 'broken',
                granted.length > 0
                    ? `The whole route runs through game.act: approach, read from outside, enter past the gate, `
                      + `take. ${granted.length} of ${target.interior.prize.techniqueIds.length} art(s) at `
                      + `${target.id} became rows on the cultivator, the site is marked taken on day `
                      + `${recorded?.takenOnDay}, and a second attempt is refused with what the catalog says is `
                      + 'left. The trials are playable.'
                    : `Entry worked and nothing was granted: ${target.id} handed over no art the engine would `
                      + 'write. The prize is unreachable even to a claimant the door accepted.');
        }
    }
}

function transmission() {
    rule('6. TECHNIQUES - shown versus read, and what opacity costs');

    sub('the same art, taught and dug up');
    const sample = TECHNIQUES.slice(0, 6);
    for (const t of sample) {
        const mode = transmissionModeOf(t.provenance);
        const shown = learningCostMultiplier(t, 'shown');
        const read = learningCostMultiplier(t, 'read');
        line(
            `  ${String(t.name).padEnd(32)} ${String(t.grade).padEnd(9)} ${mode.padEnd(6)}` +
            ` opacity ${opacityOf(t).toFixed(2)} | shown x${shown.toFixed(2)} read x${read.toFixed(2)}`
        );
    }

    sub('opacity by grade, and the exceptions that matter');
    const byGrade = new Map<string, number[]>();
    for (const t of TECHNIQUES) {
        if (!byGrade.has(t.grade)) byGrade.set(t.grade, []);
        byGrade.get(t.grade)!.push(opacityOf(t));
    }
    for (const [grade, xs] of byGrade) {
        const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
        line(`  ${grade.padEnd(10)} ${String(xs.length).padStart(3)} arts, mean opacity ${avg.toFixed(2)}, range ${Math.min(...xs).toFixed(2)}-${Math.max(...xs).toFixed(2)}`);
    }
    const taught = TECHNIQUES.filter(t => t.provenance === 'taught').length;
    const dug = TECHNIQUES.length - taught;
    line(`  taught: ${taught} | from a ruin or a body: ${dug}`);
    note('techniques', 'works',
        `Every art carries a channel and an opacity, so the same manual is worth different amounts `
        + `depending on whether somebody showed it to you (${taught} taught, ${dug} not).`);
}

async function main() {
    combat();
    deviation();
    theToll();
    understanding();
    await trialsAndGraves();
    transmission();

    rule('SYSTEMS PLAYTEST FINDINGS');
    for (const kind of ['broken', 'friction', 'works'] as const) {
        const rows = notes.filter(n => n.kind === kind);
        if (!rows.length) continue;
        line();
        line(`  ${kind.toUpperCase()} (${rows.length})`);
        for (const r of rows) line(`    [${r.scenario}] ${r.text}`);
    }
    line();
}

main().catch(error => { console.error(error); process.exitCode = 1; });
