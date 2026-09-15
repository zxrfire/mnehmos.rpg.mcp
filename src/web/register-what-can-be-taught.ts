/**
 * The Standing Register's Teaching tab, beyond the shelf.
 *
 * WHAT THE TAB HAD AND WHAT IT DID NOT. "What each house teaches" is the shelf,
 * art by art, house by house - which answers what a body will hand you and none
 * of the questions a person actually arrives with. Where is a road taught that
 * is not the one my house walks. Which houses are organised around an idea
 * rather than a technique list, and what do they disagree about. Who can carry
 * somebody all the way to the top of the ladder, and how many hours of them
 * exist. Which arts are held by a PERSON rather than a shelf, so that the only
 * way to them is to want what that person wants.
 *
 * All four were in the catalogs and none was on the sheet.
 *
 * ── THE ONE THING WORTH NOTICING ACROSS THESE SECTIONS ───────────────────
 *
 * Capacity, not possession. This sheet is elsewhere a register of what bodies
 * HOLD, and holding is the wrong measure for teaching: two houses with
 * identical shelves produce entirely different numbers of high cultivators,
 * because what carries somebody up is hours out of a person who has stood where
 * the book ends. So every table here prints the person and what is left of
 * them, and the deep-road table prints the honest answer next to the count -
 * which on three of the four rows is less than one.
 */

import {
    DAO_HOUSES,
    DAO_HOUSE_DISPUTES,
    DESTROYED_DAO_HOUSES,
    FOSTERAGE_TERMS
} from '../data/cultivation/sects.js';
import { rankName } from '../engine/cultivation/realms.js';
import { getMember } from '../data/cultivation/members.js';
import { LIVING_TRANSMISSIONS, getTechnique } from '../data/cultivation/techniques.js';
import { THE_DEEPEST_ROADS } from '../data/cultivation/roads-to-the-top-of-the-ladder.js';
import { PLACES_THAT_TEACH_A_DAO } from '../data/cultivation/places-that-teach-a-dao.js';
import {
    CROSS_TRADITION_ERRORS,
    TRADITIONS
} from '../data/cultivation/traditions.js';
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

const artName = (id: string): string => getTechnique(id)?.name ?? id;

// ─────────────────────────────────────────────────────────────────────────
// TWO TRADITIONS, ONE LADDER
// ─────────────────────────────────────────────────────────────────────────

function traditionsSection(): string {
    const rows = TRADITIONS.map(tradition => `<tr>
    <td class="nm">${esc(tradition.name)}<span class="rsep"> &middot; </span>${dim(factionName(tradition.seatRegionId))}</td>
    <td class="q">${esc(tradition.method)}</td>
    <td class="m">${tradition.bottleneckOrdinals.length
        ? tradition.bottleneckOrdinals.map(ordinal => `${ordinal} ${esc(rankName(ordinal))}`).join(', ')
        : dim('none of its own')}</td>
    <td class="n">${tradition.deviationRiskModifier === 0
        ? dim('no change')
        : `${tradition.deviationRiskModifier > 0 ? '+' : ''}${(tradition.deviationRiskModifier * 100).toFixed(0)} per cent`}</td>
  </tr>`).join('');

    const detail = TRADITIONS.map(tradition => `<dt>${esc(tradition.name)}<span class="rsep"> &middot; </span>${dim(`called ${tradition.exonym} by the other`)}</dt>
    <dd>Its own people call themselves ${esc(tradition.endonym)}. ${esc(tradition.costNote)}</dd>
    <dt>How one is spotted across a room</dt>
    <dd>${tradition.recognition.map(esc).join('. ')}.</dd>
    <dt>As a fighting proposition</dt>
    <dd>Strong at: ${tradition.strengths.map(esc).join('; ')}. Weak at: ${tradition.weaknesses.map(esc).join('; ')}.</dd>
    <dt>What it teaches about the other</dt>
    <dd>${esc(tradition.saysOfTheOther)}</dd>`).join('');

    const errors = CROSS_TRADITION_ERRORS.map(error => `<dt>${esc(factionName(error.heldBy))}<span class="rsep"> &middot; </span>${dim('believes')}</dt>
    <dd>${esc(error.belief)}</dd>
    <dt>What is actually the case</dt>
    <dd>${esc(error.truth)}</dd>
    <dt>What the mistake has cost</dt>
    <dd>${esc(error.consequence)}</dd>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Two traditions, one ladder</h2><span class="r">${TRADITIONS.length} roads &middot; the same rungs &middot; ${CROSS_TRADITION_ERRORS.length} beliefs each holds about the other that are wrong</span></div>
  <p class="note"><strong>There is no second scale anywhere in this world.</strong> Both traditions climb the same rungs, and a fourth-realm practitioner of either is a fourth-realm practitioner. What differs is the road: where the bottlenecks fall, what deviation costs, what a body can be made to do, and what happens at the end of a life. Anybody reading the table below as two power levels has read it backwards.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:22%"><col style="width:44%"><col style="width:20%"><col style="width:14%"></colgroup>
    <caption>The two roads &middot; and what each charges on the shared ladder</caption>
    <thead><tr><th>Tradition</th><th>The method</th><th>Where it narrows</th><th>Deviation</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <dl class="dispute">${detail}</dl>
  <p class="note"><strong>Each of them teaches things about the other that are false, and people die of it.</strong> These are not slanders. They are working beliefs held by whole provinces, acted on by reasonable people, and the last line of each entry is what acting on it has actually cost - which in one case is the commonest single cause of death among cultivators crossing into the other province for work.</p>
  <dl class="dispute">${errors}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE HOUSES ORGANISED AROUND AN IDEA
// ─────────────────────────────────────────────────────────────────────────

function daoHousesSection(): string {
    const oldest = DAO_HOUSES.length
        ? Math.max(...DAO_HOUSES.map(house => house.foundedYearsAgo))
        : 0;
    const withSuccession = DAO_HOUSES.filter(house => house.succession !== null);
    const uncountered = DAO_HOUSES.filter(house => house.counter.heldBy === null);

    const rows = DAO_HOUSES
        .slice()
        .sort((a, b) => b.foundedYearsAgo - a.foundedYearsAgo)
        .map(house => `<tr>
    <td class="nm">${esc(house.name)}<span class="rsep"> &middot; </span>${dim(house.houseSurname)}</td>
    <td class="m">${esc(house.principle)}</td>
    <td class="n">${num(house.foundedYearsAgo)} <span class="dim">years</span></td>
    <td class="q">${esc(house.principleDescription)}</td>
    <td class="m">${esc(house.counter.name)}<span class="rsep"> &middot; </span>${house.counter.heldBy === null
        ? dim('only ruins hold it now')
        : esc(factionName(house.counter.heldBy))}</td>
  </tr>`).join('');

    const detail = DAO_HOUSES.map(house => `<dt>${esc(house.name)}, away from a fight</dt>
    <dd>${house.civilReach.map(esc).join('. ')}.</dd>
    <dt>What it supplies, and who cannot do without it</dt>
    <dd>${house.services.map(esc).join('; ')}. Dependent on it: ${house.dependents.map(esc).join('; ')}.</dd>
    <dt>What it is genuinely bad at</dt>
    <dd>${house.blindSpots.map(esc).join('. ')}. ${house.weaknesses.map(esc).join('. ')}.</dd>
    <dt>Who is arguing inside it</dt>
    <dd>${house.internalFactions.map(esc).join('. ')}.</dd>
    <dt>What killing one of its people costs</dt>
    <dd>${esc(house.afterwardsClause)}</dd>
    ${house.succession
        ? `<dt>What its own archive says about where it came from</dt>
    <dd>${esc(house.succession.officialVersion)}</dd>
    <dt>And what happened</dt>
    <dd>${esc(house.succession.trueVersion)} What does not agree with the archive: ${house.succession.discoverableTraces.map(esc).join('; ')}.</dd>`
        : ''}`).join('');

    const destroyed = DESTROYED_DAO_HOUSES
        .slice()
        .sort((a, b) => b.destroyedYearsAgo - a.destroyedYearsAgo)
        .map(house => `<dt>${esc(house.name)}<span class="rsep"> &middot; </span>${dim(`${num(house.destroyedYearsAgo)} years ago, by ${house.destroyedBy === null ? 'nobody now knows' : factionName(house.destroyedBy)}`)}</dt>
    <dd>${esc(house.officialVersion)}</dd>
    <dt>And what happened</dt>
    <dd>${esc(house.trueVersion)}</dd>
    <dt>What is left of it</dt>
    <dd>${house.traces.map(esc).join('. ')}.${house.fragmentTechniqueIds.length
        ? ` Arts in the catalog that are fragments of its discipline: ${house.fragmentTechniqueIds.map(artName).map(esc).join(', ')}.`
        : ''}</dd>`).join('');

    const disputes = DAO_HOUSE_DISPUTES.map(dispute => `<dt>${esc(dispute.subject)}</dt>
    ${dispute.positions.map(position =>
        `<dd>${esc(factionName(position.houseId))}: ${esc(position.position)}</dd>`
    ).join('')}
    <dt>What the disagreement does to people who are not in it</dt>
    <dd>${esc(dispute.consequence)}</dd>`).join('');

    const fosterage = FOSTERAGE_TERMS.map(terms => `<dt>${esc(factionName(terms.factionId))}<span class="rsep"> &middot; </span>${dim(`back at ${terms.returnOrdinal} ${rankName(terms.returnOrdinal)}, by ${terms.returnByAge}`)}</dt>
    <dd>${esc(terms.assessment)}</dd>
    <dt>And for the many who do not go back</dt>
    <dd>${esc(terms.otherwise)}</dd>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>The houses organised around an idea</h2><span class="r">${DAO_HOUSES.length} standing &middot; ${DESTROYED_DAO_HOUSES.length} ended &middot; the oldest is ${num(oldest)} years deep</span></div>
  <p class="note"><strong>A sect is a shelf and a gate; a dao house is a principle with a family attached to it.</strong> It takes nobody who is not born into it, its rank ladder is a surname, and what it sells the world is not force - it is a civil service nothing else supplies. The last column is the thing that beats the principle, which every one of them knows and ${uncountered.length ? `${uncountered.length} of which nothing living now holds` : 'all of which somebody holds'}.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:20%"><col style="width:10%"><col style="width:10%"><col style="width:40%"><col style="width:20%"></colgroup>
    <caption>The standing houses &middot; oldest first</caption>
    <thead><tr><th>House</th><th>Principle</th><th>Founded</th><th>What the principle is</th><th>What beats it</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <dl class="dispute">${detail}</dl>
  <p class="note"><strong>${DESTROYED_DAO_HOUSES.length} of them are gone, and every one has two accounts.</strong> ${withSuccession.length} of the standing houses were founded out of the ending of one of these, which is the part the archives are quietest about: a house that ended a predecessor and then kept its volumes tells a version of the story in which it was not in the room.</p>
  <dl class="dispute">${destroyed}</dl>
  <p class="note"><strong>They disagree about what reality is, and the disagreement has an administrative consequence.</strong> Each entry below ends with what it does to people who are not party to it, which is the only part that shows up in anybody's life: three houses that cannot be seated together means a whole class of dispute has no forum in the region and is settled by whoever is stronger.</p>
  <dl class="dispute">${disputes}</dl>
  ${FOSTERAGE_TERMS.length
      ? `<p class="note"><strong>One body in the world attaches terms to a child it places elsewhere.</strong> Fostering is ordinary and terms are not: nearly every house that sends a child away simply sends them, with no clause in the arrangement at all. A second row here would be a claim that a second body runs its children on a deadline.</p>
  <dl class="dispute">${fosterage}</dl>`
      : ''}
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// GROUND THAT TEACHES A ROAD BESIDES YOUR OWN
// ─────────────────────────────────────────────────────────────────────────

const ACCESS_WORD: Readonly<Record<string, string>> = {
    held: 'somebody is standing on the door',
    open: 'anybody may sit',
    buried: 'it has to be found first'
};

const ADMITS_WORD: Readonly<Record<string, string>> = {
    anybody: 'anybody',
    members_only: 'its own people only',
    by_leave: 'by leave',
    for_a_price: 'for a price',
    by_standing: 'by standing'
};

function daoGroundSection(): string {
    const byAccess = new Map<string, number>();
    for (const place of PLACES_THAT_TEACH_A_DAO) {
        byAccess.set(place.access, (byAccess.get(place.access) ?? 0) + 1);
    }
    const domains = new Set(PLACES_THAT_TEACH_A_DAO.map(place => place.domain));
    const reachable = PLACES_THAT_TEACH_A_DAO.filter(place => place.access !== 'held');
    const lowest = PLACES_THAT_TEACH_A_DAO.length
        ? Math.min(...PLACES_THAT_TEACH_A_DAO.map(place => place.fromOrdinal))
        : 0;

    const rows = PLACES_THAT_TEACH_A_DAO
        .slice()
        .sort((a, b) => a.fromOrdinal - b.fromOrdinal)
        .map(place => `<tr>
    <td class="nm">${esc(place.name)}<span class="rsep"> &middot; </span>${dim(factionName(place.regionId))}</td>
    <td class="m">${esc(place.domain)}<span class="rsep"> &middot; </span>${dim(place.subject)}</td>
    <td class="n">${place.fromOrdinal} <span class="dim">${esc(rankName(place.fromOrdinal))}</span></td>
    <td class="m">${esc(ACCESS_WORD[place.access] ?? place.access)}${place.heldBy
        ? `<span class="rsep"> &middot; </span>${esc(factionName(place.heldBy))}`
        : ''}</td>
    <td class="m">${esc(ADMITS_WORD[place.admits] ?? place.admits)}${place.access === 'held' && place.standingRequired > 0
        ? ` ${chip(`standing ${place.standingRequired} inside the house`)}`
        : ''}</td>
    <td class="q">${esc(place.what)}</td>
  </tr>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Ground that teaches a road besides your own</h2><span class="r">${PLACES_THAT_TEACH_A_DAO.length} places &middot; ${domains.size} roads &middot; ${reachable.length} of them nobody can close to you</span></div>
  <p class="note"><strong>No house owns a road.</strong> Every one of the ${domains.size} roads below is taught somewhere that is open or has to be found rather than asked for, so specialisation in this world is an advantage and never a possession - a house that holds the best ground for its own principle still cannot shut the principle away from anybody willing to travel and sit.</p>
  <p class="note"><strong>Access puts a road in reach, and years are what walk it.</strong> The rung in the third column is the floor below which a visitor takes nothing at all, and it climbs with the ROAD rather than with whoever holds the door: two houses of identical standing hold grounds four realms apart because what they understand is different. The lowest floor in the world is ${lowest}, and it is in the province people leave.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:17%"><col style="width:16%"><col style="width:11%"><col style="width:17%"><col style="width:15%"><col style="width:24%"></colgroup>
    <caption>Named ground where a dao can be sat &middot; lowest floor first</caption>
    <thead><tr><th>Place</th><th>Road</th><th>Floor</th><th>Who holds it</th><th>Who may sit</th><th>What a visitor does</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHO CAN CARRY SOMEBODY TO THE TOP
// ─────────────────────────────────────────────────────────────────────────

function deepRoadsSection(): string {
    const copies = THE_DEEPEST_ROADS.reduce((n, road) => n + road.copies, 0);
    const teachers = THE_DEEPEST_ROADS.reduce((n, road) => n + road.teachers.length, 0);
    const rationed = THE_DEEPEST_ROADS.filter(road => road.gradedByStanding !== null);

    const rows = THE_DEEPEST_ROADS.map(road => `<tr>
    <td class="nm">${esc(factionName(road.factionId))}</td>
    <td class="m">${esc(artName(road.techniqueId))}</td>
    <td class="n">${road.copies}</td>
    <td class="m">${esc(road.access)}</td>
    <td class="m">${road.teachers.map(teacher =>
        `${esc(teacher.who)} <span class="dim">${teacher.realmOrdinal} ${esc(rankName(teacher.realmOrdinal))}</span>`
    ).join('<span class="rsep"> &middot; </span>')}</td>
  </tr>`).join('');

    const detail = THE_DEEPEST_ROADS.map(road => `<dt>${esc(factionName(road.factionId))}<span class="rsep"> &middot; </span>${dim(artName(road.techniqueId))}</dt>
    <dd>${esc(road.capacityNote)}</dd>
    <dt>Why that many copies exist</dt>
    <dd>${esc(road.whyThatManyCopies)}</dd>
    <dt>What being allowed to read one involves</dt>
    <dd>${esc(road.accessTerms)}</dd>
    <dt>Where the teaching itself came from</dt>
    <dd>${esc(road.whereTheTeachingComesFrom)}</dd>
    ${road.gradedByStanding ? `<dt>How it is rationed inside the house</dt><dd>${esc(road.gradedByStanding)}</dd>` : ''}`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Who can carry somebody to the top of the ladder</h2><span class="r">${THE_DEEPEST_ROADS.length} bodies &middot; ${copies} copies in the world &middot; ${teachers} people who can teach one</span></div>
  <p class="note"><strong>The count of teachers is not what the capacity is.</strong> Every row below names the people who can personally carry somebody up, and on most of them the honest figure is less than the number suggests: one teacher who is available sometimes is materially less than one. What a seat at these bodies competes for is hours out of the only person who has them.</p>
  <p class="note"><strong>${copies} copies exist in the whole world</strong>, and the reason each house has the number it has is somebody's years rather than any rule about rarity. ${rationed.length ? `${rationed.length} of the ${THE_DEEPEST_ROADS.length} ration the teaching by standing inside the house; at the rest the question does not arise, because attention is given to one person or to nobody.` : ''}</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:22%"><col style="width:24%"><col style="width:8%"><col style="width:12%"><col style="width:34%"></colgroup>
    <caption>The roads that run to the end of the ladder &middot; and who is standing at the top of each</caption>
    <thead><tr><th>Held by</th><th>The road</th><th>Copies</th><th>Access</th><th>Who can teach it</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <dl class="dispute">${detail}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// ARTS THAT ARE A PERSON RATHER THAN A SHELF
// ─────────────────────────────────────────────────────────────────────────

function livingTransmissionsSection(): string {
    const arts = new Set(LIVING_TRANSMISSIONS.flatMap(row => row.techniqueIds));

    const rows = LIVING_TRANSMISSIONS.map(row => {
        const member = getMember(row.memberId);
        const house = member?.factionId ? factionName(member.factionId) : null;
        return `<dt>${esc(member?.name ?? row.memberId)}${house ? `<span class="rsep"> &middot; </span>${dim(house)}` : ''}</dt>
    <dd>${row.techniqueIds.map(artName).map(esc).join(', ')}. ${esc(row.whyNotTheShelf)}</dd>
    <dt>What they want</dt>
    <dd>${esc(row.wants)}</dd>`;
    }).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Arts that are a person rather than a shelf</h2><span class="r">${LIVING_TRANSMISSIONS.length} people &middot; ${arts.size} arts that do not come off a shelf</span></div>
  <p class="note"><strong>A house teaching a book and a person teaching the same book are not the same art.</strong> Every row below is somebody who understands a canon in a way the house holding it does not, so the shelf version works and their version is a different art wearing the same title. There is no way to be taught it except through them.</p>
  <p class="note"><strong>Which makes the second line of each entry the whole of the door.</strong> What they want is not a price and is mostly not a favour: it is a season at a perimeter, a refusal to witness a severance, or a student who stays. A reader looking for what these cost has misread the section - what they cost is being the kind of person the teacher wanted.</p>
  <dl class="dispute">${rows}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE TAB
// ─────────────────────────────────────────────────────────────────────────

/**
 * Everything on the Teaching tab that is not one house's shelf: the two roads
 * the ladder is climbed by, the houses that are a principle rather than a
 * shelf, ground anybody can go and sit on, the four bodies that can teach to
 * the end, and the arts that are a person.
 */
export function renderWhatCanBeTaughtSections(): string {
    return [
        traditionsSection(),
        daoHousesSection(),
        daoGroundSection(),
        deepRoadsSection(),
        livingTransmissionsSection()
    ].join('\n');
}
