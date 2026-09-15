/**
 * The Standing Register's People tab, below the people.
 *
 * The tab lists everybody at or above Grand Ascension and says nothing about
 * what a body IS on this ladder: what can be done to one, what nothing can be
 * done about, the rung past which the world stops being able to reach in at
 * all, and the one family in the catalog whose bodies are not entirely human.
 * All four are facts about people, all four were in the catalogs, and none of
 * them was on the sheet.
 *
 * ── THE RUNG THAT JOINS THE THREE SECTIONS ───────────────────────────────
 *
 * `UNTOUCHED_BY_DISASTER_ORDINAL` is the hinge and it is not a rule about
 * disasters. It is a rule about people: past it a body has no seam for an
 * unaimed thing to get into, which is why the wound table thins out at the top,
 * why an apex survives a catastrophe that ends a court outright, and why the
 * bill for every disaster in this world goes downward. The People tab is
 * entirely populated by bodies above that line. The two sections below are what
 * the same world looks like from underneath it.
 */

import { rankName } from '../engine/cultivation/realms.js';
import {
    CATASTROPHE_EXPOSURE,
    DISASTER_RESPONSES,
    UNTOUCHED_BY_DISASTER_ORDINAL,
    WHAT_FALLS_ON_THOSE_BELOW,
    factionsADisasterCouldDestroy
} from '../data/cultivation/catastrophe.js';
import { RETIRED_WOUND_KEYS, WOUND_TYPES } from '../data/cultivation/wounds.js';
import { THE_LINE_AT_OLD_RIVER } from '../data/cultivation/a-family-that-came-down-from-a-changed-beast.js';
import { getBeast } from '../data/cultivation/beasts.js';
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


const dim = (text: string): string => `<span class="dim">${esc(text)}</span>`;

const chip = (text: string): string => `<span class="chip">${esc(text)}</span>`;

// ─────────────────────────────────────────────────────────────────────────
// EVERY WAY A BODY CAN BE HURT
// ─────────────────────────────────────────────────────────────────────────

function woundsSection(): string {
    const permanent = WOUND_TYPES.filter(wound => wound.permanent);
    const mental = WOUND_TYPES.filter(wound => wound.nature === 'mental');
    const untreatable = WOUND_TYPES.filter(wound => /^nothing\b/i.test(wound.treatment));
    const retired = Object.keys(RETIRED_WOUND_KEYS).length;

    const rows = WOUND_TYPES.map(wound => `<tr>
    <td class="nm">${esc(wound.name)}${wound.permanent ? ` ${chip('permanent')}` : ''}</td>
    <td class="m">${esc(wound.nature)}</td>
    <td class="m">${wound.severities.map(esc).join(', ')}</td>
    <td class="q">${esc(wound.description)}</td>
    <td class="q">${esc(wound.treatment)}</td>
  </tr>`).join('');

    const presentation = WOUND_TYPES.map(wound =>
        `<dt>${esc(wound.name)}</dt><dd>${esc(wound.presentation)}</dd>`
    ).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Every way a body can be hurt</h2><span class="r">${WOUND_TYPES.length} wounds &middot; ${permanent.length} nothing closes &middot; ${mental.length} to the mind rather than the flesh</span></div>
  <p class="note"><strong>The last column is the one worth reading, and on ${untreatable.length} of these rows it says nothing.</strong> A permanent wound is not a bad roll: it stays open for the whole of a life, keeps costing, and is deliberately outside the bleeding clock because there is nothing for a clock to run down to. The catalog says so plainly rather than leaving a treatment field politely vague.</p>
  <p class="note"><strong>A wound is a fact and never a description.</strong> Each row is written by the engine and rendered by the narrator, which is why the fourth column reads as it does: it states what happened to the body, and nothing in it decides how bad that is supposed to feel.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:17%"><col style="width:9%"><col style="width:14%"><col style="width:32%"><col style="width:28%"></colgroup>
    <caption>The wound table &middot; roughly in the order they start appearing on the ladder</caption>
    <thead><tr><th>Wound</th><th>Nature</th><th>Sustained at</th><th>What it is</th><th>What answers it</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <p class="note"><strong>And what somebody carrying one is like to meet.</strong> This is the half a reader actually needs, because a wound in this world is mostly encountered in another person: the hand that will not close, the answer that arrives a beat late, the elder who is fine until the third hour of a conversation.</p>
  <dl class="dispute">${presentation}</dl>
  ${retired
      ? `<p class="note">${retired} older wound keys are kept as redirects rather than deleted. A saved cultivator carrying a retired key still resolves, which is the only reason the rows exist; nothing new is ever written with one.</p>`
      : ''}
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A DISASTER CAN END
// ─────────────────────────────────────────────────────────────────────────

const OUTCOME_WORD: Readonly<Record<string, string>> = {
    destroyed: 'gone, and the name survives in somebody else\'s tally book',
    broken: 'the institution stops working; the people and the claim do not',
    reduced_to_its_head: 'everything but the person at the top'
};

function catastropheSection(): string {
    const removable = factionsADisasterCouldDestroy();
    const byTier = new Map<string, number>();
    for (const body of removable) byTier.set(body.tier, (byTier.get(body.tier) ?? 0) + 1);

    const exposure = CATASTROPHE_EXPOSURE.map(row => `<tr>
    <td class="nm">${esc(row.tier)}</td>
    <td class="m">${esc(OUTCOME_WORD[row.worstCase] ?? row.worstCase)}</td>
    <td class="q">${esc(row.reason)}</td>
  </tr>`).join('');

    const responses = DISASTER_RESPONSES.map(posture => `<dt>${esc(posture.response)}</dt>
    <dd>${esc(posture.when)}</dd>
    <dt>And what it costs the house that does it</dt>
    <dd>${esc(posture.cost)}</dd>`).join('');

    const downward = Object.entries(WHAT_FALLS_ON_THOSE_BELOW)
        .map(([, text]) => `<dd>${esc(text)}</dd>`)
        .join('');

    const bodies = removable
        .map(body => `<tr><td class="nm">${esc(factionName(body.id))}</td><td class="m">${esc(body.tier)}</td></tr>`)
        .join('');

    return `<section class="startfolded">
  <div class="sh"><h2>What a disaster can end</h2><span class="r">${removable.length} bodies could be removed from the world outright &middot; nothing unaimed reaches ordinal ${UNTOUCHED_BY_DISASTER_ORDINAL} or above</span></div>
  <p class="note"><strong>Past ordinal ${UNTOUCHED_BY_DISASTER_ORDINAL} a person cannot be killed by anything that was not aimed at them.</strong> That is a fact about bodies rather than about weather, and it is the whole of the table below: a sect is its ground and two hundred people and can be erased by a bad season; an apex is a person and a reputation, and the person walks out. ${esc(rankName(UNTOUCHED_BY_DISASTER_ORDINAL))} is where a body stops having a seam for the world to get into.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:10%"><col style="width:26%"><col style="width:64%"></colgroup>
    <caption>The worst a catastrophe can do &middot; by what kind of body it is</caption>
    <thead><tr><th>Tier</th><th>Worst case</th><th>Why it survives what it survives</th></tr></thead>
    <tbody>${exposure}</tbody>
  </table></div>
  <p class="note"><strong>And the neighbours answer in one of three ways, none of which is free.</strong> Watching is the commonest and it is a decision rather than the absence of one: a house with no claim on the ground sends a delegation, records what it sees, and files it, which is exactly how the top of the world learns what everybody else can do in a bad year.</p>
  <dl class="dispute">${responses}</dl>
  <p class="note"><strong>The bill goes downward, and that is the part the arithmetic never mentions.</strong> A client sect does not experience a succession crisis; it experiences its patron ceasing to answer letters. What follows below is the ordinary shape of it, and the last paragraph is the asymmetry stated plainly, because it is what a player is actually standing in.</p>
  <dl class="dispute"><dt>What a disaster does to the people underneath it</dt>${downward}</dl>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:70%"><col style="width:30%"></colgroup>
    <caption>${removable.length} bodies a catastrophe could take off the map &middot; ${[...byTier.entries()].map(([tier, n]) => `${n} ${tier}${n === 1 ? '' : 's'}`).join(' &middot; ')}</caption>
    <thead><tr><th>Body</th><th>Tier</th></tr></thead>
    <tbody>${bodies}</tbody>
  </table></div>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ONE LINE THAT CAME DOWN FROM SOMETHING THAT CHANGED
// ─────────────────────────────────────────────────────────────────────────

function theChangedLineSection(): string {
    const line = THE_LINE_AT_OLD_RIVER;
    const beast = getBeast(line.speciesId);
    const carrying = line.people.filter(person => person.tier !== null);
    const oldest = line.people.reduce((a, b) => (a.ageYears >= b.ageYears ? a : b));

    const rows = line.people
        .slice()
        .sort((a, b) => b.ageYears - a.ageYears)
        .map(person => `<tr>
    <td class="nm">${esc(`${person.given} ${line.surname}`)}</td>
    <td class="n">${person.ageYears} <span class="dim">years</span></td>
    <td class="m">${person.ordinal === null ? dim('whatever their own talent gave them') : `${person.ordinal} ${esc(rankName(person.ordinal))}`}</td>
    <td class="m">${person.tier === null ? dim('it has gone out of them') : esc(person.tier)}</td>
    <td class="q">${esc(person.note)}</td>
  </tr>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>The one family that came down from something that changed</h2><span class="r">${line.people.length} people at ${esc(line.place)} &middot; ${carrying.length} still carry it &middot; ${esc(factionName(line.regionId))}</span></div>
  <p class="note"><strong>One family, in one village, and nothing else in the world like it.</strong> ${beast ? `The ancestor was ${esc(beast.name)} and changed;` : 'The ancestor was a beast that changed;'} what the line does is read off that species like anybody else's inheritance, and there is no rule anywhere that applies to the ${esc(line.surname)} family and to nobody else. Take the ancestry away and every person below prices out as an ordinary cultivator of their province.</p>
  <p class="note"><strong>An origin buys inputs and never rank.</strong> Only ${esc(oldest.given)} has an authored rung, because standing at it is what being the thing means; everybody else went through the same derivation the rest of the world goes through and got whatever it gave them. The line thins as it descends, which is why the fourth column empties out down the table, and the ancestor has outlived most of their own descendants, which is a large part of why it thins at all.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:16%"><col style="width:10%"><col style="width:18%"><col style="width:12%"><col style="width:44%"></colgroup>
    <caption>The line at ${esc(line.place)} &middot; oldest first</caption>
    <thead><tr><th>Who</th><th>Age</th><th>Rung</th><th>What is left in them</th><th>At human scale</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE SECTIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a body is on this ladder, under the list of the people at the top of it.
 */
export function renderWhatHappensToABodySections(): string {
    return [
        woundsSection(),
        catastropheSection(),
        theChangedLineSection()
    ].join('\n');
}
