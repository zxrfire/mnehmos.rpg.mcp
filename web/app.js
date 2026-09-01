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

  // 3. Stagnation at the current realm (fatal at 50 years).
  const stag = Number(c.yearsAtCurrentRealm) || 0;
  if (stag >= 45) {
    items.push({
      level: 'critical',
      mark: '✕',
      title: `${fmtNum(stag)} years at ${d.rankName || 'this realm'} - ${fmtNum(50 - stag)} left`,
      body: 'Fifty years without advancing kills. Break through or die where you stand.'
    });
  } else if (stag >= 35) {
    items.push({
      level: 'severe',
      mark: '!',
      title: `${fmtNum(stag)} years stagnant at ${d.rankName || 'this realm'}`,
      body: 'The limit is fifty years at one realm. Time is now the thing most likely to kill you.'
    });
  }

  // 4. Lifespan. A False Immortal's ceiling is their own, not their ordinal's.
  const life = lifespanRemaining(d);
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

  const life = lifespanRemaining(d);
  const age = Number(c.age) || 0;
  const lifeCeiling = Number.isFinite(life) ? age + Math.max(0, life) : 0;
  const lifeState = Number.isFinite(life) && life <= 3 ? 'is-danger' : Number.isFinite(life) && life <= 15 ? 'is-warn' : '';

  const stag = Number(c.yearsAtCurrentRealm) || 0;
  const stagState = stag >= 45 ? 'is-danger' : stag >= 35 ? 'is-warn' : '';

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
                : `${fmtNum(life)} years of lifespan remain at this realm.`)
            : ''
      }))}
      ${raw(meter({
        name: 'Years at current realm',
        value: stag,
        max: 50,
        unit: ' yr',
        kind: 'stag',
        state: stagState,
        note: 'Fifty years without advancing is fatal.'
      }))}
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
  const life = lifespanRemaining();
  const stag = Number((S.cultivator || {}).yearsAtCurrentRealm) || 0;
  const years = days / DAYS_PER_YEAR;

  const warnings = [];
  if (Number.isFinite(life) && years >= life) {
    warnings.push(`This is longer than the ${fmtNum(life)} years of lifespan you have left.`);
  }
  if (stag + years >= 50) {
    warnings.push(`This would push you past the 50-year stagnation limit at your current realm unless you break through.`);
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

  const body = html`
    <div class="confirm">
      <p>You are about to strike the barrier between <b>${d.rankName || ladderName(ordinal)}</b>
         and <b>${d.nextRankName || ladderName(ordinal + 1)}</b>.</p>
      <div class="confirm__odds">
        <span>Base chance at this rung: ${rung ? fmtPct(rung.baseBreakthroughChance, 1) : 'unknown'}</span>
        <span>Ambient qi: ${titleise(S.ambient)}</span>
        <span>Untreated injuries: ${untreated}${untreated ? ' (each one costs you odds)' : ''}</span>
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
 * The world, as the engine holds it.
 *
 * WHY CONTAINMENT AND NOT A FORCE GRAPH
 * -------------------------------------
 * `LocationRecord` has no coordinate and never has. What it has is `parentId`
 * - a region holds a seat holds a precinct holds a hall - and `links`, which
 * carry a real cost in days. A spring layout would place 65 nodes at 65
 * positions the engine never computed, and an operator reads position on a map
 * as position in the world. So the frame is the hierarchy, which is real, and
 * the graph is drawn on top of it as edges between the tiles, which is also
 * real. Nothing here is laid out by distance, and the panel says so in as many
 * words, because the one thing this view must never do is invent geography.
 *
 * WHAT IS ENCODED, AND WHY THOSE FOUR
 * -----------------------------------
 *   qi density   -> the bar and its band colour. This is the number that
 *                   decides whether a cultivator standing there ever finishes
 *                   the ladder, and it ranges 1..100 across this world.
 *   thresholds   -> the left edge of every tile, banded against one ordinal.
 *                   Four requirements that fail differently: turned away,
 *                   killed by the air, alive and useless, able to work.
 *   travel days  -> the edge label. It is the only distance in this model, so
 *                   it is written on the only thing that carries it.
 *   seal / cycle -> a state of its own, not a shade of "closed". A ruin that
 *                   opens for ten days a century is a different problem from a
 *                   ruin somebody sealed.
 *
 * THE FOG IS BUILT IN
 * -------------------
 * Admin mode shows all of them; `docs/world/discovery.md` is emphatic that a
 * player may not be shown what they have not heard of. So `discovered` is a
 * first-class filter here rather than an afterthought: the default marks
 * undiscovered places, and one control drops them entirely, which is exactly
 * what a player-facing map would do at the boundary.
 */

const MAP = {
  data: null,
  byId: new Map(),
  collapsed: new Set(),
  selected: null,
  q: '',
  kind: '',
  layer: '',
  /** 'mark' shows undiscovered places as fog; 'hide' is the player's view. */
  fog: 'mark',
  /**
   * Containers at a depth below this are open; the rest are folded.
   *
   * Not cosmetic. Interiors landed and the seeded world went from 65 places to
   * 857 - a compound is a precinct is a hall is a chamber - so an
   * expand-everything default paints eight hundred tiles and measures eight
   * hundred rectangles to draw the graph over them. One is the useful default:
   * the regions stand open, and what is inside a sect's walls opens when
   * somebody asks for it.
   */
  unfold: 1,
  /** Ordinal the thresholds are banded against. null = do not band. */
  ordinal: null,
  observer: null
};

/** Reading order for containers: the frame first, then what is inside it. */
const MAP_KIND_ORDER = [
  'region', 'wilds', 'vein', 'settlement', 'sect_seat', 'precinct', 'hall',
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

/* Glyphs, 16x16, stroked in currentColor. Form carries `kind` so the eye can
   sort a map full of ruins from a map full of seats without reading a word. */
const MAP_GLYPH = {
  region: 'M2 5.5l6-3 6 3v5l-6 3-6-3z',
  settlement: 'M2.5 7.5L8 3l5.5 4.5M4 7v6.5h8V7',
  sect_seat: 'M2 13.5h12M3.5 13.5V7h9v6.5M2 7l6-4.5L14 7M6.5 13.5V10h3v3.5',
  wilds: 'M1.5 13l3.5-7 2.5 4.5L10 5l4.5 8z',
  vein: 'M8 2l5 6-5 6-5-6zM5.5 8h5',
  cave: 'M2.5 13.5V9a5.5 5.5 0 0111 0v4.5M6 13.5V10a2 2 0 014 0v3.5',
  ruin: 'M2.5 13.5V6l2-2v5.5M7 13.5V4.5l2 2v3M11.5 13.5V8l2-1.5v7M1.5 13.5h13',
  grave: 'M4.5 13.5V6a3.5 3.5 0 017 0v7.5M6 8h4M2.5 13.5h11',
  scar: 'M9.5 1.5L4 8.5h3.5L6 14.5l6-7.5H8.5z',
  forbidden_zone: 'M8 2a6 6 0 100 12A6 6 0 008 2zM4 12L12 4',
  secret_realm: 'M8 2a6 6 0 100 12A6 6 0 008 2zM8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  sealed_domain: 'M8 2a6 6 0 100 12A6 6 0 008 2zM3.5 8h9',
  portal: 'M8 2c2.2 0 4 2.7 4 6s-1.8 6-4 6-4-2.7-4-6 1.8-6 4-6zM2 8h12',
  precinct: 'M2 2.5h12v11H2zM5 5.5h6v5H5z',
  hall: 'M2 13.5h12M3 13.5V6h10v7.5M5.5 13.5V8M8 13.5V8M10.5 13.5V8M2 6l6-3.5L14 6',
  chamber: 'M8 4.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2',
  vault: 'M3 7.5h10v6H3zM5.5 7.5V5a2.5 2.5 0 015 0v2.5M8 9.5v2'
};

/**
 * How far to unfold, as one control rather than thirty clicks.
 *
 * The depths are the world's own: roots are regions and standalone sites,
 * depth 1 is what a region holds, depth 2 and below is what is behind a
 * compound's walls. `Everything` is deliberately last and deliberately warned
 * about - it paints every interior in the world at once.
 */
const MAP_UNFOLD = [
  { depth: 1, label: 'Unfold: regions' },
  { depth: 2, label: 'Unfold: seats' },
  { depth: 3, label: 'Unfold: precincts' },
  { depth: 99, label: 'Unfold: everything' }
];

const MAP_LINK_LABEL = {
  road: 'road', path: 'path', tunnel: 'tunnel', gate: 'gate', portal: 'portal', seam: 'seam'
};

const MAP_BAND_LABEL = {
  thin: 'thin', normal: 'ordinary', dense: 'dense', spirit_tide: 'spirit tide'
};

/**
 * What one ordinal can do at one place.
 *
 * Straight off `LocationThresholds`, whose four numbers fail differently and
 * are documented in engine/world/locations.ts: below entry you are turned away
 * and nothing happens; below survival you get in and die; between survival and
 * operational you are alive and useless. This client compares; it does not
 * decide - the numbers are the engine's and are shown unmodified beside them.
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
  const total = Math.max(0, Math.round(Number(days) || 0));
  if (total === 0) return 'no time';
  if (total < DAYS_PER_MONTH) return `${total}d`;
  if (total < DAYS_PER_YEAR) return `${Math.round(total / DAYS_PER_MONTH)}mo`;
  const years = total / DAYS_PER_YEAR;
  return `${years >= 10 ? Math.round(years) : years.toFixed(1)}y`;
}

function mapGlyph(kind) {
  const d = MAP_GLYPH[kind] || MAP_GLYPH.settlement;
  return html`<svg class="pglyph" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

async function openMap() {
  openOverlay({
    title: 'World map',
    body: html`<p class="muted">Reading the world…</p>`,
    wide: 'x',
    foot: html`<button class="btn" type="button" data-overlay-close data-autofocus>Close</button>`,
    onClose: () => { teardownMapObserver(); focusCommand(); }
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
  MAP.selected = null;
  MAP.unfold = 1;
  mapRefold();
  // Band against the cultivator who is actually standing in this world, when
  // there is one. An operator with no run gets an unbanded map rather than a
  // map banded against a zero nobody is at.
  const ord = S.cultivator && Number.isFinite(Number(S.cultivator.realmOrdinal))
    ? Number(S.cultivator.realmOrdinal)
    : null;
  MAP.ordinal = ord;
  renderMapPanel();
}

/** Reset every fold to what `MAP.unfold` says, discarding manual toggles. */
function mapRefold() {
  MAP.collapsed = new Set(
    (MAP.data?.locations || [])
      .filter((n) => (n.childIds || []).length && n.depth >= MAP.unfold)
      .map((n) => n.id)
  );
}

/** Tiles that will actually be painted: keep, minus anything folded away. */
function mapRenderedIds(keep) {
  const out = new Set();
  const walk = (id) => {
    out.add(id);
    if (MAP.collapsed.has(id)) return;
    for (const cid of MAP.byId.get(id)?.childIds || []) if (keep.has(cid)) walk(cid);
  };
  for (const n of MAP.data.locations || []) if (keep.has(n.id) && !n.parentId) walk(n.id);
  return out;
}

function mapMaxOrdinal() {
  return Array.isArray(S.ladder) && S.ladder.length ? S.ladder.length - 1 : 46;
}

/** Places this view is allowed to draw at all, before search narrows them. */
function mapVisibleSet() {
  const all = MAP.data.locations || [];
  const out = new Set();
  for (const n of all) {
    if (MAP.fog === 'hide' && !n.discovered) continue;
    if (MAP.layer && n.layer !== MAP.layer) continue;
    out.add(n.id);
  }
  // A child whose container was dropped cannot be drawn inside anything.
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of all) {
      if (out.has(n.id) && n.parentId && !out.has(n.parentId)) { out.delete(n.id); changed = true; }
    }
  }
  return out;
}

function mapMatches(n) {
  if (MAP.kind && n.kind !== MAP.kind) return false;
  const q = MAP.q.trim().toLowerCase();
  if (!q) return true;
  return String(n.name || '').toLowerCase().includes(q)
    || String(n.kind || '').toLowerCase().includes(q)
    || (n.tags || []).some((t) => String(t).toLowerCase().includes(q))
    || (n.hazards || []).some((t) => String(t).toLowerCase().includes(q))
    || String(n.controllingFactionName || '').toLowerCase().includes(q);
}

/**
 * The set actually rendered: everything that matched, plus every container it
 * sits in. Dropping an unmatched region would put its matched seats nowhere,
 * and a place with no container is a place the engine did not describe.
 */
function mapKeepSet(visible) {
  const all = MAP.data.locations || [];
  const filtering = Boolean(MAP.q.trim() || MAP.kind);
  if (!filtering) return { keep: visible, matched: visible };

  const matched = new Set();
  for (const n of all) if (visible.has(n.id) && mapMatches(n)) matched.add(n.id);

  const keep = new Set(matched);
  for (const id of matched) {
    let p = MAP.byId.get(id)?.parentId || null;
    const guard = new Set();
    while (p && visible.has(p) && !guard.has(p)) { guard.add(p); keep.add(p); p = MAP.byId.get(p)?.parentId || null; }
  }
  return { keep, matched };
}

function mapChildrenOf(id, keep) {
  const node = MAP.byId.get(id);
  if (!node) return [];
  return (node.childIds || [])
    .filter((cid) => keep.has(cid))
    .map((cid) => MAP.byId.get(cid))
    .filter(Boolean)
    .sort(mapNodeOrder);
}

function mapNodeOrder(a, b) {
  const ka = MAP_KIND_ORDER.indexOf(a.kind);
  const kb = MAP_KIND_ORDER.indexOf(b.kind);
  return (ka < 0 ? 99 : ka) - (kb < 0 ? 99 : kb)
    || b.qiDensity - a.qiDensity
    || String(a.name).localeCompare(String(b.name));
}

/** The one line of state a tile shows without being asked. */
function mapStateChip(n) {
  if (n.sealed) return html`<span class="pstate pstate--sealed" title="Sealed. No cycle opens it.">sealed</span>`;
  if (!n.open && n.opensInDays != null) {
    return html`<span class="pstate pstate--shut" title="Shut now. The cycle reopens it.">shut · ${mapDays(n.opensInDays)}</span>`;
  }
  if (!n.open) return html`<span class="pstate pstate--shut">shut</span>`;
  if (n.cycle && n.closesInDays != null) {
    return html`<span class="pstate pstate--window" title="Open on a cycle. This window closes.">open · ${mapDays(n.closesInDays)}</span>`;
  }
  return '';
}

function mapPlaceMarkup(n, opts = {}) {
  const reach = mapReach(n, MAP.ordinal);
  const cls = [
    'place',
    `place--${n.kind}`,
    `reach--${reach}`,
    n.discovered ? '' : 'is-fogged',
    n.sealed ? 'is-sealed' : '',
    MAP.selected === n.id ? 'is-selected' : '',
    opts.head ? 'place--head' : ''
  ].filter(Boolean).join(' ');

  const qi = Math.max(0, Math.min(100, Number(n.qiDensity) || 0));
  const reachTitle = MAP_REACH_TEXT[reach][1];

  return html`
    <button class="${raw(cls)}" type="button" data-place-id="${n.id}"
            data-qi-band="${n.qiBand}" style="--qi:${raw(String(qi / 100))}"
            title="${raw(esc(`${n.name} - ${MAP_KIND_LABEL[n.kind] || n.kind}. qi ${qi}/100${reachTitle ? `. ${reachTitle}` : ''}`))}">
      <span class="place__row">
        <span class="place__glyph">${raw(mapGlyph(n.kind))}</span>
        <span class="place__name">${n.name}</span>
        ${n.discovered ? '' : raw(html`<span class="place__fog" title="Not discovered. A player has never heard this name.">unknown</span>`)}
      </span>
      <span class="place__meta">
        <span class="place__kind">${MAP_KIND_LABEL[n.kind] || n.kind}</span>
        ${raw(mapStateChip(n))}
        ${n.linkCount ? raw(html`<span class="place__links" title="${n.linkCount} link${n.linkCount === 1 ? '' : 's'} recorded on this place">· ${fmtInt(n.linkCount)}↔</span>`) : ''}
      </span>
      <span class="place__qi" aria-hidden="true"><i style="width:${raw(String(qi))}%"></i></span>
      <span class="place__qinum">${fmtInt(qi)}<span class="place__qiband">${MAP_BAND_LABEL[n.qiBand] || n.qiBand}</span></span>
    </button>`;
}

/** Recursive, because interiors nest and the seed will not stay two deep. */
function mapGroupMarkup(n, keep, depth = 0) {
  const kids = mapChildrenOf(n.id, keep);
  if (!kids.length) return html`<div class="pgroup pgroup--leaf">${raw(mapPlaceMarkup(n))}</div>`;

  const collapsed = MAP.collapsed.has(n.id);
  return html`
    <div class="pgroup ${raw(collapsed ? 'is-collapsed' : '')}" data-group-id="${n.id}" data-depth="${raw(String(Math.min(depth, 3)))}">
      <div class="pgroup__head">
        <button class="pgroup__toggle" type="button" data-toggle-group="${n.id}"
                aria-expanded="${raw(collapsed ? 'false' : 'true')}"
                aria-label="${raw(collapsed ? 'Expand' : 'Collapse')} ${esc(n.name)}">${collapsed ? '▸' : '▾'}</button>
        ${raw(mapPlaceMarkup(n, { head: true }))}
      </div>
      ${collapsed
        ? raw(html`<div class="pgroup__folded">${fmtInt(kids.length)} inside</div>`)
        : raw(html`<div class="pgroup__kids">${raw(kids.map((k) => mapGroupMarkup(k, keep, depth + 1)).join(''))}</div>`)}
    </div>`;
}

function mapLegendMarkup() {
  const bands = ['thin', 'normal', 'dense', 'spirit_tide'];
  const reaches = MAP.ordinal == null ? [] : ['master', 'operate', 'survive', 'lethal', 'barred'];
  const linkKinds = Object.keys(MAP.data.counts.byLinkKind || {});
  return html`
    <div class="maplegend">
      <div class="maplegend__group">
        <span class="maplegend__label">qi</span>
        ${raw(bands.map((b) => html`<span class="lg lg--qi" data-qi-band="${b}"><i></i>${MAP_BAND_LABEL[b]}</span>`).join(''))}
      </div>
      ${reaches.length ? raw(html`
      <div class="maplegend__group">
        <span class="maplegend__label">at ordinal ${fmtInt(MAP.ordinal)}</span>
        ${raw(reaches.map((r) => html`<span class="lg lg--reach reach--${raw(r)}" title="${MAP_REACH_TEXT[r][1]}"><i></i>${MAP_REACH_TEXT[r][0]}</span>`).join(''))}
      </div>`) : ''}
      ${linkKinds.length ? raw(html`
      <div class="maplegend__group">
        <span class="maplegend__label">crossings</span>
        ${raw(linkKinds.map((k) => html`<span class="lg lg--link"><svg width="22" height="8" aria-hidden="true"><line class="edge edge--${raw(k)}" x1="1" y1="4" x2="21" y2="4"/></svg>${MAP_LINK_LABEL[k] || k}</span>`).join(''))}
      </div>`) : ''}
    </div>`;
}

function mapThresholdRow(label, value, note) {
  const ord = MAP.ordinal;
  const max = mapMaxOrdinal();
  const pass = ord != null && ord >= value;
  return html`
    <div class="thr ${raw(ord == null ? '' : pass ? 'is-pass' : 'is-fail')}" title="${note}">
      <span class="thr__label">${label}</span>
      <span class="thr__track"><i style="width:${raw(String(Math.max(1, Math.min(100, (value / max) * 100))))}%"></i>
        ${ord == null ? '' : raw(html`<b class="thr__you" style="left:${raw(String(Math.max(0, Math.min(100, (ord / max) * 100))))}%"></b>`)}
      </span>
      <span class="thr__num">${fmtInt(value)}</span>
    </div>`;
}

function mapEdgesOf(id) {
  return (MAP.data.edges || []).filter((e) => e.fromId === id || e.toId === id);
}

function mapInspectorMarkup() {
  const n = MAP.selected ? MAP.byId.get(MAP.selected) : null;
  if (!n) {
    const c = MAP.data.counts;
    return html`
      <div class="mapinsp mapinsp--empty">
        <p class="mapinsp__hint">Pick a place. Everything below is the record the engine holds for it, unedited.</p>
        <dl class="mapinsp__facts">
          <div><dt>Places</dt><dd>${fmtInt(c.total)}</dd></div>
          <div><dt>Containers</dt><dd>${fmtInt(c.roots)} at the top, ${fmtInt(c.maxDepth)} deep</dd></div>
          <div><dt>Crossings</dt><dd>${fmtInt((MAP.data.edges || []).length)}</dd></div>
          <div><dt>Discovered</dt><dd>${fmtInt(c.discovered)} of ${fmtInt(c.total)}</dd></div>
          <div><dt>Sealed</dt><dd>${fmtInt(c.sealed)}</dd></div>
          <div><dt>Shut today</dt><dd>${fmtInt(c.closed)}</dd></div>
        </dl>
        ${MAP.data.danglingLinks || MAP.data.orphanedParents ? raw(html`
          <p class="mapinsp__warn">${fmtInt(MAP.data.danglingLinks)} link${MAP.data.danglingLinks === 1 ? '' : 's'} and
          ${fmtInt(MAP.data.orphanedParents)} parent reference${MAP.data.orphanedParents === 1 ? '' : 's'} name a place this world
          does not hold. They are counted and not drawn.</p>`) : ''}
      </div>`;
  }

  const reach = mapReach(n, MAP.ordinal);
  const edges = mapEdgesOf(n.id).slice().sort((a, b) => a.travelDays - b.travelDays);
  const other = (e) => MAP.byId.get(e.fromId === n.id ? e.toId : e.fromId);

  return html`
    <div class="mapinsp">
      <div class="mapinsp__head">
        <span class="mapinsp__glyph reach--${raw(reach)}">${raw(mapGlyph(n.kind))}</span>
        <div>
          <h3 class="mapinsp__name">${n.name}</h3>
          <p class="mapinsp__kind">${MAP_KIND_LABEL[n.kind] || n.kind}
            ${n.parentId && MAP.byId.get(n.parentId) ? raw(html` · inside <button class="linkish" type="button" data-place-id="${n.parentId}">${MAP.byId.get(n.parentId).name}</button>`) : ''}
            ${n.layer === 'immortal' ? raw(html` · <span class="pstate pstate--layer">above the Lid</span>`) : ''}
          </p>
        </div>
      </div>

      ${n.description ? raw(html`<p class="mapinsp__desc">${n.description}</p>`) : ''}

      ${n.discovered ? '' : raw(html`<p class="mapinsp__fog">Not discovered. A player has never heard this name, and the narrator may not say it.
        ${n.discoveredOnDay != null ? raw(html`<br />Recorded found on day ${fmtInt(n.discoveredOnDay)}.`) : ''}</p>`)}

      <div class="section__label">Ground</div>
      <div class="mapqi" data-qi-band="${n.qiBand}" style="--qi:${raw(String((Number(n.qiDensity) || 0) / 100))}">
        <div class="mapqi__bar"><i style="width:${raw(String(Math.max(0, Math.min(100, Number(n.qiDensity) || 0))))}%"></i></div>
        <div class="mapqi__read"><b>${fmtInt(n.qiDensity)}</b><span>/100 · ${MAP_BAND_LABEL[n.qiBand] || n.qiBand}</span></div>
      </div>
      <dl class="mapinsp__facts">
        <div><dt>Usable qi</dt><dd>${fmtPct(n.spiritualDensity)}<span class="sub">what somebody standing there can draw</span></dd></div>
        <div><dt>Danger</dt><dd>${fmtPct(n.danger)}</dd></div>
        <div><dt>Climate</dt><dd>${n.climate || '-'}</dd></div>
        <div><dt>Held by</dt><dd>${n.controllingFactionName || n.politicalControl || 'nobody in particular'}</dd></div>
      </dl>

      <div class="section__label">Thresholds${MAP.ordinal == null ? '' : ` · you are ordinal ${fmtInt(MAP.ordinal)}`}</div>
      ${MAP.ordinal == null ? '' : raw(html`<p class="mapinsp__verdict reach--${raw(reach)}">${MAP_REACH_TEXT[reach][0]}<span>${MAP_REACH_TEXT[reach][1]}</span></p>`)}
      <div class="thrs">
        ${raw(mapThresholdRow('entry', n.thresholds.entry, 'Below this you are turned away and nothing happens.'))}
        ${raw(mapThresholdRow('survival', n.thresholds.survival, 'Below this you get in and die.'))}
        ${raw(mapThresholdRow('operational', n.thresholds.operational, 'Below this you are alive and useless.'))}
        ${raw(mapThresholdRow('mastery', n.thresholds.mastery, 'Above this the place can be exploited or held.'))}
      </div>

      ${n.sealed || n.cycle ? raw(html`
        <div class="section__label">The door</div>
        <p class="mapinsp__door">
          ${n.sealed
            ? raw(html`Sealed${n.sealedOnDay != null ? ` on day ${fmtInt(n.sealedOnDay)}` : ''}. No cycle opens it.`)
            : raw(html`Open ${fmtInt(n.cycle.openDays)} day${n.cycle.openDays === 1 ? '' : 's'} in every ${fmtInt(n.cycle.periodDays)}.
                ${n.open
                  ? raw(html`<b>Standing open now</b>, and it closes in ${mapDays(n.closesInDays)}.`)
                  : raw(html`<b>Shut now.</b> It opens in ${mapDays(n.opensInDays)}.`)}`)}
        </p>`) : ''}

      ${(n.hazards || []).length ? raw(html`<div class="section__label">Hazards</div>
        <div class="chips">${raw(n.hazards.map((h) => html`<span class="chip chip--hazard">${h}</span>`).join(''))}</div>`) : ''}
      ${(n.specialRules || []).length ? raw(html`<div class="section__label">Local law</div>
        <ul class="mapinsp__rules">${raw(n.specialRules.map((r) => html`<li>${r}</li>`).join(''))}</ul>`) : ''}
      ${(n.resources || []).length ? raw(html`<div class="section__label">Gatherable</div>
        <div class="chips">${raw(n.resources.map((r) => html`<span class="chip">${r}</span>`).join(''))}</div>`) : ''}
      ${(n.tags || []).length ? raw(html`<div class="section__label">Tags</div>
        <div class="chips">${raw(n.tags.map((t) => html`<span class="chip chip--tag">${t}</span>`).join(''))}</div>`) : ''}

      <div class="section__label">Crossings${edges.length ? ` · ${fmtInt(edges.length)}` : ''}</div>
      ${edges.length ? raw(html`<ul class="xings">${raw(edges.map((e) => {
        const o = other(e);
        if (!o) return '';
        return html`<li class="xing ${raw(e.open ? '' : 'is-shut')}">
          <span class="xing__kind"><svg width="26" height="8" aria-hidden="true"><line class="edge edge--${raw(e.kind)}" x1="1" y1="4" x2="25" y2="4"/></svg>${MAP_LINK_LABEL[e.kind] || e.kind}</span>
          <button class="linkish xing__to" type="button" data-place-id="${o.id}">${o.name}</button>
          <span class="xing__days">${mapDays(e.travelDays)}</span>
          ${e.open ? '' : raw(html`<span class="pstate pstate--shut">shut</span>`)}
          ${e.requiresKeyId ? raw(html`<span class="pstate pstate--key" title="Needs ${esc(e.requiresKeyId)}">keyed</span>`) : ''}
          ${e.mutual ? '' : raw(html`<span class="pstate pstate--oneway" title="Only one end of this crossing records it.">one-sided</span>`)}
          ${e.asymmetric ? raw(html`<span class="pstate pstate--oneway" title="The two ends disagree about the cost. The larger is shown.">disputed cost</span>`) : ''}
        </li>`;
      }).join(''))}</ul>`)
      : raw(html`<p class="muted mapinsp__none">No crossing is recorded to this place. It is not drawn with one.</p>`)}
    </div>`;
}

function renderMapPanel() {
  const d = MAP.data;
  if (!d) return;

  if (!d.world) {
    $('#overlay-body').innerHTML = html`
      <div class="mapv mapv--nothing">
        <p class="mapv__nothing">No world has been instantiated. The world is rebuilt per run from its seed, so
        there is nothing to draw until a run exists. Begin one and reopen this panel.</p>
      </div>`;
    return;
  }

  const visible = mapVisibleSet();
  const { keep, matched } = mapKeepSet(visible);
  const rendered = mapRenderedIds(keep);
  const folded = keep.size - rendered.size;
  const roots = (d.locations || [])
    .filter((n) => keep.has(n.id) && !n.parentId)
    .sort(mapNodeOrder);

  const kinds = Object.keys(d.counts.byKind || {}).sort(
    (a, b) => (MAP_KIND_ORDER.indexOf(a) + 1 || 99) - (MAP_KIND_ORDER.indexOf(b) + 1 || 99)
  );
  const max = mapMaxOrdinal();

  const byLayer = d.layers.map((l) => {
    const layerRoots = roots.filter((n) => n.layer === l.key);
    if (!layerRoots.length) return '';
    return html`
      <section class="maplayer" data-layer="${l.key}">
        ${d.layers.length > 1 ? raw(html`<div class="maplayer__head"><span class="maplayer__name">${l.label}</span>
          <span class="maplayer__count">${fmtInt(l.count)} place${l.count === 1 ? '' : 's'}</span>
          ${l.key === 'immortal' ? raw(html`<span class="maplayer__note">the far side of the Lid. Nothing crosses to the map below.</span>`) : ''}
        </div>`) : ''}
        <div class="maplayer__roots">${raw(layerRoots.map((n) => mapGroupMarkup(n, keep, 0)).join(''))}</div>
      </section>`;
  }).join('');

  $('#overlay-body').innerHTML = html`
    <div class="mapv">
      <div class="mapv__note">
        <span class="roster__readonly">read-only</span>
        <span>Every place the engine holds, nested the way it holds them. <b>Position is containment, not geography</b> -
        the only distance in this world is the day count on a crossing, and it is written on the crossing.</span>
      </div>

      <div class="mapv__controls">
        <input class="input" id="m-q" type="search" placeholder="Search name, kind, tag, hazard…" value="${MAP.q}" aria-label="Search places" />
        <select id="m-kind" aria-label="Filter by kind">
          <option value="">All kinds</option>
          ${raw(kinds.map((k) => html`<option value="${k}" ${raw(MAP.kind === k ? 'selected' : '')}>${MAP_KIND_LABEL[k] || k} (${fmtInt(d.counts.byKind[k])})</option>`).join(''))}
        </select>
        ${d.layers.length > 1 ? raw(html`<select id="m-layer" aria-label="Filter by layer">
          <option value="">Both layers</option>
          ${raw(d.layers.map((l) => html`<option value="${l.key}" ${raw(MAP.layer === l.key ? 'selected' : '')}>${l.label}</option>`).join(''))}
        </select>`) : ''}
        <select id="m-fog" aria-label="How undiscovered places are shown">
          <option value="mark" ${raw(MAP.fog === 'mark' ? 'selected' : '')}>Admin: show the fog</option>
          <option value="hide" ${raw(MAP.fog === 'hide' ? 'selected' : '')}>As the player sees it</option>
        </select>
        <select id="m-unfold" aria-label="How far to unfold the containment tree">
          ${raw(MAP_UNFOLD.map((u, i) => html`<option value="${raw(String(u.depth))}" ${raw(MAP.unfold === u.depth ? 'selected' : '')}>${u.label}</option>`).join(''))}
        </select>
        <div class="mapv__ord">
          <label for="m-ord">reach at ordinal</label>
          <input id="m-ord" type="range" min="0" max="${raw(String(max))}" step="1"
                 value="${raw(String(MAP.ordinal == null ? 0 : MAP.ordinal))}"
                 ${raw(MAP.ordinal == null ? 'disabled' : '')} aria-label="Band thresholds against this ordinal" />
          <output id="m-ord-out">${MAP.ordinal == null ? 'off' : fmtInt(MAP.ordinal)}</output>
          <button class="btn btn--ghost btn--sm" type="button" id="m-ord-toggle">${MAP.ordinal == null ? 'band it' : 'clear'}</button>
        </div>
      </div>

      ${raw(mapLegendMarkup())}

      <div class="mapv__count">
        ${fmtInt(rendered.size)} tile${rendered.size === 1 ? '' : 's'} drawn
        ${folded ? raw(html`· ${fmtInt(folded)} folded inside them`) : ''}
        · ${fmtInt(matched.size)} of ${fmtInt(d.counts.total)} places match${MAP.fog === 'hide' ? ', undiscovered dropped as a player would see it' : ''}
        · day ${fmtInt(d.world.currentDay)} · seed <code>${d.world.seed}</code>
      </div>

      <div class="mapv__split">
        <div class="mapv__canvas" id="map-canvas">
          <svg class="mapedges" id="map-edges" width="0" height="0" aria-hidden="true"></svg>
          <div class="mapv__layers">
            ${raw(byLayer || html`<p class="empty">No place matches those filters.</p>`)}
          </div>
        </div>
        <aside class="mapv__rail" id="map-rail">${raw(mapInspectorMarkup())}</aside>
      </div>
    </div>`;

  wireMap();
  requestAnimationFrame(drawMapEdges);
}

/**
 * The graph, over the tiles.
 *
 * Every edge is a link one of these records holds. When one end is folded away
 * inside a collapsed container the line is anchored to the container that
 * holds it and marked as such - the crossing exists, and hiding it because the
 * operator collapsed a card would misreport the world as less connected than
 * it is. Two crossings that collapse onto the same pair become one line, which
 * is why the count in the legend is of crossings and the count on a tile is of
 * links.
 */
function drawMapEdges() {
  const canvas = $('#map-canvas');
  const svg = $('#map-edges');
  if (!canvas || !svg || !MAP.data) return;

  const base = canvas.getBoundingClientRect();
  const ox = canvas.scrollLeft - base.left;
  const oy = canvas.scrollTop - base.top;

  const anchors = new Map();
  $$('[data-place-id]', canvas).forEach((el) => {
    const r = el.getBoundingClientRect();
    anchors.set(el.dataset.placeId, { x: r.left + ox + r.width / 2, y: r.top + oy + r.height / 2 });
  });

  const resolve = (id) => {
    const guard = new Set();
    let cur = id;
    while (cur && !guard.has(cur)) {
      if (anchors.has(cur)) return cur;
      guard.add(cur);
      cur = MAP.byId.get(cur)?.parentId || null;
    }
    return null;
  };

  const lit = MAP.selected;
  const drawn = new Map();
  for (const e of MAP.data.edges || []) {
    const a = resolve(e.fromId);
    const b = resolve(e.toId);
    if (!a || !b || a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const via = a !== e.fromId || b !== e.toId;
    const touched = lit != null && (e.fromId === lit || e.toId === lit || a === lit || b === lit);
    const prev = drawn.get(key);
    if (prev) {
      prev.folded = prev.folded && via;
      prev.touched = prev.touched || touched;
      prev.days = Math.max(prev.days, e.travelDays);
      prev.count += 1;
      continue;
    }
    drawn.set(key, { a, b, kind: e.kind, days: e.travelDays, open: e.open, folded: via, touched, count: 1 });
  }

  const paths = [];
  const labels = [];
  for (const d of drawn.values()) {
    const p = anchors.get(d.a);
    const q = anchors.get(d.b);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    // A constant bow, capped, so short hops inside one card do not become
    // circles and long ones across the panel do not become straight lines that
    // hide each other.
    const bow = Math.min(26, len * 0.16);
    const cx = (p.x + q.x) / 2 - (dy / len) * bow;
    const cy = (p.y + q.y) / 2 + (dx / len) * bow;
    const cls = ['edge', `edge--${d.kind}`, d.open ? '' : 'edge--shut',
      d.folded ? 'edge--folded' : '', lit == null ? '' : d.touched ? 'is-lit' : 'is-dim'].filter(Boolean).join(' ');
    paths.push(`<path class="${cls}" d="M${p.x.toFixed(1)} ${p.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}"/>`);
    if (d.touched) {
      const mx = (p.x + 2 * cx + q.x) / 4;
      const my = (p.y + 2 * cy + q.y) / 4;
      labels.push(`<text class="edgelabel" x="${mx.toFixed(1)}" y="${my.toFixed(1)}">${esc(mapDays(d.days))}${d.count > 1 ? esc(` ·${d.count}`) : ''}</text>`);
    }
  }

  svg.setAttribute('width', String(canvas.scrollWidth));
  svg.setAttribute('height', String(canvas.scrollHeight));
  svg.innerHTML = paths.join('') + labels.join('');
}

function teardownMapObserver() {
  if (MAP.observer) { MAP.observer.disconnect(); MAP.observer = null; }
}

function selectPlace(id) {
  MAP.selected = MAP.selected === id ? null : id;
  $$('#map-canvas [data-place-id]').forEach((el) => {
    el.classList.toggle('is-selected', el.dataset.placeId === MAP.selected);
  });
  const rail = $('#map-rail');
  if (rail) { rail.innerHTML = mapInspectorMarkup(); rail.scrollTop = 0; }
  drawMapEdges();
}

function wireMap() {
  teardownMapObserver();

  const q = $('#m-q');
  if (q) {
    q.addEventListener('input', () => {
      MAP.q = q.value;
      const pos = q.selectionStart;
      renderMapPanel();
      const nq = $('#m-q');
      if (nq) { nq.focus(); try { nq.setSelectionRange(pos, pos); } catch { /* search inputs may refuse */ } }
    });
  }
  const bind = (sel, key) => {
    const el = $(sel);
    if (el) el.addEventListener('change', () => { MAP[key] = el.value; renderMapPanel(); });
  };
  bind('#m-kind', 'kind');
  bind('#m-layer', 'layer');
  bind('#m-fog', 'fog');

  const unfold = $('#m-unfold');
  if (unfold) {
    unfold.addEventListener('change', () => {
      MAP.unfold = Number(unfold.value);
      mapRefold();
      renderMapPanel();
    });
  }

  const ord = $('#m-ord');
  const out = $('#m-ord-out');
  if (ord) {
    ord.addEventListener('input', () => {
      MAP.ordinal = Number(ord.value);
      if (out) out.textContent = fmtInt(MAP.ordinal);
      // Rebanding touches every tile's class and the rail, and nothing moves,
      // so the edges do not need recomputing.
      $$('#map-canvas [data-place-id]').forEach((el) => {
        const n = MAP.byId.get(el.dataset.placeId);
        if (!n) return;
        el.className = el.className.replace(/\breach--\S+/g, '').trim() + ` reach--${mapReach(n, MAP.ordinal)}`;
      });
      const rail = $('#map-rail');
      if (rail) rail.innerHTML = mapInspectorMarkup();
    });
    ord.addEventListener('change', () => renderMapPanel());
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

  const canvas = $('#map-canvas');
  if (canvas) {
    canvas.addEventListener('click', (e) => {
      const fold = e.target.closest('[data-toggle-group]');
      if (fold) {
        const id = fold.dataset.toggleGroup;
        if (MAP.collapsed.has(id)) MAP.collapsed.delete(id); else MAP.collapsed.add(id);
        renderMapPanel();
        return;
      }
      const tile = e.target.closest('[data-place-id]');
      if (tile) selectPlace(tile.dataset.placeId);
    });
  }

  const rail = $('#map-rail');
  if (rail) {
    rail.addEventListener('click', (e) => {
      const jump = e.target.closest('[data-place-id]');
      if (!jump) return;
      const id = jump.dataset.placeId;
      MAP.selected = null;
      selectPlace(id);
      const tile = $(`#map-canvas [data-place-id="${CSS.escape(id)}"]`);
      if (tile) tile.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  // The cards reflow with the panel, so the lines have to be recomputed from
  // the DOM rather than remembered from the last layout.
  if (canvas && typeof ResizeObserver === 'function') {
    MAP.observer = new ResizeObserver(() => drawMapEdges());
    MAP.observer.observe(canvas);
    const layers = $('.mapv__layers');
    if (layers) MAP.observer.observe(layers);
  }
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
