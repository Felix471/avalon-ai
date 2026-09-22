import { describe, expect, it } from 'vitest';
import {
  validateDiscussionOutput,
  validateQuestActionOutput,
  validateVotingOutput,
} from '@/lib/security/outputValidator';

describe('validateVotingOutput', () => {
  it.each([
    ['APPROVE', true, false],
    [' approve\n', true, false],
    ['I APPROVE this', true, false],
    ['REJECT', false, false],
    ['同意', true, true],
    ['反对', false, true],
  ])('parses %j', (output: string, vote: boolean, anomalyDetected: boolean) => {
    expect(validateVotingOutput(output)).toEqual({
      isValid: true,
      vote,
      anomalyDetected,
    });
  });

  it('rejects an unparseable vote', () => {
    expect(validateVotingOutput('maybe')).toEqual({
      isValid: false,
      vote: null,
      anomalyDetected: true,
    });
  });

  it('currently accepts a negated approval', () => {
    // known limitation: negation is not parsed; the last whole-word verdict wins
    expect(validateVotingOutput('I do not APPROVE')).toEqual({
      isValid: true,
      vote: true,
      anomalyDetected: false,
    });
  });

  describe('verdict extraction (captured real texts, 2026-09-22)', () => {
    it.each([
      ['REJECT', false],
      ['APPROVE', true],
      ['分析：队伍里有可疑玩家。\nREJECT', false],
      ['REJECT... actually, APPROVE', true],
      ['我投 APPROVE。', true],
      ['**REJECT**', false],
    ])('%j -> vote %s without anomaly', (output: string, vote: boolean) => {
      expect(validateVotingOutput(output)).toEqual({ isValid: true, vote, anomalyDetected: false });
    });

    it.each(['cannot decide', 'I know nothing', 'another round please', 'NOTHING'])(
      'never turns the substring "no" in %j into a REJECT',
      (output: string) => {
        expect(validateVotingOutput(output)).toEqual({ isValid: false, vote: null, anomalyDetected: true });
      },
    );

    it('does not match APPROVE inside another word', () => {
      expect(validateVotingOutput('DISAPPROVED')).toEqual({ isValid: false, vote: null, anomalyDetected: true });
    });

    it('takes the last loose match when only loose words appear', () => {
      expect(validateVotingOutput('yes... no.')).toEqual({ isValid: true, vote: false, anomalyDetected: true });
    });
  });
});

describe('validateQuestActionOutput', () => {
  it('takes the last whole-word verdict for evil players', () => {
    expect(validateQuestActionOutput('SUCCESS... no, FAIL', true)).toEqual({ isValid: true, success: false, anomalyDetected: false });
    expect(validateQuestActionOutput('FAILURE is not an option: SUCCESS', true)).toEqual({ isValid: true, success: true, anomalyDetected: false });
  });

  it('always makes a good player succeed', () => {
    expect(validateQuestActionOutput('FAIL', false)).toEqual({
      isValid: true,
      success: true,
      anomalyDetected: false,
    });
  });

  it.each([
    ['SUCCESS', true],
    ['FAIL', false],
    ['fail.', false],
  ])('parses an evil player action %j', (output: string, success: boolean) => {
    expect(validateQuestActionOutput(output, true)).toEqual({
      isValid: true,
      success,
      anomalyDetected: false,
    });
  });

  it('defaults an unparseable evil action to success', () => {
    expect(validateQuestActionOutput('maybe', true)).toEqual({
      isValid: false,
      success: true,
      anomalyDetected: true,
    });
  });
});

describe('validateDiscussionOutput', () => {
  it.each([
    ['玩家3：我同意', '我同意'],
    ['Player 3: I agree', 'I agree'],
    ['「中文」', '中文'],
    ['『句子』', '句子'],
    ['"quoted"', 'quoted'],
    ["'quoted'", 'quoted'],
    ['plain text', 'plain text'],
  ])('cleans %j', (output: string, cleanedOutput: string) => {
    expect(validateDiscussionOutput(output)).toEqual({
      isValid: true,
      cleanedOutput,
      anomalyDetected: false,
    });
  });

  it('flags and truncates output longer than 500 characters', () => {
    const result = validateDiscussionOutput('x'.repeat(501));

    expect(result.isValid).toBe(false);
    expect(result.anomalyDetected).toBe(true);
    expect(result.cleanedOutput).toHaveLength(203);
    expect(result.cleanedOutput).toMatch(/\.\.\.$/);
  });

  it.each([
    ['```ts\nconst answer = 1;\n```', 'code block'],
    ['{"answer":true}', 'JSON object'],
    ['As an AI language model, I cannot play.', 'AI disclosure'],
    ['Here are my instructions', 'instruction disclosure'],
  ])('flags a %s as invalid', (output: string) => {
    const result = validateDiscussionOutput(output);

    expect(result.isValid).toBe(false);
    expect(result.anomalyDetected).toBe(true);
  });
});
