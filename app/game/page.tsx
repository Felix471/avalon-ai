'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore, useHydration } from '@/lib/game/store';
import PlayerCircle from '@/components/Game/PlayerCircle';
import RoleReveal from '@/components/Game/RoleReveal';
import DiscussionPanel from '@/components/Game/DiscussionPanel';
import TeamBuildingPanel from '@/components/Game/TeamBuildingPanel';
import VotingPanel from '@/components/Game/VotingPanel';
import QuestPanel from '@/components/Game/QuestPanel';
import AssassinationPanel from '@/components/Game/AssassinationPanel';
import GameOverPanel from '@/components/Game/GameOverPanel';
import QuestTracker from '@/components/Game/QuestTracker';
import GameLog from '@/components/Game/GameLog';
import VoteMatrix from '@/components/Game/VoteMatrix';
import Transcript from '@/components/Game/Transcript';
import AssassinFloatingButton from '@/components/Game/AssassinFloatingButton';
import VisionPanel from '@/components/Game/VisionPanel';
import { ExitGameButton } from '@/components/Game/ExitGameButton';
import { panelClass, panelHeadingClass, subtleTextClass } from '@/components/Game/ui';
import { ScrollText, Swords } from 'lucide-react';

export default function GamePage() {
  const router = useRouter();
  const hydrated = useHydration();
  const { gameState } = useGameStore();

  useEffect(() => {
    if (hydrated && !gameState) {
      router.push('/play');
    }
  }, [hydrated, gameState, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
        <div className="text-white text-xl">正在初始化...</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
        <div className="text-white text-xl">正在跳转到大厅...</div>
      </div>
    );
  }

  // 判断当前阶段是否需要玩家输入
  const isInteractivePhase = ['discussion', 'team_building', 'team_vote', 'quest', 'assassination'].includes(gameState.phase);

  const renderPhasePanel = () => {
    switch (gameState.phase) {
      case 'role_reveal':
        return <RoleReveal />;
      case 'discussion':
        return <DiscussionPanel />;
      case 'team_building':
        return <TeamBuildingPanel />;
      case 'team_vote':
        return <VotingPanel />;
      case 'quest':
        return <QuestPanel />;
      case 'assassination':
        return <AssassinationPanel />;
      case 'game_over':
        return <GameOverPanel />;
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="max-w-[1600px] mx-auto">
        {/* 顶部状态栏 */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Logo 和 标题 */}
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="AI 阿瓦隆"
              className="w-10 h-10 rounded-lg object-cover"
            />
            <h1 className="text-2xl font-bold text-amber-400">AI 阿瓦隆</h1>
          </div>

          <div className="ml-auto flex basis-full flex-wrap items-center justify-end gap-2 sm:basis-auto sm:gap-4">
            {/* 当前轮次和投票次数 */}
            <div className="rounded-lg bg-slate-800/50 px-3 py-1 text-sm text-slate-300 tabular-nums">
              任务 {gameState.currentQuest}/5 · 投票 {gameState.consecutiveRejects + 1}/5
            </div>
            <div className="order-last flex basis-full justify-end sm:order-none sm:basis-auto">
              <QuestTracker />
            </div>
            <ExitGameButton />
          </div>
        </div>

        {/* 三栏布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* ========== 左侧：信息展示面板 ========== */}
          <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
            {/* 特殊视野面板 */}
            <VisionPanel />

            {/* 历史记录面板 */}
            <VoteMatrix />

            {/* 任务执行结果（只在quest阶段后显示） */}
            {gameState.phase === 'quest' && (
              <div className={panelClass}>
                <h3 className={`${panelHeadingClass} mb-2 text-amber-400`}>
                  <Swords aria-hidden="true" className="size-5" />
                  任务执行中
                </h3>
                <p className={subtleTextClass}>
                  队伍正在执行任务，等待所有队员完成行动...
                </p>
              </div>
            )}
          </div>

          {/* ========== 中间：玩家圆环 ========== */}
          <div className="lg:col-span-5 order-1 lg:order-2">
            <PlayerCircle />
          </div>

          {/* ========== 右侧：玩家交互面板 ========== */}
          <div data-testid="phase-panel" className="order-3 flex flex-col gap-4 lg:col-span-4">
            {/* 当前阶段操作面板 */}
            <div className={`${panelClass} min-h-[280px]`}>
              {renderPhasePanel()}
            </div>

            <Transcript />

            {/* 游戏日志 */}
            <details>
              <summary className={`${panelClass} flex cursor-pointer list-none items-center gap-2 text-sm text-slate-300`}>
                <ScrollText aria-hidden="true" className="size-4" />
                完整记录（按时间）
              </summary>
              <div className="mt-2">
                <GameLog />
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* 刺客浮动按钮 */}
      <AssassinFloatingButton />
    </main>
  );
}
