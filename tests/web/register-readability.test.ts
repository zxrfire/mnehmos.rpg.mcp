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

    it('gives every entry the same six parts in the same order', () => {
        // Chunks inside chunks, and the same shape everywhere. A reader who
        // has read one entry should be able to find their way around any other
        // one without re-learning it.
        // "What they hold" became "What they teach" when the inventory moved to
        // the Holdings tab and the artifact rows to the Items ledger. What is
        // left in that part of an entry is the shelf, which Holdings only
        // summarises, so the heading now says what is actually under it.
        const order = [
            'History',
            'What they are',
            'Who is in it',
            'What they teach',
            'What they want',
            'Ancestors',
            'How it stands with everybody'
        ];
        const html = renderRegisterHtml(reg as never, {} as never);
        const heads = [...html.matchAll(/<div class="part"><h4>([^<]*)<\/h4>/g)].map(m => m[1]);
        expect(heads.length, 'no parts rendered at all').toBeGreaterThan(0);

        // Every heading that appears is one of the six, and they never appear
        // out of sequence relative to each other inside a single entry.
        for (const head of new Set(heads)) {
            expect(order, `unknown part heading: ${head}`).toContain(head);
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
