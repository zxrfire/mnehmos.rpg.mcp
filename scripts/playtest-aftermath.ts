/**
 * The aftermath, from ground level.
 *
 * Two people at Tribulation Transcendence fought over something. You were four
 * li away digging roots, you are at Qi Condensation, and you are still here.
 *
 * This is the scenario the setting is actually about and the one nothing tests.
 * Every other harness looks at the giants from outside and counts who won. This
 * one stands in the wreckage afterwards as somebody who could not have
 * perceived the fight, could not have survived being closer, and has no way of
 * finding out what happened - and asks whether the game gives that person
 * anything to do.
 *
 * What it checks, in the order it matters:
 *
 *   - the ground REMEMBERS. A fight at that altitude changes the place, and the
 *     change outlives everybody who saw it.
 *   - the survivor can PERCEIVE the change without being told what caused it.
 *   - the cause stays UNKNOWN. Nobody at ordinal 3 gets to find out, and the
 *     engine must not leak it through any phrasing.
 *   - there is something to DO about it. Scarred ground that is only scenery is
 *     a worse outcome than scarred ground that is dangerous, valuable, or both.
 */

import { makeGame } from '../tests/web/harness.js';
import { forbidZone, applyLocationChange, locationHistory, unexplainedChanges } from '../src/engine/world/locations.js';
import { rankName } from '../src/engine/cultivation/realms.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(80)); line('  ' + t); line('='.repeat(80)); };

type Kind = 'works' | 'friction' | 'broken';
const notes: { kind: Kind; text: string }[] = [];
const note = (kind: Kind, text: string) => notes.push({ kind, text });

type Game = ReturnType<typeof makeGame>['game'];
const cur = (game: Game): any => { const s: any = (game as any).state(); return s.cultivator ?? s; };

async function say(game: Game, text: string): Promise<string> {
    try {
        const r: any = await (game as any).act(text);
        return typeof r === 'string' ? r : String(r?.narration ?? '');
    } catch (error) {
        return 'THREW: ' + (error as Error).message;
    }
}

async function main(): Promise<void> {
    rule('THE AFTERMATH - two people at forty-one fought here, and you were not one of them');

    const { game, repos } = makeGame({ seed: 'aftermath', worldEnabled: true });
    await (game as any).newRun('Nobody');

    const me = cur(game);
    line(`  you are ${me.name}, ${rankName(me.realmOrdinal)}, in ${me.location ?? 'somewhere'}`);

    // ── the world before ─────────────────────────────────────────────────
    // `loadWorld` rebuilds from the run seed and catches up to the clock, which
    // is the supported way in; there is no live `world` property to reach for.
    const world: any = await (game as any).loadWorld();
    const places: any[] = world?.locations ?? [];
    if (places.length === 0) {
        note('broken', 'No world locations at all, so there is nowhere for a disaster to happen.');
        report();
        return;
    }

    const here = places.find((p: any) => p.id === me.location) ?? places[0];
    line(`  the place: ${here.name} (${here.kind}), qi density ${here.qiDensity}`);

    // ── the fight, which you did not see ─────────────────────────────────
    //
    // Not simulated as combat. Two people at forty-one settling something is
    // not an encounter a Qi Condensation cultivator has - it is weather. What
    // is modelled is what it leaves.
    // forbidZone returns a ChangeResult - the new place plus the change that
    // made it - not the place on its own.
    const { location: scarred, change } = forbidZone(here, {
        onDay: 100,
        summary: 'the ground stopped holding qi, in a single afternoon, for eleven li',
        survivalOrdinal: 25,
        operationalOrdinal: 33
    });

    line(`\n  after: ${scarred.name} (${scarred.kind}), qi density ${scarred.qiDensity}`);
    const changed = scarred.kind !== here.kind || scarred.qiDensity !== here.qiDensity;
    line(`  the ground remembers:     ${changed ? 'yes' : 'NO'}`);

    const history = locationHistory(scarred);
    const unexplained = unexplainedChanges(scarred);
    line(`  what the change says:     ${change.summary}`);
    line(`  changes on the record:    ${history.length}`);
    line(`  of which unexplained:     ${unexplained.length}`);

    if (!changed) {
        note('broken', 'A fight between two Tribulation Transcendence cultivators left the place identical.');
    } else if (unexplained.length === 0) {
        note('friction',
            'The place changed and the record already knows why. Nobody at ground level should be able '
            + 'to read the cause off the ground itself.');
    } else {
        note('works',
            `The ground carries ${history.length} change(s), ${unexplained.length} of them with no `
            + 'attributed cause - which is what a survivor at the bottom of the ladder should find.');
    }

    // ── what the survivor can do about it ────────────────────────────────
    const asked: [string, string][] = [
        ['what happened here', 'the place, asked directly'],
        ['I look around', 'the ordinary look'],
        ['I ask around about what happened', 'somebody who was also here'],
        ['I look for anything left behind', 'salvage'],
        ['I gather what herbs I can find', 'the ordinary trade, on ruined ground']
    ];

    line();
    let answered = 0;
    let leaked = 0;
    for (const [text, why] of asked) {
        const said = await say(game, text);
        const dead = said.startsWith('THREW:')
            || /does not resolve|nothing you could actually do/i.test(said);
        // Nobody at this rung may learn who did it.
        const leaks = /tribulation transcendence|forty-one|apex|Deep Survey|Long Cut|Hollow Court/i.test(said);
        if (leaks) leaked++;
        if (!dead) answered++;
        line(`  ${dead ? 'DEAD' : leaks ? 'LEAK' : 'ok  '}  ${text.padEnd(38)} ${why}`);
    }

    if (leaked > 0) {
        note('broken',
            `${leaked} of ${asked.length} ordinary questions told a Qi Condensation cultivator who was `
            + 'fighting. The whole point of standing here is not being able to find out.');
    } else {
        note('works',
            'Nothing a survivor can ask names the people who did it. The cause stays where it belongs, '
            + 'which is nowhere they can reach.');
    }

    if (answered < asked.length) {
        note('friction',
            `${asked.length - answered} of ${asked.length} things a person would try in the wreckage do `
            + 'not resolve. Scarred ground the player cannot interact with is scenery.');
    } else {
        note('works',
            'Every ordinary thing a survivor would try in the wreckage is answered - asking the place, '
            + 'asking a person, looking for what was left, and going back to work on ruined ground.');
    }

    // ── and whether the ground is now dangerous to the person standing on it ──
    line();
    line(`  survival bar now:         ${scarred.thresholds?.survival ?? 'none'}`);
    line(`  you stand at:             ${me.realmOrdinal}`);
    const lethal = (scarred.thresholds?.survival ?? 0) > me.realmOrdinal;
    line(`  the ground would kill you: ${lethal ? 'yes' : 'no'}`);
    if (lethal) {
        note('works',
            `The wreckage is calibrated to the people who made it: a survival bar of `
            + `${scarred.thresholds?.survival} against a survivor at ${me.realmOrdinal}. Being alive `
            + 'afterwards is a fact about where you were standing, not about what you could take.');
    } else {
        note('friction',
            'The scar is not dangerous to somebody at the bottom of the ladder, which makes a fight '
            + 'between two of the strongest people alive into set dressing.');
    }

    report();
}

function report(): void {
    rule('FINDINGS');
    for (const kind of ['broken', 'friction', 'works'] as Kind[]) {
        const hits = notes.filter(n => n.kind === kind);
        if (hits.length === 0) continue;
        line(`\n  ${kind.toUpperCase()} (${hits.length})`);
        for (const h of hits) line(`    ${h.text}`);
    }
    line();
}

main().catch(error => { console.error(error); process.exit(1); });
