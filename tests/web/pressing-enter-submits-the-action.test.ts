/**
 * The page promises `Enter` in so many words, and it has to keep the promise.
 *
 * ── The reason this file exists is a false alarm, twice ──────────────────
 *
 * Under the action box, in the shipped HTML: *"Free text. The narrator
 * interprets, the engine rules. Enter to act."* A documented keystroke that
 * did nothing would be worse than a missing feature - somebody types a
 * sentence, presses Return, watches the turn counter not move and the text sit
 * in the box, and concludes the game hung or that their sentence was rejected.
 *
 * It has now been reported broken twice and **was working both times**, for
 * the same reason each time, and the reason is worth more than the assertions
 * below:
 *
 *   AN AUTOMATED DRIVER SENDING THE KEY AS `Return` PRODUCES A KEYDOWN WHOSE
 *   `key` IS THE EMPTY STRING.
 *
 * Measured against the live page, on the same input, seconds apart:
 *
 *     key "Return"  ->  keydown { key: "", code: "" }   nothing happens
 *     key "Enter"   ->  keydown { key: "Enter" }        box clears, turn moves
 *
 * A real keyboard sends `Enter`. So the symptom - text still in the box, turn
 * counter unmoved - is produced by the tool and is indistinguishable from the
 * bug it looks like, and reproducing it twice with the same tool is one piece
 * of evidence rather than two. Check the driver before checking `app.js`.
 *
 * ── Why it is a static read of the file ──────────────────────────────────
 *
 * `web/app.js` is a browser asset with no module boundary and no export, so
 * there is nothing to import and drive - and, as above, driving it
 * synthetically is exactly what has misled two people. What a static read can
 * prove is that the binding exists and is attached to the right elements,
 * which is the whole of what both false reports were about. That it then
 * fires is a thing a person confirms by playing, and has, twice.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../../web/app.js', import.meta.url));
const PAGE = fileURLToPath(new URL('../../web/index.html', import.meta.url));

const app = (): string => readFileSync(APP, 'utf8');
const page = (): string => readFileSync(PAGE, 'utf8');
const helper = (): string => {
    const found = app().match(/const enterSubmits = [\s\S]*?\n {2}};/);
    expect(found, 'the enterSubmits helper is gone from web/app.js').toBeTruthy();
    return found![0];
};

describe('the keyboard path the page advertises', () => {
    it('says so on the page, which is what makes the rest of this file binding', () => {
        // If this line is ever deleted the promise goes with it and the tests
        // below become a preference rather than a contract. Asserted so that
        // removing the hint and removing the handler are the same decision.
        expect(page()).toMatch(/<kbd>Enter<\/kbd>\s*to act/i);
    });

    it('binds a keydown handler to both text boxes', () => {
        const src = app();
        expect(src).toContain("enterSubmits('#command-input', submitAction)");
        expect(src).toContain("enterSubmits('#begin-name', beginRun)");
    });

    it('binds the form submit as well, so the Act button and Enter agree', () => {
        expect(app()).toContain("$('#command-form').addEventListener('submit', submitAction)");
    });

    it('acts on Enter rather than leaving it to the browser', () => {
        // The implicit form submission is not enough on its own: it does not
        // survive an automated driver, and the first Enter a player presses is
        // on the name field before anything else in the game has happened.
        expect(helper()).toContain("addEventListener('keydown'");
        expect(helper()).toMatch(/e\.key !== 'Enter'/);
        expect(helper()).toContain('handler(e)');
    });

    it('does not double-fire by letting the implicit submission through as well', () => {
        // preventDefault is what stops the same keypress raising a second
        // `submit` on the form. Without it a turn is posted twice.
        expect(helper()).toContain('e.preventDefault()');
    });

    it('leaves an IME composition alone', () => {
        // An Enter that accepts a candidate in an input method is a real Enter
        // that means something else entirely, and submitting on it would eat
        // the half-composed word.
        expect(helper()).toContain('e.isComposing');
    });

    it('keeps both boxes as single-line inputs', () => {
        // The Shift guard in the helper is only coherent while these are
        // `<input type="text">`. If either ever becomes a textarea, Shift+Enter
        // acquires a meaning and that guard has to be revisited rather than
        // left to keep working by accident.
        expect(page()).toMatch(/id="command-input"[\s\S]{0,200}?type="text"/);
        expect(page()).toMatch(/id="begin-name"[\s\S]{0,200}?type="text"/);
    });
});
