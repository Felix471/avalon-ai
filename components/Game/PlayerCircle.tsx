'use client';

import { useGameStore } from '@/lib/game/store';
import { ROLES } from '@/lib/game/types';
import {
  AlertTriangle,
  Bot,
  Crown,
  Drama,
  MessageCircle,
  Swords,
  Target,
  Trophy,
  User,
  Vote,
} from 'lucide-react';
import { RoleIcon } from './roleIcon';
import { evilColor, goodColor } from './ui';
import { useT, type TranslationKey } from '@/lib/i18n';

export default function PlayerCircle() {
  const t = useT();
  const { gameState, seatStatus } = useGameStore();

  if (!gameState) return null;

  const { players, currentLeaderIndex, humanPlayerId, phase, currentProposedTeam } = gameState;

  const phaseDetailsByPhase: Record<typeof phase, { icon: typeof Target; label: TranslationKey }> = {
    discussion: { icon: MessageCircle, label: 'game.phase.discussion' },
    team_building: { icon: Target, label: 'game.phase.teamBuilding' },
    team_vote: { icon: Vote, label: 'game.phase.teamVote' },
    quest: { icon: Swords, label: 'game.phase.quest' },
    assassination: { icon: Swords, label: 'game.phase.assassination' },
    role_reveal: { icon: Drama, label: 'game.phase.roleReveal' },
    game_over: { icon: Trophy, label: 'game.phase.gameOver' },
    lobby: { icon: Target, label: 'game.phase.lobby' },
  };
  const phaseDetails = phaseDetailsByPhase[phase];
  const PhaseIcon = phaseDetails.icon;

  const getPosition = (index: number, total: number) => {
    const angle = (index * 360 / total) - 90;
    const radius = 38;
    const x = 50 + radius * Math.cos(angle * Math.PI / 180);
    const y = 50 + radius * Math.sin(angle * Math.PI / 180);
    return { x, y };
  };

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[600px] rounded-full border border-slate-700 bg-slate-800/30">
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="mb-1 text-sm text-slate-400 tabular-nums">{t('game.questRound', { quest: gameState.currentQuest })}</div>
        <div className="flex items-center justify-center gap-2 text-base font-bold text-white sm:text-lg">
          <PhaseIcon aria-hidden="true" className="size-5" />
          <span>{t(phaseDetails.label)}</span>
        </div>
        {gameState.consecutiveRejects > 0 && (
          <div className="mt-1 text-sm text-rose-400 tabular-nums">
            {t('game.rejectCount', { count: gameState.consecutiveRejects })}
          </div>
        )}
      </div>

      {players.map((player, index) => {
        const pos = getPosition(index, players.length);
        const isLeader = index === currentLeaderIndex;
        const isHuman = player.id === humanPlayerId;
        const isOnTeam = currentProposedTeam?.includes(player.id);
        const role = player.role ? ROLES[player.role] : null;
        const playerSeatStatus = seatStatus[player.id];

        return (
          <div
            key={player.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div className={`
              relative w-20 rounded-xl p-2 text-center transition-all sm:w-24 sm:p-3
              ${isHuman 
                ? 'bg-amber-500/20 border-2 border-amber-500' 
                : 'bg-slate-700/50 border border-slate-600'
              }
              ${isOnTeam ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-900' : ''}
              ${playerSeatStatus?.state === 'thinking' ? 'ring-2 ring-amber-300/40 animate-pulse' : ''}
            `}>
              {isLeader && (
                <div className="absolute -top-2 -right-2 bg-yellow-500 rounded-full p-1">
                  <Crown aria-hidden="true" className="size-3 text-yellow-900" />
                </div>
              )}

              {playerSeatStatus?.state === 'error' && (
                <div className="absolute -top-2 -left-2 rounded-full bg-rose-950 p-1">
                  <AlertTriangle aria-hidden="true" className="size-3 text-rose-400" />
                </div>
              )}

              <div className={`
                mx-auto flex size-10 items-center justify-center rounded-full sm:size-12
                ${isHuman ? 'bg-amber-500/30' : 'bg-slate-600'}
              `}>
                {isHuman ? (
                  <User aria-hidden="true" className="size-5 sm:size-6" />
                ) : (
                  <Bot aria-hidden="true" className="size-5 sm:size-6" />
                )}
              </div>

              <div className={`mt-1 text-xs font-bold sm:text-sm ${isHuman ? 'text-amber-300' : 'text-white'}`}>
                {isHuman ? t('player.you') : t('player.label', { id: player.id })}
              </div>

              <div
                className="truncate text-[10px] sm:text-xs"
                style={{ color: isHuman ? '#FCD34D' : (player.aiModel?.color || '#94A3B8') }}
              >
                {isHuman ? t('common.humanPlayer') : player.aiModel?.name || t('common.ai')}
              </div>

              {role && (isHuman || phase === 'game_over') && (
                <div className={`mt-0.5 flex items-center justify-center gap-1 text-[10px] sm:text-xs ${role.team === 'good' ? goodColor : evilColor}`}>
                  <RoleIcon role={role.type} className="size-3" />
                  <span>{t(`role.${role.type}.name`)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
