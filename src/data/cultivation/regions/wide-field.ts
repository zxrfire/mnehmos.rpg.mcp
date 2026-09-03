/**
 * The Wide Field: flat, dug over, nine cities, and no high ground anybody
 * could fortify. Nobody holds land here; every institution in it holds a lease.
 *
 * No prefectures: the political layer subdivides only the two provinces that
 * have something to subdivide, and this one is a lease register rather than a
 * grant book.
 */

import { PLACE, REGION_NAME } from '../place-names.js';
import type { LocalRankBand, Region } from './region-schema.js';
import { standardBandsWith } from './local-rank-names.js';
import { EAST_REGION_ID, HOME_REGION_ID, SOUTH_REGION_ID } from './region-ids.js';

const FIELD_BANDS: LocalRankBand[] = standardBandsWith(
    'The Wide Field uses the Low Fall words because every lease in nine cities is written in them, and a landlord will not put his seal on a grade he cannot look up in a table somebody else keeps.',
    'The East is the only place where the sub-ranks have a price attached, because a lease is graded by them - which means everybody here has a commercial reason to be confident about a distinction that does not survive a border.'
);

// ── EAST ─────────────────────────────────────────────────────────────
// The province the catalog has been implying for a long time without ever
// saying where it was. Six of the thirty-two houses describe themselves as
// holding rooms in cities - nine reading halls, nine register houses,
// auction floors in every city of consequence, cutting houses at the edge
// of six of them - and there was one city in the world for all of it to be
// in. This is where those rooms are.
export const THE_WIDE_FIELD: Region = {
    id: EAST_REGION_ID,
    name: REGION_NAME.WIDE_FIELD,
    role: 'adjacent',
    bearing: 'east',
    traditionId: 'tradition-drawn',
    summary:
        'The eastern plain: nine walled cities on flat ground over shallow veins, two thousand years of engagements fought across it, and not one institution in it that holds a foot of land. Everything here is rented, priced and renewable, and the ground is rich because of what has died on it.',
    governingFact:
        'There is no high ground. The Wide Field is one flat alluvial plain over veins that run everywhere and deep nowhere, so nothing here can be fortified and nothing here has ever been held for long.',
    derivations: [
        'An institution holds rooms rather than ground - a hall, a floor, a gate house, a stack room - all of it leased from a city that has outlived its last nine tenants, so the unit of value is the lease and a house that misses a renewal has nothing to fall back on',
        'The cities are mortal, ancient and enormous, and every cultivator institution inside one is the tenant of people it could kill in an afternoon; everybody has done that arithmetic, and the answer is that killing your landlord costs you the lease',
        'Ground that cannot be fortified gets fought over instead, so the East has more battlefields than the rest of the world together, and battlefield ground fruits herbs nothing else grows - which makes a killing field an asset with a harvest date',
        'Nothing is granted and nothing is sworn, so obligation here is priced rather than witnessed, and the house that sets the price of a spirit stone is the nearest thing the province has to a government'
    ],
    register: {
        colour: 'brown and gold: dust, wheat, brick, and roof tile that was glazed nine hundred years ago and has not been reglazed since',
        light: 'an enormous flat sky with sunrise and sunset visible end to end, and from the sixth month a permanent haze of field dust that turns the sun orange by noon',
        sound: 'people, and the bells. Nine cities, nine watches a day, and every gate in the province opening and shutting to a schedule a visitor can hear from a li out',
        smell: 'coal smoke, night soil, hot oil, cut wheat, and under all of it in certain fields a sweetness that everybody can identify and nobody names',
        food: 'wheat in every form - hand-pulled noodles, flatbread, boiled dumplings - with mutton, black vinegar, raw garlic, and tea drunk salted'
    },
    customs: {
        socialPrinciple: 'Tenancy. Nobody holds ground, everybody holds a lease, and the lease is priced in assayed stones by a house that holds no ground either. The whole of politics here is the renewal calendar, and it is public.',
        death: 'Burned outside the wall the same day, ashes broadcast on the field, because nine cities on a plain cannot bury two thousand years of people. Anybody who keeps a body is doing something, and everybody assumes the worst of them.',
        taboo: 'Never ask what a field grew before. Everyone knows which fields are battlefields, the price of the crop depends on nobody saying so at the gate, and a visitor who asks in a market has emptied it.',
        threatModel: 'People, in numbers, and the numbers are mortal. What kills a cultivator in the Wide Field is a city deciding it has had enough of them, which it does about once a century and does thoroughly.',
        naming: 'A wall before a clan: Ci of the Fourth Gate, Wan Hongfu out of Ninewatch, Shu Threewall. An easterner who gives a clan name first is either very old money or lying about where they are from.',
        time: 'Nine watches to the day, rung, so the whole province agrees on the hour to a few minutes. It does not agree on the year at all: each city counts from its own charter, and a contract carries three dates and a bell.'
    },
    cultivation: {
        method:
            'Ordinary drawing, on shallow veins that run under everything and are deep under nothing. It is the same road as the Low Fall, it starts faster because the ground is everywhere, and it stops earlier because the ground is thin - which the East explains as talent and which is in fact the plain.',
        ambientRateMultiplier: 0.85,
        methodRateMultiplier: 0.85,
        deviationRiskModifier: 0.01,
        harderBoundaries: [24, 32],
        missingDisciplines: [
            {
                discipline: 'oath-binding',
                reason: 'A Bound Word oath binds to certified ground and the Anchorhold has never carried a survey east of the watershed. An oath sworn in the Wide Field is a promise and nothing else, which is why every arrangement here is a lease with a deposit and why the province regards the Low Fall habit of swearing things as a charming affectation.'
            },
            {
                discipline: 'containment',
                reason: 'A perimeter needs a datum that stays where it was put, and two thousand years of ploughing, digging, walling and rewalling have left nothing in the East that has been in one place for a century. The Anchorhold maintains no perimeter here, has never applied to, and says so in writing when asked.'
            }
        ],
        strongDisciplines: [
            'appraisal and provenance, because the province is armed and furnished out of its own ground and somebody has to say which age a thing came out of',
            'grave and battlefield reading, which is a real science here with a rotation, a calendar and a price list',
            'severance arts, which work best where there is no certified ground for a cut to be traced across'
        ],
        costNote:
            'Advancement costs rent. There is no cave on a vein to hold and no grant to apply for; there is a room over an assay hall at a rate somebody else sets, and the difference between an easterner who rises and one who does not is almost entirely whether their house made its renewal.',
        localRankNames: FIELD_BANDS
    },
    ambientProfile: { thin: 44, normal: 41, dense: 14, spirit_tide: 1 },
    localCeilingOrdinal: 38,
    ceilingNote:
        'Thirty-eight, and it holds a rented room. Nobody in nine cities has passed the founder of the Severed in living memory, and the reason is the ground rather than the people: the East reliably makes Core Formation in quantity and Nascent Soul rarely, and every single thing above that arrived from somewhere else and is paying rent.',
    veinStatus:
        'Shallow and universal. There is a vein under almost every field in the Wide Field and not one of them is deep enough to be worth a war, which is why the province has never had a vein war and has had two thousand years of every other kind. The rich ground is battlefield ground, and it is rich for the reason everybody knows and nobody states at a market.',
    politics: 'single_hegemon',
    politicsNote:
        'One holder, and what it holds is the rate. Nobody in the Wide Field holds ground, so nobody can be leaned on through a grant; what can be leaned on is the price of an assayed stone, and one house sets that at the head of nine veins and in the assay hall of every city. It is a hegemony that has never fought anybody: it buys the seniors of houses it wants quiet, three of them now have none, and every institution in the province quotes a figure it did not set to pay a rent it cannot refuse.',
    factionIds: [
        'sect-stonewright-consortium',
        'sect-thousand-treasure-pavilion',
        'sect-lantern-hall',
        'sect-the-severed',
        'sect-bone-lantern-cult',
        'house-held-names',
        'house-narrow-hour',
        'house-quiet-cut'
    ],
    branches: [
        {
            parentSectId: 'house-ninefold-ledger',
            localName: 'The Eastern Circuit',
            doesHere:
                'Nine of the forty-one arbitration benches, sitting in cities where nothing can be sworn and everything has to be proved. It is the busiest half of the Ledger\'s work and the half its auditors least want, because an eastern case is a lease dispute rather than a thread and there is no karma in a lease.'
        },
        {
            parentSectId: 'sect-crimson-abyss-hall',
            localName: 'The Wheatgate Table',
            doesHere:
                'A table and a cash box outside the admission days of every city hall that runs one, paying the first month in advance to whoever was refused inside that morning. The eastern cities are the only place in the world where a recruiter can sit outside nine doors in one season.'
        }
    ],
    places: [
        { name: PLACE.NINEWATCH, kind: 'city', ambient: 'normal', note: 'The largest of the nine, and the city the whole province sets its clocks by. Every hall in it is leased and the leases are public.' },
        { name: PLACE.THIRDWALL, kind: 'city', ambient: 'thin', note: 'Walled three times in two thousand years, each wall further out, all three still standing. A third of the city lives between walls nobody defends.' },
        { name: PLACE.WHEATGATE, kind: 'market_town', ambient: 'normal', note: 'Where the crop off the old ground is sold, and where nobody at the counter asks what the field grew before it grew this.' },
        { name: PLACE.MUDSUMMER, kind: 'site', ambient: 'dense', note: 'Twelve thousand died here in one afternoon a hundred and forty years ago, and the ground has been fruiting ever since. The name is what that season was called before it happened.' },
        { name: PLACE.MILLRUN, kind: 'village', ambient: 'thin', note: 'A river village that was on the river until the river moved four li in one spring three hundred years ago. Nobody renamed it and the mills are still standing.' }
    ],
    exports: [
        'assayed spirit stones and the rate they are assayed at, which is the only export in the world that arrives before the goods do',
        'battlefield herbs on a hundred-and-forty-year rotation, which will not fruit on ground nothing died on',
        'dug goods of every age, with a provenance opinion attached and no question asked about the hole',
        'grain, in the quantity that feeds three provinces, which is why nobody has ever burned a field here'
    ],
    imports: [
        'refined pills and the manuals to make them, all of it out of the Low Fall, because an alchemist needs a still room and rents are what they are',
        'ice-cut stones out of the White Stair, which assay high and are bought at a discount justified by the carriage',
        'anybody who can teach above Core Formation, hired rather than raised, and never for long'
    ],
    priceMultiplier: 0.9,
    hazards: [
        'people in numbers: a city that has decided about you is not a fight, and there is no rank at which it becomes one',
        'battlefield ground, which is corrupt in a way that is worth money and kills the diggers who work it wrong',
        'formations left standing on ground nobody has surveyed since, still lit, still keyed to a house that is nine centuries gone',
        'the renewal calendar, which is not a hazard anywhere else and is the leading cause of institutional death here'
    ],
    connections: [
        {
            kind: 'trade_route',
            otherRegionId: HOME_REGION_ID,
            description:
                'Six days up the gorge road, and it is the busiest ground in the world: pills, manuals and teachers coming east, stones and grain and appraised loot going west, and four parties taking a cut of each direction.',
            travelDays: 6
        },
        {
            kind: 'unsettled_border',
            otherRegionId: HOME_REGION_ID,
            description:
                'No certified survey has ever crossed the watershed, so the whole boundary is habit. The Low Fall reads that as the East being lawless and the East reads it as the Low Fall being superstitious about paper.',
            travelDays: 6
        },
        {
            kind: 'shared_feud',
            otherRegionId: HOME_REGION_ID,
            description:
                'The Bone Lantern Cult works the old grounds on both sides of the watershed and the Verdant Spring Hall has been trying to have it stopped for sixty years, in a province where nothing it says has any force at all.',
            travelDays: 6
        },
        {
            kind: 'sea_crossing',
            otherRegionId: SOUTH_REGION_ID,
            description:
                'Twenty-one days from the eastern shore to Sweetspring Isle, three seasons in four, and every hull of it is provisioned against a passage with no landfall in the middle. It is how salt reaches nine cities and how what comes off drowned ground reaches an auction floor.',
            travelDays: 21
        }
    ],
    trueHereFalseThere: [
        'Nothing anybody swears binds. There is no certified ground east of the watershed, so an oath is a promise, a treaty is a lease, and every arrangement in the province carries a deposit instead of a witness.',
        'No institution holds a foot of land. Nine cities, thirty-odd halls, floors, gate houses and stack rooms, and every one of them rented from mortals who could evict the strongest thing in the province and have.',
        'A battlefield is an asset with a harvest date, worked on a published rotation by people the rest of the world will not sit next to, and the crop is sold at a market where asking about it empties the room.',
        'The hour is agreed to a few minutes across a whole province and the year is not agreed at all, because the bells are rung and the charters are not.'
    ],
    crossingNotes: [
        'The horizon arrives first. A Low Fall cultivator coming down the gorge road spends the first day unable to judge distance, because nothing here interrupts anything and the sky goes all the way down.',
        'Nobody asks what sect you are. They ask what you are paying and until when, and if the answer is nothing the conversation ends politely and immediately.',
        'The bells. Nine watches a day in nine cities, all of them audible from the road, and a visitor who has not learned the schedule inside a week is late to everything.',
        'Every wall in sight is older than every institution behind it, and the locals will tell you so, unprompted, in a tone the Low Fall finds insufferable.',
        'Somewhere in the second day somebody offers to buy something off you, sight unseen, at a price that is either insulting or extremely good, and there is no way for an outsider to know which.'
    ]
};
