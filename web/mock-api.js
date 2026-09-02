/* ══════════════════════════════════════════════════════════════════════
   DEV-ONLY MOCK - never loaded in production.

   app.js dynamically imports this module only when the URL carries ?mock=1,
   so in a normal deployment the file is never fetched and window.fetch is
   never patched. It exists so every screen can be exercised without a
   backend; it is NOT a second source of truth for game rules.

   Query flags (all optional, all alongside ?mock=1):
     &scenario=fresh|play|peril|ready|tribulation|dead|ascended
     &outcome=success|failure_stable|failure_injured|failure_deviation|death
     &admin=0            turn admin mode off
     &fail=act,cultivate,breakthrough,state,ledger,roster,ladder,roots,health
   ══════════════════════════════════════════════════════════════════════ */

/* ───────────────────────── deterministic rng ───────────────────────── */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(0x9e3779b9);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

/* ───────────────────────── ladder (engine parity) ───────────────────────── */

/** The engine sentinel for a span that has stopped being a quantity. */
const UNBOUNDED_LIFESPAN_YEARS = 1e9;

// Mirrors REALM_TIERS in engine/cultivation/realms.ts. Only five realms count
// Early/Mid/Late/Perfection; the rest have vocabulary of their own, and getting
// that wrong here is worse than useless - the mock exists so the client can be
// exercised against something shaped like the engine, and a mock that disagrees
// about the shape tests the client against a world that does not exist.
const REALMS = [
  { key: 'qi_condensation', name: 'Qi Condensation', start: 0, end: 12, lifespanYears: 100, subRanks: Array.from({ length: 13 }, (_, i) => `Layer ${i + 1}`) },
  { key: 'foundation_establishment', name: 'Foundation Establishment', start: 13, end: 16, lifespanYears: 200, subRanks: ['Early', 'Mid', 'Late', 'Perfection'] },
  { key: 'core_formation', name: 'Core Formation', start: 17, end: 20, lifespanYears: 500, subRanks: ['Early', 'Mid', 'Late', 'Perfection'] },
  { key: 'nascent_soul', name: 'Nascent Soul', start: 21, end: 24, lifespanYears: 1000, subRanks: ['Early', 'Mid', 'Late', 'Perfection'] },
  { key: 'deity_transformation', name: 'Deity Transformation', start: 25, end: 28, lifespanYears: 2000, subRanks: ['First Turn', 'Second Turn', 'Third Turn', 'Final Turn'] },
  { key: 'void_refinement', name: 'Void Refinement', start: 29, end: 32, lifespanYears: 5000, subRanks: ['First Tempering', 'Second Tempering', 'Third Tempering', 'Final Tempering'] },
  { key: 'body_integration', name: 'Body Integration', start: 33, end: 36, lifespanYears: 10000, subRanks: ['Sinew', 'Bone', 'Organ', 'Marrow'] },
  { key: 'grand_ascension', name: 'Grand Ascension', start: 37, end: 40, lifespanYears: 30000, subRanks: ['Rising Body', 'Rising Soul', 'Rising Name', 'Rising Dao'] },
  { key: 'tribulation_transcendence', name: 'Tribulation Transcendence', start: 41, end: 44, lifespanYears: 100000, subRanks: ['Early', 'Mid', 'Late', 'Perfection'] },
  // The two rungs above the Lid, and the only realm whose rungs differ from
  // each other: 45 is a vast countable span, 46 is the unbounded sentinel. They
  // are also the only ranks named adjective-first with no realm prefix - the
  // name is "False Immortal", not "Immortal False".
  { key: 'immortal', name: 'Immortal', start: 45, end: 46, lifespanYears: UNBOUNDED_LIFESPAN_YEARS, subRanks: ['False', 'True'] }
];
const MAX_ORDINAL = 46;
/** Mirrors src/schema/cultivation.ts. The mock states the same numbers the engine does. */
// Open channel wounds at which a body stops mending itself. NOT a death
// threshold - the engine's name for it is CRIPPLING_UNTREATED_INJURIES and the
// old one is kept here only to match the identifiers already used below.
const LETHAL_UNTREATED_INJURIES = 3;
/** The rung the crossing lands on when it does not complete. */
const FALSE_IMMORTAL_ORDINAL = 45;
const FALSE_IMMORTAL_LIFESPAN_YEARS = 300000;
/**
 * The settling clock. 50 is a FLOOR, not the figure: above Foundation
 * Establishment a rung credits a fifth of the span its realm grants, so Core
 * Formation is 100 and Tribulation Transcendence is 20,000. The client used to
 * carry a flat 50 and say "fifty years without advancing is fatal" to all of
 * them; it now reads this off `derived`, and the mock has to state it or
 * offline play goes back to being wrong in exactly the same way.
 */
const STAGNATION_YEARS = 50;
const STAGNATION_LIFESPAN_FRACTION = 0.2;
/** Mirrors breakthrough.ts. The share of a rung's span spent before age costs odds. */
const LIFESPAN_PRESSURE_ONSET = 0.5;
const MAX_LIFESPAN_PRESSURE = -0.2;

const clampOrd = (o) => Math.max(0, Math.min(MAX_ORDINAL, Math.floor(Number(o) || 0)));
const realmFor = (o) => REALMS.find((t) => clampOrd(o) >= t.start && clampOrd(o) <= t.end);
const subRankFor = (o) => { const t = realmFor(o); return t.subRanks[clampOrd(o) - t.start]; };
const rankName = (o) => {
    const t = realmFor(o);
    const sub = subRankFor(o);
    if (!sub) return t.name;
    // The one realm that reads adjective-first: "False Immortal", "True
    // Immortal". Everywhere else the realm leads.
    if (t.key === 'immortal') return `${sub} ${t.name}`;
    return `${t.name} ${sub}`;
};
const lifespanFor = (o) => (clampOrd(o) === FALSE_IMMORTAL_ORDINAL
  ? FALSE_IMMORTAL_LIFESPAN_YEARS
  : realmFor(o).lifespanYears);
const stagnationYearsFor = (o) => Math.max(
  STAGNATION_YEARS,
  lifespanFor(o) * STAGNATION_LIFESPAN_FRACTION
);
/** `lifespanPressure(ordinal, age)` - a fraction of THIS rung's span, never an absolute age. */
const lifespanPressureFor = (o, age) => {
  const span = lifespanFor(o);
  if (!(span > 0) || !Number.isFinite(age)) return 0;
  const spent = Math.max(0, Math.min(1, age / span));
  if (spent <= LIFESPAN_PRESSURE_ONSET) return 0;
  return MAX_LIFESPAN_PRESSURE * ((spent - LIFESPAN_PRESSURE_ONSET) / (1 - LIFESPAN_PRESSURE_ONSET));
};
const isBoundary = (o) => {
  const c = clampOrd(o);
  if (c >= MAX_ORDINAL) return false;
  return realmFor(c).key !== realmFor(c + 1).key;
};
/**
 * Null above the Lid, exactly as the engine returns it.
 *
 * Immortal qi is not this currency and there is no exchange rate, so there is
 * no number to send. The mock must return the same null or the client's
 * handling of it never gets exercised here - which is the whole point of the
 * mock. Below the Lid the curve is strictly increasing: it no longer halves at
 * realm boundaries the way an earlier version did, so a higher rung is never
 * cheaper than a lower one.
 */
const progressRequired = (o) => {
  const c = clampOrd(o);
  if (c >= FALSE_IMMORTAL_ORDINAL) return null;
  const t = realmFor(c);
  return Math.round(100 * Math.pow(1.35, c) + (c - t.start) * 50 + c * 40);
};
/** The same figure with the not-in-this-currency case collapsed, for arithmetic. */
const progressRequiredOrZero = (o) => progressRequired(o) || 0;
const baseChance = (o) => {
  const c = clampOrd(o);
  const v = Math.max(0.1, 0.9 - c * 0.014) * (isBoundary(c) ? 0.45 : 1);
  return Number(Math.max(0, Math.min(1, v)).toFixed(4));
};

function fullLadder() {
  return Array.from({ length: MAX_ORDINAL + 1 }, (_, ordinal) => ({
    ordinal,
    realm: realmFor(ordinal).name,
    realmKey: realmFor(ordinal).key,
    subRank: subRankFor(ordinal),
    name: rankName(ordinal),
    lifespanYears: lifespanFor(ordinal),
    isBoundary: isBoundary(ordinal),
    progressRequired: progressRequired(ordinal),
    baseBreakthroughChance: baseChance(ordinal)
  }));
}

/* ───────────────────────── spirit roots (engine parity) ───────────────────────── */

const ROOTS = [
  { key: 'single_metal', name: 'Single Metal Root', grade: 'single', elements: ['metal'], weight: 81, cultivationSpeed: 1.5, description: 'Pure metal affinity. Metal arts advance twice as fast.' },
  { key: 'single_wood', name: 'Single Wood Root', grade: 'single', elements: ['wood'], weight: 81, cultivationSpeed: 1.5, description: 'Long vitality, strong at healing.' },
  { key: 'single_water', name: 'Single Water Root', grade: 'single', elements: ['water'], weight: 81, cultivationSpeed: 1.5, description: 'Dense, sustained qi.' },
  { key: 'single_fire', name: 'Single Fire Root', grade: 'single', elements: ['fire'], weight: 81, cultivationSpeed: 1.5, description: 'Sharp offensive power.' },
  { key: 'single_earth', name: 'Single Earth Root', grade: 'single', elements: ['earth'], weight: 81, cultivationSpeed: 1.5, description: 'A rock-solid foundation.' },
  { key: 'dual_water_fire', name: 'Water-Fire Dual Root', grade: 'dual', elements: ['water', 'fire'], weight: 90, cultivationSpeed: 1.0, description: 'Two elements that put each other out. Cultivating either art risks qi deviation every turn.' },
  { key: 'dual_metal_wood', name: 'Metal-Wood Dual Root', grade: 'dual', elements: ['metal', 'wood'], weight: 90, cultivationSpeed: 1.0, description: 'Metal cuts wood, and it does so inside your meridians. Qi deviation is a standing risk.' },
  { key: 'triple_metal_wood_earth', name: 'Metal-Wood-Earth Triple Root', grade: 'triple', elements: ['metal', 'wood', 'earth'], weight: 99, cultivationSpeed: 0.85, description: 'Three elements in an overcoming chain. Two of them fight on the way in; only earth arrives clean.' },
  { key: 'quad_metal_wood_earth_water', name: 'Metal-Wood-Earth-Water Quad Root', grade: 'quad', elements: ['metal', 'wood', 'earth', 'water'], weight: 117, cultivationSpeed: 0.7, description: 'Four elements and one gap where fire should be. The gap saves nothing; the intake is already divided four ways.' },
  { key: 'muddled_five_element', name: 'Five-Element Muddled Root', grade: 'muddled', elements: ['metal', 'wood', 'water', 'fire', 'earth'], weight: 144, cultivationSpeed: 0.55, description: 'All five elements, none of them clean. Cultivation crawls.' },
  { key: 'mutated_lightning', name: 'Mutated Lightning Root', grade: 'mutated', elements: ['lightning'], weight: 27, cultivationSpeed: 1.8, description: 'Lightning attacks with nothing standing behind them. Techniques for this root are extremely scarce.' },
  { key: 'mutated_ice', name: 'Mutated Ice Root', grade: 'mutated', elements: ['ice'], weight: 27, cultivationSpeed: 1.8, description: 'Freezes all things, but backlash comes easily.' }
];
const WEIGHT_TOTAL = ROOTS.reduce((s, r) => s + r.weight, 0);
const rootsPayload = () => ({
  roots: ROOTS.map((r) => ({
    key: r.key, name: r.name, grade: r.grade, elements: r.elements,
    probability: Number((r.weight / WEIGHT_TOTAL).toFixed(6)),
    cultivationSpeed: r.cultivationSpeed, description: r.description
  })),
  attributes: [
    { key: 'might', name: 'Might', min: 1, max: 3, description: 'Physical force - what you can take, and what you can put through someone.' },
    { key: 'insight', name: 'Insight', min: 1, max: 4, description: 'Comprehension - how quickly you understand techniques and situations.' },
    { key: 'fortune', name: 'Fortune', min: 0, max: 3, description: 'Luck. It can legally come up zero, and for most people it does.' },
    { key: 'charm', name: 'Charm', min: 1, max: 3, description: "How the world's people respond to you before you have proved anything." }
  ]
});

function rollRoot() {
  let cursor = rng() * WEIGHT_TOTAL;
  for (const r of ROOTS) { cursor -= r.weight; if (cursor < 0) return r; }
  return ROOTS[ROOTS.length - 1];
}
const rootByKey = (k) => ROOTS.find((r) => r.key === k) || ROOTS[0];

/* ───────────────────────────── world flavour ───────────────────────────── */

const SURNAMES = ['Shen', 'Lin', 'Bai', 'Xu', 'Mo', 'Yun', 'Han', 'Jiang', 'Qiu', 'Ye', 'Tang', 'Fang', 'Wei', 'Zhao', 'Gu', 'Su', 'Luo', 'Cheng', 'Yan', 'Xue'];
const GIVEN = ['Wuyou', 'Qingzhu', 'Lanyin', 'Zhaoxu', 'Feiyan', 'Yuanming', 'Shuang', 'Cangyue', 'Ruoxi', 'Hanjiang', 'Jinglan', 'Baiye', 'Ziyuan', 'Muqing', 'Tianhe', 'Wanyi', 'Chenxi', 'Yaoguang', 'Nianzhen', 'Sique', 'Jiuli', 'Xingchen'];

const SECTS = [
  { id: 'sect_azure', name: 'Azure Cloud Sect', ranks: ['Outer Disciple', 'Inner Disciple', 'Core Disciple', 'Elder', 'Grand Elder', 'Patriarch'] },
  { id: 'sect_serpent', name: 'Nine Serpent Pavilion', ranks: ['Servant', 'Initiate', 'Venom Disciple', 'Elder', 'Hall Master'] },
  { id: 'sect_ember', name: 'Crimson Ember Hall', ranks: ['Cinderhand', 'Emberhand', 'Flame Disciple', 'Elder', 'Hall Master'] },
  { id: 'sect_frost', name: 'Frostroot Valley', ranks: ['Tender', 'Rootkeeper', 'Valley Disciple', 'Elder', 'Valley Lord'] },
  { id: 'sect_ledger', name: 'Iron Ledger Guild', ranks: ['Clerk', 'Factor', 'Broker', 'Ledger Master'] }
];
const LOCATIONS = ['Greenwater Town', 'Stonefall Market', 'Azure Cloud Peak', 'Bitter Sea Coast', 'The Thousand Steps', 'The Drawn Fields', 'Nameless Ravine', 'Frostroot Valley', 'Serpent Hollow', 'Cangyan Ruins'];
const DEATH_CAUSES = ['combat_defeat', 'lifespan_exhausted', 'untreated_injuries', 'starvation', 'failed_breakthrough', 'qi_deviation', 'heavenly_tribulation', 'stagnation_aging', 'obviously_fatal_choice'];
const INJURY_DESCS = [
  'Third meridian of the left arm torn end to end.',
  'Hairline fracture through the wall of the core.',
  'Qi scarring across the heart meridian.',
  'Frostbite in the lower meridians that never fully thawed.',
  'A sword wound that closed badly and pulls at every circulation.',
  'Backlash burns lining the throat and chest.'
];

let nameCursor = 0;
function mockName() {
  nameCursor++;
  // Unique for the first SURNAMES.length * GIVEN.length names.
  return `${SURNAMES[nameCursor % SURNAMES.length]} ${GIVEN[Math.floor(nameCursor / SURNAMES.length) % GIVEN.length]}`;
}

function uuid() {
  const h = () => Math.floor(rng() * 0x10000).toString(16).padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`;
}

/* ───────────────────────────── mock world ───────────────────────────── */

const W = {
  cfg: { scenario: 'fresh', outcome: '', admin: true, fail: new Set() },
  run: null,
  cultivator: null,
  ambient: 'normal',
  log: [],
  ledger: [],
  roster: [],
  tolls: []
};

function newInjury(source, turn) {
  return {
    id: uuid(),
    severity: pick(['minor', 'minor', 'serious', 'crippling']),
    source,
    description: pick(INJURY_DESCS),
    sustainedOnTurn: turn,
    treated: false,
    cultivationPenalty: 0.1,
    breakthroughPenalty: 0.05
  };
}

function makeCultivator(name) {
  const root = rollRoot();
  return {
    id: uuid(),
    name,
    kind: 'pc',
    spiritRoot: root.key,
    attributes: { might: between(1, 3), insight: between(1, 4), fortune: between(0, 3), charm: between(1, 3) },
    realmOrdinal: 0,
    cultivationProgress: 0,
    hp: 30, maxHp: 30,
    qi: 10, maxQi: 10,
    satiety: 100,
    starvationTurns: 0,
    bleedingTurns: 0,
    age: 16,
    yearsAtCurrentRealm: 0,
    injuries: [],
    spiritStones: 30,
    sectId: null,
    sectRank: null,
    feuds: [],
    knownTechniques: [],
    alive: true,
    deathCause: null,
    foundationQuality: 'none',
    nameTaken: false,
    immortalStatus: 'none',
    existenceState: 'alive',
    soulState: 'intact',
    identityContinuity: 1,
    bodyId: null
  };
}

function makeRun(cultivatorId) {
  return {
    id: uuid(),
    cultivatorId,
    status: 'active',
    turn: 0,
    elapsedDays: 0,
    deathCause: null,
    deathDescription: null,
    peakOrdinal: 0
  };
}

function derived() {
  const c = W.cultivator;
  if (!c) return null;
  const o = c.realmOrdinal;
  const next = o < MAX_ORDINAL ? o + 1 : null;
  const req = progressRequired(o);
  const untreated = c.injuries.filter((i) => !i.treated).length;
  return {
    rankName: rankName(o),
    nextRankName: next != null ? rankName(next) : null,
    realmName: realmFor(o).name,
    progressRequired: req,
    // `req` is null above the Lid, and `anything >= null` coerces to
    // `anything >= 0` - which is true, and would report a cultivator standing
    // on the summit as ready to break through it. The null has to be tested
    // before it is compared.
    breakthroughReady: req !== null && c.cultivationProgress >= req && next != null && c.immortalStatus === 'none',
    lifespanRemaining: Math.max(0, (c.immortalStatus === 'false_immortal' ? FALSE_IMMORTAL_LIFESPAN_YEARS : lifespanFor(o)) - c.age),
    // The whole span, the settling clock, and what the span already spent is
    // worth to the next crossing. The client shows "16 of 100" and "0 of 50"
    // and says which runs out first; none of those three numbers may be
    // invented in the browser.
    lifespanYears: c.immortalStatus === 'false_immortal' ? FALSE_IMMORTAL_LIFESPAN_YEARS : lifespanFor(o),
    stagnationYears: stagnationYearsFor(o),
    lifespanPressure: lifespanPressureFor(o, c.age),
    lifespanPressureFromAge: lifespanFor(o) * LIFESPAN_PRESSURE_ONSET,
    untreatedInjuries: untreated,
    // Mirrors the real derivedView. `turnsUntilBleedOut` and `bleedOutTurns`
    // stood here and were a countdown to a death that no longer happens - a
    // torn channel is a torn muscle. See docs/world/injuries.md.
    daysChannelsOpen: Math.max(0, Math.round(c.bleedingTurns || 0)),
    injuryRatePenalty: Math.min(0.9, Number((0.25 * untreated).toFixed(4))),
    sectName: (SECTS.find(x => x.id === c.sectId) || {}).name || null,
    foundationQuality: c.foundationQuality || 'none',
    nameTaken: !!c.nameTaken,
    // Mirrored from the cultivator so the client can read it from either.
    immortalStatus: c.immortalStatus || 'none',
    // The engine's own refusal text, so the control can state its case.
    breakthroughBlockedReason: blockedReason(c, req)
  };
}

/** Plain English for the engine's machine-readable ineligibility reasons. */
function blockedReason(c, req) {
    if (c.immortalStatus !== 'none') {
        return 'Permanently barred. The Lid has already been opened once against this name, '
            + 'and it does not open again for anyone it has already been opened for.';
    }
    if (c.realmOrdinal >= MAX_ORDINAL) {
        return 'There is no rung above this one. What is left is the Lid.';
    }
    if (c.cultivationProgress < req) {
        return `Not enough has accumulated: ${Math.round(c.cultivationProgress)} of ${req} qi-units. `
            + 'The barrier does not care how badly you want it.';
    }
    return null;
}

const statePayload = () => ({
  run: W.run,
  cultivator: W.cultivator,
  ambient: W.ambient,
  derived: derived(),
  tolls: W.tolls,
  log: W.log
});

function say(role, text) {
  W.log.push({ role, text, turn: W.run ? W.run.turn : 0 });
}

function killRun(cause, description) {
  W.cultivator.alive = false;
  W.cultivator.deathCause = cause;
  W.run.status = 'dead';
  W.run.deathCause = cause;
  W.run.deathDescription = description;
  say('engine', `DEATH. Cause: ${cause}. Run closed at turn ${W.run.turn}.`);
  W.ledger.unshift({
    id: W.run.id,
    name: W.cultivator.name,
    peakOrdinal: W.run.peakOrdinal,
    peakRankName: rankName(W.run.peakOrdinal),
    turn: W.run.turn,
    elapsedDays: Math.round(W.run.elapsedDays),
    deathCause: cause,
    deathDescription: description,
    endedAt: new Date().toISOString()
  });
  // The player's roster row follows the run.
  const row = W.roster.find((r) => r.isPlayer);
  if (row) { row.alive = false; row.deathCause = cause; }
}

/* -- Toll fixtures ------------------------------------------------------ */

const TOLL_BONDS = [
    { label: 'Ledger Master Cheng Baiye', reason: 'The only person who wrote your name down without being asked.' },
    { label: 'Your younger sister, Shen Wanyi', reason: 'She wrote every month for eleven years. The letters stop being for you.' },
    { label: 'Elder Qiu of the Azure Cloud Sect', reason: 'He taught you to sit still. It takes the teaching with the teacher.' }
];
const TOLL_MEMORIES = [
    { label: 'The face of the examiner at the testing stone', reason: 'The first day. It takes the first day.' },
    { label: 'Why you left Greenwater Town', reason: 'You still leave. You no longer know what for.' },
    { label: "The taste of your mother's millet congee", reason: 'Small, and it mattered, which is the only criterion.' }
];
const TOLL_TECHNIQUES = [
    { label: 'Ember Circulation (mortal)', reason: 'The first art you ever mastered. Mastery is what makes it worth taking.' },
    { label: 'Nine Phoenix Furnace (heaven)', reason: 'Four hundred years of practice, gone from the hands as well as the head.' },
    { label: 'Sparrow Step (mortal)', reason: 'You will walk everywhere from now on.' }
];

function makeToll(fromOrdinal, boundaryIndex, outcome, kind, entry, day) {
    const risk = Number((0.2 + rng() * 0.5).toFixed(4));
    return {
        fromOrdinal,
        toOrdinal: fromOrdinal + 1,
        boundaryIndex,
        outcome,
        risk,
        roll: Number((outcome === 'taken' ? risk * rng() : risk + (1 - risk) * rng()).toFixed(4)),
        taken: outcome === 'taken'
            ? {
                kind,
                id: kind === 'name' ? null : uuid(),
                label: kind === 'name' ? W.cultivator.name : entry.label,
                reason: kind === 'name'
                    ? 'It took the name. Nobody you meet will remember it, and you will keep answering to it anyway.'
                    : entry.reason
            }
            : null,
        narrationHint: outcome === 'taken'
            ? 'The crossing completed and something went with it.'
            : 'The crossing completed and nothing was charged.',
        chargedOnDay: day
    };
}

/** The instalments a run of this length would plausibly have accumulated. */
function seedTolls(upToOrdinal, { collectAll = false } = {}) {
    const boundaries = [12, 16, 20, 24, 28, 32, 36, 40, 44].filter(o => o < upToOrdinal);
    const pools = [TOLL_BONDS, TOLL_MEMORIES, TOLL_TECHNIQUES];
    const kinds = ['bond', 'memory', 'technique'];
    const out = [];

    boundaries.forEach((from, i) => {
        const forced = collectAll || rng() > 0.45;
        const outcome = forced ? 'taken' : (rng() > 0.8 ? 'prepaid' : 'clean');
        const k = i % 3;
        const pool = pools[k];
        out.push(makeToll(from, i, outcome, kinds[k], pool[Math.floor(i / 3) % pool.length], Math.round(4000 + i * 21000 + rng() * 4000)));
    });
    return out;
}

/* ───────────────────────────── roster ───────────────────────────── */

function buildRoster(count = 44) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const alive = rng() > 0.13;
    const sect = rng() > 0.28 ? pick(SECTS) : null;
    const ordinal = Math.min(MAX_ORDINAL, Math.floor(Math.pow(rng(), 2.1) * 34));
    const root = ROOTS[Math.floor(rng() * ROOTS.length)];
    const lifespan = realmFor(ordinal).lifespanYears;
    rows.push({
      id: uuid(),
      name: mockName(),
      kind: rng() > 0.82 ? 'enemy' : rng() > 0.5 ? 'npc' : 'neutral',
      isPlayer: false,
      spiritRoot: root.key,
      spiritRootName: root.name,
      realmOrdinal: ordinal,
      rankName: rankName(ordinal),
      realmName: realmFor(ordinal).name,
      location: rng() > 0.12 ? pick(LOCATIONS) : null,
      sectId: sect ? sect.id : null,
      sectName: sect ? sect.name : null,
      sectRank: sect ? pick(sect.ranks) : null,
      age: Math.round(18 + rng() * Math.min(lifespan * 0.8, 400)),
      lifespanYears: lifespan,
      alive,
      existenceState: alive
        ? (ordinal >= 21 && rng() > 0.82 ? pick(['soul_preserved', 'sealed', 'possessing', 'reconstructed', 'reincarnated']) : 'alive')
        : (rng() > 0.62 ? pick(['missing', 'unknown', 'remnant']) : 'physically_dead'),
      soulState: rng() > 0.86 ? pick(['damaged', 'fragmented', 'fading']) : 'intact',
      identityContinuity: rng() > 0.88 ? Number((0.15 + rng() * 0.6).toFixed(2)) : 1,
      deathCause: alive ? null : pick(DEATH_CAUSES),
      spiritStones: Math.round(Math.pow(rng(), 2) * 9000),
      untreatedInjuries: rng() > 0.7 ? between(1, 4) : 0,
      feuds: rng() > 0.78 ? [pick(SECTS).name] : []
    });
  }
  return rows;
}

function playerRosterRow() {
  const c = W.cultivator;
  if (!c) return null;
  const sect = SECTS.find((s) => s.id === c.sectId);
  return {
    id: c.id,
    name: c.name,
    kind: 'pc',
    isPlayer: true,
    spiritRoot: c.spiritRoot,
    spiritRootName: rootByKey(c.spiritRoot).name,
    realmOrdinal: c.realmOrdinal,
    rankName: rankName(c.realmOrdinal),
    realmName: realmFor(c.realmOrdinal).name,
    location: 'Greenwater Town',
    sectId: c.sectId,
    sectName: sect ? sect.name : null,
    sectRank: c.sectRank,
    age: Math.round(c.age),
    lifespanYears: realmFor(c.realmOrdinal).lifespanYears,
    alive: c.alive,
    existenceState: c.existenceState || 'alive',
    soulState: c.soulState || 'intact',
    identityContinuity: c.identityContinuity != null ? c.identityContinuity : 1,
    deathCause: c.deathCause,
    spiritStones: c.spiritStones,
    untreatedInjuries: c.injuries.filter((i) => !i.treated).length,
    feuds: c.feuds
  };
}

function rosterPayload() {
  const others = W.roster.filter((r) => !r.isPlayer);
  const me = playerRosterRow();
  return { roster: me ? [me, ...others] : others };
}

/* ───────────────────────────── the world map ─────────────────────────────
   A hand-built stand-in for /api/admin/places, and much smaller than the real
   thing on purpose: the engine's seeded world is 857 places once interiors are
   in it, and a fixture that size is unreadable and unmaintainable in a mock.
   What this DOES carry is one of every state the renderer draws differently -
   a sealed vault, a hall on an opening cycle, a ruin nobody has discovered, a
   one-sided crossing, a keyed gate, four depths of containment and the far
   side of the Lid - because those are the shapes that break, not the volume.
   -------------------------------------------------------------------------- */

const MOCK_PLACE_DAY = 4200;

function mockPlace(id, name, kind, over = {}) {
  const qi = over.qiDensity ?? 35;
  const band = qi >= 90 ? 'spirit_tide' : qi >= 55 ? 'dense' : qi >= 25 ? 'normal' : 'thin';
  return {
    id, name, kind,
    layer: 'mortal',
    parentId: null,
    depth: 0,
    childIds: [],
    description: '',
    qiDensity: qi,
    qiBand: band,
    spiritualDensity: Math.round(qi) / 100,
    ambient: 'normal',
    danger: 0.2,
    climate: 'temperate',
    politicalControl: 'nobody in particular',
    thresholds: { entry: 0, survival: 0, operational: 0, mastery: 0 },
    hazards: [],
    affinities: [],
    tags: [],
    resources: [],
    specialRules: [],
    sealed: false,
    sealedOnDay: null,
    keyId: null,
    origin: null,
    changes: [],
    changeCount: 0,
    discovered: true,
    discoveredOnDay: 0,
    controllingFactionId: null,
    controllingFactionName: null,
    heldBy: 'nobody in particular',
    contested: false,
    capacity: null,
    occupancy: 0,
    styleTags: [],
    open: true,
    cycle: null,
    opensInDays: null,
    closesInDays: null,
    linkCount: 0,
    ...over
  };
}

function mockEdge(from, to, kind, travelDays, over = {}) {
  return {
    id: from + '|' + to + '|' + kind,
    fromId: from, toId: to, kind, travelDays,
    open: true, requiresKeyId: null, note: '', mutual: true, asymmetric: false,
    ...over
  };
}

function placesPayload() {
  const L = [
    mockPlace('r-fall', 'The Low Fall', 'region', { qiDensity: 35, childIds: ['s-azure', 't-sweptground', 'v-fall'], linkCount: 3 }),
    mockPlace('v-fall', 'the Low Fall vein', 'vein', { parentId: 'r-fall', depth: 1, qiDensity: 65, linkCount: 1 }),
    mockPlace('t-sweptground', 'Sweptground', 'settlement', { parentId: 'r-fall', depth: 1, qiDensity: 31, linkCount: 3, politicalControl: 'a magistrate who is owed favours' }),
    mockPlace('s-azure', 'Azure Cloud Pavilion grounds', 'sect_seat', {
      parentId: 'r-fall', depth: 1, qiDensity: 89, linkCount: 3,
      childIds: ['h-azure-gate', 'p-azure-outer'],
      controllingFactionName: 'Azure Cloud Pavilion',
      heldBy: 'several sects, none of them decisively',
      contested: true,
      capacity: 1400, occupancy: 380,
      styleTags: ['walled_court', 'dressed_stone', 'bronze_trim'],
      thresholds: { entry: 0, survival: 0, operational: 22, mastery: 38 },
      hazards: ['formation'], tags: ['sect_ground', 'recruits'], resources: ['qi', 'teaching'],
      description: 'The ground the Azure Cloud Pavilion holds: gate, forecourt, halls, and the vein the compound was built on top of.'
    }),
    mockPlace('h-azure-gate', 'Azure Cloud Pavilion: the gatehouse', 'hall', {
      parentId: 's-azure', depth: 2, qiDensity: 89, linkCount: 1,
      cycle: { periodDays: 30, openDays: 3, phaseDay: 0 }, open: false, opensInDays: 16,
      specialRules: ['hears petitions three days a month']
    }),
    mockPlace('p-azure-outer', 'Azure Cloud Pavilion: the outer disciple precinct', 'precinct', {
      parentId: 's-azure', depth: 2, qiDensity: 89, linkCount: 3, childIds: ['c-azure-cell', 'x-azure-vault']
    }),
    mockPlace('c-azure-cell', 'Azure Cloud Pavilion: the meditation cells', 'chamber', {
      parentId: 'p-azure-outer', depth: 3, qiDensity: 96, linkCount: 1,
      thresholds: { entry: 4, survival: 4, operational: 9, mastery: 16 }
    }),
    mockPlace('x-azure-vault', 'Azure Cloud Pavilion: the inner vault', 'vault', {
      parentId: 'p-azure-outer', depth: 3, qiDensity: 89, linkCount: 1,
      sealed: true, sealedOnDay: 1180, open: false, keyId: 'key-azure-vault',
      thresholds: { entry: 26, survival: 26, operational: 33, mastery: 41 }
    }),
    mockPlace('u-drowned', 'The Drowned Terrace', 'ruin', {
      qiDensity: 74, linkCount: 2, discovered: false, discoveredOnDay: null,
      cycle: { periodDays: 900, openDays: 20, phaseDay: 300 }, open: true, closesInDays: 7,
      hazards: ['pressure', 'illusion'],
      thresholds: { entry: 11, survival: 18, operational: 24, mastery: 35 },
      description: 'Half a hall standing in still water. It is above the water for twenty days in every nine hundred.'
    }),
    mockPlace('u-ninelamps', 'The Nine Lamps', 'ruin', {
      qiDensity: 100, linkCount: 1, discovered: false, discoveredOnDay: null,
      sealed: true, sealedOnDay: 240, open: false,
      hazards: ['sealed_qi', 'guardian'],
      thresholds: { entry: 30, survival: 36, operational: 42, mastery: 45 }
    }),
    mockPlace('sc-ashfield', 'The Ashfield', 'scar', {
      qiDensity: 1, linkCount: 1, hazards: ['thin_qi'],
      description: 'Nothing grows and nothing gathers. Something drank it.',
      affinities: [{ tag: 'thin_qi', multiplier: 0.25, thresholdOffset: -4, note: 'There is nothing here to draw on.' }],
      origin: { kind: 'wilds', name: 'Ashfield', qiDensity: 44, ambient: 'normal', fromDay: -3200, changed: ['kind', 'name', 'qiDensity'] },
      changeCount: 2,
      changes: [
        { onDay: 3980, kind: 'depleted', summary: 'The last of the ground stopped holding qi.', causeKnown: false, attributedCauses: ['the Pavilion', 'a tribulation nobody saw'], fidelity: 'rumour', witnessed: false },
        { onDay: 1102, kind: 'destroyed', summary: 'Eleven li of forest burned in a night and did not come back.', causeKnown: true, attributedCauses: [], fidelity: 'full', witnessed: true }
      ]
    }),
    mockPlace('a-abode', 'A borrowed abode', 'settlement', { layer: 'immortal', qiDensity: 100, linkCount: 0 })
  ];

  const E = [
    mockEdge('r-fall', 's-azure', 'road', 2),
    mockEdge('r-fall', 't-sweptground', 'road', 1),
    mockEdge('r-fall', 'v-fall', 'path', 3),
    mockEdge('h-azure-gate', 's-azure', 'path', 0),
    mockEdge('p-azure-outer', 's-azure', 'gate', 0),
    mockEdge('c-azure-cell', 'p-azure-outer', 'gate', 0),
    mockEdge('p-azure-outer', 'x-azure-vault', 'gate', 0, { open: false, requiresKeyId: 'key-azure-vault' }),
    mockEdge('sc-ashfield', 't-sweptground', 'path', 6, { mutual: false }),
    mockEdge('t-sweptground', 'u-drowned', 'tunnel', 11, { asymmetric: true }),
    mockEdge('u-drowned', 'u-ninelamps', 'seam', 4, { open: false })
  ];

  const byKind = {};
  for (const l of L) byKind[l.kind] = (byKind[l.kind] || 0) + 1;
  const byLinkKind = {};
  for (const e of E) byLinkKind[e.kind] = (byLinkKind[e.kind] || 0) + 1;

  return {
    world: { seed: 'mock-world', currentDay: MOCK_PLACE_DAY },
    locations: L,
    edges: E,
    layers: [
      { key: 'mortal', label: 'the lower world', count: L.filter((l) => l.layer === 'mortal').length },
      { key: 'immortal', label: 'the immortal world', count: L.filter((l) => l.layer === 'immortal').length }
    ],
    counts: {
      total: L.length,
      discovered: L.filter((l) => l.discovered).length,
      sealed: L.filter((l) => l.sealed).length,
      closed: L.filter((l) => !l.open).length,
      roots: L.filter((l) => !l.parentId).length,
      maxDepth: L.reduce((m, l) => Math.max(m, l.depth), 0),
      byKind,
      byLinkKind
    },
    danglingLinks: 0,
    orphanedParents: 0
  };
}

/* ───────────────────────────── scenarios ───────────────────────────── */


function seedScenario(scenario) {
  W.roster = buildRoster(44);

  W.ledger = [
    { id: 'run_old_1', name: 'Bai Cangyue', peakOrdinal: 16, peakRankName: rankName(16), turn: 412, elapsedDays: 24820, deathCause: 'failed_breakthrough', deathDescription: 'The core refused to form. She burned out over three days in a sealed cave, and the sect opened it a month later.', endedAt: '2026-07-02T11:04:00.000Z' },
    { id: 'run_old_2', name: 'Mo Zhaoxu', peakOrdinal: 4, peakRankName: rankName(4), turn: 38, elapsedDays: 690, deathCause: 'starvation', deathDescription: 'Went into seclusion with eleven days of food and a plan for two years.', endedAt: '2026-07-14T08:22:00.000Z' },
    { id: 'run_old_3', name: 'Xu Lanyin', peakOrdinal: 21, peakRankName: rankName(21), turn: 1904, elapsedDays: 148300, deathCause: 'heavenly_tribulation', deathDescription: 'Nine strikes fell. The ninth did not need to.', endedAt: '2026-08-01T19:41:00.000Z' },
    { id: 'run_old_4', name: 'Yun Sique', peakOrdinal: 2, peakRankName: rankName(2), turn: 9, elapsedDays: 74, deathCause: 'combat_defeat', deathDescription: 'Argued with a Nine Serpent enforcer about a debt of forty spirit stones.', endedAt: '2026-08-19T02:10:00.000Z' }
  ];

  if (scenario === 'fresh') return;

  W.cultivator = makeCultivator('Shen Wuyou');
  W.run = makeRun(W.cultivator.id);
  W.cultivator.spiritRoot = 'single_fire';
  W.cultivator.knownTechniques = ['Ember Circulation (mortal)', 'Sparrow Step (mortal)'];
  W.cultivator.sectId = 'sect_azure';
  W.cultivator.sectRank = 'Outer Disciple';
  W.cultivator.spiritStones = 118;
  W.cultivator.realmOrdinal = 6;
  W.cultivator.hp = 44; W.cultivator.maxHp = 58;
  W.cultivator.qi = 61; W.cultivator.maxQi = 90;
  W.cultivator.age = 31;
  W.cultivator.yearsAtCurrentRealm = 4;
  W.cultivator.cultivationProgress = Math.round(progressRequired(6) * 0.62);
  W.run.turn = 47;
  W.run.elapsedDays = 5480;
  W.run.peakOrdinal = 6;
  W.ambient = 'dense';
  W.cultivator.foundationQuality = 'none';
  W.tolls = [];

  say('narrator', 'The Azure Cloud Sect gives its outer disciples a cave, a stipend, and no particular expectation that they will still be alive in thirty years.\n\nYours faces east. At this hour the qi comes off the peak in slow, cold sheets, and you have learned to sit in it without shivering.');
  say('player', 'I check how far the last decade has actually taken me.');
  say('engine', `Cultivation progress: ${W.cultivator.cultivationProgress} / ${progressRequired(6)} qi-units toward ${rankName(7)}.\nAmbient qi: dense (rate ×1.35). Satiety 100. No untreated injuries.`);
  say('narrator', 'Six layers in eleven years. Ledger Master Cheng would call that respectable. Your own teacher, who is dead, would not have.');

  if (scenario === 'peril') {
    W.cultivator.satiety = 0;
    W.cultivator.starvationTurns = 3;
    W.cultivator.yearsAtCurrentRealm = 46;
    W.cultivator.age = 73;
    W.cultivator.hp = 11;
    W.cultivator.injuries = [newInjury('qi_deviation', 40), newInjury('combat', 42), newInjury('failed_breakthrough', 45)];
    W.cultivator.foundationQuality = 'damaged';
    W.cultivator.feuds = ['Nine Serpent Pavilion', 'Qiu Hanjiang'];
    W.run.turn = 190;
    W.run.elapsedDays = 20805;
    W.ambient = 'thin';
    say('engine', 'Satiety 0. Starvation turn 3 of 5.\n3 untreated injuries. 46 years at Qi Condensation Layer 7 (limit 50).');
    say('narrator', 'You have not eaten in nine days and you are not sure the cave door still opens from the inside.');
  }

  if (scenario === 'ready') {
    W.cultivator.realmOrdinal = 12;
    W.cultivator.foundationQuality = 'none';
    W.cultivator.cultivationProgress = progressRequired(12) + 40;
    W.cultivator.age = 48;
    W.cultivator.yearsAtCurrentRealm = 17;
    W.run.peakOrdinal = 12;
    W.ambient = 'spirit_tide';
    say('engine', `Progress ${W.cultivator.cultivationProgress} / ${progressRequired(12)}. Breakthrough ready: Foundation Establishment Early.\nThis rung is a realm boundary. Base chance ${(baseChance(12) * 100).toFixed(1)}%.`);
    say('narrator', 'The tide is in. Every cultivator on the peak can feel it, and every one of them is doing what you are about to do.');
  }

  if (scenario === 'tribulation') {
    W.cultivator.realmOrdinal = 41;
    W.cultivator.cultivationProgress = progressRequired(41) + 900;
    W.cultivator.age = 4180;
    W.cultivator.maxHp = 9200; W.cultivator.hp = 9200;
    W.cultivator.maxQi = 40000; W.cultivator.qi = 40000;
    W.cultivator.yearsAtCurrentRealm = 210;
    W.cultivator.spiritStones = 1840000;
    W.cultivator.sectRank = 'Patriarch';
    W.cultivator.knownTechniques = ['Ember Circulation (mortal)', 'Nine Phoenix Furnace (heaven)', 'Cinder Star Descent (immortal)'];
    W.run.peakOrdinal = 41;
    W.cultivator.foundationQuality = 'exceptional';
    W.tolls = seedTolls(41);
    W.run.turn = 12904;
    W.run.elapsedDays = 1526000;
    W.ambient = 'spirit_tide';
    say('engine', 'Breakthrough ready: Tribulation Transcendence Mid. Heavenly tribulation will be summoned.');
  }

  if (scenario === 'dead') {
    W.run.turn = 88;
    W.run.elapsedDays = 9130;
    W.cultivator.age = 41;
    killRun('failed_breakthrough', 'The eighth layer barrier held and the recoil went inward. Two meridians tore, then a third, and then the ones that mattered. It took most of an afternoon.');
  }

  // The last crossing, resolved the only way that is not a death. It collects
  // in full here: every instalment is 'taken', including the name.
  if (scenario === 'true_immortal' || scenario === 'ascended') {
    W.cultivator.realmOrdinal = MAX_ORDINAL;
    W.cultivator.foundationQuality = 'exceptional';
    W.cultivator.age = 8490;
    W.cultivator.spiritStones = 0;
    W.cultivator.knownTechniques = [];
    W.cultivator.nameTaken = true;
    W.cultivator.immortalStatus = 'true_immortal';
    W.run.peakOrdinal = MAX_ORDINAL;
    W.run.status = 'ascended';
    W.run.turn = 21400;
    W.run.elapsedDays = 3100000;
    W.tolls = seedTolls(44, { collectAll: true });
    W.tolls.push(makeToll(44, W.tolls.length, 'taken', 'name', null, 3099980));
    say('engine', `Crossing completed. Ordinal ${MAX_ORDINAL}. Collected in full: ${W.tolls.length} instalments, all taken. Run closed.`);
  }

  // The existence states, one scenario each. `?scenario=existence&state=remnant`
  // drives any of the ten; the default is the interesting one.
  if (scenario === 'existence') {
    const params = new URLSearchParams(location.search);
    const state = params.get('state') || 'remnant';
    const soul = params.get('soul') || (state === 'remnant' ? 'fragmented' : 'damaged');
    const cont = params.get('continuity');

    W.cultivator.realmOrdinal = 22;
    W.cultivator.cultivationProgress = Math.round(progressRequired(22) * 0.4);
    W.cultivator.age = 340;
    W.cultivator.maxHp = 2400; W.cultivator.hp = 1600;
    W.cultivator.maxQi = 8800; W.cultivator.qi = 5100;
    W.cultivator.yearsAtCurrentRealm = 19;
    W.cultivator.spiritStones = 12400;
    W.cultivator.foundationQuality = 'rebuilt';
    W.cultivator.knownTechniques = ['Cinder Star Descent (immortal)'];
    W.cultivator.existenceState = state;
    W.cultivator.soulState = soul;
    W.cultivator.identityContinuity = cont != null
      ? Number(cont)
      : (state === 'remnant' ? 0.24 : state === 'alive' ? 1 : 0.72);
    W.cultivator.bodyId = state === 'possessing' ? 'body_7f2a_lin_qingzhu' : null;
    W.cultivator.alive = !['physically_dead', 'remnant'].includes(state);
    W.run.peakOrdinal = 22;
    W.run.turn = 3120;
    W.run.elapsedDays = 118500;
    W.tolls = seedTolls(22);
    say('engine', `Existence state: ${state}. Soul: ${soul}. Identity continuity ${W.cultivator.identityContinuity}.`);
    say('narrator', 'The cave has been open for a while. Whatever is sitting in it turns its head when you come in, and takes slightly too long to decide what to do with its face.');
  }

  // Survived the tribulation, opened the hole, did not get through it.
  if (scenario === 'false_immortal') {
    W.cultivator.realmOrdinal = 44;
    W.cultivator.cultivationProgress = progressRequired(44);
    W.cultivator.immortalStatus = 'false_immortal';
    W.cultivator.foundationQuality = 'incomplete';
    W.cultivator.nameTaken = true;
    W.cultivator.age = 6210;
    W.cultivator.maxHp = 41000; W.cultivator.hp = 41000;
    W.cultivator.maxQi = 190000; W.cultivator.qi = 190000;
    W.cultivator.yearsAtCurrentRealm = 38;
    W.cultivator.spiritStones = 4100000;
    W.cultivator.sectId = null;
    W.cultivator.sectRank = null;
    W.cultivator.knownTechniques = ['Cinder Star Descent (immortal)', 'The Long Refusal (chaos)'];
    W.cultivator.feuds = ['The Hollow Court', 'Stonewright Consortium'];
    W.run.peakOrdinal = 44;
    W.run.turn = 48200;
    W.run.elapsedDays = 2267000;
    W.ambient = 'thin';
    W.tolls = seedTolls(45, { collectAll: true });
    say('engine', 'Crossing attempted. Tribulation survived, seam closed early. Status: False Immortal. Breakthrough permanently refused for this cultivator.');
    say('narrator', 'The hole was there. You saw through it, and what was on the other side declined to take you, and then it was not there any more.\n\nYou came back down without most of what you went up with, and with a great deal of time to think about it.');
  }
}

/* ───────────────────────────── handlers ───────────────────────────── */

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' }
});
const fail = (message, status = 400) => json({ error: message }, status);

/**
 * Build a toolCalls list in the engine's real shape: the routing step first,
 * every engine ruling in order, the persist step, then the narration step. The
 * two `narrator.*` rows carry `source`, which is what marks them as decoration.
 */
function buildCalls(action, rulings, { routedByModel = true, note = null, narrationSource = 'model' } = {}) {
    const calls = [{
        name: 'narrator.plan',
        action,
        summary:
            (routedByModel ? 'Intent routed by the model to ' : 'Intent parsed deterministically to ') +
            `${action}()` +
            '. The verb is a member of a closed set; nothing else from the response was read.',
        ok: true,
        source: routedByModel ? 'model' : 'fallback',
        ...(note ? { note } : {})
    }];

    calls.push(...rulings);

    calls.push({
        name: 'repo.cultivators.save',
        action: 'persist',
        summary: `Cultivator row written at turn ${W.run.turn}. Every number above is now the database's, not this response's.`,
        ok: true
    });

    calls.push({
        name: 'narrator.narrate',
        action: 'narrate',
        summary: narrationSource === 'model'
            ? 'Prose written by the model from the engine facts above. Not read back into state.'
            : "Prose rendered directly from the engine's own account (provider unavailable).",
        ok: true,
        source: narrationSource,
        ...(narrationSource === 'fallback' ? { note: 'provider unavailable' } : {})
    });

    return calls;
}

function handleAct(input) {
  const text = String(input || '').trim();
  W.run.turn += 1;
  W.run.elapsedDays += 1;
  say('player', text);

  if (/^admin\b/i.test(text)) {
    // Passed through like any other input. No client-side cheat exists.
    say('engine', 'ADMIN token forwarded to the engine. admin_manage surface unlocked for this run. All admin actions are audited and this run is excluded from the death ledger.');
    say('narrator', 'Something in the world goes very slightly transparent, the way a stage does when the house lights come up.');
    return {
      narration: 'Something in the world goes very slightly transparent.',
      events: [{ kind: 'admin_unlocked' }],
      toolCalls: buildCalls('admin', [{
        name: 'admin_manage',
        action: 'unlock',
        summary: 'Admin surface unlocked. Every admin action is audited and this run is excluded from the death ledger and from balance statistics.',
        ok: true
      }], { routedByModel: false, note: 'literal ADMIN token matched before the model was consulted' }),
      state: statePayload()
    };
  }

  const c = W.cultivator;
  c.satiety = Math.max(0, c.satiety - between(2, 6));
  if (c.satiety === 0) c.starvationTurns += 1; else c.starvationTurns = 0;
  // Sibling of the line above: how long the channels have been open. An
  // odometer rather than a clock - nothing dies at the end of it - and it
  // resets the moment the count drops back under the threshold.
  if (c.injuries.filter((i) => !i.treated).length >= LETHAL_UNTREATED_INJURIES) {
    c.bleedingTurns = (c.bleedingTurns || 0) + 1;
  } else {
    c.bleedingTurns = 0;
  }

  let engineLine;
  let action = 'wait';
  const rulings = [];

  if (/eat|food|meal|ration|bun/i.test(text)) {
    action = 'buy_provisions';
    const cost = between(1, 4);
    c.satiety = Math.min(100, c.satiety + between(35, 60));
    c.spiritStones = Math.max(0, c.spiritStones - cost);
    c.starvationTurns = 0;
    engineLine = `Satiety -> ${c.satiety}. Spirit stones -${cost} (${c.spiritStones} remaining). Starvation counter reset.`;
    rulings.push({
      name: 'market.priceProvisions', action: 'quote',
      summary: `Provisions quoted at ${cost} spirit stone(s) at current Stonewright rates.`, ok: true
    });
    rulings.push({
      name: 'cultivator.applyDeltas', action: 'buy_provisions',
      summary: `Satiety ${c.satiety}. Spirit stones -${cost}, ${c.spiritStones} remaining. Starvation counter reset to 0.`, ok: true
    });
  } else if (/fight|attack|strike|kill|duel/i.test(text)) {
    action = 'fight';
    const dmg = between(4, 22);
    c.hp = Math.max(0, c.hp - dmg);
    engineLine = `Combat resolved. HP -${dmg} (${c.hp}/${c.maxHp}).`;
    rulings.push({
      name: 'engine.resolveCombat', action: 'fight',
      summary: `Combat resolved deterministically. HP -${dmg}, ${c.hp} of ${c.maxHp} remaining.`, ok: true
    });
    if (rng() > 0.6) {
      c.injuries.push(newInjury('combat', W.run.turn));
      engineLine += '\n1 meridian injury sustained (untreated).';
      rulings.push({
        name: 'engine.applyInjury', action: 'injury_sustained',
        summary: '1 meridian injury sustained, untreated. Meridian damage does not heal on its own.', ok: true
      });
    }
    if (c.hp === 0) {
      killRun('combat_defeat', 'You lost a fight you had already been told not to start.');
      rulings.push({
        name: 'engine.resolveDeath', action: 'death',
        summary: 'HP reached 0. Run closed, cause combat_defeat. The cultivator row is now immutable.', ok: true
      });
      return {
        narration: 'The blade did not stop where you expected it to.',
        events: [{ kind: 'death' }],
        toolCalls: buildCalls(action, rulings),
        state: statePayload()
      };
    }
  } else if (/meditat|cultivat|circulat/i.test(text)) {
    action = 'cultivate';
    const gain = between(6, 26);
    c.cultivationProgress += gain;
    engineLine = progressRequired(c.realmOrdinal) === null
      ? `Cultivation progress +${gain}, and nowhere for it to go: above the Lid qi is not the currency.`
      : `Cultivation progress +${gain} (${c.cultivationProgress} / ${progressRequired(c.realmOrdinal)}).`;
    rulings.push({
      name: 'engine.simulateTimeSkip', action: 'cultivate',
      summary: `1 of 1 day(s) resolved in one deterministic pass. 0 event(s); +0 rank, ${gain} progress, 0 injury(ies).`, ok: true
    });
  } else if (/break\s*through|breakthrough|attempt the barrier/i.test(text)) {
    action = 'breakthrough';
    const d = derived();
    engineLine = c.immortalStatus === 'false_immortal'
      ? 'Breakthrough refused. The Lid has already been opened once against this name.'
      : d.progressRequired === null
        ? 'Breakthrough refused. There is nothing above this rung to attempt.'
        : `Breakthrough refused. ${Math.round(c.cultivationProgress)} of ${d.progressRequired} qi-units.`;
    rulings.push({
      name: 'engine.canAttemptBreakthrough', action: 'breakthrough',
      summary: c.immortalStatus === 'false_immortal'
        ? 'Refused: permanently barred. The crossing was attempted once and did not complete; it does not open again.'
        : d.progressRequired === null
          ? 'Refused: there is no barrier above this one, and no currency that would buy it.'
          : `Refused: not enough has accumulated. ${Math.round(c.cultivationProgress)} of ${d.progressRequired} qi-units. The barrier does not care how badly you want it.`,
      ok: false
    });
  } else {
    engineLine = `Turn ${W.run.turn} resolved. Satiety ${c.satiety}. No state change beyond time.`;
    rulings.push({
      name: 'engine.advanceTurn', action: 'wait',
      summary: `Turn ${W.run.turn} resolved. Satiety ${c.satiety}. No state change beyond the passage of one day.`, ok: true
    });
  }

  const narration = pick([
    'The morning gets on with itself regardless of what you decided.',
    'It goes the way such things go: less cleanly than intended, and faster.',
    'Someone on the lower terrace is arguing about the price of talismans, and does not stop.',
    'The qi settles again, indifferent, and the cave is quiet.'
  ]);

  say('engine', engineLine);
  say('narrator', narration);
  return { narration, events: [], toolCalls: buildCalls(action, rulings), state: statePayload() };
}

function handleCultivate(days) {
  const c = W.cultivator;
  const requested = Math.max(1, Math.round(Number(days) || 1));
  const years = requested / 365;
  const events = [];
  let simulated = requested;
  let interrupted = false;
  let interruptReason = null;

  const before = {
    cultivationProgress: c.cultivationProgress, realmOrdinal: c.realmOrdinal,
    hp: c.hp, qi: c.qi, satiety: c.satiety, spiritStones: c.spiritStones,
    age: c.age, injuries: c.injuries.length
  };

  const rate = rootByKey(c.spiritRoot).cultivationSpeed * ({ thin: 0.7, normal: 1, dense: 1.35, spirit_tide: 2 }[W.ambient] || 1);
  const steps = Math.min(14, Math.max(2, Math.round(years / 0.8) || 2));

  for (let i = 1; i <= steps; i++) {
    const dayOffset = Math.round((requested / steps) * i);
    const roll = rng();

    c.cultivationProgress += Math.round((requested / steps) * rate * 0.42);
    c.age += years / steps;
    c.yearsAtCurrentRealm += years / steps;

    if (roll > 0.88) {
      c.injuries.push(newInjury('qi_deviation', W.run.turn));
      events.push({ kind: 'qi_deviation', dayOffset, summary: 'Qi ran backwards through the heart meridian during a night circulation. One meridian torn.', interrupts: true, data: {} });
      interrupted = true;
      interruptReason = 'Qi deviation during circulation.';
      simulated = dayOffset;
      break;
    } else if (roll > 0.79) {
      const stones = between(20, 300);
      c.spiritStones += stones;
      events.push({ kind: 'opportunity', dayOffset, summary: `A spirit vein surfaced in the cave wall. ${stones} spirit stones recovered before it closed.`, interrupts: false, data: {} });
    } else if (roll > 0.72) {
      events.push({ kind: 'sect_event', dayOffset, summary: 'The Azure Cloud Sect held its decennial assessment. You were not present and were not missed.', interrupts: false, data: {} });
    } else if (roll > 0.66) {
      events.push({ kind: 'npc_event', dayOffset, summary: 'Qiu Hanjiang reached Foundation Establishment and began telling people so.', interrupts: false, data: {} });
    } else if (roll > 0.60) {
      const cost = between(15, 80);
      c.spiritStones = Math.max(0, c.spiritStones - cost);
      events.push({ kind: 'resource_depleted', dayOffset, summary: `Ten years of grain and talisman paper: ${cost} spirit stones spent.`, interrupts: false, data: {} });
    }

    const req = progressRequired(c.realmOrdinal);
    if (req !== null && c.cultivationProgress >= req && c.realmOrdinal < FALSE_IMMORTAL_ORDINAL && rng() > 0.55) {
      events.push({
        kind: 'breakthrough_success',
        dayOffset,
        summary: `Advanced to ${rankName(c.realmOrdinal + 1)} without incident during seclusion.`,
        interrupts: false,
        data: {}
      });
      c.realmOrdinal += 1;
      c.cultivationProgress = 0;
      c.yearsAtCurrentRealm = 0;
      W.run.peakOrdinal = Math.max(W.run.peakOrdinal, c.realmOrdinal);
    }
  }

  // Satiety over a long skip.
  c.satiety = Math.max(0, c.satiety - Math.min(95, Math.round(requested / 26)));
  if (c.satiety === 0) c.starvationTurns += 1;

  // How long the channels have been open, over the same stretch. Open meridians
  // do not close during a seclusion; this is the mock's version of the engine's
  // own accrual, and nothing kills anybody at the end of it.
  const openWounds = c.injuries.filter((i) => !i.treated).length;
  c.bleedingTurns = openWounds >= LETHAL_UNTREATED_INJURIES
    ? (c.bleedingTurns || 0) + simulated
    : 0;

  const lifespan = realmFor(c.realmOrdinal).lifespanYears;
  let died = false;
  let deathCause = null;

  if (c.age >= lifespan) {
    died = true; deathCause = 'lifespan_exhausted';
    events.push({ kind: 'death', dayOffset: simulated, summary: `Lifespan exhausted at ${Math.round(c.age)} years. The realm grants ${lifespan}.`, interrupts: true, data: {} });
  } else if (c.yearsAtCurrentRealm >= stagnationYearsFor(c.realmOrdinal)) {
    died = true; deathCause = 'stagnation_aging';
    events.push({ kind: 'death', dayOffset: simulated, summary: `${Math.round(stagnationYearsFor(c.realmOrdinal))} years at ${rankName(c.realmOrdinal)} without advancing. Settled where they stood.`, interrupts: true, data: {} });
  } else if (c.starvationTurns >= 5) {
    died = true; deathCause = 'starvation';
    events.push({ kind: 'death', dayOffset: simulated, summary: 'Seclusion outlasted the food by a considerable margin.', interrupts: true, data: {} });
  // The `untreated_injuries` death used to sit here, between starvation and the
  // lifespan warning. It is gone: a channel wound impairs and does not kill.
  } else if (openWounds >= LETHAL_UNTREATED_INJURIES) {
    events.push({ kind: 'bleeding_warning', dayOffset: simulated, summary: `${openWounds} untreated meridian injuries. Not fatal, and they do not improve: the body has stopped mending itself and the cultivation rate is a fraction of what it was until they are treated.`, interrupts: true, data: {} });
  } else if (c.age > lifespan * 0.85) {
    events.push({ kind: 'lifespan_warning', dayOffset: simulated, summary: `${Math.round(lifespan - c.age)} years of lifespan remain at this realm.`, interrupts: false, data: {} });
  }

  if (c.satiety <= 20 && !died) {
    events.push({ kind: 'starvation_warning', dayOffset: simulated, summary: `Satiety down to ${c.satiety}. The stores are nearly gone.`, interrupts: false, data: {} });
  }

  W.run.turn += 1;
  W.run.elapsedDays += simulated;

  if (died) {
    killRun(deathCause, 'The seclusion ended without you.');
  } else {
    say('engine', `Seclusion: ${simulated} days simulated of ${requested} requested. ${events.length} recorded events.`);
  }

  return {
    timeSkip: {
      requestedDays: requested,
      simulatedDays: simulated,
      interrupted,
      interruptReason,
      events: events.sort((a, b) => a.dayOffset - b.dayOffset),
      deltas: {
        cultivationProgress: c.cultivationProgress - before.cultivationProgress,
        realmOrdinal: c.realmOrdinal - before.realmOrdinal,
        hp: c.hp - before.hp,
        qi: c.qi - before.qi,
        satiety: c.satiety - before.satiety,
        spiritStones: c.spiritStones - before.spiritStones,
        age: Number((c.age - before.age).toFixed(1)),
        injuriesGained: c.injuries.length - before.injuries
      },
      died,
      deathCause
    },
    state: statePayload()
  };
}

function handleBreakthrough() {
  const c = W.cultivator;
  const from = c.realmOrdinal;
  if (from >= MAX_ORDINAL) return fail('Already at the top of the ladder.', 409);
  // 45 is not the summit but nothing climbs off it either: the crossing was
  // attempted once and did not complete, and the Lid does not open twice
  // against one name.
  if (from === FALSE_IMMORTAL_ORDINAL) {
    return fail('The Lid has already been opened once against this name. There is no second attempt.', 409);
  }

  const d = derived();
  if (!d.breakthroughReady) return fail('Cultivation progress is not sufficient for a breakthrough attempt.', 409);

  const root = rootByKey(c.spiritRoot);
  const untreated = c.injuries.filter((i) => !i.treated).length;
  const ambientMod = { thin: -0.08, normal: 0, dense: 0.06, spirit_tide: 0.15 }[W.ambient] || 0;

  const modifiers = [
    { source: 'base_rate', delta: baseChance(from) },
    { source: 'spirit_root', delta: Number(((root.cultivationSpeed - 1) * 0.08).toFixed(4)) },
    { source: 'insight', delta: Number((c.attributes.insight * 0.02).toFixed(4)) },
    { source: 'fortune', delta: Number((c.attributes.fortune * 0.015).toFixed(4)) },
    { source: `ambient_qi_${W.ambient}`, delta: ambientMod },
    { source: 'untreated_injuries', delta: Number((-0.06 * untreated).toFixed(4)) },
    { source: 'excess_progress', delta: 0.03 }
  ];
  if (isBoundary(from)) modifiers.push({ source: 'realm_boundary_tax', delta: -0.05 });

  const finalChance = Number(Math.max(0.01, Math.min(0.98, modifiers.reduce((s, m) => s + m.delta, 0))).toFixed(4));
  let roll = Number(rng().toFixed(4));

  // Keep a forced outcome consistent with the roll it reports, so the
  // transparency panel never shows arithmetic that contradicts itself.
  if (W.cfg.outcome === 'success' && roll >= finalChance) roll = Number((finalChance * rng()).toFixed(4));
  if (W.cfg.outcome && W.cfg.outcome !== 'success' && roll < finalChance) {
    roll = Number((finalChance + (1 - finalChance) * rng()).toFixed(4));
  }

  let outcome;
  if (W.cfg.outcome) {
    outcome = W.cfg.outcome;
  } else if (roll < finalChance) {
    outcome = 'success';
  } else {
    const bad = rng();
    outcome = bad > 0.93 ? 'death' : bad > 0.7 ? 'failure_deviation' : bad > 0.35 ? 'failure_injured' : 'failure_stable';
  }

  const injuriesSustained = [];
  const progressConsumed = progressRequiredOrZero(from);
  const tribulating = realmFor(from).key === 'tribulation_transcendence';
  let tribulation = null;

  if (tribulating) {
    const strikes = between(3, 9);
    tribulation = { strikes, survived: outcome !== 'death' };
  }

  if (outcome === 'success') {
    c.realmOrdinal = from + 1;
    c.cultivationProgress = 0;
    c.yearsAtCurrentRealm = 0;
    c.maxHp = Math.round(c.maxHp * 1.6);
    c.hp = c.maxHp;
    c.maxQi = Math.round(c.maxQi * 1.8);
    c.qi = c.maxQi;
    W.run.peakOrdinal = Math.max(W.run.peakOrdinal, c.realmOrdinal);
  } else {
    c.cultivationProgress = Math.max(0, c.cultivationProgress - Math.round(progressConsumed * 0.5));
    if (outcome === 'failure_injured') injuriesSustained.push(newInjury('failed_breakthrough', W.run.turn));
    if (outcome === 'failure_deviation') {
      injuriesSustained.push(newInjury('qi_deviation', W.run.turn), newInjury('qi_deviation', W.run.turn));
    }
    c.injuries.push(...injuriesSustained);
    c.hp = Math.max(1, Math.round(c.hp * (outcome === 'failure_stable' ? 0.9 : 0.5)));
  }

  W.run.turn += 1;
  W.run.elapsedDays += 3;

  const engineLines = {
    success: `BREAKTHROUGH SUCCEEDED. ${rankName(from)} → ${rankName(from + 1)}. Roll ${roll} < ${finalChance}.`,
    failure_stable: `Breakthrough failed. No injuries. Roll ${roll} vs ${finalChance}. ${Math.round(progressConsumed * 0.5)} progress lost.`,
    failure_injured: `Breakthrough failed. ${injuriesSustained.length} meridian(s) torn. Roll ${roll} vs ${finalChance}.`,
    failure_deviation: `Breakthrough failed - QI DEVIATION. ${injuriesSustained.length} meridians torn. Roll ${roll} vs ${finalChance}.`,
    death: `BREAKTHROUGH FATAL. Roll ${roll} vs ${finalChance}. Run closed.`
  };
  say('engine', engineLines[outcome] || engineLines.failure_stable);

  if (outcome === 'death') {
    killRun(tribulating ? 'heavenly_tribulation' : 'failed_breakthrough',
      tribulating
        ? 'The tribulation came down in full. What was left did not need burying.'
        : 'The barrier held, the recoil did not, and the meridians went one after another.');
  }

  return {
    result: {
      outcome,
      fromOrdinal: from,
      toOrdinal: outcome === 'success' ? from + 1 : from,
      finalChance,
      modifiers,
      roll,
      injuriesSustained,
      progressConsumed: outcome === 'success' ? progressConsumed : Math.round(progressConsumed * 0.5),
      tribulation,
      narrationHint: outcome === 'success'
        ? 'Describe the barrier giving way and the sudden widening of what the body can hold.'
        : 'Describe the failure without softening it. The engine has ruled.'
    },
    state: statePayload()
  };
}

/* ───────────────────────────── router ───────────────────────────── */

async function route(url, init) {
  const path = url.pathname;
  const method = (init && init.method ? init.method : 'GET').toUpperCase();
  let body = {};
  if (init && init.body) { try { body = JSON.parse(init.body); } catch { body = {}; } }

  const shouldFail = (key) => W.cfg.fail.has(key);

  if (path === '/api/health') {
    if (shouldFail('health')) return fail('Mock: health forced to fail.', 503);
    return json({
      ok: true,
      version: '0.1.0-mock',
      provider: { name: 'claude', model: 'claude-opus-5', configured: true },
      adminMode: W.cfg.admin
    });
  }

  if (path === '/api/reference/ladder') {
    if (shouldFail('ladder')) return fail('Mock: ladder forced to fail.', 500);
    return json({ ranks: fullLadder() });
  }

  if (path === '/api/reference/spirit-roots') {
    if (shouldFail('roots')) return fail('Mock: spirit roots forced to fail.', 500);
    return json(rootsPayload());
  }

  if (path === '/api/admin/roster') {
    if (shouldFail('roster')) return fail('Mock: roster forced to fail.', 500);
    if (!W.cfg.admin) return fail('Admin mode is not enabled on this server.', 403);
    return json(rosterPayload());
  }

  if (path === '/api/admin/places') {
    if (shouldFail('places')) return fail('Mock: places forced to fail.', 500);
    if (!W.cfg.admin) return fail('Admin mode is not enabled on this server.', 403);
    return json(placesPayload());
  }

  if (path === '/api/ledger') {
    if (shouldFail('ledger')) return fail('Mock: ledger forced to fail.', 500);
    return json({ runs: W.ledger });
  }

  if (path === '/api/state') {
    if (shouldFail('state')) return fail('Mock: state forced to fail.', 500);
    if (!W.run) return fail('No active run.', 404);
    return json(statePayload());
  }

  if (path === '/api/run/new' && method === 'POST') {
    const name = String(body.name || '').trim();
    if (!name) return fail('A cultivator needs a name.', 400);
    W.cultivator = makeCultivator(name);
    W.run = makeRun(W.cultivator.id);
    W.log = [];
    W.tolls = [];
    W.ambient = pick(['thin', 'normal', 'normal', 'dense', 'spirit_tide']);
    const root = rootByKey(W.cultivator.spiritRoot);
    say('engine', `Run opened. Spirit root rolled: ${root.name} (${root.grade}, ×${root.cultivationSpeed} speed). ` +
      `Attributes - Might ${W.cultivator.attributes.might}, Insight ${W.cultivator.attributes.insight}, ` +
      `Fortune ${W.cultivator.attributes.fortune}, Charm ${W.cultivator.attributes.charm}. Locked for this run.`);
    say('narrator', `You are sixteen, and the testing stone under your palm has just told a room full of people exactly what you are worth.\n\nThe examiner writes it down without looking up. ${root.name}. Somebody at the back makes a noise; you do not turn round to find out which kind.`);
    return json({ run: W.run, cultivator: W.cultivator });
  }

  if (path === '/api/act' && method === 'POST') {
    if (shouldFail('act')) return fail('Mock: the narrator provider returned an error.', 502);
    if (!W.run) return fail('No active run.', 404);
    if (W.run.status !== 'active') return fail('This run is over. It cannot be continued.', 409);
    if (!String(body.input || '').trim()) return fail('Say something.', 400);
    return json(handleAct(body.input));
  }

  if (path === '/api/cultivate' && method === 'POST') {
    if (shouldFail('cultivate')) return fail('Mock: cultivate forced to fail.', 500);
    if (!W.run) return fail('No active run.', 404);
    if (W.run.status !== 'active') return fail('This run is over.', 409);
    const days = Number(body.days);
    if (!Number.isFinite(days) || days < 1) return fail('days must be a positive number.', 400);
    return json(handleCultivate(days));
  }

  if (path === '/api/breakthrough' && method === 'POST') {
    if (shouldFail('breakthrough')) return fail('Mock: breakthrough forced to fail.', 500);
    if (!W.run) return fail('No active run.', 404);
    if (W.run.status !== 'active') return fail('This run is over.', 409);
    const result = handleBreakthrough();
    return result instanceof Response ? result : json(result);
  }

  return fail(`Mock has no handler for ${method} ${path}`, 404);
}

/* ───────────────────────────── install ───────────────────────────── */

export function installMock(cfg = {}) {
  W.cfg.scenario = cfg.scenario || 'fresh';
  W.cfg.outcome = cfg.outcome || '';

  const params = new URLSearchParams(location.search);
  W.cfg.admin = params.get('admin') !== '0';
  const failList = (params.get('fail') || '').split(',').map((s) => s.trim()).filter(Boolean);
  W.cfg.fail = new Set(failList);
  rng = mulberry32(Number(params.get('seed')) || 0x9e3779b9);

  seedScenario(W.cfg.scenario);

  const realFetch = window.fetch.bind(window);
  window.fetch = async function mockFetch(input, init) {
    const href = typeof input === 'string' ? input : (input && input.url) || '';
    let url;
    try { url = new URL(href, location.origin); } catch { return realFetch(input, init); }

    if (!url.pathname.startsWith('/api/')) return realFetch(input, init);

    // A little latency so loading states are actually visible while developing.
    await new Promise((r) => setTimeout(r, 90 + Math.random() * 160));
    return route(url, init || (input && typeof input !== 'string' ? input : {}));
  };

  console.info(
    `[mock] Installed. scenario=${W.cfg.scenario} admin=${W.cfg.admin}` +
    (W.cfg.outcome ? ` forcedOutcome=${W.cfg.outcome}` : '') +
    (failList.length ? ` failing=${failList.join(',')}` : '')
  );
}
