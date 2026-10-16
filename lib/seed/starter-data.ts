/**
 * Original fictional content for the official starter universe. All names,
 * biographies and promotion identities are invented for this game.
 *
 * Attribute order: in_ring, technical, power, speed, stamina, charisma,
 * mic_skills, selling, psychology, reliability, big_match.
 */
import type { Alignment, CardPosition, Division, Gender, WrestlerRole } from "@/lib/domain/enums";

export interface StarterWrestler {
  key: string;
  ring_name: string;
  real_name: string;
  gender: Gender;
  division: Division;
  billed_from: string;
  height_cm: number;
  weight_kg: number;
  birth_date: string;
  debut_date: string;
  alignment: Alignment;
  role: WrestlerRole;
  card_position: CardPosition;
  finisher: string;
  attrs: [number, number, number, number, number, number, number, number, number, number, number];
  popularity: number;
  promotion: "ipw" | "prw";
  salary: number;
  biography: string;
}

export const STARTER_PROMOTIONS = {
  ipw: {
    name: "Ironside Pro Wrestling",
    abbreviation: "IPW",
    tagline: "Forged in the Foundry.",
    description:
      "A hard-hitting mainstream promotion headquartered in the industrial city of Brennick. Ironside built its name on blue-collar heroes, loud crowds and a weekly show that never takes a night off.",
    region: "Great Lakes",
    audience_profile: "mainstream" as const,
    primary_color: "#c2410c",
    secondary_color: "#1c1917",
    reputation: 62,
    popularity: 58,
    controlled_by: "player" as const,
    founded_on: "2009-03-14",
  },
  prw: {
    name: "Pacific Rift Wrestling",
    abbreviation: "PRW",
    tagline: "Where the ring shakes.",
    description:
      "A workrate-focused promotion from the coastal city of Port Calder. Rift fans come for long, athletic matches and a locker room full of hungry young talent.",
    region: "West Coast",
    audience_profile: "workrate" as const,
    primary_color: "#0e7490",
    secondary_color: "#0f172a",
    reputation: 55,
    popularity: 47,
    controlled_by: "ai" as const,
    founded_on: "2014-08-02",
  },
};

export const STARTER_VENUES = [
  { key: "foundry", name: "The Foundry Arena", city: "Brennick", region: "Great Lakes", capacity: 6500, rental_cost: 18000, prestige: 62 },
  { key: "union", name: "Union Hall", city: "Marlow Falls", region: "Great Lakes", capacity: 1400, rental_cost: 3500, prestige: 40 },
  { key: "meridian", name: "Grand Meridian Dome", city: "Brennick", region: "Great Lakes", capacity: 19000, rental_cost: 85000, prestige: 88 },
  { key: "harbor", name: "Harbor Pavilion", city: "Port Calder", region: "West Coast", capacity: 3800, rental_cost: 9000, prestige: 55 },
];

export const STARTER_WRESTLERS: StarterWrestler[] = [
  // --- Ironside Pro Wrestling -------------------------------------------------
  { key: "vane", ring_name: "Marcus Vane", real_name: "Marcus Vanetti", gender: "male", division: "mens", billed_from: "Brennick", height_cm: 191, weight_kg: 109, birth_date: "1991-05-02", debut_date: "2011-06-10", alignment: "face", role: "wrestler", card_position: "main_event", finisher: "Vane Breaker",
    attrs: [86, 78, 80, 66, 84, 85, 78, 82, 86, 88, 90], popularity: 84, promotion: "ipw", salary: 6500,
    biography: "Ironside's homegrown franchise player. A former steelworker who trained in the back of the Foundry, Vane carries the promotion on his shoulders and the World title around his waist." },
  { key: "crowe", ring_name: "Silas Crowe", real_name: "Silas Crowell", gender: "male", division: "mens", billed_from: "The Black Marsh", height_cm: 188, weight_kg: 102, birth_date: "1989-10-19", debut_date: "2008-02-22", alignment: "heel", role: "wrestler", card_position: "main_event", finisher: "Murder of Crows",
    attrs: [84, 82, 70, 68, 80, 90, 92, 80, 90, 85, 86], popularity: 80, promotion: "ipw", salary: 6000,
    biography: "The cold, calculating leader of the Obsidian Order. Crowe believes Ironside was built on his back and that Marcus Vane stole the spotlight he earned." },
  { key: "stryke", ring_name: "Dahlia Stryke", real_name: "Dahlia Stryker", gender: "female", division: "womens", billed_from: "Lakeport", height_cm: 170, weight_kg: 62, birth_date: "1994-01-28", debut_date: "2014-09-05", alignment: "face", role: "wrestler", card_position: "main_event", finisher: "Thorn Driver",
    attrs: [84, 80, 62, 80, 82, 82, 74, 78, 82, 87, 84], popularity: 78, promotion: "ipw", salary: 5000,
    biography: "A relentless competitor known for her lightning kicks. Stryke has held the Women's Championship longer than anyone in company history." },
  { key: "nocturne", ring_name: "Vera Nocturne", real_name: "Veronika Nowak", gender: "female", division: "womens", billed_from: "Somewhere After Midnight", height_cm: 173, weight_kg: 64, birth_date: "1993-07-13", debut_date: "2013-03-01", alignment: "heel", role: "wrestler", card_position: "upper_midcard", finisher: "Lights Out",
    attrs: [78, 74, 60, 72, 76, 86, 84, 76, 80, 82, 78], popularity: 70, promotion: "ipw", salary: 3800,
    biography: "Theatrical, unsettling and dangerously smart. Nocturne has made it her mission to drag Dahlia Stryke into the dark." },
  { key: "arashi", ring_name: "Kenji Arashi", real_name: "Kenji Arashiyama", gender: "male", division: "mens", billed_from: "Sendai", height_cm: 178, weight_kg: 88, birth_date: "1995-11-30", debut_date: "2015-04-18", alignment: "face", role: "wrestler", card_position: "upper_midcard", finisher: "Storm Lock",
    attrs: [85, 90, 64, 78, 86, 68, 58, 80, 84, 90, 74], popularity: 66, promotion: "ipw", salary: 3500,
    biography: "A technical master who came to Ironside to test himself against the heaviest hitters in the industry. Quiet outside the ring, ruthless inside it." },
  { key: "holloway", ring_name: "Brick Holloway", real_name: "Bryce Holloway", gender: "male", division: "mens", billed_from: "Ashgrove", height_cm: 198, weight_kg: 138, birth_date: "1990-03-09", debut_date: "2012-08-11", alignment: "heel", role: "wrestler", card_position: "upper_midcard", finisher: "Wrecking Ball",
    attrs: [72, 55, 94, 45, 70, 70, 60, 70, 68, 78, 72], popularity: 64, promotion: "ipw", salary: 3200,
    biography: "The Obsidian Order's enforcer and current Heritage Champion. Holloway answers every question with a shoulder tackle." },
  { key: "lark", ring_name: "Theo Lark", real_name: "Theodore Larkin", gender: "male", division: "mens", billed_from: "Westvale", height_cm: 175, weight_kg: 79, birth_date: "2002-04-21", debut_date: "2022-01-15", alignment: "face", role: "wrestler", card_position: "prospect", finisher: "Skylark",
    attrs: [66, 58, 50, 90, 72, 74, 56, 74, 60, 70, 62], popularity: 48, promotion: "ipw", salary: 1200,
    biography: "A fearless young high-flyer from the Ironside training school. Fans love his heart; veterans think he takes too many risks." },
  { key: "morrow", ring_name: "Rex Morrow", real_name: "Rexford Morrow", gender: "male", division: "mens", billed_from: "Calloway County", height_cm: 185, weight_kg: 98, birth_date: "1992-09-14", debut_date: "2013-11-02", alignment: "heel", role: "wrestler", card_position: "midcard", finisher: "Last Call",
    attrs: [70, 68, 68, 62, 72, 66, 72, 70, 70, 74, 60], popularity: 52, promotion: "ipw", salary: 1800,
    biography: "A barroom brawler with a mean streak and an endless list of grievances." },
  { key: "castellano", ring_name: "Ivy Castellano", real_name: "Ivana Castellano", gender: "female", division: "womens", billed_from: "Riverside Heights", height_cm: 165, weight_kg: 58, birth_date: "1997-06-06", debut_date: "2017-05-20", alignment: "face", role: "wrestler", card_position: "upper_midcard", finisher: "Ivy League",
    attrs: [76, 82, 52, 74, 78, 72, 64, 74, 74, 84, 66], popularity: 60, promotion: "ipw", salary: 2400,
    biography: "A submission specialist and former amateur champion who refuses to take shortcuts." },
  { key: "blaise", ring_name: "Juno Blaise", real_name: "Juno Blaisdell", gender: "female", division: "womens", billed_from: "Port Ember", height_cm: 168, weight_kg: 60, birth_date: "2003-02-11", debut_date: "2023-06-03", alignment: "face", role: "wrestler", card_position: "prospect", finisher: "Wildfire",
    attrs: [60, 56, 56, 78, 70, 70, 58, 68, 54, 66, 58], popularity: 40, promotion: "ipw", salary: 900,
    biography: "An energetic rookie with a natural connection to the crowd and a lot to learn." },
  { key: "gvoss", ring_name: "Gunnar Voss", real_name: "Gunnar Vossberg", gender: "male", division: "mens", billed_from: "The Northern Steelyards", height_cm: 193, weight_kg: 120, birth_date: "1988-12-01", debut_date: "2009-10-10", alignment: "heel", role: "wrestler", card_position: "midcard", finisher: "Syndicate Spike",
    attrs: [74, 66, 84, 52, 74, 62, 60, 72, 76, 80, 68], popularity: 58, promotion: "ipw", salary: 2200,
    biography: "The elder half of the Steel Syndicate, a methodical brawler who calls the shots in their tag team." },
  { key: "avoss", ring_name: "Axel Voss", real_name: "Axel Vossberg", gender: "male", division: "mens", billed_from: "The Northern Steelyards", height_cm: 190, weight_kg: 112, birth_date: "1991-04-17", debut_date: "2011-10-10", alignment: "heel", role: "wrestler", card_position: "midcard", finisher: "Syndicate Spike",
    attrs: [72, 62, 80, 60, 76, 60, 54, 70, 70, 76, 64], popularity: 55, promotion: "ipw", salary: 2100,
    biography: "The younger, wilder Voss brother. What Axel lacks in patience he makes up for in aggression." },
  { key: "sparks", ring_name: "Jett Sparks", real_name: "Jethro Sparks", gender: "male", division: "mens", billed_from: "Neon Mile", height_cm: 180, weight_kg: 84, birth_date: "1998-08-08", debut_date: "2018-02-14", alignment: "face", role: "wrestler", card_position: "midcard", finisher: "Short Circuit",
    attrs: [72, 64, 58, 86, 78, 76, 66, 74, 66, 76, 64], popularity: 57, promotion: "ipw", salary: 1700,
    biography: "One half of Neon Riot, a team that never met a turnbuckle it would not jump off." },
  { key: "rivera", ring_name: "Kai Rivera", real_name: "Kai Rivera", gender: "male", division: "mens", billed_from: "Neon Mile", height_cm: 178, weight_kg: 82, birth_date: "1998-10-03", debut_date: "2018-02-14", alignment: "face", role: "wrestler", card_position: "midcard", finisher: "Riot Act",
    attrs: [70, 70, 56, 84, 76, 70, 62, 72, 70, 80, 62], popularity: 54, promotion: "ipw", salary: 1700,
    biography: "The steady technician of Neon Riot and the glue that holds the team together." },
  { key: "sterling", ring_name: "Victor Sterling", real_name: "Victor Sterling-Hayes", gender: "male", division: "mens", billed_from: "Highcastle", height_cm: 183, weight_kg: 86, birth_date: "1978-02-25", debut_date: "2001-07-07", alignment: "heel", role: "manager", card_position: "midcard", finisher: "",
    attrs: [30, 40, 30, 30, 40, 88, 94, 50, 82, 90, 70], popularity: 60, promotion: "ipw", salary: 1500,
    biography: "A silver-tongued manager and the strategist behind the Obsidian Order. Sterling has never thrown a punch, and never needed to." },
  { key: "delgado", ring_name: "Hank Delgado", real_name: "Enrique Delgado", gender: "male", division: "mens", billed_from: "San Brava", height_cm: 183, weight_kg: 104, birth_date: "1983-08-29", debut_date: "2003-05-17", alignment: "face", role: "wrestler", card_position: "midcard", finisher: "Old School Bomb",
    attrs: [74, 76, 72, 48, 62, 72, 70, 80, 88, 92, 66], popularity: 56, promotion: "ipw", salary: 1900,
    biography: "A respected veteran who has seen every era of Ironside. Delgado now spends as much time mentoring rookies as he does wrestling." },
  { key: "quill", ring_name: "Zara Quill", real_name: "Zara Quillon", gender: "female", division: "womens", billed_from: "Silverbrook", height_cm: 171, weight_kg: 63, birth_date: "1996-12-19", debut_date: "2019-01-26", alignment: "heel", role: "wrestler", card_position: "midcard", finisher: "Fine Print",
    attrs: [68, 70, 58, 66, 70, 74, 76, 66, 70, 74, 60], popularity: 50, promotion: "ipw", salary: 1500,
    biography: "A self-proclaimed genius who studies her opponents' weaknesses and never stops talking about it." },
  { key: "ferreira", ring_name: "Nico Ferreira", real_name: "Nicolau Ferreira", gender: "male", division: "mens", billed_from: "Porto Alegre Bay", height_cm: 176, weight_kg: 85, birth_date: "2000-03-03", debut_date: "2021-09-09", alignment: "face", role: "wrestler", card_position: "lower_card", finisher: "Bossa Kick",
    attrs: [60, 58, 54, 72, 66, 60, 50, 64, 56, 70, 50], popularity: 36, promotion: "ipw", salary: 800,
    biography: "A hard-working undercard regular looking for the win that changes everything." },

  // --- Pacific Rift Wrestling -----------------------------------------------
  { key: "takamine", ring_name: "Ryu Takamine", real_name: "Ryunosuke Takamine", gender: "male", division: "mens", billed_from: "Kobe", height_cm: 182, weight_kg: 94, birth_date: "1990-06-15", debut_date: "2010-04-04", alignment: "face", role: "wrestler", card_position: "main_event", finisher: "Tidal Driver",
    attrs: [90, 88, 72, 76, 90, 76, 64, 86, 90, 92, 88], popularity: 74, promotion: "prw", salary: 4500,
    biography: "The ace of Pacific Rift and its Openweight Champion. Takamine's thirty-minute title defenses are the stuff of legend." },
  { key: "kross", ring_name: "Damien Kross", real_name: "Damian Krossman", gender: "male", division: "mens", billed_from: "Dead Reef", height_cm: 190, weight_kg: 106, birth_date: "1992-01-07", debut_date: "2012-12-12", alignment: "heel", role: "wrestler", card_position: "main_event", finisher: "Shipwreck",
    attrs: [82, 76, 82, 64, 80, 82, 80, 76, 80, 80, 82], popularity: 68, promotion: "prw", salary: 3800,
    biography: "A brooding powerhouse obsessed with taking the Openweight title from Takamine by any means necessary." },
  { key: "marsh", ring_name: "Elena Marsh", real_name: "Elena Marshall", gender: "female", division: "womens", billed_from: "Port Calder", height_cm: 168, weight_kg: 61, birth_date: "1995-09-09", debut_date: "2016-03-12", alignment: "face", role: "wrestler", card_position: "main_event", finisher: "Undertow",
    attrs: [82, 84, 58, 78, 84, 74, 66, 78, 82, 88, 78], popularity: 66, promotion: "prw", salary: 3000,
    biography: "Pacific Rift's Women's Champion and a hometown hero in Port Calder." },
  { key: "reyes", ring_name: "Sofia Reyes", real_name: "Sofia Reyes-Moreno", gender: "female", division: "womens", billed_from: "Valle Oscuro", height_cm: 166, weight_kg: 59, birth_date: "1996-04-30", debut_date: "2017-07-01", alignment: "heel", role: "wrestler", card_position: "upper_midcard", finisher: "Black Widow Clutch",
    attrs: [78, 80, 56, 76, 78, 76, 72, 74, 78, 80, 72], popularity: 58, promotion: "prw", salary: 2400,
    biography: "A cunning submission artist managed by Lady Seraphine." },
  { key: "brennan", ring_name: "Cole Brennan", real_name: "Colin Brennan", gender: "male", division: "mens", billed_from: "Dunmore", height_cm: 186, weight_kg: 100, birth_date: "1993-02-17", debut_date: "2014-10-25", alignment: "tweener", role: "wrestler", card_position: "upper_midcard", finisher: "Brennan Bomb",
    attrs: [78, 72, 78, 62, 80, 70, 66, 76, 76, 84, 70], popularity: 57, promotion: "prw", salary: 2200,
    biography: "A no-nonsense brawler who answers to nobody, fan or foe." },
  { key: "kade", ring_name: "Tomas Kade", real_name: "Tomas Kadlec", gender: "male", division: "mens", billed_from: "Highreach", height_cm: 181, weight_kg: 90, birth_date: "1994-05-05", debut_date: "2016-09-17", alignment: "heel", role: "wrestler", card_position: "midcard", finisher: "Kade Crusher",
    attrs: [72, 74, 66, 70, 74, 62, 64, 70, 70, 78, 60], popularity: 46, promotion: "prw", salary: 1500,
    biography: "An arrogant technician who insists he is underappreciated." },
  { key: "sato", ring_name: "Mika Sato", real_name: "Mika Sato", gender: "female", division: "womens", billed_from: "Osaka", height_cm: 160, weight_kg: 54, birth_date: "2003-08-22", debut_date: "2023-02-18", alignment: "face", role: "wrestler", card_position: "prospect", finisher: "Sakura Spiral",
    attrs: [64, 62, 46, 84, 72, 72, 52, 70, 58, 72, 56], popularity: 42, promotion: "prw", salary: 900,
    biography: "A rising star from Pacific Rift's dojo, already turning heads with her speed." },
  { key: "ohale", ring_name: "Owen Hale", real_name: "Owen Hale", gender: "male", division: "mens", billed_from: "Saltmarsh", height_cm: 184, weight_kg: 92, birth_date: "1994-07-07", debut_date: "2015-06-06", alignment: "face", role: "wrestler", card_position: "midcard", finisher: "Riptide",
    attrs: [74, 72, 66, 74, 80, 66, 60, 74, 74, 82, 64], popularity: 52, promotion: "prw", salary: 1600,
    biography: "The older Hale brother and the steady anchor of Riptide." },
  { key: "fhale", ring_name: "Finn Hale", real_name: "Finnegan Hale", gender: "male", division: "mens", billed_from: "Saltmarsh", height_cm: 180, weight_kg: 86, birth_date: "1997-03-27", debut_date: "2017-06-06", alignment: "face", role: "wrestler", card_position: "midcard", finisher: "Riptide",
    attrs: [72, 66, 60, 82, 78, 70, 58, 72, 68, 78, 62], popularity: 50, promotion: "prw", salary: 1500,
    biography: "The daredevil of Riptide, always looking for a higher rope." },
  { key: "mercer", ring_name: "Dex Mercer", real_name: "Dexter Mercer", gender: "male", division: "mens", billed_from: "Blackwater Docks", height_cm: 188, weight_kg: 108, birth_date: "1991-11-11", debut_date: "2013-04-13", alignment: "heel", role: "wrestler", card_position: "midcard", finisher: "Deep Six",
    attrs: [72, 64, 80, 56, 74, 64, 66, 70, 72, 76, 66], popularity: 51, promotion: "prw", salary: 1700,
    biography: "Half of Blackwater and the current co-holder of the Rift Tag Team Championship." },
  { key: "bram", ring_name: "Luca Bram", real_name: "Luca Brambilla", gender: "male", division: "mens", billed_from: "Blackwater Docks", height_cm: 186, weight_kg: 104, birth_date: "1992-06-20", debut_date: "2013-04-13", alignment: "heel", role: "wrestler", card_position: "midcard", finisher: "Deep Six",
    attrs: [70, 66, 76, 60, 74, 62, 60, 72, 70, 78, 64], popularity: 49, promotion: "prw", salary: 1600,
    biography: "Mercer's partner in crime and the more vicious half of Blackwater." },
  { key: "raman", ring_name: "Priya Raman", real_name: "Priya Raman", gender: "female", division: "womens", billed_from: "New Kestrel", height_cm: 163, weight_kg: 57, birth_date: "1998-01-14", debut_date: "2019-08-31", alignment: "face", role: "wrestler", card_position: "midcard", finisher: "Lotus Lock",
    attrs: [72, 76, 50, 72, 74, 70, 64, 72, 70, 82, 62], popularity: 48, promotion: "prw", salary: 1400,
    biography: "A determined technician chasing her first championship." },
  { key: "seraphine", ring_name: "Lady Seraphine", real_name: "Seraphina Vale", gender: "female", division: "womens", billed_from: "The Gilded Coast", height_cm: 175, weight_kg: 63, birth_date: "1985-05-25", debut_date: "2006-10-31", alignment: "heel", role: "manager", card_position: "midcard", finisher: "",
    attrs: [30, 36, 30, 34, 40, 86, 90, 50, 80, 88, 66], popularity: 54, promotion: "prw", salary: 1300,
    biography: "An elegant and manipulative manager who collects champions the way others collect jewelry." },
];

export const STARTER_TEAMS = [
  { key: "syndicate", name: "The Steel Syndicate", kind: "tag_team" as const, promotion: "ipw" as const, members: ["gvoss", "avoss"], formed_on: "2019-03-02", experience: 78, description: "The Voss brothers: a punishing, rules-optional tag team." },
  { key: "neon", name: "Neon Riot", kind: "tag_team" as const, promotion: "ipw" as const, members: ["sparks", "rivera"], formed_on: "2020-07-11", experience: 66, description: "Two best friends from the Neon Mile with a high-flying, high-energy style." },
  { key: "order", name: "The Obsidian Order", kind: "faction" as const, promotion: "ipw" as const, members: ["crowe", "holloway", "gvoss", "avoss"], leader: "crowe", manager: "sterling", formed_on: "2024-09-20", experience: 50, description: "Silas Crowe's faction, built to take control of Ironside." },
  { key: "riptide", name: "Riptide", kind: "tag_team" as const, promotion: "prw" as const, members: ["ohale", "fhale"], formed_on: "2018-05-05", experience: 72, description: "The Hale brothers, Pacific Rift's most beloved tag team." },
  { key: "blackwater", name: "Blackwater", kind: "tag_team" as const, promotion: "prw" as const, members: ["mercer", "bram"], formed_on: "2016-01-16", experience: 80, description: "Dockside bruisers and reigning Rift Tag Team Champions." },
];

export const STARTER_CHAMPIONSHIPS = [
  { key: "ipw_world", name: "Ironside World Championship", promotion: "ipw" as const, division: "mens" as const, format: "singles" as const, tier: "world" as const, prestige: 82, established_on: "2009-05-01",
    description: "The top prize in Ironside Pro Wrestling.",
    history: [
      { holders: ["crowe"], started_on: "2024-06-14", ended_on: "2025-03-21", defenses: 9 },
      { holders: ["vane"], started_on: "2025-03-21", ended_on: null, defenses: 6 },
    ] },
  { key: "ipw_women", name: "Ironside Women's Championship", promotion: "ipw" as const, division: "womens" as const, format: "singles" as const, tier: "world" as const, prestige: 74, established_on: "2014-10-10",
    description: "The pinnacle of Ironside's women's division.",
    history: [
      { holders: ["nocturne"], started_on: "2024-04-05", ended_on: "2024-11-29", defenses: 5 },
      { holders: ["stryke"], started_on: "2024-11-29", ended_on: null, defenses: 11 },
    ] },
  { key: "ipw_heritage", name: "Ironside Heritage Championship", promotion: "ipw" as const, division: "open" as const, format: "singles" as const, tier: "secondary" as const, prestige: 60, established_on: "2012-01-20",
    description: "A proving-ground title for the hardest workers in Ironside.",
    history: [
      { holders: ["arashi"], started_on: "2025-02-07", ended_on: "2025-08-15", defenses: 7 },
      { holders: ["holloway"], started_on: "2025-08-15", ended_on: null, defenses: 3 },
    ] },
  { key: "ipw_tag", name: "Ironside Tag Team Championship", promotion: "ipw" as const, division: "open" as const, format: "tag" as const, tier: "tag" as const, prestige: 58, established_on: "2010-06-12",
    description: "Contested by Ironside's best duos.",
    history: [
      { holders: ["sparks", "rivera"], team: "neon", started_on: "2025-01-10", ended_on: "2025-07-04", defenses: 5 },
      { holders: ["gvoss", "avoss"], team: "syndicate", started_on: "2025-07-04", ended_on: null, defenses: 4 },
    ] },
  { key: "prw_open", name: "Rift Openweight Championship", promotion: "prw" as const, division: "open" as const, format: "singles" as const, tier: "world" as const, prestige: 76, established_on: "2014-10-01",
    description: "Pacific Rift's top championship, open to all.",
    history: [{ holders: ["takamine"], started_on: "2025-05-30", ended_on: null, defenses: 5 }] },
  { key: "prw_women", name: "Rift Women's Championship", promotion: "prw" as const, division: "womens" as const, format: "singles" as const, tier: "world" as const, prestige: 64, established_on: "2016-02-20",
    description: "The top women's title in Pacific Rift.",
    history: [
      { holders: ["reyes"], started_on: "2025-01-25", ended_on: "2025-06-28", defenses: 3 },
      { holders: ["marsh"], started_on: "2025-06-28", ended_on: null, defenses: 4 },
    ] },
  { key: "prw_tag", name: "Rift Tag Team Championship", promotion: "prw" as const, division: "open" as const, format: "tag" as const, tier: "tag" as const, prestige: 56, established_on: "2015-03-14",
    description: "Pacific Rift's tag team titles.",
    history: [{ holders: ["mercer", "bram"], team: "blackwater", started_on: "2025-04-12", ended_on: null, defenses: 6 }] },
];

export const STARTER_STORYLINES = [
  { key: "crown", title: "Crown of Thorns", kind: "feud" as const, promotion: "ipw" as const, status: "active" as const, intensity: 58, championship: "ipw_world",
    objective: "Silas Crowe wants back the World Championship he believes Marcus Vane stole from him.",
    description: "Since losing the title in March, Crowe has rebuilt the Obsidian Order around one goal: dethroning Vane at Breaking Point.",
    participants: [{ key: "vane", role: "protagonist" as const, side: 0 }, { key: "crowe", role: "antagonist" as const, side: 1 }, { key: "sterling", role: "manager" as const, side: 1 }] },
  { key: "midnight", title: "After Midnight", kind: "rivalry" as const, promotion: "ipw" as const, status: "building" as const, intensity: 34, championship: "ipw_women",
    objective: "Vera Nocturne wants to break Dahlia Stryke mentally before taking her title.",
    description: "Nocturne has been leaving cryptic messages for the champion every week.",
    participants: [{ key: "stryke", role: "protagonist" as const, side: 0 }, { key: "nocturne", role: "antagonist" as const, side: 1 }] },
  { key: "lark_rise", title: "Lark Takes Flight", kind: "underdog" as const, promotion: "ipw" as const, status: "building" as const, intensity: 22, championship: null,
    objective: "Theo Lark wants to prove he belongs in the main event picture.",
    description: "Veteran Hank Delgado has taken the young high-flyer under his wing.",
    participants: [{ key: "lark", role: "protagonist" as const, side: 0 }, { key: "delgado", role: "participant" as const, side: 0 }] },
  { key: "order_war", title: "Order vs. Riot", kind: "faction_war" as const, promotion: "ipw" as const, status: "active" as const, intensity: 44, championship: "ipw_tag",
    objective: "Neon Riot want their tag titles back from the Obsidian Order's Steel Syndicate.",
    description: "The Syndicate ended Neon Riot's reign with help from Victor Sterling.",
    participants: [{ key: "sparks", role: "protagonist" as const, side: 0 }, { key: "rivera", role: "protagonist" as const, side: 0 }, { key: "gvoss", role: "antagonist" as const, side: 1 }, { key: "avoss", role: "antagonist" as const, side: 1 }] },
  { key: "rift_ace", title: "Dethroning the Ace", kind: "title_pursuit" as const, promotion: "prw" as const, status: "active" as const, intensity: 50, championship: "prw_open",
    objective: "Damien Kross is determined to end Ryu Takamine's reign.",
    description: "Kross has pinned Takamine in a tag match and demanded a title shot.",
    participants: [{ key: "kross", role: "protagonist" as const, side: 0 }, { key: "takamine", role: "antagonist" as const, side: 1 }] },
];

export const STARTER_RIVALRIES = [
  { a: "vane", b: "crowe", intensity: 60 },
  { a: "stryke", b: "nocturne", intensity: 38 },
  { a: "takamine", b: "kross", intensity: 52 },
  { a: "arashi", b: "holloway", intensity: 30 },
];

export const STARTER_DEALS = [
  { promotion: "ipw" as const, kind: "broadcast" as const, partner_name: "Northline Sports Network", amount_per_show: 28000, applies_to: ["weekly_tv", "major_event", "special"] as const },
  { promotion: "ipw" as const, kind: "sponsorship" as const, partner_name: "Kestrel Energy", amount_per_show: 6000, applies_to: ["weekly_tv", "major_event", "special", "house_show"] as const },
  { promotion: "prw" as const, kind: "broadcast" as const, partner_name: "TideCast Streaming", amount_per_show: 14000, applies_to: ["weekly_tv", "major_event", "special"] as const },
];
