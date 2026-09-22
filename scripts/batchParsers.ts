import { GameState, QUEST_SIZES, ROLES } from '../lib/game/types';
import { parseTargetSelection, parseTeamSelection } from '../lib/game/parsers';

export function parseAndValidateTeam(
  response: string,
  state: GameState,
  leaderId: number,
): { team: number[]; wasFallback: boolean } {
  const questSizes = QUEST_SIZES[state.playerCount] || [2, 3, 2, 3, 3];
  const requiredSize = questSizes[state.currentQuest - 1];

  const validIds = state.players.map(p => p.id);
  const parsed = parseTeamSelection(response, validIds, requiredSize);
  if (parsed) return { team: parsed, wasFallback: false };

  // Parser fallback (counted in fallbackCounts.teamBuilding): keep whatever
  // valid ids appeared, ensure the leader, fill the rest at random.
  const numbers = response.match(/\d+/g) || [];
  let team = [...new Set(
    numbers.map(n => parseInt(n)).filter(n => validIds.includes(n))
  )];

  let wasFallback = false;

  if (team.length !== requiredSize) {
    wasFallback = true;
    if (team.length === 0) team = [leaderId];
    else if (!team.includes(leaderId) && team.length < requiredSize) {
      team.unshift(leaderId);
    }

    const available = state.players.map(p => p.id).filter(id => !team.includes(id));
    const shuffled = available.sort(() => Math.random() - 0.5);
    while (team.length < requiredSize && shuffled.length > 0) {
      team.push(shuffled.shift()!);
    }
    if (team.length > requiredSize) {
      team = team.slice(0, requiredSize);
    }
  }

  return { team, wasFallback };
}

export function parseTargetId(
  response: string,
  state: GameState,
): { targetId: number; wasFallback: boolean } {
  const goodPlayers = state.players.filter(p => ROLES[p.role!].team === 'good');
  const parsed = parseTargetSelection(response, goodPlayers.map(p => p.id));
  let targetId = parsed ?? -1;
  let wasFallback = false;

  if (parsed === null) {
    targetId = goodPlayers[Math.floor(Math.random() * goodPlayers.length)].id;
    wasFallback = true;
  }

  return { targetId, wasFallback };
}
