/**
 * AI Prompt 模板 - 策略增强版
 *
 * 核心改进：
 * 1. 坏人AI不会自爆，会伪装成好人
 * 2. 根据游戏阶段调整策略
 * 3. 防止prompt injection
 */

import { GameState, Player, ROLES } from '@/lib/game/types';
import { getPlayerVision } from '@/lib/game/engine';

// ==================== 发言阶段 Prompt ====================

export function buildDiscussionPrompt(
  gameState: GameState,
  playerId: number,
  recentSpeeches: Array<{ playerId: number; content: string }>,
  mode: 'full' | 'naive' = 'full'
): string {
  const player = gameState.players.find(p => p.id === playerId)!;
  const role = ROLES[player.role!];
  const vision = getPlayerVision(gameState, playerId);
  const isEvil = role.team === 'evil';

  // 判断游戏阶段
  const isEarlyGame = gameState.goodWins + gameState.evilWins <= 1;
  const isLateGame = gameState.goodWins >= 2 || gameState.evilWins >= 2;
  const isAssassinationSoon = gameState.goodWins === 2; // 好人即将获胜

  // 构建角色特定的策略指导
  let strategyGuide = '';

  if (isEvil) {
    // ===== 坏人策略 =====
    if (mode === 'naive') {
      strategyGuide = `
【你的阵营】莫德雷德阵营（坏人）
【核心目标】破坏任务 或 最终刺杀梅林

${vision.teammates.length > 0 ? `【你知道的队友】玩家${vision.teammates.join('、玩家')}是你的坏人队友` : ''}`;
    } else {
      strategyGuide = `
【你的阵营】莫德雷德阵营（坏人）
【核心目标】破坏任务 或 最终刺杀梅林

【绝对禁止 - 违反会导致游戏失败】
❌ 绝对不能说"我是坏人"、"我是刺客/莫甘娜/莫德雷德"等暴露身份的话
❌ 绝对不能说"找出梅林"、"刺杀梅林"等只有坏人才会说的话
❌ 绝对不能暗示自己知道谁是坏人队友
❌ 不能无缘无故攻击好人玩家（除非有合理的游戏逻辑理由）

【必须做到 - 伪装成好人】
✅ 你的发言必须让其他人认为你是好人
✅ 表现出对任务成功的关心（即使你内心想破坏）
✅ 对可疑玩家表达合理的怀疑（可以怀疑其他坏人来伪装）
✅ 用好人的视角和逻辑来分析局势

【策略建议】
${isEarlyGame ? `- 游戏初期：保持低调，收集信息，不要急于表态
- 可以适当附和其他玩家的观点，建立信任
- 如果被质疑，冷静辩解，不要激动（激动容易露馅）` : ''}
${isLateGame ? `- 游戏后期：可以更积极地引导讨论方向
- 如果身份已暴露，尝试拉其他好人下水，制造混乱
- 帮助队友分散注意力` : ''}
${isAssassinationSoon ? `- 好人即将获胜：注意观察谁可能是梅林
- 梅林的特点：对坏人身份判断很准，但会隐藏信息来源
- 不要直接问"谁是梅林"，而是观察谁的推理过于准确` : ''}

${vision.teammates.length > 0 ? `【你知道的队友】玩家${vision.teammates.join('、玩家')}是你的坏人队友，但绝对不能在发言中暴露这一点！` : ''}`;
    }
  } else {
    // ===== 好人策略 =====
    if (mode === 'naive') {
      strategyGuide = `
【你的阵营】亚瑟阵营（好人）
【核心目标】完成3个任务 并 保护梅林不被刺杀

${vision.knownEvil.length > 0 ? `【你看到的坏人】玩家${vision.knownEvil.join('、玩家')}` : ''}
${vision.knownMerlinOrMorgana.length > 0 ? `【你看到的梅林或莫甘娜】玩家${vision.knownMerlinOrMorgana.join('、玩家')}` : ''}`;
    } else {
      strategyGuide = `
【你的阵营】亚瑟阵营（好人）
【核心目标】完成3个任务 并 保护梅林不被刺杀

【角色特点】
${player.role === 'merlin' ? `你是梅林！你知道谁是坏人，但必须隐藏这一点。
⚠️ 如果你表现得太明显，游戏结束时刺客会找到你！
- 不要直接说"玩家X是坏人"
- 用推理的方式引导好人，比如"玩家X的行为有点奇怪"
- 适当说错一些判断来伪装自己` : ''}
${player.role === 'percival' ? `你是派西维尔！你看到了梅林和莫甘娜，但不知道谁是真的梅林。
- 保护真梅林，但也要小心莫甘娜的误导
- 可以观察他们的发言风格来判断` : ''}
${player.role === 'loyal' ? `你是忠臣！你没有特殊信息，需要通过推理找出坏人。
- 仔细观察每个人的发言和投票
- 注意前后矛盾的行为` : ''}

${vision.knownEvil.length > 0 ? `【你看到的坏人】玩家${vision.knownEvil.join('、玩家')}（注意：不要太直接地暴露这个信息！）` : ''}
${vision.knownMerlinOrMorgana.length > 0 ? `【你看到的梅林或莫甘娜】玩家${vision.knownMerlinOrMorgana.join('、玩家')}（你需要判断谁是真梅林）` : ''}`;
    }
  }

  // 游戏状态信息
  const gameStatus = `
【当前局势】
- 任务进度：好人 ${gameState.goodWins} 胜 / 坏人 ${gameState.evilWins} 胜
- 当前任务：第 ${gameState.currentQuest} 轮
- 当前队长：玩家${gameState.currentLeaderIndex + 1}
- 连续否决：${gameState.consecutiveRejects} 次`;

  // 其他玩家的发言
  const speechesSection = recentSpeeches.length > 0
    ? `\n【其他玩家的发言】\n${recentSpeeches.map(s => `玩家${s.playerId}：「${s.content}」`).join('\n')}\n`
    : '';

  // 最终 prompt
  return `你正在玩阿瓦隆桌游，这是一个需要推理和伪装的社交游戏。
${strategyGuide}
${gameStatus}
${speechesSection}
【你的任务】
现在轮到你（玩家${playerId}）发言。请根据以上信息，发表一段 50-150 字的游戏发言。
记住：${isEvil ? '你必须伪装成好人！不能暴露身份！' : '仔细分析局势，找出可疑的玩家。'}

【输出格式要求 - 非常重要】
- 直接输出发言内容，不要加任何前缀（如"玩家X："）
- 不要用引号、书名号或其他符号包裹你的发言
- 不要输出"「」"这种符号
- 就像你在现实中说话一样，直接说出内容

你的发言：`;
}

// ==================== 投票阶段 Prompt ====================

export function buildVotingPrompt(
  gameState: GameState,
  playerId: number,
  proposedTeam: number[],
  mode: 'full' | 'naive' = 'full'
): string {
  const player = gameState.players.find(p => p.id === playerId)!;
  const role = ROLES[player.role!];
  const vision = getPlayerVision(gameState, playerId);
  const isEvil = role.team === 'evil';

  // 检查队伍中是否有已知的坏人
  const knownEvilInTeam = vision.knownEvil.filter(id => proposedTeam.includes(id));
  const teammatesInTeam = vision.teammates.filter(id => proposedTeam.includes(id));

  let strategyHint = '';

  if (mode === 'naive') {
    // Naive baseline: no strategy hints, only vision-based warnings for good
    if (isEvil) {
      strategyHint = `\n你是坏人。`;
    } else {
      strategyHint = `\n你是好人。${knownEvilInTeam.length > 0 ? `\n注意：队伍中有你知道的坏人（玩家${knownEvilInTeam.join('、玩家')}）。` : ''}`;
    }
  } else {
    if (isEvil) {
      strategyHint = `
【你是坏人，投票策略】
- 如果队伍里没有坏人：倾向于反对（但不要每次都反对，会暴露）
- 如果队伍里有坏人队友：倾向于同意（让队友有机会破坏任务）
- 如果连续否决次数很高：考虑同意，避免强制发车
- 偶尔做出"反常"的投票来伪装

队伍中你的队友：${teammatesInTeam.length > 0 ? `玩家${teammatesInTeam.join('、玩家')}` : '无'}`;
    } else {
      strategyHint = `
【你是好人，投票策略】
- 如果队伍里有你怀疑的坏人：反对
- 如果队伍看起来可靠：同意
- 如果连续否决次数很高：考虑同意一个还行的队伍

${knownEvilInTeam.length > 0 ? `⚠️ 注意：队伍中有你知道的坏人（玩家${knownEvilInTeam.join('、玩家')}）！` : ''}`;
    }
  }

  return `你正在阿瓦隆游戏中进行投票。
${strategyHint}

【当前提议的队伍】
队长玩家${gameState.currentLeaderIndex + 1}提议：${proposedTeam.map(id => `玩家${id}`).join(', ')}

【当前局势】
- 任务进度：好人 ${gameState.goodWins} 胜 / 坏人 ${gameState.evilWins} 胜
- 当前任务：第 ${gameState.currentQuest} 轮
- 连续否决：${gameState.consecutiveRejects} 次（5次否决${gameState.variantRules.fifthVoteRule === 'evil_wins' ? '坏人直接获胜' : '强制发车'}）

【输出格式】
只能输出 APPROVE（同意）或 REJECT（反对），不要输出其他内容。

你的投票：`;
}

// ==================== 任务执行阶段 Prompt ====================

export function buildQuestActionPrompt(
  gameState: GameState,
  playerId: number,
  mode: 'full' | 'naive' = 'full'
): string {
  const player = gameState.players.find(p => p.id === playerId)!;
  const role = ROLES[player.role!];
  const isEvil = role.team === 'evil';

  // 好人必须成功
  if (!isEvil) {
    return `你是好人，执行任务时必须选择成功。
输出：SUCCESS`;
  }

  // 坏人的策略
  const quest = gameState.quests[gameState.currentQuest - 1];
  const teamSize = quest.team?.length || 0;
  const needsDoubleFail = quest.requiresDoubleFail;

  const gameStatus = `【当前局势】
- 任务进度：好人 ${gameState.goodWins} 胜 / 坏人 ${gameState.evilWins} 胜
- 当前任务：第 ${gameState.currentQuest} 轮
- 队伍人数：${teamSize} 人
${needsDoubleFail ? '- ⚠️ 这个任务需要2张失败票才会失败！' : ''}`;

  if (mode === 'naive') {
    return `你是坏人，正在执行任务。你可以选择让任务成功或失败。

${gameStatus}

【输出格式】
只能输出 SUCCESS（成功）或 FAIL（失败）。

你的选择：`;
  }

  return `你是坏人，正在执行任务。你可以选择让任务成功或失败。

${gameStatus}

【策略建议】
- 如果出失败票：任务失败，但你会暴露队伍中有坏人
- 如果出成功票：任务成功，但你保持隐藏
- 如果坏人已经赢了2轮：可以考虑保持隐藏，等待刺杀梅林
- 如果好人快赢了：必须出失败票阻止
- 如果你有在队伍里有你已知的坏人队友，除非第四轮需要两张坏票，按照优先级顺序，顺序更高的投坏票（Minion > Morgana > Mordred > Assassin)
- 在非第四轮的前提下，出现一张以上的坏票对坏人是有害的：但这个操作本身不被禁止
- 如果你是Oberon，你的策略不受建议限制

【输出格式】
只能输出 SUCCESS（成功）或 FAIL（失败）。

你的选择：`;
}

// ==================== Team-building Prompt ====================

export function buildTeamBuildingPrompt(
  gameState: GameState,
  leaderId: number,
  mode: 'full' | 'naive' = 'full'
): string {
  const leader = gameState.players.find(player => player.id === leaderId)!;
  const role = ROLES[leader.role!];
  const vision = getPlayerVision(gameState, leaderId);
  const requiredSize = gameState.quests[gameState.currentQuest - 1].requiredPlayers;
  const isForcedFifthProposal = gameState.variantRules.fifthVoteRule === 'force_team'
    && gameState.consecutiveRejects >= 4;

  const visionLines = [
    vision.knownEvil.length > 0
      ? `【你看到的坏人】玩家${vision.knownEvil.join('、玩家')}`
      : '',
    vision.knownMerlinOrMorgana.length > 0
      ? `【你看到的梅林或莫甘娜】玩家${vision.knownMerlinOrMorgana.join('、玩家')}`
      : '',
    vision.teammates.length > 0
      ? `【你知道的队友】玩家${vision.teammates.join('、玩家')}`
      : '',
  ].filter(Boolean).join('\n');

  const resolvedQuests = gameState.quests.filter(
    quest => quest.result === 'success' || quest.result === 'fail'
  );
  const questHistory = resolvedQuests.length > 0
    ? resolvedQuests.map(quest => {
        const team = quest.team?.map(id => `玩家${id}`).join('、') || '未知';
        return `- 任务${quest.questNumber}：队伍 ${team}；结果：${quest.result === 'success' ? '成功' : '失败'}`;
      }).join('\n')
    : '- 暂无已完成任务';

  const lastQuestResultIndex = gameState.events.reduce(
    (lastIndex, event, index) => event.type === 'quest_result' ? index : lastIndex,
    -1
  );
  const currentQuestEvents = gameState.events.slice(lastQuestResultIndex + 1);
  let rejectedVoteIndex = -1;
  for (let index = currentQuestEvents.length - 1; index >= 0; index--) {
    const event = currentQuestEvents[index];
    if (event.type === 'vote_result' && event.metadata?.passed === false) {
      rejectedVoteIndex = index;
      break;
    }
  }

  let rejectedProposalSection = '';
  if (rejectedVoteIndex >= 0) {
    let proposalIndex = -1;
    for (let index = rejectedVoteIndex - 1; index >= 0; index--) {
      if (currentQuestEvents[index].type === 'team_proposal') {
        proposalIndex = index;
        break;
      }
    }

    const proposalEvent = proposalIndex >= 0 ? currentQuestEvents[proposalIndex] : undefined;
    const proposedTeam = Array.isArray(proposalEvent?.metadata?.team)
      ? proposalEvent.metadata.team.filter((id): id is number => typeof id === 'number')
      : [];
    const votes = currentQuestEvents
      .slice(proposalIndex + 1, rejectedVoteIndex)
      .filter(event => event.type === 'vote' && typeof event.playerId === 'number')
      .map(event => `玩家${event.playerId}：${event.metadata?.approve === true ? '同意' : '反对'}`);
    const voteResult = currentQuestEvents[rejectedVoteIndex];

    rejectedProposalSection = `
【本轮最近一次被否决的提案】
- 队伍：${proposedTeam.length > 0 ? proposedTeam.map(id => `玩家${id}`).join('、') : '未知'}
- 投票：${votes.length > 0 ? votes.join('；') : voteResult.content}`;
  }

  const discussionEvents = gameState.events.filter(event => event.type === 'discussion');
  const speechesSection = discussionEvents.length > 0
    ? discussionEvents.slice(-10)
        .map(event => `玩家${event.playerId}：${event.content.substring(0, 100)}`)
        .join('\n')
    : '暂无发言';

  let strategySection = '';
  if (mode === 'full') {
    const strategyLines = role.team === 'good'
      ? [
          '- 如果你信任自己，可以把自己选入队伍。',
          '- 避开你确定或怀疑是坏人的玩家。',
          '- 优先选择参加过成功任务的玩家。',
          ...(leader.role === 'merlin'
            ? ['- 不要因为总是排除你看到的坏人而暴露梅林的知识。']
            : []),
        ]
      : [
          '- 需要破坏任务时，让一名坏人队友或你自己进入队伍。',
          '- 组队必须让好人玩家觉得合理，避免暴露坏人阵营。',
        ];
    strategySection = `\n【组队策略】\n${strategyLines.join('\n')}\n`;
  }

  return `你是阿瓦隆游戏中负责组队的队长。

【你的身份】
- 玩家编号：${leaderId}
- 角色：${role.name}
- 阵营：${role.team === 'good' ? '好人' : '坏人'}
${visionLines || '【你的视野】没有额外已知信息'}

【当前局势】
- 当前任务：第 ${gameState.currentQuest} 轮
- 任务比分：好人 ${gameState.goodWins} 胜 / 坏人 ${gameState.evilWins} 胜
- 连续否决：${gameState.consecutiveRejects} 次
- 是否为强制第5次提案：${isForcedFifthProposal ? '是' : '否'}
- 必须选择：恰好 ${requiredSize} 名队员
- 可选玩家编号：${gameState.players.map(player => player.id).join(',')}

【任务历史】
${questHistory}
${rejectedProposalSection}

【最近发言】
${speechesSection}
${strategySection}
【输出格式要求】
只能输出 ${requiredSize} 个玩家编号，用逗号分隔。例如：1,3,5

你选择的队员编号：`;
}

// ==================== 刺杀阶段 Prompt ====================

export function buildAssassinationPrompt(
  gameState: GameState,
  playerId: number,
  mode: 'full' | 'naive' = 'full'
): string {
  const goodPlayers = gameState.players.filter(p => ROLES[p.role!].team === 'good');

  // 收集游戏中的线索
  const discussionEvents = gameState.events.filter(e => e.type === 'discussion');

  if (mode === 'naive') {
    return `你是刺客！好人已经完成了3个任务，但你有最后一次机会——找出并刺杀梅林！

【好人玩家列表】
${goodPlayers.map(p => `玩家${p.id}`).join(', ')}

【回顾一下游戏中的关键发言】
${discussionEvents.slice(-10).map(e => `玩家${e.playerId}：${e.content.substring(0, 100)}`).join('\n')}

【输出格式】
只能输出一个玩家编号，例如：3

你要刺杀的玩家编号：`;
  }

  return `你是刺客！好人已经完成了3个任务，但你有最后一次机会——找出并刺杀梅林！

【如何识别梅林】
梅林知道谁是坏人（除了莫德雷德），所以他的特点是：
1. 对坏人的判断异常准确
2. 但他会隐藏信息来源，用"推理"来掩饰
3. 他可能会故意说错一些判断来伪装
4. 他通常不会第一个跳出来指认坏人

【好人玩家列表】
${goodPlayers.map(p => `玩家${p.id}`).join(', ')}

【回顾一下游戏中的关键发言】
${discussionEvents.slice(-10).map(e => `玩家${e.playerId}：${e.content.substring(0, 100)}`).join('\n')}

【输出格式】
只能输出一个玩家编号，例如：3

你要刺杀的玩家编号：`;
}
