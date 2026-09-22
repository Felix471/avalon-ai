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
    // known limitation
    expect(validateVotingOutput('I do not APPROVE')).toEqual({
      isValid: true,
      vote: true,
      anomalyDetected: false,
    });
  });
});

describe('validateQuestActionOutput', () => {
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
