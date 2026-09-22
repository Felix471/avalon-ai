import { describe, expect, it } from 'vitest';
import { parseTargetSelection, parseTeamSelection } from '@/lib/game/parsers';

// Captured from the live site on 2026-09-22: gemini-3.8-flash, quest 1 (size 2),
// leader 4. The old parser read every digit in the explanation and rejected it.
const GEMINI_TEAM_RAW =
  '1,4\n\n综合大家的发言，2号一直沉默没法评估，3号对我抱有戒心，那我这轮就顺应大家的意见，带上发言最理智、状态最积极的1号，加上我自己去执行任务。';

const FIVE = [1, 2, 3, 4, 5];

describe('parseTeamSelection', () => {
  it('takes the answer on the first line and ignores the explanation', () => {
    expect(parseTeamSelection(GEMINI_TEAM_RAW, FIVE, 2)).toEqual([1, 4]);
  });

  it.each([
    ['1,4', [1, 4]],
    ['1、4', [1, 4]],
    ['1 4', [1, 4]],
    ['1，4。', [1, 4]],
    ['玩家1,玩家4', [1, 4]],
    ['1号、4号', [1, 4]],
    ['- 1\n- 4\n\n理由：略', null],
    ['**1, 4**', [1, 4]],
    ['队伍：1、4', [1, 4]],
    ['我选择 1 和 4。因为 2号 太安静。', [1, 4]],
    ['1,3,3', [1, 3]],
    ['1, 2, 3, 4', null],
    ['7,8', null],
    ['', null],
  ])('%j -> %j (size 2)', (text: string, expected: number[] | null) => {
    expect(parseTeamSelection(text, FIVE, 2)).toEqual(expected);
  });

  it('skips a wrong-size run and accepts a later correct one', () => {
    expect(parseTeamSelection('候选：1,2,3\n最终：2,5', FIVE, 2)).toEqual([2, 5]);
  });

  it('handles size 3 with markdown and trailing text', () => {
    expect(parseTeamSelection('**2,3,5**\n\n3号很稳。', FIVE, 3)).toEqual([2, 3, 5]);
  });

  it('ignores ids outside the game', () => {
    expect(parseTeamSelection('0,1,4,9', FIVE, 2)).toEqual([1, 4]);
  });
});

describe('parseTargetSelection', () => {
  const GOOD = [1, 2, 3];

  it.each([
    ['3', 3],
    ['我刺杀 玩家2。因为1号太安静。', 2],
    ['**1**\n\n2号也可疑', 1],
    ['理由先说：3号说话像梅林。\n\n最终选择：3', 3],
    ['4', null],
    ['', null],
  ])('%j -> %j', (text: string, expected: number | null) => {
    expect(parseTargetSelection(text, GOOD)).toEqual(expected);
  });

  it('prefers the first line over a later mention', () => {
    expect(parseTargetSelection('2\n\n其实1号也有可能。', GOOD)).toBe(2);
  });
});
