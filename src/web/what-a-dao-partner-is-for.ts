/**
 * Sitting the same art with your dao partner, and what the two of you get.
 *
 * The impure edge around `cultivateWithADaoPartner`
 * (`engine/social-leverage/an-art-that-needs-two-people.ts`). That function
 * answers what a partnership is worth and which condition failed; this file
 * supplies the facts about the played world it cannot have - who is standing
 * here, which art both of them are carrying, whose roll each of them is on,
 * whether the tie says married, and how long the two of them sat.
 *
 * ── WHAT MAKES SOMEBODY A DAO PARTNER RATHER THAN A SPOUSE ───────────────
 *
 * Married, on the same roll, and walking the same dao. All three, and the
 * engine module's own banner has the reasoning. What matters at THIS layer is
 * that not one of the three is a new field: the marriage is a `Relationship`
 * with `married` in `roles`, written by `proposeAMatch`; the roll is the
 * membership row; and the dao is `daoOf(insights)` compared with
 * `daoDistance`. A house is full of married couples and almost none of them
 * are dao partners, and that is a fact this file reads rather than one it
 * invents.
 *
 * ── IT IS A RIDER ON A SITTING, NOT A SITTING OF ITS OWN ─────────────────
 *
 * `DAO_PARTNER_DAYS_BONUS` is two days of progress, and that figure is only
 * honest as a rider. As a verb of its own it would be a trap - a turn and a
 * span of a life spent for two days' progress - and as a lengthening of the
 * stretch it would be a lie, because company does not add days to a calendar.
 * So this delegates to `runSeclusion` with a `daoPartner` and lets the day
 * figure be spent as a rate term over the span actually lived. On a thirty-day
 * sitting that is a real edge; on a nine-hundred-day one it is noise. Both
 * readings are correct, and together they are what "a hair faster" means.
 *
 * ── AND THE OTHER ROAD OUT OF THE SAME CATEGORY ──────────────────────────
 *
 * `furnace-technique.ts` is the edge for an art that `runsOn: 'the_others'` -
 * the drain, taken off somebody who gains nothing. It is deliberately not
 * here: the two acts share a category and an eligibility test and share
 * nothing else, and a player who asks to sit an art together while holding
 * only a furnace rite is told which of the two they are holding rather than
 * quietly given the wrong one.
 */

import { getTechnique } from '../data/cultivation/techniques.js';
import { daoOf } from '../engine/cultivation/dao.js';
import { forStream } from '../engine/cultivation/rng.js';
import {
    type ADaoPartner,
    type WhyTheyAreNotDaoPartners,
    DAO_PARTNER_DAYS_BONUS,
    cultivateWithADaoPartner
} from '../engine/social-leverage/an-art-that-needs-two-people.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import { tieFrom } from './encounters.js';
import { factsForRefusal } from './facts.js';
import { othersPresent } from './hearsay.js';
import { refused } from './tool-result-prose.js';
import type { Execution } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';

/** The role `proposeAMatch` writes onto both sides of the tie it leaves. */
export const MARRIED_ROLE = 'married';

/**
 * Which art the two of them could sit together, out of what both carry.
 *
 * Read off `runsOn` and not off a flag naming the trope: an art the two of
 * them share that runs on `'everyone'` is one they can practise together, and
 * one that runs on `'the_others'` is the drain, which is a different verb and
 * gets named as one rather than glossed. `onlyADrain` is what a player holding
 * the wrong book is told.
 *
 * Ordered by the catalog's own requirement, so two people who share more than
 * one method sit the deeper of them, which is what they would do.
 */
export function theArtTheyCanSitTogether(
    mine: readonly string[],
    theirs: readonly string[]
): { shared: string | null; onlyADrain: boolean } {
    const held = new Set(theirs);
    const both = mine
        .filter(id => held.has(id))
        .map(id => getTechnique(id))
        .filter((t): t is NonNullable<typeof t> => t !== undefined)
        .filter(t => t.category === 'dual_cultivation' && t.requiresPeople >= 2);

    const mutual = both
        .filter(t => t.runsOn === 'everyone')
        .sort((a, b) => b.requiredOrdinal - a.requiredOrdinal);

    return {
        shared: mutual.length > 0 ? mutual[0].id : null,
        onlyADrain: mutual.length === 0 && both.some(t => t.runsOn === 'the_others')
    };
}

/**
 * What each failed condition is said as, and what would fix it.
 *
 * A refusal owes the player the reason and the road out of it, so every entry
 * here names both. Keyed by the engine's own `missing` value so the sentence
 * and the decision cannot drift apart.
 */
const WHY_NOT: Readonly<Record<WhyTheyAreNotDaoPartners, (them: string) => string>> = {
    the_art: () =>
        'The art moves qi through a difference between two bodies, and there is none between '
        + 'the two of you for it to move through. It is not a rule about who may sit with whom - '
        + 'the mechanism is the whole of it, and the manual has never claimed to know why.',
    the_house: them =>
        `${them} is not on your roll. A dao partnership is two people in the same rooms year `
        + 'after year, which is what being of one house means and what a partnership across two '
        + 'of them cannot supply. One of you would have to transfer.',
    the_marriage: them =>
        `You and ${them} are not married. What the two of you have is an arrangement about an `
        + 'art, and an arrangement is worth what any two people cultivating in one room are '
        + 'worth. Propose a match.',
    the_dao: them =>
        `You and ${them} walk two different roads. That is an ordinary marriage - which is a `
        + 'perfectly good thing to have and is not this. What a partnership runs on is both of '
        + 'you being further along the SAME road than you were, and two roads have nothing to '
        + 'lend each other.'
};

export const daoPartnerVerbs = {
    /**
     * One side of a partnership, as the engine module wants it.
     *
     * `daoOf` and not a stored field: a dao is derived from the insight set
     * every time it is asked for, so there is no second place a person's road
     * is written and nothing to keep in step.
     */
    asADaoPartner(this: GameService, personId: string, sex: ADaoPartner['sex'], ordinal: number): ADaoPartner {
        return {
            personId,
            sex,
            reachesTo: ordinal,
            dao: daoOf(this.repos.cultivators.getById(personId)?.insights ?? [])
        };
    },

    /**
     * Cultivate for a span with your dao partner sitting the same art.
     *
     * Every refusal below names the fact or the verb that would fix it. None
     * of them is a roll: who is standing here, what each of them carries,
     * whose roll they are on, whether the tie says married, and whether the
     * two dao are one road are all facts. The only thing this verb spends is
     * the span the player asked for, and it spends it through `runSeclusion` -
     * so the encounters, the rations, the deviations and the toll are the
     * ordinary ones. A shared sitting is not a safe sitting.
     */
    async cultivateWithYourDaoPartner(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        days: number,
        named: string,
        options: { acknowledged?: boolean; askedFor?: number } = {}
    ): Promise<Execution> {
        this.atHand = await this.loadWorld();

        const wanted = named.trim().toLowerCase();
        const here = othersPresent(this.repos, cultivator, this.atHand);
        const partner = here.find(person =>
            person.alive && person.name.toLowerCase().includes(wanted));

        // ── NOBODY OF THAT NAME IS STANDING HERE ─────────────────────────
        //
        // The partner is resolved off who is PRESENT, because two people
        // cultivating together are in one room. Naming a partner four
        // provinces away is a travelling problem rather than a cultivation
        // one, and the refusal lists who is actually here - a name the game
        // printed is a name the game will accept back.
        if (!partner) {
            const who = here.filter(p => p.alive).map(p => p.name);
            return refused('dao-partner.whoIsHere', 'cultivate', factsForRefusal(
                `${named.trim()} is not standing here.`,
                who.length > 0
                    ? 'Sitting an art with somebody means sitting it in the same room. Here with '
                      + `you: ${who.slice(0, 8).join(', ')}.`
                    : 'Sitting an art with somebody means sitting it in the same room, and you '
                      + 'are alone. Go to them, or sit it on your own.',
                `hearsay.othersPresent: ${here.length} row(s) at `
                + `${cultivator.location ?? 'nowhere'}, none matching `
                + `"${named.trim().slice(0, 40)}". Nothing spent.`
            ));
        }

        const fit = theArtTheyCanSitTogether(
            this.whatTheyAreCarrying(cultivator.id),
            this.whatTheyAreCarrying(partner.id)
        );

        // ── THE OTHER ROAD OUT OF THE SAME CATEGORY ──────────────────────
        //
        // Named rather than glossed, and the refusal describes the mechanism
        // rather than the reputation: what `runsOn: 'the_others'` means is that
        // one side supplies it and gains nothing, and that is not a thing two
        // people do together whatever the manual calls it.
        if (fit.onlyADrain) {
            return refused('dao-partner.onlyADrain', 'cultivate', factsForRefusal(
                'The only such art between you does not share.',
                'What the two of you hold in common opens two channels and runs one of them the '
                + 'wrong way. It takes off one side what it gives the other, so it is not a '
                + 'thing two people do together - it is a thing one person does to another, and '
                + 'the manual is honest about the mechanism if about nothing else.',
                'Every `dual_cultivation` art shared across the two rosters is '
                + '`runsOn: \'the_others\'`. `cultivateWithADaoPartner` was not called: it '
                + 'answers a mutual question and this is not one.'
            ));
        }

        if (fit.shared === null) {
            return refused('dao-partner.noSharedArt', 'cultivate', factsForRefusal(
                `You and ${partner.name} have no art you could sit together.`,
                'A two-person method is one book read from both sides. Practising different arts '
                + 'in one room is two people cultivating alone with company, which is worth what '
                + 'it sounds like. One of you would have to learn what the other is carrying.',
                'No shared art with `requiresPeople >= 2` and `runsOn: \'everyone\'` across the '
                + 'two rosters. `cultivateWithADaoPartner` not called; nothing spent.'
            ));
        }

        // ── THE THREE CONDITIONS, READ OFF THE WORLD AND REPORTED ────────
        //
        // Reported and not decided, in the same way `FurnaceConsent` is: the
        // membership row and the tie table are where this world already keeps
        // "of one house" and "married", and the engine module compares the two
        // dao itself because comparing two dao is a structural question about a
        // pair.
        const mine = this.repos.sects.getMembership(cultivator.id);
        const myHouse = mine?.sectId ?? cultivator.sectId ?? null;
        const sameHouse = myHouse !== null && partner.sectId === myHouse;
        const married =
            tieFrom(this.repos, cultivator.id, partner.id)?.roles.includes(MARRIED_ROLE) === true;

        const partnership = cultivateWithADaoPartner({
            one: this.asADaoPartner(cultivator.id, cultivator.sex, cultivator.realmOrdinal),
            other: this.asADaoPartner(partner.id, partner.sex, partner.realmOrdinal),
            sharedTechniqueId: fit.shared,
            sameHouse,
            married,
            // Its own named stream, so an insight draw never shifts anything
            // else pulling from the same generator - the convention every
            // sample in the engine module is documented against. Keyed on the
            // partner and the day, so the same sitting resolves the same way
            // on a replay from the seed.
            insightSample: forStream(
                run.seed, 'dao_partner', Math.floor(run.elapsedDays), `${partner.id}:insight`
            ).next()
        });

        if (!partnership.areDaoPartners) {
            const art = getTechnique(fit.shared);
            return refused('engine.cultivateWithADaoPartner', 'cultivate', factsForRefusal(
                partnership.line,
                WHY_NOT[partnership.missing ?? 'the_dao'](partner.name)
                + (partnership.missing === 'the_art'
                    ? ` Either of you may sit ${art?.name ?? 'the same book'} alone for what it `
                      + 'is worth alone.'
                    : ''),
                `cultivateWithADaoPartner: missing=${partnership.missing}, `
                + `sameHouse=${sameHouse}, married=${married}. Nothing spent.`
            ));
        }

        // ── THE SPAN IS SPENT THE ORDINARY WAY ───────────────────────────
        //
        // `runSeclusion`, and not a second cultivation path. Everything that
        // makes a long sitting dangerous - the encounter tables, the rations,
        // the deviations, a boundary crossed in the middle of it - is that
        // method's, and a shared sitting that skipped any of it would be the
        // dominant move rather than a trade. What a partner changes is one rate
        // term and at most one insight, and `daoPartner` carries both.
        return await this.runSeclusion(run, cultivator, ambient, days, {
            acknowledged: options.acknowledged ?? false,
            ...(options.askedFor !== undefined ? { askedFor: options.askedFor } : {}),
            daoPartner: {
                id: partner.id,
                name: partner.name,
                bonusDays: partnership.daysBonus[cultivator.id] ?? DAO_PARTNER_DAYS_BONUS,
                theirBonusDays: partnership.daysBonus[partner.id] ?? DAO_PARTNER_DAYS_BONUS,
                insight: partnership.insight?.forPersonId === cultivator.id
                    ? {
                        subject: partnership.insight.subject,
                        domain: partnership.insight.domain
                    }
                    : null
            }
        });
    }
};
