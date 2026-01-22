'use client';

import { useGameStore } from '@/lib/game/store';
import { ROLES } from '@/lib/game/types';
import { Crown, User } from 'lucide-react';

export default function PlayerCircle() {
  const { gameState } = useGameStore();

  if (!gameState) return null;

  const { players, currentLeaderIndex, humanPlayerId, phase, currentProposedTeam } = gameState;
  const humanPlayer = players.find(p => p.id === humanPlayerId)!;

  // 计算圆形布局位置
  const getPosition = (index: number, total: number) => {
    const angle = (index * 360 / total) - 90; // 从顶部开始
    const radius = 38; // 百分比
    const x = 50 + radius * Math.cos(angle * Math.PI / 180);
    const y = 50 + radius * Math.sin(angle * Math.PI / 180);
    return { x, y };
  };

  return (
    <div className="relative aspect-square max-h-[600px] mx-auto bg-slate-800/30 rounded-full border border-slate-700">
      {/* 中心信息 */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="text-slate-400 text-sm mb-1">第 {gameState.currentQuest} 轮任务</div>
        <div className="text-white text-lg font-bold">
          {phase === 'discussion' && '💬 讨论中'}
          {phase === 'team_building' && '👥 组建队伍'}
          {phase === 'team_vote' && '🗳️ 投票中'}
          {phase === 'quest' && '⚔️ 执行任务'}
          {phase === 'assassination' && '🗡️ 刺杀阶段'}
          {phase === 'role_reveal' && '🎭 查看身份'}
          {phase === 'game_over' && '🏆 游戏结束'}
        </div>
        {gameState.consecutiveRejects > 0 && (
          <div className="text-red-400 text-sm mt-1">
            否决次数: {gameState.consecutiveRejects}/5
          </div>
        )}
      </div>

      {/* 玩家节点 */}
      {players.map((player, index) => {
        const pos = getPosition(index, players.length);
        const isLeader = index === currentLeaderIndex;
        const isHuman = player.id === humanPlayerId;
        const isOnTeam = currentProposedTeam?.includes(player.id);
        const role = player.role ? ROLES[player.role] : null;

        return (
          <div
            key={player.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            {/* 玩家卡片 */}
            <div className={`
              relative p-3 rounded-xl text-center transition-all w-24
              ${isHuman 
                ? 'bg-amber-500/20 border-2 border-amber-500' 
                : 'bg-slate-700/50 border border-slate-600'
              }
              ${isOnTeam ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900' : ''}
            `}>
              {/* 队长标记 */}
              {isLeader && (
                <div className="absolute -top-2 -right-2 bg-yellow-500 rounded-full p-1">
                  <Crown className="w-3 h-3 text-yellow-900" />
                </div>
              )}

              {/* 头像 */}
              <div className={`
                w-12 h-12 mx-auto rounded-full flex items-center justify-center text-2xl
                ${isHuman ? 'bg-amber-500/30' : 'bg-slate-600'}
              `}>
                {isHuman ? '👤' : (player.aiModel ? '🤖' : '❓')}
              </div>

              {/* 第一行：代号 */}
              <div className={`text-sm font-bold mt-1 ${isHuman ? 'text-amber-300' : 'text-white'}`}>
                {isHuman ? '你' : `玩家${player.id}`}
              </div>

              {/* 第二行：模型名称 */}
              <div
                className="text-xs truncate"
                style={{ color: isHuman ? '#FCD34D' : (player.aiModel?.color || '#94A3B8') }}
              >
                {isHuman ? '人类玩家' : player.aiModel?.name || 'AI'}
              </div>

              {/* 角色（只显示自己的，游戏结束时显示所有） */}
              {role && (isHuman || phase === 'game_over') && (
                <div className={`text-xs mt-0.5 ${role.team === 'good' ? 'text-blue-400' : 'text-red-400'}`}>
                  {role.emoji} {role.name}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}