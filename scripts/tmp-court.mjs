import fs from 'node:fs';

// ── the Court's ladder, and how the seats are ordered ───────────────────
{
    const f = 'src/data/cultivation/sects.ts';
    const raw = fs.readFileSync(f, 'utf-8');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    let s = raw.split(/\r?\n/).join('\n');
    const need = a => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 60)); };

    need("        ranks: ['Guest of the Court', 'Seated', 'Second Seat', 'First Seat'],\n        admissionOrdinal: 29,\n        stipend: [500, 1_500, 4_000, 12_000],");
    s = s.replace(
        "        ranks: ['Guest of the Court', 'Seated', 'Second Seat', 'First Seat'],\n        admissionOrdinal: 29,\n        stipend: [500, 1_500, 4_000, 12_000],",
        `        // Four rungs, and they line up with four realms exactly: Void
        // Refinement, Body Integration, Grand Ascension, Tribulation
        // Transcendence. Admission at 29 plus the engine's four ordinals per
        // rank lands on 29, 33, 37 and 41, so the ladder needs no special case.
        //
        // "Guest of the Court" is deliberately NOT here. It is honorary, given
        // without discussion, carries no obligation in either direction, and
        // sits outside the ladder rather than beneath it - which is why it can
        // be held by somebody the Court could not promote if it wanted to.
        ranks: ['Outer Disciple', 'Inner Disciple', 'Elder', 'Seat'],
        admissionOrdinal: 29,
        stipend: [500, 1_500, 4_000, 12_000],`
    );

    // the seat ordering, as its own exported fact
    need('export const WITHDRAWN_POWERS: Record<string, WithdrawnPower> = {');
    s = s.replace('export const WITHDRAWN_POWERS: Record<string, WithdrawnPower> = {', `/**
 * How the four Seats are ordered, First through Fourth.
 *
 * Rank first: the highest ordinal holds First Seat, so the Court's
 * \`powerOrdinal\` and its First Seat are the same person by construction.
 *
 * Then age, and the tiebreak runs the way that surprises outsiders: among
 * equals the YOUNGER takes precedence. Two at Tribulation Transcendence
 * Perfection are not separated by who arrived first but by who arrived sooner
 * in a life, because the one who did it in less time has more of the road left
 * and the Court is only interested in the road. A younger Perfection takes an
 * older Perfection's seat, and the older one moves down without ceremony.
 *
 * So a seat is not tenure and cannot be accumulated. Nobody at the Court has
 * ever been demoted for failing; several have been moved down for being
 * overtaken, which is the same event described honestly.
 */
export const SEAT_ORDER = {
    primary: 'Realm ordinal, descending. The highest holds First Seat.',
    tiebreak:
        'Age, ascending. Among equal ordinals the younger holds the higher seat, because reaching the same height in less time leaves more road, and the road is the only thing the Court is measuring.',
    displacement:
        'A seat is held, not owned. Somebody arriving at an equal ordinal younger takes the seat above them and everybody below shifts down one. It is not a demotion and the Court does not treat it as one, which does not make it comfortable.',
    outsideTheLadder:
        'Guest of the Court is honorary, sits outside the four rungs, and is not a seat. It confers nothing and asks nothing.'
} as const;

export const WITHDRAWN_POWERS: Record<string, WithdrawnPower> = {`);

    // the withdrawn note should say what the seats are
    need("        occupiedBy:\n            'The crossing. Everyone seated is working on it continuously,");
    s = s.replace(
        "        occupiedBy:\n            'The crossing. Everyone seated is working on it continuously,",
        "        occupiedBy:\n            'Four Seats, First through Fourth, ordered by ordinal and then by youth. The crossing. Everyone seated is working on it continuously,"
    );

    fs.writeFileSync(f, s.split('\n').join(eol));
    console.log('sects.ts: Court ladder and SEAT_ORDER');
}

// ── the Guest is outside the ladder, not the bottom of it ───────────────
{
    const f = 'src/data/cultivation/wanderers.ts';
    const raw = fs.readFileSync(f, 'utf-8');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    let s = raw.split(/\r?\n/).join('\n');
    const OLD = 'It is real and it is empty. He holds the lowest of the four ranks, was entered on it without discussion,';
    if (!s.includes(OLD)) throw new Error('wanderer affiliation text missing');
    s = s.replace(OLD, 'It is real and it is empty. Guest of the Court sits outside the four rungs rather than beneath them, he was entered on it without discussion,');
    fs.writeFileSync(f, s.split('\n').join(eol));
    console.log('wanderers.ts: Guest is outside the ladder');
}

// ── the People row names the seat it actually is ───────────────────────
{
    const f = 'src/web/register.ts';
    const raw = fs.readFileSync(f, 'utf-8');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    let s = raw.split(/\r?\n/).join('\n');
    const need = a => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 60)); };

    need("                    name: 'strongest of ' + withdrawn.count + ' seated',");
    s = s.replace(
        "                    name: 'strongest of ' + withdrawn.count + ' seated',",
        "                    name: 'First Seat',"
    );
    need("                        + ' The register holds one ordinal for the seats, the strongest;'\n                        + ' where the other three stand is not recorded anywhere.'");
    s = s.replace(
        "                        + ' The register holds one ordinal for the seats, the strongest;'\n                        + ' where the other three stand is not recorded anywhere.'",
        "                        + ' Seats run First to Fourth by ordinal and then by youth, so First Seat'\n                        + ' is this ordinal by construction. Where the other three stand is not recorded.'"
    );
    s = s.replace(
        '                // The ordinal is the strongest of them, which is what powerOrdinal',
        '                // First Seat is the highest ordinal by the Court\\'s own rule, so this\\n                // is not an approximation: powerOrdinal and First Seat are the same\\n                // person. The ordinal is the strongest of them, which is what powerOrdinal'
    );
    fs.writeFileSync(f, s.split('\n').join(eol));
    console.log('register.ts: the seat row is First Seat');
}
