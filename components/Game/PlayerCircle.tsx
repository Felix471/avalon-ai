'use client';

import { useGameStore } from '@/lib/game/store';
import { ROLES } from '@/lib/game/types';
import {
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

export default function PlayerCircle() {
  const { gameState } = useGameStore();

  if (!gameState) return null;

  const { players, currentLeaderIndex, humanPlayerId, phase, currentProposedTeam } = gameState;

  const phaseDetails = {
    discussion: { icon: MessageCircle, label: '讨论中' },
    team_building: { icon: Target, label: '组建队伍' },
    team_vote: { icon: Vote, label: '投票中' },
    quest: { icon: Swords, label: '执行任务' },
    assassination: { icon: Swords, label: '刺杀阶段' },
    role_reveal: { icon: Drama, label: '查看身份' },
    game_over: { icon: Trophy, label: '游戏结束' },
    lobby: { icon: Target, label: '游戏大厅' },
  }[phase];
  const PhaseIcon = phaseDetails.icon;

  // 计算圆形布局位置
  const getPosition = (index: number, total: number) => {
    const angle = (index * 360 / total) - 90; // 从顶部开始
    const radius = 38; // 百分比
    const x = 50 + radius * Math.cos(angle * Math.PI / 180);
    const y = 50 + radius * Math.sin(angle * Math.PI / 180);
    return { x, y };
  };

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[600px] rounded-full border border-slate-700 bg-slate-800/30">
      {/* 中心信息 */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="mb-1 text-sm text-slate-400 tabular-nums">第 {gameState.currentQuest} 轮任务</div>
        <div className="flex items-center justify-center gap-2 text-base font-bold text-white sm:text-lg">
          <PhaseIcon aria-hidden="true" className="size-5" />
          <span>{phaseDetails.label}</span>
        </div>
        {gameState.consecutiveRejects > 0 && (
          <div className="mt-1 text-sm text-rose-400 tabular-nums">
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
              relative w-20 rounded-xl p-2 text-center transition-all sm:w-24 sm:p-3
              ${isHuman 
                ? 'bg-amber-500/20 border-2 border-amber-500' 
                : 'bg-slate-700/50 border border-slate-600'
              }
              ${isOnTeam ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-900' : ''}
            `}>
              {/* 队长标记 */}
              {isLeader && (
                <div className="absolute -top-2 -right-2 bg-yellow-500 rounded-full p-1">
                  <Crown aria-hidden="true" className="size-3 text-yellow-900" />
                </div>
              )}

              {/* 头像 */}
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

              {/* 第一行：代号 */}
              <div className={`mt-1 text-xs font-bold sm:text-sm ${isHuman ? 'text-amber-300' : 'text-white'}`}>
                {isHuman ? '你' : `玩家${player.id}`}
              </div>

              {/* 第二行：模型名称 */}
              <div
                className="truncate text-[10px] sm:text-xs"
                style={{ color: isHuman ? '#FCD34D' : (player.aiModel?.color || '#94A3B8') }}
              >
                {isHuman ? '人类玩家' : player.aiModel?.name || 'AI'}
              </div>

              {/* 角色（只显示自己的，游戏结束时显示所有） */}
              {role && (isHuman || phase === 'game_over') && (
                <div className={`mt-0.5 flex items-center justify-center gap-1 text-[10px] sm:text-xs ${role.team === 'good' ? goodColor : evilColor}`}>
                  <RoleIcon role={role.type} className="size-3" />
                  <span>{role.name}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
