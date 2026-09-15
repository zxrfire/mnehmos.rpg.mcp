/**
 * The Standing Register's sections about what a body is DOING, as against what
 * it is and what it holds.
 *
 * Four questions, four tabs, one module, because they are the same question
 * asked at four ranges and the shape of the answer does not change: a house has
 * a door, errands, goods that leave it, and at most one plan it is keeping for
 * a day that has not come.
 *
 *   Factions   which floor of a house a person actually comes in at, and why
 *              a house puts people on the road at all
 *   Holdings   what comes out of a house's workshops, and what crosses water
 *              rather than road, and who will hold a thing for the dead
 *   Ties       the one recorded plan held against another body
 *   Below      what everybody says about all of it, and where that is wrong
 *
 * ── THE RULE THEY ARE ALL WRITTEN UNDER ──────────────────────────────────
 *
 * Nothing here decides anything. A sending reason is a field and no engine
 * branch reads which one it is; a floor is derived from what the house already
 * says about itself; a contingency fires on nothing and never has. Printing
 * them beside each other is worth doing precisely because none of them is a
 * mechanism - they are what a house would tell you it was for, and the sheet's
 * whole job is to put that next to what it actually does.
 */

import { SECTS } from '../data/cultivation/sects.js';
import { rankName } from '../engine/cultivation/realms.js';
import { commitDayOf } from '../engine/world/what-a-sea-crossing-costs.js';
import {
    A_HOUSE_THAT_TAKES_ONE_SEX,
    houseFloorsOf,
    groundReachOf
} from '../data/cultivation/the-three-floors-a-house-admits-at.js';
import { SENDING_REASONS } from '../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import {
    CONTINGENCIES,
    OTHERS_WHO_NOTICED
} from '../data/cultivation/contingencies.js';
import {
    HOUSE_ARTISANS,
    SEA_CARGO,
    SEA_LANES,
    SEA_TRADERS
} from '../data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';
import { CUSTODY_TAKERS } from '../data/cultivation/institutions-that-hold-deposits-for-the-dead.js';
import {
    RUMOURS,
    WRONG_ACCURACIES,
    shareOfRumoursThatAreWrong
} from '../data/cultivation/rumours-and-what-they-get-wrong.js';
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


const num = (value: number): string => value.toLocaleString('en-US');

const dim = (text: string): string => `<span class="dim">${esc(text)}</span>`;

const chip = (text: string): string => `<span class="chip">${esc(text)}</span>`;

const plainly = (token: string): string => token.replace(/_/g, ' ');

// ─────────────────────────────────────────────────────────────────────────
// THE THREE FLOORS A HOUSE ADMITS AT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Every body whose floors can be read, which is every body in the sect
 * catalog that has a door at all.
 */
function floorRows(): {
    id: string;
    name: string;
    guest: number | null;
    servant: number | null;
    disciple: number;
    hasMenialTier: boolean;
    reach: number | undefined;
}[] {
    return SECTS
        .map(sect => ({ sect, floors: houseFloorsOf(sect.id) }))
        .filter((row): row is { sect: typeof SECTS[number]; floors: NonNullable<ReturnType<typeof houseFloorsOf>> } =>
            row.floors !== undefined)
        .map(({ sect, floors }) => ({
            id: sect.id,
            name: sect.name,
            guest: floors.guest,
            servant: floors.servant,
            disciple: floors.disciple,
            hasMenialTier: floors.hasMenialTier,
            reach: groundReachOf(sect.id)
        }));
}

function floorsSection(): string {
    const rows = floorRows();
    const withMenial = rows.filter(row => row.hasMenialTier);
    const withGuest = rows.filter(row => row.guest !== null);
    const closed = Object.keys(A_HOUSE_THAT_TAKES_ONE_SEX);

    const table = rows
        .slice()
        .sort((a, b) => a.disciple - b.disciple || a.name.localeCompare(b.name))
        .map(row => `<tr>
    <td class="nm">${esc(row.name)}${row.id in A_HOUSE_THAT_TAKES_ONE_SEX
        ? ` ${chip(`takes ${A_HOUSE_THAT_TAKES_ONE_SEX[row.id]}`)}`
        : ''}</td>
    <td class="n">${row.guest === null ? dim('no such door') : `${row.guest} ${esc(rankName(row.guest))}`}</td>
    <td class="n">${row.servant === null ? dim('nothing below the track') : `${row.servant} ${esc(rankName(row.servant))}`}</td>
    <td class="n">${row.disciple} <span class="dim">${esc(rankName(row.disciple))}</span></td>
    <td class="n">${row.reach === undefined ? dim('nothing prices it') : `${row.reach} ${esc(rankName(row.reach))}`}</td>
  </tr>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Which floor of a house a person comes in at</h2><span class="r">${rows.length} bodies with a door &middot; ${withMenial.length} have something below the disciple track &middot; ${withGuest.length} take a guest</span></div>
  <p class="note"><strong>A house has up to three doors and a reader who knows only the third has been told the wrong thing.</strong> The disciple bar is the number every other tab prints, and it is the highest of the three: ${withMenial.length} of the ${rows.length} take people onto a menial tier a long way underneath it, and ${withGuest.length} will house somebody without taking them on at all. Somebody refused at the gate has usually been refused at one of three gates.</p>
  <p class="note"><strong>The last column is what the ground reaches</strong>, and it is what the servant bar is priced against rather than the other way round: a menial tier sits a fixed distance below what a house's ground reliably produces, so a house on rich ground with a modest roll still takes servants high. Every figure here is read off what the house already says about itself, and nothing in this table is authored.</p>
  ${closed.length
      ? `<p class="note"><strong>${closed.length} bodies take one sex only</strong>, and both are Courts whose whole measure of standing is who they have taken and kept. That is a door being shut rather than a preference, and it is marked on the row so a reader is not left working it out from a roster.</p>`
      : ''}
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:36%"><col style="width:16%"><col style="width:16%"><col style="width:16%"><col style="width:16%"></colgroup>
    <caption>The floors &middot; by the disciple bar, lowest first</caption>
    <thead><tr><th>House</th><th>Guest</th><th>Servant</th><th>Disciple</th><th>What the ground reaches</th></tr></thead>
    <tbody>${table}</tbody>
  </table></div>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHY A HOUSE PUTS A PARTY ON THE ROAD
// ─────────────────────────────────────────────────────────────────────────

const AT_STAKE_WORD: Readonly<Record<string, string>> = {
    nothing_but_the_party: 'only the party',
    stones: 'what was carried or was to be fetched',
    standing_with_a_house: 'a watching house now knows something',
    the_ground_itself: 'the ground stops being cover',
    the_grant: 'the grant, which somebody will renegotiate'
};

function sendingsSection(): string {
    const unconditional = SENDING_REASONS.filter(reason => reason.needs === 'nothing');
    const capped = SENDING_REASONS.filter(reason => reason.ceilingOrdinal !== null);
    const longest = SENDING_REASONS.reduce((a, b) => (a.days >= b.days ? a : b));

    const rows = SENDING_REASONS
        .slice()
        .sort((a, b) => b.weight - a.weight)
        .map(reason => `<tr>
    <td class="nm">${esc(reason.name)}</td>
    <td class="q">${esc(reason.what)}</td>
    <td class="m">${reason.needs === 'nothing'
        ? dim('any standing house')
        : esc(plainly(reason.needs))}</td>
    <td class="n">${reason.hands} <span class="dim">for ${reason.days} days</span></td>
    <td class="n">${reason.ceilingOrdinal === null
        ? dim('anybody')
        : `not above ${reason.ceilingOrdinal}`}</td>
    <td class="m">${esc(AT_STAKE_WORD[reason.atStake] ?? plainly(reason.atStake))}</td>
  </tr>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Why a house puts a party on the road</h2><span class="r">${SENDING_REASONS.length} reasons &middot; ${unconditional.length} any house can have &middot; the longest is ${longest.days} days</span></div>
  <p class="note"><strong>The reason is a field, and nothing in the engine branches on which one it is.</strong> An errand is a party, a destination, a number of days, a rung band it is survivable at and a thing that happens to the house if it goes wrong. What makes this column worth printing is the third one: a reason is only open to a house that already has the thing it needs, so a house with no ground never has a ground errand and no code anywhere had to ask whether it did.</p>
  <p class="note"><strong>${capped.length} of them are capped, which is a statement about who gets sent rather than about difficulty.</strong> A house does not put its strongest person on an errand that anybody could do, and the ceiling is how the catalog says so without a rule about seniority. The last column is what the house loses if nobody comes back, and on most rows it is only the party.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:16%"><col style="width:32%"><col style="width:16%"><col style="width:12%"><col style="width:10%"><col style="width:14%"></colgroup>
    <caption>The errands &middot; commonest first</caption>
    <thead><tr><th>Errand</th><th>What the party is for</th><th>Open to a house with</th><th>Hands</th><th>Ceiling</th><th>At stake</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// A PLAN WAITING ON SOMETHING THAT HAS NOT HAPPENED
// ─────────────────────────────────────────────────────────────────────────

const DIVERGENCE_WORD: Readonly<Record<string, string>> = {
    matches: 'the patron has it right',
    patron_overcounts: 'the patron is counting on somebody who would not come',
    patron_undercounts: 'the patron does not know what it has',
    unknowable: 'nobody could establish it either way'
};

function contingenciesSection(): string {
    const entries = CONTINGENCIES.map(plan => {
        const wrong = plan.alliedHolders.filter(holder => holder.divergence !== 'matches');
        return `<dt>${esc(factionName(plan.heldBy))}<span class="rsep"> &middot; </span>${dim(`against ${factionName(plan.targetFactionId)}`)}${plan.namesTheTarget ? '' : ` ${chip('the target is not named in its own records')}`}</dt>
    <dd>${esc(plan.instrument)}</dd>
    <dt>What it waits on</dt>
    <dd>${esc(plan.trigger)}</dd>
    <dt>Why this prize rather than the obvious one</dt>
    <dd>${esc(plan.theArithmetic)} ${esc(plan.whyThisPrize)}</dd>
    <dt>Why the target is actually safe</dt>
    <dd>${esc(plan.theRealDefence)}</dd>
    <dt>The flaw at the centre of it</dt>
    <dd>${esc(plan.askingIsWaking)}</dd>
    <dt>What the holder would say it is for</dt>
    <dd>${esc(plan.inTheirWords)}</dd>
    <dt>Who the plan counts on, and whether it is right to</dt>
    <dd>${plan.alliedHolders.map(holder =>
        `${esc(factionName(holder.factionId))}: ${esc(DIVERGENCE_WORD[holder.divergence] ?? plainly(holder.divergence))}. ${esc(holder.holds)}`
    ).join(' ')} ${wrong.length
        ? `On ${wrong.length} of the ${plan.alliedHolders.length} the plan and the world do not agree, which is where a thing like this breaks.`
        : ''}</dd>`;
    }).join('');

    const noticed = OTHERS_WHO_NOTICED.map(party => `<dt>${esc(factionName(party.factionId))}</dt>
    <dd>${esc(party.whatTheyHave)}</dd>
    <dt>What they have not got</dt>
    <dd>${esc(party.whatTheyLack)}</dd>
    <dt>What they do with it</dt>
    <dd>${esc(party.whatTheyDoWithIt)}</dd>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Plans held against a day that has not come</h2><span class="r">${CONTINGENCIES.length} recorded &middot; ${OTHERS_WHO_NOTICED.length} other parties have noticed something and can do nothing</span></div>
  <p class="note"><strong>Nothing here is scheduled and nothing here fires on its own.</strong> A contingency is the same kind of object as a wake condition: a party, an instrument, a trigger, and a great deal of waiting. It has never happened, the event it waits on has never happened, and the entry is on this tab because a plan one body holds against another is a tie in every sense except the one the tie table can hold.</p>
  <p class="note"><strong>The interesting column is who the plan counts on.</strong> A plan is only as good as the holder's beliefs about everybody else's, and the catalog records where those diverge rather than assuming a competent conspirator: a patron counting on somebody who would not actually come is not a flaw in the writing, it is the thing the entry is about.</p>
  <dl class="dispute">${entries}</dl>
  <p class="note"><strong>And ${OTHERS_WHO_NOTICED.length} parties have seen a piece of it and can do nothing at all.</strong> One of them prices it and has never told its own council why; the other repeats it in inns as a grumble, which makes a body with no ground and no interest the most likely route by which anybody ever hears a true and load-bearing fact about the top of the world.</p>
  <dl class="dispute">${noticed}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT COMES OUT OF A HOUSE, AND WHAT CROSSES WATER
// ─────────────────────────────────────────────────────────────────────────

function craftAndWaterSection(): string {
    const openAllYear = SEA_LANES.filter(lane => lane.openMonthsPerYear >= 12);
    const nowhereToStop = SEA_LANES.filter(lane => lane.intermediateLandfallDays.length === 0);
    const carriers = new Set(SEA_CARGO.map(cargo => cargo.carriedByFactionId));

    const artisans = HOUSE_ARTISANS.map(house => `<dt>${esc(factionName(house.factionId))}<span class="rsep"> &middot; </span>${dim(house.craft)}</dt>
    <dd>${esc(house.whoTheyAre)}</dd>
    <dt>What comes out</dt>
    <dd>${house.makes.map(esc).join('. ')}.</dd>
    <dt>What it cannot make, which is what creates the trade</dt>
    <dd>${esc(house.cannotMake)} ${esc(house.soldOutside)}</dd>`).join('');

    const lanes = SEA_LANES.map(lane => `<tr>
    <td class="nm">${esc(lane.fromPlace)}<span class="rsep"> to </span>${esc(lane.toPlace)}</td>
    <td class="n">${lane.expectedDays} <span class="dim">days</span></td>
    <td class="n">${lane.openMonthsPerYear} <span class="dim">months a year</span></td>
    <td class="m">${lane.intermediateLandfallDays.length === 0
        ? 'nowhere to stop'
        : `${lane.intermediateLandfallDays.length} landfall${lane.intermediateLandfallDays.length === 1 ? '' : 's'}, at day ${lane.intermediateLandfallDays.join(' and ')}`}</td>
    <td class="n">day ${commitDayOf(lane).toFixed(1)}</td>
    <td class="n">${lane.weatherSeverity === 1
        ? dim('ordinary weather')
        : `${lane.weatherSeverity.toFixed(1)} times the storm chance`}</td>
  </tr>`).join('');

    const cargo = SEA_CARGO.map(item => `<tr>
    <td class="nm">${esc(item.what)}</td>
    <td class="m">${item.madeByFactionId === null ? dim('what the ground gives') : esc(factionName(item.madeByFactionId))}</td>
    <td class="m">${esc(factionName(item.carriedByFactionId))}</td>
    <td class="q">${esc(item.boughtBy)}</td>
    <td class="q">${esc(item.whyByWater)}</td>
  </tr>`).join('');

    const traders = SEA_TRADERS.map(trader => `<dt>${esc(factionName(trader.factionId))}</dt>
    <dd>${esc(trader.whatKindOfOperator)}</dd>
    <dt>Where it will not go</dt>
    <dd>${esc(trader.whereItWillNotGo)}</dd>
    <dt>How it is paid</dt>
    <dd>${esc(trader.howItIsPaid)}</dd>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>What a house makes, and what crosses the water</h2><span class="r">${HOUSE_ARTISANS.length} written crafts &middot; ${SEA_LANES.length} lanes &middot; ${SEA_CARGO.length} cargoes &middot; ${carriers.size} bodies carrying them</span></div>
  <p class="note"><strong>A house that made everything would ship nothing.</strong> Which is why the third line of every craft entry is what the house cannot make: the trade exists in the gap, and a reader looking for why two houses that dislike each other keep a lane open will find the answer there rather than in the relationship. Houses without a written craft are not missing from the catalog - they make whatever their province makes, which is read off the ground.</p>
  <p class="note"><strong>A lane is not a road with water on it.</strong> It has months it is worked at all, a storm multiplier, and a commit day past which turning back is no shorter than going on - and ${nowhereToStop.length} of the ${SEA_LANES.length} have nowhere to stop in the middle, which is what makes them frightening rather than merely long. ${openAllYear.length ? `${openAllYear.length} of them are worked all year.` : 'None of them is worked all year.'}</p>
  <dl class="dispute">${artisans}</dl>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:26%"><col style="width:12%"><col style="width:16%"><col style="width:22%"><col style="width:12%"><col style="width:12%"></colgroup>
    <caption>The lanes &middot; what a shipmaster quotes in an open season</caption>
    <thead><tr><th>Lane</th><th>Crossing</th><th>Open</th><th>Anywhere to stop</th><th>Commit</th><th>Weather</th></tr></thead>
    <tbody>${lanes}</tbody>
  </table></div>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:18%"><col style="width:16%"><col style="width:16%"><col style="width:26%"><col style="width:24%"></colgroup>
    <caption>What is actually on the water</caption>
    <thead><tr><th>Cargo</th><th>Made by</th><th>Carried by</th><th>Wanted at the far end by</th><th>Why not the road</th></tr></thead>
    <tbody>${cargo}</tbody>
  </table></div>
  <p class="note"><strong>Nobody in this world is a shipping company.</strong> Every body below is something else that happens to work water, and each of them has a line it will not cross that is a position rather than a limitation - a ferryman who cannot see both banks is a passenger, and a network is a party, and a party has enemies.</p>
  <dl class="dispute">${traders}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHO WILL HOLD A THING FOR SOMEBODY WHO IS NOT COMING BACK
// ─────────────────────────────────────────────────────────────────────────

const LAPSE_WORD: Readonly<Record<string, string>> = {
    absorbed_and_recorded: 'the house keeps it and the book still says what was there',
    absorbed_and_struck: 'the house keeps it and the entry is struck',
    published: 'the entry is published and the goods are still there'
};

function custodySection(): string {
    const withABook = CUSTODY_TAKERS.filter(terms => terms.keepsWrittenRecord);
    const dearest = CUSTODY_TAKERS.reduce((a, b) => (a.annualFeeStones >= b.annualFeeStones ? a : b));
    const longest = CUSTODY_TAKERS.reduce((a, b) => (a.minimumTermYears >= b.minimumTermYears ? a : b));

    const rows = CUSTODY_TAKERS
        .slice()
        .sort((a, b) => a.annualFeeStones - b.annualFeeStones)
        .map(terms => `<tr>
    <td class="nm">${esc(factionName(terms.factionId))}</td>
    <td class="n">${num(terms.annualFeeStones)} <span class="dim">stones a year</span></td>
    <td class="n">${terms.minimumTermYears} <span class="dim">years minimum</span></td>
    <td class="n">${terms.attemptsAllowed}</td>
    <td class="m">${terms.keepsWrittenRecord ? 'there is a book' : dim('no book')}</td>
    <td class="m">${esc(LAPSE_WORD[terms.lapse] ?? plainly(terms.lapse))}</td>
  </tr>`).join('');

    const detail = CUSTODY_TAKERS.map(terms => `<dt>${esc(factionName(terms.factionId))}<span class="rsep"> &middot; </span>${dim(terms.derivedFrom)}</dt>
    <dd>${esc(terms.counterLine)}</dd>
    <dt>What a claimant with the wrong phrase is told</dt>
    <dd>${esc(terms.hintOnFailure)}</dd>
    <dt>What this house will not do</dt>
    <dd>${esc(terms.whatTheyWillNotDo)}</dd>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Who will hold a thing for somebody who is not coming back</h2><span class="r">${CUSTODY_TAKERS.length} houses &middot; ${withABook.length} keep a written record &middot; ${num(dearest.annualFeeStones)} stones a year at the dearest</span></div>
  <p class="note"><strong>Not one of these is a new body.</strong> Every house below already advertises custody of something that outlives the party who lodged it, and the second line of each entry is the exact phrase in its own catalog entry that the terms were read off. A reader can check the derivation rather than take it.</p>
  <p class="note"><strong>Whether there is a book decides whether a claim survives the people who took it.</strong> A house that keeps one can count wrong attempts and does; a house that does not cannot tell a second try from a first, which makes the loose operations generous at the counter and dangerous everywhere else. The shortest term anybody will write is ${Math.min(...CUSTODY_TAKERS.map(t => t.minimumTermYears))} years and the longest minimum is ${longest.minimumTermYears}, because nobody lodges anything for a season.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:24%"><col style="width:14%"><col style="width:14%"><col style="width:10%"><col style="width:14%"><col style="width:24%"></colgroup>
    <caption>Custody terms &middot; cheapest first</caption>
    <thead><tr><th>House</th><th>Fee</th><th>Term</th><th>Tries</th><th>Record</th><th>If nobody comes</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <dl class="dispute">${detail}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT EVERYBODY SAYS, AND WHERE IT IS WRONG
// ─────────────────────────────────────────────────────────────────────────

const ACCURACY_WORD: Readonly<Record<string, string>> = {
    true: 'right',
    true_and_wrong_about_why: 'right about the fact and wrong about the reason',
    garbled: 'right about something and wrong about what it names',
    stale: 'was right once',
    invented: 'was never true',
    unresolved: 'nobody can say'
};

function rumoursSection(): string {
    // WHICH ACCURACIES COUNT AS WRONG IS THE CATALOG'S OWN ANSWER. A second
    // definition here would disagree with it the first time a value is added,
    // and `unresolved` is the row that makes the difference: nobody can say is
    // not the same as false, and a sheet that counted it as one would report
    // the world as more mistaken than it is.
    const wrong = RUMOURS.filter(rumour => WRONG_ACCURACIES.includes(rumour.accuracy));
    const aboutNothing = RUMOURS.filter(rumour => rumour.aboutId === null);
    const share = Math.round(shareOfRumoursThatAreWrong() * 100);

    const rows = RUMOURS
        .slice()
        .sort((a, b) => a.floorOrdinal - b.floorOrdinal)
        .map(rumour => `<tr>
    <td class="q">${esc(rumour.saying)}</td>
    <td class="m">${esc(rumour.saidBy)}</td>
    <td class="m">${rumour.aboutName === null ? dim('nothing anybody could name') : esc(rumour.aboutName)}</td>
    <td class="m">${esc(ACCURACY_WORD[rumour.accuracy] ?? plainly(rumour.accuracy))}</td>
    <td class="q">${esc(rumour.consequence)}</td>
  </tr>`).join('');

    const truth = RUMOURS.map(rumour =>
        `<dt>${esc(rumour.saying)}</dt><dd>${esc(rumour.underneath)}</dd>`
    ).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>What everybody says, and where it is wrong</h2><span class="r">${RUMOURS.length} sayings &middot; ${wrong.length} of them carry something false &middot; ${aboutNothing.length} about nothing anybody could name</span></div>
  <p class="note"><strong>Hearsay is how a player learns this world, which makes it the only education on offer.</strong> Nothing may be named to somebody who has no knowledge of it, so the whole burden of finding out falls on other people's mouths - and other people are wrong ${share} per cent of the time. The saying in the first column is the only field a player is ever given.</p>
  <p class="note"><strong>A saying with no consequence is atmosphere, and none of these is atmosphere.</strong> The last column is what people actually do because they believe it, which is the part that reaches the world: a false belief that costs somebody a season is doing more work than a true one nobody acts on.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:30%"><col style="width:14%"><col style="width:14%"><col style="width:14%"><col style="width:28%"></colgroup>
    <caption>What is said &middot; from the standing it enters a person's vocabulary at</caption>
    <thead><tr><th>The saying</th><th>Said by</th><th>About</th><th>How right</th><th>What people do about it</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <p class="note"><strong>And what is actually the case, which nobody in the world is told.</strong> The column below exists so the setting can be checked against itself; it is never narrated, and a player who has just been given one of the sayings above is not told which of these they got.</p>
  <dl class="dispute">${truth}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE SECTIONS, BY THE TAB EACH ONE ANSWERS FOR
// ─────────────────────────────────────────────────────────────────────────

/** Factions: the doors into a house, and the errands that come out of it. */
export function renderHouseDoorsAndErrandsSections(): string {
    return [floorsSection(), sendingsSection()].join('\n');
}

/** Ties: one body's standing plan against another, and who else has noticed. */
export function renderContingenciesSection(): string {
    return contingenciesSection();
}

/** Holdings: what comes out of the workshops, crosses the water, or is lodged. */
export function renderCraftAndCustodySections(): string {
    return [craftAndWaterSection(), custodySection()].join('\n');
}

/** Below: what is said about all of it by people who cannot check. */
export function renderRumoursSection(): string {
    return rumoursSection();
}
