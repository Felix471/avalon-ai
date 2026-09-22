'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore, useHydration } from '@/lib/game/store';
import { AI_MODELS, type VariantRules } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Users, Play, Bot, Info, AlertCircle, Trash2, ArrowRight
} from 'lucide-react';

// ==================== 大厅主组件 ====================

function LobbyContent() {
  const router = useRouter();
  const [startError, setStartError] = useState<string | null>(null);
  // 添加 gameState 和 resetGame 用于恢复/重置游戏
  const { config, updateConfig, startGame, gameState, resetGame } = useGameStore();
  // 添加 hydration 检查
  const hydrated = useHydration();

  const handlePlayerCountChange = (count: number) => {
    updateConfig({ playerCount: count });
  };

  const handleModelToggle = (modelId: string) => {
    const newModels = config.enabledModels.includes(modelId)
      ? config.enabledModels.filter(id => id !== modelId)
      : [...config.enabledModels, modelId];
    updateConfig({ enabledModels: newModels });
    setStartError(null);
  };

  const handleVariantChange = (key: keyof VariantRules, value: VariantRules[keyof VariantRules]) => {
    updateConfig({
      variantRules: { ...config.variantRules, [key]: value }
    });
  };

  const handleStartGame = () => {
    if (config.enabledModels.length < 2) {
      setStartError('请至少选择 2 个 AI 模型');
      return;
    }

    startGame();
    router.push('/game');
  };

  // 检测是否有进行中的游戏
  const hasActiveGame = hydrated && gameState && gameState.phase !== 'game_over';

  const playerCounts = [5, 6, 7, 8, 9, 10];

  return (
    <div className="min-h-screen bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-4 mb-2">
            <img
              src="/logo.jpg"
              alt="AI 阿瓦隆"
              className="w-12 h-12 rounded-lg object-cover"
            />
            <h1 className="text-4xl font-bold text-amber-400">AI 阿瓦隆</h1>
          </div>
          <p className="text-slate-400">与多个 AI 模型一起玩阿瓦隆桌游</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 左侧：玩家人数 */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              玩家人数
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {playerCounts.map(count => (
                <button
                  key={count}
                  data-testid={`lobby-player-count-${count}`}
                  onClick={() => handlePlayerCountChange(count)}
                  className={`
                    py-3 px-4 rounded-lg font-medium transition-all
                    ${config.playerCount === count
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }
                  `}
                >
                  {count} 人
                </button>
              ))}
            </div>
            <p className="text-slate-500 text-sm mt-3">
              你将作为其中一名玩家参与游戏
            </p>
          </div>

          {/* 右侧：AI 模型选择 */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Bot className="w-5 h-5 text-amber-400" />
              AI 模型
            </h2>
            <div className="space-y-2">
              {AI_MODELS.map(model => (
                <label
                  key={model.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                    ${config.enabledModels.includes(model.id)
                      ? 'bg-slate-700'
                      : 'bg-slate-800/50 hover:bg-slate-700/50'
                    }
                  `}
                >
                  <Checkbox
                    checked={config.enabledModels.includes(model.id)}
                    onCheckedChange={() => handleModelToggle(model.id)}
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: model.color }}
                  />
                  <span className="text-white flex-1">{model.name}</span>
                </label>
              ))}
            </div>
            <p className="text-slate-500 text-sm mt-3">
              至少选择 2 个模型（可复用扮演多个角色）
            </p>
          </div>
        </div>

        {/* 变体规则 */}
        <div className="mt-6 bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-amber-400" />
            游戏规则变体
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            {/* 刺客规则 */}
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium">刺客开刀时机</label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="assassin"
                    checked={!config.variantRules.assassinAnytime}
                    onChange={() => handleVariantChange('assassinAnytime', false)}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">好人3胜后开刀</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="assassin"
                    checked={config.variantRules.assassinAnytime}
                    onChange={() => handleVariantChange('assassinAnytime', true)}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">随时可开刀</span>
                </label>
              </div>
            </div>

            {/* 发言规则 */}
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium">发言阶段</label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="discussion"
                    checked={config.variantRules.discussionMode === 'every_time'}
                    onChange={() => handleVariantChange('discussionMode', 'every_time')}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">每次组队前发言</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="discussion"
                    checked={config.variantRules.discussionMode === 'first_only'}
                    onChange={() => handleVariantChange('discussionMode', 'first_only')}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">仅首次组队前发言</span>
                </label>
              </div>
            </div>

            {/* 第五次投票规则 */}
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium">连续5次否决</label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="fifthVote"
                    checked={config.variantRules.fifthVoteRule === 'force_team'}
                    onChange={() => handleVariantChange('fifthVoteRule', 'force_team')}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">第5次强制发车</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="fifthVote"
                    checked={config.variantRules.fifthVoteRule === 'evil_wins'}
                    onChange={() => handleVariantChange('fifthVoteRule', 'evil_wins')}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">坏人直接获胜</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 开始游戏按钮区域 */}
        <div className="mt-6">
          {/* [新增] 检测到未完成游戏的提示框 */}
          {hasActiveGame && (
            <div className="bg-amber-900/50 border border-amber-600 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="font-bold text-amber-400">检测到未完成的游戏</p>
                  <p className="text-slate-300 text-sm mt-1">
                    当前有一局游戏正在进行中（第 {gameState.currentQuest} 轮）。
                    如果开始新游戏，当前进度将丢失。
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => router.push('/game')}
                  className="flex-1 bg-green-600 hover:bg-green-500 border-none"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  继续游戏
                </Button>
                <Button
                  variant="outline"
                  onClick={resetGame}
                  className="flex-1 border-red-500/30 text-red-400 hover:bg-red-950/30 hover:text-red-300 hover:border-red-500/50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  放弃并开始新游戏
                </Button>
              </div>
            </div>
          )}

          {/* 如果有未完成的游戏，可以考虑禁用下面的按钮，或者保留让用户强制覆盖 */}
          <div className="text-center">
            {startError && <p className="text-red-400 text-sm">{startError}</p>}
            <Button
              data-testid="lobby-start"
              onClick={handleStartGame}
              size="lg"
              // 如果有游戏正在进行，将主要按钮样式稍微降级，或者保持原样。
              // 这里保持原样，用户点击会直接覆盖旧游戏
              className="bg-amber-600 hover:bg-amber-500 text-lg px-8 py-6 w-full md:w-auto"
            >
              <Play className="w-5 h-5 mr-2" />
              {hasActiveGame ? '覆盖并开始新游戏' : '开始游戏'}
            </Button>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>Ziyi (Felix) Wang · <a href="https://github.com/Felix471/avalon-ai" className="underline hover:text-slate-300">GitHub</a></p>
        </div>
      </div>
    </div>
  );
}

// ==================== 主页面 ====================

export default function HomePage() {
  const hydrated = useHydration();

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
        <div className="text-white text-xl">正在加载...</div>
      </div>
    );
  }

  return <LobbyContent />;
}
