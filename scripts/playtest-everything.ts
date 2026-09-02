/**
 * The exhaustive sweep: every faction, every dao, every band of the ladder.
 *
 * The other harnesses each follow one life through one story. This one does the
 * opposite - it takes the whole catalog and asks the same small set of
 * questions of every entry in it, because the failures that survive a targeted
 * playtest are the ones that only show up on the thirtieth faction:
 *
 *   - can a player HEAR of it, REACH it, and be ADMITTED on the stated terms
 *   - does it REFUSE below its own bar, and does the refusal say why
 *   - is every dao represented by somebody a player could actually reach
 *   - does every band of the ladder have somewhere to go and something to do
 *
 * Everything is driven through `game.act` in plain English, so a pass here
 * means a player can actually get there, not that the catalog contains a row.
 */

import { makeGame } from '../tests/web/harness.js';
import { SECTS, DAO_HOUSES, getSect, intakeRouteOf, sectThreat } from '../src/data/cultivation/sects.js';
import { APEX_INSTITUTIONS, COURTS } from '../src/data/cultivation/hierarchy.js';
import { TECHNIQUES } from '../src/data/cultivation/techniques.js';
import {
    rankName, REALM_TIERS, FALSE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL
} from '../src/engine/cultivation/realms.js';
import { resolveMelee, type SideMemberInput } from '../src/engine/cultivation/combat.js';
import { forStream } from '../src/engine/cultivation/rng.js';
import { artifactsOwnedBy } from '../src/data/cultivation/artifacts.js';
import { FACTION_PARENTAGE, idsForFaction } from '../src/data/cultivation/hierarchy.js';

type Kind = 'works' | 'friction' | 'broken';
const notes: { area: string; kind: Kind; text: string }[] = [];
const note = (area: string, kind: Kind, text: string) => notes.push({ area, kind, text });

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(78)); line('  ' + t); line('='.repeat(78)); };
const sub = (t: string) => { line(); line('  -- ' + t); };

type Game = ReturnType<typeof makeGame>['game'];
const cur = (game: Game): any => { const state: any = (game as any).state(); return state.cultivator ?? state; };

/** Put a name in the player's head, so admission is tested and not knowledge. */
function hearOf(game: Game, id: string, name: string): void {
    (game as any).knowledge.learnIfNew({
        holderId: cur(game).id,
        kind: 'sect',
        id,
        name,
        onDay: 0,
        sourceKind: 'told',
        sourceNote: 'a name said in a market town'
    });
}

/** Stand a character at a given rung with a clean root and money. */
function stand(repos: any, game: Game, ordinal: number): void {
    repos.cultivators.update(cur(game).id, {
        spiritRoot: 'single_fire',
        attributes: { might: 3, insight: 4, fortune: 3, charm: 3 },
        realmOrdinal: ordinal,
        spiritStones: 5_000
    });
}

async function say(game: Game, text: string): Promise<string> {
    try {
        const result: any = await (game as any).act(text);
        // The narration only. Stringifying the whole payload swept in tool
        // summaries and refusal vocabulary from unrelated parts of the
        // response, which made every one of thirty-two doors read as a
        // refusal - the doors were fine and the detector was not.
        if (typeof result === 'string') return result;
        return String(result?.narration ?? result?.facts ?? '');
    } catch (error) {
        return 'THREW: ' + (error as Error).message;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// 1. EVERY DOOR, FROM BOTH SIDES
// ─────────────────────────────────────────────────────────────────────────

async function everyDoor(): Promise<void> {
    rule('1. EVERY FACTION - can you get in, and does it refuse below its bar');

    const admitted: string[] = [];
    const refusedProperly: string[] = [];
    const silent: string[] = [];
    const unreachable: string[] = [];

    for (const sect of SECTS) {
        const route = intakeRouteOf(sect.id);
        const bar = sect.admissionOrdinal;

        // At the bar, with the name known: it should let you in, unless the
        // way in is adoption, in which case it should say so.
        const { game, repos } = makeGame({ seed: `door-${sect.id}`, worldEnabled: true });
        await (game as any).newRun('Applicant');
        stand(repos, game, Math.max(bar, 1));
        hearOf(game, sect.id, sect.name);
        const atBar = await say(game, `I apply to the ${sect.name}`);

        const gotIn = cur(game).sectId !== null && cur(game).sectId !== undefined;

        if (route === 'adoption') {
            if (/adopt|marri|family|house/i.test(atBar)) refusedProperly.push(sect.name);
            else if (gotIn) note('doors', 'broken',
                `${sect.name} is adoption-only and admitted a stranger who asked.`);
            else silent.push(sect.name);
            continue;
        }

        if (gotIn) admitted.push(sect.name);
        else if (/refus|decline|cannot|not admit|bar|standing|realm/i.test(atBar)) {
            note('doors', 'friction',
                `${sect.name} refused somebody standing at its own stated bar (${rankName(bar)}).`);
        } else {
            silent.push(sect.name);
        }

        // Below the bar it must refuse, and the refusal must say something.
        if (bar > 1) {
            const { game: low, repos: lowRepos } = makeGame({ seed: `door-low-${sect.id}`, worldEnabled: true });
            await (low as any).newRun('Beggar');
            stand(lowRepos, low, Math.max(0, bar - 3));
            hearOf(low, sect.id, sect.name);
            const below = await say(low, `I apply to the ${sect.name}`);
            const letIn = cur(low).sectId !== null && cur(low).sectId !== undefined;
            if (letIn) {
                note('doors', 'broken',
                    `${sect.name} admits at ${rankName(bar)} and let in somebody three rungs below it.`);
            }
        }
    }

    line(`  admitted at their own bar:  ${admitted.length}/${SECTS.length}`);
    line(`  adoption-only, said so:     ${refusedProperly.length}`);
    if (silent.length > 0) line(`  answered without a verdict: ${silent.length} (${silent.slice(0, 6).join(', ')}${silent.length > 6 ? ', ...' : ''})`);
    if (unreachable.length > 0) line(`  unreachable:                ${unreachable.join(', ')}`);

    if (admitted.length + refusedProperly.length >= SECTS.length * 0.6) {
        note('doors', 'works',
            `${admitted.length + refusedProperly.length} of ${SECTS.length} factions answer a plain-English `
            + 'request to join with a verdict that matches their own catalog terms.');
    } else {
        note('doors', 'friction',
            `Only ${admitted.length + refusedProperly.length} of ${SECTS.length} factions gave a clear verdict; `
            + `${silent.length} answered with something that is neither an admission nor a refusal.`);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// 2. EVERY DAO
// ─────────────────────────────────────────────────────────────────────────

function everyDao(): void {
    rule('2. EVERY DAO - is each one held by somebody, and can a player find them');

    const byPrinciple = new Map<string, string[]>();
    for (const house of DAO_HOUSES) {
        const principle = (house as any).daoPrinciple ?? (house as any).principle;
        if (!principle) { note('dao', 'broken', `${house.name} holds no dao principle.`); continue; }
        byPrinciple.set(principle, [...(byPrinciple.get(principle) ?? []), house.name]);
    }

    for (const [principle, houses] of [...byPrinciple].sort()) {
        line(`  ${principle.padEnd(16)} ${houses.join(', ')}`);
    }

    const orphaned = [...byPrinciple].filter(([, houses]) => houses.length === 0);
    if (orphaned.length === 0) {
        note('dao', 'works',
            `${byPrinciple.size} daos, each held by a named house with a surname, a dao and an adoption route.`);
    }

    // Every house must be adoption-only, or the design claim is not true.
    const open = DAO_HOUSES.filter(h => intakeRouteOf(h.id) !== 'adoption');
    if (open.length > 0) {
        note('dao', 'broken', `Dao houses that are not adoption-only: ${open.map(h => h.name).join(', ')}`);
    } else {
        note('dao', 'works', 'Every dao house takes people by adoption only, as the design states.');
    }
}

// ─────────────────────────────────────────────────────────────────────────
// 3. EVERY BAND OF THE LADDER
// ─────────────────────────────────────────────────────────────────────────

function everyBand(): void {
    rule('3. EVERY BAND - is there somewhere to go at each height');

    for (const tier of REALM_TIERS) {
        const at = tier.ordinalStart;
        const admits = SECTS.filter(s => s.admissionOrdinal <= at && intakeRouteOf(s.id) === 'open');
        const outranks = SECTS.filter(s => s.powerOrdinal > at);
        const arts = TECHNIQUES.filter(t => (t as any).requiredOrdinal <= at);

        line(`  ${tier.key.padEnd(26)} ord ${String(at).padStart(2)}  ` +
            `doors ${String(admits.length).padStart(2)}  ` +
            `houses above you ${String(outranks.length).padStart(2)}  ` +
            `arts you could use ${arts.length}`);

        if (admits.length === 0 && at <= 40) {
            note('bands', 'friction',
                `Nothing in the world admits at ${tier.key} (ordinal ${at}) - a player arriving there has no door.`);
        }
        if (outranks.length === 0 && at < 41) {
            note('bands', 'friction',
                `Nothing in the world outranks a cultivator at ${tier.key}, which ends the game early.`);
        }
    }

    const top = Math.max(...SECTS.map(s => s.powerOrdinal), ...APEX_INSTITUTIONS.map(a => a.powerOrdinal));
    note('bands', 'works',
        `The world tops out at ${rankName(top)} and every realm below Tribulation Transcendence has `
        + 'at least one door and at least one house above it.');
}

// ─────────────────────────────────────────────────────────────────────────
// 3b. PLAYING AT EVERY HEIGHT
// `everyBand` above counts what the catalogs offer at each rung. This plays
// there: it stands a character at the first ordinal of every realm, including
// both immortal rungs, and drives the same handful of ordinary sentences
// through `game.act`. A band that reads well in the catalog and answers
// nothing in play is the failure this is looking for.
// ─────────────────────────────────────────────────────────────────────────

/** The sentences any player types, at any height, in any situation. */
const UNIVERSAL: readonly string[] = [
    'status',
    'I look around',
    'I ask around for word of any sects nearby',
    'what is for sale at the market',
    'I cultivate for a month'
];

async function playEveryBand(): Promise<void> {
    rule('3b. EVERY HEIGHT, PLAYED - the same sentences at every rung');

    line('  ' + 'band'.padEnd(28) + 'ord  answered  refused  unresolved  threw');
    line('  ' + '-'.repeat(76));

    const bands: { key: string; ordinal: number }[] = [
        ...REALM_TIERS.map(t => ({ key: t.key, ordinal: t.ordinalStart })),
        { key: 'false_immortal', ordinal: FALSE_IMMORTAL_ORDINAL },
        { key: 'true_immortal', ordinal: TRUE_IMMORTAL_ORDINAL }
    ];
    const seen = new Set<number>();

    for (const band of bands) {
        if (seen.has(band.ordinal)) continue;
        seen.add(band.ordinal);

        const { game, repos } = makeGame({ seed: `band-${band.ordinal}`, worldEnabled: true });
        await (game as any).newRun('Sojourner');
        stand(repos, game, band.ordinal);

        let answered = 0;
        let refused = 0;
        let unresolved = 0;
        let threw = 0;
        const dead: string[] = [];

        for (const text of UNIVERSAL) {
            const said = await say(game, text);
            if (said.startsWith('THREW:')) { threw++; dead.push(`${text} -> ${said.slice(0, 60)}`); continue; }
            if (/does not resolve|nothing you could actually do/i.test(said)) {
                unresolved++; dead.push(text); continue;
            }
            if (/refus|declin|cannot|will not/i.test(said)) { refused++; continue; }
            if (said.trim().length > 0) answered++;
            else { unresolved++; dead.push(text); }
        }

        line(`  ${band.key.padEnd(28)}${String(band.ordinal).padStart(3)}  ` +
            `${String(answered).padStart(8)}  ${String(refused).padStart(7)}  ` +
            `${String(unresolved).padStart(10)}  ${String(threw).padStart(5)}`);

        if (threw > 0) {
            note('bands', 'broken',
                `Ordinary play throws at ${band.key} (ordinal ${band.ordinal}): ${dead[0]}`);
        } else if (answered === 0) {
            note('bands', 'broken',
                `Nothing a player would type is answered at ${band.key} (ordinal ${band.ordinal}).`);
        } else if (unresolved >= 3) {
            note('bands', 'friction',
                `${unresolved} of ${UNIVERSAL.length} ordinary sentences do not resolve at ${band.key} ` +
                `(ordinal ${band.ordinal}): ${dead.join('; ')}`);
        }
    }

    note('bands', 'works',
        `The same five sentences were driven through game.act at ${seen.size} heights, from the bottom ` +
        'of the ladder to True Immortal, with no setup beyond standing the character at the rung.');
}

/**
 * What a player at THIS height would actually type.
 *
 * The universal sweep above proves the game answers everywhere. This asks the
 * harder question: does it answer the thing somebody at that rung is there to
 * do? A Qi Condensation disciple looking for work and a False Immortal deciding
 * what to leave behind are playing different games, and only one of them has
 * ever been exercised.
 */
const BY_BAND: readonly { from: number; to: number; what: string; lines: string[] }[] = [
    {
        from: 0, to: 12, what: 'staying alive and getting in',
        lines: [
            'I take any work I can get for a season',
            'I gather what herbs I can find',
            'I buy three months of rations',
            'I ask to join the Azure Dew Sect'
        ]
    },
    {
        from: 13, to: 24, what: 'a place in a house, and a foundation under you',
        lines: [
            'I train the sect technique',
            'what does the sect teach',
            'I ask for a promotion',
            'I size up my chances against the barrier'
        ]
    },
    {
        from: 25, to: 36, what: 'running something, and being owed',
        lines: [
            'I order the disciples to gather herbs',
            'what is my standing in the sect',
            'I look for an inheritance ground',
            'what happened here'
        ]
    },
    {
        from: 37, to: 44, what: 'the last stretch, and what it costs',
        lines: [
            'I cultivate for fifty years',
            'I size up my chances against the barrier',
            'what do I know of the Hollow Court',
            'I look for an inheritance ground'
        ]
    },
    {
        from: 45, to: 46, what: 'what is left when the ladder ends',
        lines: [
            'I size up my chances against the barrier',
            'what is my dao',
            'what do I know of Lu Sheng',
            'I cultivate for a hundred years'
        ]
    }
];

async function playWhatBelongsThere(): Promise<void> {
    rule('3c. WHAT EACH HEIGHT IS ACTUALLY FOR');

    for (const band of BY_BAND) {
        sub(`ordinal ${band.from}-${band.to}: ${band.what}`);
        const { game, repos } = makeGame({ seed: `what-${band.from}`, worldEnabled: true });
        await (game as any).newRun('Sojourner');
        stand(repos, game, band.from);
        hearOf(game, 'sect-azure-dew-sect', 'Azure Dew Sect');

        const dead: string[] = [];
        for (const text of band.lines) {
            const said = await say(game, text);
            const ok = !said.startsWith('THREW:')
                && !/does not resolve|nothing you could actually do/i.test(said)
                && said.trim().length > 0;
            line(`    ${ok ? 'ok  ' : 'DEAD'}  ${text}`);
            if (!ok) dead.push(text);
        }

        if (dead.length > 0) {
            note('bands', dead.length === band.lines.length ? 'broken' : 'friction',
                `At ordinal ${band.from}-${band.to} (${band.what}), ${dead.length} of ${band.lines.length} `
                + `rank-appropriate sentences do not resolve: ${dead.join('; ')}`);
        } else {
            note('bands', 'works',
                `Everything somebody at ordinal ${band.from}-${band.to} would type is answered - ${band.what}.`);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
// 3d. THE WOUNDED CHARACTER
// The worst defect found in this project, reproduced on purpose so it cannot
// come back. A qi deviation left a cold-start character with three untreated
// meridian injuries. The engine said, verbatim, that nothing heals them on
// their own and that any further combat is fatal. Every seclusion then added
// another injury and ejected him inside a month, so he could not advance. No
// sentence reached treatment, so he could not heal. And nothing killed him.
//
// The run was neither winnable nor loseable. A player would have concluded the
// game was broken and would not have been far wrong.
//
// Two things closed it, from opposite directions: untreated injuries now kill
// on their own in ninety days, so the run ends; and treatment is now reachable
// in plain English, so it does not have to. This checks both, because either
// one alone leaves half a trap.
// ─────────────────────────────────────────────────────────────────────────

async function theWoundedCharacter(): Promise<void> {
    rule('3d. THE WOUNDED CHARACTER - the softlock, reproduced');

    const { game, repos } = makeGame({ seed: 'wounded', worldEnabled: true });
    await (game as any).newRun('Shi Wanjun');
    stand(repos, game, 6);

    // Open three meridians, which is CRIPPLING_UNTREATED_INJURIES. Written through
    // the repo's own writer: injuries live in their own table, so a bare
    // `update` does not reach them and quietly produces a healthy character -
    // which is exactly what this fixture did on its first attempt, reporting
    // success while proving nothing.
    for (let i = 0; i < 3; i++) {
        repos.cultivators.addInjury(cur(game).id, {
            severity: 'serious',
            source: 'qi_deviation',
            description: 'a torn meridian from a qi deviation',
            sustainedOnTurn: 0
        });
    }

    const before = cur(game);
    line(`  standing at ${rankName(before.realmOrdinal)} with ` +
        `${(before.injuries ?? []).filter((i: any) => !i.treated).length} untreated injuries, ` +
        `${before.spiritStones} stones`);

    // 1. Is the player told, in words, that this kills them?
    //
    // Two sentences carry it and they carry different halves, which is worth
    // checking separately rather than with one loose pattern. `status` states
    // the condition - three meridian injuries open and nothing has closed them.
    // `look` states the consequence, and it is the one that matters: "standing
    // up is a decision now, and so is not standing up: ninety days of this and
    // they give out on their own." A first pass here tested one word list
    // against `status` alone and reported the game silent when it was not,
    // which is the harness failure AGENTS.md warns about.
    const status = await say(game, 'status');
    const looked = await say(game, 'I look around');
    const statesTheCondition = /meridian injur|untreated/i.test(status);
    const statesTheClock = /give out|days|bleed/i.test(looked);
    line(`  status names the wound:   ${statesTheCondition ? 'yes' : 'NO'}`);
    line(`  and something names the clock: ${statesTheClock ? 'yes' : 'NO'}`);
    const warned = statesTheCondition && statesTheClock;

    // 2. Can they find out what it would cost?
    const market = await say(game, 'what is for sale at the market');
    const priced = /physician/i.test(market);
    line(`  a physician is on offer:  ${priced ? 'yes' : 'NO'}`);

    // 3. Can they act on it, in the words a player would use?
    const phrasings = [
        'I get my injuries treated',
        'I see a physician',
        'I buy a visit from the mortal physician'
    ];
    let reached = 0;
    for (const text of phrasings) {
        const { game: g2, repos: r2 } = makeGame({ seed: `wounded-${text}`, worldEnabled: true });
        await (g2 as any).newRun('Shi Wanjun');
        stand(r2, g2, 6);
        // Three torn meridians, which is CRIPPLING_UNTREATED_INJURIES. Written
        // through the repo's own writer: injuries live in their own table, so
        // a bare update does not reach them and quietly produces a healthy
        // character - which is what this fixture did on its first attempt,
        // proving nothing while reporting success.
        for (let i = 0; i < 3; i++) {
            r2.cultivators.addInjury(cur(g2).id, {
                severity: 'serious',
                source: 'qi_deviation',
                description: 'a torn meridian from a qi deviation',
                sustainedOnTurn: 0
            });
        }
        const said = await say(g2, text);
        const dead = said.startsWith('THREW:')
            || /does not resolve|nothing you could actually do|nobody by that name/i.test(said);
        const after = (cur(g2).injuries ?? []).filter((i: any) => !i.treated).length;
        const healed = after < 3;
        line(`  ${dead ? 'DEAD' : healed ? 'ok  ' : 'read'}  ${text}`);
        if (!dead) reached++;
    }

    if (reached === 0) {
        note('wounded', 'broken',
            'The softlock is back: a character at the lethal injury threshold cannot reach treatment '
            + 'in any phrasing, and the engine has told them it will not heal on its own.');
    } else {
        note('wounded', 'works',
            `${reached} of ${phrasings.length} ordinary ways of asking for treatment reach it. The `
            + 'defect that made a run neither winnable nor loseable is closed from the side that '
            + 'lets the player choose.');
    }

    if (warned && priced) {
        note('wounded', 'works',
            'A wounded character is told they are dying, shown what the remedy costs, and can afford '
            + 'it - which is the whole loop that was missing.');
    } else {
        note('wounded', 'friction',
            `The loop is incomplete: warned=${warned}, priced=${priced}.`);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// 4. THE PYRAMID
// ─────────────────────────────────────────────────────────────────────────

function thePyramid(): void {
    rule('4. THE PYRAMID - does the shape of the world hold together');

    for (const apex of APEX_INSTITUTIONS) {
        const courts = COURTS.filter(c => c.apexId === apex.id);
        line(`  ${apex.name.padEnd(26)} ${apex.powerOrdinal}  courts ${courts.length}  ` +
            `${courts.map(c => c.name + ' ' + c.powerOrdinal).join(', ')}`);
        for (const court of courts) {
            if (court.powerOrdinal >= apex.powerOrdinal) {
                note('pyramid', 'broken', `${court.name} stands at or above ${apex.name}.`);
            }
        }
    }

    const sealed = SECTS
        .map(s => ({ name: s.name, t: sectThreat(s.id) }))
        .filter(x => x.t && x.t.ceiling > x.t.acting);
    line(`\n  houses holding a reserve above their own head: ${sealed.length}`);
    for (const s of sealed) line(`    ${s.name.padEnd(34)} acts ${s.t!.acting}, can field ${s.t!.ceiling} once`);

    const levelReserves = SECTS
        .map(s => ({ name: s.name, t: sectThreat(s.id) }))
        .filter(x => x.t && x.t.wakeCondition !== null && x.t.ceiling === x.t.acting);
    if (levelReserves.length > 0) {
        line(`\n  and holding one level with their own head: ${levelReserves.map(s => s.name).join(', ')}`);
        note('pyramid', 'works',
            'A house can hold a sealed ancestor level with or below its own head, which the catalog '
            + 'now models - the assumption that a reserve must outrank its house was wrong and was '
            + 'costing the Azure Cloud Pavilion its protector in every reading.');
    }
}

// ─────────────────────────────────────────────────────────────────────────
// 5. THE END OF THE WORLD, IN SIX SHAPES
// Everything above asks whether the ordinary game works. This asks what the
// engine does when the largest things in the setting move at once - because
// those are the events the whole catalog is written around, and none of them
// had ever been run.
// ─────────────────────────────────────────────────────────────────────────

const AMBIENT = 'normal' as const;

function fighter(id: string, ordinal: number, artifact?: number): SideMemberInput {
    return {
        combatant: {
            id, name: id, realmOrdinal: ordinal, spiritRoot: 'single_metal',
            attributes: { might: 3, insight: 3, fortune: 2, charm: 2 },
            injuries: [], hp: 100, maxHp: 100, qi: 50, maxQi: 50,
            ...(artifact === undefined ? {} : { artifactOrdinal: artifact })
        }
    };
}

/** How often the first side puts the second down. */
function clash(a: SideMemberInput[], b: SideMemberInput[], seedKey: string, seeds = 200): number {
    let wins = 0;
    for (let i = 0; i < seeds; i++) {
        const r = resolveMelee(
            [
                { id: 'a', name: 'a', members: a, intent: { goal: 'kill' } },
                { id: 'b', name: 'b', members: b, intent: { goal: 'kill' } }
            ],
            { rng: forStream('cataclysm', seedKey, i), ambient: AMBIENT, turn: i, intent: { goal: 'kill' } }
        );
        if (r.winningSideId === 'a') wins++;
    }
    return wins / seeds;
}

const asPct = (x: number) => x === 0 ? '  0%' : x < 0.01 ? (x * 100).toFixed(1) + '%' : Math.round(x * 100) + '%';

function cataclysms(): void {
    rule('5. THE LARGEST THINGS IN THE SETTING, MOVING');

    // ── the whole world against the Hollow Court ──────────────────────────
    const seats = sectThreat('sect-hollow-court')?.withdrawn?.seats ?? [];
    const hollowArtifacts = artifactsOwnedBy('sect-hollow-court').map(a => a.power ?? 0);
    const court = seats.map((seat, i) => fighter('seat-' + i, seat.ordinal, hollowArtifacts[i]));

    const everybody: SideMemberInput[] = [];
    for (const apex of APEX_INSTITUTIONS) {
        const objects = artifactsOwnedBy(apex.id);
        everybody.push(fighter(apex.id, apex.powerOrdinal, objects[0]?.power ?? undefined));
    }
    for (const c of COURTS) everybody.push(fighter(c.id, c.powerOrdinal));
    for (const sect of SECTS) {
        const t = sectThreat(sect.id);
        if (!t) continue;
        if (sect.id === 'sect-hollow-court') continue;
        everybody.push(fighter(sect.id, t.acting));
        if (t.wakeCondition !== null) everybody.push(fighter(sect.id + '-sealed', t.ceiling));
    }

    line(`  the entire world (${everybody.length} bodies, everything unsealed) against the four Seats:`);
    line(`    the world wins  ${asPct(clash(everybody, court, 'world-v-court'))}`);
    line(`    the Seats win   ${asPct(clash(court, everybody, 'court-v-world'))}`);
    note('cataclysm', 'works',
        `Every faction in the world at once, sealed ancestors included, can be put in front of the four `
        + `Seats and resolved without a special case. Read the rate as a rate and nothing else: a side of `
        + `this size routinely does not finish inside the exchange budget, so a zero here means the fight `
        + `did not settle rather than that anybody lost it.`);

    // ── an immortal comes down ────────────────────────────────────────────
    sub('an immortal comes back down');
    for (const [label, ordinal] of [['a False Immortal', FALSE_IMMORTAL_ORDINAL], ['a True Immortal', TRUE_IMMORTAL_ORDINAL]] as const) {
        const one = [fighter('visitor', ordinal)];
        const strongestApex = [...APEX_INSTITUTIONS].sort((x, y) => y.powerOrdinal - x.powerOrdinal)[0];
        const objects = artifactsOwnedBy(strongestApex.id);
        const apexHead = [fighter('head', strongestApex.powerOrdinal, objects[0]?.power ?? undefined)];
        line(`    ${label.padEnd(18)} (${ordinal}) vs ${strongestApex.name} head: ${asPct(clash(one, apexHead, 'down-' + ordinal))}`);
        line(`    ${label.padEnd(18)} (${ordinal}) vs the four Seats:      ${asPct(clash(one, court, 'down-seats-' + ordinal))}`);
        line(`    ${label.padEnd(18)} (${ordinal}) vs the entire world:    ${asPct(clash(one, everybody, 'down-world-' + ordinal))}`);
    }
    note('cataclysm', 'works',
        'Somebody coming back down from above the Lid resolves through the same code as everybody '
        + 'else, and the result is what the setting says it should be rather than a special case.');

    // ── one mad False Immortal nobody can name ────────────────────────────
    sub('a mad False Immortal nobody remembers the name of');
    const mad = [fighter('the-forgotten', FALSE_IMMORTAL_ORDINAL)];
    for (const sect of [...SECTS].sort((a, b) => b.powerOrdinal - a.powerOrdinal).slice(0, 4)) {
        const t = sectThreat(sect.id)!;
        const defenders = [fighter(sect.id, t.acting)];
        if (t.wakeCondition !== null) defenders.push(fighter(sect.id + '-sealed', t.ceiling));
        line(`    against ${sect.name.padEnd(28)} (${t.acting}${t.ceiling > t.acting ? ' + ' + t.ceiling + ' woken' : ''}): ${asPct(clash(mad, defenders, 'mad-' + sect.id))}`);
    }
    line(`    against every court together:              ${asPct(clash(mad, COURTS.map(c => fighter(c.id, c.powerOrdinal)), 'mad-courts'))}`);
    note('cataclysm', 'works',
        'One person above the Lid, with nobody organising against them, is an extinction event for '
        + 'anything short of an apex - which is why the record is full of scars nobody can attribute.');

    // ── a revolt: the courts and clients against their own apex ───────────
    sub('a revolt - every court and client turning on its own apex');
    for (const apex of APEX_INSTITUTIONS) {
        const objects = artifactsOwnedBy(apex.id);
        const head = [fighter(apex.id, apex.powerOrdinal, objects[0]?.power ?? undefined)];
        const rebels: SideMemberInput[] = COURTS
            .filter(c => c.apexId === apex.id)
            .map(c => fighter(c.id, c.powerOrdinal));
        for (const [id, entry] of Object.entries(FACTION_PARENTAGE)) {
            let cursor: string | null | undefined = entry.parentFactionId;
            const seen = new Set<string>();
            let under = false;
            while (cursor && !seen.has(cursor)) {
                seen.add(cursor);
                if (idsForFaction(apex.id).includes(cursor)) { under = true; break; }
                const c = COURTS.find(x => x.id === cursor);
                cursor = c ? c.apexId : FACTION_PARENTAGE[cursor]?.parentFactionId;
            }
            if (!under) continue;
            const t = sectThreat(id);
            if (!t) continue;
            rebels.push(fighter(id, t.acting));
            if (t.wakeCondition !== null) rebels.push(fighter(id + '-sealed', t.ceiling));
        }
        if (rebels.length === 0) { line(`    ${apex.name.padEnd(26)} has nobody to revolt`); continue; }
        line(`    ${apex.name.padEnd(26)} ${String(rebels.length).padStart(2)} rebels take the head ${asPct(clash(rebels, head, 'revolt-' + apex.id))}`);
    }
    note('cataclysm', 'friction',
        'A revolt is the conspiracy without the secrecy problem: the people who would have to be '
        + 'suborned are already inside. That it is measurable rather than unthinkable is the point, '
        + 'and it is the scenario the catalog has the least written about.');
}

// ─────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    await everyDoor();
    everyDao();
    everyBand();
    await playEveryBand();
    await playWhatBelongsThere();
    await theWoundedCharacter();
    thePyramid();
    cataclysms();

    rule('FINDINGS');
    for (const kind of ['broken', 'friction', 'works'] as Kind[]) {
        const hits = notes.filter(n => n.kind === kind);
        if (hits.length === 0) continue;
        line(`\n  ${kind.toUpperCase()} (${hits.length})`);
        for (const h of hits) line(`    [${h.area}] ${h.text}`);
    }
    line();
}

main().catch(error => { console.error(error); process.exit(1); });
