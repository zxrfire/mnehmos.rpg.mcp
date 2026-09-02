/**
 * The register has to be readable, and readable is a measurable property here.
 *
 * ONE RULE, ENFORCED ON THE RENDERED PAGE. No chunk a reader lands on may be
 * longer than a short paragraph. That applies to a section and to every
 * sub-section inside one, and it applies to the continuation of an oversized
 * field as much as to the lead - a disclosure holding one enormous paragraph
 * would satisfy the letter of the rule and none of the point of it.
 *
 * The catalog is not held to this and should not be: its fields are the record
 * and are written at the length the thing takes. The limit is a property of the
 * PAGE, so it is asserted against the page.
 */

import { describe, it, expect } from 'vitest';

import { buildRegister, renderRegisterHtml } from '../../src/web/register.js';

/**
 * The limit, stated once here and once in the renderer.
 *
 * A little above the renderer's own figure on purpose. This test is a guard
 * against a chunk nobody split, not a second copy of the splitting rule, and
 * pinning the two together would mean every wording change had to move two
 * numbers. What it is really asserting is that nothing arrives unsplit.
 */
const READABLE = 420;

/** Text content of an element, with tags removed and entities put back. */
function textOf(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&middot;/g, '.')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Every paragraph and definition-list value on the page, as text.
 *
 * `dd` is included because the entry's densest material lives in definition
 * lists - a history, a relationship, a road - and a rule that only looked at
 * paragraphs would have missed all of it. A `dd` that contains a disclosure is
 * measured without it, because the disclosure's own paragraphs are measured
 * separately and counting them twice would fail a chunk that was split
 * correctly.
 */
function readableChunks(html: string): { kind: string; text: string }[] {
    const out: { kind: string; text: string }[] = [];
    for (const match of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
        // Without the disclosure, for the same reason as below: a lead and its
        // continuation are two chunks, and measuring them together would fail a
        // field that had been split exactly as intended.
        const withoutDisclosure = match[1].replace(/<details[\s\S]*?<\/details>/g, '');
        out.push({ kind: 'p', text: textOf(withoutDisclosure) });
    }
    for (const match of html.matchAll(/<dd\b[^>]*>([\s\S]*?)<\/dd>/g)) {
        const withoutDisclosure = match[1].replace(/<details[\s\S]*?<\/details>/g, '');
        out.push({ kind: 'dd', text: textOf(withoutDisclosure) });
    }
    return out;
}

describe('the register reads', () => {
    const reg = buildRegister();
    const html = renderRegisterHtml(reg as never, {} as never);

    it('renders at all', () => {
        expect(html.length).toBeGreaterThan(10_000);
        expect(html).toContain('The Standing Register');
    });

    it('keeps every chunk a reader lands on inside a short paragraph', () => {
        const oversized = readableChunks(html)
            .filter(c => c.text.length > READABLE)
            .map(c => `${c.kind} of ${c.text.length}: ${c.text.slice(0, 110)}...`);
        expect(oversized, `${oversized.length} chunks are too long to read`).toEqual([]);
    });

    it('splits at sentence ends rather than mid-clause', () => {
        // A chunk cut in the middle of a clause is worse than a long one, so
        // the splitter only ever cuts at a sentence boundary. Anything it
        // produced should therefore end like a sentence - or be the tail of a
        // field that simply ended without punctuation, which the catalog does
        // in a few places and which is not this rule's business.
        const truncated = readableChunks(html)
            .filter(c => c.text.length > 200 && c.text.endsWith('...'));
        expect(truncated, 'a chunk was cut rather than split').toEqual([]);
    });

    it('never leaves a continuation empty', () => {
        // A disclosure that opens onto nothing is worse than no disclosure.
        for (const match of html.matchAll(/<details class="more">([\s\S]*?)<\/details>/g)) {
            const body = match[1].replace(/<summary[\s\S]*?<\/summary>/, '');
            expect(textOf(body).length, 'an empty continuation').toBeGreaterThan(0);
        }
    });

    it('gives every continuation a summary that says what is behind it', () => {
        for (const match of html.matchAll(/<details class="more"><summary>([\s\S]*?)<\/summary>/g)) {
            const label = textOf(match[1]);
            expect(label.length, 'an unlabelled continuation').toBeGreaterThan(3);
            expect(label, 'a continuation labelled with a bare count').toMatch(/[a-z]/i);
        }
    });
});

describe('the register is consistent with itself', () => {
    const reg = buildRegister();

    it('keeps a faction entry to the five parts a resume has', () => {
        // THIS TEST USED TO ASSERT SEVEN PARTS AND WAS ENCODING THE DEFECT.
        // It listed 'History' and 'What they teach' among the parts of an
        // entry, which is exactly the arrangement the design owner rejected: a
        // faction entry is a RESUME, read in about thirty seconds by somebody
        // deciding whether they care, and neither a house's full dated history
        // nor its shelf art by art answers "what is this house". Both are now
        // on the pages that own them - the History tab and the Arts tab - and
        // the entry carries a pointer and a count instead.
        //
        // A passing test is evidence, not proof. This one passed for as long
        // as the entry was too long, because it was asserting the length.
        //
        // THIS TEST ENCODED A LAYOUT THAT HAS SINCE BEEN CORRECTED, AND SAYING
        // SO IS THE POINT OF THIS COMMENT. `The roll` is a sixth heading and
        // it was added deliberately, at the design owner's instruction: the
        // named people used to be one `h4` group buried inside `Who is in it`,
        // below the fielding table, the admission bar, the favour stance and
        // the adoption terms, and a list of people you can actually go and
        // meet arriving as the fifth block of a chunk about institutional
        // machinery read as a run-on. The list is a fixed set, not a growing
        // one - the two headings below still must not come back.
        // RENAMED TO THE QUESTION THE READER ARRIVES WITH, not to the field
        // the data sits in. The design owner's verdict on the previous set was
        // that the labels were not obvious, and the headings were part of it:
        // `What they are`, `Who is in it` and `How it stands` name the shape of
        // the record rather than anything anybody wanted to know. A reader
        // arrives asking whether they could join, what it would teach them, and
        // who it is at odds with, and the headings say those now.
        //
        // Still a fixed set, and still not a growing one. The guard below is
        // the load-bearing half of this test.
        const order = [
            'What it is',
            'Could I get in',
            'Who is actually in it',
            'What it is after, and what it is like',
            'Ancestors',
            'Who it knows'
        ];
        const html = renderRegisterHtml(reg as never, {} as never);
        const heads = [...html.matchAll(/<div class="part"><h4>([^<]*)<\/h4>/g)].map(m => m[1]);
        expect(heads.length, 'no parts rendered at all').toBeGreaterThan(0);

        for (const head of new Set(heads)) {
            expect(order, `unknown part heading: ${head}`).toContain(head);
        }
        // And the two that moved must not come back. A part heading is cheap to
        // add and the entry has been re-inflated once already.
        expect(new Set(heads), 'History is back on the entry').not.toContain('History');
        expect(new Set(heads), 'the shelf is back on the entry').not.toContain('What they teach');
    });

    it('cross-references without ever emitting a URL', () => {
        // A faction entry lives inside a pane that is hidden unless its tab is
        // selected, so a fragment link to one is a link to nothing - and the
        // moment a stretch of this sheet is copied out of a browser, every
        // fragment resolves against wherever the register happened to be
        // served. What the design owner saw pasted was a markdown link to
        // http://localhost:8787/api/admin/register.html#court-court-kiln,
        // repeated on every historical event. The href was relative in the
        // markup; the copy resolved it. The only fix that survives a copy is
        // not to emit a URL at all, so every cross-reference goes through
        // data-goto, which switches to the owning tab and then scrolls.
        const html = renderRegisterHtml(reg as never, {} as never);
        const fragments = [...html.matchAll(/<a href="#[^"]*"/g)].map(m => m[0]);
        expect(fragments, 'a cross-reference was emitted as a URL').toEqual([]);
        expect(html).toContain('data-goto=');
    });

    it('states each pair of bodies once rather than from both ends', () => {
        // The catalog stores a tie on both parties, which is right. Rendering
        // it that way meant one feud was written out twice, in two entries a
        // reader would never see together, and that the general rule about
        // what a feud is got restated once per feud. The Ties tab collapses
        // them onto the pair, so each anchor may appear exactly once.
        const html = renderRegisterHtml(reg as never, {} as never);
        const ids = [...html.matchAll(/ id="(tie-[^"]+)"/g)].map(m => m[1]);
        expect(ids.length, 'no ties rendered at all').toBeGreaterThan(10);
        expect(ids.length, 'a tie was rendered twice').toBe(new Set(ids).size);
    });

    it('lands every cross-reference on something that exists', () => {
        // Nine hundred jumps on this sheet and no way to see a dead one: the
        // handler switches tab, finds nothing, and returns, so a broken
        // cross-reference looks exactly like a click that did not register.
        // Two were broken when this was first run, both on the one body filed
        // as a court AND a sect - each of its neighbours reached it by the name
        // the other catalog uses, and the two names keyed to two different
        // records. The anchors are canonical now, which is what makes this
        // assertion possible at all.
        const html = renderRegisterHtml(reg as never, {} as never);
        const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]));
        const targets = [...html.matchAll(/data-goto="([^"]+)"/g)].map(m => m[1]);
        expect(targets.length, 'no cross-references at all').toBeGreaterThan(100);
        const dead = [...new Set(targets.filter(t => !ids.has(t)))];
        expect(dead, 'a cross-reference points at nothing').toEqual([]);

        // And a tab jump, WHERE THERE IS ONE, has to name a tab that exists:
        // a wrong name selects no pane and hides every one of them.
        //
        // THE COUNT IS NO LONGER ASSERTED, AND THAT IS A CORRECTION. This used
        // to require at least one, which was true while the faction resume
        // pointed at four other tabs in running text. The design owner read
        // those and asked for them to go - a link that looks pasted in is
        // worse than a reader navigating by tab, and every one of them sat
        // mid-sentence inside a line of notation. There may legitimately be
        // none now. What must still hold is that any that exist land
        // somewhere, and the `data-goto` check above is the one with teeth.
        const tabs = new Set([...html.matchAll(/data-tab="([a-z]+)"/g)].map(m => m[1]));
        const tabTargets = [...new Set([...html.matchAll(/data-tab-goto="([a-z]+)"/g)].map(m => m[1]))];
        expect(tabTargets.filter(t => !tabs.has(t)), 'a jump names no tab').toEqual([]);
    });

    it('opens the arts tab folded', () => {
        // Four catalogs of tables, a hundred and thirty-eight rows. Opening on
        // all of it at once is a page nobody can navigate, so every section on
        // that tab declares that it starts folded and the reader opens the one
        // they want. A reader's own folding still wins - the default is a
        // starting position, not a preference.
        const html = renderRegisterHtml(reg as never, {} as never);
        const arts = html.slice(
            html.indexOf('<div class="pane" data-pane="arts"'),
            html.indexOf('<div class="pane" data-pane="key"')
        );
        const sections = [...arts.matchAll(/<section([^>]*)>/g)].map(m => m[1]);
        expect(sections.length, 'no sections on the arts tab').toBeGreaterThan(3);
        for (const attrs of sections) {
            expect(attrs, `an arts section opens expanded: ${attrs}`).toContain('startfolded');
        }
    });

    it('never prints a raw enum where a sentence belongs', () => {
        // The defect this guards: the relationships section used to print its
        // stored fields as bare tokens - a warmth word, the string "and back",
        // another warmth word, a tie kind with the underscores swapped out, and
        // "from authored". None of those is a sentence and none of them told a
        // reader anything.
        const html = renderRegisterHtml(reg as never, {} as never);
        // Asserted against the markup that leaked rather than against the
        // words, because the words are ordinary English the catalog uses
        // legitimately - one house wants out from under another "and back"
        // under a third, and a blunt substring check fails on that.
        expect(html).not.toContain('class="relarrow"');
        expect(html).not.toContain('class="relsrc"');
        expect(html).not.toContain('class="relkind"');
        expect(html).not.toMatch(/<span class="warmth [a-z]+">/);
    });

    it('says which direction every relationship runs, in words and in colour', () => {
        const html = renderRegisterHtml(reg as never, {} as never);
        // The badge and the rule carry the same fact, so neither is a legend
        // lookup on its own.
        expect(html).toContain('rel rel--above');
        expect(html).toContain('rel rel--below');
        expect(html).toContain('reldir above');
        expect(html).toContain('reldir below');
        for (const d of reg.dossiers) {
            for (const rel of d.relationships) {
                expect(['above', 'below', 'alongside']).toContain(rel.stance);
            }
        }
    });
});
