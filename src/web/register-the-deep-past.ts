/**
 * The Standing Register's History tab, below the part about houses.
 *
 * WHAT WAS MISSING. The tab carried two sections, both of them about the
 * present: the dated events several houses share, and how each house came to be
 * standing where it stands. Nine hundred years deep, and the world is fifty
 * thousand. Everything older than the oldest house - four ages, two dead
 * civilisations, five accounts of where the ladder came from, four theories
 * about what is over the top of it, the named dead, the seven who crossed and
 * did not leave, and whatever is asleep under a mountain - was in the catalogs,
 * read by the engine, and on no page anybody could open.
 *
 * ── THE ONE RULE THIS TAB IS WRITTEN UNDER ───────────────────────────────
 *
 * Almost nothing down here is a fact. It is a CLAIM, held by a named party, on
 * stated evidence, at a stated fidelity, and the catalogs are built that way on
 * purpose: `ClaimSchema` will not accept a statement without somebody holding
 * it and something they are reasoning from. So every table below prints the
 * holder and the standing of the record beside the statement, and none of them
 * prints a verdict. Where the engine has settled a question it says
 * `objective`; where it has not, the candidate answers are printed unranked and
 * the sheet stops there. The Lid is the case worth knowing about: it is
 * `unresolved` in the catalog deliberately, because `resolveFact` exists so
 * that one run can settle it in play, and a sheet that answered it would take
 * the largest discoverable in the world out of every run at once.
 *
 * ── WHY IT IS ONE MODULE AND NOT SEVEN SECTIONS IN `register.ts` ─────────
 *
 * Because the eight sections share one question and one shape. A reader on this
 * tab is asking what happened before anybody now living, and the answer is
 * always the same three columns: what is claimed, who holds it, and how much of
 * the record is left to argue from. Written into the main file they would have
 * been eight unrelated blocks; written here the column means the same thing
 * eight times.
 */

import { rankName } from '../engine/cultivation/realms.js';
import {
    AGES,
    CALENDARS,
    DEAD_CIVILISATIONS,
    DEAD_SCRIPTS,
    LID_NON_POSITIONS,
    LID_THEORIES,
    LOCAL_RESIDUE,
    ORIGIN_ACCOUNTS,
    PRESENT_YEAR,
    WHY_ACCOUNTS_DISAGREE,
    type Claim
} from '../data/cultivation/history.js';
import {
    FOUNDERS,
    HELD_QUESTIONS,
    HISTORICAL_FIGURES,
    IMMORTAL_ANCESTORS,
    NAMED_FIGURES,
    SEALED_FIGURE_NAMES,
    type NamedFigure
} from '../data/cultivation/named-figures.js';
import {
    DEPARTURE_DESTINATIONS,
    FALSE_IMMORTALS,
    LU_SHENG_CARVINGS,
    MADNESS_STAGES
} from '../data/cultivation/false-immortals.js';
import {
    HELD_INSTRUMENTS,
    UNOWNED_ANCESTORS
} from '../data/cultivation/sealed-ancestors.js';
import {
    WHY_NOBODY_MOVES,
    conspiracyArithmetic,
    housesThatCouldJoinAConspiracy
} from '../data/cultivation/the-top-of-the-world.js';
import { factionName } from './register-names.js';

// ─────────────────────────────────────────────────────────────────────────
// SHARED
// ─────────────────────────────────────────────────────────────────────────

function esc(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** A body's own name, whichever of the three catalogs it is filed in. */

const names = (ids: readonly string[]): string =>
    ids.map(factionName).map(esc).join(', ');

const num = (value: number): string => value.toLocaleString('en-US');

const dim = (text: string): string => `<span class="dim">${esc(text)}</span>`;

const chip = (text: string): string => `<span class="chip">${esc(text)}</span>`;

/**
 * Years before the present, as the sheet says them.
 *
 * Round numbers where the catalog gave one and the exact figure where it did
 * not, because a date somebody actually established is worth reading as an
 * established date rather than as an approximation of one.
 */
const ago = (years: number | null): string =>
    years === null ? dim('undatable') : `${num(years)} years ago`;

/**
 * How a claim stands, in the two words the schema uses and a third that says
 * what they buy a reader.
 *
 * `objective` is not "true" and `reconstructed` is not "probably true". The
 * first says the ground is the knower and the second says somebody worked it
 * back from what survives, which is a statement about METHOD - and a
 * reconstruction from a full record beats an objective claim nobody can reach.
 * So the fidelity travels with it everywhere, and the two are never collapsed.
 */
const TRUTH_WORD: Readonly<Record<string, string>> = {
    objective: 'the ground is the knower',
    reconstructed: 'worked back from what survives',
    unresolved: 'nobody has settled it'
};

const FIDELITY_WORD: Readonly<Record<string, string>> = {
    full: 'the record is whole',
    partial: 'part of the record is left',
    rumour: 'nothing but hearsay is left',
    lost: 'the record is gone'
};

/**
 * PLAIN TEXT AND INLINE SPANS ONLY, never a nested paragraph.
 *
 * The renderer splits an oversized definition value into a lead and a
 * continuation, and it declines to touch one that already contains a block
 * element on the grounds that somebody has structured it deliberately. A claim
 * is the longest thing on this tab, so a `p` in here would arrive as one
 * unbroken wall past the readability guard by looking like a decision.
 */
function claimCell(claim: Claim): string {
    return `${esc(claim.statement)} `
        + `<span class="dim">${esc(TRUTH_WORD[claim.truth] ?? claim.truth)}, and `
        + `${esc(FIDELITY_WORD[claim.fidelity] ?? claim.fidelity)}.</span> `
        + (claim.heldBy.length
            ? `Held by ${names(claim.heldBy)}. `
            : 'Nobody holds it as a position, which on an objective claim means nobody has had to. ')
        + `Reasoning from: ${claim.evidence.map(esc).join('; ')}.`
        + (claim.claimedOutcomes.length
            ? ` Answers offered, none of them endorsed here: ${claim.claimedOutcomes.map(esc).join('; ')}.`
            : '');
}

// ─────────────────────────────────────────────────────────────────────────
// THE AGES, AND THE TWO CIVILISATIONS THAT ARE GONE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The qi of an age against the qi of the present, which is the whole of why
 * this world is in decline and the only figure on the page a reader can hold
 * two of at once.
 */
function qiLine(density: number): string {
    const present = AGES[AGES.length - 1]?.qiDensity ?? density;
    if (density === present) return `${density.toFixed(2)} ${dim('the present')}`;
    const times = density / present;
    return `${density.toFixed(2)} <span class="dim">${times.toFixed(1)} times the present</span>`;
}

function agesSection(): string {
    const dated = AGES.filter(a => a.beganYearsAgo !== null);
    const oldest = dated.length ? Math.max(...dated.map(a => a.beganYearsAgo ?? 0)) : 0;
    const knew = AGES.filter(a => a.endedYearsAgo !== null).length;

    const rows = AGES.map(age => `<tr>
    <td class="nm">${esc(age.name)}</td>
    <td class="m">${age.beganYearsAgo === null
        ? dim('beyond dating')
        : ago(age.beganYearsAgo)}<span class="rsep"> &middot; </span>${age.endedYearsAgo === null
        ? dim('still running')
        : `ended ${ago(age.endedYearsAgo)}`}</td>
    <td class="n">${qiLine(age.qiDensity)}</td>
    <td class="q">${esc(age.whatItWas)}</td>
  </tr>`).join('');

    const detail = AGES.map(age => `<dt>${esc(age.name)}</dt>
    <dd>${esc(age.livingThere)}</dd>
    <dt>${esc(age.name)}, and whether it could tell</dt>
    <dd>${esc(age.didTheyKnow)}</dd>
    <dt>How ${esc(age.name)} ended</dt>
    <dd>${claimCell(age.howItEnded)}</dd>
    <dt>What of ${esc(age.name)} the present can still put a hand on</dt>
    <dd>${age.whatSurvives.map(esc).join('. ')}.</dd>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>The four ages</h2><span class="r">${AGES.length} ages &middot; the oldest dated beginning is ${num(oldest)} years back &middot; ${knew} of them are over</span></div>
  <p class="note"><strong>Nobody who lived in any of these called it by the name in the first column.</strong> An age is a thing the present names once it is safely finished, and the naming is done by whoever kept the best records rather than by whoever was there. Read the column as what the survey houses call it now.</p>
  <p class="note"><strong>The third column is the whole of the decline.</strong> Ambient qi is measured against the richest ground the world has ever carried, so an age reading several times the present is not a better era with the same rules in it. It is a different game: the same rungs, bought at a fraction of the price, by people who did not know that was what they were being charged.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:16%"><col style="width:22%"><col style="width:12%"><col style="width:50%"></colgroup>
    <caption>The ages, oldest first &middot; year ${num(PRESENT_YEAR)} of the Great Peace is the present</caption>
    <thead><tr><th>Age</th><th>When</th><th>Qi</th><th>What it was</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <dl class="dispute">${detail}</dl>
</section>`;
}

function deadCivilisationsSection(): string {
    const established = DEAD_CIVILISATIONS.filter(c => c.existence === 'established').length;
    const works = DEAD_CIVILISATIONS.reduce((n, c) => n + c.survivingWorks.length, 0);
    const squatted = DEAD_CIVILISATIONS
        .flatMap(c => c.survivingWorks)
        .filter(w => w.heldByFactionId !== null).length;

    const entries = DEAD_CIVILISATIONS.map(civ => `<dt>${esc(civ.name)}${civ.existence === 'disputed' ? ` ${chip('disputed that they existed at all')}` : ''}</dt>
    <dd>${esc(civ.whoTheyWere)}</dd>
    <dt>What ${esc(civ.name)} could do</dt>
    <dd>${esc(civ.whatTheyCouldDo)}</dd>
    <dt>Where the name comes from</dt>
    <dd>${esc(civ.whyThatName)}</dd>
    <dt>What is left of them, and who is standing in it</dt>
    <dd>${civ.survivingWorks.map(work =>
        `${esc(work.what)} ${work.heldByFactionId === null
            ? dim('nobody holds it')
            : `Held by ${esc(factionName(work.heldByFactionId))}.`}`
        + `${work.nodes ? ` ${work.nodes.lit} of ${work.nodes.total} formation nodes still lit.` : ''}`
        + ` Why nobody can make another: ${esc(work.whyItCannotBeReplaced)}`
    ).join(' ')}</dd>
    <dt>How ${esc(civ.name)} ended</dt>
    <dd>${claimCell(civ.theEnd)}</dd>
    <dt>How anybody alive could find this out</dt>
    <dd>${civ.howItIsDiscoverable.map(esc).join('. ')}.</dd>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Two civilisations that are gone</h2><span class="r">${established} of ${DEAD_CIVILISATIONS.length} established &middot; ${works} surviving works &middot; ${squatted} of them under somebody</span></div>
  <p class="note"><strong>Gone is not the same as forgotten, and neither is the same as unreachable.</strong> Every one of the works below is a physical thing standing somewhere in this world, most of them with a house living in them, and what makes them dead is that nobody can make a second one. The reason is written against each work rather than left as loss: this world does not have a lost-technology shelf, it has specific capabilities with specific reasons they cannot be repeated.</p>
  <p class="note"><strong>A house squatting in one of these is usually pricing off it without knowing what it is.</strong> That is the ordinary case rather than the dramatic one. The last column of every entry says how somebody could find out, and the answers are all somebody you could go and talk to.</p>
  <dl class="dispute">${entries}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHERE THE LADDER CAME FROM, AND WHAT IS OVER THE TOP OF IT
// ─────────────────────────────────────────────────────────────────────────

const CURRENCY_WORD: Readonly<Record<string, string>> = {
    most_of_the_world: 'most of the world holds it',
    widespread: 'widely held',
    institutional: 'held by institutions rather than by people',
    minority: 'a minority position',
    two_people: 'two people hold it'
};

function originAccountsSection(): string {
    const wrong = ORIGIN_ACCOUNTS.filter(a => a.demonstrablyWrong !== null);

    const entries = ORIGIN_ACCOUNTS.map(account => `<dt>${esc(account.name)}</dt>
    <dd>${esc(account.account)} <span class="dim">${esc(CURRENCY_WORD[account.currency] ?? account.currency)}; held by ${names(account.heldBy)}.</span></dd>
    <dt>Why the rungs are shaped as they are, on this account</dt>
    <dd>${esc(account.whyTheRealmsHaveTheirShape)}</dd>
    <dt>What it is reasoning from</dt>
    <dd>${account.evidence.map(esc).join('; ')}.</dd>
    <dt>The thing it cannot answer</dt>
    <dd>${esc(account.theProblem)}</dd>
    ${account.demonstrablyWrong
        ? `<dt>And this one can be shown to be wrong</dt>
    <dd>${esc(account.demonstrablyWrong.refutation)} It is held anyway: ${esc(account.demonstrablyWrong.whyItIsStillHeld)} Who could put the refutation in front of somebody: ${names(account.demonstrablyWrong.whoCouldDemonstrateIt)}.</dd>`
        : ''}`).join('');

    const disagreement = WHY_ACCOUNTS_DISAGREE.map(reason =>
        `<dt>${esc(reason.statement.split('.')[0])}</dt><dd>${claimCell(reason)}</dd>`
    ).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Where the ladder came from</h2><span class="r">${ORIGIN_ACCOUNTS.length} accounts &middot; ${wrong.length} refutable and held anyway &middot; ${WHY_ACCOUNTS_DISAGREE.length} reasons the records fight</span></div>
  <p class="note"><strong>Every one of these has evidence behind it and a hole in it, and the sheet ranks none of them.</strong> A reader looking for which is correct is asking a question the engine does not answer: what it holds is who believes what, what they are reasoning from, and the specific thing each account cannot explain. That is enough to argue with somebody in a tea house and not enough to win.</p>
  ${wrong.length
      ? `<p class="note"><strong>${wrong.length} of them can be refuted from evidence that survives, and ${wrong.length === 1 ? 'is' : 'are'} held anyway.</strong> That is not a mistake in the catalog. An account is held because of what it lets an institution do, and a refutation nobody in the room is equipped to deliver changes nothing - so the entry carries the refutation, the reason it does not land, and the names of the parties who could actually deliver it.</p>`
      : ''}
  <dl class="dispute">${entries}</dl>
  <p class="note"><strong>Why two copies of one document say different things.</strong> The reasons below are not excuses for a thin record. They are mechanisms, each with a party who worked it out and evidence they hold, and knowing which one is operating on a given text is most of what reading an old document in this world consists of.</p>
  <dl class="dispute">${disagreement}</dl>
</section>`;
}

function lidSection(): string {
    const theories = LID_THEORIES.map(theory => `<dt>${esc(theory.name)}<span class="rsep"> &middot; </span>${dim(factionName(theory.heldBy))}</dt>
    <dd>${esc(theory.theory)} <span class="dim">Read through ${esc(theory.throughWhichPrinciple)}, which is the principle this house reads everything through.</span></dd>
    <dt>What it has to point at</dt>
    <dd>${theory.evidence.map(esc).join('; ')}.</dd>
    <dt>What it cannot answer</dt>
    <dd>${esc(theory.cannotAnswer)}</dd>
    <dt>What they say when that is put to them</dt>
    <dd>${esc(theory.theirAnswerToThat)}</dd>
    <dt>What follows if this one happens to be right</dt>
    <dd>${esc(theory.ifItIsTrue)}</dd>`).join('');

    const refusals = LID_NON_POSITIONS.map(row =>
        `<dt>${esc(factionName(row.factionId))}</dt>
    <dd>${esc(row.position)}</dd>
    <dt>Why that is worse than a theory</dt>
    <dd>${esc(row.whyItMatters)}</dd>`
    ).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>What is over the top of the ladder</h2><span class="r">${LID_THEORIES.length} theories &middot; ${LID_NON_POSITIONS.length} bodies that decline to hold one</span></div>
  <p class="note"><strong>The engine does not know either, and that is deliberate.</strong> This is the one entry in the world that is left unresolved in the catalog on purpose: a particular run can settle it in play, and settling it here would take the largest discoverable in the world out of every run at once. Nothing below is endorsed and nothing below is dismissed.</p>
  <p class="note"><strong>Each theory is the house that holds it, reasoning in the only way it knows how.</strong> A containment house reads the Lid as a containment; a survey reads it as a boundary on a survey. That is not a flaw in the theories, it is what a theory is here, and the second column of every entry is the principle the holder reads everything else through.</p>
  <dl class="dispute">${theories}</dl>
  <p class="note"><strong>And ${LID_NON_POSITIONS.length} bodies hold no theory at all.</strong> A refusal is a position and one of these is the most disturbing entry available to anybody working on the question: the best-informed party in the world, in continuous receipt of accounts from somebody who made the crossing, reports that the subject does not arise in them.</p>
  <dl class="dispute">${refusals}</dl>
</section>`;
}

function calendarsAndScriptsSection(): string {
    const dated = CALENDARS.filter(c => c.presentYear !== null);
    const spread = dated.length
        ? Math.max(...dated.map(c => c.presentYear ?? 0)) - Math.min(...dated.map(c => c.presentYear ?? 0))
        : 0;
    const wrongEpochs = CALENDARS.filter(c => c.isTheOriginCorrect.truth !== 'objective').length;

    const calendars = CALENDARS.map(cal => `<tr>
    <td class="nm">${esc(cal.name)}${cal.regionId ? `<span class="rsep"> &middot; </span>${dim(factionName(cal.regionId))}` : ''}</td>
    <td class="n">${cal.presentYear === null ? dim('keeps no year') : num(cal.presentYear)}</td>
    <td class="m">${names(cal.keptBy)}</td>
    <td class="q">${esc(cal.countsFrom)}</td>
  </tr>`).join('');

    const epochs = CALENDARS.map(cal =>
        `<dt>${esc(cal.name)}</dt><dd>${claimCell(cal.isTheOriginCorrect)}</dd>`
    ).join('');

    const scripts = DEAD_SCRIPTS.map(script => `<dt>${esc(script.name)}</dt>
    <dd>${esc(script.legibility)} <span class="dim">Read by ${names(script.readBy)}.</span></dd>
    <dt>Why it is like that</dt>
    <dd>${esc(script.whyItIsLikeThat)}</dd>
    <dt>What is written in it that somebody would want</dt>
    <dd>${script.whatIsWrittenInIt.map(esc).join('. ')}.</dd>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>The year, and the hands the old records are in</h2><span class="r">${CALENDARS.length} reckonings &middot; ${num(spread)} years between the highest and the lowest &middot; ${DEAD_SCRIPTS.length} dead scripts</span></div>
  <p class="note"><strong>There is no such thing as the date in this world.</strong> ${num(spread)} years separate the highest reckoning from the lowest, every one of them is kept and enforced by named bodies, and a document dated in one of them says nothing at all until a reader knows which. This is the commonest way an old record is misread, and it is not a puzzle: it is arithmetic nobody did.</p>
  ${wrongEpochs
      ? `<p class="note"><strong>${wrongEpochs} of the ${CALENDARS.length} may not count from the event they say they count from.</strong> An epoch is a claim like any other and it is printed as one below. A reckoning whose origin is wrong is not thereby useless - it still orders everything inside itself correctly, which is why nobody has ever had a reason to fix one.</p>`
      : ''}
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:22%"><col style="width:10%"><col style="width:26%"><col style="width:42%"></colgroup>
    <caption>The reckonings in use &middot; and what each counts from</caption>
    <thead><tr><th>Reckoning</th><th>This year</th><th>Kept by</th><th>Counts from</th></tr></thead>
    <tbody>${calendars}</tbody>
  </table></div>
  <dl class="dispute">${epochs}</dl>
  <p class="note"><strong>A dead script is not a cipher and there is nothing hidden in one.</strong> Each of the ${DEAD_SCRIPTS.length} below states exactly how much can be read, by whom, and why the rest cannot be - and in every case the reason is that the hand was written for a reader who no longer exists rather than to keep anybody out. What is in them is listed because somebody would want it.</p>
  <dl class="dispute">${scripts}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE NEAREST PEOPLE SAY ABOUT THE GROUND
// ─────────────────────────────────────────────────────────────────────────

const RESIDUE_KIND_WORD: Readonly<Record<string, string>> = {
    ruin: 'a ruin',
    scar: 'a scar',
    road: 'a road',
    word: 'a word'
};

function residueSection(): string {
    const byKind = new Map<string, number>();
    for (const row of LOCAL_RESIDUE) byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + 1);
    const unresolved = LOCAL_RESIDUE.filter(r => r.truth === 'unresolved').length;

    const rows = LOCAL_RESIDUE.map(row => `<tr>
    <td class="nm">${esc(row.siteName)}<span class="rsep"> &middot; </span>${dim(RESIDUE_KIND_WORD[row.kind] ?? row.kind)}</td>
    <td class="q">${esc(row.whatTheySay)}</td>
    <td class="q">${esc(row.practice)}</td>
    <td class="m">${esc(TRUTH_WORD[row.truth] ?? row.truth)}</td>
  </tr>`).join('');

    const established = LOCAL_RESIDUE.map(row =>
        `<dt>${esc(row.siteName)}</dt>
    <dd>${esc(row.established)} <span class="dim">Held by ${esc(row.heldBy)}</span></dd>`
    ).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>What the nearest families say about the named ground</h2><span class="r">${LOCAL_RESIDUE.length} sites &middot; ${[...byKind.entries()].map(([k, n]) => `${n} ${k === 'word' ? 'words' : `${k}s`}`).join(' &middot; ')}</span></div>
  <p class="note"><strong>The third column is the part that survives.</strong> A story lasts about as long as the generation that heard it; a practice lasts for centuries, because it is a thing people do rather than a thing they say. Every row here has one, and the practice is generally sound whether or not the story attached to it is - which is the honest answer far more often than either the families or the survey houses would like.</p>
  ${unresolved
      ? `<p class="note"><strong>${unresolved} of the ${LOCAL_RESIDUE.length} are unresolved, and several of those are unfalsifiable rather than merely unproved.</strong> The last column says where the engine stands on the account and not on the practice. Those are two questions, and a reader who runs them together will conclude that a village doing something sensible is doing it for a stupid reason.</p>`
      : ''}
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:20%"><col style="width:32%"><col style="width:30%"><col style="width:18%"></colgroup>
    <caption>Named ground, what is said of it, and what is done about it</caption>
    <thead><tr><th>The place</th><th>What they say</th><th>What they do</th><th>Where the engine stands</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <dl class="dispute">${established}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE NAMED DEAD, THE NAMED ABSENT AND THE NAMED ENORMOUS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether a name is usable, which is the only question an institution asks.
 *
 * Not how famous the figure was and not whether they existed: whether the
 * holding house can act on the name. A garbled attestation and a withheld one
 * are the same answer at the gate and different answers in the archive.
 */
const ATTESTATION_WORD: Readonly<Record<string, string>> = {
    secure: 'the name can be acted on',
    ceremonial: 'said aloud at rites and not usable for anything else',
    garbled: 'the record disagrees with itself',
    disputed: 'two houses claim it and say different things',
    unreadable: 'the record exists and cannot be read',
    withheld: 'somebody has it and will not produce it',
    unrecorded: 'nobody wrote it down'
};

const ANSWER_WORD: Readonly<Record<string, string>> = {
    answers: 'answers what is sent up',
    silent: 'has stopped answering',
    never_has: 'has never once answered',
    unknown: 'nobody has established whether anything comes back'
};

function figureRows(list: readonly NamedFigure[]): string {
    return list.map(figure => `<tr>
    <td class="nm">${esc(figure.name)}${figure.alsoCalled ? `<span class="rsep"> &middot; </span>${dim(figure.alsoCalled)}` : ''}</td>
    <td class="m">${figure.factionId === null ? dim('nobody owns the record') : esc(factionName(figure.factionId))}</td>
    <td class="n">${ago(figure.yearsAgo)}</td>
    <td class="m">${esc(ATTESTATION_WORD[figure.attestation] ?? figure.attestation)}</td>
    <td class="q">${esc(figure.whatTheyWere)}${figure.answers ? ` ${chip(ANSWER_WORD[figure.answers] ?? figure.answers)}` : ''}</td>
  </tr>`).join('');
}

function figureTable(caption: string, list: readonly NamedFigure[]): string {
    return `<div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:20%"><col style="width:18%"><col style="width:12%"><col style="width:20%"><col style="width:30%"></colgroup>
    <caption>${esc(caption)}</caption>
    <thead><tr><th>Name</th><th>Whose record</th><th>When</th><th>Standing of the name</th><th>What they were</th></tr></thead>
    <tbody>${figureRows(list)}</tbody>
  </table></div>`;
}

function namedFiguresSection(): string {
    const answering = IMMORTAL_ANCESTORS.filter(f => f.answers === 'answers');
    const usable = NAMED_FIGURES.filter(f => f.attestation === 'secure').length;
    const asked = HELD_QUESTIONS.filter(q => q.drafts > 0);
    const drafts = HELD_QUESTIONS.reduce((n, q) => n + q.drafts, 0);

    const questions = HELD_QUESTIONS.map(question => `<dt>${esc(factionName(question.factionId))}<span class="rsep"> &middot; </span>${dim(question.heldForYears === 0
        ? 'holds no question'
        : `${num(question.heldForYears)} years, ${question.drafts} draft${question.drafts === 1 ? '' : 's'}`)}</dt>
    <dd>${esc(question.theProblem)}</dd>
    <dt>The wording as it stands</dt>
    <dd>${esc(question.theCurrentWording)}</dd>
    <dt>Why it has not been sent</dt>
    <dd>${esc(question.whyItIsStillNotSent)}</dd>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>The named dead, the named absent and the named enormous</h2><span class="r">${NAMED_FIGURES.length} names &middot; ${usable} an institution could act on &middot; ${answering.length} of ${IMMORTAL_ANCESTORS.length} ancestors answer</span></div>
  <p class="note"><strong>Nobody on this page can be met.</strong> These are people who exist as a name in a record: sworn by, made offerings to, cited in a founding instrument, and never encountered. The roster of people a cultivator can actually walk up to is somewhere else entirely, and the two lists do not overlap by a single entry.</p>
  <p class="note"><strong>The standing of a name is the column that decides anything.</strong> An institution does not ask whether an ancestor was real, it asks whether it can act on the name - swear an oath in it, open a door with it, put it at the head of a claim. A garbled record and a withheld one both come back as no, and the two are completely different problems for whoever has to fix it.</p>
  ${figureTable(`The lines that run upward, and whether anything comes back down them`, IMMORTAL_ANCESTORS)}
  <p class="note"><strong>A line upward is not a conversation.</strong> ${answering.length} of the ${IMMORTAL_ANCESTORS.length} names above answer at all, and an answer is not advice: it is exactly what was asked for, from somebody who will not look up. The houses that have read the channel properly ask less as they learn more, which is the opposite of what a reader expects and is the whole of the material below.</p>
  ${figureTable('Founders, and the people who put the first stone down', FOUNDERS)}
  ${figureTable('The sealed, who are mostly titles to the people standing on them', SEALED_FIGURE_NAMES)}
  ${figureTable('The handful the world argues about', HISTORICAL_FIGURES)}
  <p class="note"><strong>${asked.length} of the ${HELD_QUESTIONS.length} bodies with a channel are holding a question they have not sent</strong>, between them ${num(drafts)} drafts deep. The third is not an oversight: it has read the same evidence and drawn the conclusion that the correct number of questions to ask something that answers exactly is none.</p>
  <dl class="dispute">${questions}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE SEVEN WHO CROSSED AND DID NOT LEAVE
// ─────────────────────────────────────────────────────────────────────────

const PATH_WORD: Readonly<Record<string, string>> = {
    protector: 'stood over something',
    peak: 'went on climbing',
    transmission: 'taught somebody'
};

const END_WORD: Readonly<Record<string, string>> = {
    went_looking: 'went where the answer was and did not come back',
    went_mad: 'the trajectory took them',
    ended_from_above: 'something came down',
    ran_out: 'the span expired',
    unresolved: 'the record stops'
};

const LEGACY_WORD: Readonly<Record<string, string>> = {
    holding: 'the thing they were building still stands',
    finished: 'they finished it',
    failed: 'it did not survive them'
};

const LEGIBLE_WORD: Readonly<Record<string, string>> = {
    fully: 'can be read completely',
    partly: 'part of it can be read',
    not_at_all: 'cannot be read at all',
    unseen: 'nobody has looked at it'
};

function falseImmortalsSection(): string {
    const dated = FALSE_IMMORTALS.filter(f => f.crossedYearsAgo !== null);
    const oldest = dated.length ? Math.max(...dated.map(f => f.crossedYearsAgo ?? 0)) : 0;
    const held = FALSE_IMMORTALS.filter(f => f.office !== null).length;
    const observedStages = MADNESS_STAGES.filter(stage => stage.observed).length;

    const rows = FALSE_IMMORTALS.map(figure => `<tr>
    <td class="nm">${esc(figure.name)}<span class="rsep"> &middot; </span>${dim(figure.calledBy)}</td>
    <td class="n">${ago(figure.crossedYearsAgo)}</td>
    <td class="n">${figure.remainderAtCrossingYears === null
        ? dim('nobody wrote it down')
        : `${num(figure.remainderAtCrossingYears)} years`}</td>
    <td class="m">${esc(PATH_WORD[figure.path] ?? figure.path)}${figure.office
        ? `<span class="rsep"> &middot; </span>${dim(figure.office.factionId === null
            ? 'a house that left no name'
            : factionName(figure.office.factionId))}`
        : ''}</td>
    <td class="m">${esc(END_WORD[figure.end] ?? figure.end)}<span class="rsep"> &middot; </span>${dim(LEGACY_WORD[figure.legacyAtEnd] ?? figure.legacyAtEnd)}</td>
  </tr>`).join('');

    const detail = FALSE_IMMORTALS.map(figure => `<dt>${esc(figure.name)}, and what the years were for</dt>
    <dd>${esc(figure.pathNote)}</dd>
    <dt>${esc(figure.name)}, and how it ended</dt>
    <dd>${esc(figure.endNote)}${figure.whichExitItReallyWas ? ` ${esc(figure.whichExitItReallyWas)}` : ''}</dd>
    <dt>What became of what they were building</dt>
    <dd>${esc(figure.whatBecameOfIt)}</dd>
    <dt>What a person could actually find</dt>
    <dd>${figure.whatSurvives.map(esc).join('. ')}.</dd>`).join('');

    const stages = MADNESS_STAGES.map(stage => `<tr>
    <td class="nm">${esc(stage.name)}</td>
    <td class="n">${num(stage.fromYear)} to ${num(stage.toYear)} <span class="dim">years after</span></td>
    <td class="q">${esc(stage.presentation)}</td>
    <td class="q">${esc(stage.howItReadsFromOutside)}</td>
  </tr>`).join('');

    const departures = DEPARTURE_DESTINATIONS.map(row => `<dt>${esc(row.where)}</dt>
    <dd>${esc(row.whyThere)} <span class="dim">${esc(row.whoWent)}</span></dd>
    <dt>What comes back</dt>
    <dd>${esc(row.whatComesBack)}</dd>`).join('');

    const carvings = LU_SHENG_CARVINGS.map(carving => `<dt>${esc(carving.where)}<span class="rsep"> &middot; </span>${dim(LEGIBLE_WORD[carving.legible] ?? carving.legible)}</dt>
    <dd>${esc(carving.whatItIs)} ${carving.heldByFactionId === null
        ? dim('Nobody is standing over it.')
        : `${esc(factionName(carving.heldByFactionId))} is standing over it and ${carving.holderKnows ? 'knows what it is' : 'does not know what it is'}.`}</dd>
    <dt>What has been built on it</dt>
    <dd>${esc(carving.builtOnIt)}${carving.yieldedTechniqueIds.length
        ? ` ${carving.yieldedTechniqueIds.length} art${carving.yieldedTechniqueIds.length === 1 ? '' : 's'} in the catalog came off this face.`
        : ''}</dd>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Seven who crossed and stayed</h2><span class="r">${FALSE_IMMORTALS.length} records over ${num(oldest)} years &middot; ${held} took an office &middot; none of them is serving now</span></div>
  <p class="note"><strong>A crossing is paid for once, at the boundary, and what is left after it is a span rather than a decline.</strong> The third column is what each of them kept out of the rung's grant, where anybody thought to write it down, and it is not a countdown to weakness. It is how many years they had to spend on whatever they decided the years were for.</p>
  <p class="note"><strong>There is nobody serving.</strong> Every record below is finished. This is worth stating flatly because the shape of the catalog invites the opposite reading: seven protectors, three offices, a house that had one for twenty-three centuries - and not one of them is standing anywhere in this world now.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:22%"><col style="width:13%"><col style="width:13%"><col style="width:24%"><col style="width:28%"></colgroup>
    <caption>The seven &middot; by what the years were spent on, and how the record ends</caption>
    <thead><tr><th>Who</th><th>Crossed</th><th>Years kept</th><th>What the years were for</th><th>The end</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <dl class="dispute">${detail}</dl>
  <p class="note"><strong>The stages are the axis moving, not a person going wrong.</strong> ${observedStages} of the ${MADNESS_STAGES.length} have been watched by somebody whose account survives; the rest are reconstruction. The fourth column is how a house that has one reads it, which is usually wrongly and always in the direction that flatters the house.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:18%"><col style="width:14%"><col style="width:36%"><col style="width:32%"></colgroup>
    <caption>The stages, in order &middot; years since the crossing</caption>
    <thead><tr><th>Stage</th><th>When</th><th>What it looks like across a table</th><th>How a house reads it</th></tr></thead>
    <tbody>${stages}</tbody>
  </table></div>
  <p class="note"><strong>And two of them left rather than ended.</strong> The destinations below are places, not metaphors: ground somebody walked to, with a reason for choosing it and a description of what comes back from it, which in most cases is nothing at all.</p>
  <dl class="dispute">${departures}</dl>
  <p class="note"><strong>${LU_SHENG_CARVINGS.length} faces of cut stone are the residue of teaching rather than a second channel.</strong> A lecture needs a surface, the surface is whatever was there, and nobody took it away afterwards. They are in the ordinary hand of their province and several can be read completely by anybody - which is a worse problem than a hand nobody can read, because a correct reading of a true statement about a world that no longer exists gets built on in perfectly good faith.</p>
  <dl class="dispute">${carvings}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS ASLEEP UNDER A MOUNTAIN
// ─────────────────────────────────────────────────────────────────────────

const AWARENESS_WORD: Readonly<Record<string, string>> = {
    published: 'the holder says so on purpose',
    rumoured: 'circulating and mostly right',
    holder_only: 'the holder knows and nobody else',
    unknown_to_holder: 'it is under somebody who does not know',
    forgotten: 'nobody living knows'
};

const CONDITION_WORD: Readonly<Record<string, string>> = {
    live: 'alive down there',
    degraded: 'still down there and diminished',
    dead: 'dead, and the seal is holding nothing'
};

const SEALED_KIND_WORD: Readonly<Record<string, string>> = {
    terminal: 'a terminal',
    protector: 'a protector',
    unknown: 'nobody has established which'
};

function sealedSection(): string {
    const wrongAboutCondition = HELD_INSTRUMENTS.filter(i => i.holderBelieves !== i.condition);
    const wrongAboutKind = HELD_INSTRUMENTS.filter(i => i.holderBelievesKind !== i.kind);
    const unmaintained = UNOWNED_ANCESTORS.filter(a => !a.sealMaintained).length;

    const instruments = HELD_INSTRUMENTS.map(instrument => `<tr>
    <td class="nm">${esc(instrument.name)}</td>
    <td class="m">${esc(factionName(instrument.holderFactionId))}</td>
    <td class="n">${num(instrument.dormantYears)} <span class="dim">years</span></td>
    <td class="m">${esc(AWARENESS_WORD[instrument.awareness] ?? instrument.awareness)}</td>
    <td class="m">${esc(CONDITION_WORD[instrument.condition] ?? instrument.condition)}${instrument.holderBelieves === instrument.condition
        ? ''
        : ` ${chip('the holder believes otherwise')}`}</td>
    <td class="q">${esc(instrument.wakeCost)}</td>
  </tr>`).join('');

    const instrumentDetail = HELD_INSTRUMENTS.map(instrument => `<dt>${esc(instrument.name)}<span class="rsep"> &middot; </span>${dim(factionName(instrument.holderFactionId))}</dt>
    <dd>${esc(instrument.whoTheyWere)} ${esc(instrument.restingPlace)}</dd>
    <dt>What it is actually being saved against</dt>
    <dd>${esc(instrument.privateContingency)}</dd>
    <dt>${instrument.strategy === 'deterrent_by_publication' ? 'Why they say so' : 'Why they say nothing'}</dt>
    <dd>${esc(instrument.strategyNote)}${instrument.publishedCondition ? ` What is said publicly: ${esc(instrument.publishedCondition)}` : ''}</dd>
    <dt>What is down there, and what the holder thinks is down there</dt>
    <dd>It is ${esc(SEALED_KIND_WORD[instrument.kind] ?? instrument.kind)}, and the holder believes it is ${esc(SEALED_KIND_WORD[instrument.holderBelievesKind] ?? instrument.holderBelievesKind)}. ${esc(instrument.kindNote)} ${esc(instrument.conditionNote)}</dd>`).join('');

    const unowned = UNOWNED_ANCESTORS.map(ancestor => `<dt>${esc(ancestor.name)}<span class="rsep"> &middot; </span>${dim(ancestor.sealMaintained ? 'the seal is maintained' : 'nobody is maintaining the seal')}</dt>
    <dd>${esc(ancestor.whereItIs)} ${esc(ancestor.sealedBy)}${ancestor.sealedFor ? ` Sealed for: ${esc(ancestor.sealedFor)}` : ''}</dd>
    <dt>Who knows</dt>
    <dd>${esc(ancestor.whoKnows)} <span class="dim">${esc(AWARENESS_WORD[ancestor.awareness] ?? ancestor.awareness)}. Last checked: ${esc(ancestor.lastChecked)}</span></dd>
    <dt>What the institutions are worried about</dt>
    <dd>${esc(ancestor.hazard)}</dd>
    <dt>What is actually in there</dt>
    <dd>${esc(ancestor.ifSheWakes)}</dd>
    <dt>And nobody is responsible</dt>
    <dd>${esc(ancestor.nobodyIsResponsible)} ${esc(ancestor.opportunity)}</dd>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>What is asleep under a mountain</h2><span class="r">${HELD_INSTRUMENTS.length} held &middot; ${UNOWNED_ANCESTORS.length} that nobody owns &middot; ${unmaintained} behind a seal nobody maintains</span></div>
  <p class="note"><strong>Old is not the same as dangerous, and in this world it usually is not.</strong> Most of what is asleep here is a person who built something, is diminished now, and on the whole meant well. The ones who are dangerous are dangerous for a written reason - a named grievance, a named appetite - and never merely because they are ancient.</p>
  <p class="note"><strong>The last two columns of the table are the holder's belief and the truth, and they are separate on purpose.</strong> ${wrongAboutCondition.length} ${wrongAboutCondition.length === 1 ? 'house is' : 'houses are'} wrong about the condition of what they are sitting on and ${wrongAboutKind.length} ${wrongAboutKind.length === 1 ? 'is' : 'are'} wrong about what kind of thing it is. A house sworn to a deterrent that is already dead behaves exactly like a house sworn to a live one, right up to the morning it opens the seal.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:15%"><col style="width:16%"><col style="width:9%"><col style="width:17%"><col style="width:17%"><col style="width:26%"></colgroup>
    <caption>Held instruments &middot; and what waking one costs the house that holds it</caption>
    <thead><tr><th>Who</th><th>Held by</th><th>Dormant</th><th>Who knows</th><th>Condition</th><th>What waking it costs</th></tr></thead>
    <tbody>${instruments}</tbody>
  </table></div>
  <dl class="dispute">${instrumentDetail}</dl>
  <p class="note"><strong>And ${UNOWNED_ANCESTORS.length} belong to nobody.</strong> That is the category worth reading twice. A held instrument has a house that has costed the waking and told its seated elders what it means; an unowned one has a hazard, an opportunity, and a list of institutions each of which would decline responsibility in a different well-reasoned way. ${unmaintained ? `${unmaintained} of them sit behind a seal nobody is maintaining.` : ''}</p>
  <dl class="dispute">${unowned}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHY NOTHING AT THE TOP MOVES
// ─────────────────────────────────────────────────────────────────────────

function topOfTheWorldSection(): string {
    const arithmetic = conspiracyArithmetic();
    const joiners = housesThatCouldJoinAConspiracy();
    const weakestHead = arithmetic.apexHeads.length
        ? Math.min(...arithmetic.apexHeads.map(a => a.ordinal))
        : 0;
    const aloneOutrank = arithmetic.housesThatAloneOutrank(weakestHead);
    const needed = arithmetic.housesNeededAgainst(weakestHead);

    const heads = arithmetic.apexHeads
        .slice()
        .sort((a, b) => b.ordinal - a.ordinal)
        .map(head => `<tr><td class="nm">${esc(head.name)}</td><td class="n">${head.ordinal}</td><td class="m">${esc(rankName(head.ordinal))}</td></tr>`)
        .join('');

    const candidates = joiners
        .map(house => `<tr><td class="nm">${esc(house.name)}</td><td class="n">${house.ceiling}</td><td class="m">${esc(rankName(house.ceiling))}</td></tr>`)
        .join('');

    const reasons = Object.values(WHY_NOBODY_MOVES)
        .map(reason => `<dd>${esc(reason)}</dd>`)
        .join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Why nothing at the top of the world moves</h2><span class="r">${arithmetic.apexHeads.length} apex heads &middot; ${joiners.length} houses whose ceiling reaches them &middot; ${needed === Infinity ? 'no combination clears the lowest head' : `${needed} of them clears the lowest head`}</span></div>
  <p class="note"><strong>The map is stable, and the reason is arithmetic rather than peace.</strong> The two tables below are read out of the same catalogs the fighting resolver reads, so the numbers in them are the numbers a war would be fought with. ${aloneOutrank === 0 ? 'No single house holds a ceiling above the lowest apex head.' : `${aloneOutrank} ${aloneOutrank === 1 ? 'house holds a ceiling' : 'houses hold a ceiling'} above the lowest apex head on its own.`}</p>
  <p class="note"><strong>An apex head does not go anywhere, and that is the arrangement rather than arrogance.</strong> An immortal object sent down does not travel, everything the house is rests on it sitting where it was put, and separated the two halves are a theft and a fight. So the strongest person in each house sits on the object and has stopped climbing, which is the price the arrangement charges and it is charged to them personally.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:52%"><col style="width:16%"><col style="width:32%"></colgroup>
    <caption>The apex heads &middot; strongest first</caption>
    <thead><tr><th>House</th><th>Ordinal</th><th>Rung</th></tr></thead>
    <tbody>${heads}</tbody>
  </table></div>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:52%"><col style="width:16%"><col style="width:32%"></colgroup>
    <caption>Houses whose sealed ceiling reaches an apex head &middot; highest ceiling first</caption>
    <thead><tr><th>House</th><th>Ceiling</th><th>Rung</th></tr></thead>
    <tbody>${candidates}</tbody>
  </table></div>
  <p class="note"><strong>The lever exists, is not hidden, and is held at both ends.</strong> What follows is the measured position, one paragraph per finding, and the shape of it is worth stating before reading it: nobody moves because nobody survives the morning after, and the only thing on the board worth more than every object in the region is a grant book.</p>
  <dl class="dispute"><dt>What the resolver says about the top of the world</dt>${reasons}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE TAB
// ─────────────────────────────────────────────────────────────────────────

/**
 * Everything on the History tab that is older than the oldest house.
 *
 * Ordered outward from the reader: the ages, then what is gone, then the
 * arguments about where any of it came from, then the ground they are having
 * the arguments on, then the people, then the seven, then what is under the
 * mountain, and last the arithmetic that keeps all of it where it is.
 */
export function renderDeepPastSections(): string {
    return [
        agesSection(),
        deadCivilisationsSection(),
        originAccountsSection(),
        lidSection(),
        calendarsAndScriptsSection(),
        residueSection(),
        namedFiguresSection(),
        falseImmortalsSection(),
        sealedSection(),
        topOfTheWorldSection()
    ].join('\n');
}
