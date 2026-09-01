/* ══════════════════════════════════════════════════════════════════════
   The Cultivation Ladder - client
   Vanilla ES module. No build step, no dependencies, no network assets.

   The server is authoritative for everything. This file renders what the
   engine reports and never computes game state of its own. The only numbers
   derived here are presentational (percentages of engine-supplied pairs).
   ══════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────── markup ─────────────────────────────── */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

class Raw {
  constructor(value) { this.value = value; }
}
/** Mark a string as already-safe markup. */
const raw = (v) => new Raw(v);

function part(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Raw) return v.value;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}

/** Tagged template that escapes every interpolation unless wrapped in raw(). */
function html(strings, ...vals) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < vals.length) out += part(vals[i]);
  }
  return out;
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ───────────────────────────── formatting ───────────────────────────── */

const DAYS_PER_YEAR = 365;
const DAYS_PER_MONTH = 30;

function fmtInt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  return Math.round(v).toLocaleString('en-US');
}

function fmtNum(n, digits = 1) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  return v.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function fmtPct(fraction, digits = 1) {
  const v = Number(fraction);
  if (!Number.isFinite(v)) return '-';
  return `${(v * 100).toFixed(digits)}%`;
}

function fmtProb(fraction) {
  const v = Number(fraction);
  if (!Number.isFinite(v)) return '-';
  if (v > 0 && v < 0.001) return '<0.1%';
  return `${(v * 100).toFixed(v < 0.1 ? 2 : 1)}%`;
}

/** "12 years, 4 months, 3 days" - the game's time unit is the day. */
function fmtDays(days) {
  const total = Math.max(0, Math.round(Number(days) || 0));
  if (total === 0) return 'no time at all';
  const years = Math.floor(total / DAYS_PER_YEAR);
  const rem = total - years * DAYS_PER_YEAR;
  const months = Math.floor(rem / DAYS_PER_MONTH);
  const d = rem - months * DAYS_PER_MONTH;
  const bits = [];
  if (years) bits.push(`${fmtInt(years)} year${years === 1 ? '' : 's'}`);
  if (months) bits.push(`${months} month${months === 1 ? '' : 's'}`);
  if (d || !bits.length) bits.push(`${d} day${d === 1 ? '' : 's'}`);
  return bits.join(', ');
}

/** Compact form for timeline gutters: "y12 m4" / "d17". */
function fmtDaysShort(days) {
  const total = Math.max(0, Math.round(Number(days) || 0));
  const years = Math.floor(total / DAYS_PER_YEAR);
  const months = Math.floor((total - years * DAYS_PER_YEAR) / DAYS_PER_MONTH);
  if (years) return `yr ${years}${months ? `, mo ${months}` : ''}`;
  if (months) return `mo ${months}`;
  return `day ${total}`;
}

function fmtSigned(n, digits = 0) {
  const v = Number(n) || 0;
  const s = digits ? Math.abs(v).toFixed(digits) : fmtInt(Math.abs(v));
  if (v > 0) return `+${s}`;
  if (v < 0) return `-${s}`;
  return '0';
}

function titleise(key) {
  return String(key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const DEATH_CAUSE_TEXT = {
  combat_defeat: 'Killed in combat',
  obviously_fatal_choice: 'Killed by an obviously fatal choice',
  lifespan_exhausted: 'Lifespan exhausted',
  stagnation_aging: 'Died of age, having not advanced',
  untreated_injuries: 'Died of untreated injuries',
  starvation: 'Starved',
  failed_breakthrough: 'Died in a failed breakthrough',
  qi_deviation: 'Died of qi deviation',
  heavenly_tribulation: 'Destroyed by heavenly tribulation'
};
const causeText = (c) => DEATH_CAUSE_TEXT[c] || (c ? titleise(c) : 'Cause unrecorded');

/* ── The last crossing ──────────────────────────────────────────────────
   Three outcomes, and only one of them is an ordinal. True Immortal is the
   top of the ladder; False Immortal is a permanent status on a cultivator who
   stays where they are; failure is a death like any other.

   The status lives on `cultivator.immortalStatus`. The client reads it and
   never derives it: a False Immortal is not something a UI can infer from an
   ordinal, because they are standing exactly where they were.
   ─────────────────────────────────────────────────────────────────────── */

/**
 * `cultivator.immortalStatus` is the engine's field: 'none' | 'false_immortal' |
 * 'true_immortal'. The extra probes below are kept as a cheap fallback for
 * older rows and for `derived`, should it ever carry the status too.
 */
function immortalStatus(derived = S.derived, cultivator = S.cultivator) {
  const candidates = [
    cultivator && cultivator.immortalStatus,
    derived && derived.immortalStatus
  ];
  for (const v of candidates) {
    if (v === 'false_immortal' || v === 'true_immortal' || v === 'none') {
      immortalStatusFieldFound = true;
      return v;
    }
  }
  return null;
}

let immortalStatusFieldFound = false;

function isFalseImmortal(derived = S.derived, cultivator = S.cultivator) {
  return immortalStatus(derived, cultivator) === 'false_immortal';
}

/**
 * Say once, in the console, that no immortalStatus field answered. Cheaper for
 * whoever wires the engine side than discovering the UI silently never lights up.
 */
let immortalStatusWarned = false;
function warnIfImmortalStatusMissing() {
  if (immortalStatusWarned || immortalStatusFieldFound || !S.cultivator) return;
  immortalStatusWarned = true;
  console.info(
    '[ui] No immortalStatus found on cultivator or derived. The False Immortal panel and the ' +
    'breakthrough lockout stay off until cultivator.immortalStatus reports ' +
    '"none" | "false_immortal" | "true_immortal".'
  );
}

/**
 * True Immortal: the run ended by going through the Lid, not by dying. The run
 * status closes the run; immortalStatus says which kind of ending it was.
 */
function isTrueImmortal(run = S.run, cultivator = S.cultivator) {
  if (immortalStatus(S.derived, cultivator) === 'true_immortal') return true;
  if (!run) return false;
  return run.status === 'ascended' || run.status === 'true_immortal';
}

/**
 * Lifespan remaining, straight from the engine.
 *
 * `derivedView` reads it through `effectiveLifespanYears(ordinal, immortalStatus)`,
 * so a False Immortal's own vast-but-finite ceiling is already accounted for and
 * the client does not duplicate the constant.
 */
/** Open wounds, from the derived view when it is there and the sheet when it is not. */
function untreatedCount() {
  const d = S.derived || {};
  if (d.untreatedInjuries != null) return Number(d.untreatedInjuries) || 0;
  return ((S.cultivator || {}).injuries || []).filter((i) => !i.treated).length;
}

function lifespanRemaining(derived = S.derived) {
  return Number(derived && derived.lifespanRemaining);
}

/**
 * The two clocks a cultivator is standing between, read off the engine.
 *
 * Both of them used to be half-invented here. `50` was written into four
 * places in this file - the meter's maximum, its note, the warning list and the
 * seclusion picker - and 50 is the FLOOR, true only through Foundation
 * Establishment. `stagnationYearsForOrdinal` is a fifth of the realm's own span
 * above that, so a Core Formation cultivator was being told 50 where the ladder
 * credits 100, and somebody at Tribulation Transcendence the same 50 against
 * 20,000. The sentence under it - "Fifty years without advancing is fatal" -
 * had been a true statement when it was written and had silently become a lie
 * for everybody above the second realm.
 *
 * They are gathered into one function rather than fixed four times because
 * that is how the same defect comes back: four copies drift, one does not.
 *
 * `nearer` is the point of the whole thing. The panel showed both figures side
 * by side and never related them, and relating them is the only thing a player
 * actually needs from a pair of countdowns - it is the difference between "I
 * have time" and "I must move now". Nothing here is computed that the engine
 * did not send; the subtraction of two of its own numbers is the most this
 * layer is allowed to do.
 */
function mortalClocks(derived = S.derived, cultivator = S.cultivator) {
  const d = derived || {};
  const c = cultivator || {};

  const age = Number(c.age) || 0;
  const lifeLeft = Number(d.lifespanRemaining);
  const lifeSpan = Number(d.lifespanYears);

  const stag = Number(c.yearsAtCurrentRealm) || 0;
  const stagLimit = Number(d.stagnationYears);
  const stagLeft = Number.isFinite(stagLimit) ? Math.max(0, stagLimit - stag) : NaN;

  // Which of the two ends this life first. Null while either is unknown -
  // saying nothing beats guessing, since a wrong answer here is exactly the
  // sentence a player would act on.
  let nearer = null;
  if (Number.isFinite(lifeLeft) && Number.isFinite(stagLeft)) {
    nearer = stagLeft <= lifeLeft ? 'settling' : 'lifespan';
  }

  return {
    age,
    lifeLeft,
    lifeSpan,
    // How much of this rung's span is gone. The argument for crossing young in
    // one number: a rung reached early is a rung with runway left on it.
    spanBurnt: Number.isFinite(lifeSpan) && lifeSpan > 0 ? age / lifeSpan : NaN,
    stag,
    stagLimit,
    stagLeft,
    // The engine's own age term on the next crossing, and the age it starts at.
    pressure: Number(d.lifespanPressure),
    pressureFrom: Number(d.lifespanPressureFromAge),
    nearer
  };
}

/**
 * The sentence under the settling clock.
 *
 * It used to read "Fifty years without advancing is fatal", which was wrong
 * twice. Wrong about the number above Foundation Establishment, and wrong about
 * what the thing IS: settling is a decision somebody makes - to stop striking,
 * consolidate, and live the span out at the rung they reached - and the clock
 * is the deadline on that decision, not a fuse. Reaching the deadline still
 * settles you, permanently, and the wording has to carry both halves: you may
 * choose it, and if you do not choose it in time it is chosen for you.
 *
 * Written with digits rather than a spelled-out number so it survives a
 * cultivator at Tribulation Transcendence, where the figure is 20,000.
 */
function settlingNote(clocks, derived) {
  const limit = fmtNum(clocks.stagLimit, 0);
  const rung = (derived && derived.rankName) ? derived.rankName : 'this rung';
  if (clocks.stagLeft <= 0) {
    return `${limit} years at ${rung} and the ladder no longer credits them. Settled: alive, `
      + 'at this rung, and finished climbing.';
  }
  return `${limit} years is what ${rung} credits. Spend them and the choice is made for you - `
    + `settled here, alive, and finished climbing. ${fmtNum(clocks.stagLeft)} left to make it `
    + 'yourself.';
}

/**
 * The line that relates the two clocks, which is the whole reason they sit in
 * the same section.
 *
 * Three facts, in the order a player needs them: which clock ends this life
 * first, what the span already spent is costing the next crossing, and - the
 * one that is otherwise invisible - how much runway is left before it starts
 * costing anything. That last one is the argument for striking a marginal
 * crossing now instead of gathering for another fifty years, because crossing
 * resets you into a longer span with none of it spent.
 *
 * Everything printed here is a subtraction of two numbers the engine sent.
 */
function reckoning(clocks, derived) {
  if (!clocks.nearer) return '';

  const settlingFirst = clocks.nearer === 'settling';
  const head = settlingFirst ? 'Settling comes first' : 'The span comes first';
  const body = settlingFirst
    ? `${fmtNum(clocks.stagLeft)} years before this rung stops crediting them, against `
      + `${fmtNum(clocks.lifeLeft)} of lifespan. The climb ends before the body does.`
    : `${fmtNum(clocks.lifeLeft)} years of lifespan left, against ${fmtNum(clocks.stagLeft)} `
      + 'before settling. The body goes first; the rung would have held you longer.';

  // The consequence half. Lifespan on its own is a countdown with nothing
  // attached to it, and this is the thing attached: the crossing is priced
  // against how much of the span is gone, so waiting is never free.
  let pressure = '';
  if (clocks.pressure < 0) {
    pressure = `The next crossing already carries ${fmtSignedPct(clocks.pressure)} for the span `
      + 'you have spent, and every year makes it worse. Striking at poor odds beats striking later.';
  } else if (Number.isFinite(clocks.pressureFrom)) {
    const runway = clocks.pressureFrom - clocks.age;
    pressure = runway > 0
      ? `No age penalty on the next crossing yet; it begins at ${fmtNum(clocks.pressureFrom, 0)}, `
        + `which is ${fmtNum(runway)} years away. Cross before then and you arrive at the next `
        + 'rung with its whole span unspent.'
      : 'No age penalty on the next crossing.';
  }

  const tone = settlingFirst ? 'tone-warn' : 'tone-bad';
  return html`
    <div class="reckoning ${raw(tone)}">
      <div class="reckoning__head">${head}</div>
      <p class="reckoning__body">${body}</p>
      ${pressure ? raw(html`<p class="reckoning__body">${pressure}</p>`) : ''}
    </div>`;
}

/**
 * Highest legal ordinal, taken from the ladder the engine served.
 *
 * The fallback is only reached before /api/reference/ladder has answered. It
 * tracks the engine's MAX_ORDINAL, which is 46: the ladder is 47 rungs, 0-46,
 * and its top two are False Immortal and True Immortal.
 */
function summitOrdinal() {
  return Array.isArray(S.ladder) && S.ladder.length
    ? Number(S.ladder[S.ladder.length - 1].ordinal)
    : 46;
}

/**
 * The engine's sentinel for a span that has stopped being a quantity
 * (`UNBOUNDED_LIFESPAN_YEARS` in engine/cultivation/realms.ts). Mirrored here
 * for presentation only, never to compute anything: a billion years is not a
 * number a person reads as a number, and printing it would make the top of the
 * ladder look like a larger version of the rungs below rather than a different
 * kind of thing.
 */
const UNBOUNDED_LIFESPAN_YEARS = 1e9;

/** A realm's lifespan grant, as words. Never a bare sentinel. */
function lifespanText(years) {
  const v = Number(years);
  if (!Number.isFinite(v) || v <= 0) return 'not recorded';
  if (v >= UNBOUNDED_LIFESPAN_YEARS) return 'no longer a number';
  return `${fmtInt(v)} yr`;
}

/**
 * Whether a rung can be climbed off at all.
 *
 * `progressRequired` is null on the two rungs above the Lid, and that null is
 * the engine making a statement rather than failing to send one: immortal qi is
 * not this currency and there is no exchange rate. Nothing can attempt from
 * either rung in any case - 46 is the summit and 45 is barred permanently - so
 * this one flag governs both the cost column and the odds column, and neither
 * of them prints a figure where there is no figure to print.
 */
function isClimbable(rung) {
  return rung != null && rung.progressRequired !== null && rung.progressRequired !== undefined;
}

/* -- Existence -----------------------------------------------------------
   At low realms a destroyed body is a dead cultivator. From Nascent Soul up
   that stops being true, and a cultivator becomes a persistent identity that
   may occupy several physical states over time.

   `existenceState` is authoritative over `alive`. This file only chooses copy
   from it; it never computes it, and the classification switches below mirror
   `engine/cultivation/existence.ts` for presentation purposes only.
   ---------------------------------------------------------------------- */

const EXISTENCE = {
    alive: {
        label: 'Alive',
        tone: 'ok',
        line: 'One body, occupied, working.'
    },
    physically_dead: {
        label: 'Physically dead',
        tone: 'bad',
        line: 'The body went and nothing survived it. This one is terminal; there is no state after it.'
    },
    soul_preserved: {
        label: 'Soul preserved',
        tone: 'odd',
        line: 'Consciousness persists with no body to put it in. You can still act, badly, and not at all with hands.'
    },
    remnant: {
        label: 'Remnant',
        tone: 'bad',
        line: 'An imprint left behind. This is not the person - it is something the person left that can talk, and it does not always know the difference.'
    },
    sealed: {
        label: 'Sealed',
        tone: 'odd',
        line: 'Intact and unable to act, for as long as that lasts. Sealed is not dead; people have come out of it after four thousand years.'
    },
    possessing: {
        label: 'Possessing',
        tone: 'odd',
        line: 'Occupying a body that was not yours. Control is rarely total and the vessel rarely agrees.'
    },
    reincarnated: {
        label: 'Reincarnated',
        tone: 'odd',
        line: 'A genuinely new life, not a respawn. What carried across is whatever carried across.'
    },
    reconstructed: {
        label: 'Reconstructed',
        tone: 'odd',
        line: 'A rebuilt body. It is rarely identical to the first, and the difference cost something.'
    },
    missing: {
        label: 'Missing',
        tone: 'unresolved',
        line: 'Whereabouts unknown, and aliveness genuinely unresolved. This is an answer, not a gap in the record.'
    },
    unknown: {
        label: 'Unknown',
        tone: 'unresolved',
        line: 'The engine has not decided, and does not have to. The world may hold several beliefs at once.'
    }
};

const SOUL_STATE = {
    intact: { label: 'Intact', tone: 'ok', line: '' },
    damaged: { label: 'Damaged', tone: 'warn', line: 'The soul took harm the body did not.' },
    fragmented: { label: 'Fragmented', tone: 'bad', line: 'Pieces of it are elsewhere, or gone.' },
    fading: { label: 'Fading', tone: 'critical', line: 'It is going out. This is the clock that does not stop for pills.' }
};

/** Presentation mirror of `isGoingConcern`. Never used to compute state. */
const NOT_A_GOING_CONCERN = ['remnant', 'physically_dead'];
/** Presentation mirror of `hasBody`. */
const BODILESS = ['soul_preserved', 'remnant', 'physically_dead', 'missing', 'unknown'];

const existenceOf = (c) => (c && c.existenceState) || 'alive';
const soulStateOf = (c) => (c && c.soulState) || 'intact';

/**
 * How much of the original person this actually is, 0..1.
 *
 * The engine field is `identityContinuity`; the design document calls the same
 * idea identity fraction, so both spellings are read.
 */
function identityContinuity(c = S.cultivator) {
    const v = Number(c && (c.identityContinuity !== undefined ? c.identityContinuity : c.identityFraction));
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
}

const isBodiless = (c = S.cultivator) => BODILESS.includes(existenceOf(c));

/**
 * True only for the ordinary case: one occupied body, an intact soul, and all
 * of the original person. The existence panel stays out of the way for this,
 * because surfacing it would imply a system the player cannot yet touch.
 */
function existenceIsUnremarkable(c = S.cultivator) {
    return existenceOf(c) === 'alive'
        && soulStateOf(c) === 'intact'
        && identityContinuity(c) >= 1;
}

/** Plain statement of what a reduced continuity means. Never a bare percentage. */
function continuityLine(c = S.cultivator) {
    const v = identityContinuity(c);
    if (v >= 1) return '';
    const state = existenceOf(c);
    const pct = `${Math.round(v * 100)}%`;
    if (state === 'remnant') {
        return `About ${pct} of the original person. A remnant can say "I founded this sect" in `
            + 'perfect sincerity and be wrong, and this is the number that says so.';
    }
    if (v <= 0.35) {
        return `About ${pct} of the original person came through. Most of who set out is not here.`;
    }
    if (v <= 0.75) {
        return `About ${pct} of the original person. Enough is missing that people who knew them notice.`;
    }
    return `About ${pct} of the original person. Something did not come back, and it was not nothing.`;
}

function existenceMarkup(c) {
    if (existenceIsUnremarkable(c)) return '';

    const state = existenceOf(c);
    const meta = EXISTENCE[state] || { label: titleise(state), tone: 'unresolved', line: 'The engine reports an existence state this client does not recognise.' };
    const soul = soulStateOf(c);
    const soulMeta = SOUL_STATE[soul] || { label: titleise(soul), tone: 'warn', line: '' };
    const continuity = continuityLine(c);
    const terminal = state === 'physically_dead';
    const notGoing = NOT_A_GOING_CONCERN.includes(state);

    // An ordinary living cultivator whose only anomaly is the soul does not get
    // the whole panel; the soul reads as a vital instead.
    if (state === 'alive' && !continuity) return '';

    return html`
    <div class="statusflag statusflag--existence tone-${raw(meta.tone)}">
      <div class="statusflag__title">${meta.label}</div>
      <div class="statusflag__body">${meta.line}</div>
      ${continuity ? raw(html`<div class="statusflag__body statusflag__body--continuity">${continuity}</div>`) : ''}
      ${soul !== 'intact' ? raw(html`<div class="statusflag__body">Soul ${soulMeta.label.toLowerCase()}. ${soulMeta.line}</div>`) : ''}
      ${c.bodyId && state === 'possessing' ? raw(html`<div class="statusflag__meta">occupying body <code>${String(c.bodyId)}</code></div>`) : ''}
      ${notGoing && !terminal ? raw(html`<div class="statusflag__meta">Not a going concern. Whatever is acting here, it is not the cultivator.</div>`) : ''}
    </div>`;
}

const FOUNDATION_TEXT = {
  none: 'Nothing laid yet. Below Foundation Establishment there is nothing to stand on.',
  exceptional: 'Laid on dense qi, unhurried, with the right pill. It will carry anything.',
  stable: 'The ordinary good outcome. It holds and it does not complain.',
  unstable: 'It holds, but it complains. Every rung above it costs more than it should.',
  incomplete: 'Rushed. Part of the structure was never formed, and never will be.',
  damaged: 'Laid over untreated injuries, and it shows.',
  transformed: 'Reworked by something inhuman. Fast, and noticed.',
  rebuilt: 'Destroyed and laid again. Serviceable, never pristine.',
  sacrificed: 'Spent deliberately for something else.'
};
const FOUNDATION_TONE = {
  exceptional: 'is-good', stable: 'is-good',
  unstable: 'is-warn', rebuilt: 'is-warn', transformed: 'is-warn',
  incomplete: 'is-bad', damaged: 'is-bad', sacrificed: 'is-bad'
};

const TOLL_OUTCOME_TEXT = {
  clean: 'The crossing went past without taking an interest.',
  prepaid: 'Paid in advance, on their own terms.',
  taken: 'Something that mattered is gone.',
  nothing_left: 'The roll failed and there was nothing worth taking.'
};
const TOLL_KIND_TEXT = { bond: 'a bond', memory: 'a memory', technique: 'a technique', name: 'their name' };

const AMBIENT_TEXT = {
  thin: 'Thin - cultivation crawls here.',
  normal: 'Normal - ordinary spiritual density.',
  dense: 'Dense - the qi here is rich.',
  spirit_tide: 'Spirit tide - a rare surge. Cultivate now.'
};

const OUTCOME_META = {
  success: { cls: 'bt-success', label: 'Success', tone: 'success', headline: 'The barrier gives way.' },
  failure_stable: { cls: 'bt-stable', label: 'Failed - stable', tone: '', headline: 'The barrier holds. Nothing tears.' },
  failure_injured: { cls: 'bt-injured', label: 'Failed - injured', tone: 'danger', headline: 'The barrier holds, and something inside does not.' },
  failure_deviation: { cls: 'bt-deviation', label: 'Failed - qi deviation', tone: 'danger', headline: 'The qi turns back on its owner.' },
  death: { cls: 'bt-death', label: 'Death', tone: 'danger', headline: 'The attempt was the last thing you did.' },
  // The last crossing. These two keys are a guess at the engine's spelling; an
  // unrecognised outcome still renders correctly via the fallback below, and
  // the ending screen is routed by run.status regardless.
  true_immortal: { cls: 'bt-success', label: 'True Immortal', tone: 'success', headline: 'The hole is punched, and you go through it.' },
  false_immortal: { cls: 'bt-deviation', label: 'False Immortal', tone: 'tribulation', headline: 'The seam closes early. What is left stays on this side.' }
};

const EVENT_TONE = {
  breakthrough_success: 'good',
  injury_healed: 'good',
  opportunity: 'good',
  breakthrough_failure: 'bad',
  qi_deviation: 'bad',
  injury_sustained: 'bad',
  resource_depleted: 'warn',
  starvation_warning: 'warn',
  bleeding_warning: 'warn',
  lifespan_warning: 'warn',
  death: 'fatal'
};

/* ──────────────────────────────── api ──────────────────────────────── */

async function request(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch (err) {
    return { ok: false, status: 0, error: `Cannot reach the engine (${err && err.message ? err.message : 'network error'}).` };
  }

  let text = '';
  try { text = await res.text(); } catch { text = ''; }

  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = null; }
  }

  if (!res.ok) {
    const msg = body && typeof body.error === 'string' && body.error
      ? body.error
      : `The engine returned HTTP ${res.status}.`;
    return { ok: false, status: res.status, error: msg, data: body };
  }
  if (body && typeof body.error === 'string' && body.error) {
    return { ok: false, status: res.status, error: body.error, data: body };
  }
  if (body === null) {
    return { ok: false, status: res.status, error: 'The engine returned a response this client could not read.' };
  }
  return { ok: true, status: res.status, data: body };
}

const getJSON = (path) => request(path, { headers: { accept: 'application/json' } });
const postJSON = (path, body) => request(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify(body || {})
});

/* ─────────────────────────────── state ─────────────────────────────── */

const S = {
  health: null,
  ladder: null,          // [{ ordinal, realm, ... }]
  rootsRef: null,        // { roots, attributes }
  rootsByKey: new Map(),
  run: null,
  cultivator: null,
  ambient: 'normal',
  derived: null,
  tolls: [],
  log: [],
  /** turn -> ToolCallRecord[], from the most recent /api/act on that turn. */
  inspectors: new Map(),
  busy: false,
  mock: false
};

const app = $('#app');

/** Replace the local mirror of server state. Never synthesises game values. */
function applyState(payload) {
  if (!payload || typeof payload !== 'object') return;
  if ('run' in payload) S.run = payload.run || null;
  if ('cultivator' in payload) S.cultivator = payload.cultivator || null;
  if ('ambient' in payload) S.ambient = payload.ambient || 'normal';
  if ('derived' in payload) S.derived = payload.derived || null;
  if ('tolls' in payload && Array.isArray(payload.tolls)) S.tolls = payload.tolls;
  if ('log' in payload && Array.isArray(payload.log)) S.log = payload.log;
}

/* ─────────────────────────────── screens ─────────────────────────────── */

function showScreen(id) {
  app.dataset.screen = id;
  $$('.screen').forEach((s) => { s.hidden = s.dataset.screenId !== id; });
  if (id !== 'play') closeSheetDrawer();
}

function routeFromState() {
  if (!S.run || !S.cultivator) { showScreen('opening'); renderStatus(); return; }
  if (S.run.status === 'active') {
    showScreen('play');
    renderPlay();
    focusCommand();
  } else {
    showScreen('death');
    renderDeath();
  }
  renderStatus();
}

/* ─────────────────────────────── statusbar ─────────────────────────────── */

function renderStatus() {
  const left = $('#status-run');
  const right = $('#status-provider');

  if (S.run && S.cultivator) {
    left.textContent = `run ${String(S.run.id).slice(0, 8)} · turn ${fmtInt(S.run.turn)} · ` +
      `day ${fmtInt(S.run.elapsedDays)} (${fmtDays(S.run.elapsedDays)}) · status ${S.run.status}`;
  } else {
    left.textContent = 'no active run';
  }

  const h = S.health;
  if (h) {
    const p = h.provider || {};
    const cfg = p.configured === false ? ' (not configured)' : '';
    right.textContent = `engine ${h.version || '?'} · narrator ${p.name || 'unknown'}${p.model ? `/${p.model}` : ''}${cfg}`;
  } else {
    right.textContent = 'engine unreachable';
  }
}

/* ──────────────────────────── opening screen ──────────────────────────── */

function renderRootsReference() {
  const host = $('#roots-table');
  const attrHost = $('#attrs-table');
  const ref = S.rootsRef;

  if (!ref) {
    host.innerHTML = html`<p class="form-error">The spirit-root table could not be loaded. The engine is still the authority - you can begin a run regardless.</p>`;
    attrHost.innerHTML = html`<p class="muted">Unavailable.</p>`;
    return;
  }

  const roots = Array.isArray(ref.roots) ? ref.roots.slice() : [];
  const maxProb = roots.reduce((m, r) => Math.max(m, Number(r.probability) || 0), 0) || 1;
  roots.sort((a, b) => (Number(b.probability) || 0) - (Number(a.probability) || 0));

  host.innerHTML = roots.length
    ? html`<div class="roots">${roots.map((r) => raw(html`
        <div class="root g-${String(r.grade || 'single')}">
          <div class="root__name">
            ${r.name || r.key}
            <span class="grade">${r.grade || '-'}</span>
            ${r.cultivationSpeed != null ? raw(html`<span class="muted" style="font-family:var(--font-mono);font-size:11.5px">×${fmtNum(r.cultivationSpeed, 2)} speed</span>`) : ''}
          </div>
          <div class="root__prob">${fmtProb(r.probability)}</div>
          <div class="root__desc">${r.description || (Array.isArray(r.elements) ? r.elements.join(' · ') : '')}</div>
          <div class="root__bar"><i style="width:${((Number(r.probability) || 0) / maxProb * 100).toFixed(2)}%"></i></div>
        </div>`))}</div>`
    : html`<p class="muted">The engine reported no spirit roots.</p>`;

  const attrs = Array.isArray(ref.attributes) ? ref.attributes : [];
  attrHost.innerHTML = attrs.length
    ? html`<div class="attrs">${attrs.map((a) => raw(html`
        <div class="attr">
          <div class="attr__name">${a.name || a.key}</div>
          <div class="attr__range">${fmtInt(a.min)}-${fmtInt(a.max)}</div>
          <div class="attr__desc">${a.description || ''}</div>
        </div>`))}</div>`
    : html`<p class="muted">The engine reported no attributes.</p>`;
}

async function beginRun(ev) {
  ev.preventDefault();
  if (S.busy) return;

  const input = $('#begin-name');
  const errorBox = $('#begin-error');
  const submit = $('#begin-submit');
  const name = input.value.trim();

  errorBox.hidden = true;

  if (!name) {
    errorBox.textContent = 'Give the cultivator a name first.';
    errorBox.hidden = false;
    input.focus();
    return;
  }

  S.busy = true;
  submit.disabled = true;
  submit.textContent = 'Rolling your fate…';

  const res = await postJSON('/api/run/new', { name });

  S.busy = false;
  submit.disabled = false;
  submit.textContent = 'Begin Cultivation';

  if (!res.ok) {
    errorBox.textContent = res.error;
    errorBox.hidden = false;
    return;
  }

  applyState(res.data);
  // /api/run/new returns { run, cultivator }; pull the full state for log + derived.
  await refreshState({ quiet: true });
  resetLogRender();
  routeFromState();

  // The register opens in its own tab and links back here for the roster, which
  // lives as an overlay rather than a page of its own.
  if (params.get('open') === 'roster' && S.health && S.health.adminMode) openRoster();
  announceRoll();
}

/** A one-time, engine-sourced note about the talent that was just dealt. */
function announceRoll() {
  const c = S.cultivator;
  if (!c) return;
  const root = S.rootsByKey.get(c.spiritRoot);
  toast(
    'Talent rolled - permanent',
    `${root ? root.name : titleise(c.spiritRoot)} · Might ${c.attributes.might}, Insight ${c.attributes.insight}, ` +
    `Fortune ${c.attributes.fortune}, Charm ${c.attributes.charm}`,
    'info'
  );
}

/* ────────────────────────────── play screen ────────────────────────────── */

function renderPlay() {
  warnIfImmortalStatusMissing();
  renderWarnings();
  renderLog();
  renderSheet();
  renderQuickActions();
}

/* ── warnings ── */

function renderWarnings() {
  const c = S.cultivator;
  const d = S.derived || {};
  const host = $('#warnings');
  if (!c) { host.innerHTML = ''; return; }

  const items = [];
  const hasBody = !isBodiless(c);

  // 1. Starvation. Nothing bodiless starves.
  const starving = Number(c.starvationTurns) || 0;
  const satiety = Number(c.satiety) || 0;
  if (hasBody && starving > 0) {
    items.push({
      level: 'critical',
      mark: '✕',
      title: `Starving - ${starving} turn${starving === 1 ? '' : 's'} at zero satiety`,
      body: 'Five consecutive turns without food is fatal. Eat now.'
    });
  } else if (hasBody && satiety <= 15) {
    items.push({
      level: 'critical',
      mark: '!',
      title: `Satiety ${fmtInt(satiety)} - starvation is imminent`,
      body: 'At zero, the starvation counter starts. Five turns after that, the run ends.'
    });
  } else if (hasBody && satiety <= 30) {
    items.push({
      level: 'severe',
      mark: '!',
      title: `Satiety ${fmtInt(satiety)} - running low`,
      body: 'Find food before entering seclusion; a long time-skip on an empty stomach kills.'
    });
  }

  // 2. Untreated meridian injuries.
  const untreated = Number(d.untreatedInjuries != null
    ? d.untreatedInjuries
    : (c.injuries || []).filter((i) => !i.treated).length) || 0;
  if (untreated >= 3) {
    // The countdown is the engine's own number - derived.turnsUntilBleedOut -
    // never one worked out here. Null means no clock is running, which at this
    // count should not happen, so the line falls back to the standing warning
    // rather than printing a number the engine did not send.
    const bleed = d.turnsUntilBleedOut;
    const fullWindow = Number(d.bleedOutTurns) || 0;
    items.push({
      level: 'critical',
      mark: '✕',
      title: bleed == null
        ? `${untreated} untreated injuries`
        : `${untreated} untreated injuries - ${fmtInt(bleed)} days before they kill you`,
      body: bleed == null
        ? 'Meridian damage does not heal on its own. Any further combat is fatal.'
        : `Meridian damage does not heal on its own. Any further combat is fatal, and doing nothing is too: ${fullWindow} days at this many open wounds and the meridians give out. Find a healer or a pill.`
    });
  } else if (untreated === 2) {
    items.push({
      level: 'severe',
      mark: '!',
      title: '2 untreated injuries',
      body: 'One more and the run is on a fatal track. Cultivation speed and breakthrough odds are already penalised.'
    });
  }

  // 3. The settling clock, which is NOT fifty years everywhere. It is the
  //    engine's `stagnationYearsForOrdinal`, arriving on `derived`, and the
  //    thresholds are fractions of it rather than the 45 and 35 that were cut
  //    against a 50-year assumption.
  const clocks = mortalClocks(d, c);
  const stag = clocks.stag;
  const stagRatio = Number.isFinite(clocks.stagLimit) && clocks.stagLimit > 0
    ? stag / clocks.stagLimit
    : 0;
  if (stagRatio >= 0.9) {
    items.push({
      level: 'critical',
      mark: '✕',
      title: `${fmtNum(stag)} years at ${d.rankName || 'this rung'} - ${fmtNum(clocks.stagLeft)} left`,
      body: `${fmtNum(clocks.stagLimit, 0)} years is all this rung credits. Cross, or settle here `
        + 'for good - and if you do neither, the second one happens anyway.'
    });
  } else if (stagRatio >= 0.7) {
    items.push({
      level: 'severe',
      mark: '!',
      title: `${fmtNum(stag)} years stagnant at ${d.rankName || 'this rung'}`,
      body: `This rung credits ${fmtNum(clocks.stagLimit, 0)} years and ${fmtNum(clocks.stagLeft)} `
        + 'are left. Time is now the thing most likely to end the climb.'
    });
  }

  // 4. Lifespan. A False Immortal's ceiling is their own, not their ordinal's.
  const life = clocks.lifeLeft;
  if (Number.isFinite(life) && life <= 3) {
    items.push({
      level: 'critical',
      mark: '✕',
      title: `${fmtNum(life)} years of lifespan remain`,
      body: 'Only advancing a realm extends it.'
    });
  } else if (Number.isFinite(life) && life <= 15) {
    items.push({
      level: 'severe',
      mark: '!',
      title: `${fmtNum(life)} years of lifespan remain`,
      body: 'Lifespan is granted by realm, not by rest.'
    });
  }

  // 4b. The span already spent, which is a different warning from the span
  //     remaining and fires long before it. At Void Refinement the crossing is
  //     down a tenth with four hundred years still in hand, and nothing in this
  //     list used to say so - lifespan appeared as a countdown with no
  //     consequence attached until the last fifteen years of it.
  if (clocks.pressure < 0) {
    items.push({
      level: clocks.pressure <= -0.12 ? 'critical' : 'severe',
      mark: clocks.pressure <= -0.12 ? '✕' : '!',
      title: `${fmtPct(clocks.spanBurnt, 0)} of this rung's span spent`,
      body: `The next crossing carries ${fmtSignedPct(clocks.pressure)} for it, and the figure only `
        + 'grows. Waiting to gather more is now buying odds with odds.'
    });
  }

  // 5. The soul is its own clock, and pills do not touch it.
  const soul = soulStateOf(c);
  if (soul === 'fading') {
    items.push({
      level: 'critical',
      mark: 'x',
      title: 'The soul is fading',
      body: 'This is the one that does not stop for pills, seclusion or a better cave. Whatever is going to be done about it has to be done now.'
    });
  } else if (soul === 'fragmented') {
    items.push({
      level: 'severe',
      mark: '!',
      title: 'The soul is fragmented',
      body: 'Pieces of it are elsewhere, or gone. What is left is what is acting.'
    });
  }

  // 6. Body failing. Only meaningful for something that has one.
  const hp = Number(c.hp) || 0;
  const maxHp = Number(c.maxHp) || 1;
  if (!isBodiless(c) && hp > 0 && hp / maxHp <= 0.25) {
    items.push({
      level: 'critical',
      mark: '✕',
      title: `HP ${fmtInt(hp)} / ${fmtInt(maxHp)}`,
      body: 'There is no death save in this game.'
    });
  }

  host.innerHTML = items.map((w) => html`
    <div class="warn warn--${w.level}">
      <span class="warn__mark" aria-hidden="true">${w.mark}</span>
      <span class="warn__text"><b>${w.title}</b><span>${w.body}</span></span>
    </div>`).join('');
}

/* ── narrative log ── */

let renderedLog = [];

function resetLogRender() {
  renderedLog = [];
  S.inspectors = new Map();
  $('#entries').innerHTML = '';
}

function logSig(e, withInspector) {
  return `${e.role}${e.turn}${e.text}${withInspector ? '1' : '0'}`;
}

/* -- The inspector ------------------------------------------------------
   `toolCalls` is the visible proof of the project's central claim, so it is
   rendered beside the prose rather than hidden in a console: the player can
   read the engine's own one-line account of every routine that ran and compare
   it against what the narrator made of it.

   Rows carrying `source` are the two model steps - routing and narration. They
   are marked as decoration so it is never ambiguous which lines are authority.
   ---------------------------------------------------------------------- */

function isNarratorStep(call) {
  return call.source !== undefined || String(call.name || '').startsWith('narrator.');
}

function toolCallMarkup(call) {
  const decoration = isNarratorStep(call);
  const failed = call.ok === false;
  const cls = [
    'tc',
    decoration ? 'tc--decoration' : 'tc--authority',
    failed ? 'tc--declined' : ''
  ].filter(Boolean).join(' ');

  return html`
    <li class="${raw(cls)}">
      <div class="tc__head">
        <code class="tc__name">${call.name || 'unknown'}</code>
        <span class="tc__action">${call.action || ''}</span>
        ${failed ? raw(html`<span class="tc__flag tc__flag--declined">declined</span>`) : ''}
        <span class="tc__flag ${raw(decoration ? 'tc__flag--decoration' : 'tc__flag--authority')}">${decoration ? 'narration step' : 'engine ruling'}</span>
        ${call.source ? raw(html`<span class="tc__source">via ${call.source}</span>`) : ''}
      </div>
      <div class="tc__summary">${call.summary || ''}</div>
      ${call.note ? raw(html`<div class="tc__note">fallback: ${call.note}</div>`) : ''}
    </li>`;
}

function inspectorMarkup(calls, turn) {
  const rulings = calls.filter((c) => !isNarratorStep(c)).length;
  const declined = calls.filter((c) => c.ok === false).length;

  return html`
    <li class="entry entry--inspect">
      <details class="inspect">
        <summary class="inspect__toggle">
          <span class="inspect__chev" aria-hidden="true">&#9656;</span>
          <span class="inspect__label">What the engine actually did</span>
          <span class="inspect__count">${fmtInt(calls.length)} step${calls.length === 1 ? '' : 's'} · ${fmtInt(rulings)} ruling${rulings === 1 ? '' : 's'}${declined ? ` · ${fmtInt(declined)} declined` : ''}</span>
        </summary>
        <div class="inspect__body">
          <p class="inspect__blurb">
            Turn ${fmtInt(turn)}, in order. Every line below is the engine's own account of a
            routine that ran. None of it was written by the narrator; compare it against the
            prose above and the two should never disagree.
          </p>
          <ol class="inspect__list">${raw(calls.map(toolCallMarkup).join(''))}</ol>
        </div>
      </details>
    </li>`;
}

function entryMarkup(entry, index) {
  const role = entry.role === 'player' || entry.role === 'engine' ? entry.role : 'narrator';
  const text = String(entry.text == null ? '' : entry.text);

  if (role === 'narrator') {
    const paras = text.split(/\n\s*\n/).filter((p) => p.trim().length);
    const body = (paras.length ? paras : [text]).map((p) => html`<p>${p.trim()}</p>`).join('');
    return html`<li class="entry entry--narrator" data-i="${index}"><div class="entry__text">${raw(body)}</div></li>`;
  }

  if (role === 'player') {
    return html`<li class="entry entry--player" data-i="${index}">
      <span class="entry__who">You</span>
      <div class="entry__text">${text}</div>
    </li>`;
  }

  return html`<li class="entry entry--engine" data-i="${index}">
    <span class="entry__who">Engine ruling${entry.turn != null ? ` · turn ${entry.turn}` : ''}</span>
    <div class="entry__text">${text}</div>
  </li>`;
}

/**
 * The inspector for turn T is rendered after the last log entry of turn T, so
 * the engine's account sits directly beneath the prose it produced.
 */
function inspectorAfter(log, index) {
  const entry = log[index];
  if (!entry || entry.turn == null) return null;
  const next = log[index + 1];
  if (next && next.turn === entry.turn) return null;   // not the last of its turn
  const calls = S.inspectors.get(entry.turn);
  return Array.isArray(calls) && calls.length ? calls : null;
}

function renderLog() {
  const list = $('#entries');
  const log = Array.isArray(S.log) ? S.log : [];
  const scroller = $('#scroll');
  const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 160;

  const blockAt = (i) => {
    const calls = inspectorAfter(log, i);
    return entryMarkup(log[i], i) + (calls ? inspectorMarkup(calls, log[i].turn) : '');
  };
  const sigAt = (i) => logSig(log[i], !!inspectorAfter(log, i));

  let shared = 0;
  while (shared < renderedLog.length && shared < log.length && renderedLog[shared] === sigAt(shared)) {
    shared++;
  }

  if (shared < renderedLog.length) {
    // History was rewritten, or an inspector was attached to an entry already
    // on screen. Either way the tail is no longer append-only; rebuild.
    list.innerHTML = log.map((_, i) => blockAt(i)).join('');
  } else if (log.length > shared) {
    let html = '';
    for (let i = shared; i < log.length; i++) html += blockAt(i);
    list.insertAdjacentHTML('beforeend', html);
  }

  renderedLog = log.map((_, i) => sigAt(i));

  if (nearBottom || shared === 0) scrollToBottom();
}

function scrollToBottom() {
  const scroller = $('#scroll');
  requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight; });
}

function setPending(on, text) {
  const box = $('#pending');
  if (text) $('#pending-text').textContent = text;
  box.hidden = !on;
  if (on) scrollToBottom();
}

/* ── cultivator sheet ── */

function meter(opts) {
  const { name, value, max, unit = '', kind = '', state = '', note = '' } = opts;
  const v = Number(value) || 0;
  const m = Number(max) || 0;
  const pct = m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0;
  return html`
    <div class="meter meter--${raw(kind)} ${raw(state)}">
      <div class="meter__top">
        <span class="meter__name">${name}</span>
        <span class="meter__val">${fmtInt(v)} / ${fmtInt(m)}${unit}</span>
      </div>
      <div class="meter__track" role="meter" aria-label="${name}" aria-valuenow="${fmtInt(v)}" aria-valuemin="0" aria-valuemax="${fmtInt(m)}">
        <div class="meter__fill" style="width:${pct.toFixed(2)}%"></div>
      </div>
      ${note ? raw(html`<div class="meter__note">${note}</div>`) : ''}
    </div>`;
}

/**
 * The dao side of the sheet.
 *
 * Rank and dao are separate axes and only one of them can ever be shut. The
 * ordinal stops at the Lid; understanding does not, because insight discovery
 * reads the spirit root and nothing else and degree has no ceiling tied to the
 * ladder. For a cultivator still climbing this is a second track. For a False
 * Immortal, whose rank is finished permanently, it is the only one left open -
 * and it is what a span that long is actually spent on, so the panel says so
 * rather than leaving their page a list of things they cannot do.
 */
function daoSection(d) {
  const dao = d.dao;
  if (!dao) return '';
  const insights = Array.isArray(dao.insights) ? dao.insights : [];
  const only = !!dao.theOnlyAxisLeft;

  if (insights.length === 0) {
    return html`
      <section class="sheet__group">
        <h3 class="sheet__label">Dao${only ? ' · the only axis left' : ''}</h3>
        <p class="dao__empty">
          ${only
            ? 'Nothing comprehended deeply enough to name. The rank is finished and this is the one thing that can still go up, which makes it the only shortfall left worth reporting.'
            : 'Nothing comprehended deeply enough to name yet. Understanding is drawn from what a cultivator is exposed to, not from what they accumulate.'}
        </p>
      </section>`;
  }

  const rows = insights
    .slice()
    .sort((a, b) => (b.degree - a.degree) || String(a.name).localeCompare(String(b.name)))
    .map((i) => html`
      <div class="dao__row${i.universal ? ' dao__row--universal' : ''}">
        <span class="dao__name">${i.name}</span>
        <span class="dao__domain">${titleise(String(i.domain))}</span>
        <span class="dao__degree">${fmtInt(i.degree)}${'\u00b0'}</span>
      </div>`)
    .join('');

  const rate = Number(dao.cultivationMultiplier) || 1;
  const bt = Number(dao.breakthroughModifier) || 0;

  return html`
    <section class="sheet__group">
      <h3 class="sheet__label">Dao${only ? ' · the only axis left' : ''}</h3>
      <div class="dao__summary">
        <span class="dao__depth">${fmtInt(dao.totalDegrees)} degrees</span>
        <span class="muted">across ${fmtInt(insights.length)} insight${insights.length === 1 ? '' : 's'}</span>
      </div>
      <div class="dao__list">${raw(rows)}</div>
      <div class="dao__effects">
        ${rate > 1 ? html`<span>×${fmtNum(rate, 2)} cultivation rate</span>` : ''}
        ${bt > 0 ? html`<span>+${fmtNum(bt * 100, 1)}% on a breakthrough</span>` : ''}
        ${rate <= 1 && bt <= 0 ? html`<span class="muted">None of it bears on what is being done right now.</span>` : ''}
      </div>
      ${only ? raw(html`<p class="dao__note">
        The ladder is shut against this name and will not open again. This is not.
      </p>`) : ''}
    </section>`;
}

function renderSheet() {
  const c = S.cultivator;
  const d = S.derived || {};
  const host = $('#sheet-body');
  if (!c) { host.innerHTML = ''; return; }

  const root = S.rootsByKey.get(c.spiritRoot);
  const attrs = c.attributes || {};
  const injuries = Array.isArray(c.injuries) ? c.injuries : [];
  const untreated = injuries.filter((i) => !i.treated);

  // Null above the Lid, and null is not zero. `Number(null) || 0` would turn
  // "this rung is not bought with qi" into "this rung costs nothing", which is
  // the opposite statement and would draw an empty bar out of a full one.
  const priced = d.progressRequired !== null && d.progressRequired !== undefined;
  const progressRequired = priced ? Number(d.progressRequired) || 0 : null;
  const progress = Number(c.cultivationProgress) || 0;
  const ready = !!d.breakthroughReady;

  const satiety = Number(c.satiety) || 0;
  const satietyState = (Number(c.starvationTurns) || 0) > 0 || satiety <= 15
    ? 'is-danger' : satiety <= 30 ? 'is-warn' : '';

  const hpRatio = (Number(c.maxHp) || 1) > 0 ? (Number(c.hp) || 0) / Number(c.maxHp) : 0;

  const clocks = mortalClocks(d, c);
  const life = clocks.lifeLeft;
  const age = clocks.age;
  // The span itself when the engine sent it; the old age+remaining sum only as
  // a fallback, and that sum is wrong for anybody living past their ceiling.
  const lifeCeiling = Number.isFinite(clocks.lifeSpan)
    ? clocks.lifeSpan
    : (Number.isFinite(life) ? age + Math.max(0, life) : 0);
  // Danger stays absolute - three years left is three years left at any rung.
  // Warn is now the engine's own line rather than a flat fifteen years: the
  // moment `lifespanPressure` starts biting is the moment the span begins
  // costing something, and at Void Refinement that arrives with four hundred
  // years still in hand, where a fifteen-year bar would never have fired.
  const lifeState = Number.isFinite(life) && life <= 3
    ? 'is-danger'
    : (Number.isFinite(life) && life <= 15) || clocks.pressure < 0 ? 'is-warn' : '';

  const stag = clocks.stag;
  // Proportions, not the 45/35 that were hand-cut against a 50-year clock.
  // 0.7 is the same fraction `facts.ts` calls the point of no return.
  const stagRatio = Number.isFinite(clocks.stagLimit) && clocks.stagLimit > 0
    ? stag / clocks.stagLimit
    : 0;
  const stagState = stagRatio >= 0.9 ? 'is-danger' : stagRatio >= 0.7 ? 'is-warn' : '';

  const ordinal = Number(c.realmOrdinal) || 0;
  const falseImmortal = isFalseImmortal(d, c);
  const foundation = d.foundationQuality || 'none';
  const soulState = soulStateOf(c);
  const soulMeta = SOUL_STATE[soulState] || { label: titleise(soulState), tone: 'warn', line: '' };
  const bodiless = isBodiless(c);

  host.innerHTML = html`
    <div class="sheet__id">
      <div class="sheet__name">${c.name}</div>
      ${d.nameTaken ? raw(html`<div class="taken-name">
        The Toll took this name. It is written here because someone has to keep it;
        no one you meet remembers it.
      </div>`) : ''}
      <div class="sheet__rank">${d.rankName || `Rank ${ordinal}`}</div>
      <div class="sheet__realmnote">
        Ordinal ${fmtInt(ordinal)} of ${fmtInt(summitOrdinal())}${d.nextRankName ? ` · next: ${d.nextRankName}` : ' · the top of the ladder'}
        · <button class="btn btn--ghost btn--sm" type="button" data-open="ladder" style="padding:0;font-size:12px;text-decoration:underline">view ladder</button>
      </div>
      ${raw(existenceMarkup(c))}
      ${falseImmortal ? raw(html`<div class="statusflag statusflag--false">
        <div class="statusflag__title">False Immortal</div>
        <div class="statusflag__body">
          The tribulation was survived and the hole was opened, and the crossing did not
          complete. Stronger than anything at Tribulation Transcendence, because part of the
          transformation did happen. Permanently barred from re-attempting: the Lid has been
          opened once against this name and will not open again. Lifespan is vast, finite,
          and countable. Something did not come back.
        </div>
      </div>`) : ''}
    </div>

    <section class="sheet__group">
      <h3 class="sheet__label">Talent · locked at creation</h3>
      <div class="rootcard">
        <div class="rootcard__top">
          <span class="rootcard__name">${root ? root.name : titleise(c.spiritRoot)}</span>
          <span class="grade g-${raw(root ? String(root.grade) : 'single')}">${root ? root.grade : '-'}</span>
        </div>
        ${root ? raw(html`<div class="rootcard__meta">
            ×${fmtNum(root.cultivationSpeed, 2)} cultivation speed
            ${Array.isArray(root.elements) && root.elements.length ? ` · ${root.elements.join(', ')}` : ''}
            ${root.probability != null ? ` · ${fmtProb(root.probability)} of runs` : ''}
          </div>`) : ''}
        <div class="rootcard__lock">Not chosen. Not changeable.</div>
      </div>

      <div class="statgrid">
        <div class="stat ${raw(attrs.might === 0 ? 'stat--zero' : '')}"><div class="stat__val">${fmtInt(attrs.might)}</div><div class="stat__key">Might</div></div>
        <div class="stat ${raw(attrs.insight === 0 ? 'stat--zero' : '')}"><div class="stat__val">${fmtInt(attrs.insight)}</div><div class="stat__key">Insight</div></div>
        <div class="stat ${raw(attrs.fortune === 0 ? 'stat--zero' : '')}"><div class="stat__val">${fmtInt(attrs.fortune)}</div><div class="stat__key">Fortune</div></div>
        <div class="stat ${raw(attrs.charm === 0 ? 'stat--zero' : '')}"><div class="stat__val">${fmtInt(attrs.charm)}</div><div class="stat__key">Charm</div></div>
      </div>
    </section>

    <section class="sheet__group">
      <h3 class="sheet__label">Cultivation</h3>
      ${progressRequired === null
        ? raw(html`<div class="vital-line tone-odd">
            <div class="vital-line__top">
              <span class="meter__name">Progress</span>
              <span class="vital-line__val">Not counted here</span>
            </div>
            <div class="meter__note">
              Above the Lid qi stops being the currency, so there is no figure to fill and
              nothing to fill it toward. This is not a reading the engine failed to take.
            </div>
          </div>`)
        : raw(meter({
            name: d.nextRankName ? `Toward ${d.nextRankName}` : 'Progress',
            value: progress,
            max: progressRequired,
            kind: 'prog'
          }))}
      ${progressRequired === null ? '' : raw(html`
        <div class="meter__note ${raw(falseImmortal ? 'is-barred' : ready ? 'is-ready' : '')}">
          ${falseImmortal
            ? 'Full, and it does not matter. The crossing does not open again for this cultivator.'
            : ready
              ? 'Breakthrough ready - the engine will resolve the attempt.'
              : progressRequired > 0
                ? `${fmtInt(Math.max(0, progressRequired - progress))} qi-units short.`
                : 'The engine reports no further rank.'}
        </div>`)}
      <div class="ambient">
        <span class="muted">Ambient qi</span>
        <span class="ambient__val amb-${raw(String(S.ambient))}">${titleise(S.ambient)}</span>
      </div>
      <div class="meter__note">${AMBIENT_TEXT[S.ambient] || ''}</div>
      <div class="foundation foundation--${raw(String(foundation))}">
        <div class="foundation__top">
          <span class="muted">Foundation</span>
          <span class="foundation__val ${raw(FOUNDATION_TONE[foundation] || '')}">${titleise(foundation)}</span>
        </div>
        <div class="foundation__note">${FOUNDATION_TEXT[foundation] || 'The engine reports a foundation quality this client does not recognise.'}</div>
      </div>
    </section>

    ${raw(daoSection(d))}

    <section class="sheet__group">
      <h3 class="sheet__label">Vitals</h3>
      ${bodiless
        ? raw(html`<div class="vital-line tone-odd">
            <div class="vital-line__top">
              <span class="meter__name">Health</span>
              <span class="vital-line__val">No body</span>
            </div>
            <div class="meter__note">There is nothing here to wound. What can still be harmed is the soul.</div>
          </div>`)
        : raw(meter({ name: 'Health', value: c.hp, max: c.maxHp, kind: 'hp', state: hpRatio <= 0.25 ? 'is-danger' : hpRatio <= 0.5 ? 'is-warn' : '' }))}
      ${raw(meter({ name: 'Qi', value: c.qi, max: c.maxQi, kind: 'qi' }))}
      ${soulState !== 'intact' ? raw(html`
        <div class="vital-line tone-${raw(soulMeta.tone)}">
          <div class="vital-line__top">
            <span class="meter__name">Soul</span>
            <span class="vital-line__val">${soulMeta.label}</span>
          </div>
          <div class="meter__note">${soulMeta.line}</div>
        </div>`) : ''}
      ${bodiless
        ? raw(html`<div class="vital-line tone-odd">
            <div class="vital-line__top">
              <span class="meter__name">Satiety</span>
              <span class="vital-line__val">Not applicable</span>
            </div>
            <div class="meter__note">Hunger, wounds and ageing are the body's arithmetic, and there is no body.</div>
          </div>`)
        : raw(meter({
            name: 'Satiety',
            value: satiety,
            max: 100,
            kind: 'food',
            state: satietyState,
            note: (Number(c.starvationTurns) || 0) > 0
              ? `STARVING - turn ${fmtInt(c.starvationTurns)} of 5. The fifth is fatal.`
              : ''
          }))}
    </section>

    <section class="sheet__group">
      <h3 class="sheet__label">Mortality</h3>
      ${raw(meter({
        name: 'Age',
        value: age,
        max: lifeCeiling || age || 1,
        unit: ' yr',
        kind: 'age',
        state: lifeState,
        note: bodiless
          ? 'Time still passes. The ceiling belongs to a body that is not currently in play.'
          : Number.isFinite(life)
            ? (falseImmortal
                ? `${fmtNum(life)} years remain of a False Immortal's own span. Vast, finite, and countable.`
                : `${fmtNum(life)} of the ${fmtNum(clocks.lifeSpan)} years this rung grants remain`
                  + `${Number.isFinite(clocks.spanBurnt) ? ` - ${fmtPct(clocks.spanBurnt, 0)} of the span spent` : ''}.`)
            : ''
      }))}
      ${Number.isFinite(clocks.stagLimit)
        ? raw(meter({
            name: 'Years at this rung',
            value: stag,
            max: clocks.stagLimit,
            unit: ' yr',
            kind: 'stag',
            state: stagState,
            note: settlingNote(clocks, d)
          }))
        : raw(html`<div class="vital-line tone-unresolved">
            <div class="vital-line__top">
              <span class="meter__name">Years at this rung</span>
              <span class="vital-line__val">${fmtNum(stag)} yr</span>
            </div>
            <div class="meter__note">This client was served a state that did not say how long
              this rung credits, so it will not guess at one.</div>
          </div>`)}
      ${raw(reckoning(clocks, d))}
    </section>

    <section class="sheet__group">
      <h3 class="sheet__label">Standing</h3>
      <dl class="kv">
        <dt>Spirit stones</dt><dd>${fmtInt(c.spiritStones)}</dd>
        <dt>Sect</dt><dd>${d.sectName
          ? d.sectName
          : (c.sectId ? 'Affiliated (name unknown to this client)' : 'Unaffiliated')}</dd>
        <dt>Rank</dt><dd>${c.sectRank ? String(c.sectRank) : '-'}</dd>
      </dl>
    </section>

    <section class="sheet__group">
      <h3 class="sheet__label">
        Injuries${untreated.length ? ` · ${untreated.length} untreated` : ''}
      </h3>
      ${injuries.length
        ? raw(injuries.map((i) => html`
            <div class="injury injury--${raw(i.treated ? 'treated' : 'untreated')}">
              <span class="injury__sev">${i.severity || 'injury'}</span>
              <span class="injury__desc">${i.description || titleise(i.severity)}</span>
              <span class="injury__src">${titleise(i.source)}${i.treated ? ' · treated' : ' · untreated'}</span>
            </div>`).join(''))
        : raw(html`<p class="empty">Meridians intact.</p>`)}
    </section>

    ${raw(tollLedgerMarkup(S.tolls))}

    <section class="sheet__group">
      <h3 class="sheet__label">Feuds</h3>
      ${Array.isArray(c.feuds) && c.feuds.length
        ? raw(html`<div class="chips">${c.feuds.map((f) => raw(html`<span class="chip chip--feud">${f}</span>`))}</div>`)
        : raw(html`<p class="empty">No one is currently hunting you.</p>`)}
    </section>

    <section class="sheet__group">
      <h3 class="sheet__label">Techniques</h3>
      ${Array.isArray(c.knownTechniques) && c.knownTechniques.length
        ? raw(html`<div class="chips">${c.knownTechniques.map((t) => raw(html`<span class="chip chip--tech">${t}</span>`))}</div>`)
        : raw(html`<p class="empty">You know no arts. Breathing counts for very little.</p>`)}
    </section>`;
}

/* -- The Toll -----------------------------------------------------------
   Every instalment charged at a realm boundary, oldest first. What a crossing
   takes is never a stat: a bond, a memory, a mastered technique, or the name.
   Read top to bottom it is the shape of who the cultivator used to be, which
   is why it gets a panel rather than a line.
   ---------------------------------------------------------------------- */

function tollRowMarkup(toll, index) {
  const outcome = String(toll.outcome || 'clean');
  const taken = outcome === 'taken' && toll.taken ? toll.taken : null;
  const from = ladderName(toll.fromOrdinal) || `ordinal ${fmtInt(toll.fromOrdinal)}`;
  const to = ladderName(toll.toOrdinal) || `ordinal ${fmtInt(toll.toOrdinal)}`;

  return html`
    <li class="toll toll--${raw(outcome)}">
      <div class="toll__head">
        <span class="toll__idx">${fmtInt(Number(toll.boundaryIndex) + 1)}</span>
        <span class="toll__crossing">${from} <span class="toll__arrow">-&gt;</span> ${to}</span>
        <span class="toll__outcome">${titleise(outcome)}</span>
      </div>
      ${taken ? raw(html`
        <div class="toll__taken">
          <span class="toll__kind">${TOLL_KIND_TEXT[taken.kind] || taken.kind}</span>
          <span class="toll__label">${taken.label}</span>
        </div>
        <div class="toll__reason">${taken.reason}</div>`) : raw(html`
        <div class="toll__reason">${TOLL_OUTCOME_TEXT[outcome] || ''}</div>`)}
      <div class="toll__meta">
        risk ${fmtPct(toll.risk, 1)} · roll ${Number.isFinite(Number(toll.roll)) ? Number(toll.roll).toFixed(4) : '-'}
        ${toll.chargedOnDay != null ? ` · day ${fmtInt(toll.chargedOnDay)}` : ''}
      </div>
    </li>`;
}

function tollLedgerMarkup(tolls, opts = {}) {
  const list = Array.isArray(tolls) ? tolls : [];
  const takenCount = list.filter((t) => t.outcome === 'taken').length;
  const bare = !!opts.bare;

  const body = list.length
    ? html`
        <p class="toll__summary">
          ${fmtInt(list.length)} instalment${list.length === 1 ? '' : 's'} charged ·
          ${fmtInt(takenCount)} collected
        </p>
        <ol class="tolls">${raw(list.map(tollRowMarkup).join(''))}</ol>`
    : html`<p class="empty">Nothing charged yet. The Toll falls at realm boundaries, never on the small steps between sub-ranks.</p>`;

  if (bare) return body;

  return html`
    <section class="sheet__group">
      <h3 class="sheet__label">The Toll${takenCount ? ` · ${fmtInt(takenCount)} taken` : ''}</h3>
      ${raw(body)}
    </section>`;
}

/* ── quick actions ── */

function renderQuickActions() {
  const d = S.derived || {};
  const btn = $('#btn-breakthrough');
  const hint = $('#btn-breakthrough-hint');
  const ready = !!d.breakthroughReady;
  const barred = isFalseImmortal();

  // Every refusal states its own case. `breakthroughBlockedReason` is the
  // engine's own refusal text, so the control never has to guess at why.
  const reason = typeof d.breakthroughBlockedReason === 'string' && d.breakthroughBlockedReason
    ? d.breakthroughBlockedReason
    : null;

  const refusal = $('#refusal');

  if (ready) {
    btn.classList.remove('btn--barred');
    btn.disabled = false;
    hint.textContent = d.nextRankName ? `to ${d.nextRankName}` : 'the engine says you are ready';
    btn.title = 'The engine reports breakthroughReady = true.';
    refusal.hidden = true;
    refusal.textContent = '';
  } else {
    // Barred is permanent rather than merely not-yet, and reads differently.
    btn.classList.toggle('btn--barred', barred);
    btn.disabled = true;
    hint.textContent = barred ? 'the Lid will not open twice' : 'not yet';
    btn.title = reason
      || (barred
        ? 'Permanently barred. The Lid has already been opened once against this name. ' +
          'The engine refuses the attempt; there is no version of this that works.'
        : 'Available only when the engine reports breakthroughReady.');

    // The engine's own words, on the page rather than in a tooltip - there is
    // no hover on a phone, and the refusal is the most useful thing on screen.
    refusal.textContent = reason || '';
    refusal.classList.toggle('refusal--barred', barred);
    refusal.hidden = !reason;
  }

  const busy = S.busy;
  $('#btn-cultivate').disabled = busy;
  $('#command-send').disabled = busy;
  if (busy) btn.disabled = true;
}

function focusCommand() {
  const input = $('#command-input');
  if (!input || app.dataset.screen !== 'play') return;
  if ($('#overlay').hidden === false) return;
  // Do not steal focus from a user mid-selection elsewhere on mobile.
  requestAnimationFrame(() => { try { input.focus({ preventScroll: true }); } catch { input.focus(); } });
}

/* ─────────────────────────────── actions ─────────────────────────────── */

function setBusy(on) {
  S.busy = on;
  renderQuickActions();
}

async function refreshState({ quiet = false } = {}) {
  const res = await getJSON('/api/state');
  if (!res.ok) {
    // No run yet is a legitimate, expected condition - not an error to shout about.
    if (res.status === 404 || res.status === 204) { S.run = null; S.cultivator = null; return false; }
    if (!quiet) toast('Engine', res.error);
    return false;
  }
  applyState(res.data);
  return true;
}

async function submitAction(ev) {
  if (ev) ev.preventDefault();
  if (S.busy) return;

  const input = $('#command-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  setBusy(true);
  setPending(true, 'The narrator considers, the engine rules…');

  const res = await postJSON('/api/act', { input: text });

  setPending(false);
  setBusy(false);

  if (!res.ok) {
    toast('Action refused', res.error);
    input.value = text;         // give it back rather than eating it
    focusCommand();
    return;
  }

  const payload = res.data || {};

  // The transcript belongs to the server. `narration` is only echoed into the
  // log when the returned state carried no log at all - otherwise the two would
  // double up, since the returned narration need not be byte-identical to the
  // entry the engine recorded.
  const serverOwnsLog = !!(payload.state && Array.isArray(payload.state.log));
  if (payload.state) applyState(payload.state);

  if (!serverOwnsLog) {
    const turn = S.run ? S.run.turn : 0;
    const added = [{ role: 'player', text, turn }];
    if (payload.narration) added.push({ role: 'narrator', text: payload.narration, turn });
    S.log = S.log.concat(added);
  }

  // Keep the engine's own account of this turn so the inspector can show it
  // beside the prose. Keyed by turn, because that is what the log rows carry.
  if (Array.isArray(payload.toolCalls) && payload.toolCalls.length) {
    const turn = S.run ? S.run.turn : 0;
    const lastLoggedTurn = S.log.length ? S.log[S.log.length - 1].turn : turn;
    S.inspectors.set(lastLoggedTurn != null ? lastLoggedTurn : turn, payload.toolCalls);
  }

  afterMutation();
}

async function doCultivate(days) {
  if (S.busy) return;
  setBusy(true);
  setPending(true, `Seclusion - ${fmtDays(days)}…`);

  const res = await postJSON('/api/cultivate', { days });

  setPending(false);
  setBusy(false);

  if (!res.ok) { toast('Cultivation refused', res.error); focusCommand(); return; }

  const payload = res.data || {};
  if (payload.state) applyState(payload.state);
  afterMutation({ skipRoute: true });

  // `payload.events` is the MERGED list - the cultivation engine's half plus
  // the encounter layer's - and `timeSkip.events` is only the first half. This
  // button was showing no encounters at all: zero summonses across 200
  // measured lives here, against 1.63 a sect life through the typed endpoint on
  // the same build.
  if (payload.timeSkip) showTimeSkip(payload.timeSkip, payload.narration, payload.events);
  else routeFromState();
}

async function doBreakthrough() {
  if (S.busy) return;
  setBusy(true);
  setPending(true, 'The barrier is struck…');

  const res = await postJSON('/api/breakthrough', {});

  setPending(false);
  setBusy(false);

  if (!res.ok) { toast('Breakthrough refused', res.error); focusCommand(); return; }

  const payload = res.data || {};
  if (payload.state) applyState(payload.state);
  afterMutation({ skipRoute: true });

  if (payload.result) showBreakthrough(payload.result);
  else routeFromState();
}

/** Re-render after any state mutation, and route to death if the run ended. */
function afterMutation({ skipRoute = false } = {}) {
  if (!S.run || S.run.status !== 'active') {
    if (!skipRoute) routeFromState();
    else { renderStatus(); }
    return;
  }
  renderPlay();
  renderStatus();
  if (!skipRoute) focusCommand();
}

/* ─────────────────────────────── overlay ─────────────────────────────── */

let overlayCloseHandler = null;
let lastFocused = null;

function openOverlay({ title, body, foot = '', tone = '', wide = false, onClose = null }) {
  const overlay = $('#overlay');
  const panel = $('#overlay-panel');
  lastFocused = document.activeElement;

  $('#overlay-title').textContent = title;
  $('#overlay-body').innerHTML = body;
  const footEl = $('#overlay-foot');
  footEl.innerHTML = foot;
  footEl.hidden = !foot;

  if (tone) panel.dataset.tone = tone; else delete panel.dataset.tone;
  if (wide) panel.dataset.wide = wide === 'x' ? '2' : '1'; else delete panel.dataset.wide;

  overlay.hidden = false;
  overlayCloseHandler = onClose;
  panel.scrollTop = 0;
  $('#overlay-body').scrollTop = 0;
  requestAnimationFrame(() => {
    const first = panel.querySelector('[data-autofocus]') || panel;
    try { first.focus({ preventScroll: true }); } catch { first.focus(); }
  });
}

function closeOverlay() {
  const overlay = $('#overlay');
  if (overlay.hidden) return;
  overlay.hidden = true;
  const cb = overlayCloseHandler;
  overlayCloseHandler = null;
  if (lastFocused && document.contains(lastFocused) && lastFocused !== document.body) {
    try { lastFocused.focus({ preventScroll: true }); } catch { /* ignore */ }
  }
  lastFocused = null;
  if (typeof cb === 'function') cb();
  else focusCommand();
}

/* ── breakthrough result ── */

function showBreakthrough(result) {
  const meta = OUTCOME_META[result.outcome] || { cls: 'bt-stable', label: titleise(result.outcome), tone: '', headline: '' };
  const mods = Array.isArray(result.modifiers) ? result.modifiers : [];
  const modTotal = mods.reduce((s, m) => s + (Number(m.delta) || 0), 0);
  const finalChance = Number(result.finalChance);
  const roll = Number(result.roll);
  const trib = result.tribulation;

  const fromName = ladderName(result.fromOrdinal);
  const toName = ladderName(result.toOrdinal);
  const crossed = isBoundaryOrdinal(result.fromOrdinal);

  const injuries = Array.isArray(result.injuriesSustained) ? result.injuriesSustained : [];

  const body = html`
    <div class="bt">
      <div class="bt__banner ${raw(meta.cls)}">
        <div class="bt__outcome">${meta.label}</div>
        <div class="bt__headline">${result.outcome === 'success' && toName ? `${toName}.` : meta.headline}</div>
      </div>

      <div class="bt__step">
        <span class="bt__from">${fromName || `ordinal ${fmtInt(result.fromOrdinal)}`}</span>
        <span class="bt__arrow">→</span>
        <span class="bt__to">${toName || `ordinal ${fmtInt(result.toOrdinal)}`}</span>
        ${crossed ? raw(html`<span class="bt__boundary">realm boundary</span>`) : ''}
      </div>

      ${trib ? raw(html`
        <div class="tribulation">
          <div class="tribulation__title">⚡ Heavenly Tribulation</div>
          <div class="tribulation__strikes">
            ${Array.from({ length: Math.max(0, Math.min(40, Number(trib.strikes) || 0)) }, (_, i) =>
              raw(`<span class="strike" style="animation-delay:${(i * 90)}ms"></span>`))}
          </div>
          <div class="tribulation__verdict ${raw(trib.survived ? 'is-good' : 'is-bad')}">
            ${fmtInt(trib.strikes)} strike${Number(trib.strikes) === 1 ? '' : 's'} fell.
            ${trib.survived ? 'You are still standing.' : 'You were not standing at the end of it.'}
          </div>
        </div>`) : ''}

      <div>
        <div class="section__label">The engine's arithmetic</div>
        <div class="mods">
          ${mods.length
            ? raw(mods.map((m) => html`
                <div class="mod">
                  <span class="mod__src">${titleise(m.source)}</span>
                  <span class="mod__delta ${raw(deltaClass(m.delta))}">${fmtSignedPct(m.delta)}</span>
                </div>`).join(''))
            : raw(html`<div class="mod"><span class="mod__src muted">No modifiers applied.</span><span class="mod__delta is-nil">-</span></div>`)}
          <div class="mod mod--total">
            <span class="mod__src">Final chance</span>
            <span class="mod__delta">${fmtPct(finalChance, 2)}</span>
          </div>
          ${mods.length ? raw(html`
            <div class="mod">
              <span class="mod__src muted">(modifiers sum to ${fmtSignedPct(modTotal)})</span>
              <span class="mod__delta is-nil"></span>
            </div>`) : ''}
        </div>
      </div>

      <div>
        <div class="section__label">Final chance versus the roll</div>
        ${raw(rollViz(finalChance, roll))}
      </div>

      ${injuries.length ? raw(html`
        <div>
          <div class="section__label">Injuries sustained</div>
          ${raw(injuries.map((i) => html`
            <div class="injury injury--${raw(i.treated ? 'treated' : 'untreated')}">
              <span class="injury__sev">${i.severity}</span>
              <span class="injury__desc">${i.description}</span>
              <span class="injury__src">${titleise(i.source)}</span>
            </div>`).join(''))}
        </div>`) : ''}

      ${result.progressConsumed != null ? raw(html`
        <div class="rollviz__verdict">Progress consumed: ${fmtInt(result.progressConsumed)} qi-units.</div>`) : ''}

      ${result.narrationHint ? raw(html`<div class="hint">${result.narrationHint}</div>`) : ''}
    </div>`;

  openOverlay({
    title: trib ? 'Tribulation attempt' : 'Breakthrough attempt',
    body,
    tone: trib ? 'tribulation' : meta.tone,
    foot: html`<button class="btn btn--primary" type="button" data-overlay-close data-autofocus>Continue</button>`,
    onClose: () => routeFromState()
  });
}

function deltaClass(delta) {
  const v = Number(delta) || 0;
  if (v > 0) return 'is-pos';
  if (v < 0) return 'is-neg';
  return 'is-nil';
}

function fmtSignedPct(delta) {
  const v = Number(delta);
  if (!Number.isFinite(v)) return '-';
  const abs = Math.abs(v);
  // Modifiers are expressed on the same 0..1 scale as finalChance.
  const s = `${(abs * 100).toFixed(1)} pp`;
  if (v > 0) return `+${s}`;
  if (v < 0) return `-${s}`;
  return `0.0 pp`;
}

function rollViz(finalChance, roll) {
  const fc = Number.isFinite(finalChance) ? Math.max(0, Math.min(1, finalChance)) : 0;
  const rl = Number.isFinite(roll) ? Math.max(0, Math.min(1, roll)) : null;
  const under = rl != null && rl < fc;

  return html`
    <div class="rollviz">
      <div class="rollviz__track">
        <div class="rollviz__pass" style="width:${(fc * 100).toFixed(3)}%"></div>
        ${rl != null ? raw(html`<div class="rollviz__marker" style="left:${(rl * 100).toFixed(3)}%" title="roll ${rl.toFixed(4)}"></div>`) : ''}
      </div>
      <div class="rollviz__scale"><span>0.0000</span><span>0.5000</span><span>1.0000</span></div>
      <div class="rollviz__legend">
        <span>final chance <b style="color:var(--jade-400)">${Number.isFinite(finalChance) ? finalChance.toFixed(4) : '-'}</b></span>
        <span>roll <b style="color:var(--paper)">${rl != null ? rl.toFixed(4) : '-'}</b></span>
      </div>
      <div class="rollviz__verdict">
        ${rl == null
          ? 'The engine did not report a roll.'
          : under
            ? `The roll landed inside the shaded band (${rl.toFixed(4)} < ${fc.toFixed(4)}).`
            : `The roll landed outside the shaded band (${rl.toFixed(4)} ≥ ${fc.toFixed(4)}).`}
        The outcome above is the engine's, not this page's.
      </div>
    </div>`;
}

/* ── time-skip digest ── */

function showTimeSkip(skip, narration, merged) {
  // Prefer the merged list when the caller has one. Falls back to the skip's
  // own events so every other caller is unchanged.
  const source = Array.isArray(merged) ? merged : skip.events;
  const events = Array.isArray(source) ? source.slice() : [];
  events.sort((a, b) => (Number(a.dayOffset) || 0) - (Number(b.dayOffset) || 0));
  const deltas = skip.deltas || {};

  const deltaDefs = [
    ['cultivationProgress', 'Progress', 0, false],
    ['realmOrdinal', 'Ranks', 0, false],
    ['hp', 'HP', 0, false],
    ['qi', 'Qi', 0, false],
    ['satiety', 'Satiety', 0, false],
    ['spiritStones', 'Stones', 0, false],
    ['age', 'Age (yr)', 1, true],
    ['injuriesGained', 'Injuries', 0, true]
  ];

  const body = html`
    <div class="skip">
      ${narration ? html`<p class="skip__prose">${narration}</p>` : ''}
      <div class="skip__head">
        <span>Requested <b>${fmtDays(skip.requestedDays)}</b></span>
        <span class="muted">·</span>
        <span>Simulated <b>${fmtDays(skip.simulatedDays)}</b></span>
      </div>

      ${skip.interrupted ? raw(html`
        <div class="skip__interrupt">
          <b>Seclusion interrupted</b>
          ${skip.interruptReason || 'An event returned control before the requested time elapsed.'}
        </div>`) : ''}

      <div>
        <div class="section__label">What happened while you sat still</div>
        ${events.length
          ? raw(html`<div class="timeline">${events.map((e) => raw(html`
              <div class="tl tl--${raw(EVENT_TONE[e.kind] || 'neutral')}">
                <div class="tl__when">${fmtDaysShort(e.dayOffset)}</div>
                <div class="tl__body">
                  <div class="tl__kind">${titleise(e.kind)}</div>
                  <div class="tl__summary">${e.summary || titleise(e.kind)}</div>
                  ${e.interrupts ? raw(html`<div class="tl__interrupts">⤺ returned control</div>`) : ''}
                </div>
              </div>`))}</div>`)
          : raw(html`<p class="empty">Nothing worth recording happened. That is usually good news.</p>`)}
      </div>

      <div>
        <div class="section__label">Net change</div>
        <div class="deltas">
          ${raw(deltaDefs.map(([key, label, digits, inverted]) => {
            const v = Number(deltas[key]) || 0;
            const cls = v === 0 ? '' : (inverted ? (v > 0 ? 'is-neg' : 'is-pos') : (v > 0 ? 'is-pos' : 'is-neg'));
            return html`
              <div class="delta">
                <div class="delta__key">${label}</div>
                <div class="delta__val ${raw(cls)}">${fmtSigned(v, digits)}</div>
              </div>`;
          }).join(''))}
        </div>
      </div>

      ${skip.died ? raw(html`
        <div class="bt__banner bt-death">
          <div class="bt__outcome">Died during seclusion</div>
          <div class="bt__headline">${causeText(skip.deathCause)}.</div>
        </div>`) : ''}
    </div>`;

  openOverlay({
    title: 'Seclusion - the account of the years',
    body,
    tone: skip.died ? 'danger' : '',
    wide: true,
    foot: html`<button class="btn btn--primary" type="button" data-overlay-close data-autofocus>Continue</button>`,
    onClose: () => routeFromState()
  });
}

/* ── cultivate duration picker ── */

const PICKER = { unit: 'years', amount: 1 };
const UNIT_DAYS = { days: 1, months: DAYS_PER_MONTH, years: DAYS_PER_YEAR };
const UNIT_PRESETS = { days: [1, 3, 7, 15, 30], months: [1, 3, 6, 12], years: [1, 3, 10, 30, 50] };

function pickerDays() {
  return Math.max(1, Math.round(PICKER.amount * UNIT_DAYS[PICKER.unit]));
}

/**
 * Everything wrong with committing this many days, as plain sentences.
 *
 * Extracted so the live re-render on the custom-duration field can print the
 * same list. It used to redraw the summary line WITHOUT the warnings, so a
 * player who typed "20" into the years box - which is exactly the person who
 * needs telling - watched the warning vanish as they typed it.
 */
function pickerWarnings(days) {
  const clocks = mortalClocks();
  const life = clocks.lifeLeft;
  const years = days / DAYS_PER_YEAR;

  const warnings = [];
  if (Number.isFinite(life) && years >= life) {
    warnings.push(`This is longer than the ${fmtNum(life)} years of lifespan you have left.`);
  }
  if (Number.isFinite(clocks.stagLimit) && clocks.stag + years >= clocks.stagLimit) {
    warnings.push(`This rung credits ${fmtNum(clocks.stagLimit, 0)} years and you have spent `
      + `${fmtNum(clocks.stag)}. Sitting this out settles you here unless you cross first.`);
  }
  // What the years themselves cost the crossing you are gathering for. The
  // picker warned about running out of life and never about the attempt
  // getting worse on the way there, which is the earlier and more useful half.
  if (Number.isFinite(clocks.pressureFrom) && clocks.age + years > clocks.pressureFrom) {
    warnings.push(clocks.pressure < 0
      ? `The next crossing already carries ${fmtSignedPct(clocks.pressure)} for the span you have `
        + 'spent, and these years add to it.'
      : `This carries you past ${fmtNum(clocks.pressureFrom, 0)}, where the span you have spent `
        + 'starts costing the next crossing its own odds.');
  }
  const satiety = Number((S.cultivator || {}).satiety) || 0;
  if (satiety <= 30 && days > 30) {
    warnings.push(`Satiety is ${fmtInt(satiety)}. Long seclusion on an empty stomach is how runs end.`);
  }
  // Open meridians kill on a clock, and time is exactly what is being spent
  // here. This is the last thing read before committing it, so it is where the
  // player has to be told. The number is the engine's (derived.turnsUntilBleedOut).
  const bleed = (S.derived || {}).turnsUntilBleedOut;
  if (bleed != null) {
    warnings.push(days >= bleed
      ? `You will not survive this. ${fmtInt(untreatedCount())} untreated meridian injuries give out in ${fmtInt(bleed)} days, and you are asking for ${fmtInt(days)}. Treat them first.`
      : `${fmtInt(untreatedCount())} untreated meridian injuries. They give out in ${fmtInt(bleed)} days whatever you do; this leaves ${fmtInt(bleed - days)} to reach a healer afterwards.`);
  }

  return warnings;
}

function pickerWarningHtml(days) {
  return raw(pickerWarnings(days).map((w) => html`<div class="pick__warn">⚠ ${w}</div>`).join(''));
}

function pickerBody() {
  const presets = UNIT_PRESETS[PICKER.unit];
  const days = pickerDays();

  return html`
    <div class="pick">
      <div>
        <div class="section__label">Unit</div>
        <div class="pick__units" id="pick-units">
          ${raw(['days', 'months', 'years'].map((u) => html`
            <button class="pick__unit" type="button" data-unit="${u}" aria-pressed="${PICKER.unit === u ? 'true' : 'false'}">${titleise(u)}</button>`).join(''))}
        </div>
      </div>

      <div>
        <div class="section__label">How long</div>
        <div class="pick__amounts" id="pick-amounts">
          ${raw(presets.map((n) => html`
            <button class="pick__amount" type="button" data-amount="${n}" aria-pressed="${Number(PICKER.amount) === n ? 'true' : 'false'}">${n}</button>`).join(''))}
        </div>
        <div class="pick__custom" style="margin-top:10px">
          <label class="muted" for="pick-custom" style="font-size:13px">or exactly</label>
          <input class="input" id="pick-custom" type="number" min="1" max="100000" step="1" value="${fmtInt(PICKER.amount)}" />
          <span class="muted" style="font-size:13px">${PICKER.unit}</span>
        </div>
      </div>

      <div class="pick__total">
        Entering seclusion for <b>${fmtDays(days)}</b>
        <span class="muted" style="font-family:var(--font-mono);font-size:12.5px"> (${fmtInt(days)} days sent to the engine)</span>
        ${pickerWarningHtml(days)}
      </div>
    </div>`;
}

function openCultivatePicker() {
  const refresh = () => {
    $('#overlay-body').innerHTML = pickerBody();
    wirePicker();
  };

  const wirePicker = () => {
    $$('#pick-units .pick__unit').forEach((b) => b.addEventListener('click', () => {
      PICKER.unit = b.dataset.unit;
      PICKER.amount = UNIT_PRESETS[PICKER.unit][0];
      refresh();
    }));
    $$('#pick-amounts .pick__amount').forEach((b) => b.addEventListener('click', () => {
      PICKER.amount = Number(b.dataset.amount);
      refresh();
    }));
    const custom = $('#pick-custom');
    if (custom) {
      custom.addEventListener('input', () => {
        const v = Math.max(1, Math.min(100000, Math.round(Number(custom.value) || 1)));
        PICKER.amount = v;
        const total = $('.pick__total');
        if (total) {
          // Re-render only the summary so the number field keeps focus/caret.
          const days = pickerDays();
          total.innerHTML = html`Entering seclusion for <b>${fmtDays(days)}</b>
            <span class="muted" style="font-family:var(--font-mono);font-size:12.5px"> (${fmtInt(days)} days sent to the engine)</span>
            ${pickerWarningHtml(days)}`;
        }
        $$('#pick-amounts .pick__amount').forEach((b) => {
          b.setAttribute('aria-pressed', Number(b.dataset.amount) === v ? 'true' : 'false');
        });
      });
      custom.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); confirmPick(); }
      });
    }
  };

  const confirmPick = () => {
    const days = pickerDays();
    closeOverlay();
    doCultivate(days);
  };

  openOverlay({
    title: 'Enter seclusion',
    body: pickerBody(),
    foot: html`
      <button class="btn" type="button" data-overlay-close>Cancel</button>
      <button class="btn btn--primary" type="button" id="pick-go" data-autofocus>Cultivate</button>`,
    onClose: () => focusCommand()
  });

  wirePicker();
  $('#pick-go').addEventListener('click', confirmPick);
}

/* ── breakthrough confirmation ── */

function openBreakthroughConfirm() {
  const d = S.derived || {};
  const c = S.cultivator || {};
  const ordinal = Number(c.realmOrdinal) || 0;
  const rung = ladderEntry(ordinal);
  const boundary = rung ? !!rung.isBoundary : false;
  const trib = rung ? rung.realmKey === 'tribulation_transcendence' : false;
  const untreated = (c.injuries || []).filter((i) => !i.treated).length;
  // The age term, quoted before the strike rather than discovered in the
  // ledger afterwards. It is the engine's own `lifespanPressure` - a fraction
  // of THIS rung's span, never an absolute age - so it is stated here in the
  // one place where declining is still an option.
  const clocks = mortalClocks(d, c);
  const ageLine = clocks.pressure < 0
    ? `Age: ${fmtNum(clocks.age, 0)} of a ${fmtNum(clocks.lifeSpan, 0)}-year span - `
      + `${fmtSignedPct(clocks.pressure)} on this attempt, and it worsens every year`
    : Number.isFinite(clocks.pressureFrom)
      ? `Age: ${fmtNum(clocks.age, 0)} of a ${fmtNum(clocks.lifeSpan, 0)}-year span - no age `
        + `penalty; that begins at ${fmtNum(clocks.pressureFrom, 0)}`
      : '';

  const body = html`
    <div class="confirm">
      <p>You are about to strike the barrier between <b>${d.rankName || ladderName(ordinal)}</b>
         and <b>${d.nextRankName || ladderName(ordinal + 1)}</b>.</p>
      <div class="confirm__odds">
        <span>Base chance at this rung: ${rung ? fmtPct(rung.baseBreakthroughChance, 1) : 'unknown'}</span>
        <span>Ambient qi: ${titleise(S.ambient)}</span>
        <span>Untreated injuries: ${untreated}${untreated ? ' (each one costs you odds)' : ''}</span>
        ${!ageLine ? '' : clocks.pressure < 0
          ? raw(html`<span style="color:var(--amber-400)">${ageLine}</span>`)
          : raw(html`<span>${ageLine}</span>`)}
        ${boundary ? raw(html`<span style="color:var(--brass-300)">This is a realm boundary. The base rate is heavily taxed.</span>`) : ''}
        ${trib ? raw(html`<span style="color:var(--violet-300)">This attempt summons heavenly tribulation.</span>`) : ''}
      </div>
      <p class="muted">The engine computes the final chance from modifiers you will see afterwards. Failure can tear meridians, cause qi deviation, or kill you outright.</p>
    </div>`;

  openOverlay({
    title: trib ? 'Attempt tribulation' : 'Attempt breakthrough',
    body,
    tone: trib ? 'tribulation' : '',
    foot: html`
      <button class="btn" type="button" data-overlay-close>Not yet</button>
      <button class="btn btn--danger" type="button" id="bt-go" data-autofocus>Strike the barrier</button>`,
    onClose: () => focusCommand()
  });

  $('#bt-go').addEventListener('click', () => { closeOverlay(); doBreakthrough(); });
}

/* ─────────────────────────────── ladder ─────────────────────────────── */

function ladderEntry(ordinal) {
  if (!Array.isArray(S.ladder)) return null;
  return S.ladder.find((r) => Number(r.ordinal) === Number(ordinal)) || null;
}
function ladderName(ordinal) {
  const e = ladderEntry(ordinal);
  return e ? e.name : '';
}
function isBoundaryOrdinal(ordinal) {
  const e = ladderEntry(ordinal);
  return e ? !!e.isBoundary : false;
}

async function openLadder() {
  if (!S.ladder) {
    const res = await getJSON('/api/reference/ladder');
    if (res.ok && res.data && Array.isArray(res.data.ranks)) S.ladder = res.data.ranks;
  }

  if (!S.ladder) {
    openOverlay({
      title: 'The ladder',
      body: html`<p class="form-error">The engine could not supply the rank ladder.</p>`,
      foot: html`<button class="btn" type="button" data-overlay-close data-autofocus>Close</button>`
    });
    return;
  }

  const here = S.cultivator ? Number(S.cultivator.realmOrdinal) : -1;
  const peak = S.run ? Number(S.run.peakOrdinal) : -1;

  // Grouped off `realmKey`, never off the sub-rank names. Four realms do not
  // use Early/Mid/Late/Perfection at all - Deity Transformation counts Turns,
  // Void Refinement counts Temperings, Body Integration names the four things
  // it has joined, Grand Ascension the four Risings - and the two rungs above
  // the Lid carry no realm prefix on their names at all. The view prints what
  // the engine served and assumes nothing about its vocabulary.
  const groups = [];
  for (const r of S.ladder) {
    const last = groups[groups.length - 1];
    if (!last || last.key !== r.realmKey) groups.push({ key: r.realmKey, name: r.realm, rows: [r] });
    else last.rows.push(r);
  }

  // One span for the realm, or null where its own rungs disagree. Every realm
  // below the Lid grants the same span at each of its rungs, so the figure
  // belongs in the realm header. The Immortal realm does not: a False Immortal
  // has a vast countable span and a True Immortal has none to count, and
  // printing the first rung's number as the realm's would quietly attribute the
  // lesser of the two to both.
  const realmLifespan = (g) => {
    const spans = new Set(g.rows.map((r) => Number(r.lifespanYears)));
    return spans.size === 1 ? [...spans][0] : null;
  };

  const body = html`
    <div class="legend">
      <span><b style="color:var(--jade-300)">◆</b> where you stand</span>
      <span><b style="color:var(--brass-300)">▮</b> realm boundary - the rungs that kill</span>
      <span><b>%</b> base breakthrough chance before any modifier</span>
      <span><b>above the Lid</b> the last two rungs are the two landings of one crossing, and nothing is climbed off either</span>
    </div>
    <div class="ladder">
      ${raw(groups.map((g) => html`
        <div class="ladder__realm">
          <span class="ladder__realmname">${g.name}</span>
          <span class="ladder__realmmeta">${realmLifespan(g) === null
            ? 'lifespan differs by rung'
            : `lifespan ${lifespanText(realmLifespan(g))}`} · ordinals ${fmtInt(g.rows[0].ordinal)}-${fmtInt(g.rows[g.rows.length - 1].ordinal)}</span>
        </div>
        ${raw(g.rows.map((r) => {
          const o = Number(r.ordinal);
          const climbable = isClimbable(r);
          const cls = [
            'rung',
            r.isBoundary ? 'rung--boundary' : '',
            climbable ? '' : 'rung--abovelid',
            o === here ? 'rung--here' : '',
            here >= 0 && o === here + 1 ? 'rung--next' : '',
            here >= 0 && o < here ? 'rung--past' : ''
          ].filter(Boolean).join(' ');
          return html`
            <div class="${raw(cls)}">
              <span class="rung__ord">${fmtInt(o)}</span>
              <span class="rung__name">${r.name}${o === here ? raw(html`<span class="rung__tag">you are here</span>`)
                : (o === peak && peak > here ? raw(html`<span class="rung__tag">run peak</span>`) : '')}</span>
              ${climbable
                ? raw(html`<span class="rung__prog">${fmtInt(r.progressRequired)} qi</span>
                  <span class="rung__odds" style="color:${raw(oddsColor(r.baseBreakthroughChance))}">${fmtPct(r.baseBreakthroughChance, 0)}</span>`)
                : raw(html`<span class="rung__void">no price, and nothing to attempt</span>`)}
            </div>`;
        }).join(''))}`).join(''))}
    </div>`;

  openOverlay({
    title: `The ladder - ${fmtInt(S.ladder.length)} rungs`,
    body,
    wide: true,
    foot: html`<button class="btn" type="button" data-overlay-close data-autofocus>Close</button>`
  });
}

function oddsColor(chance) {
  const v = Number(chance) || 0;
  if (v >= 0.6) return 'var(--jade-400)';
  if (v >= 0.35) return 'var(--brass-300)';
  if (v >= 0.15) return 'var(--amber-400)';
  return 'var(--blood-300)';
}

/* ─────────────────────────────── ledger ─────────────────────────────── */

async function openLedger() {
  openOverlay({
    title: 'Death Ledger',
    body: html`<p class="muted">Reading the ledger…</p>`,
    wide: true,
    foot: html`<button class="btn" type="button" data-overlay-close data-autofocus>Close</button>`
  });

  const res = await getJSON('/api/ledger');
  const host = $('#overlay-body');
  if (!host || $('#overlay').hidden) return;

  if (!res.ok) {
    host.innerHTML = html`<p class="form-error">${res.error}</p>`;
    return;
  }

  const runs = Array.isArray(res.data.runs) ? res.data.runs : [];
  if (!runs.length) {
    host.innerHTML = html`<p class="empty">The ledger is empty. No one has died yet.</p>`;
    return;
  }

  host.innerHTML = html`
    <p class="muted" style="margin-bottom:14px;font-size:13px">
      ${fmtInt(runs.length)} run${runs.length === 1 ? '' : 's'} recorded. Entries are permanent.
    </p>
    <div class="ledger">
      ${raw(runs.map((r) => html`
        <div class="ledger__row">
          <div>
            <div class="ledger__name">${r.name || 'Unnamed'}</div>
            <div class="ledger__peak">peak: ${r.peakRankName || ladderName(r.peakOrdinal) || `ordinal ${fmtInt(r.peakOrdinal)}`}</div>
          </div>
          <div>
            <div class="ledger__cause">${causeText(r.deathCause)}</div>
            ${r.deathDescription ? raw(html`<div class="ledger__desc">${r.deathDescription}</div>`) : ''}
          </div>
          <div class="ledger__meta">
            ${fmtDays(r.elapsedDays)}<br />
            ${fmtInt(r.turn)} turns${r.endedAt ? raw(html`<br />${String(r.endedAt).slice(0, 10)}`) : ''}
          </div>
        </div>`).join(''))}
    </div>`;
}

/* ────────────────────────── admin roster (read-only) ────────────────────────── */

/**
 * An observability view over the whole world population. It renders exactly
 * what /api/admin/roster reports and offers no mutation of any kind.
 */
const ROSTER = {
  rows: null,
  sort: 'realmOrdinal',
  dir: 'desc',
  q: '',
  sect: '',
  realm: '',
  status: ''
};

const ROSTER_COLUMNS = [
  { key: 'name', label: 'Name', type: 'text', cls: 'rname' },
  { key: 'realmOrdinal', label: 'Rank', type: 'num', cls: '' },
  { key: 'realmName', label: 'Realm', type: 'text', cls: 'col-realm' },
  { key: 'location', label: 'Location', type: 'text', cls: 'col-loc' },
  { key: 'sectName', label: 'Sect', type: 'text', cls: 'wrap' },
  { key: 'spiritRootName', label: 'Spirit root', type: 'text', cls: 'col-root' },
  { key: 'age', label: 'Age / lifespan', type: 'num', cls: 'num' },
  { key: 'spiritStones', label: 'Stones', type: 'num', cls: 'num col-stones' },
  { key: 'untreatedInjuries', label: 'Untr. inj.', type: 'num', cls: 'num' },
  { key: 'existenceState', label: 'Existence', type: 'text', cls: 'wrap' }
];

/**
 * The standing register, in its own tab.
 *
 * Deliberately not an overlay. It is a long reference sheet an operator reads
 * *beside* a run rather than instead of it, and the server already renders it
 * as a complete document - so the browser is a better viewer than anything
 * this file would reimplement. Regenerating is a reload: the endpoint rebuilds
 * from the catalogs on every request.
 */
/* ── the admin menu ────────────────────────────────────────────────────
   Operator tools hang off the badge rather than sitting in the bar, so the
   top of the screen stays what a player is meant to touch. */
function openAdminMenu() {
  $('#admin-tools').hidden = false;
  $('#admin-badge').setAttribute('aria-expanded', 'true');
  const first = $('#admin-tools').querySelector('.adminmenu__item');
  if (first) first.focus();
}

function closeAdminMenu() {
  $('#admin-tools').hidden = true;
  $('#admin-badge').setAttribute('aria-expanded', 'false');
}

function openRegister(refresh) {
  const url = refresh ? '/api/admin/register.html?refresh=1' : '/api/admin/register.html';
  const win = window.open(url, 'standing-register');
  if (!win) toast('Popup blocked', 'Allow popups, or open /api/admin/register.html directly.');
  else if (refresh) toast('Rewriting the register', 'The prose is being regenerated; the tab will take a moment.');
}

async function openRoster() {
  openOverlay({
    title: 'World roster',
    body: html`<p class="muted">Reading the roster…</p>`,
    wide: 'x',
    foot: html`<button class="btn" type="button" data-overlay-close data-autofocus>Close</button>`,
    onClose: () => focusCommand()
  });

  const res = await getJSON('/api/admin/roster');
  if ($('#overlay').hidden) return;

  if (!res.ok) {
    $('#overlay-body').innerHTML = res.status === 403
      ? html`<p class="form-error">Admin mode is not enabled on this server, so the roster is not available. (${res.error})</p>`
      : html`<p class="form-error">${res.error}</p>`;
    return;
  }

  ROSTER.rows = Array.isArray(res.data.roster) ? res.data.roster : [];
  renderRosterPanel();
}

function rosterCompare(a, b) {
  const col = ROSTER_COLUMNS.find((c) => c.key === ROSTER.sort) || ROSTER_COLUMNS[0];
  const dir = ROSTER.dir === 'asc' ? 1 : -1;
  let av = a[col.key];
  let bv = b[col.key];

  if (col.type === 'num') {
    av = Number(av) || 0; bv = Number(bv) || 0;
    return (av - bv) * dir;
  }
  if (col.type === 'bool') {
    return ((av ? 1 : 0) - (bv ? 1 : 0)) * dir;
  }
  av = av == null ? '' : String(av);
  bv = bv == null ? '' : String(bv);
  if (av === bv) return String(a.name || '').localeCompare(String(b.name || ''));
  if (av === '') return 1;      // nulls sink regardless of direction
  if (bv === '') return -1;
  return av.localeCompare(bv) * dir;
}

function rosterFiltered() {
  const rows = (ROSTER.rows || []).filter((r) => !r.isPlayer);
  const q = ROSTER.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !String(r.name || '').toLowerCase().includes(q)) return false;
    if (ROSTER.sect) {
      const s = r.sectName || '__none__';
      if (s !== ROSTER.sect) return false;
    }
    if (ROSTER.realm && r.realmName !== ROSTER.realm) return false;
    const state = r.existenceState || (r.alive ? 'alive' : 'physically_dead');
    if (ROSTER.status === 'alive' && state !== 'alive') return false;
    if (ROSTER.status === 'dead' && state !== 'physically_dead') return false;
    if (ROSTER.status === 'unresolved' && state !== 'missing' && state !== 'unknown') return false;
    if (ROSTER.status === 'profound' && ['alive', 'physically_dead', 'missing', 'unknown'].includes(state)) return false;
    return true;
  }).sort(rosterCompare);
}

/**
 * Existence, rendered honestly. `missing` and `unknown` are correct answers
 * about someone the world has not settled, not gaps in the record, and they
 * are written as such rather than as an empty cell.
 */
function rosterExistenceCell(r) {
  const state = r.existenceState || (r.alive ? 'alive' : 'physically_dead');
  const meta = EXISTENCE[state] || { label: titleise(state), tone: 'unresolved' };
  const cause = state === 'physically_dead' || (!r.existenceState && !r.alive);

  return html`
    <span class="ex ex--${raw(meta.tone)}">${meta.label}</span>
    ${cause && r.deathCause ? raw(html`<span class="cause">${causeText(r.deathCause)}</span>`) : ''}
    ${state === 'missing' || state === 'unknown'
      ? raw(html`<span class="sub">unresolved, not unrecorded</span>`)
      : ''}
    ${Number.isFinite(Number(r.identityContinuity)) && Number(r.identityContinuity) < 1
      ? raw(html`<span class="sub">${Math.round(Number(r.identityContinuity) * 100)}% of the original</span>`)
      : ''}`;
}

function rosterRowMarkup(r) {
  const state = r.existenceState || (r.alive ? 'alive' : 'physically_dead');
  const dead = state === 'physically_dead' || (!r.existenceState && !r.alive);
  const stones = Number(r.spiritStones);
  const inj = Number(r.untreatedInjuries) || 0;
  const lifespan = Number(r.lifespanYears);

  return html`
    <tr class="${raw([r.isPlayer ? 'is-player' : '', dead ? 'is-dead' : ''].filter(Boolean).join(' '))}">
      <td class="rname">
        ${r.name || '-'}
        ${r.isPlayer ? raw(html`<span class="you-tag">you</span>`) : ''}
        ${!r.isPlayer && r.kind ? raw(html`<span class="kind-tag kind-${raw(String(r.kind))}">${r.kind}</span>`) : ''}
        ${Array.isArray(r.feuds) && r.feuds.length ? raw(html`<span class="sub">feuds: ${r.feuds.join(', ')}</span>`) : ''}
      </td>
      <td>${r.rankName || '-'}<span class="sub">ordinal ${fmtInt(r.realmOrdinal)}</span></td>
      <td class="col-realm">${r.realmName || '-'}</td>
      <td class="col-loc">${r.location || '-'}</td>
      <td class="wrap">${r.sectName || 'Unaffiliated'}${r.sectRank ? raw(html`<span class="sub">${r.sectRank}</span>`) : ''}</td>
      <td class="col-root">${r.spiritRootName || titleise(r.spiritRoot) || '-'}</td>
      <td class="num">${fmtInt(r.age)}${Number.isFinite(lifespan) ? ` / ${fmtInt(lifespan)}` : ''}</td>
      <td class="num col-stones">${Number.isFinite(stones) ? fmtInt(stones) : '-'}</td>
      <td class="num ${raw(inj >= 3 ? 'hurt' : '')}">${inj ? raw(html`<span class="${raw(inj >= 3 ? 'hurt' : '')}">${fmtInt(inj)}</span>`) : '0'}</td>
      <td class="wrap">${raw(rosterExistenceCell(r))}</td>
    </tr>`;
}

function renderRosterPanel() {
  const all = ROSTER.rows || [];
  const player = all.find((r) => r.isPlayer) || null;
  const visible = rosterFiltered();

  const sects = Array.from(new Set(all.filter((r) => r.sectName).map((r) => r.sectName))).sort();
  const realms = Array.from(new Map(all.map((r) => [r.realmName, Number(r.realmOrdinal) || 0])).entries())
    .sort((a, b) => a[1] - b[1]).map(([n]) => n).filter(Boolean);

  const head = ROSTER_COLUMNS.map((c) => {
    const active = ROSTER.sort === c.key;
    const sortAttr = active ? (ROSTER.dir === 'asc' ? 'ascending' : 'descending') : '';
    return html`<th class="${raw(c.cls.replace('rname', ''))}" data-sort="${c.key}"
        ${raw(sortAttr ? `aria-sort="${sortAttr}"` : '')} scope="col" tabindex="0" role="columnheader">
        ${c.label}<span class="sortmark">${active ? (ROSTER.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </th>`;
  }).join('');

  $('#overlay-body').innerHTML = html`
    <div class="roster">
      <div class="roster__note">
        <span class="roster__readonly">read-only</span>
        <span>Every cultivator the engine currently holds, the player included. Nothing here can be edited from this panel.</span>
      </div>

      <div class="roster__controls">
        <input class="input" id="r-q" type="search" placeholder="Search name…" value="${ROSTER.q}" aria-label="Search by name" />
        <select id="r-sect" aria-label="Filter by sect">
          <option value="">All sects</option>
          <option value="__none__" ${raw(ROSTER.sect === '__none__' ? 'selected' : '')}>Unaffiliated</option>
          ${raw(sects.map((s) => html`<option value="${s}" ${raw(ROSTER.sect === s ? 'selected' : '')}>${s}</option>`).join(''))}
        </select>
        <select id="r-realm" aria-label="Filter by realm">
          <option value="">All realms</option>
          ${raw(realms.map((s) => html`<option value="${s}" ${raw(ROSTER.realm === s ? 'selected' : '')}>${s}</option>`).join(''))}
        </select>
        <select id="r-status" aria-label="Filter by alive or dead">
          <option value="">Any existence</option>
          <option value="alive" ${raw(ROSTER.status === 'alive' ? 'selected' : '')}>Alive only</option>
          <option value="dead" ${raw(ROSTER.status === 'dead' ? 'selected' : '')}>Physically dead</option>
          <option value="profound" ${raw(ROSTER.status === 'profound' ? 'selected' : '')}>Neither, exactly</option>
          <option value="unresolved" ${raw(ROSTER.status === 'unresolved' ? 'selected' : '')}>Missing or unknown</option>
        </select>
      </div>

      <div class="roster__count" id="r-count">
        ${fmtInt(visible.length)} of ${fmtInt(Math.max(0, all.length - (player ? 1 : 0)))} cultivators shown${player ? ', plus you (always pinned)' : ''}
        <span class="roster__hint">scroll the table sideways for the remaining columns</span>
      </div>

      <div class="roster__scroll">
        <table class="rtable">
          <thead><tr>${raw(head)}</tr></thead>
          <tbody id="r-body">
            ${raw(player ? rosterRowMarkup(player) : '')}
            ${raw(visible.map(rosterRowMarkup).join(''))}
            ${!visible.length ? raw(html`<tr><td colspan="10" class="wrap"><span class="empty">No cultivator matches those filters.</span></td></tr>`) : ''}
          </tbody>
        </table>
      </div>
    </div>`;

  wireRoster();
}

function wireRoster() {
  const q = $('#r-q');
  if (q) {
    q.addEventListener('input', () => {
      ROSTER.q = q.value;
      const pos = q.selectionStart;
      renderRosterPanel();
      const nq = $('#r-q');
      if (nq) { nq.focus(); try { nq.setSelectionRange(pos, pos); } catch { /* search inputs may refuse */ } }
    });
  }
  const bind = (sel, key) => {
    const el = $(sel);
    if (el) el.addEventListener('change', () => { ROSTER[key] = el.value; renderRosterPanel(); });
  };
  bind('#r-sect', 'sect');
  bind('#r-realm', 'realm');
  bind('#r-status', 'status');

  $$('.rtable thead th[data-sort]').forEach((th) => {
    const activate = () => {
      const key = th.dataset.sort;
      if (ROSTER.sort === key) ROSTER.dir = ROSTER.dir === 'asc' ? 'desc' : 'asc';
      else { ROSTER.sort = key; ROSTER.dir = (ROSTER_COLUMNS.find((c) => c.key === key) || {}).type === 'text' ? 'asc' : 'desc'; }
      renderRosterPanel();
    };
    th.addEventListener('click', activate);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });
}

/* ────────────────────────── admin world map (read-only) ────────────────────────── */

/**
 * The lower world, as a gazetteer you walk down through.
 *
 * ── WHY THIS IS TEXT AND NOT A PICTURE ───────────────────────────────────
 * It was a drawn plate for one pass - a relaxation of the link graph with the
 * sites placed by travel time. It read well and it was the wrong medium. This
 * is a text game, the register already has a house pattern for a long
 * structured list somebody expands (`ncard` in `src/web/register.ts`), and a
 * nested disclosure survives 859 locations where a diagram does not. So the
 * markup here is the register's, in the app's tokens, and nothing on this
 * panel is drawn that could be written.
 *
 * What did NOT get dropped with the picture is the data the picture carried.
 * Ground, the four thresholds against an ordinal, seal and cycle, control, and
 * the fog of `discovered` are facts a reader needs; they are labelled text and
 * small inline markers now instead of colour and position, and the threshold
 * sweep became a filter, which does more work than the colour ever did.
 *
 * ── ORDER IS DISTANCE, AND DISTANCE IS THE LINK GRAPH ────────────────────
 * Every list is ordered by how far away things are from wherever the reader is
 * standing, nearest first, and banded rather than printed as a column of
 * integers. The distance is the shortest path over `links` measured in
 * `travelDays` - not a straight line, because there are no coordinates and
 * there should not be. Two places either side of a mountain are far apart, and
 * the link graph is exactly where that is already written down.
 *
 * `unreachable` is a real answer and gets its own band. A place with no
 * recorded route is not sorted quietly to the bottom; it is named as having no
 * route.
 *
 * ── DESCENT IS ONE CLICK ─────────────────────────────────────────────────
 * A row opens onto its own record. A row that holds something also carries one
 * control that re-roots the whole panel inside it, and the breadcrumb walks
 * back out. Depth 4 is easy to get lost in, so where you are is stated at the
 * top at all times and every step of it is clickable.
 *
 * ── THE LID IS NOT ON THIS MAP ───────────────────────────────────────────
 * `layers.ts` is emphatic that the far side of the Lid is a different world
 * rather than a corner of this one. This panel is the lower world; the count
 * of what is above it is stated and nothing above it is listed.
 */

const MAP = {
  data: null,
  byId: new Map(),
  /** id -> [{ to, days, kind, open }]. Built once from the deduplicated edges. */
  adj: new Map(),
  /** Ids from the lower world down to the container being read. [] is the top. */
  path: [],
  /** The place distances are measured from. Always somewhere real. */
  originId: null,
  /** originId -> Map(id -> { days, viaId, kind }). Dijkstra is cheap; repeating it is not. */
  distCache: new Map(),
  openRows: new Set(),
  q: '',
  fog: 'mark',
  ordinal: null,
  /** 'all' | 'operate' | 'survive' - what the reader would be able to do there. */
  reachFilter: 'all',
  /** Days. Infinity is no limit. */
  withinDays: Infinity
};

/** The pseudo-container above every root. The map's own top. */
const MAP_ROOT = { id: '__world__', name: 'The lower world', kind: 'region', childIds: [] };

/** Reading order where distance cannot decide: the ground first, then what is on it. */
const MAP_KIND_ORDER = [
  'region', 'vein', 'wilds', 'settlement', 'sect_seat', 'precinct', 'hall',
  'chamber', 'vault', 'cave', 'portal', 'secret_realm', 'sealed_domain',
  'forbidden_zone', 'ruin', 'grave', 'scar'
];

const MAP_KIND_LABEL = {
  region: 'Region', settlement: 'Settlement', sect_seat: 'Sect seat', wilds: 'Wilds',
  vein: 'Spirit vein', cave: 'Cave', ruin: 'Ruin', grave: 'Grave', scar: 'Scar',
  forbidden_zone: 'Forbidden zone', secret_realm: 'Secret realm',
  sealed_domain: 'Sealed domain', portal: 'Portal', precinct: 'Precinct',
  hall: 'Hall', chamber: 'Chamber', vault: 'Vault'
};

const MAP_LINK_LABEL = {
  road: 'road', path: 'path', tunnel: 'tunnel', gate: 'gate', portal: 'portal', seam: 'seam'
};

const MAP_LINK_NOTE = {
  road: 'A made road. The ordinary way anybody arrives.',
  path: 'A track. Slower, and nobody is maintaining it.',
  tunnel: 'Under the ground, and only useful if you know it is there.',
  gate: 'A door in a wall somebody built. It can be shut.',
  portal: 'Fast, and not instantaneous. Somebody made it and somebody can close it.',
  seam: 'A hole in a ward. It puts you inside the wall without passing the gate, which is why it is worth knowing and worth hiding.'
};

const MAP_BAND_LABEL = {
  thin: 'thin', normal: 'ordinary', dense: 'dense', spirit_tide: 'spirit tide'
};

/**
 * Distance bands.
 *
 * A reader wants "what is near me", not a sorted column of integers, so the
 * rows carry the exact figure and the headings carry the shape.
 */
const MAP_DIST_BANDS = [
  { max: 0, label: 'Here, or through a door' },
  { max: 1, label: 'Within a day' },
  { max: 6, label: 'Two to six days' },
  { max: 30, label: 'A week to a month' },
  { max: 365, label: 'Months away' },
  { max: Infinity, label: 'The better part of a year or more' }
];

const MAP_WITHIN = [
  { days: Infinity, label: 'Any distance' },
  { days: 1, label: 'Within a day' },
  { days: 7, label: 'Within a week' },
  { days: 30, label: 'Within a month' },
  { days: 365, label: 'Within a year' }
];

/**
 * What one ordinal can do at one place.
 *
 * Straight off `LocationThresholds`, whose four numbers fail differently and
 * are documented in engine/world/locations.ts: below entry you are turned away
 * and nothing happens; below survival you get in and die; between survival and
 * operational you are alive and useless. This compares - it does not decide -
 * and the engine's four numbers are printed unmodified beside the verdict.
 */
function mapReach(node, ordinal) {
  if (ordinal == null) return 'unbanded';
  const t = node.thresholds || {};
  if (ordinal >= (t.mastery ?? 0)) return 'master';
  if (ordinal >= (t.operational ?? 0)) return 'operate';
  if (ordinal >= (t.survival ?? 0)) return 'survive';
  if (ordinal >= (t.entry ?? 0)) return 'lethal';
  return 'barred';
}

const MAP_REACH_TEXT = {
  master: ['can hold it', 'At or above the mastery bar: the place can be exploited or held.'],
  operate: ['can work here', 'At or above operational: can fight, cultivate, search.'],
  survive: ['alive, useless', 'Past survival, short of operational. Standing in the vault unable to open anything.'],
  lethal: ['gets in and dies', 'Past entry, short of survival. The door opens and the air does the rest.'],
  barred: ['turned away', 'Below entry. Nothing happens, which is the cheapest of the four failures.'],
  unbanded: ['', '']
};

/**
 * A duration, not a date. `fmtDaysShort` renders an absolute day for the
 * timeline gutter ("day 17"), which is the wrong sentence entirely for a road
 * that takes seventeen days to walk.
 */
function mapDays(days) {
  if (!Number.isFinite(days)) return 'no route';
  const total = Math.max(0, Math.round(Number(days) || 0));
  if (total === 0) return 'no time';
  if (total < DAYS_PER_MONTH) return `${total}d`;
  if (total < DAYS_PER_YEAR) return `${Math.round(total / DAYS_PER_MONTH)}mo`;
  const years = total / DAYS_PER_YEAR;
  return `${years >= 10 ? Math.round(years) : years.toFixed(1)}y`;
}

/** Everything below the Lid. The other layer is a different world, not a corner. */
function mapIsHere(n) {
  return n && n.layer !== 'immortal';
}

/* ── distance, over the link graph ───────────────────────────────────────── */

function mapBuildAdjacency() {
  const adj = new Map();
  const add = (a, b, e) => {
    const list = adj.get(a) || [];
    list.push({ to: b, days: Math.max(0, Number(e.travelDays) || 0), kind: e.kind, open: e.open });
    adj.set(a, list);
  };
  for (const e of MAP.data.edges || []) {
    // A crossing is walkable in both directions: `links` records an end, not a
    // one-way street, and `mutual` says only whether both ends wrote it down.
    add(e.fromId, e.toId, e);
    add(e.toId, e.fromId, e);
  }
  MAP.adj = adj;
}

/**
 * Shortest path in days from one place to every place it can reach.
 *
 * Dijkstra with a linear scan for the minimum. The graph is under a thousand
 * nodes and the panel recomputes it only when the reader moves, so a heap
 * would be machinery for nothing. Shut crossings are still walked, at the cost
 * they carry, and marked - a door that is closed today is a route somebody
 * plans around rather than a route that does not exist.
 */
function mapDistancesFrom(originId) {
  const cached = MAP.distCache.get(originId);
  if (cached) return cached;

  const dist = new Map([[originId, { days: 0, viaId: null, kind: null, shut: false }]]);
  const done = new Set();
  for (;;) {
    let best = null;
    let bestDays = Infinity;
    for (const [id, d] of dist) {
      if (done.has(id) || d.days >= bestDays) continue;
      best = id;
      bestDays = d.days;
    }
    if (best == null) break;
    done.add(best);
    for (const step of MAP.adj.get(best) || []) {
      if (!mapIsHere(MAP.byId.get(step.to))) continue;
      const days = bestDays + step.days;
      const prev = dist.get(step.to);
      if (!prev || days < prev.days) {
        dist.set(step.to, { days, viaId: best, kind: step.kind, shut: !step.open || (dist.get(best)?.shut ?? false) });
      }
    }
  }
  MAP.distCache.set(originId, dist);
  return dist;
}

function mapDistanceTo(id) {
  if (!MAP.originId) return null;
  if (id === MAP.originId) return { days: 0, viaId: null, kind: null, shut: false };
  return mapDistancesFrom(MAP.originId).get(id) || null;
}

function mapBandOf(days) {
  if (!Number.isFinite(days)) return MAP_DIST_BANDS.length;
  return MAP_DIST_BANDS.findIndex((b) => days <= b.max);
}

/**
 * The route, in words.
 *
 * A portal at two days and a road at two days are not the same journey, so the
 * kind of every leg is named. Only the last two legs are spelled out: the
 * whole chain from a region to a sealed chamber four walls in is six lines
 * nobody reads, and the ones that matter are the ones nearest the door.
 */
function mapRouteText(id) {
  const dist = MAP.originId ? mapDistancesFrom(MAP.originId) : null;
  if (!dist) return '';
  const legs = [];
  let cur = id;
  const guard = new Set();
  while (cur && dist.has(cur) && !guard.has(cur)) {
    guard.add(cur);
    const step = dist.get(cur);
    if (!step || step.viaId == null) break;
    legs.unshift({ kind: step.kind, from: step.viaId, to: cur });
    cur = step.viaId;
  }
  if (!legs.length) return '';
  const shown = legs.slice(-2);
  return shown.map((l) => `${MAP_LINK_LABEL[l.kind] || l.kind} from ${MAP.byId.get(l.from)?.name || 'somewhere'}`).join(', then ')
    + (legs.length > shown.length ? `, ${legs.length - shown.length} leg${legs.length - shown.length === 1 ? '' : 's'} before that` : '');
}

/* ── where the reader is ─────────────────────────────────────────────────── */

function mapContainer() {
  const id = MAP.path[MAP.path.length - 1];
  return id ? MAP.byId.get(id) || MAP_ROOT : MAP_ROOT;
}

function mapRootChildren() {
  return (MAP.data.locations || []).filter((l) => !l.parentId && mapIsHere(l));
}

function mapFrameNodes() {
  const container = mapContainer();
  const list = container === MAP_ROOT
    ? mapRootChildren()
    : (container.childIds || []).map((id) => MAP.byId.get(id)).filter(Boolean);
  return list.filter((n) => mapIsHere(n) && (MAP.fog !== 'hide' || n.discovered));
}

function mapNodeOrder(a, b) {
  const ka = MAP_KIND_ORDER.indexOf(a.kind);
  const kb = MAP_KIND_ORDER.indexOf(b.kind);
  return (ka < 0 ? 99 : ka) - (kb < 0 ? 99 : kb)
    || b.qiDensity - a.qiDensity
    || String(a.name).localeCompare(String(b.name));
}

/**
 * Where distances are measured from, and it is never a guess dressed as a fact.
 *
 * Inside a container it is the container: walking into a compound, "how far"
 * means how far from its gate, which is also what puts the precincts in the
 * order somebody would actually pass through them. At the top of the world
 * there is no such place, so it is the best-connected root - stated by name in
 * the heading, because an unlabelled origin makes every distance on the page
 * unreadable.
 *
 * `cultivator.location` is deliberately free text in `schema/cultivation.ts` -
 * the engine does not own a map - so it is used only on an exact name match
 * and never fuzzily. Guessing which place `Sixmile` means would be the client
 * inventing geography.
 */
function mapChooseOrigin() {
  const container = mapContainer();
  if (container !== MAP_ROOT) return container.id;

  // The player's own place, but only when something is recorded as leading
  // out of it. Measured against a live world, `Sixmile` matched a real
  // settlement that holds no links at all, and every distance on the page came
  // back "no route" - a true statement about Sixmile presented as a fact about
  // the world. An origin nothing connects to is not an origin.
  const here = S.cultivator && S.cultivator.location;
  if (here) {
    const exact = (MAP.data.locations || []).find((l) => mapIsHere(l) && l.name === here);
    if (exact && (MAP.adj.get(exact.id) || []).length) return exact.id;
  }
  const roots = mapRootChildren();
  let best = null;
  let bestDeg = -1;
  for (const r of roots) {
    const deg = (MAP.adj.get(r.id) || []).length;
    if (deg > bestDeg) { best = r; bestDeg = deg; }
  }
  return best ? best.id : (roots[0] ? roots[0].id : null);
}

/* ── one row ─────────────────────────────────────────────────────────────── */

/** Ground, as four cells of text. The only picture on the page, and it is type. */
function mapDensityMark(n) {
  const filled = Math.max(1, Math.min(4, Math.ceil((n.qiDensity / 100) * 4)));
  return html`<span class="dens" data-qi-band="${n.qiBand}" title="Ground ${fmtInt(n.qiDensity)} of 100 - ${MAP_BAND_LABEL[n.qiBand] || n.qiBand}"
    aria-label="ground ${fmtInt(n.qiDensity)} of 100">${raw('▮'.repeat(filled) + '▯'.repeat(4 - filled))}<b>${fmtInt(n.qiDensity)}</b></span>`;
}

function mapStateChips(n) {
  const out = [];
  if (n.sealed) out.push(html`<span class="chip chip--sealed">${n.keyId ? 'sealed, keyed' : 'sealed'}</span>`);
  else if (!n.open) out.push(html`<span class="chip chip--shut">shut ${mapDays(n.opensInDays)}</span>`);
  else if (n.cycle) out.push(html`<span class="chip chip--window">open ${mapDays(n.closesInDays)}</span>`);
  if (!n.discovered) out.push(html`<span class="chip chip--fog">undiscovered</span>`);
  if (n.contested) out.push(html`<span class="chip chip--claim">claim disputed</span>`);
  return out.join('');
}

/** The first sentence of the description, for the closed row. */
function mapLede(n) {
  const d = String(n.description || '').trim();
  if (!d) return '';
  const cut = d.search(/[.!?](\s|$)/);
  return cut > 0 && cut < 160 ? d.slice(0, cut + 1) : d;
}

/**
 * The shared face of a row, open or closed.
 *
 * Name, how far away it is, and the three facts that decide whether anybody
 * would go: what the ground is worth, whether it would kill them, and whether
 * they can get in at all. Then the first sentence of the description, so a
 * closed list still reads as prose rather than as a schema.
 */
function mapSummaryMarkup(n, reach, d, inside, verb) {
  const lede = mapLede(n);
  return html`
    <span class="nhead">
      <span class="nname">${n.name}</span>
      <span class="nord" title="${raw(d && Number.isFinite(d.days) ? esc(mapRouteText(n.id) || 'you are here') : 'No crossing links this to where you are standing.')}">${d ? mapDays(d.days) : 'no route'}</span>
    </span>
    <span class="nkind">
      <span>${MAP_KIND_LABEL[n.kind] || n.kind}</span>
      ${raw(mapDensityMark(n))}
      ${MAP.ordinal == null ? '' : raw(html`<span class="chip chip--reach reach--${raw(reach)}">${MAP_REACH_TEXT[reach][0]}</span>`)}
      ${raw(mapStateChips(n))}
      ${inside ? raw(html`<span class="chip chip--inside">${fmtInt(inside)} inside</span>`) : ''}
      <span class="ngo">${verb}</span>
    </span>
    ${lede ? raw(html`<span class="nwant">${lede}</span>`) : ''}`;
}

/**
 * One click, and it does the thing the reader meant.
 *
 * A place that holds something is walked INTO on a single click - the panel
 * re-roots there and that place's own record leads the level you land on, so
 * descending and reading the description are one interaction rather than two.
 * A place that holds nothing has nowhere to go, so it opens where it stands.
 * The distinction is visible before the click: only one of them carries an
 * `N inside` count.
 */
function mapRowMarkup(n) {
  const reach = mapReach(n, MAP.ordinal);
  const d = mapDistanceTo(n.id);
  const inside = (n.childIds || []).length;
  const cls = `ncard reach--${reach}${n.discovered ? '' : ' is-fogged'}`;

  if (inside) {
    return html`
      <button class="${raw(cls)} ncard--go" type="button" data-descend="${n.id}"
              aria-label="${raw(esc(`Go inside ${n.name}, ${inside} places`))}">
        ${raw(mapSummaryMarkup(n, reach, d, inside, 'go in'))}
      </button>`;
  }

  return html`
    <details class="${raw(cls)}" data-row="${n.id}" ${raw(MAP.openRows.has(n.id) ? 'open' : '')}>
      <summary>${raw(mapSummaryMarkup(n, reach, d, 0, 'open'))}</summary>
      <div class="nbody">${raw(MAP.openRows.has(n.id) ? mapBodyMarkup(n) : '')}</div>
    </details>`;
}

/* ── one record ──────────────────────────────────────────────────────────── */

function mapThresholdRow(label, value, note) {
  const ord = MAP.ordinal;
  const max = mapMaxOrdinal();
  const pass = ord != null && ord >= value;
  return html`
    <div class="thr ${raw(ord == null ? '' : pass ? 'is-pass' : 'is-fail')}">
      <span class="thr__label">${label}</span>
      <span class="thr__track"><i style="width:${raw(String(Math.max(1, Math.min(100, (value / max) * 100))))}%"></i>
        ${ord == null ? '' : raw(html`<b class="thr__you" style="left:${raw(String(Math.max(0, Math.min(100, (ord / max) * 100))))}%"></b>`)}
      </span>
      <span class="thr__num">${fmtInt(value)}</span>
      <span class="thr__note">${note}</span>
    </div>`;
}

function mapHistoryMarkup(n) {
  if (!n.changes.length && !n.origin) return '';
  return html`
    <div class="section__label">What happened here${n.changeCount > n.changes.length ? ` · last ${fmtInt(n.changes.length)} of ${fmtInt(n.changeCount)}` : ''}</div>
    ${n.origin ? raw(html`<p class="mapinsp__origin">It began as <b>${n.origin.name}</b>${n.origin.kind !== n.kind ? `, ${(MAP_KIND_LABEL[n.origin.kind] || n.origin.kind).toLowerCase()}` : ''}${
      n.origin.changed.includes('qiDensity') ? `, ground at ${fmtInt(n.origin.qiDensity)}` : ''}${
      n.origin.fromDay != null ? `, from day ${fmtInt(n.origin.fromDay)}` : ''}.</p>`) : ''}
    ${n.changes.length ? raw(html`<ol class="hist">${raw(n.changes.map((c) => html`
      <li class="hist__row hist__row--${raw(c.fidelity)}">
        <span class="hist__day">day ${fmtInt(c.onDay)}</span>
        <span class="hist__what">${c.summary}
          ${c.causeKnown ? '' : raw(html`<span class="hist__why">nobody can say why${c.attributedCauses.length ? `; they blame ${c.attributedCauses.join(', ')}` : ''}</span>`)}
          ${c.fidelity === 'rumour' || c.fidelity === 'lost' ? raw(html`<span class="hist__fid">the record is ${c.fidelity}</span>`) : ''}
        </span>
      </li>`).join(''))}</ol>`) : ''}`;
}

/**
 * The record, in two halves.
 *
 * The first is what somebody reads: the authored prose, how far away it is,
 * and one line on whether it would kill them. The second is everything else,
 * and it is only ever the whole of a row's body - when the same record heads a
 * level the reader has already walked into, the second half goes behind a
 * disclosure, because the reason they are on that screen is the list under it.
 */
function mapBodyLede(n, { asHere = false } = {}) {
  const reach = mapReach(n, MAP.ordinal);
  const inside = (n.childIds || []).length;
  const d = mapDistanceTo(n.id);
  const route = mapRouteText(n.id);

  return html`
    ${n.description
      ? raw(html`<p class="mapdesc">${n.description}</p>`)
      : raw(html`<p class="mapdesc mapdesc--none">Nothing is written about this place. Everything known about it is below.</p>`)}

    ${inside && !asHere ? raw(html`<button class="btn btn--primary btn--sm mapgo" type="button" data-descend="${n.id}">
      Go inside · ${fmtInt(inside)} place${inside === 1 ? '' : 's'}</button>`) : ''}

    ${d && Number.isFinite(d.days) && d.days > 0
      ? raw(html`<p class="maproute"><b>${mapDays(d.days)}</b> from ${MAP.byId.get(MAP.originId)?.name || 'here'}${route ? `: ${route}` : ''}${d.shut ? '. Part of that route is shut.' : '.'}</p>`)
      : (!d && !asHere ? raw(html`<p class="maproute maproute--none">No recorded crossing joins this to ${MAP.byId.get(MAP.originId)?.name || 'where you are'}. There may be no way there.</p>`) : '')}

    ${MAP.ordinal == null ? '' : raw(html`<p class="mapverdict reach--${raw(reach)}">${MAP_REACH_TEXT[reach][0]}<span>${MAP_REACH_TEXT[reach][1]}</span></p>`)}`;
}

function mapBodyMarkup(n, opts = {}) {
  if (opts.asHere) {
    return html`${raw(mapBodyLede(n, opts))}
      <details class="mapmore mapmore--here"><summary>The record for ${n.name}</summary>
        ${raw(mapBodyRest(n))}
      </details>`;
  }
  return html`${raw(mapBodyLede(n))}${raw(mapBodyRest(n))}`;
}

function mapBodyRest(n) {
  const reach = mapReach(n, MAP.ordinal);
  const edges = (MAP.data.edges || [])
    .filter((e) => e.fromId === n.id || e.toId === n.id)
    .map((e) => ({ e, o: MAP.byId.get(e.fromId === n.id ? e.toId : e.fromId) }))
    .filter((x) => mapIsHere(x.o))
    .sort((a, b) => a.e.travelDays - b.e.travelDays);

  return html`

    ${n.sealed || n.cycle ? raw(html`
      <div class="section__label">Getting in</div>
      <p class="mapdoor">
        ${n.sealed
          ? raw(html`Sealed${n.sealedOnDay != null ? ` on day ${fmtInt(n.sealedOnDay)}` : ''}.
              ${n.keyId ? raw(html`It opens to <code>${n.keyId}</code> and to nothing else.`) : 'No cycle opens it.'}`)
          : raw(html`Open ${fmtInt(n.cycle.openDays)} day${n.cycle.openDays === 1 ? '' : 's'} in every ${fmtInt(n.cycle.periodDays)}.
              ${n.open
                ? raw(html`<b>Standing open now</b>; it shuts in ${mapDays(n.closesInDays)}.`)
                : raw(html`<b>Shut.</b> It opens in ${mapDays(n.opensInDays)}.`)}`)}
      </p>`) : ''}

    <div class="section__label">What would kill you${MAP.ordinal == null ? '' : ` · you are ordinal ${fmtInt(MAP.ordinal)}`}</div>
    <div class="thrs">
      ${raw(mapThresholdRow('entry', n.thresholds.entry, 'below this, turned away'))}
      ${raw(mapThresholdRow('survival', n.thresholds.survival, 'below this, in and dead'))}
      ${raw(mapThresholdRow('operational', n.thresholds.operational, 'below this, alive and useless'))}
      ${raw(mapThresholdRow('mastery', n.thresholds.mastery, 'above this, yours to hold'))}
    </div>
    ${n.hazards.length ? raw(html`<div class="chips">${raw(n.hazards.map((h) => html`<span class="chip chip--hazard" title="${h}">${String(h).replace(/_/g, ' ')}</span>`).join(''))}</div>`) : ''}
    ${n.affinities.length ? raw(html`<ul class="affs">${raw(n.affinities.map((a) => html`
      <li class="aff ${raw(a.multiplier >= 1 ? 'is-boon' : 'is-bane')}">
        <b>${titleise(a.tag)}</b> ${a.multiplier >= 1 ? 'favoured' : 'suppressed'} ×${fmtNum(a.multiplier, 2)}${a.thresholdOffset ? `, ${fmtSigned(-a.thresholdOffset)} to the bar` : ''}
        ${a.note ? raw(html`<span class="aff__note">${a.note}</span>`) : ''}
      </li>`).join(''))}</ul>`) : ''}

    ${n.controllingFactionName || n.capacity != null || (n.heldBy && n.heldBy !== 'nobody in particular') ? raw(html`
      <div class="section__label">Whose it is</div>
      <dl class="mapfacts">
        ${n.controllingFactionName ? raw(html`<div><dt>On paper</dt><dd>${n.controllingFactionName}</dd></div>`) : ''}
        ${n.heldBy ? raw(html`<div><dt>On the ground</dt><dd>${n.heldBy}</dd></div>`) : ''}
        ${n.capacity != null ? raw(html`<div><dt>Cut for</dt><dd>${fmtInt(n.capacity)}<span class="sub">${fmtInt(n.occupancy)} here now</span></dd></div>`) : ''}
      </dl>
      ${n.contested ? raw(html`<p class="mapclaim">A claim its own record does not confirm on the ground.</p>`) : ''}`) : ''}

    ${edges.length ? raw(html`
      <div class="section__label">From here you can reach · ${fmtInt(edges.length)}</div>
      <ul class="xings">${raw(edges.map(({ e, o }) => html`
        <li class="xrow ${raw(e.open ? '' : 'is-shut')}">
          <span class="xrow__kind xrow__kind--${raw(e.kind)}" title="${MAP_LINK_NOTE[e.kind] || ''}">${MAP_LINK_LABEL[e.kind] || e.kind}</span>
          <button class="linkish xrow__to" type="button" data-goto="${o.id}">${o.name}</button>
          <span class="xrow__days">${mapDays(e.travelDays)}</span>
          ${e.kind === 'seam' ? raw(html`<span class="chip chip--seam" title="${MAP_LINK_NOTE.seam}">past the gate</span>`) : ''}
          ${e.open ? '' : raw(html`<span class="chip chip--shut">shut</span>`)}
          ${e.requiresKeyId ? raw(html`<span class="chip chip--key" title="Needs ${esc(e.requiresKeyId)}">keyed</span>`) : ''}
          ${e.mutual ? '' : raw(html`<span class="chip chip--oneway" title="Only one end records this crossing.">one-sided</span>`)}
        </li>`).join(''))}</ul>`) : ''}

    ${raw(mapHistoryMarkup(n))}

    ${n.specialRules.length || n.styleTags.length || n.resources.length || n.tags.length ? raw(html`
      <details class="mapmore">
        <summary>The rest of the record</summary>
        ${n.specialRules.length ? raw(html`<div class="section__label">Local law</div>
          <ul class="maprules">${raw(n.specialRules.map((r) => html`<li>${r}</li>`).join(''))}</ul>`) : ''}
        ${n.styleTags.length ? raw(html`<div class="section__label">Built like</div>
          <div class="chips">${raw(n.styleTags.map((t) => html`<span class="chip chip--style">${titleise(t)}</span>`).join(''))}</div>`) : ''}
        ${n.resources.length ? raw(html`<div class="section__label">Gatherable</div>
          <div class="chips">${raw(n.resources.map((r) => html`<span class="chip">${r}</span>`).join(''))}</div>`) : ''}
        ${n.tags.length ? raw(html`<div class="section__label">Tags</div>
          <div class="chips">${raw(n.tags.map((t) => html`<span class="chip chip--tag">${t}</span>`).join(''))}</div>`) : ''}
        <dl class="mapfacts">
          <div><dt>Usable qi</dt><dd>${fmtPct(n.spiritualDensity)}<span class="sub">what somebody standing here can draw, against the ${fmtInt(n.qiDensity)} the ground holds</span></dd></div>
          <div><dt>Danger</dt><dd>${fmtPct(n.danger)}</dd></div>
          <div><dt>Climate</dt><dd>${n.climate || '-'}</dd></div>
          <div><dt>Ambient</dt><dd>${titleise(n.ambient)}</dd></div>
          ${n.discoveredOnDay != null ? raw(html`<div><dt>Found</dt><dd>day ${fmtInt(n.discoveredOnDay)}</dd></div>`) : ''}
        </dl>
      </details>`) : ''}`;
}

/* ── the panel ───────────────────────────────────────────────────────────── */

async function openMap() {
  openOverlay({
    title: 'The lower world',
    body: html`<p class="muted">Reading the world…</p>`,
    wide: 'x',
    foot: html`<button class="btn" type="button" data-overlay-close data-autofocus>Close</button>`,
    onClose: () => focusCommand()
  });

  const res = await getJSON('/api/admin/places');
  if ($('#overlay').hidden) return;

  if (!res.ok) {
    $('#overlay-body').innerHTML = res.status === 403
      ? html`<p class="form-error">Admin mode is not enabled on this server, so the map is not available. (${res.error})</p>`
      : html`<p class="form-error">${res.error}</p>`;
    return;
  }

  MAP.data = res.data;
  MAP.byId = new Map((res.data.locations || []).map((l) => [l.id, l]));
  MAP.distCache = new Map();
  MAP.openRows = new Set();
  MAP.path = [];
  MAP.q = '';
  MAP.reachFilter = 'all';
  MAP.withinDays = Infinity;
  mapBuildAdjacency();
  MAP.originId = mapChooseOrigin();
  MAP.ordinal = S.cultivator && Number.isFinite(Number(S.cultivator.realmOrdinal))
    ? Number(S.cultivator.realmOrdinal)
    : null;
  renderMapPanel();
}

function mapMaxOrdinal() {
  return Array.isArray(S.ladder) && S.ladder.length ? S.ladder.length - 1 : 46;
}

function mapDescend(id) {
  const n = MAP.byId.get(id);
  if (!n || !(n.childIds || []).length) return;
  MAP.path = [...MAP.path, id];
  MAP.openRows = new Set();
  MAP.q = '';
  MAP.originId = mapChooseOrigin();
  renderMapPanel();
}

function mapAscendTo(depth) {
  MAP.path = MAP.path.slice(0, depth);
  MAP.openRows = new Set();
  MAP.q = '';
  MAP.originId = mapChooseOrigin();
  renderMapPanel();
}

/**
 * Walk to wherever a place is and open it.
 *
 * A place with something inside it is walked INTO, because that is what the
 * reader meant by clicking a compound; a leaf is opened where it stands, in
 * its container, with the row expanded.
 */
function mapGoTo(id) {
  const n = MAP.byId.get(id);
  if (!n) return;
  if ((n.childIds || []).length) {
    const chain = [];
    let p = n.parentId;
    const guard = new Set();
    while (p && MAP.byId.has(p) && !guard.has(p)) { guard.add(p); chain.unshift(p); p = MAP.byId.get(p).parentId; }
    MAP.path = [...chain, id];
  } else {
    const chain = [];
    let p = n.parentId;
    const guard = new Set();
    while (p && MAP.byId.has(p) && !guard.has(p)) { guard.add(p); chain.unshift(p); p = MAP.byId.get(p).parentId; }
    MAP.path = chain;
    MAP.openRows = new Set([id]);
  }
  MAP.q = '';
  MAP.originId = mapChooseOrigin();
  renderMapPanel();
  requestAnimationFrame(() => {
    const row = $(`[data-row="${CSS.escape(id)}"]`);
    if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

function mapCrumbMarkup() {
  const bits = [html`<button class="crumb ${raw(MAP.path.length ? '' : 'is-here')}" type="button" data-ascend="0">${MAP_ROOT.name}</button>`];
  MAP.path.forEach((id, i) => {
    const n = MAP.byId.get(id);
    if (!n) return;
    bits.push(html`<span class="crumb__sep" aria-hidden="true">›</span>`);
    bits.push(html`<button class="crumb ${raw(i === MAP.path.length - 1 ? 'is-here' : '')}" type="button" data-ascend="${raw(String(i + 1))}">${n.name}</button>`);
  });
  return html`<nav class="crumbs" aria-label="Where you are in the world">${raw(bits.join(''))}</nav>`;
}

/** Rows that survive the filters, and why the others did not. */
function mapVisibleRows() {
  const all = mapFrameNodes();
  const q = MAP.q.trim().toLowerCase();
  const rows = [];
  let hiddenReach = 0;
  let hiddenFar = 0;

  for (const n of all) {
    if (q && !(String(n.name).toLowerCase().includes(q)
      || String(n.kind).toLowerCase().includes(q)
      || (n.tags || []).some((t) => String(t).toLowerCase().includes(q))
      || (n.hazards || []).some((t) => String(t).toLowerCase().includes(q))
      || String(n.controllingFactionName || '').toLowerCase().includes(q))) continue;

    if (MAP.ordinal != null && MAP.reachFilter !== 'all') {
      const r = mapReach(n, MAP.ordinal);
      const ok = MAP.reachFilter === 'operate'
        ? (r === 'operate' || r === 'master')
        : (r === 'operate' || r === 'master' || r === 'survive');
      if (!ok) { hiddenReach += 1; continue; }
    }

    const d = mapDistanceTo(n.id);
    if (Number.isFinite(MAP.withinDays) && (!d || d.days > MAP.withinDays)) { hiddenFar += 1; continue; }

    rows.push({ n, d });
  }

  rows.sort((a, b) => {
    const da = a.d ? a.d.days : Infinity;
    const db = b.d ? b.d.days : Infinity;
    return da - db || mapNodeOrder(a.n, b.n);
  });
  return { rows, hiddenReach, hiddenFar, total: all.length };
}

function mapListMarkup() {
  const { rows, hiddenReach, hiddenFar, total } = mapVisibleRows();
  if (!rows.length) {
    return html`<p class="empty">${total
      ? 'Every place here is filtered out. Widen the distance, or clear the threshold filter.'
      : `Nothing is recorded inside ${mapContainer().name}.`}</p>`;
  }

  const origin = MAP.byId.get(MAP.originId);
  let out = '';
  let band = -1;
  for (const { n, d } of rows) {
    const b = mapBandOf(d ? d.days : Infinity);
    if (b !== band) {
      band = b;
      const label = MAP_DIST_BANDS[b] ? MAP_DIST_BANDS[b].label : 'No route recorded';
      out += html`<div class="bandhead"><span>${label}</span>
        <span class="bandhead__from">${b < MAP_DIST_BANDS.length && origin ? `from ${origin.name}` : 'nothing links these to where you are'}</span></div>`;
    }
    out += mapRowMarkup(n);
  }

  if (hiddenReach || hiddenFar) {
    out += html`<p class="maphidden">${
      [hiddenReach ? `${fmtInt(hiddenReach)} hidden by the threshold filter` : '',
        hiddenFar ? `${fmtInt(hiddenFar)} further away than the distance filter allows` : ''].filter(Boolean).join(' · ')
    }.</p>`;
  }
  return out;
}

function renderMapPanel() {
  const d = MAP.data;
  if (!d) return;

  if (!d.world) {
    $('#overlay-body').innerHTML = html`
      <div class="mapv">
        <p class="mapv__nothing">No world has been instantiated. The world is rebuilt per run from its seed, so
        there is nothing to draw until a run exists. Begin one and reopen this panel.</p>
      </div>`;
    return;
  }

  const container = mapContainer();
  const max = mapMaxOrdinal();
  const below = (d.locations || []).filter(mapIsHere).length;
  const above = (d.locations || []).length - below;
  const origin = MAP.byId.get(MAP.originId);

  $('#overlay-title').textContent = container === MAP_ROOT ? 'The lower world' : container.name;

  $('#overlay-body').innerHTML = html`
    <div class="mapv">
      ${raw(mapCrumbMarkup())}

      ${container === MAP_ROOT
        ? raw(html`<p class="mapv__lede">Everything below the Lid: ${fmtInt(below)} places, on day ${fmtInt(d.world.currentDay)}.
            What is on the far side of the Lid is a different world rather than a corner of this one, and this map stops
            here${above ? ` - ${fmtInt(above)} place${above === 1 ? '' : 's'} above it are not listed` : ''}.</p>`)
        : raw(html`<div class="mapv__here">${raw(mapBodyMarkup(container, { asHere: true }))}</div>`)}

      <div class="mapv__controls">
        <input class="input" id="m-q" type="search" placeholder="Search this level…" value="${MAP.q}" aria-label="Search this level" />
        <select id="m-within" aria-label="Only places within this many days">
          ${raw(MAP_WITHIN.map((w) => html`<option value="${raw(String(w.days))}" ${raw(MAP.withinDays === w.days ? 'selected' : '')}>${w.label}</option>`).join(''))}
        </select>
        <select id="m-reach" aria-label="Filter by what you could do there" ${raw(MAP.ordinal == null ? 'disabled' : '')}>
          <option value="all" ${raw(MAP.reachFilter === 'all' ? 'selected' : '')}>Anywhere, survivable or not</option>
          <option value="survive" ${raw(MAP.reachFilter === 'survive' ? 'selected' : '')}>Only what would not kill me</option>
          <option value="operate" ${raw(MAP.reachFilter === 'operate' ? 'selected' : '')}>Only where I could work</option>
        </select>
        <select id="m-fog" aria-label="How undiscovered places are shown">
          <option value="mark" ${raw(MAP.fog === 'mark' ? 'selected' : '')}>Admin: show the fog</option>
          <option value="hide" ${raw(MAP.fog === 'hide' ? 'selected' : '')}>As the player sees it</option>
        </select>
        <div class="mapv__ord">
          <label for="m-ord">as ordinal</label>
          <input id="m-ord" type="range" min="0" max="${raw(String(max))}" step="1"
                 value="${raw(String(MAP.ordinal == null ? 0 : MAP.ordinal))}"
                 ${raw(MAP.ordinal == null ? 'disabled' : '')} aria-label="Judge every place against this ordinal" />
          <output id="m-ord-out">${MAP.ordinal == null ? 'off' : fmtInt(MAP.ordinal)}</output>
          <span class="mapv__ordname">${MAP.ordinal == null ? 'unbanded' : (ladderName(MAP.ordinal) || '')}</span>
          <button class="btn btn--ghost btn--sm" type="button" id="m-ord-toggle">${MAP.ordinal == null ? 'band' : 'clear'}</button>
        </div>
      </div>

      <div class="maplist" id="map-list">${raw(mapListMarkup())}</div>

      <p class="mapv__foot">Ordered by the shortest recorded route${origin ? ` from ${esc(origin.name)}` : ''}, in days over
        <code>links</code>. There are no coordinates in this world and none are invented here${
        d.danglingLinks || d.orphanedParents
          ? ` · ${fmtInt(d.danglingLinks)} link${d.danglingLinks === 1 ? '' : 's'} and ${fmtInt(d.orphanedParents)} parent reference${d.orphanedParents === 1 ? '' : 's'} name a place this world does not hold, counted and not followed`
          : ''}.</p>
    </div>`;

  wireMap();
}

function wireMap() {
  const q = $('#m-q');
  if (q) {
    q.addEventListener('input', () => {
      MAP.q = q.value;
      const list = $('#map-list');
      if (list) list.innerHTML = mapListMarkup();
    });
  }

  const relist = (el, apply) => {
    if (!el) return;
    el.addEventListener('change', () => { apply(el.value); const list = $('#map-list'); if (list) list.innerHTML = mapListMarkup(); });
  };
  relist($('#m-within'), (v) => { MAP.withinDays = Number(v); });
  relist($('#m-reach'), (v) => { MAP.reachFilter = v; });

  const fog = $('#m-fog');
  if (fog) fog.addEventListener('change', () => { MAP.fog = fog.value; renderMapPanel(); });

  const ord = $('#m-ord');
  const out = $('#m-ord-out');
  if (ord) {
    ord.addEventListener('input', () => {
      MAP.ordinal = Number(ord.value);
      if (out) out.textContent = fmtInt(MAP.ordinal);
      const nm = $('.mapv__ordname');
      if (nm) nm.textContent = ladderName(MAP.ordinal) || '';
      const list = $('#map-list');
      if (list) list.innerHTML = mapListMarkup();
    });
  }
  const toggle = $('#m-ord-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      MAP.ordinal = MAP.ordinal == null
        ? (S.cultivator && Number.isFinite(Number(S.cultivator.realmOrdinal)) ? Number(S.cultivator.realmOrdinal) : 0)
        : null;
      renderMapPanel();
    });
  }

  // Bound to `.mapv`, which is rebuilt on every render, rather than to
  // `#overlay-body`, which is not: the overlay host outlives the panel, so a
  // listener attached to it accumulates one copy per navigation.
  const body = $('.mapv');
  if (!body) return;

  body.addEventListener('click', (e) => {
    const crumb = e.target.closest('[data-ascend]');
    if (crumb) { mapAscendTo(Number(crumb.dataset.ascend)); return; }
    const down = e.target.closest('[data-descend]');
    if (down) { mapDescend(down.dataset.descend); return; }
    const go = e.target.closest('[data-goto]');
    if (go) { e.preventDefault(); mapGoTo(go.dataset.goto); }
  });

  // A row's body is built when it opens rather than with the list: eight
  // hundred records of history, crossings and thresholds rendered up front is
  // most of a second of work nobody asked for.
  body.addEventListener('toggle', (e) => {
    const row = e.target.closest('[data-row]');
    if (!row || !row.matches('[data-row]')) return;
    const id = row.dataset.row;
    if (row.open) {
      MAP.openRows.add(id);
      const host = row.querySelector('.nbody');
      const n = MAP.byId.get(id);
      if (host && n && !host.innerHTML.trim()) host.innerHTML = mapBodyMarkup(n);
    } else {
      MAP.openRows.delete(id);
    }
  }, true);
}

/* ──────────────────────────── death screen ──────────────────────────── */

/* -- The ending screens -------------------------------------------------
   Two shapes, and they are not the same shape. Death is a defeat and reads
   like one. True Immortal is an ending and not a defeat: the run closes the
   only way that is not a death, and it closes by being emptied.
   ---------------------------------------------------------------------- */

function renderDeath() {
  const run = S.run || {};
  const c = S.cultivator || {};
  const host = $('#death-body');

  if (isTrueImmortal(run, c)) { renderTrueImmortal(host, run, c); wireEndingActions(); return; }

  const peakName = run.peakOrdinal != null
    ? (ladderName(run.peakOrdinal) || `ordinal ${fmtInt(run.peakOrdinal)}`)
    : (S.derived && S.derived.rankName) || '-';

  host.className = 'death';
  host.innerHTML = html`
    <div class="death__mark">The run is over</div>
    <h1 class="death__name">${c.name || 'Your cultivator'}</h1>

    <div class="death__cause">${causeText(run.deathCause)}.</div>

    ${run.deathDescription ? raw(html`<p class="death__desc">${run.deathDescription}</p>`) : ''}

    <dl class="death__facts">
      <div class="death__fact"><dt>Peak rank</dt><dd>${peakName}</dd></div>
      <div class="death__fact"><dt>Lasted</dt><dd>${fmtDays(run.elapsedDays)}</dd></div>
      <div class="death__fact"><dt>Turns</dt><dd>${fmtInt(run.turn)}</dd></div>
      <div class="death__fact"><dt>Age at end</dt><dd>${c.age != null ? `${fmtNum(c.age)} years` : '-'}</dd></div>
    </dl>

    ${raw(endingTollSection(
      'What the crossings took on the way up',
      'Charged in instalments at every realm boundary. None of it comes back.'
    ))}

    <p class="death__final">
      This run is closed. There is no reload, no revival, and no continuation - the state is
      written and the ledger has it. A new run rolls a new spirit root, and it will not be this one.
    </p>

    <div class="death__actions">
      <button class="btn btn--primary" type="button" id="death-new">Begin a new run</button>
      <button class="btn" type="button" data-open="ledger">Death Ledger</button>
      <button class="btn btn--ghost" type="button" data-open="ladder">View the ladder</button>
    </div>`;

  wireEndingActions();
}

function renderTrueImmortal(host, run, c) {
  const tolls = Array.isArray(S.tolls) ? S.tolls : [];
  const taken = tolls.filter((t) => t.outcome === 'taken');

  host.className = 'death death--immortal';
  host.innerHTML = html`
    <div class="tide" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>

    <div class="death__mark death__mark--immortal">The crossing went through</div>
    <h1 class="death__name">${c.name || 'Your cultivator'}</h1>

    <div class="death__cause death__cause--immortal">True Immortal.</div>

    <p class="death__desc">
      The hole was punched and you went through it. This is the top of the ladder and the end
      of a run in the only way that is not a death. Lifespan has stopped being a number that
      means anything.
    </p>

    <div class="collected">
      <div class="collected__title">The crossing collected in full</div>
      <p class="collected__body">
        Everything the Toll had been taking in instalments came due at once. Whatever you still
        had, you did not take with you. What fell back is the spirit tide that a whole region
        will remember as a golden year, and which you will never know you caused.
      </p>
      <p class="collected__body collected__body--quiet">
        Nobody currently alive has done this. The last confirmed crossing is centuries back, and
        it is remembered for the tide rather than the person.
      </p>
    </div>

    <dl class="death__facts">
      <div class="death__fact"><dt>Final rank</dt><dd>${ladderName(c.realmOrdinal) || (S.derived && S.derived.rankName) || 'True Immortal'}</dd></div>
      <div class="death__fact"><dt>Took</dt><dd>${fmtDays(run.elapsedDays)}</dd></div>
      <div class="death__fact"><dt>Turns</dt><dd>${fmtInt(run.turn)}</dd></div>
      <div class="death__fact"><dt>Instalments paid</dt><dd>${fmtInt(taken.length)} of ${fmtInt(tolls.length)}</dd></div>
    </dl>

    ${raw(endingTollSection(
      'Everything the crossings took',
      'Read top to bottom, this is the shape of who you used to be. The last line is the whole of what was left.'
    ))}

    <p class="death__final">
      This run is closed, and it is closed in the good way. There is still no reload and no
      continuation: what went through is not something you play. A new run rolls a new spirit
      root, and it will not be this one.
    </p>

    <div class="death__actions">
      <button class="btn btn--primary" type="button" id="death-new">Begin a new run</button>
      <button class="btn" type="button" data-open="ledger">Death Ledger</button>
      <button class="btn btn--ghost" type="button" data-open="ladder">View the ladder</button>
    </div>`;
}

function endingTollSection(title, blurb) {
  const tolls = Array.isArray(S.tolls) ? S.tolls : [];
  if (!tolls.length) return '';
  return html`
    <section class="ending-tolls">
      <div class="section__label">${title}</div>
      <p class="ending-tolls__blurb">${blurb}</p>
      ${raw(tollLedgerMarkup(tolls, { bare: true }))}
    </section>`;
}

function wireEndingActions() {
  const btn = $('#death-new');
  if (!btn) return;
  btn.addEventListener('click', () => {
    S.run = null;
    S.cultivator = null;
    S.derived = null;
    S.tolls = [];
    S.log = [];
    resetLogRender();
    showScreen('opening');
    renderStatus();
    const name = $('#begin-name');
    if (name) { name.value = ''; name.focus(); }
  });
}

/* ─────────────────────────────── toasts ─────────────────────────────── */

function toast(title, message, kind = 'error') {
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind === 'info' ? 'toast--info' : ''}`;
  el.innerHTML = html`<b>${title}</b>${message}`;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 220ms';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 240);
  }, kind === 'info' ? 7000 : 9000);
}

/* ────────────────────────────── sheet drawer ────────────────────────────── */

function openSheetDrawer() {
  app.dataset.sheet = 'open';
  $('#sheet-toggle').setAttribute('aria-expanded', 'true');
  $('#sheet-scrim').hidden = false;
}
function closeSheetDrawer() {
  delete app.dataset.sheet;
  const t = $('#sheet-toggle');
  if (t) t.setAttribute('aria-expanded', 'false');
  const s = $('#sheet-scrim');
  if (s) s.hidden = true;
}
function toggleSheetDrawer() {
  if (app.dataset.sheet === 'open') closeSheetDrawer(); else openSheetDrawer();
}

/* ─────────────────────────────── wiring ─────────────────────────────── */

function wire() {
  $('#begin-form').addEventListener('submit', beginRun);
  $('#command-form').addEventListener('submit', submitAction);
  // Enter submits explicitly (and never while an IME composition is open).
  $('#command-input').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing || e.shiftKey) return;
    e.preventDefault();
    submitAction(e);
  });
  $('#btn-cultivate').addEventListener('click', () => openCultivatePicker());
  // Issued down the ordinary command path rather than as a side-channel read,
  // so the narrator handles it and it lands in the transcript like any other
  // turn. `status` is a read: no time passes and no satiety burns.
  $('#btn-status').addEventListener('click', () => {
    const input = $('#command-input');
    if (!input || S.busy) return;
    input.value = 'status';
    submitAction();
  });
  $('#btn-breakthrough').addEventListener('click', () => openBreakthroughConfirm());
  $('#sheet-toggle').addEventListener('click', toggleSheetDrawer);
  $('#sheet-scrim').addEventListener('click', closeSheetDrawer);

  $('#admin-badge').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#admin-tools').hidden ? openAdminMenu() : closeAdminMenu();
  });
  // Any click that is not inside the menu dismisses it.
  document.addEventListener('click', (e) => {
    if (!$('#admin-tools').hidden && !e.target.closest('#admin-menu')) closeAdminMenu();
  });

  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-overlay-close]');
    if (closer) { e.preventDefault(); closeOverlay(); return; }
    const opener = e.target.closest('[data-open]');
    if (opener) {
      e.preventDefault();
      const what = opener.dataset.open;
      if (opener.closest('#admin-tools')) closeAdminMenu();
      if (what === 'ladder') openLadder();
      else if (what === 'ledger') openLedger();
      else if (what === 'roster') openRoster();
      else if (what === 'map') openMap();
      // Shift-click rewrites the prose. Regenerating costs provider calls, so
      // it is deliberately not the thing an ordinary click does.
      else if (what === 'register') openRegister(e.shiftKey);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('#admin-tools').hidden) { closeAdminMenu(); $('#admin-badge').focus(); return; }
      if (!$('#overlay').hidden) { closeOverlay(); return; }
      if (app.dataset.sheet === 'open') { closeSheetDrawer(); return; }
    }
    // Keyboard-first: typing anywhere on the play screen goes to the command bar.
    if (app.dataset.screen === 'play' && $('#overlay').hidden) {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      const editable = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable);
      if (!editable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        focusCommand();
      }
    }
  });

  // Keep focus in the command bar when the window regains focus mid-run.
  window.addEventListener('focus', () => { if (app.dataset.screen === 'play') focusCommand(); });
}

/* ──────────────────────────────── boot ──────────────────────────────── */

async function boot() {
  const params = new URLSearchParams(location.search);

  // Dev-only mock. Strictly opt-in: the module is not even fetched without the
  // flag, so it can never intercept real API calls in a production deployment.
  if (params.get('mock') === '1') {
    try {
      const mod = await import('./mock-api.js');
      mod.installMock({
        scenario: params.get('scenario') || 'fresh',
        outcome: params.get('outcome') || ''
      });
      S.mock = true;
      $('#mock-badge').hidden = false;
    } catch (err) {
      console.warn('Mock requested but could not be loaded:', err);
    }
  }

  wire();

  const [health, ladder, roots] = await Promise.all([
    getJSON('/api/health'),
    getJSON('/api/reference/ladder'),
    getJSON('/api/reference/spirit-roots')
  ]);

  if (health.ok) {
    S.health = health.data;
    // One gate for the whole operator surface. Everything a player is not
    // meant to see hangs off the badge, so revealing the menu reveals all of
    // it and nothing leaks into the bar when admin mode is off.
    if (health.data.adminMode) $('#admin-menu').hidden = false;
  } else {
    toast('Engine unreachable', health.error);
  }

  if (ladder.ok && ladder.data && Array.isArray(ladder.data.ranks)) S.ladder = ladder.data.ranks;
  if (roots.ok && roots.data) {
    S.rootsRef = roots.data;
    (roots.data.roots || []).forEach((r) => S.rootsByKey.set(r.key, r));
  }

  renderRootsReference();
  await refreshState({ quiet: true });
  resetLogRender();
  routeFromState();
}

boot().catch((err) => {
  console.error(err);
  showScreen('opening');
  renderStatus();
  toast('Client error', err && err.message ? err.message : 'The page failed to start.');
});
