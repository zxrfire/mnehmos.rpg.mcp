/**
 * Read every llm-results/*.json and write one page to review them by.
 *
 *   npx tsx scripts/how-the-models-did.ts
 *
 * The number that matters is not the answered rate - after the binding fixes
 * every model answers nearly everything. It is the PARITY split: a reader that
 * resolves the giving half worse than the taking half has an opinion the engine
 * does not, and the chart is there to make that visible at a glance.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Row {
    scenario: string; sign: string; said: string; outcome: string;
    calls: string; moved: string; narration: string;
    /** How much the sentence was asking for. Absent on runs taken before it existed. */
    asks?: string;
}
interface Run {
    model: string; at: string; answered: number; shrugged: number; total: number; rows: Row[];
}

const dir = 'llm-results';
const runs: Run[] = readdirSync(dir).filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Run)
    // A filtered run is a couple of turns and would sit on the page as a model
    // that answered everything. Full runs only.
    .filter(r => r.rows.length >= 20)
    .sort((a, b) => a.model.localeCompare(b.model));

if (runs.length === 0) { console.log('no results yet'); process.exit(0); }

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));
/**
 * A refusal is usually a GOOD turn: the theft ran and the world punished it,
 * nobody present is crossing, no method means no cultivation. Counting those as
 * failures made the deterministic reader look 22 points worse than it is.
 *
 * What is always a failure is a target that did not bind - the turn reached the
 * right verb and then could not find who it was about. `engine.resolveParty` in
 * the call list with nothing after it is exactly that, and it is the failure
 * this whole session has been closing.
 */
const unbound = (row: Row) =>
    row.outcome !== 'ran' && /engine\.resolveParty/.test(row.calls);

/**
 * The act happened, or the world refused it for a reason.
 *
 * A QUESTION BACK IS NEITHER, and counting it as a win hid three real failures
 * inside a band reading 100%: "I go to Cold Peak and gather herbs" came back
 * with *which comes first?*, which is right for a reader that cannot tell the
 * order and is not the sentence being carried out. Asking is legitimate and it
 * is a separate column, because a game that answers every sentence with a
 * question is not playable and would have scored perfectly here.
 */
const answeredWell = (row: Row) =>
    row.outcome !== 'shrug' && row.outcome !== 'asked' && !unbound(row);

const bySign = (r: Run, sign: string) => {
    const of = r.rows.filter(x => x.sign === sign);
    return { n: of.length, ran: of.filter(answeredWell).length };
};

/**
 * THE SPLIT THAT MATTERS MOST, and the one an average hides.
 *
 * The design owner: *ones that require multiple MCP calls, cuz that's the big
 * one, right?* A reader can be perfect on one verb with one target and useless
 * on "I kill their entire family", and a single answered-rate will not say so.
 */
const HOW_MUCH: ReadonlyArray<[string, string]> = [
    ['one_act', 'one act'],
    ['a_set', 'a set'],
    ['several_acts', 'several acts'],
    ['a_goal', 'a goal'],
    ['a_description', 'a description'],
    ['another_word_for_it', 'another word for it']
];

const byAsk = (r: Run, ask: string) => {
    const of = r.rows.filter(x => (x.asks ?? 'one_act') === ask);
    return { n: of.length, ran: of.filter(answeredWell).length };
};

const scenarios = [...new Set(runs.flatMap(r => r.rows.map(x => x.scenario)))];

const bar = (label: string, value: number, colour: string) =>
    `<div class=row><span class=lab>${label}</span>`
    + `<span class=track><span class=fill style="width:${value}%;background:${colour}"></span></span>`
    + `<span class=num>${value}%</span></div>`;

const cards = runs.map(r => {
    const t = bySign(r, 'taking'), g = bySign(r, 'giving'), i = bySign(r, 'indifferent');
    const gap = Math.abs(pct(t.ran, t.n) - pct(g.ran, g.n));
    return `<section>
  <h2>${r.model}</h2>
  <p class=meta>${new Date(r.at).toLocaleString()} &middot; ${r.total} turns &middot;
     ${r.shrugged} shrug${r.shrugged === 1 ? '' : 's'} &middot;
     ${r.rows.filter(x => x.outcome === 'asked').length} asked back &middot;
     ${r.rows.filter(unbound).length} unbound</p>
  ${bar('reached an answer', pct(r.rows.filter(answeredWell).length, r.total), '#3b6ea5')}
  ${bar('target did not bind', pct(r.rows.filter(unbound).length, r.total), '#a5443b')}
  ${bar('asked back', pct(r.rows.filter(x => x.outcome === 'asked').length, r.total), '#c08a2e')}
  ${bar('taking ran', pct(t.ran, t.n), '#a5443b')}
  ${bar('giving ran', pct(g.ran, g.n), '#3b8a5a')}
  ${bar('indifferent ran', pct(i.ran, i.n), '#777')}
  <p class=split>How much the sentence was asking for</p>
  ${HOW_MUCH.map(([key, label]) => {
        const a = byAsk(r, key);
        return a.n === 0 ? '' : bar(`${label} (${a.n})`, pct(a.ran, a.n), '#5a4fa5');
    }).join('')}
  <p class="${gap > 15 ? 'bad' : 'ok'}">taking vs giving: ${gap} points apart${
        gap > 15 ? ' &mdash; the reader has a view the engine does not' : ''}</p>
</section>`;
}).join('\n');

const table = `<table><thead><tr><th>scenario</th>${
    runs.map(r => `<th>${r.model}</th>`).join('')}</tr></thead><tbody>${
    scenarios.map(s => `<tr><td>${s}</td>${runs.map(r => {
        const of = r.rows.filter(x => x.scenario === s);
        const shrug = of.filter(x => x.outcome === 'shrug').length;
        const asked = of.filter(x => x.outcome === 'asked').length;
        const refused = of.filter(x => x.outcome === 'refused').length;
        const cls = shrug > 0 ? 'shrug' : asked > 0 ? 'asked' : refused > 0 ? 'refused' : 'ran';
        const said = shrug ? `${shrug} shrug`
            : asked ? `${asked} asked`
                : refused ? `${refused} refused` : 'ran';
        return `<td class=${cls}>${said}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table>`;

writeFileSync(join(dir, 'index.html'), `<!doctype html><meta charset=utf-8>
<title>How the models did</title>
<style>
 body{font:14px/1.5 system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#222}
 h1{font-size:1.3rem} h2{font-size:1rem;margin:0 0 .2rem}
 section{border:1px solid #ddd;border-radius:6px;padding:1rem;margin:1rem 0}
 .meta{color:#666;margin:0 0 .8rem;font-size:.85rem}
 .row{display:flex;align-items:center;gap:.5rem;margin:.25rem 0}
 .lab{width:9rem;font-size:.85rem;color:#444} .num{width:3rem;text-align:right;font-variant-numeric:tabular-nums}
 .track{flex:1;height:12px;background:#eee;border-radius:6px;overflow:hidden}
 .fill{display:block;height:100%}
 .bad{color:#a5443b;font-weight:600} .ok{color:#3b8a5a}
 .split{margin:.9rem 0 .2rem;font-size:.8rem;color:#666;text-transform:uppercase;letter-spacing:.04em}
 table{border-collapse:collapse;width:100%;margin-top:1.5rem;font-size:.85rem}
 th,td{border:1px solid #ddd;padding:.35rem .5rem;text-align:left}
 td.ran{background:#eaf5ee} td.refused{background:#fdf6e3} td.shrug{background:#fbeaea}
 td.asked{background:#fdf0dc}
</style>
<h1>How the models did</h1>
<p>A <strong>refusal is usually a good turn</strong> - the theft ran and the world punished it,
nobody present is crossing, no method means no cultivation. What is always a failure is a
<strong>target that did not bind</strong>: the right verb reached, and then no one to point it at.
The other number to read is the <strong>taking / giving</strong> split - the engine does not grade,
so a reader that resolves one half better than the other has an opinion it does not have.
The <strong>how much was being asked</strong> bars are the split to read next: one verb with one
target is the floor, and what a player actually types is a set, a sequence, or a goal with no verb
in it at all.</p>
${cards}
<h2>By scenario</h2>
${table}
<p class=meta>Transcripts are the .txt files beside this page.</p>
`, 'utf-8');

console.log(`wrote ${dir}/index.html  (${runs.length} model${runs.length === 1 ? '' : 's'})`);
for (const r of runs) {
    const t = bySign(r, 'taking'), g = bySign(r, 'giving');
    console.log(`  ${r.model.padEnd(24)} answered ${pct(r.rows.filter(answeredWell).length, r.total)}%  `
        + `taking ${pct(t.ran, t.n)}%  giving ${pct(g.ran, g.n)}%  `
        + `shrugs ${r.shrugged}  asked ${r.rows.filter(x => x.outcome === 'asked').length}  `
        + `unbound ${r.rows.filter(unbound).length}`);
    const asked = HOW_MUCH
        .map(([key, label]) => [label, byAsk(r, key)] as const)
        .filter(([, a]) => a.n > 0)
        .map(([label, a]) => `${label} ${pct(a.ran, a.n)}%`);
    if (asked.length > 0) console.log(`    ${asked.join('  ')}`);
}
