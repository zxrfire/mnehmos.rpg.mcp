/**
 * Faction character - the retroactive distinctness pass.
 *
 * An alignment, a rank ladder and a rivalry list produce factions that are
 * technically populated and completely interchangeable. This file is the fix,
 * applied to every faction in the catalog including the three in the Quiet
 * Marches. Each entry carries:
 *
 *   practice          what an outsider sees in the first ten minutes
 *   grievance         what they believe was taken from them
 *   fear              what they are quietly afraid of
 *   lateness          which fraction of their inheritance still works
 *   disagreement      the internal split, because a faction that agrees with
 *                     itself is scenery
 *   wrongAbout        something held with total confidence that is false, and
 *                     traceable
 *   unitOfValue       what they actually count, which changes every
 *                     negotiation they enter
 *   production        what they can reliably turn out, versus what they once
 *                     could - see below
 *   distinctSentence  the faction test, written down: one sentence that could
 *                     not be said about anything else in the catalog. The
 *                     catalog test asserts these are unique.
 *
 * PRODUCTION IS THE REAL PRESTIGE METRIC
 * --------------------------------------
 * `powerOrdinal` on the sect entry says who its strongest member is.
 * `production` says what it can reliably turn out, and the two answer
 * different questions:
 *
 *   - Production decays with the vein. A sect that loses its ground keeps its
 *     old strong members for a century and loses its pipeline in a generation.
 *   - It separates the two kinds of decline. One ancient elder and no pipeline
 *     reads nothing like no elder and a strong pipeline, and `powerOrdinal`
 *     cannot tell them apart.
 *   - It explains recruitment. A sect that can no longer produce Core
 *     Formation has to buy one, and that is a motive.
 *
 * The gap between `powerOrdinal` and `production.reliableOrdinal` is therefore
 * characterful on its own: a sect whose strongest member stands four realms
 * above anything it can still produce is living on inheritance, and the data
 * should say so without anyone writing it in prose.
 */

/**
 * What a faction can turn out, as opposed to what it happens to contain.
 * All ordinals are on the one shared ladder.
 */
export interface ProductionTier {
    /** Highest ordinal it can currently produce reliably, from its own intake. */
    reliableOrdinal: number;
    /** Roughly how many members it currently has at or above that. */
    currentCount: number;
    /** Highest ordinal it has ever produced, across its whole history. */
    peakOrdinal: number;
    /** How many it produced at that peak, ever. Usually one or two. */
    peakCount: number;
    /** Years since it last produced anyone at the peak ordinal. */
    yearsSinceLastPeak: number;
    note: string;
}

export interface FactionCharacter {
    practice: string;
    grievance: string;
    fear: string;
    lateness: string;
    disagreement: string;
    wrongAbout: string;
    unitOfValue: string;
    production: ProductionTier;
    distinctSentence: string;
}

export const FACTION_CHARACTER: Record<string, FactionCharacter> = {
    // ═══════════════════════════════════════════════════════════════════
    // LOW FALL - RIGHTEOUS
    // ═══════════════════════════════════════════════════════════════════
    'sect-azure-cloud-pavilion': {
        practice: 'Disciples stand when a sword is drawn anywhere in earshot, including in a kitchen, and their right forearms are visibly heavier than their left from flying on the blade.',
        grievance: 'That the province treats its deference as owed to a dead woman rather than earned by the Pavilion, and repeats the joke about renting her.',
        fear: 'That the Standing Edge is a finite object, and that the year it is spent is the year the Pavilion becomes an ordinary sect with an unusually good gorge.',
        lateness: 'Nine of forty-one nodes lit; the practice yard cut for six hundred holds ninety; and the sequence of Ru Anjing\'s divestment is recorded in a hand three Sword Elders can no longer fully read.',
        disagreement: 'The Sword Elders want the Edge drawn once in this generation to re-establish what it means. The Pavilion Master holds that its meaning is entirely a function of not drawing it.',
        wrongAbout: 'It teaches that Ru Anjing\'s two words were an instruction to wait for a specific event. The offering record shows the words were answered to a question about a border dispute nobody now remembers asking.',
        unitOfValue: 'Deference. The Pavilion keeps no ledger of favours and an exact mental account of who stood up.',
        production: {
            reliableOrdinal: 17, currentCount: 6, peakOrdinal: 44, peakCount: 2, yearsSinceLastPeak: 380,
            note: 'Reliably turns out Core Formation and has not produced above Nascent Soul in three centuries. Its standing is entirely inherited and the gap is visible in the data.'
        },
        distinctSentence: 'The only institution in the world holding a parting gift from the last confirmed crossing, and it has refused itself permission to draw it nine times.'
    },
    'sect-verdant-spring-hall': {
        practice: 'Physicians keep their fingernails cut to the quick and their sleeves pinned back at all times, and will treat an enemy on the floor of a fight before asking who started it.',
        grievance: 'That it was a hermitage of nine people once, holding its valley by respect and nothing else, and chose to grow - and that the Standing Grove, which refused the same choice, is spoken of the way the Hall used to be.',
        fear: 'That the Bone Lantern Cult is right that the dead are a resource, and that the Hall\'s objection is sentiment rather than medicine.',
        lateness: 'Fourteen of twenty-two nodes lit; the stone irrigation channels are original and get patched with clay; and the rank of Life Elder retains a ceremonial duty at the springs that nobody can explain.',
        disagreement: 'The billing faction wants enemies treated and charged at triple. The physicians want them treated and charged the same, on the argument that a price is a diagnosis of who you think somebody is.',
        wrongAbout: 'The Hall teaches that Lu Wan wrote the restoration method. The valley ruin it came out of predates Lu Wan by six hundred years and the Hall\'s own founding record says "recovered".',
        unitOfValue: 'Unpaid bills. The Hall\'s real ledger is who owes it for treatment, and it never writes one off.',
        production: {
            reliableOrdinal: 20, currentCount: 4, peakOrdinal: 26, peakCount: 3, yearsSinceLastPeak: 120,
            note: 'A healthy pipeline on ordinary ground: it reliably produces Core Formation Perfection and produced Deity Transformation as recently as four generations ago.'
        },
        distinctSentence: 'The only sect that treats its enemies on the floor where they fell and then bills them, and has outlived four sects that thought this was weakness.'
    },
    'sect-nine-peaks-ascetic-order': {
        practice: 'Ascetics carry a stone at all times, of a size chosen at admission and never changed, and set it down only to sleep - so a conversation with one includes the sound of a rock being placed on a table.',
        grievance: 'That every other institution in the province regards their vein as an accident of geography rather than a two-century refusal to lease it.',
        fear: 'That Meng Da is still alive somewhere in the workings, and that the Order has spent eight hundred years not sealing the entrance because it does not want to find out.',
        lateness: 'Eleven of sixty-three nodes lit, and the Order admits it does not know what forty of the others were for - it maintains them anyway, unlit, on the reasoning that somebody meant them.',
        disagreement: 'The Peak Wardens want the workings surveyed and Meng Da resolved. The Mountain Elders hold that the workings are the vein and the vein is not to be entered, which is doctrine dressed as caution.',
        wrongAbout: 'It holds that carrying the stone builds the body. Its own intake records show the stone selects for people who will do a pointless thing for years, which is a different and more useful filter.',
        unitOfValue: 'Years of service. Rank, grain and vein access are all counted in seasons carried, and stones are treated as an administrative nuisance.',
        production: {
            reliableOrdinal: 21, currentCount: 5, peakOrdinal: 28, peakCount: 4, yearsSinceLastPeak: 90,
            note: 'The best pipeline in the province, because the vein under it is the deepest anyone has kept. Production tracks the vein exactly, which is the world model in one row.'
        },
        distinctSentence: 'Sits on the richest vein in the province and has refused for two centuries to lease a foot of it, while maintaining forty formation nodes it cannot light and will not remove.'
    },
    'sect-clear-river-alliance': {
        practice: 'Members are recognisable by the tar on their palms from boat rope, and greet each other by naming a ford - "Third, this spring" - rather than by name.',
        grievance: 'That the Thousand Treasure Pavilion prices tolls on routes the Alliance keeps open, and calls this commerce.',
        fear: 'That the ferry trade is what the Alliance is, and that a Measured Span station at Scarwater would end it in a decade.',
        lateness: 'Five of eight nodes lit, all of them on piers; half the river charts are copies of a survey two ages old and more accurate than anything the Alliance has produced since.',
        disagreement: 'The Ford Masters want to federate the Marches border road and become a regional carrier. The River Elders hold that the Alliance is river people and will drown on land.',
        wrongAbout: 'It believes its pier pilings at Scarwater are Alliance work from three centuries back. They are two ages older than the Alliance and are the reason that ford has never moved.',
        unitOfValue: 'Crossings owed. A debt here is discharged by carrying somebody, and the Alliance will accept nothing else from its own.',
        production: {
            reliableOrdinal: 13, currentCount: 9, peakOrdinal: 24, peakCount: 1, yearsSinceLastPeak: 300,
            note: 'Wide and shallow: a great many at Foundation Establishment, no vein, and exactly one Nascent Soul cultivator in its history, three hundred years ago.'
        },
        distinctSentence: 'A federation of ferrymen who learned to fight, who settle internal debts in river crossings rather than stones, and whose oldest asset is a pier they did not build.'
    },
    'sect-sweptground-temple': {
        practice: 'Monks eat standing, from a single bowl, and will not accept a gift of ground - four separate sects have tried to endow them and all four endowments were returned intact.',
        grievance: 'None stated, which the province finds unnerving; pressed, the Abbot says the Temple was given the thing it needed two and a half thousand years ago and has no further claim on anybody.',
        fear: 'That the First Abbot\'s crossing is not true, and that four centuries of poor people have been told a comfortable thing.',
        lateness: 'Six nodes, all lit, all cut by the Temple itself, and all weak - it is the only complete working formation in the province and it is a beginner\'s diagram.',
        disagreement: 'The younger monks want the claim submitted to the Ninefold Ledger for certification. The Abbot refuses on the grounds that a certified ancestor would change who applies at the gate.',
        wrongAbout: 'It teaches that the First Abbot gave everything away to people rather than the Temple as a lesson about attachment. The likelier reading of the founding record is that the Temple did not exist yet.',
        unitOfValue: 'Nothing. The Temple keeps no accounts at all, which makes it impossible to negotiate with and is the single most frequent complaint against it.',
        production: {
            reliableOrdinal: 13, currentCount: 11, peakOrdinal: 45, peakCount: 1, yearsSinceLastPeak: 2_600,
            note: 'The starkest gap in the catalog: it produced the one crossing in its records and now reliably turns out Foundation Establishment on swept ground, from intake nobody else would accept.'
        },
        distinctSentence: 'The poorest institution in the province, sitting on ground it chose for having no vein, holding a true claim to an ancestor that nobody believes and that buys it nothing.'
    },
    'sect-lantern-hall': {
        practice: 'Keepers carry a wax tablet and write during conversations without asking, and they will read a cultivator their own crossing ledger unprompted, which is why they are rarely invited twice.',
        grievance: 'That the world calls what the crossings take "the price" and considers the matter closed.',
        fear: 'That the counter-register is a comfort rather than a remedy, and that writing a name down does not in fact keep it.',
        lateness: 'Seventeen of thirty nodes lit; roughly one register in forty from the third age is illegible from damp, and the stack rooms flood on a schedule the Hall has never fixed.',
        disagreement: 'The Keepers of Names want the registers opened to anyone. The Warden-General holds that an open register is an inventory for the House of Held Names and the Quiet Cut alike.',
        wrongAbout: 'The Hall holds that its counter-register is independent of the House of Held Names. Nine of its nine city stack rooms were originally House buildings, and the House still holds the leases.',
        unitOfValue: 'Names on a wall. The Hall measures its own worth by how many it has recorded, and states the figure the way other sects state their vein depth.',
        production: {
            reliableOrdinal: 21, currentCount: 3, peakOrdinal: 31, peakCount: 2, yearsSinceLastPeak: 210,
            note: 'Produces steadily but slowly, because archivists cultivate on the margins of the working day and the Hall considers that the correct trade.'
        },
        distinctSentence: 'Writes down what the crossings take from other people, publishes it against their wishes, and is correct in a way that has made it unwelcome in nine cities.'
    },

    'sect-standing-grove': {
        practice: 'They answer questions and do not ask them. A disciple of the Grove meeting a stranger on the road gives their own name first, waits, and accepts whatever is offered back without comment, including a lie.',
        grievance: 'None they will state, which visitors find unnerving; the Grove holds that a grievance is a claim, and it makes no claims.',
        fear: 'A small test at the edge that is deniable enough to be awkward to answer and public enough that not answering ends the zone. It has been forty-one years and everybody in the hermitage can feel the clock.',
        lateness: 'Four nodes, all lit, all their own work, and a boundary wall that has never been tested - the Grove is the only institution in the province whose inheritance is nothing at all, which is why it has nothing it cannot operate.',
        disagreement: 'Two of the six want a seventh disciple taken this decade. The Keeper holds that a seventh means a roster, a roster means administration, and administration means becoming a different kind of thing.',
        wrongAbout: 'It believes its deference zone runs eleven days out because that is where the last test happened. Two granted sects have quietly moved leases inward on the northern side in the last twenty years and the Grove has not noticed, because nobody has told it and it does not patrol.',
        unitOfValue: 'Occasions answered. The Grove counts its standing in the number of times it has been tested and responded, which is two, and both are known by name across the province.',
        production: {
            reliableOrdinal: 21, currentCount: 6, peakOrdinal: 27, peakCount: 2, yearsSinceLastPeak: 60,
            note: 'Six disciples, all of them known individually across the province, and a pipeline that is deliberately not one - the Grove has taken nobody in forty-one years.'
        },
        distinctSentence: 'Holds a region eleven days across with six people, no patrols and no lease, on nothing but a belief about what would happen, which was last checked forty-one years ago.'
    },
    // ═══════════════════════════════════════════════════════════════════
    // LOW FALL - NEUTRAL
    // ═══════════════════════════════════════════════════════════════════
    'sect-stonewright-consortium': {
        practice: 'Factors weigh everything, visibly, including food and correspondence, and will not agree to a figure without putting it on a balance first - a Consortium negotiation begins with somebody unpacking scales.',
        grievance: 'That every institution in the province depends on its rate and every one of them describes the Consortium as parasitic while doing so.',
        fear: 'That the presses are irreplaceable. It repairs them constantly, has never built a new one, and does not publish how many are still working.',
        lateness: 'Thirty-four of fifty-five nodes lit, and its refining presses are inherited machinery of a design its own artificers cannot reproduce at any price.',
        disagreement: 'The Rate-Setters want to publish a vein index and make the price of ground explicit. The Principal holds that an explicit price for a vein is a starting gun.',
        wrongAbout: 'It believes it sets the stone rate. In four recorded shortages the rate was set by what the Thousand Treasure Pavilion would pay, and the Consortium published that figure a week later as its own.',
        unitOfValue: 'Spirit stones, cut and assayed, to the tenth. It is the only faction that treats its own unit as the natural one and cannot really conceive of another.',
        production: {
            reliableOrdinal: 20, currentCount: 12, peakOrdinal: 33, peakCount: 3, yearsSinceLastPeak: 150,
            note: 'Buys production rather than growing it: about half its Core Formation members were recruited mid-career off other sects, which is a policy and not an accident.'
        },
        distinctSentence: 'Sets the price of a vein, a pill and a life in the same ledger, and maintains presses of a design it has never once managed to rebuild.'
    },
    'sect-thousand-treasure-pavilion': {
        practice: 'Appraisers wear gloves indoors and take them off only to touch merchandise, so an outsider can tell exactly when a Pavilion member has started valuing them.',
        grievance: 'That the Consortium sets the rate it must sell at, and that saying so aloud would cost it the Consortium\'s underwriting.',
        fear: 'A Ledger audit of the tablet hall. The Pavilion has priced that risk internally and the figure is kept by three people.',
        lateness: 'Twelve of nineteen nodes lit; an auction floor built for four hundred with the back nine rows rented out for storage; and a tablet hall bought complete, of which no one on the staff can read the older third.',
        disagreement: 'The Council Seats want the ancestral claim quietly retired before somebody proves it. The Grand Steward holds that retiring it is a confession and that the only safe direction is forward.',
        wrongAbout: 'Its staff genuinely believe the Wei Zhaoyin lineage - the fraud is three generations old and the people repeating it are not the people who committed it.',
        unitOfValue: 'Commission, in stones, on somebody else\'s transaction. The Pavilion is the only faction whose unit is a fraction of another faction\'s unit.',
        production: {
            reliableOrdinal: 17, currentCount: 7, peakOrdinal: 27, peakCount: 1, yearsSinceLastPeak: 90,
            note: 'Produces little and hires much. Its prestige rests on a claimed ancestor precisely because its pipeline cannot supply one.'
        },
        distinctSentence: 'Bought its ancestors at an estate sale the Ninefold Ledger brokered, and is now the Ledger\'s largest client for exactly that reason.'
    },
    'sect-cinnabar-crucible-guild': {
        practice: 'Alchemists keep one hand permanently bandaged, by rule rather than injury, so that a burn to the working hand never costs a batch; guild members shake with the left.',
        grievance: 'That the Thousand Treasure Pavilion prices medicine the Guild makes and takes the margin on it.',
        fear: 'That the missing steps in the wall script are not missing but deliberately omitted, and that the batches which fail are failing for a reason somebody understood.',
        lateness: 'Fifteen of twenty-seven nodes lit, and the refining hall wall it was founded on is legible to about a third - the Guild has built a four-hundred-year reputation on that third.',
        disagreement: 'The Cauldron Masters want to sell heaven-grade attempts at cost with the failure rate disclosed. The Furnace Elders regard disclosure as an admission that the Guild does not know its own method.',
        wrongAbout: 'It teaches that the fourth line of the wall script is a step. Furnace Elder Bo died proving it is not, and the Guild recorded the death and kept teaching the line.',
        unitOfValue: 'Successful batches. Standing inside the Guild is a count of refinements that held, and no amount of money moves it.',
        production: {
            reliableOrdinal: 17, currentCount: 5, peakOrdinal: 25, peakCount: 2, yearsSinceLastPeak: 260,
            note: 'Steady but capped: alchemists spend their cultivation years at a furnace, and the Guild treats a Core Formation grandmaster as a full career.'
        },
        distinctSentence: 'Built a monopoly on the third of a wall it can read, and still teaches a step that killed the man who proved it was not one.'
    },
    'sect-ashen-forge-clan': {
        practice: 'Everyone in the compound, including children and the clan chief, feeds the furnace on a rota; refusing a turn is how a person leaves the clan, and it has happened twice.',
        grievance: 'That the Azure Cloud Pavilion accepted its swords for two hundred years and now accepts its deference to somebody else.',
        fear: 'That the furnace will go out. Nobody knows the starting method, so it has not been allowed to cool in eleven generations and the rota is a religion with a duty roster.',
        lateness: 'Seven of twelve nodes lit; the great furnace is inherited and cannot be relit; and the clan reforges ploughed-up fragments because it cannot make steel of that quality itself.',
        disagreement: 'The younger smiths want to arm the Nine Abyss Flame Sect, which pays four times. The Cinder Elders will not sell to a caldera on principle and are losing the argument annually.',
        wrongAbout: 'The clan holds that the furnace is theirs by right of the First Hammer building the compound around it. The compound is later than the furnace by an age and the furnace has an inscription the clan reads as decoration.',
        unitOfValue: 'Turns at the furnace. Obligation inside the clan is counted in rota shifts, and outsiders find that a shift cannot be bought at any price.',
        production: {
            reliableOrdinal: 16, currentCount: 8, peakOrdinal: 23, peakCount: 2, yearsSinceLastPeak: 170,
            note: 'A blood clan, so intake is births rather than applicants: production is capped by the family and everybody in it knows the number.'
        },
        distinctSentence: 'A clan whose entire religion is a duty rota for a fire they inherited, cannot relight, and have not let go out in eleven generations.'
    },
    'sect-hollow-bell-wanderers': {
        practice: 'Members hang a small bell at any crossroads they pass and never at one they intend to return to, so the bells map where the Wanderers have been and never where they are.',
        grievance: 'That every sect in the province refused them first, and that several now recruit from them.',
        fear: 'That the league is a waiting room - that everyone good enough leaves, which is the arithmetic and nobody says it.',
        lateness: 'It owns no ground and inherits nothing, which it presents as philosophy; the honest version is that being late requires having been early.',
        disagreement: 'The Road Elders want a fixed seat and a vein. The Bell Keeper holds that the day the league owns ground is the day it starts refusing people.',
        wrongAbout: 'It believes the bell practice is two centuries old and originally a signal. The oldest bells are forty years old and the practice was started by one person as a joke about being unwelcome.',
        unitOfValue: 'Favours owed between individuals, tracked by nobody centrally, and defaulted on constantly.',
        production: {
            reliableOrdinal: 8, currentCount: 14, peakOrdinal: 20, peakCount: 1, yearsSinceLastPeak: 60,
            note: 'The lowest reliable production in the Low Fall, because anyone who reaches Foundation Establishment is recruited away within a year and the league does not stop them.'
        },
        distinctSentence: 'A league whose members mark where they have been rather than where they are, and which loses every promising member to the sects that refused them first.'
    },
    'sect-frostmirror-court': {
        practice: 'Nobody sweeps. The floors of the cold hall are left exactly as they are on doctrine, and a visitor who tidies is not corrected but is not admitted again.',
        grievance: 'That the Storm Tyrant Court has raided them twice and the province regards the Frostmirror as the curiosity in that relationship.',
        fear: 'That the ice curriculum is finite - it was dug out, not written, and there is no more glacier to dig.',
        lateness: 'Twenty-six of forty-four nodes lit; and the curriculum above Rime Disciple is recovered inscription with gaps the Court fills by inference and does not tell disciples it is filling.',
        disagreement: 'The Rime Disciples want to admit clean-root cultivators under supervision. The Court Sovereign has calculated that this kills about four in five and refuses.',
        wrongAbout: 'The Court holds that the Mirror lies under the hall by choice. The hall was built over her afterwards, and the Court\'s own founding inscription is ambiguous in a way it does not teach.',
        unitOfValue: 'Cold. Standing is measured in how long a member can hold the hall\'s temperature without shelter, and the figure is posted.',
        production: {
            reliableOrdinal: 20, currentCount: 3, peakOrdinal: 35, peakCount: 2, yearsSinceLastPeak: 400,
            note: 'Constrained by intake rather than ground: it only admits mutated ice roots, so it produces very few and each one very far.'
        },
        distinctSentence: 'Refuses every applicant in the world except the one root in a hundred that its curriculum will not kill, and leaves its own floors unswept as doctrine.'
    },
    'sect-kiln-wardens': {
        practice: 'Wardens speak to outsiders in numbers only - distances, dates, quantities - and turn applicants around at the gate once, politely, with a figure for how far the nearest inn is.',
        grievance: 'None expressed in nine hundred years of outside records, which is itself the most remarked-upon fact about them.',
        fear: 'Unknown, and the absence is what alarms the other powers: an institution with nothing to lose and everything lit is not a shape anyone can price.',
        lateness: 'They are the one faction that is not late: nine hundred nodes held, nine hundred lit, which nobody else in the world can say and nobody can explain.',
        disagreement: 'Outsiders have recorded exactly one: two Wardens at the gate disagreeing, in numbers, about whether a visitor should be given water. He was.',
        wrongAbout: 'The world is wrong about them rather than the reverse: every outside account assumes they draw on the root vein, and the Anchorhold\'s survey figures show they take nothing from it at all.',
        unitOfValue: 'Nothing tradeable. They neither buy nor sell, accept no fees, and have never been recorded making an exchange of any kind.',
        production: {
            reliableOrdinal: 29, currentCount: 0, peakOrdinal: 36, peakCount: 0, yearsSinceLastPeak: 0,
            note: 'Unknown from outside and estimated by the Anchorhold from what walks the perimeter. Current count is recorded as zero because nobody has ever counted them.'
        },
        distinctSentence: 'Sits on the richest ground in the world drawing nothing from it, lights every node it holds, and has never in nine hundred years been recorded making an exchange.'
    },
    'sect-hollow-court': {
        practice: 'The four seated do not stand. A visitor is answered honestly, at length, without anybody getting up, and the answer usually concerns something the visitor did not ask about.',
        grievance: 'That the world calls them cowards for declining the crossing, when what they declined was paying for it.',
        fear: 'Nothing left to be afraid of, which is precisely the condition, and is why they are useless in a crisis.',
        lateness: 'Forty-one of two hundred nodes lit, and no interest in the other hundred and fifty-nine; the seating is arranged for an audience of two hundred and holds four.',
        disagreement: 'The Second Seat holds that the Court should answer questions freely. The First Seat holds that a free answer from something like them is a form of interference, and they have not resolved it in six hundred years.',
        wrongAbout: 'They believe they are inert. Three regional wars have been settled by parties travelling to ask them a question and going home with the answer, which is not inertness by any measure but their own.',
        unitOfValue: 'Nothing at all. They cannot be paid, and the only currency that moves them is a question worth answering.',
        production: {
            reliableOrdinal: 0, currentCount: 0, peakOrdinal: 40, peakCount: 4, yearsSinceLastPeak: 900,
            note: 'Produces nobody, by construction: it takes no disciples, so its production tier is zero while its power ordinal is forty. The extreme case of the two metrics disagreeing.'
        },
        distinctSentence: 'Four people who reached the top of the ladder, declined to pay for the last step, and have not stood up since - and cannot be paid in anything but a good question.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // LOW FALL - DEMONIC
    // ═══════════════════════════════════════════════════════════════════
    'sect-the-severed': {
        practice: 'Members introduce themselves by what they have already cut - "two bonds, a name" - before giving anything you could call a name, and the ledger is shown to applicants before anything else.',
        grievance: 'That Lantern Hall calls them thieves of themselves while charging nothing to write down what the crossings steal from everyone else.',
        fear: 'That the doctrine works and produces something that cannot be argued with afterwards, including about whether it was worth it.',
        lateness: 'Three nodes, all theirs, all portable, and a founding ledger entry whose identifying columns cut themselves - the house cannot establish who founded it.',
        disagreement: 'The Ninth Cut faction hold that cutting should be voluntary and gradual. The Nameless hold that a gradual cut is a bond you are still paying interest on.',
        wrongAbout: 'They hold that the cut is theirs to choose. The Quiet Cut, who do it professionally, note that a self-severance takes what is reachable rather than what was chosen, and the Severed do not accept the finding.',
        unitOfValue: 'Cuts made, recorded in the house ledger. A member\'s standing is the length of their own entry.',
        production: {
            reliableOrdinal: 24, currentCount: 6, peakOrdinal: 38, peakCount: 1, yearsSinceLastPeak: 600,
            note: 'The fastest pipeline in the catalog by a distance, because pre-paying the price makes crossings survivable - and the fastest attrition, because most of them stop being people first.'
        },
        distinctSentence: 'The only faction that shows applicants an itemised list of what its members have already amputated from themselves, and considers it a recruitment document.'
    },
    'sect-crimson-abyss-hall': {
        practice: 'Recruiters wait outside other sects\' admission days with a table and a cash box, and pay the first month in advance to anyone who was refused inside.',
        grievance: 'That the righteous sects create its intake by refusing people and then condemn the Hall for taking them.',
        fear: 'That the tithe has to come from somewhere, and that the Hall\'s own membership is the only supply that has never run short.',
        lateness: 'Six of sixteen nodes lit; a drain in the lower hall floor cut for a purpose the Hall has adopted without ever establishing; and a tithe rate the First Abyss Lord set that nobody has dared revise.',
        disagreement: 'The Left Envoy wants the Hall to stop recruiting refusals and start recruiting talent. The Abyss Lord holds that talent leaves and the desperate stay.',
        wrongAbout: 'It believes the tithe rate is generous because it has never been raised. Measured against five centuries of Consortium rates, holding it flat has more than tripled it in real terms.',
        unitOfValue: 'Spirit stones, paid weekly and in advance, which is the entire pitch and the reason it works.',
        production: {
            reliableOrdinal: 16, currentCount: 11, peakOrdinal: 29, peakCount: 2, yearsSinceLastPeak: 40,
            note: 'High intake, high mortality, and a genuinely functional pipeline to Foundation Establishment - the Hall produces more Foundation cultivators annually than any righteous sect in the province.'
        },
        distinctSentence: 'Sets up a table with a cash box outside other sects\' admission days and pays the first month in advance to everyone they turned away.'
    },
    'sect-bone-lantern-cult': {
        practice: 'Members work in silence at a site and talk continuously away from one, and every one of them can date a battlefield to the season by what is flowering on it.',
        grievance: 'That the Verdant Spring Hall hunts them for handling the dead while buying its crimson marrow fungus from a supply chain with exactly one source.',
        fear: 'The Crimson Abyss Hall, which hunts them over supply rather than principle and is much better funded.',
        lateness: 'Two of nine nodes lit; a field wall built of fragments sorted by weight rather than by what they were; and a rotation established a hundred and forty years ago that nobody now can justify from first principles.',
        disagreement: 'The Pale Elders want to work only battlefields older than the rotation. The Lantern Bearers want to follow live wars, which pays four times and is how the Cult loses people.',
        wrongAbout: 'It holds that its rotation exists to let sites recover. The founding note says it exists to let survivors die off, and the Cult has forgotten the difference.',
        unitOfValue: 'Sites worked, in rotation order. Seniority is a place in the queue and cannot be bought, only waited for.',
        production: {
            reliableOrdinal: 13, currentCount: 6, peakOrdinal: 26, peakCount: 1, yearsSinceLastPeak: 700,
            note: 'Produces at Foundation Establishment and has managed Deity Transformation exactly once, seven hundred years ago, which is the Pale Ancestor and the whole of its prestige.'
        },
        distinctSentence: 'Follows wars at a respectful distance on a hundred-and-forty-year rotation, and can date a battlefield to the season by which flowers are on it.'
    },
    'sect-nine-abyss-flame-sect': {
        practice: 'Elders are visibly not human any more in one specific way each - a hand, an eye, a voice - and the sect neither hides this nor comments on it, and applicants are shown the contract in full.',
        grievance: 'That the Sweptground Temple takes in the people the contract ruins and calls the sect a predator, while turning nobody away itself.',
        fear: 'That the Kindler wakes for a reason nobody chose, and that the caldera is the collateral.',
        lateness: 'Nineteen of thirty-eight nodes lit in an alternating ring, because the sect could read every other line of the diagram and lit exactly what it understood.',
        disagreement: 'The Flame Hall Masters want the vent seal opened and the Kindler consulted. The Flame Sovereign has never permitted an inspection and has not explained why.',
        wrongAbout: 'It teaches that the transformation contract is a bargain with a knowable counterparty. Its own recovered text names no counterparty and the sect supplies one by tradition.',
        unitOfValue: 'Contract terms - what a member has agreed to owe and when it comes due. Money is treated as a rounding detail inside that.',
        production: {
            reliableOrdinal: 25, currentCount: 7, peakOrdinal: 34, peakCount: 3, yearsSinceLastPeak: 110,
            note: 'The strongest live pipeline in the province, because the contract works: it reliably produces Deity Transformation and the cost is paid later and by the individual.'
        },
        distinctSentence: 'Hands every applicant the full text of a transformation contract whose counterparty its own scripture does not name, and lights nineteen nodes in an alternating ring because it can read every other line.'
    },
    'sect-storm-tyrant-court': {
        practice: 'Court members do not sit down indoors during a storm and are audibly uncomfortable in still air; a Storm Servant meeting an outsider will check the sky first, every time.',
        grievance: 'That the world thinks the tether is a trophy when it is a maintenance liability the Court cannot repair and cannot abandon.',
        fear: 'A Ledger certification of its vault inventory, which would establish that the Standing Storm Rod is gone.',
        lateness: 'Twenty-three of seventy-one nodes lit; the tether holding a mountain fragment aloft is inspected annually and cannot be repaired; and the vault is now described rather than opened at successions.',
        disagreement: 'The Thunder Wardens want the rod\'s loss admitted and the curriculum rebuilt around what remains. The Storm Tyrant holds that the claim is the Court\'s only remaining asset.',
        wrongAbout: 'It teaches that the tether is the ancestor\'s work and therefore permanent. The tether predates the Court, was failing before Yan Kuo concealed it, and has an inspection record the Court reads as ceremonial.',
        unitOfValue: 'Collections. Standing is measured in cultivators the Court has taken and kept, and refusal is treated as a scheduling matter rather than an answer.',
        production: {
            reliableOrdinal: 21, currentCount: 4, peakOrdinal: 44, peakCount: 1, yearsSinceLastPeak: 3_400,
            note: 'The mid-curve case in one row: it produced a crossing three and a half thousand years ago, holds a true claim, has lost the gift, and now reliably produces Nascent Soul at best.'
        },
        distinctSentence: 'Holds the world\'s only lightning curriculum on a mountain fragment hanging from a chain it cannot repair, and describes its vault at successions rather than opening it.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // LOW FALL - DAO HOUSES
    // ═══════════════════════════════════════════════════════════════════
    'house-ninefold-ledger': {
        practice: 'Auditors write in front of you and read the entry back before leaving, and they will not accept hospitality of any kind - a Ledger auditor pays for their own tea, in a region where that is close to an insult.',
        grievance: 'That the Tally Court is remembered as corrupt on the strength of an account the Ledger wrote.',
        fear: 'The nine sealed volumes. Three factions inside the house want them opened and the Keeper has never given a reason for refusing.',
        lateness: 'Thirty-one of forty-nine nodes lit; three of forty-one circuit benches unstaffed for a century; and the founding volumes for years 400 to 900 are missing and were probably destroyed internally.',
        disagreement: 'The Circuit wants arbitration extended into criminal judgement. The Book holds that the Ledger records and never rules, and both sides quote the same founding text.',
        wrongAbout: 'It believes its method can read a thread through a grave. It has never once worked, the house keeps a register of the attempts, and the register is filed under research rather than failure.',
        unitOfValue: 'Obligations outstanding. The Ledger prices everything as a debt with a term, including friendship, which is why its arbitration is trusted and its dinners are not enjoyed.',
        production: {
            reliableOrdinal: 21, currentCount: 8, peakOrdinal: 32, peakCount: 4, yearsSinceLastPeak: 400,
            note: 'Steady and unspectacular, and the house regards a spectacular member as a governance risk.'
        },
        distinctSentence: 'Can name the debt your great-grandmother incurred, will not accept a cup of tea while telling you, and destroyed the house it grew out of and wrote the account of why.'
    },
    'house-narrow-hour': {
        practice: 'Readers sit facing away from whoever is speaking to them, on the doctrine that a face is a possibility already collapsing, and the hall has no walls.',
        grievance: 'That its advisers are treated as furniture by the thrones they keep, and consulted last in the crises they predicted.',
        fear: 'The year of the scar, and Cao Yin\'s sealed account, which does not match what happened and which the house has never explained.',
        lateness: 'Twelve of twelve nodes lit - and all twelve are observational, so the hall cannot be defended and the house has never fixed this.',
        disagreement: 'The Open Hall wants warnings published free and the retainers ended. The Standing Chairs hold that a free warning is ignored, and the retainer is what makes rulers act.',
        wrongAbout: 'It holds that sightings cast on itself are worthless because it stands outside its own convergence. The likelier reading is that the house has never accepted a sighting it disliked, and the record of discarded self-sightings is available.',
        unitOfValue: 'Retainers held. Standing is the number of thrones and sects currently paying to keep a reader in the room, and it has fallen from nineteen to eleven.',
        production: {
            reliableOrdinal: 20, currentCount: 5, peakOrdinal: 30, peakCount: 3, yearsSinceLastPeak: 300,
            note: 'Declining: eleven advisers and no replacement faster than they die, so its production has tracked its retainer count downward for three centuries.'
        },
        distinctSentence: 'Advises four thrones from a hall with no walls, sits facing away from whoever is talking, and cannot say which of its own two contradictory records of the scar year is true.'
    },
    'house-bound-word': {
        practice: 'Oathwrights never say "I promise" in casual speech, will not answer a yes-or-no question without qualifying it, and a witness signs their own name last, after every party, always.',
        grievance: 'That a founding oath forbids them witnessing for the Severed, and is costing them a fortune they can see and cannot touch.',
        fear: 'The unpublished treaty of nine hundred years ago in its own vault, which permitted two traditions to work one vein simultaneously and is the likeliest explanation for the Quiet Marches.',
        lateness: 'Twenty-five of thirty-six nodes lit; a vault of treaties binding on people who have never read them; and a dissolution method for oaths whose parties are all dead that has never worked and is still taught.',
        disagreement: 'The Warden faction want the house to enforce as well as witness. The Strict Hall holds that a witness who enforces is a party, and a party cannot witness.',
        wrongAbout: 'It teaches that an oath binds the person and that ground is ceremony. The Anchorhold\'s figures show no oath sworn on unsurveyed ground has ever held, and the house has not tested it because testing it would cost it the fee.',
        unitOfValue: 'Terms outstanding - the number of live oaths in the vault. It measures itself in obligations it is holding for other people.',
        production: {
            reliableOrdinal: 21, currentCount: 6, peakOrdinal: 31, peakCount: 2, yearsSinceLastPeak: 500,
            note: 'Slow by design: oathwright training takes forty years, intake has fallen for three generations, and the house will not shorten the training.'
        },
        distinctSentence: 'Cannot say "I promise" in conversation, signs every document last, and is forbidden by its own founding oath from witnessing for the one faction that would pay most.'
    },
    'house-quiet-cut': {
        practice: 'No member gives a name, a face is never seen twice on the same commission, and work is taken and delivered exclusively through third parties who are paid not to remember.',
        grievance: 'That every institution which publicly wants them destroyed has privately used them, and that the Severed get called philosophers for doing it badly to themselves.',
        fear: 'The register of absences. The House of Held Names cannot say what was removed, but it can say when, and that has been enough to ruin four clients.',
        lateness: 'Four portable nodes, all of their own making, and a set of Tally Court fragments they depend on, cannot reproduce, and are visibly wearing out.',
        disagreement: 'The Trade takes any commission that pays. The Doctrine holds that severance is mercy and should be given away, and a third group has started cutting without clients at all.',
        wrongAbout: 'It believes a clean cut leaves nothing. Every cut leaves an edge, the Ledger has been reading edges for two hundred years, and the house prices its work as though this were still a secret.',
        unitOfValue: 'Connections removed, priced by age and load. It is the only faction whose unit of value is a subtraction.',
        production: {
            reliableOrdinal: 24, currentCount: 5, peakOrdinal: 33, peakCount: 2, yearsSinceLastPeak: 200,
            note: 'Deliberately opaque even internally: the house cuts its own records, so it repeatedly recuts work it has already done and cannot audit its own pipeline.'
        },
        distinctSentence: 'Sells the permanent removal of a relationship, cuts its own records as doctrine, and consequently keeps redoing work it has already been paid for.'
    },
    'house-held-names': {
        practice: 'Holders recite the names they carry every morning, aloud, in order, and a holder who stumbles is relieved of that name the same day and never told which one it was.',
        grievance: 'That Lantern Hall gives away for nothing what the House charges for, and is applauded for it while doing worse work.',
        fear: 'Erasure at the source. Four times the House has been left holding an entry for somebody nobody remembers, and it does not know how many more it is holding.',
        lateness: 'Twenty of thirty-three nodes lit; the stack rooms flood, so roughly one register in forty from the third age is illegible; and restoration is partial for a reason the House has never established.',
        disagreement: 'The Gate wants registration extended to every settlement. The Stack wants the House to hold names and sell nothing, and a third group has begun quietly using the names it holds.',
        wrongAbout: 'It holds that a name in the register is safe from a crossing. Above Deity Transformation it has never once recovered one, and the House files those cases as incomplete rather than failed.',
        unitOfValue: 'Names held. Twenty thousand of them, and the House states the figure the way a sect states a vein depth.',
        production: {
            reliableOrdinal: 17, currentCount: 4, peakOrdinal: 29, peakCount: 1, yearsSinceLastPeak: 800,
            note: 'Administrators rather than cultivators: two combat cultivators in seven hundred years, and a pipeline that has never been the point.'
        },
        distinctSentence: 'Recites twenty thousand names every morning and relieves any holder who stumbles of a name without telling them which one they dropped.'
    },
    'house-measured-span': {
        practice: 'Surveyors pace distances compulsively, including indoors, and will interrupt a negotiation to write down a figure; a Span member gives directions in two numbers, walked and true.',
        grievance: 'That the Anchorhold nails ground shut and calls it public safety, and that the world agrees with them.',
        fear: 'That the closed terminals are closed from the other side, and that Fu Zhen is still on it.',
        lateness: 'Twenty-nine of fifty-eight nodes lit; twenty-two of thirty-one gate terminals closed and unreopenable; a swept gate frame with no gate in it; and an eastern survey four hundred years out of date because the ground moved.',
        disagreement: 'The Long Measure wants the closed gates reopened whatever it costs. The Freight faction wants the house to stop being ancient and start being solvent.',
        wrongAbout: 'It teaches that the Unlit Gate House destroyed itself by overreach. Forty-one names appear on both houses\' founding rolls and both seats burned in the same season, which the official account does not mention.',
        unitOfValue: 'True distance. Everything the house prices, including its own labour, is quoted per li of true rather than walked distance, which nobody else can verify.',
        production: {
            reliableOrdinal: 25, currentCount: 9, peakOrdinal: 34, peakCount: 5, yearsSinceLastPeak: 260,
            note: 'The most productive house in the catalog, because its discipline is practised while travelling and its members do not stop to hold territory.'
        },
        distinctSentence: 'Quotes every price in a distance only it can measure, and keeps a gateless frame swept at a station where it has been failing to reopen the same span for six hundred years.'
    },
    'house-anchorhold': {
        practice: 'Wardens stand rather than sit through meetings, on the doctrine that a thing that has settled is doing its job; and they will not be moved from a spot they have taken, which makes them exhausting guests.',
        grievance: 'That the Girdle descendants at the perimeter treat the house as usurpers, and are right, and cannot be told so.',
        fear: 'Two perimeters lost in one season - the condition that wakes Xu Ci, published in the survey standard as a schedule.',
        lateness: 'Sixty-two of eighty-eight nodes lit; two of eleven perimeters maintained below the house\'s own published standard; and the eastern nail sits in a socket cut for a larger Girdle nail that the house does not explain.',
        disagreement: 'The Perimeter wants containment extended to every scar. The Datum holds that the survey is the only real duty, and a faction is pressing to break a nail to see what is under it.',
        wrongAbout: 'It teaches that the Girdle\'s containment failed. Its own nail sits in the wrong-sized socket, the province died four days after the breach rather than before, and the house has both facts in its archive.',
        unitOfValue: 'Perimeter-seasons: how many containments held, for how long, and at whose cost. Money is a means of buying those and nothing else.',
        production: {
            reliableOrdinal: 25, currentCount: 7, peakOrdinal: 35, peakCount: 3, yearsSinceLastPeak: 340,
            note: 'Steady, because standing a perimeter watch for a year is both the admission requirement and the cultivation method.'
        },
        distinctSentence: 'Publishes the exact circumstance under which it will wake the ancestor entombed under its own datum stone, as a line item in the regional survey standard.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // THE QUIET MARCHES
    // ═══════════════════════════════════════════════════════════════════
    'sect-weir-office': {
        practice: 'Everything is a form. Office members carry the grant book\'s current page on their person, will read your entry aloud at you in the street, and never touch a chisel - the Office cultivates by holding faces, not working them.',
        grievance: 'That the region calls it a parasite while queuing at its door, and that the Low Fall calls its Keystone a Core Formation as if the two roads were the same walk.',
        fear: 'That the Gapwater face is finite. The Office has surveyed how much workable stone is left and has never published the figure.',
        lateness: 'Seven of twenty-six nodes lit, and the seven are cut into the stone rather than laid on the ground, which is why they still run at all; the rank of Under-Warden retains a duty at the weir gates that has had no function since the water was diverted.',
        disagreement: 'The Under-Wardens want grants issued by lot to end the queue politics. The Weir Master holds that discretion is the Office\'s only asset and that a lottery would make it a landlord.',
        wrongAbout: 'It teaches that carving reaches ranks that ambient drawing cannot, and prices grants on it. The Ledger has certified band for band that the ladder is the same one, and the Office has never submitted its own table for certification.',
        unitOfValue: 'Days of face time. Every debt, wage, fine and favour in the region is denominated in grant days, and stones are simply how days are bought.',
        production: {
            reliableOrdinal: 13, currentCount: 3, peakOrdinal: 20, peakCount: 1, yearsSinceLastPeak: 60,
            note: 'The whole region\'s pipeline, and it is three people at Standing Cut. One Keystone in two hundred years, sixty years ago, and he is the current Weir Master.'
        },
        distinctSentence: 'Rents the only two workable stone faces in a province by the day, prices them by a rank table it has never dared submit for certification, and none of its members have ever held a chisel.'
    },
    'sect-sixmile-wardens': {
        practice: 'Wardens carry paint and a brush at all times and stop mid-conversation to repaint a stake; they greet strangers by pointing at the nearest marker rather than speaking.',
        grievance: 'That the Weir Office charges for grants and contributes nothing to the roads its grantees walk in on.',
        fear: 'That the burn edge is accelerating. Three Wardens have said so; the survey shed has the figures; nobody has recalculated them because nobody wants the answer.',
        lateness: 'Nothing inherited at all, which in the Marches is unusual: a shed, nine hundred stakes and a survey, all of it their own work, and the survey is the only complete map of safe ground in the region.',
        disagreement: 'The Road Wardens want to charge a toll and fund replacement paint. The Warden of the Six Mile holds that a paid road is a road people leave to avoid paying for.',
        wrongAbout: 'They believe the original survey is accurate because it has never been wrong. It has never been checked - the burn edge has moved nine hundred paces since it was drawn and the stakes have been moved to match by hand.',
        unitOfValue: 'Stakes standing. The Wardens count their own strength, their dead and their year in painted markers, and will trade labour for paint before stones.',
        production: {
            reliableOrdinal: 5, currentCount: 12, peakOrdinal: 14, peakCount: 1, yearsSinceLastPeak: 190,
            note: 'The lowest production in the catalog: on unaided Marches ground a Warden stops at Chipping, and the single Standing Cut in their history was the founder.'
        },
        distinctSentence: 'A militia that measures its dead in painted stakes, greets strangers by pointing at the nearest one, and owns the only complete map of where it is safe to walk.'
    },
    'sect-gleaners-company': {
        practice: 'Gleaners rinse their mouths with vinegar on a fixed schedule and spit before speaking, and they will not enter a sealed door in the first hour of a shift on the grounds that nobody is careful yet.',
        grievance: 'That the Bone Lantern Cult undercuts them across a border neither region polices, using finds the Company located.',
        fear: 'The sealed part of their own sorting yard. Xun went in on a wager thirty years ago and the Company sealed it again and raised the wager, and nobody has taken it.',
        lateness: 'Three of fourteen nodes lit, all at the front of a ruin they have never fully entered; the yard is laid out inside somebody else\'s building; and the rotation they follow was justified by a note whose reasoning they have lost.',
        disagreement: 'The Company Factors want to work live burn edges, which pays triple. The Company Master holds the nine-year rotation, and the argument reopens every time a face runs out.',
        wrongAbout: 'They hold that the nine-year rotation lets a site recover. Bo Ai\'s founding note says it exists to let the previous crew\'s survivors die off before the next pass, and the Company reads the note as metaphor.',
        unitOfValue: 'Shares in a find, allocated before the shift and honoured after a death - a dead gleaner\'s share goes to their family, and the Company has never once defaulted on that.',
        production: {
            reliableOrdinal: 8, currentCount: 9, peakOrdinal: 17, peakCount: 1, yearsSinceLastPeak: 40,
            note: 'Loses about one in nine a season, so it produces almost nobody: the one Keystone in its history left for the Low Fall within a year of reaching it.'
        },
        distinctSentence: 'Pays a dead digger\'s share to their family without exception, will not open a sealed door in the first hour of a shift, and works a rotation whose stated purpose it has misremembered as mercy.'
    }
};

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS

// -------------------------------------------------------------------------
// HIGH-REALM PROVENANCE
// Survivors of a richer age, stated as a matter of record rather than law.
//
// The great ages are behind this world. Veins have been drawn down, nobody has
// ascended in living memory, and every competent institution in both provinces
// takes it as settled that the top of the ladder is closed in this age.
//
// That belief is almost right, and "almost" is the whole of the interest. It
// is a claim about the record - about how long it has been, and about who is
// no longer alive to explain how it was done - and not a claim about what the
// world permits. A faction standing this high is evidence of when the climb
// last happened, not proof that it cannot happen again, and nothing in this
// file may assert otherwise. If a player ever manages it, none of these
// records should turn out to have been lying; they should turn out to have
// been describing a very long silence.
//
// So each record carries two separate things, in the same shape the knowledge
// layer already uses: `whyNobodyHasSince` is what actually happened, and
// `settledBelief` is what everyone competent has concluded from it. The gap
// between them is deliberate.
//
// THRESHOLDS: `HIGH_REALM_THRESHOLD` below is an AUTHORING rule - above this
// ordinal a faction owes an account of itself - and is deliberately not a
// statement about reachability. Content does not restate engine measurements:
// if the engine grows an exported constant for the present-day reachability
// rate, this file should import it rather than keep a second number that can
// disagree.
// -------------------------------------------------------------------------

/** Above this ordinal a faction owes an account of which age it climbed in. */
export const HIGH_REALM_THRESHOLD = 32;

export interface HighRealmProvenance {
    /** The ordinal in question, matching the faction's powerOrdinal. */
    highestOrdinal: number;
    /** Years since that person made the climb. Always long ago. */
    climbedYearsAgo: number;
    /** The ground it was done on, which is usually gone or diminished. */
    climbedWhere: string;
    /** Which age, in the faction's own terms. */
    ageNote: string;
    /**
     * The record: how long it has been, what has happened since, and what the
     * present-day symptoms are. Facts about history, never about physical law.
     */
    whyNobodyHasSince: string;
    /**
     * What everyone competent has concluded, which is almost right and is
     * stated as a belief rather than as a finding.
     */
    settledBelief: string;
}

/**
 * Factions above the threshold whose records are being revised elsewhere and
 * are deliberately not written here. Kept explicit so the gap is visible
 * rather than silent, and so the catalog test can hold the line for
 * everything else.
 */
export const PROVENANCE_PENDING: ReadonlySet<string> = new Set([
    'sect-hollow-court',
    'sect-kiln-wardens'
]);

export const HIGH_REALM_PROVENANCE: Record<string, HighRealmProvenance> = {
    'sect-azure-cloud-pavilion': {
        highestOrdinal: 41,
        climbedYearsAgo: 380,
        climbedWhere:
            'The gorge vein beneath the Pavilion itself, worked continuously by one person for the better part of two centuries while the sect around her was an ordinary Third Sill tenant paying an ordinary tribute.',
        ageNote:
            'Late Age throughout, which is the part nobody can explain away. Ru Anjing did not climb in a richer era; she climbed in this one, on a vein a court had already assessed and priced, and every faction that insists the road is closed has to hold her at arms length to keep saying it.',
        whyNobodyHasSince:
            'The Pavilion has produced exactly one more at the last realm in three hundred and eighty years and produced them slowly. It teaches what she left, and what she left is a record of a divestment rather than a method, so the sect is in the position of having the outcome and not the working.',
        settledBelief:
            'The province holds that the Pavilion knows something. The Pavilion has never said otherwise, has never said what, and has been living off the difference for three centuries.'
    },
    'sect-stonewright-consortium': {
        highestOrdinal: 33,
        climbedYearsAgo: 210,
        climbedWhere: 'The Weiring vein in a province two borders east, which the Consortium assayed, worked and published the closing figure on eighty years ago.',
        ageNote: 'Late enough to be recorded properly and early enough to still be ordinary: the Consortium can name the year, the vein and the surveyor, which is more than most factions at this height can do.',
        whyNobodyHasSince: 'The vein that carried him is closed, by an assay the Consortium published itself, and nothing on its books has carried a climb like that since. It buys its high-realm members now rather than growing them, which is a policy and not an accident.',
        settledBelief: 'Every Rate-Setter in the house will tell you the ground for it no longer exists. They are describing their own ledger accurately and treating that as a description of the world, which is the house error in one sentence.'
    },
    'house-quiet-cut': {
        highestOrdinal: 33,
        climbedYearsAgo: 240,
        climbedWhere: 'A province since drawn down to nothing, worked quietly while the house had no name and no clients worth recording.',
        ageNote: 'The generation before the drawdown, when a cutter could take the years the road needs without buying the ground to take them on.',
        whyNobodyHasSince: 'No Last Cut in two hundred years. Severance never depended on ambient qi, but the decades it takes do, and the house cuts its own records rather than keep a count of how long it has been.',
        settledBelief: 'The Trade holds it settled that the road tops out where it now tops out. The Doctrine faction does not, and this is one of the several things the two of them no longer discuss.'
    },
    'house-measured-span': {
        highestOrdinal: 34,
        climbedYearsAgo: 260,
        climbedWhere: 'The terminal network, across nine more open gates than the house now holds, cultivating in transit the way surveyors do.',
        ageNote: 'The last age in which the road itself was rich: the span between two working terminals carried qi the walked distance never did.',
        whyNobodyHasSince: 'Twenty-two of thirty-one terminals are closed and the house cannot reopen one, so most of the road that made a Keeper is simply not there. Its Elder Surveyors stall in the mid-twenties on the routes that remain.',
        settledBelief: 'The Freight faction takes it as established that a Keeper is a thing the house used to make. The Long Measure keeps insisting otherwise and is regarded, affectionately, as unserious.'
    },
    'sect-nine-abyss-flame-sect': {
        highestOrdinal: 34,
        climbedYearsAgo: 110,
        climbedWhere: 'The vent vein under the caldera, when it still ran hot enough that a Flame Hall Master could work it without a grant day.',
        ageNote: 'Within living memory, barely, which is why the sect believes the road is still open and behaves accordingly.',
        whyNobodyHasSince: 'The vent has thinned measurably and the last three sovereign-track candidates stalled at Deity Transformation. The sect blames the transformation contract rather than the caldera; its own tribute records show the yield falling in step.',
        settledBelief: 'Alone among the high factions, this one has not concluded that the road is shut - which reads as either the only clear sight in either province or the contract talking, and nobody outside the caldera can tell which.'
    },
    'sect-frostmirror-court': {
        highestOrdinal: 35,
        climbedYearsAgo: 400,
        climbedWhere: 'The cold vein under the glacier, forty spans deeper into the ice than the working face now reaches.',
        ageNote: 'Four centuries back, when the ice ran deep enough that the curriculum could be practised at the depth it was written for.',
        whyNobodyHasSince: 'The glacier has retreated and the cold vein with it. Every Court Sovereign since has stopped at Core Formation Perfection, and the Court has quietly stopped teaching the deepest three inscriptions because nobody has reached the state they describe in four hundred years.',
        settledBelief: 'The Court teaches that those inscriptions describe something no longer available. It says "no longer available" rather than anything stronger, which is the most carefully worded position any faction in the catalog holds on the subject, and it is not an accident.'
    },
    'house-anchorhold': {
        highestOrdinal: 35,
        climbedYearsAgo: 340,
        climbedWhere: 'The eastern perimeter, when the scar behind it was still active enough that standing a watch on it was cultivation rather than administration.',
        ageNote: 'The generation after the Girdle, when the house was holding a live containment rather than maintaining a quiet one.',
        whyNobodyHasSince: 'The scar has gone quiet, which is the entire purpose of the house and also why its own people no longer advance on the watch. Two perimeters run below the standard the house publishes, and the Datum faction argues it is now a survey office with a legend attached.',
        settledBelief: 'Taken as settled inside the house that a Standing Anchor was something the live containment produced and that the containment has finished producing. The published wake schedule for Xu Ci is, read closely, an admission that nobody expects to replace her.'
    },
    'sect-storm-tyrant-court': {
        highestOrdinal: 36,
        climbedYearsAgo: 300,
        climbedWhere: 'The floating stone, while the tether still drew and the vein under it could be reached at the bottom.',
        ageNote: 'Three centuries back, before Yan Kuo concealed that the tether was failing - the last window in which the road of the Court ran the whole way up.',
        whyNobodyHasSince: 'Nobody anywhere is recorded as having made this climb in three hundred years. Locally it is worse: no Storm Elder has passed Nascent Soul in a century, and the Court has stopped opening the vault at successions rather than explain why.',
        settledBelief: 'It is taken as settled across both provinces that this height is shut, and the Court is the loudest voice saying so - which is convenient, since it is also the faction that would otherwise be asked how it still has one.'
    },
    'sect-the-severed': {
        highestOrdinal: 38,
        climbedYearsAgo: 180,
        climbedWhere: 'Six cities and no ground at all, on the fastest road anyone has ever found and at the price the road charges.',
        ageNote: 'The last generation for whom paying in advance was enough, and the house has never established whether what changed was the ground or the people.',
        whyNobodyHasSince: 'Nobody on the road has passed Void Refinement Late in a hundred and eighty years, and the house presents this as patience. The last person who could have described how that climb was actually made is dead, and the house cuts its own records, so there is no account left to read.',
        settledBelief: 'Every competent party in either province takes it as settled that the top of the ladder is closed in this age. The Severed decline to correct the belief, on the reasoning that a road nobody believes in is a road nobody competes for, and their own Nameless have stopped saying either way.'
    }
};

export function getHighRealmProvenance(factionId: string): HighRealmProvenance | undefined {
    return HIGH_REALM_PROVENANCE[factionId];
}

/**
 * Factions whose strength is a fact about a previous age rather than this one.
 * Takes its threshold as an argument rather than restating an engine number:
 * pass the engine constant here once one exists.
 */
export function survivorsOfARicherAge(aboveOrdinal: number = HIGH_REALM_THRESHOLD): {
    factionId: string;
    provenance: HighRealmProvenance;
}[] {
    return Object.entries(HIGH_REALM_PROVENANCE)
        .filter(([, p]) => p.highestOrdinal > aboveOrdinal)
        .map(([factionId, provenance]) => ({ factionId, provenance }));
}

// ─────────────────────────────────────────────────────────────────────────

export function getFactionCharacter(factionId: string): FactionCharacter | undefined {
    return FACTION_CHARACTER[factionId];
}

export function getProductionTier(factionId: string): ProductionTier | undefined {
    return FACTION_CHARACTER[factionId]?.production;
}

/**
 * How far a faction's strongest member stands above anything it can still
 * produce. A large gap is a faction living on inheritance, and the number is
 * the clearest single read on which kind of decline it is in.
 */
export function inheritanceGap(factionId: string, powerOrdinal: number): number {
    const tier = FACTION_CHARACTER[factionId]?.production;
    return tier ? powerOrdinal - tier.reliableOrdinal : 0;
}

/** Factions that can no longer produce what they once did, worst first. */
export function decliningFactions(): { factionId: string; lost: number; yearsSinceLastPeak: number }[] {
    return Object.entries(FACTION_CHARACTER)
        .map(([factionId, c]) => ({
            factionId,
            lost: c.production.peakOrdinal - c.production.reliableOrdinal,
            yearsSinceLastPeak: c.production.yearsSinceLastPeak
        }))
        .filter(row => row.lost > 0)
        .sort((a, b) => b.lost - a.lost);
}
