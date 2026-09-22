import { describe, expect, it } from 'vitest';
import { proposeTeam, submitQuestAction, submitVote } from '@/lib/game/engine';
import { buildProposalHistory, buildQuestSections } from '@/lib/game/history';
import type { GameState } from '@/lib/game/types';
import { makeState } from './helpers';

function vote(state: GameState, approvals: boolean[]): GameState {
  return approvals.reduce(
    (current, approve, index) => submitVote(current, index + 1, approve),
    state,
  );
}

describe('buildProposalHistory', () => {
  it('reconstructs rejected and accepted proposals with their leaders and votes', () => {
    const firstProposal = proposeTeam(makeState({ phase: 'team_building' }), [1, 2]);
    const rejected = vote(firstProposal, [true, false, false, false, true]);
    const secondProposal = proposeTeam(rejected, [2, 3]);
    const accepted = vote(secondProposal, [true, true, true, false, false]);

    expect(buildProposalHistory(accepted)).toMatchObject([
      {
        questNumber: 1,
        proposalIndex: 1,
        leaderId: 1,
        team: [1, 2],
        votes: { 1: true, 2: false, 3: false, 4: false, 5: true },
        forced: false,
        passed: false,
      },
      {
        questNumber: 1,
        proposalIndex: 2,
        leaderId: 2,
        team: [2, 3],
        votes: { 1: true, 2: true, 3: true, 4: false, 5: false },
        forced: false,
        passed: true,
      },
    ]);
  });

  it('records a forced fifth proposal as passed without votes', () => {
    const state = proposeTeam(
      makeState({ phase: 'team_building', consecutiveRejects: 4 }),
      [1, 2],
    );

    expect(buildProposalHistory(state)).toMatchObject([
      {
        proposalIndex: 1,
        forced: true,
        passed: true,
        votes: {},
      },
    ]);
  });
});

describe('buildQuestSections', () => {
  it('sets the resolved result and fail count before starting the next section', () => {
    let state = vote(
      proposeTeam(makeState({ phase: 'team_building' }), [1, 2]),
      [true, true, true, false, false],
    );
    state = submitQuestAction(state, 1, true);
    state = submitQuestAction(state, 2, false);

    const sections = buildQuestSections(state);

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ questNumber: 1, result: 'fail', failCount: 1 });
    expect(sections[0].events.at(-1)?.type).toBe('quest_result');
    expect(sections[1]).toMatchObject({ questNumber: 2, proposals: [], events: [] });
  });

  it('does not report a pending quest as failed', () => {
    const [section] = buildQuestSections(makeState());

    expect(section.questNumber).toBe(1);
    expect(section.result).toBeUndefined();
    expect(section.failCount).toBeUndefined();
  });
});
