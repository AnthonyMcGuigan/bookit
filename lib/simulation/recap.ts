/**
 * Recap generation. Recaps are derived only from the structured outcome, so
 * the text can never contradict the recorded result. Template variants are
 * chosen by hashing the segment id, keeping recaps reproducible.
 */
import { FINISH_LABELS, MATCH_TYPE_LABELS, SEGMENT_KIND_LABELS, STIPULATION_LABELS, CROWD_REACTION_LABELS } from "@/lib/domain/enums";
import type { MatchType, SegmentKind, Stipulation } from "@/lib/domain/enums";
import type { SimContext } from "./context";
import { qualityDescriptor, formatStars } from "./scoring";
import type { SegmentOutcome } from "./types";

function variant(key: string, count: number): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % count;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

type NameLookup = (id: string) => string;

function nameLookup(ctx: Pick<SimContext, "wrestlers">): NameLookup {
  return (id) => ctx.wrestlers.get(id)?.ring_name ?? "Unknown";
}

function sideLabel(ids: string[], name: NameLookup): string {
  return joinNames(ids.map(name));
}

export function matchRecap(outcome: SegmentOutcome, ctx: Pick<SimContext, "wrestlers" | "championships">): string {
  const m = outcome.match!;
  const name = nameLookup(ctx);
  const sides = m.sides.map((s) => sideLabel(s.wrestlerIds, name));
  const typeLabel = MATCH_TYPE_LABELS[m.matchType as MatchType] ?? "match";
  const stip = m.stipulation !== "standard" ? ` ${STIPULATION_LABELS[m.stipulation as Stipulation]}` : "";
  const v = variant(outcome.segmentId, 3);
  const sentences: string[] = [];

  const versus = sides.length <= 4 ? sides.join(" vs. ") : `${m.sides.reduce((n, s) => n + s.wrestlerIds.length, 0)} competitors`;
  const opening = [
    `${versus} met in a${/^[aeiou]/i.test((stip || typeLabel).trim()) ? "n" : ""}${stip} ${typeLabel.toLowerCase()} match`,
    `${versus} squared off${stip ? ` under ${STIPULATION_LABELS[m.stipulation as Stipulation].toLowerCase()} rules` : ""}`,
    `The ${typeLabel.toLowerCase()}${stip ? `${stip.toLowerCase()}` : ""} bout between ${versus} lasted ${outcome.durationMin} minutes`,
  ][v];
  sentences.push(`${opening} and delivered ${qualityDescriptor(outcome.quality)} (${formatStars(outcome.starRating)}).`);

  if (m.interference.length > 0) {
    const names = m.interference.map((i) => name(i.wrestlerId));
    sentences.push(`${joinNames(names)} got involved${m.winnerSide !== null ? "" : " and caused chaos"}.`);
  }
  if (m.botch) sentences.push("A miscommunicated spot briefly stalled the action.");

  if (m.winnerSide === null) {
    sentences.push(m.finish === "draw" ? "Neither side could secure the win, and the match ended in a draw." : "The match was thrown out and ruled a no contest.");
  } else {
    const winners = sideLabel(m.winnerIds, name);
    const decisive = m.decisiveWrestlerId ? name(m.decisiveWrestlerId) : winners;
    const finishText: Record<string, string> = {
      pinfall: m.finisherMove ? `${decisive} hit the ${m.finisherMove} for the three count` : `${decisive} scored the pinfall`,
      submission: m.finisherMove ? `${decisive} locked in the ${m.finisherMove} for the tap-out` : `${decisive} forced a submission`,
      knockout: `${decisive} left the opposition unable to continue`,
      roll_up: `${decisive} stole it with a surprise roll-up`,
      interference: `${decisive} capitalised on the outside interference for the pin`,
      dq: `${winners} won by disqualification`,
      countout: `${winners} won by count-out`,
      elimination: `${decisive} survived to the end, scoring the final elimination`,
      ladder_retrieval: `${decisive} climbed the ladder and retrieved the prize`,
      escape: `${decisive} escaped the cage`,
    };
    sentences.push(`${finishText[m.finish] ?? `${winners} won by ${FINISH_LABELS[m.finish].toLowerCase()}`}${m.winnerIds.length > 1 && m.finish !== "dq" && m.finish !== "countout" ? ` to win it for ${winners}` : ""}.`);
    if (m.upset) sentences.push("It was a genuine upset.");
  }

  const t = outcome.title_outcome;
  if (t) {
    const title = ctx.championships.get(t.championshipId)?.name ?? "the championship";
    if (t.result === "new_champion") sentences.push(`${sideLabel(t.newHolderIds, name)} ${t.newHolderIds.length > 1 ? "are" : "is"} the new ${title} holder${t.newHolderIds.length > 1 ? "s" : ""}.`);
    else if (t.result === "vacant_filled") sentences.push(`${sideLabel(t.newHolderIds, name)} claimed the vacant ${title}.`);
    else if (t.result === "retained") sentences.push(`${sideLabel(t.previousHolderIds, name)} retained the ${title}.${t.note ? ` ${t.note}` : ""}`);
    else if (t.note) sentences.push(t.note);
  }

  for (const injury of outcome.injuries) {
    sentences.push(`${name(injury.wrestlerId)} appeared to suffer an injury (${injury.description.toLowerCase()}).`);
  }
  sentences.push(`Crowd reaction: ${CROWD_REACTION_LABELS[outcome.crowdReaction].toLowerCase()}.`);
  return sentences.join(" ");
}

export function segmentRecap(outcome: SegmentOutcome, ctx: Pick<SimContext, "wrestlers">): string {
  const name = nameLookup(ctx);
  const ids = outcome.participants.map((p) => p.wrestlerId);
  const who = joinNames(ids.map(name)) || "The roster";
  const kindLabel = SEGMENT_KIND_LABELS[outcome.kind as SegmentKind].toLowerCase();
  const desc = qualityDescriptor(outcome.quality).replace("match", "segment").replace("bout", "segment").replace("contest", "segment").replace("encounter", "segment").replace("outing", "segment");
  const lines: Record<string, string> = {
    promo: `${who} cut a promo${outcome.title ? ` ("${outcome.title}")` : ""} that came across as ${desc}.`,
    interview: `${who} sat down for an interview, ${desc}.`,
    confrontation: `${who} came face to face in a heated confrontation, ${desc}.`,
    backstage: `A backstage segment featuring ${who} played out as ${desc}.`,
    return: `${who} made a surprise return, and the moment landed as ${desc}.`,
    debut: `${who} made a debut, and the introduction landed as ${desc}.`,
    contract_signing: `A contract signing with ${who} turned into ${desc}.`,
    injury_angle: `${who} were involved in an injury angle that played out as ${desc}.`,
    storyline: `The story moved forward with ${who}; the segment was ${desc}.`,
    custom: `${who} featured in a ${outcome.title || kindLabel} that was ${desc}.`,
  };
  const parts = [lines[outcome.kind] ?? `${who}: ${kindLabel}, ${desc}.`];
  for (const injury of outcome.injuries) {
    parts.push(`${name(injury.wrestlerId)} was written off television (${injury.description.toLowerCase()}, storyline injury).`);
  }
  parts.push(`Crowd reaction: ${CROWD_REACTION_LABELS[outcome.crowdReaction].toLowerCase()}.`);
  return parts.join(" ");
}
