/**
 * The Standing Register: every body in the world, on the one ladder.
 *
 * This is a VIEW, and the distinction matters more here than usual. Nothing in
 * this file authors anything - it reads the catalogs and arranges them, so
 * regenerating the sheet is a function call rather than an editing session, and
 * it cannot drift from what the engine actually believes. If a figure here looks
 * wrong, the catalog is wrong.
 *
 * Two consumers, one build:
 *
 *   GET /api/admin/register        the structure, as JSON, for tooling
 *   GET /api/admin/register.html   the same structure rendered, for reading
 *   npm run register               writes the rendered sheet to a file
 *
 * ADMIN ONLY, for the ordinary reason rather than a security one: the sheet
 * states plainly what the world spends enormous effort keeping unstated. It
 * names the two apexes a starting cultivator is `unaware` of, prints which
 * sealed ancestors are not publicly known, and lists a wanderer whose entire
 * design is that nobody knows he exists. Handing it to a player is handing them
 * the answer key.
 */

import {
    SECTS,
    SECT_ANCESTRY,
    WITHDRAWN_POWERS,
    getSect,
    sectThreat
} from '../data/cultivation/sects.js';
import {
    APEX_INSTITUTIONS,
    COURTS,
    FACTION_PARENTAGE,
    getApexInstitution,
    getCourt
} from '../data/cultivation/hierarchy.js';
import { IMMORTAL_CHANNELS, LINEAGE_STANDINGS } from '../data/cultivation/crossings.js';
import { IMMORTAL_ITEMS, IMMORTAL_HOLDINGS } from '../data/cultivation/immortal-items.js';
import { WANDERERS } from '../data/cultivation/wanderers.js';
import { REALM_TIERS, rankName, realmForOrdinal } from '../engine/cultivation/realms.js';

// ─────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────

export interface RegisterRow {
    id: string;
    name: string;
    /** Strongest ACTING member. Never the sealed ceiling. */
    ordinal: number;
    rank: string;
    realm: string;
    alignment: string;
    admissionOrdinal: number;
    recruits: boolean;
    governance: string;
    standing: string;
    parentId: string | null;
    /** Set only where something sealed raises what the body could field once. */
    sealedCeiling: number | null;
    isDaoHouse: boolean;
}

export interface RegisterApex {
    id: string;
    name: string;
    ordinal: number;
    secondStrongestOrdinal: number;
    heritage: string;
    stock: string;
    startingAwareness: string;
    giftName: string;
    instability: string;
    courts: { id: string; name: string; ordinal: number }[];
}

export interface RegisterSealed {
    hostId: string;
    hostName: string;
    hostOrdinal: number;
    name: string;
    ordinal: number;
    sealGrade: string;
    publiclyKnown: boolean;
    dormantYears: number;
    wakeCondition: string;
}

export interface WorldRegister {
    generatedAt: string;
    counts: {
        factions: number;
        apexes: number;
        courts: number;
        sealed: number;
        wanderers: number;
        immortalObjects: number;
    };
    ladder: { key: string; name: string; start: number; end: number }[];
    apexes: RegisterApex[];
    rows: RegisterRow[];
    sealed: RegisterSealed[];
    channels: {
        factionId: string;
        name: string;
        kind: string;
        crossings: number;
        tier: string | null;
        depletion: string | null;
        mostRecentCrossingYearsAgo: number | null;
    }[];
    items: { id: string; name: string; form: string; effect: string; knownCount: number }[];
    holdings: { factionId: string; name: string; itemId: string; count: number }[];
    wanderers: {
        id: string;
        recordName: string;
        commonName: string;
        lastOrdinal: number;
        outcome: string;
        crossingYearsAgo: number;
        affiliationId: string | null;
    }[];
    withdrawn: { factionId: string; name: string; count: number; occupiedBy: string }[];
    /**
     * Everybody at Grand Ascension, drawn from every kind of entity at once.
     *
     * This band is the top of the world anyone can actually meet, and it is the
     * one the faction table hides: courts are not factions, an apex second is
     * not an institution, and a sealed sleeper is not an acting member. Read the
     * catalogs one at a time and the band looks nearly empty. It is not.
     */
    grandAscension: {
        name: string;
        ordinal: number;
        kind: string;
        note: string;
    }[];
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD
// ─────────────────────────────────────────────────────────────────────────

function nameOf(id: string): string {
    return getSect(id)?.name ?? getApexInstitution(id)?.name ?? getCourt(id)?.name ?? id;
}

/**
 * Assemble the whole sheet from the catalogs.
 *
 * Pure apart from the timestamp: no database, no run, no player. The register
 * describes the world, not a game in progress, which is why it is safe to call
 * before a run exists and why two calls a second apart agree.
 */
export function buildRegister(): WorldRegister {
    const rows: RegisterRow[] = SECTS.map(sect => {
        const parentage = FACTION_PARENTAGE[sect.id];
        const threat = sectThreat(sect.id);
        return {
            id: sect.id,
            name: sect.name,
            ordinal: sect.powerOrdinal,
            rank: rankName(sect.powerOrdinal),
            realm: realmForOrdinal(sect.powerOrdinal).name,
            alignment: sect.alignment,
            admissionOrdinal: sect.admissionOrdinal,
            recruits: sect.recruits,
            governance: parentage?.governance ?? 'unrecorded',
            standing: parentage?.standing ?? 'not_applicable',
            parentId: parentage?.parentFactionId ?? null,
            // Only report a ceiling that is genuinely higher. Not everything
            // sealed raises one, and claiming otherwise would overstate a host
            // whose sleeper is weaker than its own elders.
            sealedCeiling: threat && threat.ceiling > threat.acting ? threat.ceiling : null,
            isDaoHouse: sect.id.startsWith('house-')
        };
    }).sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name));

    const apexes: RegisterApex[] = APEX_INSTITUTIONS.map(a => ({
        id: a.id,
        name: a.name,
        ordinal: a.powerOrdinal,
        secondStrongestOrdinal: a.secondStrongestOrdinal,
        heritage: a.heritage,
        stock: a.stock.remaining,
        startingAwareness: a.startingAwareness,
        giftName: a.sentDown.name,
        instability: a.instability,
        courts: COURTS.filter(c => c.apexId === a.id)
            .map(c => ({ id: c.id, name: c.name, ordinal: c.powerOrdinal }))
    })).sort((x, y) => y.ordinal - x.ordinal);

    const sealed: RegisterSealed[] = Object.entries(SECT_ANCESTRY)
        .flatMap(([hostId, record]) => {
            const d = record.dormant;
            if (!d) return [];
            return [{
                hostId,
                hostName: nameOf(hostId),
                hostOrdinal: getSect(hostId)?.powerOrdinal ?? 0,
                name: d.name,
                ordinal: d.realmOrdinal,
                sealGrade: d.sealGrade,
                publiclyKnown: d.publiclyKnown,
                dormantYears: d.dormantYears,
                wakeCondition: d.wakeCondition
            }];
        })
        .sort((a, b) => b.ordinal - a.ordinal);

    const channels = IMMORTAL_CHANNELS.map(ch => {
        const standing = LINEAGE_STANDINGS.find(s => s.factionId === ch.factionId);
        return {
            factionId: ch.factionId,
            name: nameOf(ch.factionId),
            kind: ch.kind,
            crossings: standing?.count ?? 0,
            tier: standing?.tier ?? null,
            depletion: standing?.depletion ?? null,
            mostRecentCrossingYearsAgo: standing?.mostRecentCrossingYearsAgo ?? null
        };
    }).sort((a, b) => b.crossings - a.crossings);

    return {
        generatedAt: new Date().toISOString(),
        counts: {
            factions: rows.length,
            apexes: apexes.length,
            courts: COURTS.length,
            sealed: sealed.length,
            wanderers: WANDERERS.length,
            immortalObjects: IMMORTAL_HOLDINGS.reduce((n, h) => n + h.count, 0)
        },
        ladder: REALM_TIERS.map(t => ({
            key: t.key, name: t.name, start: t.ordinalStart, end: t.ordinalEnd
        })),
        apexes,
        rows,
        sealed,
        channels,
        items: IMMORTAL_ITEMS.map(i => ({
            id: i.id, name: i.name, form: i.form, effect: i.effect, knownCount: i.knownCount
        })),
        holdings: IMMORTAL_HOLDINGS.map(h => ({
            factionId: h.factionId, name: nameOf(h.factionId), itemId: h.itemId, count: h.count
        })),
        wanderers: WANDERERS.map(w => ({
            id: w.id,
            recordName: w.recordName,
            commonName: w.commonName,
            lastOrdinal: w.lastOrdinal,
            outcome: w.crossingOutcome,
            crossingYearsAgo: w.crossingYearsAgo,
            affiliationId: w.affiliation?.factionId ?? null
        })),
        withdrawn: Object.entries(WITHDRAWN_POWERS).map(([factionId, w]) => ({
            factionId, name: nameOf(factionId), count: w.count, occupiedBy: w.occupiedBy
        })),
        grandAscension: [
            ...rows
                .filter(r => r.ordinal >= 37 && r.ordinal <= 40)
                .map(r => ({ name: r.name, ordinal: r.ordinal, kind: 'faction', note: 'strongest acting member' })),
            ...COURTS.map(c => ({
                name: c.name,
                ordinal: c.powerOrdinal,
                kind: 'court',
                note: 'administers an arterial vein for ' + (getApexInstitution(c.apexId)?.name ?? c.apexId)
            })).filter(c => c.ordinal >= 37 && c.ordinal <= 40),
            ...APEX_INSTITUTIONS.map(a => ({
                name: a.name + ' - second seat',
                ordinal: a.secondStrongestOrdinal,
                kind: 'apex second',
                note: 'the strongest at ' + a.name + ' after the one who does not stand up'
            })).filter(a => a.ordinal >= 37 && a.ordinal <= 40),
            ...sealed
                .filter(x => x.ordinal >= 37 && x.ordinal <= 40)
                .map(x => ({
                    name: x.name,
                    ordinal: x.ordinal,
                    kind: 'sealed',
                    note: 'asleep under ' + x.hostName + ', ' + x.sealGrade + ' seal'
                }))
        ].sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name))
    };
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER
//
// Self-contained: one document, inline styles, no fetches. It is served to an
// operator, saved to a file, and pasted into things, and every one of those
// stops working the moment it needs a stylesheet from somewhere.
// ─────────────────────────────────────────────────────────────────────────

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const STYLE = `
:root{--ground:#EDF0F1;--panel:#F7F9F9;--ink:#12181C;--quiet:#5C6E74;--faint:#8C9BA0;
--rule:#C4D0D3;--strong:#9AAAAF;--datum:#14545F;--datum-soft:#DCE8EA;--signal:#9E4A16;--signal-soft:#F0E0D3;}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ground:#0C1113;--panel:#131A1D;
--ink:#DFE7E9;--quiet:#93A5AA;--faint:#64777D;--rule:#263337;--strong:#3A4C52;--datum:#6BB6C4;
--datum-soft:#173136;--signal:#D2884D;--signal-soft:#342315;}}
:root[data-theme="dark"]{--ground:#0C1113;--panel:#131A1D;--ink:#DFE7E9;--quiet:#93A5AA;--faint:#64777D;
--rule:#263337;--strong:#3A4C52;--datum:#6BB6C4;--datum-soft:#173136;--signal:#D2884D;--signal-soft:#342315;}
*{box-sizing:border-box}
body{background:var(--ground);color:var(--ink);margin:0;padding:0 clamp(14px,4vw,44px) 80px;
font:16px/1.6 Newsreader,Georgia,"Times New Roman",serif;-webkit-font-smoothing:antialiased}
.sheet{max-width:1080px;margin:0 auto}
.mast{padding:clamp(30px,6vw,64px) 0 24px;border-bottom:2px solid var(--ink)}
.mark{font:11px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;
color:var(--faint);display:flex;flex-wrap:wrap;gap:6px 20px;margin-bottom:18px}
h1{font:700 clamp(34px,7vw,68px)/.97 Archivo,"Helvetica Neue",Arial,sans-serif;letter-spacing:-.025em;
margin:0 0 12px;text-wrap:balance}
.stand{font-size:clamp(16px,2vw,20px);line-height:1.5;color:var(--quiet);max-width:60ch;margin:0;font-weight:300}
.stand em{color:var(--ink);font-style:italic}
section{padding-top:clamp(36px,5vw,60px)}
.sh{display:flex;align-items:baseline;gap:16px;border-bottom:1px solid var(--strong);padding-bottom:8px;margin-bottom:20px}
.sh h2{font:600 clamp(19px,2.4vw,26px)/1.2 Archivo,"Helvetica Neue",Arial,sans-serif;letter-spacing:-.012em;margin:0;flex:1}
.sh .r{font:11px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;
color:var(--faint);white-space:nowrap}
.note{max-width:68ch;color:var(--quiet);margin:0 0 20px}
.note strong{color:var(--ink);font-weight:500}
.chip{display:inline-block;font:500 10px/1.5 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;
text-transform:uppercase;padding:2px 7px;border:1px solid var(--strong);color:var(--quiet);white-space:nowrap}
.chip.pin{border-color:var(--datum);color:var(--datum);background:var(--datum-soft)}
.chip.wd{border-color:var(--datum);color:var(--datum)}
.chip.sl{border-style:dashed}
.chip.ex{border-color:var(--signal);color:var(--signal);background:var(--signal-soft)}
.scroll{overflow-x:auto;border:1px solid var(--rule);background:var(--panel);margin-bottom:14px}
table{border-collapse:collapse;width:100%;font-size:15px;min-width:600px}
caption{text-align:left;font:11px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;
text-transform:uppercase;color:var(--faint);padding:10px 14px;border-bottom:1px solid var(--rule)}
th{text-align:left;font:600 10px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;
text-transform:uppercase;color:var(--quiet);padding:9px 14px;border-bottom:1px solid var(--strong);white-space:nowrap}
td{padding:9px 14px;border-bottom:1px solid var(--rule);vertical-align:top}
tbody tr:last-child td{border-bottom:none}
td.n{font:500 15px "IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;
color:var(--datum);white-space:nowrap}
td.nm{font:500 15px Archivo,"Helvetica Neue",Arial,sans-serif;white-space:nowrap}
td.q{color:var(--quiet);font-size:14.5px}
td.m{font:12.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--quiet);white-space:nowrap}
tr.brk td{border-top:2px solid var(--strong)}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;vertical-align:middle;margin-right:7px}
.dot.righteous{background:var(--datum)}.dot.neutral{background:var(--faint)}.dot.demonic{background:var(--signal)}
.cards{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(270px,1fr))}
.card{border:1px solid var(--rule);border-top:3px solid var(--datum);background:var(--panel);padding:18px;
display:flex;flex-direction:column;gap:10px}
.card.recent{border-top-color:var(--signal)}
.card h3{font:600 19px Archivo,"Helvetica Neue",Arial,sans-serif;margin:0;letter-spacing:-.01em}
.card .gift{font:600 14px Archivo,"Helvetica Neue",Arial,sans-serif;color:var(--ink)}
.card p{margin:0;font-size:14.5px;color:var(--quiet)}
.met{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--rule);border:1px solid var(--rule)}
.met div{background:var(--panel);padding:8px 10px}
.met dt{font:10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;
color:var(--faint);margin:0 0 3px}
.met dd{margin:0;font:500 15px "IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}
.prose{border-left:3px solid var(--datum);background:var(--datum-soft);padding:14px 18px;margin:0 0 14px;max-width:70ch;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.prose p{margin:0;font-size:15.5px;line-height:1.62;color:var(--ink);font-style:italic}
foot,footer{margin-top:clamp(48px,7vw,80px);border-top:2px solid var(--ink);padding-top:16px;
font:11px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.06em;color:var(--faint);
display:flex;flex-wrap:wrap;gap:8px 26px}
`;

function row(r: RegisterRow): string {
    const ceiling = r.sealedCeiling === null
        ? ''
        : ` <span class="chip sl">ceiling ${r.sealedCeiling}</span>`;
    const gate = r.recruits ? String(r.admissionOrdinal) : 'closed';
    return `<tr><td class="n">${r.ordinal}</td>`
        + `<td class="nm"><span class="dot ${esc(r.alignment)}"></span>${esc(r.name)}${ceiling}</td>`
        + `<td class="m">${gate}</td><td class="m">${esc(r.governance)}</td>`
        + `<td class="m">${esc(r.standing)}</td>`
        + `<td class="q">${esc(r.rank)}${r.isDaoHouse ? ' · Dao house' : ''}</td></tr>`;
}

/**
 * Render one curated paragraph, where there is one.
 *
 * Visually distinct from everything around it on purpose. The tables are the
 * catalog and this is a model talking about the catalog, and a reader must
 * never have to guess which they are looking at. A stale block keeps its text
 * and says so rather than vanishing - a dated paragraph that admits it is dated
 * is worth more than a hole.
 */
function prose(blocks: Record<string, { text: string; stale?: boolean }> | undefined, id: string): string {
    const block = blocks?.[id];
    if (!block || !block.text) return '';
    const flag = block.stale
        ? '<span class="chip ex">behind the catalog</span>'
        : '';
    return `<aside class="prose">${flag}<p>${esc(block.text)}</p></aside>`;
}

/** The whole sheet as one self-contained document. */
export function renderRegisterHtml(
    reg: WorldRegister,
    blocks?: Record<string, { text: string; stale?: boolean }>
): string {
    const c = reg.counts;
    const stamp = reg.generatedAt.replace('T', ' ').slice(0, 16) + ' UTC';

    const apexCards = reg.apexes.map(a => `
      <article class="card${a.heritage === 'recent' ? ' recent' : ''}">
        <h3>${esc(a.name)}</h3>
        <p class="gift">${esc(a.giftName)}</p>
        <div class="met">
          <div><dt>Ordinal</dt><dd>${a.ordinal}</dd></div>
          <div><dt>Next below</dt><dd>${a.secondStrongestOrdinal}</dd></div>
          <div><dt>Heritage</dt><dd>${esc(a.heritage)}</dd></div>
          <div><dt>Stock</dt><dd>${esc(a.stock.replace('_', ' '))}</dd></div>
        </div>
        <p><strong>Known as:</strong> ${esc(a.startingAwareness)}${
            a.courts.length ? ' · courts: ' + a.courts.map(x => esc(x.name) + ' (' + x.ordinal + ')').join(', ') : ' · no courts'
        }</p>
        <p>${esc(a.instability)}</p>
      </article>`).join('');

    const bands = REALM_TIERS.slice().reverse()
        .map(t => {
            const inBand = reg.rows.filter(r => r.ordinal >= t.ordinalStart && r.ordinal <= t.ordinalEnd);
            if (inBand.length === 0) return '';
            return `<tr class="brk"><td class="m" colspan="6">${esc(t.name)} · ${t.ordinalStart}-${t.ordinalEnd}</td></tr>`
                + inBand.map(row).join('');
        }).join('');

    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Standing Register</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,500&display=swap">
<style>${STYLE}</style></head><body><div class="sheet">

<header class="mast">
  <div class="mark">
    <span>Standing Register</span>
    <span>${c.factions} factions · ${c.apexes} apexes · ${c.courts} courts</span>
    <span>${c.sealed} sealed · ${c.wanderers} wanderer${c.wanderers === 1 ? '' : 's'}</span>
    <span>${c.immortalObjects} immortal objects</span>
    <span>${esc(stamp)}</span>
  </div>
  <h1>The Standing Register</h1>
  <p class="stand">Every body in the world, placed on the one ladder. Ordinal is the realm of the strongest <em>acting</em> member - the person who answers a challenge, walks a border, sits at a negotiation. It is not what a body could field once, at cost, and that distinction is the whole of the register.</p>
</header>

<section>
  <div class="sh"><h2>The apexes</h2><span class="r">Founded by a crossing · holds what was sent down</span></div>
  <p class="note">An apex received something from an ascended founder <strong>and can hold it</strong>. The second half is the whole test. Age runs backwards for consumables: an ancient apex has depth of position and an empty storehouse, a young one has a shallow position and a nearly full one.</p>
  <div class="cards">${apexCards}</div>
  ${prose(blocks, 'apexes')}
</section>

<section>
  <div class="sh"><h2>Who is still answering</h2><span class="r">The real hierarchy</span></div>
  <p class="note">Immortal-realm consumables come down and cannot be made or reordered here, so a body holding them has a channel - and a channel means somebody above the Lid still picks up. That, not vein wealth or realm distribution, is the actual ranking.</p>
  <div class="scroll"><table><caption>Crossings produced · channel · depletion</caption>
  <thead><tr><th>Crossings</th><th>Body</th><th>Tier</th><th>Most recent</th><th>Channel</th><th>Depletion</th></tr></thead><tbody>
  ${reg.channels.map(ch => `<tr><td class="n">${ch.crossings}</td><td class="nm">${esc(ch.name)}</td>`
        + `<td class="q">${esc((ch.tier ?? '-').replace(/_/g, ' '))}</td>`
        + `<td class="m">${ch.mostRecentCrossingYearsAgo === null ? '-' : ch.mostRecentCrossingYearsAgo.toLocaleString() + ' yr'}</td>`
        + `<td class="q">${esc(ch.kind.replace(/_/g, ' '))}</td>`
        + `<td class="m">${esc(ch.depletion ?? '-')}</td></tr>`).join('')}
  </tbody></table></div>
  ${prose(blocks, 'channels')}
</section>

<section>
  <div class="sh"><h2>Full register</h2><span class="r">${c.factions} factions · by band</span></div>
  <p class="note">Alignment: <span class="dot righteous"></span>righteous <span class="dot neutral"></span>neutral <span class="dot demonic"></span>demonic. <strong>Gate</strong> is the minimum ordinal to be considered at all. A dashed <span class="chip sl">ceiling</span> marks a body holding something sealed that is stronger than anything it can field day to day.</p>
  <div class="scroll"><table><caption>Ordinal = strongest acting member</caption>
  <thead><tr><th>Ord</th><th>Faction</th><th>Gate</th><th>Governance</th><th>Standing</th><th>Rank</th></tr></thead>
  <tbody>${bands}</tbody></table></div>
  ${prose(blocks, 'register')}
</section>

<section>
  <div class="sh"><h2>Grand Ascension</h2><span class="r">Ordinal 37-40 · the top of the visible world</span></div>
  <p class="note">The band the faction table hides, because the people in it are not factions. Courts are offices, an apex second is a person rather than an institution, and a sleeper is not an acting member - so reading the catalogs one at a time makes this band look nearly empty. It is not. This is the highest anyone can be and still be met.</p>
  <div class="scroll"><table><caption>Every kind of entity at once</caption>
  <thead><tr><th>Ord</th><th>Who</th><th>Kind</th><th>Standing</th></tr></thead><tbody>
  ${reg.grandAscension.map(g => `<tr><td class="n">${g.ordinal}</td><td class="nm">${esc(g.name)}</td>`
        + `<td class="m">${esc(g.kind)}</td><td class="q">${esc(g.note)}</td></tr>`).join('')}
  </tbody></table></div>
  ${prose(blocks, 'grandascension')}
</section>

<section>
  <div class="sh"><h2>What is under the mountains</h2><span class="r">Sealed · ${c.sealed} known</span></div>
  <p class="note">A seal cuts both ways. <strong>Defensively</strong> it is the last card and every wake condition is a disaster clause. <strong>Offensively</strong> it is a single use looking for something worth spending it on - and a sect that has quietly reclassified its last card as an opening move looks exactly like one that has not.</p>
  <div class="scroll"><table><caption>Grade decides the band, and grade is a tell - a crude seal cannot be hidden</caption>
  <thead><tr><th>Ord</th><th>Sleeper</th><th>Host</th><th>Seal</th><th>Public</th><th>Wakes on</th></tr></thead><tbody>
  ${reg.sealed.map(s => `<tr><td class="n">${s.ordinal}</td><td class="nm">${esc(s.name)}</td>`
        + `<td class="q">${esc(s.hostName)} · ${s.hostOrdinal}</td><td class="m">${esc(s.sealGrade)}</td>`
        + `<td class="m">${s.publiclyKnown ? 'yes' : 'no'}</td><td class="q">${esc(s.wakeCondition)}</td></tr>`).join('')}
  </tbody></table></div>
  ${prose(blocks, 'sealed')}
</section>

<section>
  <div class="sh"><h2>What came down</h2><span class="r">${c.immortalObjects} objects · unreorderable</span></div>
  <div class="scroll"><table><caption>Every one arrived with somebody who crossed, or was left by somebody who did not</caption>
  <thead><tr><th>Object</th><th>Form</th><th>Effect</th><th>Known</th></tr></thead><tbody>
  ${reg.items.map(i => `<tr><td class="nm">${esc(i.name)}</td><td class="m">${esc(i.form.replace(/_/g, ' '))}</td>`
        + `<td class="q">${esc(i.effect.replace(/_/g, ' '))}</td><td class="n">${i.knownCount}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="scroll"><table><caption>Holdings</caption>
  <thead><tr><th>Holder</th><th>Object</th><th>Count</th></tr></thead><tbody>
  ${reg.holdings.map(h => `<tr><td class="nm">${esc(h.name)}</td><td class="q">${esc(h.itemId.replace('immortal-', '').replace(/-/g, ' '))}</td><td class="n">${h.count}</td></tr>`).join('')}
  </tbody></table></div>
  ${prose(blocks, 'items')}
</section>

<section>
  <div class="sh"><h2>Off the ladder</h2><span class="r">Not an ordinal, on purpose</span></div>
  <p class="note">A crossing survived that did not complete. They did not arrive anywhere - they are standing exactly where they were, changed. Everyone here is <strong>unaware</strong> to an ordinary cultivator: not hard to find, unknown to exist.</p>
  <div class="scroll"><table>
  <thead><tr><th>Last ord</th><th>Recorded as</th><th>Called</th><th>Outcome</th><th>Crossed</th><th>Affiliation</th></tr></thead><tbody>
  ${reg.wanderers.map(w => `<tr><td class="n">${w.lastOrdinal}</td><td class="nm">${esc(w.recordName)}</td>`
        + `<td class="q">${esc(w.commonName)}</td><td class="m">${esc(w.outcome.replace(/_/g, ' '))}</td>`
        + `<td class="m">${w.crossingYearsAgo.toLocaleString()} yr</td>`
        + `<td class="q">${w.affiliationId ? esc(nameOf(w.affiliationId)) : 'none'}</td></tr>`).join('')}
  </tbody></table></div>
  ${prose(blocks, 'offladder')}
</section>

<section>
  <div class="sh"><h2>Awake, and never in the room</h2><span class="r">Withdrawn</span></div>
  ${reg.withdrawn.map(w => `<p class="note"><strong>${esc(w.name)} · ${w.count} at the last realm.</strong> ${esc(w.occupiedBy)}</p>`).join('')}
  <p class="note">Redundancy is what buys reach. An apex holds one, pinned: sending them out uncovers the vault, so they are never sent. More than one means the ground stays covered while somebody leaves.</p>
</section>

<footer>
  <span>Ordinal = strongest acting member</span>
  <span>Ceiling is not availability</span>
  <span>Generated from the catalogs</span>
  <span>${esc(stamp)}</span>
</footer>

</div></body></html>`;
}

/** One call: read the catalogs, return the sheet. */
export function renderRegister(): string {
    return renderRegisterHtml(buildRegister());
}
