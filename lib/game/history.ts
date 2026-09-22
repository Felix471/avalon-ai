import type { GameEvent, GameState } from './types';

export interface ProposalRecord {
  questNumber: number;
  proposalIndex: number;
  leaderId: number;
  team: number[];
  votes: Record<number, boolean>;
  forced: boolean;
  passed: boolean;
  eventIndex: number;
}

export interface QuestSection {
  questNumber: number;
  proposals: ProposalRecord[];
  result?: 'success' | 'fail';
  failCount?: number;
  events: GameEvent[];
}

function readTeam(event: GameEvent): number[] {
  const team = event.metadata?.team;
  return Array.isArray(team)
    ? team.filter((playerId): playerId is number => typeof playerId === 'number')
    : [];
}

function readVote(event: GameEvent): boolean {
  return typeof event.metadata?.approve === 'boolean'
    ? event.metadata.approve
    : event.content === '同意';
}

export function buildProposalHistory(state: GameState): ProposalRecord[] {
  const proposals: ProposalRecord[] = [];
  const proposalCounts = new Map<number, number>();
  let questNumber = 1;

  state.events.forEach((event, eventIndex) => {
    if (event.type === 'quest_result') {
      questNumber += 1;
      return;
    }

    if (event.type !== 'team_proposal') return;

    const proposalIndex = (proposalCounts.get(questNumber) ?? 0) + 1;
    proposalCounts.set(questNumber, proposalIndex);

    const forced = event.metadata?.forced === true;
    const votes: Record<number, boolean> = {};
    let recordedResult: boolean | undefined;

    for (let index = eventIndex + 1; index < state.events.length; index += 1) {
      const nextEvent = state.events[index];
      if (nextEvent.type === 'team_proposal' || nextEvent.type === 'quest_result') break;

      if (nextEvent.type === 'vote' && nextEvent.playerId !== undefined) {
        votes[nextEvent.playerId] = readVote(nextEvent);
      }

      if (nextEvent.type === 'vote_result' && typeof nextEvent.metadata?.passed === 'boolean') {
        recordedResult = nextEvent.metadata.passed;
      }
    }

    const approveCount = Object.values(votes).filter(Boolean).length;
    const rejectCount = Object.keys(votes).length - approveCount;

    proposals.push({
      questNumber,
      proposalIndex,
      leaderId: event.playerId ?? 0,
      team: readTeam(event),
      votes: forced ? {} : votes,
      forced,
      passed: forced || (recordedResult ?? approveCount > rejectCount),
      eventIndex,
    });
  });

  return proposals;
}

export function buildQuestSections(state: GameState): QuestSection[] {
  const eventsByQuest = new Map<number, GameEvent[]>();
  let questNumber = 1;
  let currentQuestResolved = false;

  for (const event of state.events) {
    if (currentQuestResolved) continue;

    const events = eventsByQuest.get(questNumber) ?? [];
    events.push(event);
    eventsByQuest.set(questNumber, events);

    if (event.type === 'quest_result') {
      if (questNumber < state.currentQuest) {
        questNumber += 1;
      } else {
        currentQuestResolved = true;
      }
    }
  }

  const questNumbers = new Set(eventsByQuest.keys());
  questNumbers.add(state.currentQuest);
  const proposals = buildProposalHistory(state);

  return [...questNumbers]
    .sort((left, right) => left - right)
    .map((sectionQuestNumber) => {
      const quest = state.quests[sectionQuestNumber - 1];
      const result = quest?.result === 'success' || quest?.result === 'fail'
        ? quest.result
        : undefined;

      return {
        questNumber: sectionQuestNumber,
        proposals: proposals.filter(proposal => proposal.questNumber === sectionQuestNumber),
        ...(result
          ? {
              result,
              failCount: Object.values(quest.actions ?? {}).filter(action => !action).length,
            }
          : {}),
        events: eventsByQuest.get(sectionQuestNumber) ?? [],
      };
    });
}
