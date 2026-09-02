/**
 * Guest studentship, at the four places it is easy to get wrong.
 *
 * The whole arrangement rests on one claim being true of the DATA rather than
 * of a flag: a house can afford to show an outsider its shallow end only
 * because it is holding something deeper back. So the tests that matter are
 * the ones that would catch the shallow end quietly becoming a back door -
 * every open art bounded, the deepest thing on every shelf closed, and the set
 * of houses that take guests being a real minority rather than everybody.
 */

import { describe, expect, it } from 'vitest';

import { SECTS, getSect } from '../../../src/data/cultivation/sects.js';
import { getTechnique, classOf } from '../../../src/data/cultivation/techniques.js';
import { WORKING_ROAD_CAP } from '../../../src/engine/world/manuals.js';
import {
    WHAT_A_GUEST_PLACE_IS_NOT,
    guestPlaceAt,
    homeStanceOn,
    housesThatWouldTakeAGuest,
    houseWouldOfferMembership,
    shelfTopOf,
    takesGuests,
    guestTermYears,
    whatAHouseKeepsBack,
    whatAHouseWillShowAGuest
} from '../../../src/engine/encounters/what-a-house-will-teach-somebody-it-has-not-taken.js';

const TAKING = SECTS.filter(s => takesGuests(s.id) && whatAHouseWillShowAGuest(s.id).length > 0);

describe('which houses take guests at all', () => {
    it('is a minority of the world, and it is derived rather than declared', () => {
        // If this ever reads "all of them" the depth comparison has stopped
        // discriminating and the arrangement has become a policy of the
        // setting rather than a fact about each house.
        expect(TAKING.length).toBeGreaterThan(4);
        expect(TAKING.length).toBeLessThan(SECTS.length / 1.5);
    });

    it('refuses the houses with nothing behind the door, by name and for the stated reason', () => {
        // The House of Held Names is the case the rule exists for: a dao house,
        // an eight-hundred-year library, and a working shelf that stops at the
        // intake primer. It has nothing to hold back, so opening any of it
        // would be opening all of it.
        expect(takesGuests('house-held-names')).toBe(false);
        expect(shelfTopOf('house-held-names')).toBeLessThanOrEqual(WORKING_ROAD_CAP);

        // And a body that teaches nothing at all cannot be holding anything
        // back either.
        expect(shelfTopOf('sect-kiln-wardens')).toBeNull();
        expect(takesGuests('sect-kiln-wardens')).toBe(false);
    });

    it('takes most of the dao houses, which is the point of them existing', () => {
        const houses = SECTS.filter(s => s.id.startsWith('house-'));
        const taking = houses.filter(s => takesGuests(s.id));
        expect(taking.length).toBeGreaterThan(houses.length / 2);
        expect(taking.length).toBeLessThan(houses.length);
    });
});

describe('what a guest is shown, and what stays behind the door', () => {
    it('never opens a road above the band a house holds in quantity', () => {
        for (const house of TAKING) {
            for (const open of whatAHouseWillShowAGuest(house.id)) {
                if (open.carriesTo === null) continue;
                expect(
                    open.carriesTo,
                    `${house.id} would show a guest ${open.name}`
                ).toBeLessThanOrEqual(WORKING_ROAD_CAP);
            }
        }
    });

    it('never opens the deepest thing a house holds, whatever its height', () => {
        for (const house of TAKING) {
            const top = shelfTopOf(house.id);
            for (const open of whatAHouseWillShowAGuest(house.id)) {
                if (open.carriesTo === null || top === null) continue;
                expect(open.carriesTo, `${house.id}: ${open.name}`).toBeLessThan(top);
            }
        }
    });

    it('accounts for the whole teach list: every art is either open or kept, never both, never neither', () => {
        for (const house of SECTS) {
            const open = whatAHouseWillShowAGuest(house.id).map(o => o.techniqueId);
            const kept = whatAHouseKeepsBack(house.id).map(k => k.techniqueId);
            expect([...open, ...kept].sort()).toEqual([...house.teaches].sort());
            expect(open.filter(id => kept.includes(id))).toEqual([]);
        }
    });

    it('gives every withheld art a reason a refusal can say out loud', () => {
        for (const house of TAKING) {
            for (const kept of whatAHouseKeepsBack(house.id)) {
                expect(kept.why.length).toBeGreaterThan(40);
            }
        }
    });

    it('shows a guest less than the house shows its own, at every house', () => {
        for (const house of TAKING) {
            const open = whatAHouseWillShowAGuest(house.id).length;
            expect(open, house.id).toBeLessThan(house.teaches.length);
        }
    });
});

describe('a nobody with no house and no name', () => {
    it('can find a house that would take them and be shown a road they could not open alone', () => {
        const places = housesThatWouldTakeAGuest(0, null);
        expect(places.length).toBeGreaterThan(0);

        // The acceptance test in one assertion: somewhere in the world there is
        // a house that would let somebody standing at the very bottom sit in,
        // and put a CULTIVATION ROAD in front of them - not merely a fighting
        // art, which carries nobody anywhere.
        const withARoad = places.filter(p =>
            p.opens.some(o => {
                const t = getTechnique(o.techniqueId);
                return t !== undefined && classOf(t) === 'cultivation';
            })
        );
        expect(withARoad.length).toBeGreaterThan(0);
    });

    it('is told what the place is not, before anything else', () => {
        const place = guestPlaceAt(
            housesThatWouldTakeAGuest(0, null)[0].factionId, 0, null
        );
        expect(place).not.toBeNull();
        expect(place!.notOffered).toBe(WHAT_A_GUEST_PLACE_IS_NOT);
        expect(place!.notOffered.length).toBeGreaterThan(0);
        // Protection is the one that has to be there. A guest is away from
        // their own house among people who owe them nothing, and that has to be
        // legible before they accept rather than after.
        expect(place!.notOffered.join(' ')).toMatch(/protection/i);
    });

    it('has nobody with a view about it, because they belong to nobody', () => {
        const place = guestPlaceAt(TAKING[0].id, 0, null);
        expect(place!.homeStance).toBeNull();
        expect(place!.costsStandingWith).toEqual([]);
    });
});

describe('your own house has a view, and it is read off columns', () => {
    it('forbids it where the host is somebody it is feuding with', () => {
        const feud = SECTS.find(s => s.rivals.some(r => takesGuests(r)));
        expect(feud, 'no house in the catalog has a rival that takes guests').toBeDefined();
        const host = feud!.rivals.find(r => takesGuests(r))!;
        expect(homeStanceOn(feud!.id, host)).toBe('forbids');
        const place = guestPlaceAt(host, 20, feud!.id);
        expect(place!.costsStandingWith).toEqual([feud!.id]);
    });

    it('permits it in the ordinary case, and that costs nobody anything', () => {
        const home = SECTS.find(s =>
            TAKING.some(h => h.id !== s.id && homeStanceOn(s.id, h.id) === 'permits')
        );
        expect(home).toBeDefined();
        const host = TAKING.find(h => h.id !== home!.id && homeStanceOn(home!.id, h.id) === 'permits')!;
        const place = guestPlaceAt(host.id, 20, home!.id);
        expect(place!.homeStance).toBe('permits');
        expect(place!.costsStandingWith).toEqual([]);
    });

    it('never has a view about the house you are already in', () => {
        expect(homeStanceOn('sect-azure-cloud-pavilion', 'sect-azure-cloud-pavilion')).toBe('permits');
        // And the listing does not offer somebody a guest place in their own hall.
        const places = housesThatWouldTakeAGuest(20, 'sect-azure-cloud-pavilion');
        expect(places.some(p => p.factionId === 'sect-azure-cloud-pavilion')).toBe(false);
    });
});

describe('how long they watch, and what the watching is for', () => {
    it('is longer where more is behind the door', () => {
        // The Azure Cloud Pavilion sits on the deepest shelf in the catalog and
        // reliably raises people to a third of it. It takes its time.
        const deep = guestTermYears('sect-azure-cloud-pavilion');
        const shallower = guestTermYears('house-quiet-cut');
        expect(deep).toBeGreaterThan(shallower);
        expect(shallower).toBeGreaterThanOrEqual(1);
    });

    it('does not gate the teaching, only the offer', () => {
        // A guest may learn from the first day. The term is the pipeline.
        const place = guestPlaceAt('sect-azure-cloud-pavilion', 13, null)!;
        expect(place.opens.length).toBeGreaterThan(0);
        expect(houseWouldOfferMembership(place, place.opens.map(o => o.techniqueId), 0)).toBe(false);
    });
});

describe('and then one day somebody asks you to choose', () => {
    it('offers membership only after the term AND after the guest took everything shown', () => {
        const place = guestPlaceAt('sect-azure-cloud-pavilion', 13, null)!;
        const all = place.opens.map(o => o.techniqueId);
        const term = place.termYears;

        expect(houseWouldOfferMembership(place, all, term)).toBe(true);
        expect(houseWouldOfferMembership(place, all, term - 1)).toBe(false);
        expect(houseWouldOfferMembership(place, all.slice(0, -1), term + 40)).toBe(false);
    });

    it('never offers where the house had nothing to show in the first place', () => {
        const empty = guestPlaceAt('sect-azure-cloud-pavilion', 0, null)!;
        // Standing at the bottom, only what a beginner can open is on the table.
        expect(empty.openedButOutOfReach.length).toBeGreaterThan(0);
    });
});

describe('the shape of the position', () => {
    it('is a roll and not a rung: nothing here names a rank or a stipend', () => {
        const place = guestPlaceAt(TAKING[0].id, 20, null)!;
        expect(Object.keys(place)).not.toContain('rankIndex');
        expect(Object.keys(place)).not.toContain('stipendPerMonth');
        expect(Object.keys(place)).not.toContain('contribution');
    });

    it('reaches the dao houses, whose house roll an outsider can never be on', () => {
        const adoption = housesThatWouldTakeAGuest(20, null)
            .filter(p => p.intakeRoute === 'adoption');
        expect(adoption.length).toBeGreaterThan(0);
        // Which is the whole argument for the feature at those houses: the only
        // door is adoption, so the guest roll is the only thing an outsider can
        // ever be entered on.
        for (const p of adoption) {
            expect(getSect(p.factionId)!.recruits).toBe(true);
            expect(p.opens.length + p.openedButOutOfReach.length).toBeGreaterThan(0);
        }
    });
});
