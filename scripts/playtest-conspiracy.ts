/**
 * The shadow-conspiracy playtest.
 *
 * The question, in the user's words: what happens if somebody has spent a
 * century acquiring quiet control of several courts and then launches an attack
 * with their sealed ancestors or protectors. And the second half, which the
 * arithmetic never mentions: what it costs the people underneath.
 *
 * Everything here is measured through the ordinary engine. No apex branch, no
 * special case, no hardcoded verdict - the defenders are people at their own
 * ordinals carrying artifacts with a `power` column, and `resolveMelee` answers
 * the same way it answers a tavern brawl. If a line below says something the
 * setting does not, the setting is what is wrong.
 */

import { resolveMelee, type SideInput, type SideMemberInput } from '../src/engine/cultivation/combat.js';
import { forStream } from '../src/engine/cultivation/rng.js';
import { ARTIFACTS, artifactsOwnedBy } from '../src/data/cultivation/artifacts.js';
import { APEX_INSTITUTIONS, COURTS, FACTION_PARENTAGE, idsForFaction } from '../src/data/cultivation/hierarchy.js';
import { sectThreat, sectsWithASealedCeiling, SECTS } from '../src/data/cultivation/sects.js';
import type { AmbientQi } from '../src/engine/cultivation/ambient.js';

const SEEDS = 300;

const AMBIENT: AmbientQi = 'normal';

function body(id: string, name: string, ordinal: number, artifactOrdinal?: number): SideMemberInput {
    return {
        combatant: {
            id,
            name,
            realmOrdinal: ordinal,
            spiritRoot: 'single_metal',
            attributes: { might: 3, insight: 3, fortune: 2, charm: 2 },
            injuries: [],
            hp: 100,
            maxHp: 100,
            qi: 50,
            maxQi: 50,
            ...(artifactOrdinal === undefined ? {} : { artifactOrdinal })
        }
    };
}

/**
 * One assault, measured twice.
 *
 * Once against the head alone, which is the fight the plot would like to have,
 * and once against the head with everybody who unseals for him already in it -
 * because when the head's own life is in question the courts and the subsidiary
 * sects do not weigh it up. Everything they hold is held on that name, and a
 * client whose patron is killed is a house with ground, stores and nobody above
 * it by morning; deciding whether to help is the same calculation as deciding
 * whether to go on existing. Both runs are plain melees through the ordinary
 * resolver - no clock, no staging, no special case.
 */
function run(
    attackerMembers: readonly SideMemberInput[],
    defenderMembers: readonly SideMemberInput[]
): number {
    let attackerWins = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
        const result = resolveMelee(
            [
                { id: 'plot', name: 'the plot', members: attackerMembers, intent: { goal: 'kill' } },
                { id: 'survey', name: survey.name, members: defenderMembers, intent: { goal: 'kill' } }
            ],
            { rng: forStream('conspiracy', 'assault', seed), ambient: AMBIENT, turn: seed, intent: { goal: 'kill' } }
        );
        if (result.winningSideId === 'plot') attackerWins++;
    }
    return attackerWins;
}

/**
 * A rate, and small ones are not rounded away.
 *
 * This mattered: the worth-it sweep was printing 0% for a move that came off
 * one time in three hundred, which reads as a rule rather than as a very bad
 * idea. Nothing in this setting should be impossible.
 */
function pct(n: number): string {
    const share = (n / SEEDS) * 100;
    if (n === 0) return '  0%';
    if (share < 1) return share.toFixed(1) + '%';
    return Math.round(share) + '%';
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE WORLD ACTUALLY HOLDS
// ─────────────────────────────────────────────────────────────────────────

console.log('\n  THE SHADOW CONSPIRACY');
console.log('='.repeat(78));
console.log('\n  What is on the board (read off the catalogs, nothing invented):\n');

for (const apex of APEX_INSTITUTIONS) {
    const objects = artifactsOwnedBy(apex.id);
    const courts = COURTS.filter(c => c.apexId === apex.id);
    console.log(
        `    ${apex.name.padEnd(26)} head ${apex.powerOrdinal}` +
        `  ${objects.map(o => `${o.name} (${o.power})`).join(', ') || 'nothing'}` +
        `  courts: ${courts.length}`
    );
}

const sealed = sectsWithASealedCeiling()
    .map(s => ({ name: s.name, ceiling: sectThreat(s.id)?.ceiling ?? 0 }))
    .sort((a, b) => b.ceiling - a.ceiling);
console.log(`\n    sealed ancestors available: ${sealed.map(s => `${s.name} ${s.ceiling}`).join(', ')}`);

const hollow = artifactsOwnedBy('sect-hollow-court');
const hollowSeats = sectThreat('sect-hollow-court')?.withdrawn?.seats ?? [];
console.log(
    `    the Hollow Court:           seats ${hollowSeats.map(s => s.ordinal).join('/')}` +
    `  artifacts ${hollow.map(a => a.power).join('/')}  (awake, not sealed)`
);

// ─────────────────────────────────────────────────────────────────────────
// THE SCENARIOS
// ─────────────────────────────────────────────────────────────────────────

const survey = APEX_INSTITUTIONS.find(a => a.id === 'apex-deep-survey')!;
const lamp = ARTIFACTS.find(a => a.id === 'sent-datum-lamp')!;
const surveyCourts = COURTS.filter(c => c.apexId === survey.id);

/** The head, on the object, in his own house. */
const HEAD: SideMemberInput[] = [
    body('head', 'the seated one', survey.powerOrdinal, lamp.power ?? undefined)
];

/**
 * Everybody who turns out for a house when its head's life is in question.
 *
 * Two corrections live in here, both of which were silently costing the Azure
 * Cloud Pavilion its entire following:
 *
 * 1. The chain is walked through `idsForFaction`, because the Pavilion is one
 *    house with a row in two catalogs. Its own court and its own feeder sect
 *    hang off the SECT id while the apex queries used the APEX id, so a house
 *    with a court and a sect under it was being counted as one person.
 * 2. A client arrives as itself, not only as its sealed ancestor. Everything a
 *    house holds is held on its patron's name; when the patron's life is in
 *    question the house comes, and it comes with its strongest member whether
 *    or not it has anything asleep under a mountain.
 */
function reinforcementsFor(apexId: string, suborned: readonly string[]): SideMemberInput[] {
    const houseIds = idsForFaction(apexId);

    const arriving: SideMemberInput[] = COURTS
        .filter(c => houseIds.includes(c.apexId) && !suborned.includes(c.id))
        .map(c => body(c.id, c.name, c.powerOrdinal));

    for (const [id, entry] of Object.entries(FACTION_PARENTAGE)) {
        if (suborned.includes(id) || houseIds.includes(id)) continue;

        let cursor: string | null | undefined = entry.parentFactionId;
        const seen = new Set<string>();
        let under = false;
        while (cursor && !seen.has(cursor)) {
            seen.add(cursor);
            if (houseIds.includes(cursor)) { under = true; break; }
            const court = COURTS.find(c => c.id === cursor);
            cursor = court ? court.apexId : FACTION_PARENTAGE[cursor]?.parentFactionId;
        }
        if (!under) continue;

        const sect = SECTS.find(s => s.id === id);
        const threat = sectThreat(id);
        if (!sect || !threat) continue;

        // The house itself.
        arriving.push(body(id, sect.name, threat.acting));
        // And whatever it keeps asleep, which it breaks for this.
        if (threat.wakeCondition !== null && threat.ceiling > threat.acting) {
            arriving.push(body(id + '-sealed', sect.name + "'s ancestor", threat.ceiling));
        }
    }

    return arriving.sort((a, b) => b.combatant.realmOrdinal - a.combatant.realmOrdinal);
}

interface Case {
    label: string;
    attackers: SideMemberInput[];
    /** Faction ids the plot already owns, which therefore do not turn up. */
    suborned: string[];
    note: string;
}

const SURVEY_COURT_IDS = surveyCourts.map(c => c.id);

const cases: Case[] = [
    {
        label: 'two peers, no plot',
        attackers: [body('a1', 'a peer', 43), body('a2', 'another peer', 43)],
        suborned: [],
        note: 'the plan everybody makes'
    },
    {
        label: 'one woken ancestor (44)',
        attackers: [body('kiln', 'a woken ancestor', 44)],
        suborned: [],
        note: 'the best single weapon anybody holds, spent'
    },
    {
        label: 'both sealed keys (44 + 42)',
        attackers: [body('kiln', 'the Kiln ancestor', 44), body('frost', 'the Frostmirror ancestor', 42)],
        suborned: ['sect-kiln-wardens', 'sect-frostmirror-court'],
        note: 'every relevant seal in the region, spent at once'
    },
    {
        label: 'the keys, courts suborned',
        attackers: [body('kiln', 'the Kiln ancestor', 44), body('frost', 'the Frostmirror ancestor', 42)],
        suborned: ['sect-kiln-wardens', 'sect-frostmirror-court', ...SURVEY_COURT_IDS],
        note: 'same force; the courts do not come'
    },
    {
        label: 'the keys, courts turned against',
        attackers: [
            body('kiln', 'the Kiln ancestor', 44),
            body('frost', 'the Frostmirror ancestor', 42),
            ...surveyCourts.map(c => body(c.id, `${c.name}, turned`, c.powerOrdinal))
        ],
        suborned: ['sect-kiln-wardens', 'sect-frostmirror-court', ...SURVEY_COURT_IDS],
        note: 'the whole point: they arrive on the wrong side'
    },
    {
        label: 'the keys + both turned courts + a turned client',
        attackers: [
            body('kiln', 'the Kiln ancestor', 44),
            body('frost', 'the Frostmirror ancestor', 42),
            body('storm', 'the Storm Tyrant ancestor', 40),
            ...surveyCourts.map(c => body(c.id, `${c.name}, turned`, c.powerOrdinal))
        ],
        suborned: [
            'sect-kiln-wardens', 'sect-frostmirror-court', 'sect-storm-tyrant-court',
            ...SURVEY_COURT_IDS
        ],
        note: 'the mega conspiracy: everything, and nobody left to call'
    },
    {
        label: 'all four Seats, all four artifacts',
        attackers: hollowSeats.map((seat, i) =>
            body(`seat${i}`, `Seat ${i + 1}`, seat.ordinal, hollow[i]?.power ?? undefined)),
        suborned: [],
        note: 'the Court emptying itself, which it never has'
    },
    {
        label: 'two Seats, two artifacts',
        attackers: [
            body('seat1', 'First Seat', hollowSeats[0]?.ordinal ?? 44, hollow[0]?.power ?? undefined),
            body('seat2', 'Second Seat', hollowSeats[1]?.ordinal ?? 43, hollow[1]?.power ?? undefined)
        ],
        suborned: [],
        note: 'the Hollow Court, if it ever wanted anything'
    }
];

const fullPool = reinforcementsFor(survey.id, []);
console.log('\n  Who comes when the head\'s life is in question (not an ask - they unseal):\n');
console.log(
    '    ' + (fullPool.length === 0
        ? 'nobody is modelled as being under the Survey'
        : fullPool.map(m => `${m.combatant.name} (${m.combatant.realmOrdinal})`).join(', '))
);

console.log('\n  Against the Deep Survey (head 43, Datum Lamp 45). Two runs each:');
console.log('  alone = the fight the plot would like. helped = everyone who unseals is in it.\n');
console.log('    ' + 'assault'.padEnd(34) + 'help  alone  helped  what it is');
console.log('    ' + '-'.repeat(86));

for (const c of cases) {
    const help = reinforcementsFor(survey.id, c.suborned);
    const alone = run(c.attackers, HEAD);
    const helped = run(c.attackers, [...HEAD, ...help]);
    console.log(
        `    ${c.label.padEnd(34)}${String(help.length).padStart(4)}  ${pct(alone)}   ${pct(helped)}  ${c.note}`
    );
}

// ─────────────────────────────────────────────────────────────────────────
// APEX AGAINST APEX
// The likeliest war in the setting, and the one nothing above measures. These
// are peers: each has a head in the forties, an immortal object, courts, and
// clients holding seals. Nobody has to be suborned and nobody has to be
// patient - two of them simply want the same thing.
// ─────────────────────────────────────────────────────────────────────────

/**
 * A whole apex, mobilised: everybody it has at the last realm, on whatever
 * objects it holds, plus everyone who unseals for it.
 *
 * `lastRealm.count` is read rather than assumed. It was assumed for a long
 * time - one head per house - and the assumption was wrong about the Azure
 * Cloud Pavilion in a way that decided every measurement in this file.
 */
function fullHouse(apexId: string): SideMemberInput[] {
    const apex = APEX_INSTITUTIONS.find(a => a.id === apexId)!;
    const objects = artifactsOwnedBy(apex.id);
    const atTheTop = Math.max(1, apex.lastRealm.count);

    const people: SideMemberInput[] = [];
    for (let i = 0; i < atTheTop; i++) {
        // The pinned one carries the object. Anybody else is a person at the
        // last realm with nothing in their hands, which is still enormous.
        people.push(body(
            i === 0 ? `${apex.id}-head` : `${apex.id}-last-realm-${i}`,
            i === 0 ? apex.name : `${apex.name}, second at the last realm`,
            apex.powerOrdinal,
            objects[i]?.power ?? undefined
        ));
    }


    // The house's OWN sealed ancestor, which nothing was counting. A patron
    // that would break a client's seal for its head certainly breaks its own,
    // and two of the three have one.
    const own = sectThreat(apex.factionId ?? apex.id);
    const sealed = own && own.wakeCondition !== null
        ? [body(apex.id + '-sealed', apex.name + ' protector', own.ceiling)]
        : [];

    return [...people, ...sealed, ...reinforcementsFor(apex.id, [])];
}

/** Just the head, on its object. The war before anybody calls anybody. */
function headOnly(apexId: string): SideMemberInput[] {
    const apex = APEX_INSTITUTIONS.find(a => a.id === apexId)!;
    const object = artifactsOwnedBy(apex.id)[0];
    return [body(`${apex.id}-head`, apex.name, apex.powerOrdinal, object?.power ?? undefined)];
}

/**
 * The three ways an apex war goes, and the third is the one that decides it.
 *
 * 'heads'    - the two of them, on their objects, before anybody is called.
 * 'mobilised'- both houses whole: courts, clients, every seal broken.
 * 'defection'- the defender's courts change sides.
 *
 * That last one is not treachery so much as arithmetic done early. A court is
 * an administration, not a believer: it holds ground it will still be holding
 * next year under whichever name wins, and it knows the attacking apex will
 * back it - that is the entire offer, and the offer is credible, because an
 * apex that punished a court for defecting would never receive another one. So
 * the court's real question is not who is right. It is who is going to be
 * above it in ten years, and whether the answer will remember what it did.
 */
type WarShape = 'heads' | 'mobilised' | 'defection';

function war(attackerId: string, defenderId: string, shape: WarShape): number {
    const defenderCourts = COURTS.filter(c => c.apexId === defenderId).map(c => c.id);

    const attackers = shape === 'heads'
        ? headOnly(attackerId)
        : shape === 'mobilised'
            ? fullHouse(attackerId)
            : [...fullHouse(attackerId), ...reinforcementsFor(defenderId, [])
                .filter(m => defenderCourts.includes(m.combatant.id))];

    const defenders = shape === 'heads'
        ? headOnly(defenderId)
        : shape === 'mobilised'
            ? fullHouse(defenderId)
            : [
                ...fullHouse(defenderId).filter(m => !defenderCourts.includes(m.combatant.id))
            ];

    let wins = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
        const result = resolveMelee(
            [
                { id: 'a', name: attackerId, members: attackers, intent: { goal: 'kill' } },
                { id: 'b', name: defenderId, members: defenders, intent: { goal: 'kill' } }
            ],
            {
                rng: forStream('apexwar', attackerId + defenderId + shape, seed),
                ambient: AMBIENT, turn: seed, intent: { goal: 'kill' }
            }
        );
        if (result.winningSideId === 'a') wins++;
    }
    return wins;
}

console.log('\n  Apex against apex - the likeliest war there is:\n');
console.log('    ' + 'pairing'.padEnd(46) + 'heads  mobilised  courts defect');
console.log('    ' + '-'.repeat(84));

for (const a of APEX_INSTITUTIONS) {
    for (const b of APEX_INSTITUTIONS) {
        if (a.id === b.id) continue;
        const objA = artifactsOwnedBy(a.id)[0];
        const objB = artifactsOwnedBy(b.id)[0];
        const label = `${a.name} (${a.powerOrdinal}+${objA?.power ?? 0}) -> ${b.name} (${b.powerOrdinal}+${objB?.power ?? 0})`;
        console.log(
            `    ${label.padEnd(46)}${pct(war(a.id, b.id, 'heads'))}  ${pct(war(a.id, b.id, 'mobilised'))}     ${pct(war(a.id, b.id, 'defection'))}`
        );
    }
}

console.log('\n    Each house mobilised: ' + APEX_INSTITUTIONS.map(a =>
    `${a.name} ${fullHouse(a.id).length}`).join(', '));

// ─────────────────────────────────────────────────────────────────────────
// THREE KINGDOMS
// The reason nobody attacks the weakest one. A war between two apexes is not
// resolved when it is won - the winner is still standing in a province with a
// third apex in it, holding whatever the fight left them.
// ─────────────────────────────────────────────────────────────────────────

/** Fight a war, then face the third house on whatever hp is left. */
function thenTheThirdHouse(attackerId: string, victimId: string, thirdId: string): {
    tookTheVictim: number;
    survivedTheThird: number;
} {
    let tookTheVictim = 0;
    let survivedTheThird = 0;

    for (let seed = 0; seed < SEEDS; seed++) {
        const first = resolveMelee(
            [
                { id: 'a', name: attackerId, members: fullHouse(attackerId), intent: { goal: 'kill' } },
                { id: 'v', name: victimId, members: fullHouse(victimId), intent: { goal: 'kill' } }
            ],
            { rng: forStream('threekingdoms', attackerId + victimId, seed), ambient: AMBIENT, turn: seed, intent: { goal: 'kill' } }
        );
        if (first.winningSideId !== 'a') continue;
        tookTheVictim++;

        // Whoever is still standing, at the hp the war left them on.
        const survivors = fullHouse(attackerId)
            .filter(m => (first.hp[m.combatant.id] ?? 0) > 0)
            .map(m => ({ ...m, combatant: { ...m.combatant, hp: first.hp[m.combatant.id] ?? 0 } }));
        if (survivors.length === 0) continue;

        const second = resolveMelee(
            [
                { id: 'a', name: attackerId, members: survivors, intent: { goal: 'kill' } },
                { id: 't', name: thirdId, members: fullHouse(thirdId), intent: { goal: 'kill' } }
            ],
            { rng: forStream('threekingdoms', attackerId + thirdId + 'after', seed), ambient: AMBIENT, turn: seed, intent: { goal: 'kill' } }
        );
        if (second.winningSideId === 'a') survivedTheThird++;
    }

    return { tookTheVictim, survivedTheThird };
}

console.log('\n  Three kingdoms - what happens to the winner:\n');
console.log('    ' + 'attacker takes victim, then meets the third'.padEnd(52) + 'won  then survived');
console.log('    ' + '-'.repeat(74));

for (const a of APEX_INSTITUTIONS) {
    for (const v of APEX_INSTITUTIONS) {
        if (a.id === v.id) continue;
        const third = APEX_INSTITUTIONS.find(x => x.id !== a.id && x.id !== v.id)!;
        const { tookTheVictim, survivedTheThird } = thenTheThirdHouse(a.id, v.id, third.id);
        const label = `${a.name} -> ${v.name}, then ${third.name}`;
        const rate = tookTheVictim === 0
            ? '   -'
            : `${Math.round((survivedTheThird / tookTheVictim) * 100)}%`.padStart(4);
        console.log(`    ${label.padEnd(52)}${pct(tookTheVictim)}        ${rate}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// TWO AGAINST ONE
// The lever nobody has pulled. If a war between two apexes cannot be won -
// and measured, it cannot - then the only way anything at the top of the
// world changes is two of them agreeing on the third. So: can they win, and
// what happens to them afterwards?
// ─────────────────────────────────────────────────────────────────────────

/**
 * Two houses against one, and then what is left of the two of them.
 *
 * The follow-up is HEAD AGAINST HEAD rather than house against house, and that
 * is the whole point rather than a simplification. Ru Anwei does not have to
 * beat an alliance. She has to hurt one of the two people it cannot replace,
 * and a head who walks out of her mountain at half strength is standing next
 * to the only other person in the world who could take him, on the one day of
 * his life when somebody could. The war is won and the winner is finished, and
 * every step of it is resolved by the ordinary resolver.
 */
function twoAgainstOne(allyA: string, allyB: string, targetId: string): {
    won: number;
    headHurt: number;
    aThenTakesB: number;
    bThenTakesA: number;
    neither: number;
} {
    let won = 0;
    let headHurt = 0;
    let aThenTakesB = 0;
    let bThenTakesA = 0;
    let neither = 0;

    const headId = (id: string) => id + '-head';

    for (let seed = 0; seed < SEEDS; seed++) {
        const first = resolveMelee(
            [
                {
                    id: 'allies',
                    name: 'the alliance',
                    members: [...fullHouse(allyA), ...fullHouse(allyB)],
                    intent: { goal: 'kill' }
                },
                { id: 'target', name: targetId, members: fullHouse(targetId), intent: { goal: 'kill' } }
            ],
            { rng: forStream('alliance', allyA + allyB + targetId, seed), ambient: AMBIENT, turn: seed, intent: { goal: 'kill' } }
        );
        if (first.winningSideId !== 'allies') continue;
        won++;

        const hpA = first.hp[headId(allyA)] ?? 0;
        const hpB = first.hp[headId(allyB)] ?? 0;
        if (hpA < 60 || hpB < 60) headHurt++;
        if (hpA <= 0 || hpB <= 0) { neither++; continue; }

        // The morning after, and only the two who matter are in the room.
        const headOf = (id: string, hp: number) => {
            const [head] = fullHouse(id);
            return [{ ...head, combatant: { ...head.combatant, hp } }];
        };

        const second = resolveMelee(
            [
                { id: 'a', name: allyA, members: headOf(allyA, hpA), intent: { goal: 'kill' } },
                { id: 'b', name: allyB, members: headOf(allyB, hpB), intent: { goal: 'kill' } }
            ],
            { rng: forStream('alliance', allyA + allyB + 'after', seed), ambient: AMBIENT, turn: seed, intent: { goal: 'kill' } }
        );
        if (second.winningSideId === 'a') aThenTakesB++;
        else if (second.winningSideId === 'b') bThenTakesA++;
        else neither++;
    }

    return { won, headHurt, aThenTakesB, bThenTakesA, neither };
}

console.log('\n  Two against one, and the morning after (heads only):\n');
console.log('    ' + 'alliance -> target'.padEnd(50) + ' won   a head hurt   A takes B   B takes A');
console.log('    ' + '-'.repeat(96));

for (const target of APEX_INSTITUTIONS) {
    const [a, b] = APEX_INSTITUTIONS.filter(x => x.id !== target.id);
    const r = twoAgainstOne(a.id, b.id, target.id);
    const share = (n: number) => r.won === 0 ? '   -' : `${Math.round((n / r.won) * 100)}%`.padStart(4);
    const label = `${a.name} + ${b.name} -> ${target.name}`;
    console.log(
        `    ${label.padEnd(50)}${pct(r.won)}       ${share(r.headHurt)}        ${share(r.aThenTakesB)}       ${share(r.bThenTakesA)}`
    );
}

// ─────────────────────────────────────────────────────────────────────────
// IS IT WORTH IT
// The sweep the whole design rests on. For the standoff to be a standoff and
// not an accident, EVERY move available to EVERY apex has to come out not
// worth making - and it has to stop being true the moment somebody gets
// something new. Both halves are measured here.
//
// "Worth it" is deliberately strict, because an apex is strict: take the
// target, AND still be standing in front of the house that did not fight.
// Winning a war you do not survive is not a win, it is a succession.
// ─────────────────────────────────────────────────────────────────────────

interface Perturbation {
    label: string;
    /** Extra bodies this house fields. */
    extra: (apexId: string) => SideMemberInput[];
    appliesTo: string | null;
}

/** Take the target, then face the third house on what is left. */
function worthIt(
    attackerId: string,
    targetId: string,
    thirdId: string,
    extraFor: (id: string) => SideMemberInput[]
): number {
    let clean = 0;

    for (let seed = 0; seed < SEEDS; seed++) {
        const attackers = [...fullHouse(attackerId), ...extraFor(attackerId)];
        const first = resolveMelee(
            [
                { id: 'a', name: attackerId, members: attackers, intent: { goal: 'kill' } },
                {
                    id: 'v',
                    name: targetId,
                    members: [...fullHouse(targetId), ...extraFor(targetId)],
                    intent: { goal: 'kill' }
                }
            ],
            { rng: forStream('worth', attackerId + targetId, seed), ambient: AMBIENT, turn: seed, intent: { goal: 'kill' } }
        );
        if (first.winningSideId !== 'a') continue;

        const survivors = attackers
            .filter(m => (first.hp[m.combatant.id] ?? 0) > 0)
            .map(m => ({ ...m, combatant: { ...m.combatant, hp: first.hp[m.combatant.id] ?? 0 } }));
        if (survivors.length === 0) continue;

        const second = resolveMelee(
            [
                { id: 'a', name: attackerId, members: survivors, intent: { goal: 'kill' } },
                {
                    id: 't',
                    name: thirdId,
                    members: [...fullHouse(thirdId), ...extraFor(thirdId)],
                    intent: { goal: 'kill' }
                }
            ],
            { rng: forStream('worth', attackerId + thirdId + 'after', seed), ambient: AMBIENT, turn: seed, intent: { goal: 'kill' } }
        );
        // Not losing is enough: the third house does not have to be beaten,
        // only survived. An apex that keeps its conquest and its head has won.
        if (second.winningSideId !== 't') clean++;
    }

    return clean;
}

const NOTHING = () => [];

const perturbations: Perturbation[] = [
    { label: 'as the world stands', extra: NOTHING, appliesTo: null },
    ...APEX_INSTITUTIONS.flatMap(a => [
        {
            label: `${a.name} is sent a second object (45)`,
            appliesTo: a.id,
            extra: (id: string) => id === a.id
                ? [body(a.id + '-second-object', 'a second object', a.powerOrdinal, 45)]
                : []
        },
        {
            label: `${a.name} produces a second at 44`,
            appliesTo: a.id,
            extra: (id: string) => id === a.id ? [body(a.id + '-second-head', 'a second head', 44)] : []
        }
    ])
];

console.log('\n  Is it worth it - every move, and what would make one worth making:\n');
console.log('    ' + 'world'.padEnd(44) + 'move'.padEnd(46) + 'worth it');
console.log('    ' + '-'.repeat(98));

for (const p of perturbations) {
    let anyWorthIt = false;
    const lines: string[] = [];

    for (const a of APEX_INSTITUTIONS) {
        for (const v of APEX_INSTITUTIONS) {
            if (a.id === v.id) continue;
            const third = APEX_INSTITUTIONS.find(x => x.id !== a.id && x.id !== v.id)!;
            const clean = worthIt(a.id, v.id, third.id, p.extra);
            if (clean === 0) continue;
            anyWorthIt = true;
            lines.push(`    ${''.padEnd(44)}${(a.name + ' takes ' + v.name).padEnd(46)}${pct(clean)}`);
        }
    }

    console.log(`    ${p.label.padEnd(44)}${anyWorthIt ? '' : 'nothing is worth doing'}`);
    for (const line of lines) console.log(line);
}

// ─────────────────────────────────────────────────────────────────────────
// AND THE PART THE ARITHMETIC NEVER MENTIONS
// ─────────────────────────────────────────────────────────────────────────

console.log('\n  If it worked - what is standing underneath:\n');

const clients = SECTS.filter(s => {
    const patron = (s as unknown as { patronId?: string; apexId?: string });
    return patron.patronId === survey.id || patron.apexId === survey.id;
});

console.log(`    courts that would each claim the succession: ${surveyCourts.length}`);
console.log(`    client houses whose grants stop meaning anything: ${clients.length || 'not modelled as a link yet'}`);
console.log(`    disciples: every house under those courts, first line cut, nothing in the engine that`);
console.log(`               tracks them as a cohort - see WHAT_FALLS_ON_THOSE_BELOW in catastrophe.ts.`);

console.log('\n' + '='.repeat(78) + '\n');
