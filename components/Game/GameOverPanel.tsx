'use client';

import { useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/game/store';
import { ROLES } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Trophy, Skull, RotateCcw } from 'lucide-react';

export default function GameOverPanel() {
  const router = useRouter();
  const { gameState, resetGame } = useGameStore();

  if (!gameState) return null;

  const { players, humanPlayerId, winner, assassinationTarget, goodWins, evilWins } = gameState;
  const humanPlayer = players.find(p => p.id === humanPlayerId)!;
  const humanTeam = ROLES[humanPlayer.role!].team;
  const humanWon = winner === humanTeam;

  const merlin = players.find(p => p.role === 'merlin')!;
  const assassinatedPlayer = assassinationTarget ? players.find(p => p.id === assassinationTarget) : null;
  const assassinationSuccess = assassinatedPlayer?.role === 'merlin';

  const handlePlayAgain = () => {
    resetGame();
    router.push('/play');
  };

  return (
    <div data-testid="game-over" className="text-center space-y-4">
      {/* 胜负结果 */}
      <div className={`text-6xl ${humanWon ? 'animate-bounce' : ''}`}>
        {humanWon ? '🎉' : '💀'}
      </div>

      <h2 className={`text-2xl font-bold ${humanWon ? 'text-amber-400' : 'text-red-400'}`}>
        {humanWon ? '你赢了！' : '你输了...'}
      </h2>

      <div className={`
        p-4 rounded-lg
        ${winner === 'good' ? 'bg-blue-900/30 border border-blue-700' : 'bg-red-900/30 border border-red-700'}
      `}>
        <div className="flex items-center justify-center gap-2 text-lg">
          {winner === 'good' ? (
            <>
              <Trophy className="w-6 h-6 text-blue-400" />
              <span className="text-blue-300">亚瑟阵营获胜！</span>
            </>
          ) : (
            <>
              <Skull className="w-6 h-6 text-red-400" />
              <span className="text-red-300">莫德雷德阵营获胜！</span>
            </>
          )}
        </div>

        {/* 任务比分 */}
        <div className="mt-2 text-slate-400 text-sm">
          任务比分: 😇 {goodWins} - {evilWins} 😈
        </div>

        {/* 刺杀结果 */}
        {assassinatedPlayer && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <p className="text-slate-300 text-sm">
              刺客选择刺杀: <span className="text-amber-400">{assassinatedPlayer.name}</span>
            </p>
            <p className={`text-sm mt-1 ${assassinationSuccess ? 'text-red-400' : 'text-blue-400'}`}>
              {assassinationSuccess
                ? '🗡️ 刺杀成功！梅林被找出！'
                : '❌ 刺杀失败！梅林安全了！'
              }
            </p>
          </div>
        )}
      </div>

      {/* 所有角色揭示 */}
      <div className="p-4 bg-slate-800/50 rounded-lg">
        <h3 className="text-white font-bold mb-3">🎭 身份揭晓</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {players.map(player => {
            const role = ROLES[player.role!];
            const isHuman = player.id === humanPlayerId;
            return (
              <div
                key={player.id}
                className={`
                  p-2 rounded flex items-center gap-2
                  ${role.team === 'good' ? 'bg-blue-900/30' : 'bg-red-900/30'}
                  ${isHuman ? 'ring-2 ring-amber-500' : ''}
                `}
              >
                <span>{isHuman ? '👤' : '🤖'}</span>
                <span className={`truncate ${isHuman ? 'text-amber-300' : 'text-white'}`}>
                  {player.name}
                </span>
                <span className={`ml-auto ${role.team === 'good' ? 'text-blue-400' : 'text-red-400'}`}>
                  {role.emoji}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Button
        onClick={handlePlayAgain}
        className="w-full bg-amber-500 hover:bg-amber-600"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        再来一局
      </Button>
    </div>
  );
}
