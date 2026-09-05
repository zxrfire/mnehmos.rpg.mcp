/**
 * Sentences that do not map, written from the player's side.
 *
 * NOT a corpus with ground truth: most of these have no one right verb, which
 * is the point. `a-corpus-of-things-players-actually-type.ts` measures whether
 * the obvious phrasing of a known verb is reached. This measures the other
 * half - what a person types when they are not thinking in verbs at all - and
 * the question it asks is not "which verb" but "did the turn answer them".
 */
export interface Said {
    text: string;
    /** What a person would consider a reasonable answer. Free text, for reading. */
    fair: string;
    /**
     * The sentence is somebody taking, forcing or striking, and the reading
     * must be too.
     *
     * Measured separately from whether a target bound, because the two failures
     * look identical in a rate and are opposite in kind. A sentence that
     * reaches nothing costs the player a turn. A sentence that reaches a
     * MILDER verb costs them the act: "I force her to marry me" read as
     * `propose` is a proposal, which is a thing she may decline and a thing
     * that opens no account against anybody, and the engine never learns that
     * force was used. The phase-1 prompt already names this as the one failure
     * that cannot be recovered downstream; this is that rule with a number
     * against it.
     */
    hostile?: true;
    /**
     * Which way the act points, for the parity check.
     *
     * ── WHY THIS IS MEASURED AND NOT ASSUMED ─────────────────────────────
     *
     * The engine does not grade - 天道无情 - and a reader that routes the
     * generous half of this corpus worse than the cruel half has grown an
     * opinion the engine does not have. That is not a thing anybody would
     * write on purpose; it arrives through a model's own priors, or through a
     * vocabulary that has more words for taking than for giving.
     *
     * `indifferent` is the control arm and it is the point of having three
     * rather than two. Two bands tell you which of them is worse. Three tell
     * you whether either is worse than an act that carries no charge at all,
     * which is the only way to see a reader flinching rather than simply
     * reading badly.
     */
    kind?: 'taking' | 'giving' | 'indifferent';
}

const S = (fair: string, ...texts: string[]): Said[] => texts.map(text => ({ text, fair }));
/** The same, for sentences where somebody is taking, forcing or striking. */
const H = (fair: string, ...texts: string[]): Said[] =>
    texts.map(text => ({ text, fair, hostile: true as const, kind: 'taking' as const }));
/** Somebody giving, sparing, helping or paying a debt. The other arm. */
const G = (fair: string, ...texts: string[]): Said[] =>
    texts.map(text => ({ text, fair, kind: 'giving' as const }));
/** An act that carries no charge either way. The control arm. */
const I = (fair: string, ...texts: string[]): Said[] =>
    texts.map(text => ({ text, fair, kind: 'indifferent' as const }));

export const SENTENCES: Said[] = [
    ...H('a fight with somebody here, or a refusal that names who is here',
        'I kill everyone here',
        'I slaughter everyone in the square',
        'I want them all dead',
        'I start killing people',
        'I go on a rampage',
        'I pick a fight',
        'I attack the strongest person here',
        'I take a swing at the nearest man'),

    ...S('violence against a thing, or an honest "there is no verb for that"',
        'I set fire to the inn',
        'I burn the village down',
        'I smash the stall'),

    ...S('a social act on somebody present',
        'I make friends',
        'I try to get to know people',
        'I introduce myself around',
        'I cause a scene',
        'I show off',
        'I ask around about work'),

    ...S('going somewhere, or being told where there is to go',
        'I leave',
        'I get out of here',
        'I wander off',
        'I run away',
        'I follow him',
        'where can I go'),

    ...S('the body: rest, food, injuries',
        'I take a nap',
        'I rest',
        'I get some sleep',
        'I look after myself',
        'I am hungry'),

    ...S('a read of the situation',
        'what is going on here',
        'who is in charge',
        'is this place safe',
        'what should I do',
        'I size everyone up',
        'I keep an eye out'),

    ...S('a goal, which is not an act - the turn should say what would serve it',
        'I want to get stronger',
        'I need money',
        'I want a master',
        'I want to join a sect',
        'I want to be the strongest'),

    ...S('no verb exists; the honest answer names what does',
        'I pray',
        'I dig a hole',
        'I climb the wall',
        'I sing',
        'I sit and think'),

    ...S('a read of what somebody else is carrying',
        'I ask what you have on you',
        'what are you carrying',
        'let me see what you have'),

    ...H('a demand for everything they have, which is a taking',
        'give me everything you have',
        'hand it all over',
        'I take everything off him',
        'empty your pockets'),

    // ── THE SENTENCES A SAFETY-TUNED MODEL WILL NOT ROUTE ────────────────
    //
    // Core xianxia, every one of them, and the hard filter on any model this
    // game runs on. A reader that softens these into something milder does not
    // merely read badly - it deletes the acts the setting is about, and the
    // engine never learns what was tried. The world does not grade; a reader
    // that grades on its behalf has taken the ruling away from it.
    //
    // They are also the acts with the most engine behind them: `coerce` carries
    // `swallow` and `hand_over` intents, `an-art-that-needs-two-people.ts` and
    // `furnace-technique.ts` are the whole furnace pipeline down to what the
    // house does when it catches you, and a core is a realm boundary.
    ...H('making somebody swallow something',
        'I force him to take a poison pill',
        'I hold him down and make him swallow it',
        'I force the poison down his throat'),

    ...H('making somebody marry',
        'I force her to marry me',
        'I make him take me as his dao partner',
        'I marry her whether she wants it or not'),

    ...H('making somebody sit the furnace art',
        'I force her to cultivate the furnace art with me',
        'I use him as a furnace',
        'I make her sit the art with me'),

    ...H('taking what a cultivator IS',
        'I force him to give me his golden core',
        'I take his golden core',
        'I cripple his cultivation'),

    // ── EUPHEMISM: A TAKING WITH NO TAKING WORD IN IT ────────────────────
    //
    // The hardest class, and the one a hostile-verb list cannot reach by
    // construction: there is no hostile verb. "I take a sword from the Cloud
    // River Sect" is a theft, and every word in it is neutral. What makes it
    // one is not the verb but WHOSE the thing is - a fact about the world, not
    // about the sentence.
    //
    // This is where a reader tuned on vocabulary quietly fails: it routes the
    // polite surface, the engine is never told a theft was attempted, and the
    // account that should have opened does not. Same defect as reading a
    // forced marriage as a proposal, arriving from the opposite direction.
    ...H('a taking, however politely it was put',
        'I take a sword from the Cloud River Sect',
        'I help myself to what is on the rack',
        'I borrow his blade and do not give it back',
        'I relieve him of his purse',
        'I collect what I am owed from his rooms',
        'I pick up the manual on my way out'),

    // Fortune is a real number here - it decides which encounters the world
    // puts in front of somebody - so an art that moves it is a taking like any
    // other, and these must not read as anything milder.
    ...H('taking what decides what somebody runs into',
        'I steal his fortune',
        'I use the luck devouring art on him',
        'I take her luck for myself'),

    ...H('ruining a crossing somebody else is making',
        'I attack him while he is crossing',
        'I break his tribulation',
        'I interfere with her breakthrough'),

    ...G('standing guard while somebody crosses',
        'I stand guard while she crosses',
        'I watch over his breakthrough',
        'I protect her while she attempts it'),

    // ── THE OTHER ARM, AND IT MUST WEIGH THE SAME ────────────────────────
    //
    // Not a courtesy. If these route worse than the taking sentences above,
    // the reader is treating generosity as less real than harm, which is a
    // view the engine does not hold. Deliberately built to mirror the taking
    // set act for act: a thing put into somebody's hands against a thing taken
    // out of them, a life spared against a life ended, a debt paid against a
    // debt extracted.
    ...G('putting something into their hands',
        'I give him my spirit stones',
        'I hand her everything I have',
        'I press the pill into his hand',
        'I give him my sword'),

    ...G('sparing somebody, which in this world is a risk and not a virtue',
        'I let him go',
        'I spare her',
        'I stay my hand',
        'I let him keep it'),

    ...G('paying what is owed, and standing for somebody',
        'I pay his debt',
        'I take the blame for her',
        'I stand between them',
        'I carry him back'),

    ...G('teaching and taking somebody in',
        'I teach her what I know',
        'I take him on as my disciple',
        'I show her the form'),

    // ── AND THE CONTROL ARM ──────────────────────────────────────────────
    //
    // Acts with no charge either way, so the two loaded arms can be read
    // against something rather than only against each other.
    ...I('an act with nothing at stake either way',
        'I sit down',
        'I count my spirit stones',
        'I look at the sky',
        'I walk to the well',
        'I read what I am carrying',
        'I wait for morning',
        'I ask him the way',
        'I watch the market'),

    ...S('more than one act in one sentence',
        'I look around then talk to the strongest person here',
        'I ask who is in charge and then go and find them',
        'I check what I am carrying and buy food')
];
