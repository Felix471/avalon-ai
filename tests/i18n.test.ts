import { describe, expect, it } from 'vitest';
import { t } from '@/lib/i18n';
import { en, zh } from '@/lib/i18n/strings';

describe('i18n', () => {
  it('has exactly the same keys in Chinese and English', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it('interpolates placeholders', () => {
    expect(t('zh-CN', 'player.label', { id: 3 })).toBe('玩家3');
    expect(t('en', 'player.label', { id: 3 })).toBe('Player 3');
  });

  it('keeps default-locale strings used by end-to-end tests', () => {
    expect(zh['transcript.passed']).toBe('投票通过');
    expect(zh['transcript.rejected']).toBe('投票否决');
    expect(zh['gameOver.won']).toContain('你赢了');
    expect(zh['gameOver.lost']).toContain('你输了');
    expect(t('zh-CN', 'team.humanLeader', { count: 2 })).toContain('选择 2 名队员');
    expect(`${t('zh-CN', 'game.settingsDiscussionRounds')}1`).toBe('讨论轮数：1');
  });
});
