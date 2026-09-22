import type { GameEvent } from '@/lib/game/types';
import type { Locale } from './localeStore';
import { t } from './index';

function playerList(locale: Locale, value: unknown): string | null {
  if (!Array.isArray(value) || !value.every(id => typeof id === 'number')) return null;
  return value.map(id => t(locale, 'player.label', { id })).join(locale === 'en' ? ', ' : '、');
}

export function translateGameEvent(event: GameEvent, locale: Locale, questNumber?: number): string {
  const metadata = event.metadata;
  if (!metadata) return event.content;

  if (event.type === 'team_proposal') {
    const team = playerList(locale, metadata.team);
    if (!team) return event.content;
    return t(locale, metadata.forced === true ? 'event.forcedTeamProposal' : 'event.teamProposal', { team });
  }

  if (event.type === 'vote' && typeof metadata.approve === 'boolean') {
    return t(locale, metadata.approve ? 'event.voteApprove' : 'event.voteReject');
  }

  if (
    event.type === 'vote_result'
    && typeof metadata.approveCount === 'number'
    && typeof metadata.rejectCount === 'number'
    && typeof metadata.passed === 'boolean'
  ) {
    return t(locale, 'event.voteResult', {
      approveCount: metadata.approveCount,
      rejectCount: metadata.rejectCount,
      result: t(locale, metadata.passed ? 'event.resultPassed' : 'event.resultRejected'),
    });
  }

  if (
    event.type === 'quest_result'
    && typeof metadata.success === 'boolean'
    && typeof metadata.failCount === 'number'
  ) {
    return t(locale, 'event.questResult', {
      quest: questNumber ?? '',
      result: t(locale, metadata.success ? 'event.questSucceeded' : 'event.questFailed'),
      failCount: metadata.failCount,
    });
  }

  if (
    event.type === 'assassination'
    && typeof metadata.targetId === 'number'
    && typeof metadata.success === 'boolean'
  ) {
    return t(locale, 'event.assassination', {
      player: t(locale, 'player.label', { id: metadata.targetId }),
      result: t(locale, metadata.success ? 'event.assassinationSuccess' : 'event.assassinationFail'),
    });
  }

  return event.content;
}
