'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/game/store';
import { ROLES } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Loader2, Target } from 'lucide-react';

export default function AssassinationPanel() {
  const { gameState, assassinate } = useGameStore();
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [isAIAssassinating, setIsAIAssassinating] = useState(false);

  if (!gameState) return null;

  const { players, humanPlayerId } = gameState;
  const assassin = players.find(p => p.role === 'assassin')!;
  const isHumanAssassin = assassin.id === humanPlayerId;
  const goodPlayers = players.filter(p => ROLES[p.role!].team === 'good');

  // AI刺客选择
  useEffect(() => {
    if (isHumanAssassin) return;

    const aiAssassinate = async () => {
      setIsAIAssassinating(true);

      try {
        const response = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameState,
            playerId: assassin.id,
            action: 'assassination',
          }),
        });

        const data = await response.json();
        const targetId = data.targetId || goodPlayers[0].id;

        await new Promise(resolve => setTimeout(resolve, 2000));
        assassinate(targetId);
      } catch (error) {
        console.error('AI Assassination Error:', error);
        const randomTarget = goodPlayers[Math.floor(Math.random() * goodPlayers.length)];
        assassinate(randomTarget.id);
      } finally {
        setIsAIAssassinating(false);
      }
    };

    const timer = setTimeout(aiAssassinate, 1500);
    return () => clearTimeout(timer);
  }, [isHumanAssassin]);

  const handleAssassinate = () => {
    if (selectedTarget) {
      assassinate(selectedTarget);
    }
  };

  // AI刺客正在选择
  if (!isHumanAssassin) {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold text-red-400">🗡️ 刺杀阶段</h2>
        <div className="py-8">
          <div className="text-6xl mb-4">⚔️</div>
          <p className="text-slate-300">
            好人完成了 3 个任务！
          </p>
          <p className="text-slate-300 mt-2">
            但刺客 <span className="text-red-400">{assassin.name}</span> 有最后一次机会...
          </p>
          {isAIAssassinating && (
            <div className="mt-4">
              <Loader2 className="w-8 h-8 animate-spin text-red-400 mx-auto mb-2" />
              <p className="text-slate-400">正在选择刺杀目标...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 人类刺客选择
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-red-400">🗡️ 你是刺客！</h2>

      <div className="p-4 bg-red-900/20 rounded-lg border border-red-800">
        <p className="text-slate-300 text-sm">
          好人完成了 3 个任务，但你有最后一次机会！
        </p>
        <p className="text-red-300 text-sm mt-2">
          如果你能正确刺杀梅林，邪恶阵营将逆转获胜！
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-slate-400 text-sm">选择你认为是梅林的玩家:</div>
        {goodPlayers.map(player => (
          <button
            key={player.id}
            onClick={() => setSelectedTarget(player.id)}
            className={`
              w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left
              ${selectedTarget === player.id
                ? 'bg-red-500/30 border-2 border-red-500'
                : 'bg-slate-700/50 hover:bg-slate-700 border-2 border-transparent'
              }
            `}
          >
            <Target className={`w-5 h-5 ${selectedTarget === player.id ? 'text-red-400' : 'text-slate-500'}`} />
            <span className="text-xl">{player.id === humanPlayerId ? '👤' : '🤖'}</span>
            <div className="flex flex-col">
              <span className="text-white font-medium">
                {player.id === humanPlayerId ? '你' : `玩家${player.id}`}
              </span>
              <span className="text-xs text-slate-400">
                {player.id === humanPlayerId ? '人类玩家' : player.aiModel?.name || 'AI'}
              </span>
            </div>
          </button>
        ))}
      </div>

      <Button
        onClick={handleAssassinate}
        disabled={!selectedTarget}
        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50"
      >
        <Target className="w-4 h-4 mr-2" />
        确认刺杀
      </Button>
    </div>
  );
}