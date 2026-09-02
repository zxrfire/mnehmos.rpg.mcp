/**
 * The page must never print its own tags at the player.
 *
 * `web/app.js` builds every surface with one tagged template, `html``, whose
 * whole point is that it ESCAPES each interpolation unless the value is wrapped
 * in `raw()`. That is the right default - player text, engine text and narrator
 * prose all arrive through it and none of them may become markup. The cost is
 * that a template nested inside another template is, to the outer one, just a
 * string, so it gets escaped like any other and its tags come out as visible
 * text:
 *
 *     ${cond ? html`<span>...</span>` : ''}      // prints "<span>...</span>"
 *     ${cond ? raw(html`<span>...</span>`) : ''} // renders a span
 *
 * This has now shipped twice. The seclusion report opened with a literal
 * paragraph tag in front of the prose and its closing tag after it, on the one
 * branch most early runs reach. Three more sat in the Dao panel of the
 * cultivator sheet, printing the cultivation-rate and breakthrough lines as
 * markup to anybody who had comprehended anything.
 *
 * Both were found by a person looking at the screen, because nothing else
 * looks: `app.js` is a browser asset with no module boundary and no test around
 * it, the escaping is doing exactly what it was asked to do, and the mistake is
 * invisible in review - the correct and incorrect lines differ by four
 * characters and sit next to each other.
 *
 * So this is a static read of the file rather than a rendering test. It parses
 * template nesting and asserts that every `html`` opened inside another
 * template's `${ }` is inside an open `raw(` - which covers `raw(html``...`)`
 * and `raw(xs.map(x => html``...`).join(''))` alike, since in both the string
 * ends up as raw()'s argument.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../../web/app.js', import.meta.url));

/**
 * Line numbers of every nested html`` whose result is not wrapped in raw().
 *
 * Deliberately a scanner rather than a regex: `${` and the `html`` it contains
 * are routinely on different lines, and the enclosing expression can be an
 * arrow function body several lines further in.
 */
function unwrappedNestedTemplates(src: string): number[] {
    // A `{` inside an interpolation is an ordinary block or object brace - an
    // arrow-function body, most often - and is NOT a new interpolation. Keeping
    // the two apart is the whole difficulty: conflating them makes every
    // `raw(xs.map((x) => { ... return html`...`; }))` look unwrapped, because
    // the search for the enclosing `raw(` then starts at the arrow's brace
    // instead of at the `${` that actually opened the expression.
    type Frame = { kind: 'tpl' | 'interp' | 'brace'; start: number };
    const stack: Frame[] = [];
    const found: number[] = [];

    const enclosingInterp = () => {
        for (let k = stack.length - 1; k >= 0; k--) {
            if (stack[k].kind === 'interp') return stack[k];
            if (stack[k].kind === 'tpl') return null;   // a template of its own
        }
        return null;
    };

    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (c === '\\') { i++; continue; }
        const top = stack[stack.length - 1];

        if (top && top.kind === 'tpl') {
            if (c === '`') { stack.pop(); continue; }
            if (c === '$' && src[i + 1] === '{') { stack.push({ kind: 'interp', start: i + 2 }); i++; continue; }
            continue;
        }

        if (c === '`') {
            const interp = /html$/.test(src.slice(Math.max(0, i - 4), i)) ? enclosingInterp() : null;
            if (interp) {
                const region = src.slice(interp.start, i - 4);
                let open = 0;
                for (let k = 0; k < region.length; k++) {
                    if (region.startsWith('raw(', k)) { open++; k += 3; continue; }
                    if (region[k] === '(') { if (open > 0) open++; }
                    else if (region[k] === ')') { if (open > 0) open--; }
                }
                if (open === 0) found.push(src.slice(0, i).split(/\r?\n/).length);
            }
            stack.push({ kind: 'tpl', start: i });
            continue;
        }

        if (top && (top.kind === 'interp' || top.kind === 'brace')) {
            if (c === '{') { stack.push({ kind: 'brace', start: i + 1 }); continue; }
            if (c === '}') { stack.pop(); continue; }
        }
    }
    return [...new Set(found)];
}

describe('the page never prints its own markup', () => {
    it('wraps every nested template in raw()', () => {
        const src = readFileSync(APP, 'utf8');
        const offenders = unwrappedNestedTemplates(src).map(line => {
            const text = src.split(/\r?\n/)[line - 1].trim();
            return `web/app.js:${line}  ${text.slice(0, 110)}`;
        });
        expect(offenders, offenders.join('\n')).toEqual([]);
    });

    it('is a scanner that would actually have caught the two that shipped', () => {
        // The shape that shipped, and the shape that is correct, so a rewrite of
        // the scanner cannot quietly stop detecting anything.
        const broken = 'const body = html`<div>${n ? html`<p>${x}</p>` : \'\'}</div>`;';
        const fixed = 'const body = html`<div>${n ? raw(html`<p>${x}</p>`) : \'\'}</div>`;';
        const mapped = 'const body = html`<ul>${raw(xs.map((x) => html`<li>${x}</li>`).join(\'\'))}</ul>`;';

        expect(unwrappedNestedTemplates(broken)).toHaveLength(1);
        expect(unwrappedNestedTemplates(fixed)).toEqual([]);
        // The common safe idiom must not be reported, or the guard gets muted.
        expect(unwrappedNestedTemplates(mapped)).toEqual([]);
    });
});
