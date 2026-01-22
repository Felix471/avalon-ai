'use client';

import { useGameStore } from '@/lib/game/store';
import { getPlayerVision } from '@/lib/game/engine';
import { ROLES } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Swords } from 'lucide-react';

export default function RoleReveal() {
  const { gameState, setPhase } = useGameStore();

  if (!gameState) return null;

  const humanPlayer = gameState.players.find(p => p.id === gameState.humanPlayerId)!;
  const role = ROLES[humanPlayer.role!];
  const vision = getPlayerVision(gameState, humanPlayer.id);
  const isAssassin = humanPlayer.role === 'assassin';
  const assassinAnytime = gameState.variantRules?.assassinAnytime;

  const handleContinue = () => {
    setPhase('discussion');
  };

  return (
    <div className="text-center space-y-4">
      <h2 className="text-xl font-bold text-white">🎭 你的身份</h2>

      {/* 角色卡片 */}
      <div className={`
        p-6 rounded-xl border-2
        ${role.team === 'good' 
          ? 'bg-blue-900/30 border-blue-500' 
          : 'bg-red-900/30 border-red-500'
        }
      `}>
        <div className="text-5xl mb-2">{role.emoji}</div>
        <div className={`text-2xl font-bold ${role.team === 'good' ? 'text-blue-400' : 'text-red-400'}`}>
          {role.name}
        </div>
        <div className="text-slate-400 text-sm mt-2">
          {role.team === 'good' ? '😇 亚瑟阵营（好人）' : '😈 莫德雷德阵营（坏人）'}
        </div>
        <div className="text-slate-300 text-sm mt-3 leading-relaxed">
          {role.description}
        </div>
      </div>

      {/* 特殊视野信息 */}
      {vision.knownEvil.length > 0 && (
        <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-500">
          <div className="text-purple-400 font-medium mb-2">👁️ 你看到的邪恶玩家：</div>
          <div className="flex flex-wrap gap-2 justify-center">
            {vision.knownEvil.map(id => {
              const p = gameState.players.find(pl => pl.id === id)!;
              return (
                <span key={id} className="px-2 py-1 bg-red-900/50 rounded text-red-300 text-sm">
                  玩家{id} ({p.aiModel?.name || '人类'})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {vision.knownMerlinOrMorgana.length > 0 && (
        <div className="p-4 bg-cyan-900/30 rounded-lg border border-cyan-500">
          <div className="text-cyan-400 font-medium mb-2">👁️ 梅林或莫甘娜（你需要分辨）：</div>
          <div className="flex flex-wrap gap-2 justify-center">
            {vision.knownMerlinOrMorgana.map(id => {
              const p = gameState.players.find(pl => pl.id === id)!;
              return (
                <span key={id} className="px-2 py-1 bg-cyan-900/50 rounded text-cyan-300 text-sm">
                  玩家{id} ({p.aiModel?.name || '人类'})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {vision.teammates.length > 0 && (
        <div className="p-4 bg-red-900/30 rounded-lg border border-red-500">
          <div className="text-red-400 font-medium mb-2">🤝 你的邪恶同伴：</div>
          <div className="flex flex-wrap gap-2 justify-center">
            {vision.teammates.map(id => {
              const p = gameState.players.find(pl => pl.id === id)!;
              const r = ROLES[p.role!];
              return (
                <span key={id} className="px-2 py-1 bg-red-900/50 rounded text-red-300 text-sm">
                  玩家{id} ({r.name})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 刺客随时开刀提示 */}
      {isAssassin && assassinAnytime && (
        <div className="p-4 bg-gradient-to-r from-red-900/40 to-orange-900/40 rounded-lg border border-red-500">
          <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
            <Swords className="w-5 h-5" />
            特殊规则：随时开刀
          </div>
          <div className="text-red-200/80 text-sm">
            本局开启了「随时开刀」规则！你可以在游戏任何时候点击右下角的刺客按钮来刺杀梅林，无需等待好人赢得3个任务。
          </div>
        </div>
      )}

      <Button
        onClick={handleContinue}
        className="w-full bg-amber-500 hover:bg-amber-600"
      >
        确认，开始游戏 →
      </Button>
    </div>
  );
}