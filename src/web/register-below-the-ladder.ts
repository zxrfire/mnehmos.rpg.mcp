/**
 * The Standing Register's tab for the world under the sects.
 *
 * WHAT WAS MISSING, AND WHY IT IS A TAB RATHER THAN A SECTION. Every other page
 * on this sheet is organised by HOUSE: what a body is, what it holds, what it
 * teaches, who it is at odds with. That is the right shape for nine tabs and
 * the wrong shape for this material, because nothing here belongs to a house.
 * What a bowl of millet costs, what a hamlet is afraid of, what the province
 * starts calling somebody it cannot place, and what happens to a cultivator the
 * road has finished with are all facts about people standing outside every
 * institution on the other tabs - which is most of the people in the world and
 * very nearly all of the player's own peers.
 *
 * ── THE COLUMN THAT MAKES THE TAB WORTH HAVING ───────────────────────────
 *
 * Money, in one denomination throughout. The catalogs quote cash because that
 * is what a mortal is paid in and spirit stones because that is what a
 * cultivator carries, and a reader who has to convert while reading cannot
 * compare a wage to a pill. `CASH_PER_STONE` is the one rate and every figure
 * below goes through it, so the two economies sit in the same column and the
 * distance between them is visible rather than asserted.
 *
 * ── WHAT IS DELIBERATELY NOT ON IT ───────────────────────────────────────
 *
 * No totals, no wealth ranking and no "how hard is this life" score. The
 * register reports; a rating would be this sheet inventing an assessment the
 * engine does not make. Where a figure looks damning - a trade that kills one
 * in four, a wage a quarter under the posted rate - it is printed as the
 * catalog states it and the reader draws the conclusion.
 */

import { rankName } from '../engine/cultivation/realms.js';
import {
    CASH_PER_STONE,
    FUNERARY_PRACTICE,
    MORTAL_ATTITUDES,
    MORTAL_WORK_CEILING_ORDINAL,
    OCCUPATIONS,
    PRICES,
    SETTLEMENTS,
    SETTLEMENT_FEARS,
    cashToStones,
    type Settlement
} from '../data/cultivation/mortal-world.js';
import {
    AUCTION_ACCESS,
    AUCTION_VENUES,
    BOUNTIES,
    DEALERS,
    DEALER_MARKUP,
    ROAD_CUSTOMS,
    ROGUE_STANDING,
    ROGUE_TRADES,
    UNBACKED,
    UNBACKED_DEDUCTION,
    CONTRACTS,
    UNDERWRITTEN_CONTRACT_IDS,
    WHY_UNAFFILIATED,
    unbackedMonthlyFor
} from '../data/cultivation/rogues.js';
import { HOUSE_MISSIONS } from '../data/cultivation/what-a-house-posts-for-its-own.js';
import { FALLEN } from '../data/cultivation/cultivators-the-road-finished.js';
import {
    WHAT_THE_END_OF_A_TERM_LEAVES,
    WHAT_RUNNING_COSTS,
    WHERE_IT_WAS_SWORN_MAY_MATTER_AND_NOBODY_CAN_SAY,
    WHY_AN_INDENTURE_IS_TAKEN,
    WHY_ONE_OF_THE_THREE_STATES_NO_TERM,
    THE_OATHWRIGHT_HOUSE,
    THE_OATHWRIGHT_WILL_NOT_WITNESS_FOR,
    YEARS_OF_A_TERM
} from '../data/cultivation/what-an-indenture-is-and-what-happens-when-it-ends.js';
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

/**
 * Cash and its stone value together, because the two economies do not meet
 * anywhere else on the sheet.
 *
 * Under a stone the stone figure is noise and is dropped: a bowl of millet
 * priced at one hundredth of a spirit stone tells a reader nothing except that
 * the denominations are far apart, which the column above it has already said.
 */
function money(cash: number): string {
    const stones = cashToStones(cash);
    return stones < 1
        ? `${num(cash)} cash`
        : `${num(cash)} cash <span class="dim">${stones % 1 === 0 ? num(stones) : stones.toFixed(1)} stones</span>`;
}

const SETTLEMENT_ORDER: readonly Settlement['kind'][] =
    ['hamlet', 'village', 'market_town', 'sect_town', 'city'];

const settlementName = (kind: string): string =>
    SETTLEMENTS.find(s => s.kind === kind)?.name ?? kind.replace(/_/g, ' ');

const RISK_WORD: Readonly<Record<string, string>> = {
    none: 'nothing happens to you',
    low: 'rarely hurts anybody',
    moderate: 'hurts somebody every season',
    high: 'people are hurt doing this',
    lethal: 'people die doing this'
};

// ─────────────────────────────────────────────────────────────────────────
// WHAT A LIFE COSTS
// ─────────────────────────────────────────────────────────────────────────

const PRICE_CATEGORY_HEAD: Readonly<Record<string, string>> = {
    food: 'Food',
    lodging: 'Somewhere to sleep',
    transport: 'Getting there',
    medicine: 'Being put back together',
    land: 'Ground',
    service: 'Work done for you',
    tool: 'Things to carry',
    information: 'Knowing something'
};

function pricesSection(): string {
    const cheapest = PRICES.reduce((a, b) => (a.cash <= b.cash ? a : b));
    const dearest = PRICES.reduce((a, b) => (a.cash >= b.cash ? a : b));
    const mortalJobs = OCCUPATIONS.filter(o => o.minOrdinal === 0);
    const bestMortalWage = mortalJobs.length
        ? Math.max(...mortalJobs.map(o => o.cashPerMonth))
        : 0;
    const yearsOfWork = bestMortalWage
        ? dearest.cash / (bestMortalWage * 12)
        : 0;

    const byCategory = new Map<string, typeof PRICES[number][]>();
    for (const price of PRICES) {
        const bucket = byCategory.get(price.category) ?? [];
        bucket.push(price);
        byCategory.set(price.category, bucket);
    }

    const tables = [...byCategory.entries()].map(([category, rows]) => `<div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:22%"><col style="width:16%"><col style="width:10%"><col style="width:52%"></colgroup>
    <caption>${esc(PRICE_CATEGORY_HEAD[category] ?? category)} &middot; ${rows.length} row${rows.length === 1 ? '' : 's'}</caption>
    <thead><tr><th>What</th><th>Price</th><th>Per</th><th>Note</th></tr></thead>
    <tbody>${rows
        .slice()
        .sort((a, b) => a.cash - b.cash)
        .map(price => `<tr>
      <td class="nm">${esc(price.name)}</td>
      <td class="n">${money(price.cash)}</td>
      <td class="m">${esc(price.unit)}</td>
      <td class="q">${esc(price.note)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`).join('');

    // Mortal work first, then what a cultivator is paid for instead of a
    // profession: a contract off a wall, or a mission from their own house.
    const PAID_AS_ORDER = ["a mortal's trade", 'menial work', 'a contract', 'a mission'];
    const work = [
        ...OCCUPATIONS.map(o => ({ ...o, paidAs: o.kind === 'mortal' ? "a mortal's trade" : 'menial work' })),
        ...CONTRACTS.map(c => ({ ...c, paidAs: 'a contract' })),
        ...HOUSE_MISSIONS.map(m => ({ ...m, paidAs: 'a mission' }))
    ]
        .sort((a, b) => PAID_AS_ORDER.indexOf(a.paidAs) - PAID_AS_ORDER.indexOf(b.paidAs)
            || a.minOrdinal - b.minOrdinal || b.cashPerMonth - a.cashPerMonth)
        .map(job => {
            const unbacked = unbackedMonthlyFor(job.id);
            const docked = unbacked !== undefined && unbacked !== job.cashPerMonth;
            return `<tr>
      <td class="nm">${esc(job.name)} ${dim(job.paidAs)}</td>
      <td class="n">${job.minOrdinal === 0 ? dim('a mortal can do it') : `${job.minOrdinal} ${esc(rankName(job.minOrdinal))}`}</td>
      <td class="n">${money(job.cashPerMonth)}${docked ? ` ${chip(`${num(unbacked)} with no house behind you`)}` : ''}</td>
      <td class="m">${esc(RISK_WORD[job.risk] ?? job.risk)}</td>
      <td class="m">${job.settlements.map(settlementName).map(esc).join(', ')}</td>
      <td class="q">${esc(job.note)}</td>
    </tr>`;
        }).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>What a life costs</h2><span class="r">${PRICES.length} priced rows &middot; ${OCCUPATIONS.length + CONTRACTS.length + HOUSE_MISSIONS.length} ways of earning &middot; ${num(CASH_PER_STONE)} cash to the spirit stone</span></div>
  <p class="note"><strong>One rate, and both economies in the same column.</strong> A mortal is paid in cash and a cultivator carries spirit stones, and at ${num(CASH_PER_STONE)} cash to the stone the two are the same money at different magnifications. Every figure on this tab is printed both ways where the stone figure means anything, so a wage and a pill can be read against each other without arithmetic.</p>
  <p class="note"><strong>The distance is the point.</strong> The cheapest thing on the board is ${esc(cheapest.name)} at ${num(cheapest.cash)} cash; the dearest is ${esc(dearest.name)} at ${num(dearest.cash)}${yearsOfWork >= 1 ? `, which is ${yearsOfWork < 10 ? yearsOfWork.toFixed(1) : num(Math.round(yearsOfWork))} years of the best-paid work a mortal can get` : ''}. Nothing in the catalog is scaled to make that gap smaller, and a player who has just been handed a starting purse is looking at a board most of which is not for them.</p>
  ${tables}
  <p class="note"><strong>A cultivator has no profession.</strong> A mortal's trade is put only to somebody taken for a mortal, and menial work a cultivator may also take is put to them a little further up the ladder than goods are - a wage is a relationship and relationships go absurd more slowly than transactions do - up to ordinal ${MORTAL_WORK_CEILING_ORDINAL}. What a cultivator is paid for otherwise is a contract off a town wall, which a rogue takes and a disciple may take on their own time, or a mission their own house sends them on.</p>
  ${UNDERWRITTEN_CONTRACT_IDS.length
      ? `<p class="note"><strong>${UNDERWRITTEN_CONTRACT_IDS.length} of the contracts are paid off a rank table</strong>, so somebody with no house behind them is quoted the same contract at ${Math.round(UNBACKED_DEDUCTION * 100)} per cent less. That is not haggling and it is not prejudice: the posted rate assumes a body that answers for the worker, and where there is none the rate is the rate for a person nobody will answer for.</p>`
      : ''}
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:17%"><col style="width:13%"><col style="width:16%"><col style="width:14%"><col style="width:16%"><col style="width:24%"></colgroup>
    <caption>Every way of earning in the catalog &middot; mortal work first, then contracts, then missions</caption>
    <thead><tr><th>Work</th><th>Rung it takes</th><th>A month</th><th>What it does to you</th><th>Where it exists</th><th>Note</th></tr></thead>
    <tbody>${work}</tbody>
  </table></div>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHERE PEOPLE LIVE
// ─────────────────────────────────────────────────────────────────────────

function settlementsSection(): string {
    const funded = SETTLEMENT_FEARS.filter(fear => fear.paidTo !== null);

    const rows = SETTLEMENTS
        .slice()
        .sort((a, b) => SETTLEMENT_ORDER.indexOf(a.kind) - SETTLEMENT_ORDER.indexOf(b.kind))
        .map(settlement => `<tr>
    <td class="nm">${esc(settlement.name)}</td>
    <td class="n">${esc(settlement.typicalPopulation)}</td>
    <td class="q">${settlement.contains.map(esc).join(', ')}</td>
    <td class="q">${settlement.cultivatorCanGet.map(esc).join(', ')}</td>
    <td class="q">${settlement.lacks.map(esc).join(', ')}</td>
  </tr>`).join('');

    const fears = SETTLEMENT_FEARS.map(fear => `<dt>${esc(settlementName(fear.settlement))}<span class="rsep"> &middot; </span>${dim(fear.paidTo === null ? 'nobody is paid' : `paid to ${fear.paidTo}`)}</dt>
    <dd>${esc(fear.fear)}</dd>
    <dt>What is actually out there</dt>
    <dd>${esc(fear.behindIt)}</dd>
    <dt>What it costs them</dt>
    <dd>${esc(fear.spentOnIt)}</dd>`).join('');

    const attitudes = MORTAL_ATTITUDES.map(attitude => `<tr>
    <td class="nm">${attitude.fromOrdinal} to ${attitude.toOrdinal}<span class="rsep"> &middot; </span>${dim(rankName(attitude.fromOrdinal))}</td>
    <td class="q">${esc(attitude.lowFall)}</td>
    <td class="q">${esc(attitude.quietMarches)}</td>
  </tr>`).join('');

    const funerary = FUNERARY_PRACTICE.map(rite => `<dt>${esc(settlementName(rite.settlement))}</dt>
    <dd>${esc(rite.practice)}</dd>
    <dt>Why it is done that way</dt>
    <dd>${esc(rite.because)} <span class="dim">What it costs the family: ${esc(rite.cost)}</span></dd>
    <dt>And when the body is a cultivator's</dt>
    <dd>${esc(rite.ifTheyWereACultivator)}</dd>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Where people live, and what they are afraid of</h2><span class="r">${SETTLEMENTS.length} kinds of place &middot; ${SETTLEMENT_FEARS.length} fears &middot; ${funded.length} of them paid to somebody</span></div>
  <p class="note"><strong>The last column of the table is the useful one.</strong> What a place has is a list; what it lacks is a decision somebody has to make. A hamlet with no medicine and nobody who can read is not a smaller market town, it is a different problem, and a cultivator arriving in one with an injury has arrived nowhere.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:12%"><col style="width:10%"><col style="width:28%"><col style="width:26%"><col style="width:24%"></colgroup>
    <caption>The five kinds of settlement &middot; smallest first</caption>
    <thead><tr><th>Place</th><th>People</th><th>What is there</th><th>What a cultivator can get</th><th>What is missing</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <p class="note"><strong>A fear with nothing spent on it is a mood, and none of these is a mood.</strong> Every one below has an expenditure attached - money, labour, or land not used - and ${funded.length} of the ${SETTLEMENT_FEARS.length} have somebody at the other end receiving it. That second fact is where most of the interesting work in this world is: a fear that funds a person funds them whether or not the thing behind it is real.</p>
  <dl class="dispute">${fears}</dl>
  <p class="note"><strong>Nobody down here is impressed by a rung as such.</strong> The two columns are two provinces, and they disagree in a way that is worth knowing before walking into either: one has seen enough young cultivators to charge them the ordinary price, and the other assesses a person by whether they hold a grant. Deference starts much further up than a new cultivator expects, and in one of the two it barely starts at all.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:16%"><col style="width:42%"><col style="width:42%"></colgroup>
    <caption>What ordinary people make of a cultivator &middot; by the rung they are standing on</caption>
    <thead><tr><th>Rungs</th><th>In the Low Fall</th><th>In the Quiet Marches</th></tr></thead>
    <tbody>${attitudes}</tbody>
  </table></div>
  <p class="note"><strong>And what is done with a body.</strong> The practice follows the land and the distance rather than any belief about death, which is why it changes between a hamlet and a city and why the last line of every entry is different: a cultivator's body is not a person's body to the people who have to bury it, and what they do about that is the closest thing in the catalog to a statement of what they actually think of us.</p>
  <dl class="dispute">${funerary}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// NOBODY'S DISCIPLE
// ─────────────────────────────────────────────────────────────────────────

const SHARE_WORD: Readonly<Record<string, string>> = {
    most: 'most of them',
    many: 'many of them',
    some: 'some of them',
    'a few': 'a few of them'
};

const PAY_BASIS_WORD: Readonly<Record<string, string>> = {
    monthly: 'a month',
    per_job: 'a job',
    share: 'a share of what comes out',
    per_head: 'a head'
};

function roguesSection(): string {
    const standing = ROGUE_STANDING
        .slice()
        .sort((a, b) => a.fromOrdinal - b.fromOrdinal)
        .map(band => `<tr>
    <td class="n">${band.fromOrdinal} <span class="dim">${esc(rankName(band.fromOrdinal))}</span></td>
    <td class="nm">${esc(band.called)}</td>
    <td class="q">${esc(band.because)}</td>
  </tr>`).join('');

    const why = WHY_UNAFFILIATED.map(reason => `<tr>
    <td class="nm">${esc(reason.reason)}</td>
    <td class="m">${esc(SHARE_WORD[reason.share] ?? reason.share)}</td>
    <td class="q">${esc(reason.note)}</td>
  </tr>`).join('');

    const lacks = UNBACKED.lacks
        .map(row => `<dt>${esc(row.what)}</dt><dd>${esc(row.cost)}</dd>`)
        .join('');

    const deadly = ROGUE_TRADES.filter(trade => trade.deathRate !== null);

    const trades = ROGUE_TRADES
        .slice()
        .sort((a, b) => a.minOrdinal - b.minOrdinal)
        .map(trade => `<tr>
    <td class="nm">${esc(trade.name)}</td>
    <td class="n">${trade.minOrdinal === 0 ? dim('anybody') : `${trade.minOrdinal} ${esc(rankName(trade.minOrdinal))}`}</td>
    <td class="n">${money(trade.pay.cash)} <span class="dim">${esc(PAY_BASIS_WORD[trade.pay.basis] ?? trade.pay.basis)}</span></td>
    <td class="m">${esc(RISK_WORD[trade.risk] ?? trade.risk)}</td>
    <td class="q">${esc(trade.whoPays)}</td>
  </tr>`).join('');

    const tradeDetail = ROGUE_TRADES.map(trade => `<dt>${esc(trade.name)}</dt>
    <dd>${esc(trade.pay.note)}</dd>
    <dt>What it costs to do this with nobody behind you</dt>
    <dd>${esc(trade.unbackedCost)}${trade.factionIds.length ? ` <span class="dim">Named in this entry: ${trade.factionIds.map(factionName).map(esc).join(', ')}.</span>` : ''}</dd>
    ${trade.deathRate ? `<dt>What it kills</dt><dd>${esc(trade.deathRate)}</dd>` : ''}`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Nobody's disciple</h2><span class="r">${WHY_UNAFFILIATED.length} ways of ending up outside &middot; ${ROGUE_TRADES.length} trades &middot; ${deadly.length} with a death rate worth quoting</span></div>
  <p class="note"><strong>Being unaffiliated is ordinary, and getting far while unaffiliated is not.</strong> At the bottom of the ladder nobody remarks on a missing house. The words in the table below are not honours anybody confers: they are what a province starts calling somebody once its usual explanation, that they must be somebody's, has been checked and found false.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:16%"><col style="width:22%"><col style="width:62%"></colgroup>
    <caption>What the province calls them &middot; from the rung it starts using the word</caption>
    <thead><tr><th>From</th><th>Called</th><th>Why a word is needed here</th></tr></thead>
    <tbody>${standing}</tbody>
  </table></div>
  <p class="note"><strong>Almost none of them chose it.</strong> The distribution below is the honest one rather than the flattering one: the commonest origin by a wide margin is being turned away at a gate, and the romantic answer is the rarest entry in the table.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:22%"><col style="width:14%"><col style="width:64%"></colgroup>
    <caption>How somebody comes to have no house &middot; commonest first</caption>
    <thead><tr><th>Reason</th><th>How many</th><th>Note</th></tr></thead>
    <tbody>${why}</tbody>
  </table></div>
  <p class="note"><strong>${esc(UNBACKED.theHonestSummary)}</strong></p>
  <p class="note">What a house supplies, listed as what its absence costs: ${UNBACKED.lacks.length} things, of which the stipend is the one everybody names and the least important. What is had instead: ${UNBACKED.has.map(esc).join('; ')}.</p>
  <dl class="dispute">${lacks}</dl>
  <p class="note"><strong>The trades are what is left when no house is paying.</strong> ${deadly.length} of the ${ROGUE_TRADES.length} carry a loss rate the catalog is willing to quote, and the pay column says how the money arrives rather than only how much, because a share and a wage are two different lives at the same annual figure.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:18%"><col style="width:14%"><col style="width:18%"><col style="width:14%"><col style="width:36%"></colgroup>
    <caption>What a sectless cultivator can be paid for &middot; lowest rung first</caption>
    <thead><tr><th>Trade</th><th>Takes</th><th>Pays</th><th>What it does to you</th><th>Who is holding the purse</th></tr></thead>
    <tbody>${trades}</tbody>
  </table></div>
  <dl class="dispute">${tradeDetail}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE MARKET ON THE ROAD
// ─────────────────────────────────────────────────────────────────────────

const HONOURED_WORD: Readonly<Record<string, string>> = {
    reliably: 'paid reliably',
    usually: 'usually paid',
    if_witnessed: 'paid if somebody saw it',
    rarely: 'rarely paid'
};

const TRUST_WORD: Readonly<Record<string, string>> = {
    sound: 'sound',
    mixed: 'mixed',
    bad: 'bad, and known to be'
};

function roadMarketSection(): string {
    const unreliable = BOUNTIES.filter(b => b.honoured === 'rarely' || b.honoured === 'if_witnessed');
    const dearestMarkup = Object.entries(DEALER_MARKUP)
        .reduce((a, b) => (a[1].multiplier >= b[1].multiplier ? a : b));

    const bounties = BOUNTIES
        .slice()
        .sort((a, b) => b.purseCash - a.purseCash)
        .map(bounty => `<tr>
    <td class="q">${esc(bounty.what)}</td>
    <td class="m">${bounty.posterFactionId === null ? dim(bounty.posterNote) : esc(factionName(bounty.posterFactionId))}</td>
    <td class="n">${money(bounty.purseCash)}</td>
    <td class="m">${esc(HONOURED_WORD[bounty.honoured] ?? bounty.honoured)}</td>
    <td class="q">${esc(bounty.catch)}</td>
  </tr>`).join('');

    const markup = Object.entries(DEALER_MARKUP).map(([kind, row]) => `<tr>
    <td class="nm">${esc(kind)}</td>
    <td class="n">${row.multiplier.toFixed(2)} <span class="dim">times a counter price</span></td>
    <td class="q">${esc(row.fakeRate)}</td>
    <td class="q">${esc(row.note)}</td>
  </tr>`).join('');

    const dealers = DEALERS.map(dealer => `<tr>
    <td class="nm">${esc(dealer.name)}</td>
    <td class="m">${esc(dealer.side)}<span class="rsep"> &middot; </span>${dim(dealer.deals.join(', '))}</td>
    <td class="m">${esc(factionName(dealer.regionId))}<span class="rsep"> &middot; </span>${dim(dealer.places.join(', '))}</td>
    <td class="m">${esc(TRUST_WORD[dealer.trust] ?? dealer.trust)}</td>
    <td class="q">${esc(dealer.catch)}</td>
  </tr>`).join('');

    const venues = AUCTION_VENUES.map(venue => `<dt>${esc(venue.name)}<span class="rsep"> &middot; </span>${dim(venue.runByFactionId === null ? 'nobody runs it' : factionName(venue.runByFactionId))}</dt>
    <dd>${esc(venue.whatSells)} <span class="dim">${esc(venue.cadence)}, in ${esc(factionName(venue.regionId))}: ${venue.places.map(esc).join(', ')}. Bond to stand on the floor: ${venue.entryBondStones === 0 ? 'none' : `${num(venue.entryBondStones)} stones, refundable`}.</span></dd>
    <dt>What is actually guaranteed</dt>
    <dd>${venue.protections.map(esc).join('. ')}.</dd>
    <dt>What somebody with no house can expect</dt>
    <dd>${esc(venue.sectlessNote)}</dd>`).join('');

    const customs = ROAD_CUSTOMS.map(custom => `<dt>${esc(custom.custom)}</dt>
    <dd>Kept by ${esc(custom.keptBy)} What breaking it costs: ${esc(custom.breakingIt)}</dd>`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>The market on the road</h2><span class="r">${BOUNTIES.length} standing bounties &middot; ${DEALERS.length} dealers &middot; ${AUCTION_VENUES.length} venues &middot; ${ROAD_CUSTOMS.length} customs nobody enforces</span></div>
  <p class="note"><strong>A purse is not a payment.</strong> ${unreliable.length} of the ${BOUNTIES.length} bounties below are honoured only if somebody saw it, or barely honoured at all, and the last column of every row is the part a first-time taker does not know. The figure in the third column is what is posted; whether it arrives is a different column on purpose.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:24%"><col style="width:16%"><col style="width:14%"><col style="width:16%"><col style="width:30%"></colgroup>
    <caption>Standing bounties &middot; largest purse first</caption>
    <thead><tr><th>For what</th><th>Posted by</th><th>Purse</th><th>Whether it is paid</th><th>The catch</th></tr></thead>
    <tbody>${bounties}</tbody>
  </table></div>
  <p class="note"><strong>Everything on a road costs more than the same thing over a counter, and the multiplier is a fact about who is buying rather than about distance.</strong> The dearest is ${esc(dearestMarkup[0])} at ${dearestMarkup[1].multiplier.toFixed(2)} times, which is priced at what a cultivator with no teacher will pay - and nobody who can get one through a house buys one on a road.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:12%"><col style="width:16%"><col style="width:36%"><col style="width:36%"></colgroup>
    <caption>What the road charges &middot; against a counter price</caption>
    <thead><tr><th>Kind</th><th>Markup</th><th>How much of it is not what it says</th><th>Note</th></tr></thead>
    <tbody>${markup}</tbody>
  </table></div>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:16%"><col style="width:18%"><col style="width:24%"><col style="width:12%"><col style="width:30%"></colgroup>
    <caption>Who will trade with somebody carrying no seal</caption>
    <thead><tr><th>Dealer</th><th>Deals</th><th>Where</th><th>Trust</th><th>The catch</th></tr></thead>
    <tbody>${dealers}</tbody>
  </table></div>
  <p class="note"><strong>The bond is not the barrier.</strong> Somebody who can afford a heaven-grade lot can afford the bond ten times over, and the number of unbacked cultivators who can afford a heaven-grade lot is very close to none. The floors are open to them because the exclusion would cost nothing and the inclusion costs nothing either.</p>
  <p class="note">What can be bid on: ${AUCTION_ACCESS.canBid.map(esc).join('; ')}. What cannot: ${AUCTION_ACCESS.cannotBid.map(esc).join('; ')}. The ways round it: ${AUCTION_ACCESS.theWayAround.map(esc).join('; ')}.</p>
  <dl class="dispute">${venues}</dl>
  <p class="note"><strong>And ${ROAD_CUSTOMS.length} rules nobody enforces, kept anyway.</strong> There is no authority behind a single one of them. What is behind them is the alternative, which is that nobody can work with anybody - so the cost of breaking one is never a punishment and is always a consequence, and it is stated as one.</p>
  <dl class="dispute">${customs}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE ROAD FINISHED WITH
// ─────────────────────────────────────────────────────────────────────────

const FALLEN_KIND_WORD: Readonly<Record<string, string>> = {
    meridians_destroyed: 'the meridians are ruined and it is not coming back',
    stalled: 'a foundation that cracked, and they stopped',
    came_back_wrong: 'went into a sealed site and did not entirely come out',
    spent: 'traded something irreversible for the rung, and got it',
    maimed: 'carrying damage nobody treated'
};

const COMPANY_WORD: Readonly<Record<string, string>> = {
    good: 'worth the evening',
    difficult: 'hard work',
    not_company: 'not company'
};

function fallenSection(): string {
    const dangerous = FALLEN.filter(f => f.danger !== null);
    const underestimated = dangerous.filter(f => f.danger?.underestimated);
    const stillClimbing = FALLEN.filter(f => f.stillClimbs).length;
    const unexplained = FALLEN.filter(f => f.unexplained !== null).length;
    const dropped = FALLEN.filter(f => f.currentOrdinal < f.lastOrdinal);
    const worst = dropped.length
        ? Math.max(...dropped.map(f => f.lastOrdinal - f.currentOrdinal))
        : 0;

    const rows = FALLEN
        .slice()
        .sort((a, b) => b.lastOrdinal - a.lastOrdinal)
        .map(person => `<tr>
    <td class="nm">${esc(person.name)}${person.danger?.underestimated ? ` ${chip('underestimated')}` : ''}</td>
    <td class="n">${person.lastOrdinal}${person.currentOrdinal === person.lastOrdinal
        ? ''
        : ` <span class="dim">brings ${person.currentOrdinal}</span>`}</td>
    <td class="m">${esc(FALLEN_KIND_WORD[person.kind] ?? person.kind)}</td>
    <td class="m">${esc(person.rarity)}<span class="rsep"> &middot; </span>${dim(COMPANY_WORD[person.company] ?? person.company)}</td>
    <td class="q">${esc(person.work.doing)}</td>
  </tr>`).join('');

    const detail = FALLEN.map(person => `<dt>${esc(person.name)}<span class="rsep"> &middot; </span>${dim(`${factionName(person.place.regionId)}: ${person.place.places.join(', ')}`)}</dt>
    <dd>${esc(person.what)}</dd>
    <dt>How they carry it</dt>
    <dd>${esc(person.attitude)}${person.asked ? ` What they are asked constantly: ${esc(person.asked)}` : ''}</dd>
    ${person.unexplained ? `<dt>The part nobody can name, including them</dt><dd>${esc(person.unexplained)}</dd>` : ''}
    ${person.danger ? `<dt>${person.danger.underestimated ? 'And it survives because nobody credits it' : 'What makes them dangerous'}</dt><dd>${esc(person.danger.how)}</dd>` : ''}`).join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Cultivators the road already finished with</h2><span class="r">${FALLEN.length} roles &middot; ${stillClimbing} can still climb &middot; ${dangerous.length} dangerous, ${underestimated.length} of them because nobody credits it</span></div>
  <p class="note"><strong>These are roles rather than people, and they are meant to be reused.</strong> A ladder that charges a price at every boundary, medicine more poisonous the better it is, and sealed sites that were sealed for a reason should be producing casualties continuously. This is what the casualties do afterwards, and the second column is the whole of it: the rung they once stood on, and what they can actually bring to work now.</p>
  <p class="note"><strong>The drop is the thing an employer is hiring against.</strong> ${dropped.length} of the ${FALLEN.length} bring less than they once stood on, the worst by ${worst} rungs, and only ${stillClimbing} of the whole list has the ladder still open to them. That is why somebody who was paid four times a mortal wage takes mortal work - not because the world is cruel to them, but because what is being bought is the number in the second half of that column.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:18%"><col style="width:12%"><col style="width:24%"><col style="width:16%"><col style="width:30%"></colgroup>
    <caption>What the road left &middot; by the rung they once stood on</caption>
    <thead><tr><th>Who</th><th>Was, brings</th><th>What happened</th><th>How often, and company</th><th>What they do now</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  ${unexplained
      ? `<p class="note"><strong>${unexplained} of them carry something nobody can name, including them.</strong> Those entries are not resolved anywhere in the catalog and are not going to be. An engine that explained every one of them would be turning a person into a diagnosis, and the ones who came back from a sealed site wrong are exactly the cases where nobody standing in front of them can tell what they are looking at either.</p>`
      : ''}
  <dl class="dispute">${detail}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// BEING HELD
// ─────────────────────────────────────────────────────────────────────────

function indentureSection(): string {
    const reasons = Object.entries(WHY_AN_INDENTURE_IS_TAKEN);
    const withATerm = reasons.filter(([, reason]) => reason.statesATerm);

    const terms = Object.entries(YEARS_OF_A_TERM).map(([weight, years]) => `<tr>
    <td class="nm">${esc(weight)}</td>
    <td class="n">${years === null ? dim('nobody would be taken') : `${years} years`}</td>
  </tr>`).join('');

    const houses = reasons.map(([alignment, reason]) => `<tr>
    <td class="nm">${esc(alignment)}</td>
    <td class="m">${esc(reason.theHousesWord)}</td>
    <td class="m">${esc(reason.whatTheyAreCalled)}</td>
    <td class="q">${esc(reason.whatTheYearsAreFor)}</td>
  </tr>`).join('');

    const refused = Object.entries(THE_OATHWRIGHT_WILL_NOT_WITNESS_FOR)
        .map(([factionId, why]) => `<dt>${esc(factionName(factionId))}</dt><dd>${esc(why)}</dd>`)
        .join('');

    const afterwards = Object.entries(WHAT_THE_END_OF_A_TERM_LEAVES)
        .map(([, text]) => `<dd>${esc(text)}</dd>`)
        .join('');

    return `<section class="startfolded">
  <div class="sh"><h2>Being held, and the day it ends</h2><span class="r">${reasons.length} kinds of house &middot; ${withATerm.length} of them write a term</span></div>
  <p class="note"><strong>An indenture is not a rank and serving one out is not a promotion into one.</strong> It is years of somebody's life taken against an account, and the three houses below take them for three different reasons and call the arrangement three different things. The reasons are not interchangeable and the catalog is shaped so that they cannot be swapped.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:12%"><col style="width:16%"><col style="width:20%"><col style="width:52%"></colgroup>
    <caption>Why the years are taken &middot; and what the person is called while they run</caption>
    <thead><tr><th>House</th><th>Its own word</th><th>What they are called</th><th>What the years are for</th></tr></thead>
    <tbody>${houses}</tbody>
  </table></div>
  <p class="note"><strong>${esc(WHY_ONE_OF_THE_THREE_STATES_NO_TERM)}</strong></p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:50%"><col style="width:50%"></colgroup>
    <caption>The term a house would write &middot; by the weight of the account</caption>
    <thead><tr><th>Weight</th><th>Years</th></tr></thead>
    <tbody>${terms}</tbody>
  </table></div>
  <p class="note"><strong>Two indentures identical on paper are not the same arrangement, and the difference is who witnessed it.</strong> ${esc(factionName(THE_OATHWRIGHT_HOUSE))} is the premier oathwright, and the ${Object.keys(THE_OATHWRIGHT_WILL_NOT_WITNESS_FOR).length === 1 ? 'one body' : 'bodies'} it refuses ${Object.keys(THE_OATHWRIGHT_WILL_NOT_WITNESS_FOR).length === 1 ? 'is' : 'are'} below. A discharged term is worth what the house that witnessed it is worth, which means the same years can buy a great deal or nothing.</p>
  <dl class="dispute">${refused}</dl>
  <p class="note">${esc(WHERE_IT_WAS_SWORN_MAY_MATTER_AND_NOBODY_CAN_SAY)}</p>
  <p class="note"><strong>And running is not prevented.</strong> ${esc(WHAT_RUNNING_COSTS)}</p>
  <dl class="dispute"><dt>What a person walks out into on the morning after</dt>${afterwards}</dl>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE TAB
// ─────────────────────────────────────────────────────────────────────────

/**
 * Rows a reader can actually browse on this tab.
 *
 * Derived rather than stated, because it is the tab's own count on the nav bar
 * and a hand-kept figure there goes wrong the first time anybody adds a price.
 */
export function belowTheLadderRowCount(): number {
    return PRICES.length
        + OCCUPATIONS.length
        + CONTRACTS.length
        + HOUSE_MISSIONS.length
        + SETTLEMENTS.length
        + SETTLEMENT_FEARS.length
        + ROGUE_TRADES.length
        + BOUNTIES.length
        + DEALERS.length
        + AUCTION_VENUES.length
        + ROAD_CUSTOMS.length
        + FALLEN.length;
}

/**
 * The tab, in the order somebody arriving from outside would want it: what
 * things cost, where people live, what it is to have no house, what the road
 * will trade with you, what it leaves behind, and what being taken is.
 */
export function renderBelowTheLadderSections(): string {
    return [
        pricesSection(),
        settlementsSection(),
        roguesSection(),
        roadMarketSection(),
        fallenSection(),
        indentureSection()
    ].join('\n');
}
