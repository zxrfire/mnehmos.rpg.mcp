/**
 * Does the passes probe still see every pass?
 *
 *     node scripts/does-the-passes-probe-still-see-every-pass.mjs
 *
 * `probe-which-passes-ever-fire.probe.ts` watches a list it keeps by hand, and
 * its own header tells you to add a line when you add a pass. So a pass nobody
 * adds is invisible to the instrument built to find invisible passes, and
 * nothing says so: the probe reports on what it was given and reads as a census.
 *
 * THE CAVEAT THIS EXISTS TO RETIRE, in the words of the agent that hit it: four
 * passes never fired, AMONG THOSE SOMEBODY HAD LISTED - *"it also explains why
 * the list looked suspiciously tidy when I was diagnosing the blind spots; I
 * took it as the set of passes and it was the set of remembered passes."*
 * Nothing in the tree could say how long that list had been short. This can.
 *
 * ── WHAT IT DOES, AND WHY IT IS A SEARCH RATHER THAN A REGISTRY ──────────
 *
 * It reads the watched list out of the probe, reads the year loop out of
 * `applyPressure`, and reports the two differences:
 *
 *   WATCHED BUT NOT CALLED   a pass the probe still tallies that the loop no
 *                            longer runs. Harmless to the world and a lie in
 *                            the report, because a pass that is never called
 *                            prints as a pass that never fired.
 *   CALLED BUT NOT WATCHED   the one that matters. A pass the loop runs every
 *                            year that no instrument is counting.
 *
 * A REGISTRY WOULD BE BETTER AND IT IS NOT WHAT THIS IS. The version that makes
 * the defect impossible is a table the year loop iterates, so adding a pass
 * means adding a row and the loop and the probe read the same thing. That is a
 * change to how the world advance is written, which is a decision about the
 * world rather than about tooling. This was chosen over it for sequencing and
 * not for preference: cheap and noisy now, correct and untimely later. If
 * somebody builds the registry, delete this file - it will have nothing to say.
 *
 * ── HOW IT DECIDES WHAT A PASS IS, AND WHAT THAT MISSES ──────────────────
 *
 * A call inside the year loop whose first argument is `state`, to a name this
 * module imported from somewhere under `./`. That is a shape rather than a
 * definition, so it over-reports: helpers that take the world and are not
 * passes will appear. Over-reporting is the right direction here - a name in
 * the list that should not be is a minute's reading, and a pass nobody counts
 * is what we are trying to stop.
 *
 * It cannot see a pass called through a variable, a pass reached inside another
 * function called by the loop, or a pass the loop runs without handing it
 * `state` first. Those are real gaps and they are the reason the registry is the
 * better answer.
 */

import { readFileSync } from 'node:fs';

const PROBE = 'scripts/probe-which-passes-ever-fire.probe.ts';
const WORLD = 'src/engine/world/the-world-changing-on-its-own.ts';

/** The list the probe keeps by hand. */
function watched() {
    const text = readFileSync(PROBE, 'utf8');
    const block = /THE_PASSES_WATCHED[^=]*=\s*\[([\s\S]*?)\n\];/.exec(text);
    if (!block) throw new Error(`no THE_PASSES_WATCHED array found in ${PROBE}`);
    return new Set([...block[1].matchAll(/name:\s*'([^']+)'/g)].map(m => m[1]));
}

/** Every name this module imported from a sibling module. */
function importedNames(text) {
    const names = new Set();
    for (const m of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/[^']+'/g)) {
        for (const piece of m[1].split(',')) {
            const name = piece.replace(/\bas\b[\s\S]*$/, '').replace(/^\s*type\s+/, '').trim();
            if (name.length > 0) names.add(name);
        }
    }
    return names;
}

/**
 * The body of the year loop inside `applyPressure`.
 *
 * Bounded by the loop's own opening line and the end of the function, found by
 * the first line that closes at column zero after it.
 */
function theYearLoop(text) {
    const lines = text.split('\n');
    const from = lines.findIndex(l => /for \(let year = firstYear/.test(l));
    if (from < 0) throw new Error(`no year loop found in ${WORLD}`);
    let to = lines.length;
    for (let i = from + 1; i < lines.length; i++) {
        if (lines[i] === '}') { to = i; break; }
    }
    return lines.slice(from, to).join('\n');
}

const world = readFileSync(WORLD, 'utf8');
const imported = importedNames(world);
const loop = theYearLoop(world);

const called = new Set();
for (const m of loop.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*state\b/g)) {
    if (imported.has(m[1])) called.add(m[1]);
}

const list = watched();

// ── IT HAS TO FAIL WHEN ITS OWN SOURCES MOVE ─────────────────────────────
//
// A derived list is only honest while it can still find what it derives from.
// Every read above is a pattern over somebody else's file, and a rename, a
// reformat or a refactor can leave any of them matching nothing - at which
// point this prints two short lists, exits zero, and reads as a clean bill.
// That is the defect it exists to catch, one level up.
//
// So each source must be non-empty and an empty one is a crash rather than a
// quiet zero. If one of these throws, the shape moved: go and read the file
// named in the message rather than deleting the check.
if (list.size === 0) throw new Error(`${PROBE}: THE_PASSES_WATCHED parsed as empty`);
if (imported.size === 0) throw new Error(`${WORLD}: no sibling imports parsed`);
if (called.size === 0) {
    throw new Error(
        `${WORLD}: the year loop calls nothing that takes the world. Either the loop `
        + 'moved or the call shape did, and this check is now blind.'
    );
}

const missing = [...called].filter(name => !list.has(name)).sort();
const stale = [...list].filter(name => !called.has(name)).sort();

console.log(`${list.size} watched, ${called.size} called with the world in the year loop\n`);
console.log(`CALLED BUT NOT WATCHED (${missing.length}):`);
for (const name of missing) console.log(`  ${name}`);
console.log(`\nWATCHED BUT NOT CALLED (${stale.length}):`);
for (const name of stale) console.log(`  ${name}`);
console.log(
    '\nNeither list is a verdict. The first over-reports by design - a helper that takes'
    + '\nthe world is not a pass - and the second is often a pass the loop reaches through'
    + '\nsomething else. Read the names, then read the loop.'
);

process.exitCode = missing.length > 0 ? 1 : 0;
