/**
 * Is the player DRIVEN, and can they act on it?
 *
 * The world simulation is in good order - 95% of its living cultivators have a
 * position the engine can account for, houses raise people, seats run out, and
 * books stop carrying. None of that reaches a player unless the game will
 * answer four questions when they are asked in the words a person would use:
 *
 *   WHY AM I STUCK      the pressure is worthless if it is silent. A ceiling
 *                       nobody is told about is indistinguishable from a slow
 *                       game.
 *   WHERE CAN I GO      the answer to being stuck is to leave. If the player
 *                       cannot find out where, the pressure has no outlet.
 *   WHO CAN TEACH ME    progress is meant to slow without a master and stop
 *                       without a book, so finding people is a core verb.
 *   WHO WOULD TAKE ME   joining a sect, and then LEAVING IT FOR A BETTER ONE,
 *                       is the spine of a career in this setting.
 *
 * This asks each in several plain phrasings, because a verb that only fires on
 * one exact sentence is not a verb a player has. It reports what came back, and
 * counts a phrasing as refused when the engine returns its "that does not
 * resolve into anything" line - which is the honest signal that nothing was
 * understood.
 *
 *   node scripts/playtest-the-drive.mjs [port]
 */

const port = process.argv[2] ?? '8891';

const REFUSAL = /does not resolve into anything|nothing you could actually do/i;

/**
 * A reply can fail to be an answer without refusing.
 *
 * The first version of this counted anything that was not the engine's refusal
 * line as an answer, and reported that every question was answerable. It was
 * not: "who could guide my cultivation" returned the CHARACTER SHEET, and
 * "I look for a master" returned the room description. Both are perfectly good
 * responses to some other question, and neither tells the player a single thing
 * about a teacher.
 *
 * So a reply now has to contain something the question was actually about. This
 * is a keyword test and it is crude, but it is far less crude than "did the
 * engine say the refusal sentence", and it catches the failure mode that
 * matters - a game that appears to understand everything and answers nothing.
 */
const DEFLECTIONS = [
    /Spirit root:.*Might \d/i,          // the character sheet
    /The air here is (unremarkable|thin|dense)/i   // the room, unasked
];

/** What a real answer to each question has to mention. */
const RELEVANT = {
    'WHY AM I STUCK': /ceiling|carries you|no further|manual|technique|cap|as far as|stopped|exhaust/i,
    'WHERE CAN I GO': /places?:|travel|days|road|region|vein|Sweptground|Low Fall|Marches|nearby/i,
    'WHO CAN TEACH ME': /teach|master|guide|elder|instruct|stands at .* and could|above you/i,
    'WHO WOULD TAKE ME': /sect|admits|accept|join|apply|serves no/i
};

const ASKS = {
    'WHY AM I STUCK': [
        'why am I not making progress',
        'am I stuck',
        'how far will my technique take me',
        'what is my ceiling',
        'what is stopping me'
    ],
    'WHERE CAN I GO': [
        'where can I go',
        'what places do I know of',
        'I want to travel somewhere else',
        'where is there better spiritual energy',
        'what is nearby'
    ],
    'WHO CAN TEACH ME': [
        'who can teach me',
        'I look for a master',
        'is there anyone here stronger than me',
        'I ask about a teacher',
        'who could guide my cultivation'
    ],
    'WHO WOULD TAKE ME': [
        'what sects are there',
        'I want to join a sect',
        'which sects would accept me',
        'I apply to a sect',
        'can I leave my sect'
    ]
};

/**
 * The API answers in two shapes and a harness that reads one of them lies.
 *
 * `/api/act` returns `{ narration }` while the run is live and `{ error }` once
 * it is not - and the error is a good sentence, not a failure: "Work Death is
 * dead (combat_defeat). The run is closed: there is no reload, no revival, and
 * no continuation." A probe that only looks for `narration` prints that as
 * empty output, which reads exactly like the engine silently doing nothing.
 *
 * I nearly filed that as a bug. Three separate times in one session a harness
 * of mine read the wrong field and produced a finding about the engine that was
 * a finding about the harness - `factionId` where the player carries `sectId`,
 * `techniqueIds` where the player carries `knownTechniques`, and this. Read
 * both, and say which one answered.
 */
const reply = d => {
    if (typeof d?.narration === 'string' && d.narration.length > 0) return d.narration;
    if (typeof d?.error === 'string') return `[refused] ${d.error}`;
    return '';
};

const post = async (path, body) => {
    const r = await fetch(`http://localhost:${port}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    }).catch(() => null);
    if (!r) return {};
    try { return await r.json(); } catch { return {}; }
};

const state = async () => {
    const r = await fetch(`http://localhost:${port}/api/state`).catch(() => null);
    if (!r) return null;
    try { return (await r.json()).cultivator; } catch { return null; }
};

const line = (s = '') => console.log(s);
const rule = t => { line(); line('='.repeat(88)); line('  ' + t); line('='.repeat(88)); };

const s = await state();
if (!s) {
    console.error(`No game at localhost:${port}. Start one with: node dist/web/server.js`);
    process.exit(1);
}

rule('WHO IS PLAYING');
line(`  ${s.name}, ${s.rankName ?? `ordinal ${s.realmOrdinal}`}, age ${Math.round(s.age)}`);
line(`  root ${s.spiritRoot}   stones ${s.spiritStones}   sect ${s.factionId ?? 'none'}`);
line(`  techniques held: ${(s.techniqueIds ?? []).length}`);

const scores = {};
for (const [question, phrasings] of Object.entries(ASKS)) {
    rule(question);
    let answered = 0;
    let deflections = 0;
    for (const p of phrasings) {
        const r = await post('/api/act', { input: p });
        const text = reply(r).replace(/\s+/g, ' ').trim();
        const refused = text === '' || REFUSAL.test(text);
        const deflected = !refused
            && (DEFLECTIONS.some(d => d.test(text)) || !RELEVANT[question].test(text));
        const verdict = refused ? 'REFUSED  ' : deflected ? 'DEFLECTED' : 'answered ';
        if (!refused && !deflected) answered++;
        else if (deflected) deflections++;
        line(`  ${verdict}  "${p}"`);
        if (!refused) line(`             ${text.slice(0, 180)}`);
    }
    scores[question] = { answered, deflections, of: phrasings.length };
}

rule('WHETHER THE PLAYER CAN ACT ON THE PRESSURE');
line();
for (const [q, v] of Object.entries(scores)) {
    const bar = '#'.repeat(v.answered) + '~'.repeat(v.deflections)
        + '.'.repeat(v.of - v.answered - v.deflections);
    line(`  ${q.padEnd(20)} ${bar}  ${v.answered} answered, ${v.deflections} deflected, `
        + `${v.of - v.answered - v.deflections} refused`);
}
line();
line('  # answered   ~ replied without answering   . refused outright');
const dead = Object.entries(scores).filter(([, v]) => v.answered === 0);
line();
if (dead.length === 0) {
    line('  Every question a driven player would ask is answerable in ordinary words.');
    const thin = Object.entries(scores).filter(([, v]) => v.answered <= 1);
    if (thin.length > 0) {
        line();
        line('  BUT ONLY JUST. These answer on one phrasing in five, which is a verb the');
        line('  player has to guess rather than one they have:');
        for (const [q, v] of thin) line(`    ${q}  (${v.answered}/${v.of})`);
    }
} else {
    line('  UNASKABLE. The engine models the pressure and the player cannot act on it:');
    for (const [q] of dead) line(`    ${q}`);
    line();
    line('  A ceiling nobody can ask about is not a ceiling, it is a slow game.');
}
line();
