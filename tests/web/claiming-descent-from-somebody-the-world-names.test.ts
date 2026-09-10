/**
 * Naming a real founder got the refusal written for names you made up.
 *
 * `claimDescent` resolved a name against sect ancestry records and nothing else.
 * `named-figures.ts` is the other register - founders, ancestors who crossed,
 * sealed figures who are titles to the people standing on them, and the handful
 * of historical people the world argues about - and no player act read a line of
 * it.
 *
 * Measured: of the 39 figures in that file whose names are usable, FIVE also
 * appear in a sect's ancestry records. The other 34 could not be claimed, and
 * what a player got for saying one of them is the refusal written for an
 * invention:
 *
 *     A name and nothing behind it.
 *     You can say it. Saying it is free, and it is also all that happens: there
 *     is nobody in front of you who has heard the name, no roll it appears on
 *     that you have ever been shown...
 *
 * That refusal is correct and well-written for a name nobody holds. It is a lie
 * about Duan Xi, who is on a wall.
 *
 * ── THE CATALOG ASKED FOR THIS IN SO MANY WORDS ──────────────────────────
 *
 * `NAMED_FIGURE_ENGINE_GAP` lists three things the engine would need, and the
 * third is this one: *a link from an offering or a claim of descent to the
 * figure it addresses, since both are currently free text and neither can be
 * wrong*.
 *
 * ── `nameIsUsable` IS THE GATE, AND THE FILE SAYS SO ─────────────────────
 *
 * *Anything that needs to know whether a name is trustworthy should call
 * `nameIsUsable` rather than reading the string.* Attestation is the content of
 * that register: a name can be securely attested, written down later because a
 * ceremony needed something, garbled in copying, disputed between two bodies who
 * both claim it, held in a hand nobody at the holding institution can read, or
 * deliberately withheld.
 *
 * A name the holding house cannot certify against is not a name a claim can
 * stand on, so those reach the same refusal - for a different and honest reason,
 * and the player is not told which. A name a sect HAS and cannot use is a
 * different problem from a name it lost, and neither is a claim anybody can
 * check.
 *
 * ── AND A FIGURE NO HOUSE HOLDS HAS NO WALL TO BE ON ─────────────────────
 *
 * Several of them are exactly that: people the whole world argues about and no
 * institution owns. The claim screen reads a house's line for the party on the
 * other side, and for those there is no other side. Reading it anyway produced
 * `is on nobody living's wall`, which is worse than clumsy - it invents an
 * institution to be the counterparty.
 */

import { describe, it, expect } from 'vitest';

import {
    NAMED_FIGURES,
    nameIsUsable
} from '../../src/data/cultivation/named-figures';
import { SECTS, getSectAncestry } from '../../src/data/cultivation/index';

/** Every name a sect's own ancestry records hold. */
const onAWall = (): Set<string> => {
    const names = new Set<string>();
    for (const sect of SECTS) {
        for (const ancestor of getSectAncestry(sect.id)?.ancestors ?? []) {
            names.add(ancestor.name);
        }
    }
    return names;
};

describe('the register the claim could not see', () => {
    /**
     * THE MEASUREMENT, kept as an assertion so the finding cannot quietly stop
     * being true. If a later pass folds the two registers together this goes
     * red and should - it would mean the gap closed a different way.
     */
    it('holds usable names that no sect ancestry record repeats', () => {
        const walls = onAWall();
        const usable = NAMED_FIGURES.filter(nameIsUsable);
        const onlyHere = usable.filter(figure => !walls.has(figure.name));

        expect(usable.length).toBeGreaterThan(20);
        expect(onlyHere.length).toBeGreaterThan(10);
    });

    /**
     * AND THE GATE HAS BOTH SIDES. A file where every name were usable would
     * make `nameIsUsable` a formality, and the attestation range is the content
     * of that register rather than a decoration on it.
     */
    it('has names it cannot certify as well as names it can', () => {
        const usable = NAMED_FIGURES.filter(nameIsUsable);
        const not = NAMED_FIGURES.filter(figure => !nameIsUsable(figure));
        expect(usable.length).toBeGreaterThan(0);
        expect(not.length).toBeGreaterThan(0);
    });

    /**
     * A FIGURE NO HOUSE HOLDS IS A REAL CASE AND NOT AN EDGE ONE. The claim
     * screen has to have a branch for it, because the ordinary branch names the
     * house on the other side of the claim and there is not one.
     */
    it('has figures no institution owns', () => {
        const houseless = NAMED_FIGURES.filter(
            figure => nameIsUsable(figure) && figure.factionId === null
        );
        expect(houseless.length).toBeGreaterThan(0);
    });

    /**
     * EVERY USABLE NAME IS SOMETHING A PERSON COULD SAY. A register whose
     * usable half were ids or titles would resolve nothing however well the
     * lookup was wired.
     */
    it('spells its usable names as names', () => {
        for (const figure of NAMED_FIGURES.filter(nameIsUsable)) {
            expect(figure.name.length, figure.id).toBeGreaterThan(1);
            expect(figure.name, figure.id).not.toMatch(/^[a-z-]+$/);
        }
    });
});
