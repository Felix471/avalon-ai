import { describe, expect, it } from 'vitest';
import {
  buildAssassinationPrompt,
  buildTeamBuildingPrompt,
} from '@/lib/security/aiPromptTemplate';
import { DISCUSSION_ROUNDS, GameEvent } from '@/lib/game/types';
import { makeState } from './helpers';

function discussionEvent(index: number): GameEvent {
  return {
    id: `discussion-${index}`,
    timestamp: index,
    type: 'discussion',
    playerId: (index % 5) + 1,
    content: `speech-${index}`,
  };
}

describe('buildTeamBuildingPrompt', () => {
  it('includes the required team size and leader id', () => {
    const prompt = buildTeamBuildingPrompt(makeState(), 1);

    expect(prompt).toContain('- 玩家编号：1');
    expect(prompt).toContain('恰好 2 名队员');
    expect(prompt).toContain('只能输出 2 个玩家编号');
  });

  it('includes strategy only in full mode', () => {
    const state = makeState();
    const fullPrompt = buildTeamBuildingPrompt(state, 3, 'full');
    const naivePrompt = buildTeamBuildingPrompt(state, 3, 'naive');

    expect(fullPrompt).toContain('如果你信任自己，可以把自己选入队伍');
    expect(naivePrompt).not.toContain('如果你信任自己，可以把自己选入队伍');
    expect(naivePrompt).not.toContain('【组队策略】');
  });

  it('shows known evil ids to Merlin but not to a loyal servant', () => {
    const state = makeState();
    const merlinPrompt = buildTeamBuildingPrompt(state, 1);
    const loyalPrompt = buildTeamBuildingPrompt(state, 3);

    expect(merlinPrompt).toContain('【你看到的坏人】玩家4、玩家5');
    expect(loyalPrompt).not.toContain('【你看到的坏人】');
  });

  it('includes only the last 10 discussion speeches', () => {
    const events = Array.from({ length: 11 }, (_, index) => discussionEvent(index));
    const prompt = buildTeamBuildingPrompt(makeState({ events }), 1);

    expect(prompt).not.toContain('speech-0');
    for (let index = 1; index <= 10; index++) {
      expect(prompt).toContain(`speech-${index}`);
    }
  });

  it('marks the forced fifth proposal under the force-team rule', () => {
    const prompt = buildTeamBuildingPrompt(makeState({ consecutiveRejects: 4 }), 1);

    expect(prompt).toContain('是否为强制第5次提案：是');
  });
});

describe('buildAssassinationPrompt', () => {
  it('lists only good players and includes the last 10 speeches', () => {
    const events = Array.from({ length: 11 }, (_, index) => discussionEvent(index));
    const prompt = buildAssassinationPrompt(makeState({ events }), 4);
    const goodPlayerSection = prompt.split('【好人玩家列表】')[1].split('【回顾一下游戏中的关键发言】')[0];

    expect(goodPlayerSection).toContain('玩家1');
    expect(goodPlayerSection).toContain('玩家2');
    expect(goodPlayerSection).toContain('玩家3');
    expect(goodPlayerSection).not.toContain('玩家4');
    expect(goodPlayerSection).not.toContain('玩家5');
    expect(prompt).not.toContain('speech-0');
    expect(prompt).toContain('speech-1');
    expect(prompt).toContain('speech-10');
  });
});

describe('discussion configuration', () => {
  it('uses two discussion rounds', () => {
    expect(DISCUSSION_ROUNDS).toBe(2);
  });
});
