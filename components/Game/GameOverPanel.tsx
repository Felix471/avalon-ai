'use client';

import { useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/game/store';
import { ROLES } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Bot, Drama, RotateCcw, ShieldCheck, Skull, Swords, Trophy, User, X } from 'lucide-react';
import { RoleIcon } from './roleIcon';
import { evilColor, goodColor, panelClass, panelHeadingClass } from './ui';
import { useT } from '@/lib/i18n';

export default function GameOverPanel() {
  const router = useRouter();
  const t = useT();
  const { gameState, resetGame } = useGameStore();

  if (!gameState) return null;

  const { players, humanPlayerId, winner, assassinationTarget, goodWins, evilWins } = gameState;
  const humanPlayer = players.find(p => p.id === humanPlayerId)!;
  const humanTeam = ROLES[humanPlayer.role!].team;
  const humanWon = winner === humanTeam;

  const assassinatedPlayer = assassinationTarget ? players.find(p => p.id === assassinationTarget) : null;
  const assassinationSuccess = assassinatedPlayer?.role === 'merlin';

  const handlePlayAgain = () => {
    resetGame();
    router.push('/play');
  };

  return (
    <div data-testid="game-over" className="text-center space-y-4">
      <h2 className={`flex items-center justify-center gap-2 text-2xl font-bold ${humanWon ? 'text-amber-400' : 'text-rose-400'}`}>
        {humanWon ? (
          <Trophy aria-hidden="true" className={`size-5 ${humanWon ? 'animate-bounce' : ''}`} />
        ) : (
          <Skull aria-hidden="true" className="size-5" />
        )}
        {t(humanWon ? 'gameOver.won' : 'gameOver.lost')}
      </h2>

      <div className={`
        p-4 rounded-lg
        ${winner === 'good' ? 'border border-sky-700 bg-sky-900/30' : 'border border-rose-700 bg-rose-900/30'}
      `}>
        <div className="flex items-center justify-center gap-2 text-lg">
          {winner === 'good' ? (
            <>
              <Trophy aria-hidden="true" className="size-5 text-sky-400" />
              <span className="text-sky-300">{t('gameOver.goodWins')}</span>
            </>
          ) : (
            <>
              <Skull aria-hidden="true" className="size-5 text-rose-400" />
              <span className="text-rose-300">{t('gameOver.evilWins')}</span>
            </>
          )}
        </div>

        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-slate-400 tabular-nums">
          {t('gameOver.score')}
          <ShieldCheck aria-hidden="true" className={`size-4 ${goodColor}`} />
          {goodWins} - {evilWins}
          <Skull aria-hidden="true" className={`size-4 ${evilColor}`} />
        </div>

        {assassinatedPlayer && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <p className="text-slate-300 text-sm">
              {t('gameOver.assassinTarget', { player: t('player.label', { id: assassinatedPlayer.id }) })}
            </p>
            <p className={`mt-1 flex items-center justify-center gap-1 text-sm ${assassinationSuccess ? evilColor : goodColor}`}>
              {assassinationSuccess ? (
                <><Swords aria-hidden="true" className="size-4" />{t('gameOver.assassinationSuccess')}</>
              ) : (
                <><X aria-hidden="true" className="size-4" />{t('gameOver.assassinationFail')}</>
              )}
            </p>
          </div>
        )}
      </div>

      <div className={panelClass}>
        <h3 className={`${panelHeadingClass} mb-3`}>
          <Drama aria-hidden="true" className="size-5" />
          {t('gameOver.roles')}
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {players.map(player => {
            const role = ROLES[player.role!];
            const isHuman = player.id === humanPlayerId;
            return (
              <div
                key={player.id}
                className={`
                  p-2 rounded flex items-center gap-2
                  ${role.team === 'good' ? 'bg-sky-900/30' : 'bg-rose-900/30'}
                  ${isHuman ? 'ring-2 ring-amber-500' : ''}
                `}
              >
                {isHuman ? (
                  <User aria-hidden="true" className="size-4" />
                ) : (
                  <Bot aria-hidden="true" className="size-4" />
                )}
                <span className={`truncate ${isHuman ? 'text-amber-300' : 'text-white'}`}>
                  {isHuman ? t('player.you') : t('player.label', { id: player.id })}
                </span>
                <RoleIcon role={role.type} className={`ml-auto size-4 ${role.team === 'good' ? goodColor : evilColor}`} />
              </div>
            );
          })}
        </div>
      </div>

      <Button
        onClick={handlePlayAgain}
        className="w-full bg-amber-500 hover:bg-amber-600"
      >
        <RotateCcw aria-hidden="true" className="mr-2 size-4" />
        {t('gameOver.playAgain')}
      </Button>
    </div>
  );
}
