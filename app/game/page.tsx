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
import HistoryPanel from '@/components/Game/HistoryPanel';
import AssassinFloatingButton from '@/components/Game/AssassinFloatingButton';
import VisionPanel from '@/components/Game/VisionPanel';

export default function GamePage() {
  const router = useRouter();
  const hydrated = useHydration();
  const { gameState } = useGameStore();

  useEffect(() => {
    console.log('[GamePage] hydrated:', hydrated, 'gameState:', gameState ? '存在' : '空');
  }, [hydrated, gameState]);

  useEffect(() => {
    if (hydrated && !gameState) {
      console.log('[GamePage] 没有游戏状态，跳转到首页');
      router.push('/');
    }
  }, [hydrated, gameState, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">正在初始化...</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
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
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-[1600px] mx-auto">
        {/* 顶部状态栏 */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-amber-400">🏰 AI 阿瓦隆</h1>
          <div className="flex items-center gap-4">
            {/* 当前轮次和投票次数 */}
            <div className="text-sm text-slate-300 bg-slate-800/50 px-3 py-1 rounded-lg">
              任务 {gameState.currentQuest}/5 · 投票 {gameState.consecutiveRejects + 1}/5
            </div>
            <QuestTracker />
          </div>
        </div>

        {/* 三栏布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* ========== 左侧：信息展示面板 ========== */}
          <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
            {/* 特殊视野面板 */}
            <VisionPanel />

            {/* 历史记录面板 */}
            <HistoryPanel />

            {/* 任务执行结果（只在quest阶段后显示） */}
            {gameState.phase === 'quest' && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                <h3 className="text-amber-400 font-bold mb-2">⚔️ 任务执行中</h3>
                <p className="text-slate-400 text-sm">
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
          <div className="lg:col-span-4 space-y-4 order-3">
            {/* 当前阶段操作面板 */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 min-h-[280px]">
              {renderPhasePanel()}
            </div>

            {/* 游戏日志 */}
            <GameLog />
          </div>
        </div>
      </div>

      {/* 刺客浮动按钮 */}
      <AssassinFloatingButton />
    </main>
  );
}