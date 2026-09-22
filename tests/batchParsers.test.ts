import { describe, expect, it } from 'vitest';
import { parseAndValidateTeam, parseTargetId } from '@/scripts/batchParsers';
import { ROLES } from '@/lib/game/types';
import { makeState } from './helpers';

describe('parseAndValidateTeam', () => {
  it('parses a correctly sized team', () => {
    expect(parseAndValidateTeam('1,3', makeState(), 1)).toEqual({
      team: [1, 3],
      wasFallback: false,
    });
  });

  it('deduplicates player ids', () => {
    expect(parseAndValidateTeam('1, 3, 3', makeState(), 1)).toEqual({
      team: [1, 3],
      wasFallback: false,
    });
  });

  it('falls back to a valid team containing the leader for out-of-range ids', () => {
    const result = parseAndValidateTeam('7,8', makeState(), 2);

    expect(result.wasFallback).toBe(true);
    expect(result.team).toHaveLength(2);
    expect(new Set(result.team).size).toBe(2);
    expect(result.team).toContain(2);
    expect(result.team.every(id => id >= 1 && id <= 5)).toBe(true);
  });

  it('falls back from empty output and includes the leader', () => {
    const result = parseAndValidateTeam('', makeState(), 4);

    expect(result.wasFallback).toBe(true);
    expect(result.team).toHaveLength(2);
    expect(result.team).toContain(4);
  });

  it('truncates an oversized team to the required size', () => {
    const result = parseAndValidateTeam('1,2,3,4', makeState(), 1);

    expect(result.wasFallback).toBe(true);
    expect(result.team).toEqual([1, 2]);
  });
});

describe('parseTargetId', () => {
  it('accepts a good player target', () => {
    expect(parseTargetId('3', makeState())).toEqual({
      targetId: 3,
      wasFallback: false,
    });
  });

  it('falls back from an evil player target to a good player', () => {
    const state = makeState();
    const result = parseTargetId('4', state);
    const target = state.players.find(player => player.id === result.targetId);

    expect(result.wasFallback).toBe(true);
    expect(target?.role && ROLES[target.role].team).toBe('good');
  });

  it('falls back from an unparseable target', () => {
    const result = parseTargetId('no idea', makeState());

    expect(result.wasFallback).toBe(true);
    expect([1, 2, 3]).toContain(result.targetId);
  });
});
