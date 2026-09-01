/**
 * How each faction came to be where it is, and what that explains.
 *
 * The catalog was strong on what a faction IS and had almost nothing on how it
 * got there, so every number that reads as a consequence - a pipeline eleven
 * rungs under the house's own strongest member, a peak dated to a year with no
 * account of the year, fifty-two unlit nodes nobody can explain - was standing
 * on nothing. This file is that account, and it is bound by one rule that
 * decides every entry in it:
 *
 *   A HISTORICAL FACT EARNS ITS PLACE ONLY IF IT EXPLAINS SOMETHING A READER
 *   CAN ALREADY SEE.
 *
 * Not colour, not atmosphere, and never a second founding myth for a house that
 * already has one. The test to apply before adding anything here: name the
 * figure in another catalog that this makes sense of. If you cannot, it is
 * decoration and it goes. Every field below is shaped to force the answer -
 * `whyTheGapIs` is about `production` in `faction-character.ts`, `whatTheUnlitNodesWere`
 * is about `compound` in `sects.ts`, and `whereTheWrongBeliefComesFrom` is
 * about `wrongAbout`, which asserts of itself that it is traceable and until
 * now was traceable to nothing.
 *
 * DATED ONCE, REFERENCED TWICE
 * ---------------------------
 * Anything involving two or more factions is a `SharedEvent` and lives in one
 * place with one date. It is NOT restated in prose on either party's entry,
 * because a date written twice is a date that will disagree with itself - that
 * has already happened in this repo, in a note that restated a house's power
 * ordinal and had it wrong.
 *
 * Each party then carries its OWN ACCOUNT of the shared event, and the accounts
 * are meant to differ. Two houses remembering the same war differently is the
 * best material in the file. Two houses stating incompatible FACTS is a bug,
 * and the distinction is enforceable: `what` is the minimum both parties would
 * concede happened, and every account has to be compatible with it. Where a
 * party's account contradicts `what`, that party is `wrongAbout` it and the
 * contradiction is named in `faction-character.ts` rather than smuggled in
 * here.
 *
 * NOTHING HERE IS A MECHANIC
 * --------------------------
 * No engine code reads this file and none should. It contains no numbers that
 * anything resolves against, no modifiers, and no rules. Where a fact here is
 * quantitative - what a house produces, how many nodes it holds, how far it
 * fell - the quantity lives in the catalog that owns it and this file refers to
 * it in words. That is deliberate, and it is why there are no ordinals written
 * out in the prose below: `docs/world/README.md` records a case where a note
 * restated a `powerOrdinal` and had it wrong, and the fix was to stop restating
 * them. Say "four rungs under its own strongest member", never the figure.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────

/**
 * What kind of visible thing an event is on the hook for.
 *
 * Present so the rule at the top of the file is checkable rather than
 * aspirational: every event names the sort of figure it exists to explain, and
 * a reviewer can go and look at that figure.
 */
export const ExplainsSchema = z.enum([
    /** The distance between `powerOrdinal` and `production.reliableOrdinal`. */
    'the gap',
    /** `production.peakOrdinal` and `yearsSinceLastPeak`. */
    'the peak',
    /** `compound.formationNodesLit` against `formationNodesTotal`. */
    'the unlit nodes',
    /** What ground it holds and on whose grant. */
    'the holding',
    /** An entry in `rivals`, which is symmetric and asserted to be. */
    'the rivalry',
    /** What the province says about it, as against what is true. */
    'the reputation',
    /** An ancestral or lineage claim. */
    'the claim',
    /** Who it takes and who it will not. */
    'the intake'
]);
export type Explains = z.infer<typeof ExplainsSchema>;

export const SharedEventSchema = z.object({
    id: z.string().min(4),
    /** Dated once, here, and never restated in anybody's prose. */
    yearsAgo: z.number().int().min(1),
    /** Where it happened, by province id, or null where it did not happen anywhere. */
    provinceId: z.string().nullable(),
    /**
     * The minimum both parties would concede happened.
     *
     * Deliberately thin. This is not the story - it is the floor every account
     * has to stand on, and its whole job is to make disagreement checkable. An
     * account that cannot be squared with this sentence is not a difference of
     * emphasis, it is an error in one of them.
     */
    what: z.string().min(80),
    /** Two or more faction ids. Must match the keys of `accounts` exactly. */
    parties: z.array(z.string().min(1)).min(2),
    /**
     * Each party's own telling, keyed by faction id.
     *
     * Partisan on purpose and not required to agree about meaning, weight,
     * blame or what it was really about. Required to agree about `what`.
     */
    accounts: z.record(z.string(), z.string().min(100)),
    explains: ExplainsSchema
});
export type SharedEvent = z.infer<typeof SharedEventSchema>;

export const FactionHistorySchema = z.object({
    factionId: z.string().min(1),
    /**
     * How it came to be standing where it stands. One paragraph, no dates that
     * belong to a shared event.
     */
    origin: z.string().min(200),
    /**
     * Why its pipeline sits where it does relative to its strongest member.
     *
     * The single most characterful unexplained number in the catalog, and there
     * are only ever three shapes of answer: it lost access to something, it
     * never had it, or it is building toward something. Which of the three is
     * readable off `production` without this field. WHICH THING is not.
     */
    whyTheGapIs: z.string().min(150),
    /**
     * What the dark nodes were for, where the house holds any.
     *
     * Null where it holds none, which is the honest case for the handful that
     * inherited nothing and built their own. Everywhere else this is a piece of
     * history nobody had written: a house sitting inside a diagram it cannot
     * read is sitting inside somebody's plan, and the plan had a purpose.
     */
    whatTheUnlitNodesWere: z.string().min(120).nullable(),
    /**
     * Where the false belief came from, and why it was reasonable at the time.
     *
     * `wrongAbout` asserts the error is traceable. This is the trace. The
     * standard is that the mistake must have been the sensible reading of the
     * evidence available when it was made - a house that believes something
     * stupid is not interesting, and a house that believes something that was
     * correct for two centuries and quietly stopped being correct is.
     */
    whereTheWrongBeliefComesFrom: z.string().min(150),
    /** Shared event ids this faction is a party to. Checked against `SHARED_EVENTS`. */
    sharedEvents: z.array(z.string().min(4))
});
export type FactionHistory = z.infer<typeof FactionHistorySchema>;

// ─────────────────────────────────────────────────────────────────────────
// SHARED EVENTS
//
// One date each, and every one of them is already implied somewhere else in
// the catalog - in a `rivals` pair, a `grievance` that names another house, a
// `wrongAbout` that cites another house's finding, or a parentage note. None of
// these is a new event. They are the events the catalog was already asserting
// and had never written down, which is why the accounts can be partisan without
// being invented: both sides were already on record about the outcome.
// ─────────────────────────────────────────────────────────────────────────

export const SHARED_EVENTS: readonly SharedEvent[] = [
    {
        id: 'event-the-reposting',
        yearsAgo: 900,
        provinceId: 'province-low-fall',
        what: 'The Deep Survey reposted the court on the datum. Most of the Wardens declined the reposting and left, and the two halves each kept one of the names the body had been carrying for nine hundred years.',
        parties: ['court-kiln', 'sect-kiln-wardens', 'apex-deep-survey', 'apex-long-cut'],
        accounts: {
            'court-kiln':
                'The ground did not move. Everything the Kiln is - the datum, the nodes, the rota, the perimeter - was here before the reposting and was here after it, and the only thing that walked out of the gate was a roll of names and an administrative word. The Court states this without heat and has never said anything else.',
            'sect-kiln-wardens':
                'Nobody was asked, about a thing every one of them had wanted. That is the fact the Root Sill puts first and the one the Kiln never mentions: the Survey reposted a nine-hundred-year-old body without consulting a single person standing in it, and what most of the Wardens declined was not the work but being reassigned to it by letter. The roll walked. The rota came with the people who had been walking it.',
            'apex-deep-survey':
                'A routine reposting of a court, executed correctly, on a schedule. The Survey has never characterised it otherwise in any document, has never referred to the departed body in correspondence, and lists the Kiln Court as its court on the datum. Whether that is composure or the absence of an answer is not something the Survey has been asked in a room where it would have to reply.',
            'apex-long-cut':
                'Some people became available and a schedule had room. The Long Cut did not send anybody, did not solicit, and did not say a word in public; it offered a posting to a body that had walked out of another one, which is the second time it has done exactly that, and it has acknowledged neither.'
        },
        explains: 'the claim'
    },
    {
        id: 'event-the-promotion-past-the-kiln',
        yearsAgo: 200,
        provinceId: 'province-low-fall',
        what: 'The Deep Survey raised the Storm Tyrant Court to answer to it directly, making it the Survey\'s second body in the Low Fall beside the Kiln Court. The probation it had held under for two centuries was carried across rather than lifted, and the Kiln was not consulted.',
        parties: ['sect-storm-tyrant-court', 'court-kiln', 'apex-deep-survey'],
        accounts: {
            'sect-storm-tyrant-court':
                'A recognition, and a century overdue - the Court reads it as the Survey acknowledging that a body holding the only working lightning curriculum in the world is not a tenant, and as the nearest thing to a restoration available to a house that was once one of the three. What it does not read, and has never once discussed in a room where it could be minuted, is that the probation came with it, that the last two renewals were issued short, and that the other body the Survey keeps in this province was not asked and would not have cared.',
            'court-kiln':
                'Nothing about it concerns the Kiln, which issues no grants, holds no tenants and has never had a book for one to be removed from - and the Court has said as much, once, in the only sentence it has ever contributed to the subject. What it did not say, and what the Storm Tyrant has never stopped hearing, is that the Survey now keeps two bodies in this province: one that administers the richest arrangement in the world and takes nothing out of it, and one that administers a broken tether and cannot stop asking to be looked at.',
            'apex-deep-survey':
                'The curriculum is the one thing in the Low Fall that cannot be replaced, and the Survey would rather administer such a thing than lease it. That is the whole of the reasoning and it was stated in one line. What the sect is, and what the province calls it, did not appear in the decision and there is no line on the form where it would have.'
        },
        explains: 'the holding'
    },
    {
        id: 'event-one-letter-for-both',
        yearsAgo: 40,
        provinceId: 'province-low-fall',
        what: 'The Deep Survey moved the Crimson Abyss Hall\'s grant under the Storm Tyrant Court, stating in one line that one letter should cover both demonic holdings. Neither party was consulted.',
        parties: ['sect-crimson-abyss-hall', 'sect-storm-tyrant-court', 'apex-deep-survey'],
        accounts: {
            'sect-crimson-abyss-hall':
                'A landlord it did not choose, taking a tithe it had been paying elsewhere, over a sinkhole the Court has never visited. The Hall resents it in exactly the words the Court resents it in, which neither of them knows, and it has been under-declaring by about a fifth for six years and has drawn no conclusion about why nobody has checked.',
            'sect-storm-tyrant-court':
                'A tenant it did not ask for, on a vein worth nothing, requiring a clerk it does not have. The Court regards the arrangement as an administrative insult and has never said so, and the two Storm Elders who have privately worked out what the Hall is under-declaring have both decided that raising it would invite an inventory.',
            'apex-deep-survey':
                'Two files on adjacent ground became one file. It was a filing decision, made by a clerk with a schedule, and the word in it was the province\'s word rather than the Survey\'s - the Survey needed a term to describe two grants and used the one everybody else was using. Forty years of intent have been read into a sentence that was about correspondence volume.'
        },
        explains: 'the holding'
    },
    {
        id: 'event-the-stack-room-leases',
        yearsAgo: 210,
        provinceId: null,
        what: 'The Lantern Hall took stack rooms under nine city reading halls. All nine buildings were House of Held Names property, and the House still holds the leases.',
        parties: ['sect-lantern-hall', 'house-held-names'],
        accounts: {
            'sect-lantern-hall':
                'Nine cities, nine halls, nine stack rooms, and a counter-register kept free where the House charges - which is the whole of the Hall\'s standing and the reason the province respects it. The Hall holds that its register is independent, states so in its own founding language, and has never gone and looked at whose name is on the buildings, because the answer has not come up in two centuries and nobody has made it come up.',
            'house-held-names':
                'The House leased nine buildings to a body that has spent two hundred years being applauded for giving away, at no charge, worse work than the House does for a fee - out of the House\'s own rooms. It has never mentioned the leases and does not intend to. The register of absences is worth more held than spent, and so is this.'
        },
        explains: 'the rivalry'
    },
    {
        id: 'event-the-four-shortages',
        yearsAgo: 150,
        provinceId: null,
        what: 'In four recorded stone shortages the exchange rate was set by what the Thousand Treasure Pavilion would pay, and the Stonewright Consortium published that figure a week later as its own.',
        parties: ['sect-stonewright-consortium', 'sect-thousand-treasure-pavilion'],
        accounts: {
            'sect-stonewright-consortium':
                'The Consortium sets the rate. It has the presses, the assay monopoly and the publication, and every institution in the province depends on the figure it prints while calling it parasitic for printing it. The four shortages are in its own records as four occasions on which the rate moved sharply and the Consortium responded quickly.',
            'sect-thousand-treasure-pavilion':
                'The Pavilion knows, has known for a century and a half, and has never said it - because saying it aloud would cost it the Consortium\'s underwriting, and the underwriting is worth more than the credit. It is the one thing the Pavilion is certain of and cannot use, and it sits underneath every negotiation between the two of them like a floor neither will stand on.'
        },
        explains: 'the rivalry'
    },
    {
        id: 'event-the-two-raids',
        yearsAgo: 400,
        provinceId: 'province-low-fall',
        what: 'The Storm Tyrant Court raided the Frostmirror Court twice. Both raids reached the glacier hall and both withdrew, and nothing was taken that either party has ever itemised.',
        parties: ['sect-frostmirror-court', 'sect-storm-tyrant-court'],
        accounts: {
            'sect-frostmirror-court':
                'Twice, and the province tells it as a story about a curiosity being visited by something serious. The Court holds the opposite and cannot get anybody to hear it: two raids reached the hall, two raids left, and a body that could not be taken twice is not a curiosity. Everything it has done since - the peer language in its correspondence, its own grant paper, eleven years of letters - is a two-hundred-year argument with a reputation it acquired by surviving.',
            'sect-storm-tyrant-court':
                'The Court went for a curriculum and found it could not be worn. Ice arts kill anybody without a mutated root exactly as lightning arts do, which the Court of all bodies should have known and which it discovered on the glacier at some cost, twice, because the second attempt was authorised by somebody who had decided the first was badly led. It has never described either as a defeat and has never described them at all.'
        },
        explains: 'the rivalry'
    },
    {
        id: 'event-the-two-hundred-year-refusal',
        yearsAgo: 200,
        provinceId: 'province-low-fall',
        what: 'The Nine Peaks Ascetic Order has refused every request to lease its vein for two centuries, without giving reasons, and the Third Sill Court has never compelled it.',
        parties: ['sect-nine-peaks-ascetic-order', 'court-third-sill'],
        accounts: {
            'sect-nine-peaks-ascetic-order':
                'A refusal repeated for two hundred years is a position, and the province insists on calling it geography. The Order\'s grievance is exactly this: everybody treats the deepest vein anybody has kept as an accident that happened to it, when what actually happened is that it said no, every time, to everybody, for two centuries, at a cost it can name.',
            'court-third-sill':
                'The right to refuse without giving reasons is in the grant, and the Sill wrote the grant, and the Sill has noted internally on four occasions that it is not the Order\'s right to exercise so much as the Sill\'s right to not have withdrawn. It has never withdrawn it. The Order has never been told that this is a decision somebody takes annually.'
        },
        explains: 'the holding'
    },
    {
        id: 'event-the-hermitage-choice',
        yearsAgo: 120,
        provinceId: 'province-low-fall',
        what: 'The Verdant Spring Hall grew from a hermitage of nine into a physician house with four dispensaries. The Longbough Grove, offered the same growth on the same terms in the same decade, declined it and has taken nobody since.',
        parties: ['sect-verdant-spring-hall', 'sect-standing-grove'],
        accounts: {
            'sect-verdant-spring-hall':
                'It chose, and it would choose again, and it is very tired of being told what it gave up by a valley of six people who are spoken of the way the Hall used to be. Nine hermits held a valley by respect and treated nobody; four dispensaries treat several thousand a year. The Hall\'s grievance is not that it regrets the choice - it is that the world grades the choice on a scale where treating people counts for nothing.',
            'sect-standing-grove':
                'The Grove will not state a grievance because a grievance is a claim and it makes no claims, and it will not state a position on the Hall either. What it will say, when pressed and only then, is that six disciples are six people known by name across the province, that a seventh means a roster, and that a roster is an institution rather than those six - which is not an argument about the Hall and is heard as one every time.'
        },
        explains: 'the intake'
    },
    {
        id: 'event-the-undercut-border',
        yearsAgo: 40,
        provinceId: null,
        what: 'The Bone Lantern Cult began working burn-zone finds the Gleaners\' Company had located, across a border neither region polices, and selling them cheaper.',
        parties: ['sect-bone-lantern-cult', 'sect-gleaners-company'],
        accounts: {
            'sect-bone-lantern-cult':
                'The Cult works sites nobody has been granted, which is its entire operating rule and the reason nobody with standing has ever been wronged by it. Whether a company on the other side of a line nobody patrols had walked over the same ground first is not a distinction that exists in the rotation, and the Cult has never been asked to recognise one.',
            'sect-gleaners-company':
                'The Company locates. That is the skill, it is expensive, it costs about one in nine a season, and it is being sold at a discount by a body that does not pay for it. There is no forum in which a contractor can raise this, because raising it means addressing the clerk who decided, and the Company has never once disputed anything with the Weir Office for that reason.'
        },
        explains: 'the rivalry'
    },
    {
        id: 'event-the-band-for-band-certification',
        yearsAgo: 60,
        provinceId: 'province-quiet-marches',
        what: 'The Ninefold Ledger certified, band for band, that the carving ladder and the ambient-drawing ladder are the same ladder. The Weir Office has never submitted its own table for certification and prices grants on the difference.',
        parties: ['sect-weir-office', 'house-ninefold-ledger'],
        accounts: {
            'sect-weir-office':
                'Carving reaches ranks that drawing does not, every carver in the Marches knows it, and the grant book has priced it that way since there was a grant book. The Office has not submitted its table because submitting a table invites a finding, and it has been running an administration on the difference for sixty years without anybody in the region asking to see the arithmetic.',
            'house-ninefold-ledger':
                'The certification is done, it is public, and it is band for band. The Ledger did not publish a conclusion about the Weir Office because the Ledger certifies what it is asked to certify and nobody in the Marches has asked - and it regards the Office\'s never submitting as the most legible thing in the region, on the reasoning that a bureau confident of its table submits it.'
        },
        explains: 'the reputation'
    },
    {
        id: 'event-the-swords-and-the-deference',
        yearsAgo: 200,
        provinceId: 'province-low-fall',
        what: 'The Azure Cloud Pavilion took Ashen Forge blades for two centuries and then stopped, and now accepts arms from elsewhere. The clan was not told and no reason was given.',
        parties: ['sect-ashen-forge-clan', 'sect-azure-cloud-pavilion'],
        accounts: {
            'sect-ashen-forge-clan':
                'Two hundred years of the clan\'s work, accepted, and then not, and nobody said anything. The clan has read every reason it can think of into the silence and its grievance is a precise one: the Pavilion did not stop accepting swords, it started accepting somebody else\'s deference, and a blood clan that reforges ploughed-up fragments because it cannot make steel of that quality itself knows exactly what that means about the blades.',
            'sect-azure-cloud-pavilion':
                'The Pavilion did not decide anything. A quartermaster changed, a standing order lapsed, nobody renewed it, and the terraces have never held a discussion in which the Ashen Forge appeared. That is worse than a decision and the Pavilion has never grasped that it is - it is a body that has been an apex for a short time and has not yet learned that at this altitude an unrenewed order is an announcement.'
        },
        explains: 'the rivalry'
    },
    {
        id: 'event-the-founding-oath-and-the-severed',
        yearsAgo: 500,
        provinceId: null,
        what: 'A founding oath of the House of the Bound Word forbids it to witness for the Severed. The Severed have offered, repeatedly, at rising fees, and the House has refused every time.',
        parties: ['house-bound-word', 'sect-the-severed'],
        accounts: {
            'house-bound-word':
                'The oath binds and the House will not test it, and the fee it is refusing is one it can see and count. That is the whole of the House\'s character in one transaction: an oathwright house that broke a founding oath for money would be selling nothing afterwards, so it declines a fortune annually and considers the declining to be the product.',
            'sect-the-severed':
                'The Severed keep offering because the refusal is the most useful thing anybody does for them. A house of oaths that will not witness a severance is a house conceding, publicly and at cost, that what the Severed do is real and permanent and takes - which is precisely the doctrine, argued for free, five hundred years running, by somebody who thinks they are refusing.'
        },
        explains: 'the rivalry'
    },
    {
        id: 'event-what-the-temple-gave-back',
        yearsAgo: 2_600,
        provinceId: 'province-low-fall',
        what: 'The Sweptground Temple has been endowed with ground four separate times and returned every endowment intact. The four sects that made them have each discovered this independently, and none of them at the time.',
        parties: ['sect-sweptground-temple', 'sect-nine-abyss-flame-sect'],
        accounts: {
            'sect-sweptground-temple':
                'Ground is a thing a Temple would then have to keep, and a Temple that has something to keep starts turning people away to keep it. The Abbot has said this in the same words to four sects across two and a half thousand years and it has never been received as an argument, only as saintliness, which he finds tiresome and says so.',
            'sect-nine-abyss-flame-sect':
                'The sect\'s grievance is that the Temple takes in the people its contract ruins, calls the sect a predator, and turns nobody away itself - which is easy from a house with no vein, no stores and nothing anybody wants. The part the sect has never said out loud is that it knows perfectly well the Temple could have had a vein four times over and gave it back, and that this is not the behaviour of a body making excuses.'
        },
        explains: 'the intake'
    },
    {
        id: 'event-the-eleven-day-boundary',
        yearsAgo: 20,
        provinceId: 'province-low-fall',
        what: 'Two granted sects moved leases inward on the northern side of the Longbough Grove\'s deference zone. The Grove does not patrol, was not told, and has not noticed.',
        parties: ['sect-standing-grove', 'court-third-sill'],
        accounts: {
            'sect-standing-grove':
                'The zone runs eleven days out because that is where the last test happened, and the Grove holds what it can comfortably walk and claims nothing beyond it. It is not aware that anything has changed, and the mechanism by which it would become aware does not exist, because it does not patrol and nobody who knows has any reason to be the one who says so.',
            'court-third-sill':
                'The valley has never been granted to anybody, has never been asked for, and the file is open. The Sill regards the northern leases as ordinary business inside its own book and has not registered that they intersect a boundary maintained entirely by a belief, because a belief does not appear on a grant map and the Sill has never been to the province.'
        },
        explains: 'the holding'
    },
    {
        id: 'event-the-two-seats-that-burned',
        yearsAgo: 260,
        provinceId: null,
        what: 'The Unlit Gate House and the House of the Measured Span had forty-one names in common on their founding rolls, and both seats burned in the same season.',
        parties: ['house-measured-span', 'house-anchorhold'],
        accounts: {
            'house-measured-span':
                'The official account is that the Unlit Gate House destroyed itself by overreach, and the Span teaches it, and the Span\'s own founding roll has forty-one names on it that are also on the other one. It has never reconciled the two and does not raise the season either seat burned in, and twenty-two of its thirty-one gate terminals have been closed and unreopenable ever since.',
            'house-anchorhold':
                'The Anchorhold has the survey and therefore has the dates, and the dates are not what the Span teaches. It has never published, because the Span is its rival and a rival publishing a correction is read as an attack rather than as a survey - which is the Anchorhold\'s standing difficulty with everything it knows, and the reason its own archive contains two facts about its own founding that it has also never published.'
        },
        explains: 'the claim'
    },
    {
        id: 'event-two-hundred-years-of-edges',
        yearsAgo: 200,
        provinceId: null,
        what: 'The Ninefold Ledger began recording the edges left by the Quiet Cut\'s severances. It has kept the record continuously since and has never made it public, and the Quiet Cut prices its work as though no such record existed.',
        parties: ['house-quiet-cut', 'house-ninefold-ledger'],
        accounts: {
            'house-quiet-cut':
                'A clean cut leaves nothing. That is the product, it is what the price is for, and the house has believed it without interruption for nineteen centuries. It cuts its own records as doctrine, which means it cannot audit itself, which means it has repeatedly recut work it had already been paid for - and has never once read that as evidence about how much of a cut survives.',
            'house-ninefold-ledger':
                'Every cut leaves an edge, the Ledger has two hundred years of them, and it has never published because an unpublished register is leverage and a published one is a pamphlet. It regards the Quiet Cut\'s pricing as the most reliable indicator in either province of what the house does not know, and it reprices its own arbitration fees off that.'
        },
        explains: 'the rivalry'
    },
    {
        id: 'event-the-tolls-and-the-fords',
        yearsAgo: 300,
        provinceId: 'province-low-fall',
        what: 'The Thousand Treasure Pavilion began pricing tolls on routes kept open, maintained and forded by the Clear River Fordhall, and pays nothing toward them.',
        parties: ['sect-clear-river-alliance', 'sect-thousand-treasure-pavilion'],
        accounts: {
            'sect-clear-river-alliance':
                'Eleven towns need crossing, the Alliance crosses them, and somebody else prices the crossing and calls it commerce. The Alliance is tolerated absolutely because nobody else wants the river, which is the same sentence read two ways: it holds no vein, has no grant and has no relationship with anything above it, and it is the only reason the routes it is being charged for exist.',
            'sect-thousand-treasure-pavilion':
                'A toll is priced on what a route is worth to the person using it, which has never had anything to do with who maintains it, and the Pavilion would say so in public if anybody made it. It has never been made to. Its own position is that it sells at a rate somebody else sets and it is very clear about who that is, so being called the party that takes the margin is a familiar and slightly bitter joke inside the auction floor.'
        },
        explains: 'the rivalry'
    },
    {
        id: 'event-the-roads-and-the-grants',
        yearsAgo: 190,
        provinceId: 'province-quiet-marches',
        what: 'The Sixmile Wardens surveyed and staked every route through the Marches that does not cross dead ground. The Weir Office issues grants to holders who arrive on those roads and contributes nothing to them.',
        parties: ['sect-sixmile-wardens', 'sect-weir-office'],
        accounts: {
            'sect-sixmile-wardens':
                'Nine hundred stakes, a shed and a survey, all of it the Wardens\' own work and the only complete map of safe ground in the region, and they are paid in paint. Every grantee the Office has ever collected from walked in on a marked road. The Wardens have said so and there is no forum in which saying it does anything.',
            'sect-weir-office':
                'The Office administers two workable faces on somebody else\'s behalf, from a counter, with a register, and its discretion extends exactly as far as the schedule it is given. Roads are not on the schedule. There is no line in the grant book for them and the Office has never had the authority to create one, which it has never said to the Wardens because the Wardens have never addressed it in a form that would require an answer.'
        },
        explains: 'the rivalry'
    },
    {
        id: 'event-the-crossing-and-the-runoff',
        yearsAgo: 380,
        provinceId: 'province-low-fall',
        what: 'Ru Anjing crossed the Lid. It is the last confirmed crossing in the world. She spent eleven years divesting into the Azure Cloud Pavilion first, and the runoff of the vein she had worked went to the terraces below the gorge, which nobody wanted.',
        parties: ['sect-azure-cloud-pavilion', 'sect-azure-mist-court'],
        accounts: {
            'sect-azure-cloud-pavilion':
                'Everything the Pavilion is rests on it, and the Pavilion knows this and resents being reminded - the province treats its standing as owed to a dead woman rather than earned, and repeats the joke about renting her. What the terraces have never worked out is that the divestment is not the asset. The post is: somebody above who still answers, three hundred years into a relationship that is not three thousand years old, and attention is the one thing in the world that cannot be secured.',
            'sect-azure-mist-court':
                'The Mist got the water nobody wanted, and on it carried two people to the top of the world in one lifetime, and was filed as a feeder for three centuries on a power figure that stopped being true in the second one. Its whole trade is teaching people the terraces sent back. It keeps a recall roll of every one of them, it is the only such record in the province, and the Pavilion has never asked to see it.'
        },
        explains: 'the gap'
    },
    {
        id: 'event-the-storeroom-read-from-a-list',
        yearsAgo: 140,
        provinceId: 'province-low-fall',
        what: 'The Storm Tyrant Court stopped opening its storeroom at successions and began reading the contents aloud from the record instead. Nothing has been physically checked against the list since, and at least two Storm Elders privately doubt the room matches it.',
        parties: ['sect-storm-tyrant-court', 'apex-deep-survey'],
        accounts: {
            'sect-storm-tyrant-court':
                'A dignity, adopted for a succession where the outgoing Tyrant was too ill to descend, kept for the next one because it had been done before, and doctrine by the third. The Court has never framed the practice as a decision. What it has is a list, read aloud with great ceremony, of things nobody has laid eyes on in fourteen decades - and two Elders who have worked out that the reading is the only evidence and have both concluded, separately and for the same reason, that asking would be the end of them.',
            'apex-deep-survey':
                'The Survey does not certify vaults and has never been asked to. What it does hold is the only thing it needs: a curriculum that cannot be replaced is worth administering directly whatever else is or is not in the room, and the two short renewals it has issued were about the three obligations rather than about an inventory. Whether the Survey knows what is missing is a question it has arranged never to be asked in a form requiring an answer.'
        },
        explains: 'the peak'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// PER FACTION
//
// Ordered as the sect catalog orders them, so a reader holding both files open
// is looking at the same house in the same place in each.
// ─────────────────────────────────────────────────────────────────────────

export const FACTION_HISTORY: Record<string, FactionHistory> = {
    // ── the Azure grant ───────────────────────────────────────────────
    'sect-azure-cloud-pavilion': {
        factionId: 'sect-azure-cloud-pavilion',
        origin:
            'It took the gorge and the vein under it off a house whose name it no longer records, nineteen centuries ago, and spent fifteen of those centuries as a competent regional sect with a good vein and no particular position. Everything that makes it an apex happened inside the memory of people still working the terraces, and it is the only body at that altitude whose founding as a power can be dated at all. The other two cannot be dated by anybody.',
        whyTheGapIs:
            'It is being read backwards by everybody including itself, and the figure that does the misleading is the one at the top of the entry. The Pavilion RAISES people to Core Formation and has raised nobody past Nascent Soul in three centuries. The forty-one on its own row is not a counter-example to that and is not output: Ru Anwei arrived at the end of the ladder before there was a Pavilion at this altitude to arrive in, has stood at the first rung of the last realm for three hundred and eighty years without moving, and was raised by her sister rather than by this house. Every apex is a pipeline and a person, and on this one they are further apart than on anything else at that altitude: the house raises to Core Formation and the woman in the inner hall is at the first rung of the last realm.'
            + ' Nor does the shelf close the gap, which is the second thing a reader assumes. The house holds a road that ends at the top of the ladder and it changes none of these figures, because a road is a ceiling and not a rate: there are two copies, they do not leave the inner hall, and the one person alive who has read the whole of it has not left that hall in three hundred and eighty years either. One teacher, available sometimes, is what stands between an apex shelf and an apex pipeline.'
            + ' What it lost was never the ability to make people, and what it never had is time - three hundred and eighty years is not three thousand, and it is trying to grow a gradient the other two apexes did not have to grow. Single-use material made above and addressed to a house that still exists is a supply nobody else has at any price, it is arriving now, and the pipeline is climbing on it.',
        whatTheUnlitNodesWere:
            'A working diagram for a house four times its present size, inherited with the gorge and never wholly understood. The practice yard was cut for six hundred and holds ninety, and the thirty-two dark nodes are laid out around that yard rather than around the vault - so what the Pavilion inherited was not a fortress but a school, built by whoever it took the gorge from, at a scale nothing in its own records accounts for.',
        whereTheWrongBeliefComesFrom:
            'Ru Anjing answered an offering with two words. The Pavilion teaches that they were an instruction to wait for a specific event, and it has taught this for three centuries with total sincerity, because two words from the far side of the Lid are the most valuable object the house owns and a house does not treat its most valuable object as an aside. The offering record shows the words were answered to a question about a border dispute nobody now remembers asking. The record was never concealed. It was simply filed under the dispute.',
        sharedEvents: ['event-the-crossing-and-the-runoff', 'event-the-swords-and-the-deference']
    },
    'sect-azure-mist-court': {
        factionId: 'sect-azure-mist-court',
        origin:
            'It was not posted and it did not inherit. It grew, on runoff, below the terraces, doing the one thing the terraces cannot do - teaching people who have already failed at the Pavilion\'s forms once - and became a court the way its apex became an apex, by somebody going further than the institution around her and the institution being re-described afterwards. It is the youngest court in the world by nine centuries.',
        whyTheGapIs:
            'The Mist has never been past anybody. Its strongest is alive, in post, and is the reason the figure moved, so the distance between what it holds and what it turns out is not decay - it is a house whose top arrived in one lifetime and whose bottom is still being taught in a yard laid out for four hundred and swept for sixty. What it produces is better than its node count predicts, entirely because second attempts are cheaper to teach than first ones and nobody else in the province will take them.',
        whatTheUnlitNodesWere:
            'The lower gorge was terraced by the same hand that cut the upper, and the seven dark nodes are the bottom of one diagram rather than the whole of a smaller one. The Mist holds the half of the vein that was never worth terracing, which is also the half whose nodes were laid last and finished worst, and nobody at the Pavilion has ever been down to look.',
        whereTheWrongBeliefComesFrom:
            'The Mist files a quarterly probation roll with the terraces and believes it is read, which was true for two centuries and is the only reason anybody kept filing it. It stopped being true when the office that read it was folded into another one and nobody was told, ninety years ago. The clerk who now files it unopened has said so to three separate Mist Elders. None of the three passed it on, and each of the three has a different and entirely creditable reason.',
        sharedEvents: ['event-the-crossing-and-the-runoff']
    },
    'sect-azure-dew-sect': {
        factionId: 'sect-azure-dew-sect',
        origin:
            'Four hill villages at the head of the gorge, where the vein runs shallow enough that a mortal can feel it on a cold morning, and a body that formed to teach the children who could. It built everything it holds. It is the only holding in the Azure grant that inherited nothing at all, which its Wardens raise more often than the Pavilion enjoys.',
        whyTheGapIs:
            'There is no gap of the ordinary kind. The Dew walks a village child to the last rung of the tempering scripture and then sends them up the gorge, so what it turns out is a delivery rather than a ceiling: it has never produced anybody higher, has never tried, and is producing at that rung this year. The distance to its Warden is inheritance sitting on top of a house that has never pretended the two figures were about the same thing.',
        whatTheUnlitNodesWere: null,
        whereTheWrongBeliefComesFrom:
            'The Dew believes the Pavilion values it for the finds, because the finds are the only thing the Pavilion has ever written to it about and four hundred years of correspondence is a hard thing to read past. What the Pavilion actually values is that a body teaching in the villages keeps the villages from teaching themselves, which is worth more than every find the Dew has ever sent up and has never appeared in a letter, because it is not the sort of thing anybody writes down.',
        sharedEvents: []
    },
    // ── the righteous middle ──────────────────────────────────────────
    'sect-verdant-spring-hall': {
        factionId: 'sect-verdant-spring-hall',
        origin:
            'A hermitage of nine, holding a terraced herb valley by respect and nothing else, on ordinary ground with no vein worth the name. It chose to become a physician house with four dispensaries, and everything true about it since - the largest book of unpaid obligations in the province, the reputation, the grievance - descends from that one decision.',
        whyTheGapIs:
            'It is climbing, and what changed is not the ground but what a debt can be settled in. The Hall has begun taking old bills in herb stock and comprehension materials instead of stones, which is the first time its enormous book of obligations has been convertible into anything a disciple can use. What it lacked was never patients or skill; it was that a physician house is paid in gratitude, and gratitude does not put anybody up a rung.',
        whatTheUnlitNodesWere:
            'A valley ruin the Hall built into rather than inherited cleanly. The stone irrigation channels are original and get patched with clay, the eight dark nodes are on the upper terraces where nothing is grown any more, and the restoration method the Hall teaches came out of the same ruin - so the house is standing inside a working it can operate at the bottom and not at the top.',
        whereTheWrongBeliefComesFrom:
            'The Hall teaches that Lu Wan wrote the restoration method, and Lu Wan is the founder, and a founding physician who wrote the method is a much better story than a founding physician who found it. The Hall\'s own founding record says "recovered", in Lu Wan\'s hand, and the valley ruin it came out of predates her by six hundred years. Nobody concealed anything; one word in a founding record stopped being read as a verb.',
        sharedEvents: ['event-the-hermitage-choice']
    },
    'sect-nine-peaks-ascetic-order': {
        factionId: 'sect-nine-peaks-ascetic-order',
        origin:
            'Nine linked peaks over the deepest vein anybody has surveyed and managed to keep, and the second half of that sentence is the whole of the Order\'s history. Deeper veins have been surveyed. What is unusual is keeping one, and the Order kept this one by refusing every request to lease it for two centuries, without giving reasons, at a cost it can itemise and nobody asks about.',
        whyTheGapIs:
            'It is the one house in the catalog short of nothing but years. Its own rule prices every rung in seasons served, and seasons cannot be bought, hurried or supplied - so its pipeline is not waiting on a supplier, a vein, a book or a patron. It is waiting on people to have carried the stone long enough. That makes it the most obvious target in the province: everybody knows where the stores are and that they have never been assayed.',
        whatTheUnlitNodesWere:
            'The Order does not know, states that it does not know, and maintains them anyway. Fifty-two nodes it cannot account for, on the reasoning that somebody meant them - which is the single most characteristic thing the house does. What is establishable from outside is that the lit eleven are all on the working faces and the dark fifty-two are not, so whatever the diagram was for, it was not for getting at the vein.',
        whereTheWrongBeliefComesFrom:
            'The Order holds that carrying the stone builds the body, which is what it looks like from inside and is what every ascetic tradition in the world says about its own discipline. Its own intake records say something else and have said it for four centuries: the stone selects for people who will do a pointless thing for years. That is a more useful filter and a less flattering one, and nobody has ever had a reason to read the intake records against the doctrine.',
        sharedEvents: ['event-the-two-hundred-year-refusal']
    },
    'sect-clear-river-alliance': {
        factionId: 'sect-clear-river-alliance',
        origin:
            'Eleven river towns and every ford between them, none of it over a vein and all of it over traffic. The Alliance was not founded so much as agreed to: the towns needed crossing, somebody crossed them, and after two centuries the arrangement had a name. It has never held ground, never had a grant, and never had a relationship with anything above it.',
        whyTheGapIs:
            'Wide and shallow forever, and moving for the first time in three centuries - on wagons rather than water. Three Ford Masters have run an unlicensed carrying service for six years and remit a share in kind, so eleven landings now handle bonded refining stock instead of ferry fares. What the Alliance never had was anything a cultivator climbs on; what it has now is cargo, and it turns entirely on the River Elders continuing not to establish what the wagons are.',
        whatTheUnlitNodesWere:
            'They are not the Alliance\'s and never were. Five of its eight nodes are lit and all five are on piers, and the piers at Scarwater are two ages older than the Alliance - so what it holds is the river furniture of somebody long gone, three nodes of which nobody alive has ever seen working. Half its river charts are copies of a survey from the same period and are more accurate than anything the Alliance has produced since.',
        whereTheWrongBeliefComesFrom:
            'It believes the Scarwater pilings are Alliance work from three centuries back, and there is an Alliance repair record from three centuries back that says so - a genuine record of a genuine repair, read ever since as a record of the building. The pilings are two ages older and are the reason that ford has never moved, which the Alliance would find more useful to know than almost anything else it does know.',
        sharedEvents: ['event-the-tolls-and-the-fords']
    },
    'sect-sweptground-temple': {
        factionId: 'sect-sweptground-temple',
        origin:
            'A walled temple on swept ground, deliberately built where nothing has settled in an age, and the only faction in either province that is unaffiliated on purpose at a price it has calculated. It produced the one crossing in its records two and a half thousand years ago. The abbot who made it sent nothing down to the Temple. What he sent came down to ordinary people across the province, a little of it passing through the Temple\'s hands on the way and most of it not, and it is the largest uncatalogued distribution of immortal-made goods anybody has ever made - which is the Temple\'s own practice, carried out at the only scale where it changes a province.',
        whyTheGapIs:
            'It never received the one thing that makes an apex, and its own ascendant is the reason. A house at the top of the world is a house with somebody above the Lid feeding it, and the Temple has somebody above the Lid who deliberately fed somebody else - not neglect and not forgetting, but a decision entirely consistent with a body that has been endowed with ground four separate times and returned every endowment intact. So the gap is not decline and not a failure to arrive: it is what a house looks like when the one channel it had was spent on the province instead. The Abbot has twice declined a grant since, on the argument that a Temple with a vein starts turning people away to keep it, which is correct and has cost four generations of disciples their ceiling.',
        whatTheUnlitNodesWere: null,
        whereTheWrongBeliefComesFrom:
            'The Temple teaches that the First Abbot gave everything away to people rather than to the Temple, as a lesson about attachment, and it is a good lesson and it is taught well. The likelier reading of the founding record is that there was no Temple yet to give anything to. Two and a half thousand years of a house reading its own beginning as a choice its founder made, when the record reads as a man with nothing to institutionalise. What complicates it is that the Temple holds exactly one thing nobody meant it to have. It is not on any list, because the Temple keeps none; it did not come down from the abbot, because nothing did; and whether it is older than the Temple, arrived by some route nobody recorded, or is a piece of what was passing through that never went out, is not established by anything in the house\'s possession.',
        sharedEvents: ['event-what-the-temple-gave-back']
    },
    'sect-lantern-hall': {
        factionId: 'sect-lantern-hall',
        origin:
            'Reading halls in nine cities and a stack room under each one larger than the hall above it, built to write down what the crossings take. That is the whole of its founding purpose and it has never widened: the world calls what a crossing takes "the price" and considers the matter closed, and the Hall considers a thing nobody itemises to be a thing nobody has counted.',
        whyTheGapIs:
            'Archivists cultivate on the margins of the working day and the Hall considers that the correct trade, so its pipeline is slow by policy rather than by shortage. There is no missing supply here and nothing was lost. A house that decided four centuries ago that the register comes first has a pipeline shaped by that decision, and it would rather be described as slow than reopen it.',
        whatTheUnlitNodesWere:
            'They came with the buildings, and the buildings came from somewhere the Hall has not looked. Thirteen dark nodes across nine cities, no two cities alike, which is what a set of nodes looks like when a body acquires nine unrelated premises rather than building one seat - and the stack rooms flood on a schedule the Hall has never fixed, which is the same fact from underneath.',
        whereTheWrongBeliefComesFrom:
            'The Hall holds that its counter-register is independent of the House of Held Names, and in every sense it cares about it is: different method, different purpose, no shared staff and no money between them. What it has never checked is the freehold. It has been giving away for free, out of nine buildings, the correction to a body that owns all nine of them, for two hundred years, and has been applauded for it the whole time.',
        sharedEvents: ['event-the-stack-room-leases']
    },
    'sect-standing-grove': {
        factionId: 'sect-standing-grove',
        origin:
            'A valley of old trees, the mountain above it and four settlements, all within a day and a half\'s walk, held by nothing but a belief about what would happen. The belief dates from one test, and the Grove has not been tested since. It built its four nodes itself and inherited nothing at all, which makes it the only institution in the province with nothing it cannot operate.',
        whyTheGapIs:
            'The Grove has taken nobody in forty-one years, which is not a shortage but a ceiling it chose. Six disciples is the number at which every one of them is known by name across the province, and the deference the Grove lives on is a belief about those six specific people rather than about an institution - so a seventh means a roster, a roster means administration, and administration means the belief stops being about anybody in particular.',
        whatTheUnlitNodesWere: null,
        whereTheWrongBeliefComesFrom:
            'The Grove believes its deference zone runs eleven days out because that is where the last test happened, and it did, and for a very long time that was exactly where the zone ran. It has never patrolled, on the principle that patrolling a boundary held by belief is the fastest way to find out it is not held by belief - which is correct, and which is also the reason it is the last body in the province to learn that the boundary has moved.',
        sharedEvents: ['event-the-hermitage-choice', 'event-the-eleven-day-boundary']
    },
    // ── the trades ────────────────────────────────────────────────────
    'sect-stonewright-consortium': {
        factionId: 'sect-stonewright-consortium',
        origin:
            'Refining houses at the head of the veins, and the exchange rate, which is the real territory. The Consortium was granted the assay monopoly rather than earning it, and the grant is worth more than any vein in the province - the right to set and publish the rate, inside a band it is given and has never published, renewed every twelve years with the band moving each time.',
        whyTheGapIs:
            'It buys production rather than growing it. About half its Core Formation members were recruited mid-career off other sects, which is a policy and not an accident, and a house that buys its middle never builds the thing that would let it stop buying. The distance between what it holds and what it makes is exactly the size of that decision, repeated for a century and a half.',
        whatTheUnlitNodesWere:
            'They belong to the presses. The refining machinery is inherited, of a design the Consortium\'s own artificers cannot reproduce at any price, and the twenty-one dark nodes are distributed around the press halls in a pattern that only makes sense if the presses once ran on more of them. What the Consortium maintains is enough of the diagram to keep the machines it has; what it cannot do is add one.',
        whereTheWrongBeliefComesFrom:
            'It believes it sets the stone rate, and for ordinary years it does - the presses are its, the assay is its, the publication is its, and every institution in the province reads the figure it prints. What it has never noticed is that shortages are not ordinary years. In a shortage the number moves before the Consortium publishes and the Consortium publishes it a week later, which reads from inside like responsiveness and from outside like a week.',
        sharedEvents: ['event-the-four-shortages']
    },
    'sect-thousand-treasure-pavilion': {
        factionId: 'sect-thousand-treasure-pavilion',
        origin:
            'Auction houses in every city of consequence and a vault nobody has located, built on the one skill the province cannot do without and does not respect: knowing what a thing is worth. It has never held ground and has never wanted to, and it bought a tablet hall complete rather than assembling one, which is the house in a sentence.',
        whyTheGapIs:
            'There is barely a gap and the house has never had far to fall. An appraiser who spends forty years on the floor arrives at Core Formation Perfection, the Pavilion is turning them out at that rung right now, and it has never in its history produced anybody higher - everything above that on the roll walked in with a price on it. Nothing here is decaying, which is exactly why a claimed ancestor is worth what it is worth to a house like this one.',
        whatTheUnlitNodesWere:
            'Bought, along with the hall they are in, and the Pavilion has never established what it purchased. Seven dark nodes under an auction floor built for four hundred, with the back nine rows now rented out for storage - and a tablet hall of which no one on the staff can read the older third. The house that can price anything cannot price its own premises and has never advertised the fact.',
        whereTheWrongBeliefComesFrom:
            'The Wei Zhaoyin lineage is a fraud three generations old, and the people repeating it are not the people who committed it. That is the whole of the trace and it is the most ordinary way an institution comes to believe something false: the ones who knew retired, the ones who did not inherited the story with the job, and by the third generation there was nobody left who had ever had a reason to check.',
        sharedEvents: ['event-the-four-shortages', 'event-the-tolls-and-the-fords']
    },
    'sect-cinnabar-crucible-guild': {
        factionId: 'sect-cinnabar-crucible-guild',
        origin:
            'Furnace halls beside the volcanic fields and a fixed price list nobody negotiates, founded on a refining hall wall that is legible to about a third. Four hundred years of reputation have been built on that third, and the Guild has never claimed otherwise, which is unusual and is most of why the claim holds.',
        whyTheGapIs:
            'It is the one house in the catalog not short of pills, because it makes them, and short of the only thing pills cannot buy. An alchemist spends the years that would have been cultivation standing at a cauldron refining what other houses climb on. So the Guild sits on stores it could walk its own people to the end of its scripture with, has never had the generations to spare, and the stores are not even hidden - they are on a fixed price list nobody negotiates.',
        whatTheUnlitNodesWere:
            'The wall is the diagram. Twelve dark nodes correspond to the illegible two thirds of the founding wall, and the Guild has lit exactly the nodes its readable third accounts for - which means the darkness is not damage or neglect but an honest map of what the house can read, maintained deliberately, and it is the only holding in the province where the unlit count is a measurement rather than a loss.',
        whereTheWrongBeliefComesFrom:
            'The fourth line of the wall script is taught as a step. Furnace Elder Bo died proving it is not, the Guild recorded the death, and the Guild kept teaching the line - which sounds like corruption and is something worse and commoner. Bo proved a negative in a hall where a positive was needed, the finding was filed, and the curriculum was never the sort of document anybody thought to reconcile against a mortality record.',
        sharedEvents: []
    },
    'sect-ashen-forge-clan': {
        factionId: 'sect-ashen-forge-clan',
        origin:
            'A clan compound built into the flank of a live volcano, around a furnace that was already there. The First Hammer built the compound; the furnace is older than the compound by an age, and everything the clan is has been organised around a fire it did not light and cannot relight.',
        whyTheGapIs:
            'There is none, and the absence is the point. A blood clan cannot recruit, so what it produces is the family, and the family gets the same fire every generation: every Ashen child who takes the rota arrives at the rung the clan chief stands on, none has ever passed it, and in eleven generations none has fallen short of it either. Nothing is missing and nothing is decaying. There is simply no further rung inside a compound built round one furnace, which is what the two who refused a turn were actually refusing.',
        whatTheUnlitNodesWere:
            'The furnace\'s, not the clan\'s. Five dark nodes sit outside the compound wall in an arc the compound was built across, so the diagram is older than the building standing in it, and the clan reforges ploughed-up fragments because it cannot make steel of the quality the furnace was built to work. It has never connected the two observations.',
        whereTheWrongBeliefComesFrom:
            'The clan holds the furnace by right of the First Hammer having built the compound around it, which is a perfectly good claim to a building and is being made about a fire. The furnace carries an inscription. Eleven generations have read it as decoration, and every one of them has had the same reason: a clan whose whole standing is that the furnace is theirs does not commission a reading of the one document that could say otherwise.',
        sharedEvents: ['event-the-swords-and-the-deference']
    },
    'sect-hollow-bell-wanderers': {
        factionId: 'sect-hollow-bell-wanderers',
        origin:
            'No fixed seat, no ground, nothing inherited, and a bell hung at a crossroads to say members passed within the month. It is a league of people every sect in the province refused first, and several of those sects now recruit from it, which is the entire arrangement and the entire grievance.',
        whyTheGapIs:
            'It is not a pipeline, it is a waiting room, and the league does not stop anybody leaving. Anyone who reaches Foundation Establishment is recruited away within a year by one of the houses that turned them down, so the Wanderers have the lowest reliable production in the province while having produced, cumulatively, a great many people who are now somewhere else on somebody else\'s roll.',
        whatTheUnlitNodesWere: null,
        whereTheWrongBeliefComesFrom:
            'The bell practice is held to be two centuries old and originally a signal, which is what a practice looks like once it has been done long enough that nobody present remembers starting it. The oldest bells are forty years old. It was started by one person as a joke about being unwelcome, and the joke was good enough that it was copied before it was explained, which is how most customs of this kind actually begin.',
        sharedEvents: []
    },
    'sect-frostmirror-court': {
        factionId: 'sect-frostmirror-court',
        origin:
            'A glacier court above the snowline on a cold vein nobody else can work, appearing on no accurate map, holding the only complete ice curriculum left in the world - and holding it because it dug it out of the ice rather than inheriting it from teachers. It became a court when the curriculum turned out to be the one thing in the province nobody could replace.',
        whyTheGapIs:
            'Constrained by intake and not by ground. It will only admit mutated ice roots, because the arts kill everybody else, so it produces very few and each one very far - to the end of its own canon, twice, and no further. The gap is not a loss and cannot be closed by acquiring anything: it is the arithmetic of a house whose applicant pool is a handful of people in a generation.',
        whatTheUnlitNodesWere:
            'A larger court, on a glacier that has since retreated forty spans below the working face. Eighteen dark nodes sit downslope of the lit twenty-six, in ice that is no longer there, so the Court is holding the top of a diagram whose bottom has melted - which is also why the hall is kept cold enough that nothing has ever drawn on the qi standing in it, and why the Court cultivates there and nowhere else.',
        whereTheWrongBeliefComesFrom:
            'The Court holds that the Mirror lies under the hall by choice, and the founding inscription can be read that way. It can also be read the other way, and the Court does not teach that it is ambiguous. The hall was built over her afterwards. Two centuries of an institution reading its own founding stone in the only way that makes its own arrangement deliberate is not a lie; it is what a founding stone is for.',
        sharedEvents: ['event-the-two-raids']
    },
    // ── the datum, and the two bodies on it ───────────────────────────
    'sect-kiln-wardens': {
        factionId: 'sect-kiln-wardens',
        origin:
            'It was a posting rather than a house for nine hundred years, and the province mistook staff for an institution the entire time. What is standing four provinces away now is the roll, most of the Wardens, and the founding posting order naming the first four - and the Deep Survey\'s own administrative word for a posting it no longer holds.',
        whyTheGapIs:
            'Nobody has ever counted them and the figures are the Anchorhold\'s estimate from what walks the perimeter. A posting does not have a pipeline: there is no intake, no admission that has ever been used, and no applicant in nine hundred years, so what the register shows as production is an outside body\'s arithmetic about a rota.',
        whatTheUnlitNodesWere: null,
        whereTheWrongBeliefComesFrom:
            'The world is wrong about them rather than the reverse, and the error is entirely reasonable: every outside account assumes they draw on the root vein, because a body sitting on the richest ground in the world and taking none of it has no precedent anywhere and no motive anybody can supply. The Anchorhold\'s survey figures show they take nothing from it at all. The figures are public. Nobody has believed them.',
        sharedEvents: ['event-the-reposting']
    },
    'sect-hollow-court': {
        factionId: 'sect-hollow-court',
        origin:
            'Four mountains on the richest vein anybody has ever surveyed, one occupant each, and an arrangement that is probably the only functioning collaboration at that altitude in the history of the world: a crossing needs a protector, almost nobody can obtain one, and the Court holds enough people at the top of the ladder that one can cross while the others stand. Everything else about it follows from that and nothing else does.',
        whyTheGapIs:
            'There is no gap here, and that is the whole of what is strange about it. Everywhere else in the catalog a house is a wide pipeline with one exceptional person on top of it, and the distance between the two is the story. Here the routine figure is the top of the ladder and the strongest member is three rungs over it, because the Court admits only people who could plausibly reach the last realm and then spends everything it has on getting them there. Four are standing at the end of the road now and six more are on it. What this house does not do reliably is the last step: six crossings in four thousand four hundred years, against a road it can walk anybody to the end of. That is the honest account of the place and it is the opposite of the reading it usually gets - not a still house that produces nobody, but the only one in the world whose pipeline and whose peak are the same people.',
        whatTheUnlitNodesWere:
            'A hundred and fifty-nine nodes for an institution that is not there any more, and the Court has no interest in them. The seating in the hall is arranged for an audience of two hundred and holds four; the dark nodes are laid out on the same scale, which is the only surviving evidence anywhere of what stood on those four mountains before the people who declined to leave them.',
        whereTheWrongBeliefComesFrom:
            'They believe they are inert, which is the honest self-assessment of four people who do not leave, do not recruit, do not trade and do not act. Three regional wars have been settled by parties travelling to ask them a question and going home with the answer. That is not inertness by any measure except their own, and their own measure counts only what they go out and do - which is a definition they inherited from an age when going out was what a body at that altitude was for.',
        sharedEvents: []
    },
    // ── demonic ───────────────────────────────────────────────────────
    'sect-the-severed': {
        factionId: 'sect-the-severed',
        origin:
            'It cannot establish who founded it. The founding ledger entry\'s identifying columns cut themselves, which is either the purest possible demonstration of the doctrine or the first thing that ever went wrong with it, and the house has declined to have an opinion for six centuries. Everything since is six cities, all rented, three portable nodes, and a ledger.',
        whyTheGapIs:
            'The fastest pipeline in the catalog by a distance and the worst attrition, and both come from the same sentence: pre-paying the price makes crossings survivable, and most of them stop being people before they stop being cultivators. What sits between what the house holds and what it turns out is not a shortage of anything. It is the fraction that does not arrive.',
        whatTheUnlitNodesWere: null,
        whereTheWrongBeliefComesFrom:
            'They hold that the cut is theirs to choose, which is the doctrine, the recruitment document and the whole of the argument that the practice is dignified rather than merely survivable. The Quiet Cut, who do it professionally and for money, find that a self-severance takes what is reachable rather than what was chosen. The Severed have been told. They do not accept the finding, and the reason they do not is that accepting it would make six centuries of ledger entries a record of something other than what they say they are.',
        sharedEvents: ['event-the-founding-oath-and-the-severed']
    },
    'sect-crimson-abyss-hall': {
        factionId: 'sect-crimson-abyss-hall',
        origin:
            'A sinkhole hall under a town that officially does not know it is there, on the least valuable grant in the province, with a drain in the lower floor cut for a purpose the Hall has adopted without ever establishing. The First Abyss Lord set a tithe rate that nobody has dared revise, and the Hall has been living inside that decision ever since.',
        whyTheGapIs:
            'There is none, and it is the sharpest case in the catalog. Everybody who survives the Hall finishes its book, because the devouring art ends where it ends and the Hall\'s material is its own intake - the one supply in the world that has never run short. The price is who does not survive, and the consequence is that there is nowhere further inside the Hall except the Abyss Lord\'s seat, which is why he is right that talent leaves.',
        whatTheUnlitNodesWere:
            'The sinkhole was worked before the town was there, and the ten dark nodes are below the hall rather than around it, on levels the Hall has not opened. The drain in the lower floor is cut to the same standard as the lit six and is aligned with two of the dark ones. The Hall has adopted the drain for a use of its own and has never asked what the alignment is for.',
        whereTheWrongBeliefComesFrom:
            'It believes the tithe rate is generous because it has never been raised, and no Abyss Lord in five hundred years has raised it, which by every internal measure the Hall has is exactly what generosity looks like. Measured against five centuries of Consortium rates, holding it flat has more than tripled it in real terms. The Hall has never held a rate against the exchange because the Hall does not read the exchange - it is paid in stones, weekly, in advance, which is the entire pitch and the reason it works.',
        sharedEvents: ['event-one-letter-for-both']
    },
    'sect-bone-lantern-cult': {
        factionId: 'sect-bone-lantern-cult',
        origin:
            'Old battlefields worked in rotation in the third year after any large engagement, and a field wall built of fragments sorted by weight rather than by what they were. It holds no ground because nobody has ever granted the ground it works, which is the precise sense in which it is tolerated: not permitted, not protected, simply never the subject of a complaint anybody with standing is entitled to make.',
        whyTheGapIs:
            'It has managed Deity Transformation exactly once in seven hundred years - the Pale Ancestor, and the whole of its prestige - and produces at Foundation Establishment otherwise. What it lost was not a supply. It never had a curriculum above the level of the four arts it teaches, two of which are corpse work, and no house has ever taught it one, because no house will sit next to it.',
        whatTheUnlitNodesWere:
            'The Cult does not hold a seat, so its nine nodes are portable and were made by somebody else - salvaged from sites, in fragments, sorted by weight like everything else it owns. Seven do not work, and the Cult has never established whether that is damage or whether the seven were never a set. It is the best ground-reading body alive and it cannot read its own equipment.',
        whereTheWrongBeliefComesFrom:
            'The founding note says the hundred-and-forty-year rotation exists so that survivors die off first. The Cult holds it exists to let sites recover, which is a better sentence, is what a hundred and forty years plausibly does to a battlefield, and is what every member has been told by the member before them. The note is not lost and is not hidden. The Cult has read it and has genuinely forgotten the difference, which is the more disturbing of the two possibilities and is the one the record supports.',
        sharedEvents: ['event-the-undercut-border']
    },
    'sect-nine-abyss-flame-sect': {
        factionId: 'sect-nine-abyss-flame-sect',
        origin:
            'A caldera fortress on the vent vein, reached by one bridge kept in poor repair on purpose, holding a recovered transformation contract whose counterparty its own text does not name. It has paid its tribute early every cycle for two hundred years, has never been refused a renewal, and is the only openly demonic body in the province that has never pretended to be anything else.',
        whyTheGapIs:
            'The strongest live pipeline in the province, and the distance to its elders is the ordinary distance between a working method and the people who worked it first. The contract functions, the cost is paid later and by the individual, and the sect is alone among the high factions in not having concluded that the road upward is shut - which is either the only clear sight in either province or the contract talking, and the sect is aware that both readings are available.',
        whatTheUnlitNodesWere:
            'Nineteen of thirty-eight, in an alternating ring, and this is the most legible unlit set in the world: the sect could read every other line of the diagram and lit exactly what it understood. Nobody has ever established what the intervening nineteen do, and the alternation means the sect is running half of somebody\'s working at full commitment without any way to know whether the halves were meant to be separable.',
        whereTheWrongBeliefComesFrom:
            'It teaches that the contract is a bargain with a knowable counterparty, and it must, because an applicant signing a contract wants to know who is on the other end and the sect is scrupulous about disclosure in every other particular. The recovered text names nobody. The sect supplies a counterparty by tradition and has done for so long that the tradition is now in the teaching materials, above the text, in a hand three centuries younger.',
        sharedEvents: ['event-what-the-temple-gave-back']
    },
    'sect-storm-tyrant-court': {
        factionId: 'sect-storm-tyrant-court',
        origin:
            'It was an apex. That is the fact everything else about the Court descends from and the one the province has stopped saying out loud: a floating stone over a permanent storm, a founder who crossed, a treasure sent down, and the only working lightning curriculum in the world. Three of those four are still here. It holds a claim to a crossing that is true, elders nobody sane walks up to, and a library nobody can replace, and it stands well below every current apex - which is what a former apex living on what it still owns looks like from outside.',
        whyTheGapIs:
            'The longest fall on the table, and a fall is a statement about a pipeline rather than about a fight. Not one of the things that made it an apex is what thinned. What went is the ability to make more of them: the vein it draws on is one it can no longer reach the bottom of, and the object its position rested on is not in the room. So it collects instead of recruiting and treats a refusal as a scheduling matter, which is not a weakened house doing something disgraceful. It is a house doing arithmetic.',
        whatTheUnlitNodesWere:
            'Forty-eight dark nodes on a mountain fragment that used to be part of a mountain. The lit twenty-three are all on the stone itself; the dark ones are laid out to a plan that assumes the peak it broke off is still attached, which it has not been for longer than the Court has existed. The tether is inspected annually, cannot be repaired, and predates the Court - so the Court is maintaining the one part of the arrangement that was never its work and cannot maintain the parts that were.',
        whereTheWrongBeliefComesFrom:
            'It teaches that the tether is the ancestor\'s work and therefore permanent, which is the only doctrine available to a body whose entire seat hangs from it: a tether that can fail is a fact nobody can act on, so it became a fact nobody states. The tether predates the Court, was failing before Yan Kuo concealed it, and has an inspection record the Court reads as ceremonial - a record kept annually, correctly, by people who have been told what it means and believe them.',
        sharedEvents: [
            'event-the-promotion-past-the-kiln',
            'event-one-letter-for-both',
            'event-the-two-raids',
            'event-the-storeroom-read-from-a-list'
        ]
    },
    // ── the Quiet Marches ─────────────────────────────────────────────
    'sect-weir-office': {
        factionId: 'sect-weir-office',
        origin:
            'Not a sect and not a tenant: a bureau of eleven with a counter, a register and a stamp, administering both workable faces of a province on somebody else\'s behalf. Its famous discretion extends exactly as far as the schedule it is given, and every carver in the region has organised their entire life around the stamp without once asking whose it is.',
        whyTheGapIs:
            'The whole region\'s pipeline is three people at Standing Cut and one Keystone in two hundred years, and the Office has started prospecting, which is not a thing bureaus do. Two survey parties have gone past the Dead Verge in four years and one did not come back, none of it entered in the grant book. A third face would be the first new ground in the Marches since the catastrophe. It ends if Gapwater runs out first, and the Office is the only party that has measured how close that is.',
        whatTheUnlitNodesWere:
            'The weir works above Kettle were built by whoever cut the seven surviving nodes into the stone rather than laying them on the ground, which is why those seven still run and the other nineteen do not. The Under-Warden retains a duty at the weir gates that has had no function since the water was diverted, and the diversion is older than the Office - so the bureau is administering the remains of a working it inherited without a description.',
        whereTheWrongBeliefComesFrom:
            'It teaches that carving reaches ranks ambient drawing cannot, and it prices grants on the difference, and every carver in the Marches will tell you the same thing because the work genuinely is harder. Harder is not higher. The Ledger has certified band for band that it is one ladder, and the Office has never submitted its own table - which is not concealment so much as a bureau correctly identifying that a finding it did not ask for cannot help it.',
        sharedEvents: ['event-the-band-for-band-certification', 'event-the-roads-and-the-grants']
    },
    'sect-sixmile-wardens': {
        factionId: 'sect-sixmile-wardens',
        origin:
            'A shed, nine hundred painted stakes and a survey, all of it their own work, and the only complete map of safe ground in the Quiet Marches. They hold nothing from anybody and never have, and the burn edge does not care whose name is on a grant. They perform the single most useful public service in the region and are paid in paint.',
        whyTheGapIs:
            'The lowest production in the catalog, and the reason is the absence of a grant rather than any failing of theirs. No grant means no vein, no vein means no pipeline, and on unaided Marches ground a Warden stops at Chipping and stays there. The single exception in their history was the founder, which is what a house looks like when its ceiling is set by geology and its people are not the constraint.',
        whatTheUnlitNodesWere: null,
        whereTheWrongBeliefComesFrom:
            'They believe the original survey is accurate because it has never been wrong, and in the only sense they can test it never has: nobody has died following it. It has also never been checked. The burn edge has moved nine hundred paces since it was drawn and the stakes have been moved to match, by hand, one at a time, by people correcting the map to the ground and entering nothing - so the survey is now a record of nine hundred undocumented corrections that reads exactly like an accurate original.',
        sharedEvents: ['event-the-roads-and-the-grants']
    },
    'sect-gleaners-company': {
        factionId: 'sect-gleaners-company',
        origin:
            'A salvage contract on burn zones, renewed annually, and a barrow yard at Hollowmarket laid out inside somebody else\'s building. Under direct rule there are no client sects, so the Company is not a subsidiary - it is a supplier with a renewable contract, and the difference is invisible until the year it is not renewed and there is nobody to appeal to.',
        whyTheGapIs:
            'It loses about one in nine a season and its one Keystone left for the Low Fall within a year, and it is rising anyway, on ground it is not supposed to be on. The Factors have worked two live burn edges without a rotation entry and paid the shares out of the general fund. Live ground yields grades the nine-year cycle never turns up, and on that material a gleaner reaches Foundation Establishment instead of stopping at Chipping. What ends it is one season where the losses outrun the fund.',
        whatTheUnlitNodesWere:
            'All fourteen are at the front of a ruin the Company has never fully entered, and the three that are lit are the three within reach of the entrance. The yard is laid out inside somebody else\'s building for the same reason: the Company works the edges of things it does not own and has never had a season spare to go further in, which is a fact about salvage economics and not about courage.',
        whereTheWrongBeliefComesFrom:
            'Bo Ai\'s founding note says the nine-year rotation exists to let the previous crew\'s survivors die off before the next pass. The Company reads it as metaphor and holds that the rotation lets a site recover - and reading it as metaphor is not stupidity, it is what you do with a sentence that would otherwise mean your founder scheduled around your own losses. The same substitution has happened independently to the Bone Lantern Cult, which neither body knows.',
        sharedEvents: ['event-the-undercut-border']
    },
    // ── the dao houses ────────────────────────────────────────────────
    'house-ninefold-ledger': {
        factionId: 'house-ninefold-ledger',
        origin:
            'A book hall and a circuit of arbitration benches in forty-one towns, and an account of the Tally Court that the Ledger wrote and everybody has believed since. Its founding volumes for a five-hundred-year stretch are missing and were probably destroyed internally, which the house records and does not explain.',
        whyTheGapIs:
            'Steady and unspectacular, and the house regards a spectacular member as a governance risk. An arbitration body whose strongest person is conspicuously strong stops being trusted to arbitrate, so the Ledger has never invested in a pipeline and has three of forty-one circuit benches unstaffed for a century rather than fill them quickly. The gap is a governance decision that has been taken continuously for four hundred years.',
        whatTheUnlitNodesWere:
            'The book hall is older than the Ledger and the eighteen dark nodes are under the stacks rather than under the benches, which is the wrong way round for an arbitration house and the right way round for whatever kept records there before. The missing founding volumes cover the period the house would need in order to say which.',
        whereTheWrongBeliefComesFrom:
            'It believes its method can read a thread through a grave, which follows directly from the method working on every other kind of severed connection - and it has never once worked. The house keeps a register of the attempts and files it under research rather than failure, which is the trace: a body that files two centuries of negative results as ongoing work has not concealed anything and has not learned anything either.',
        sharedEvents: ['event-two-hundred-years-of-edges', 'event-the-band-for-band-certification']
    },
    'house-narrow-hour': {
        factionId: 'house-narrow-hour',
        origin:
            'A sighting hall on a bare hill with no walls, and standing chairs beside four thrones. The house has been advising rulers for as long as there have been rulers to advise and has never held anything, which is the arrangement it wanted and the source of everything it resents.',
        whyTheGapIs:
            'Declining, on the simplest possible mechanism: eleven advisers and no replacement faster than they die. Its production has tracked its retainer count downward for three centuries, and a house whose entire product is a person sitting beside a throne cannot make more of them faster than thrones ask for them.',
        whatTheUnlitNodesWere: null,
        whereTheWrongBeliefComesFrom:
            'It holds that sightings cast on itself are worthless because it stands outside its own convergence, which is a real technical claim and would be a good one. The likelier reading is that the house has never accepted a sighting it disliked, and the record of discarded self-sightings is available and has been for centuries. Nobody outside has read it, because reading it requires believing the house is worth auditing.',
        sharedEvents: []
    },
    'house-bound-word': {
        factionId: 'house-bound-word',
        origin:
            'Oath halls at every border crossing of consequence and the treaty vault at Sweptground, holding a vault of treaties binding on people who have never read them. Oathwright training takes forty years and the house will not shorten it, which is the founding decision and has never been reopened.',
        whyTheGapIs:
            'Slow by design and getting slower. Forty years of training, intake falling for three generations, and a refusal to shorten the training that the house treats as the product rather than as a cost. Nothing was lost and nothing is being waited on: the pipeline is exactly as long as the house has always insisted it must be, applied to fewer people each generation.',
        whatTheUnlitNodesWere:
            'The oath halls are at border crossings and the crossings have moved. Eleven dark nodes are at halls the house still staffs on routes that no longer carry traffic, maintained because closing an oath hall is an act the house has no procedure for - there is no form for unbinding a place, and the house has never been willing to invent one.',
        whereTheWrongBeliefComesFrom:
            'It teaches that an oath binds the person and that ground is ceremony, which is the doctrine the whole practice rests on and which no oathwright has ever had a reason to doubt. The Anchorhold\'s figures show no oath sworn on unsurveyed ground has ever held. The house has not tested it, and is entirely clear internally about why: testing it would cost the fee on every crossing hall it maintains on ground it has never surveyed.',
        sharedEvents: ['event-the-founding-oath-and-the-severed']
    },
    'house-quiet-cut': {
        factionId: 'house-quiet-cut',
        origin:
            'No seat anybody has proved, four portable nodes of its own making, and nineteen centuries of severance sold as a service. It holds everything in its own name by holding almost nothing at all, and it depends on a set of Tally Court fragments it cannot reproduce and which are visibly wearing out.',
        whyTheGapIs:
            'Deliberately opaque even internally. The house cuts its own records as doctrine, so it cannot audit its own pipeline, and it has repeatedly recut work it had already been paid for - which is the same discipline producing the gap and hiding the size of it. Nothing was lost and nothing is being waited on; the house simply cannot see itself, and has decided that is the correct trade.',
        whatTheUnlitNodesWere: null,
        whereTheWrongBeliefComesFrom:
            'It believes a clean cut leaves nothing, which is the product, the price and nineteen centuries of unbroken practice, and no client has ever come back to say otherwise - because a client who could tell would be a client the cut did not work on. Every cut leaves an edge. The Ledger has two hundred years of them and has never published, so the one body in the world that could correct the house has a standing interest in not doing so.',
        sharedEvents: ['event-two-hundred-years-of-edges']
    },
    'house-held-names': {
        factionId: 'house-held-names',
        origin:
            'Register houses at nine city gates and a stack room none of the nine can access, holding the register of absences: it cannot say what was removed, but it can say when, and that has been enough to ruin four clients. It owns a great deal of property it has never mentioned owning.',
        whyTheGapIs:
            'Administrators rather than cultivators - two combat cultivators in seven hundred years, and a pipeline that has never been the point. Nothing here declined. A house whose product is a register does not need people who can fight, and the distance to its strongest is the distance between an institution and one unusual person inside it.',
        whatTheUnlitNodesWere:
            'Thirteen dark across nine gates, and the House can account for none of them because it did not build any of the nine. It acquired register houses at city gates because that is where registers are kept, and every one of the nine came with somebody else\'s working attached - which is also why the stack rooms flood and why restoration is partial for a reason the House has never established.',
        whereTheWrongBeliefComesFrom:
            'It holds that a name in the register is safe from a crossing, and below Deity Transformation it has always been true, which is where nearly every name it holds sits. Above that it has never once recovered one. The House files those cases as incomplete rather than failed, which is the trace and is not a lie: a case with no recovery and no explanation genuinely is incomplete, and a filing convention has been doing the work of a finding for seven hundred years.',
        sharedEvents: ['event-the-stack-room-leases']
    },
    'house-measured-span': {
        factionId: 'house-measured-span',
        origin:
            'Nine gate stations, no two within a month\'s walk and all of them an hour apart, and a discipline practised while travelling. Twenty-two of its thirty-one terminals are closed and unreopenable, and its eastern survey is four hundred years out of date because the ground moved.',
        whyTheGapIs:
            'The most productive house in the catalog, because its discipline is practised while travelling and its members do not stop to hold territory. The distance to its strongest is not decline in any sense - it is the ordinary spread of a house whose method works, applied to a body that has lost most of its network and none of its practice.',
        whatTheUnlitNodesWere:
            'They are terminals, and twenty-nine of fifty-eight is what a gate network looks like after two thirds of it closes. The swept gate frame with no gate in it is the clearest single artifact in the province of what happened: the house maintains the frames it cannot reopen, sweeps them, and has never written down why - and the eastern survey being four centuries stale is the same loss measured a different way.',
        whereTheWrongBeliefComesFrom:
            'It teaches that the Unlit Gate House destroyed itself by overreach, which is the account that survived and is the account a successor body would naturally hold. Forty-one names appear on both houses\' founding rolls and both seats burned in the same season, and the official account does not mention either fact. Neither was suppressed. The rolls are in the house\'s own archive and the account was written by somebody who had not read them.',
        sharedEvents: ['event-the-two-seats-that-burned']
    },
    'house-anchorhold': {
        factionId: 'house-anchorhold',
        origin:
            'The fixed survey: eleven containment perimeters, four scars and the standard weights, held by a house that took the work over from the Girdle and has been doing it correctly ever since. Standing a perimeter watch for a year is both the admission requirement and the cultivation method, which is why the house is steady and why it has never had to choose between the two.',
        whyTheGapIs:
            'Steady, because the method and the duty are the same activity. There is no supply problem and no lost access: a house whose people cultivate by doing the job produces at exactly the rate the job is being done, and it has been done at that rate for centuries. Two of eleven perimeters are maintained below the house\'s own published standard, which is the only figure here that is moving.',
        whatTheUnlitNodesWere:
            'Twenty-six dark on eleven perimeters, and the Anchorhold is the one house in the catalog that can say what most of them were: they are Girdle work, they are on the perimeter line, and the Anchorhold has never been able to light them because the eastern nail sits in a socket cut for a larger nail than the house owns. It has both facts in its archive and has published neither.',
        whereTheWrongBeliefComesFrom:
            'It teaches that the Girdle\'s containment failed, which is the founding justification for the Anchorhold existing at all and is what every perimeter family was told. Its own archive holds two facts that do not fit: its nail sits in the wrong-sized socket, and the province died four days after the breach rather than before. The house has not concealed them and has not reconciled them, and the Girdle descendants at the perimeter treat it as usurpers, and are right, and cannot be told so.',
        sharedEvents: ['event-the-two-seats-that-burned']
    }
};

// ─────────────────────────────────────────────────────────────────────────
// ACCESSORS
// ─────────────────────────────────────────────────────────────────────────

const EVENTS_BY_ID = new Map(SHARED_EVENTS.map(e => [e.id, e]));

/** One faction's history, or undefined where none has been written. */
export function historyOf(factionId: string): FactionHistory | undefined {
    return FACTION_HISTORY[factionId];
}

/** A shared event by id. */
export function sharedEvent(id: string): SharedEvent | undefined {
    return EVENTS_BY_ID.get(id);
}

/**
 * Every shared event a faction is a party to, oldest first.
 *
 * Read off `parties` rather than off the faction's own `sharedEvents` list, so
 * a faction that forgot to list one still gets it. The two are asserted to
 * agree by the catalog test, which is what makes reading either one safe.
 */
export function sharedEventsFor(factionId: string): readonly SharedEvent[] {
    return SHARED_EVENTS
        .filter(e => e.parties.includes(factionId))
        .slice()
        .sort((a, b) => b.yearsAgo - a.yearsAgo);
}

/** The other parties to an event, from one party's point of view. */
export function otherPartiesTo(event: SharedEvent, factionId: string): string[] {
    return event.parties.filter(p => p !== factionId);
}
