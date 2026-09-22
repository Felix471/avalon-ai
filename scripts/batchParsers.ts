import { GameState, QUEST_SIZES, ROLES } from '../lib/game/types';

export function buildTeamBuildingPrompt(state: GameState, leaderId: number): string {
  const questSizes = QUEST_SIZES[state.playerCount] || [2, 3, 2, 3, 3];
  const requiredSize = questSizes[state.currentQuest - 1];

  return `=== 系统指令 ===
你是阿瓦隆游戏中的队长，需要选择 ${requiredSize} 名队员执行任务。

【重要】必须选择恰好 ${requiredSize} 名玩家，不能多也不能少！

【输出格式要求】
只能输出 ${requiredSize} 个玩家编号，用逗号分隔。
例如：1,3,5

可选的玩家：${state.players.map(p => `玩家${p.id}`).join(', ')}
当前任务：第 ${state.currentQuest} 轮
必须选择：恰好 ${requiredSize} 名队员

请输出你选择的 ${requiredSize} 个队员编号（用逗号分隔）：`;
}

export function parseAndValidateTeam(
  response: string,
  state: GameState,
  leaderId: number,
): { team: number[]; wasFallback: boolean } {
  const questSizes = QUEST_SIZES[state.playerCount] || [2, 3, 2, 3, 3];
  const requiredSize = questSizes[state.currentQuest - 1];

  const numbers = response.match(/\d+/g) || [];
  let team = [...new Set(
    numbers.map(n => parseInt(n)).filter(n => n >= 1 && n <= state.playerCount)
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
  const match = response.match(/\d+/);
  let targetId = match ? parseInt(match[0]) : -1;
  let wasFallback = false;

  if (!goodPlayers.find(p => p.id === targetId)) {
    targetId = goodPlayers[Math.floor(Math.random() * goodPlayers.length)].id;
    wasFallback = true;
  }

  return { targetId, wasFallback };
}
