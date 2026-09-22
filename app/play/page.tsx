'use client';

import { useRouter } from 'next/navigation';
import { useGameStore, useHydration } from '@/lib/game/store';
import {
  AI_MODELS,
  GENERATION_LIMITS,
  type VariantRules,
} from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import {
  Users, Play, Bot, Info, AlertCircle, Trash2, ArrowRight, SlidersHorizontal
} from 'lucide-react';

// ==================== 大厅主组件 ====================

function LobbyContent() {
  const router = useRouter();
  // 添加 gameState 和 resetGame 用于恢复/重置游戏
  const {
    config,
    updateConfig,
    setSeatModel,
    setAllSeats,
    startGame,
    gameState,
    resetGame,
  } = useGameStore();
  // 添加 hydration 检查
  const hydrated = useHydration();

  const handlePlayerCountChange = (count: number) => {
    updateConfig({ playerCount: count });
  };

  const handleVariantChange = (key: keyof VariantRules, value: VariantRules[keyof VariantRules]) => {
    updateConfig({
      variantRules: { ...config.variantRules, [key]: value }
    });
  };

  const handleStartGame = () => {
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
              <Users aria-hidden="true" className="size-5 text-amber-400" />
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

          {/* Right: AI seat configuration */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                <Bot aria-hidden="true" className="size-5 text-amber-400" />
                AI 座位 / Seats
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="seats-same"
                onClick={() => setAllSeats(config.seats[0]?.modelId ?? AI_MODELS[0].id)}
                className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                全部相同
              </Button>
            </div>
            <div className="space-y-2">
              {config.seats.map((seat, index) => {
                const selectedModel = AI_MODELS.find(model => model.id === seat.modelId)
                  ?? AI_MODELS[0];
                return (
                  <label
                    key={index}
                    className="flex items-center gap-3 rounded-lg bg-slate-700/60 p-3"
                  >
                    <span className="w-16 shrink-0 text-sm text-slate-300">座位 {index + 1}</span>
                    <span
                      aria-hidden="true"
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: selectedModel.color }}
                    />
                    <select
                      data-testid={`seat-select-${index}`}
                      value={seat.modelId}
                      onChange={event => setSeatModel(index, event.target.value)}
                      className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                    >
                      {AI_MODELS.map(model => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>

            <details data-testid="advanced-settings" className="mt-5 border-t border-slate-700 pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-slate-200">
                <SlidersHorizontal aria-hidden="true" className="size-4 text-amber-400" />
                高级设置
              </summary>
              <div className="mt-4 space-y-5">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-slate-300">提示词模式</legend>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                      <input
                        type="radio"
                        name="prompt-mode"
                        value="full"
                        data-testid="prompt-mode-full"
                        checked={config.promptMode === 'full'}
                        onChange={() => updateConfig({ promptMode: 'full' })}
                        className="accent-amber-500"
                      />
                      完整策略
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                      <input
                        type="radio"
                        name="prompt-mode"
                        value="naive"
                        data-testid="prompt-mode-naive"
                        checked={config.promptMode === 'naive'}
                        onChange={() => updateConfig({ promptMode: 'naive' })}
                        className="accent-amber-500"
                      />
                      基础
                    </label>
                  </div>
                  <p className="text-xs text-slate-500">基础模式是实验中的对照组。</p>
                </fieldset>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <label htmlFor="temperature" className="font-medium text-slate-300">温度</label>
                    <span className="tabular-nums text-slate-400">
                      {config.generation.temperature ?? '提供方默认'}
                    </span>
                  </div>
                  <input
                    id="temperature"
                    type="range"
                    min={GENERATION_LIMITS.temperature.min}
                    max={GENERATION_LIMITS.temperature.max}
                    step={GENERATION_LIMITS.temperature.step}
                    data-testid="temperature"
                    value={config.generation.temperature ?? 0.7}
                    disabled={config.generation.temperature === undefined}
                    onChange={event => updateConfig({
                      generation: {
                        ...config.generation,
                        temperature: Number(event.target.value),
                      },
                    })}
                    className="w-full accent-amber-500 disabled:opacity-40"
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
                    <input
                      type="checkbox"
                      data-testid="temperature-default"
                      checked={config.generation.temperature === undefined}
                      onChange={event => updateConfig({
                        generation: event.target.checked
                          ? { maxTokens: config.generation.maxTokens }
                          : { ...config.generation, temperature: 0.7 },
                      })}
                      className="accent-amber-500"
                    />
                    使用提供方默认
                  </label>
                </div>

                <label className="block space-y-2 text-sm">
                  <span className="font-medium text-slate-300">最大输出 tokens</span>
                  <input
                    type="number"
                    min={GENERATION_LIMITS.maxTokens.min}
                    max={GENERATION_LIMITS.maxTokens.max}
                    data-testid="max-tokens"
                    value={config.generation.maxTokens}
                    onChange={event => updateConfig({
                      generation: {
                        ...config.generation,
                        maxTokens: Math.min(
                          GENERATION_LIMITS.maxTokens.max,
                          Math.max(GENERATION_LIMITS.maxTokens.min, Number(event.target.value)),
                        ),
                      },
                    })}
                    className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                  />
                </label>

                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    data-testid="quick-mode"
                    checked={config.quickMode}
                    onChange={event => updateConfig({ quickMode: event.target.checked })}
                    className="mt-0.5 accent-amber-500"
                  />
                  每次组队只讨论一轮（更快、更便宜）
                </label>
              </div>
            </details>
          </div>
        </div>

        {/* 变体规则 */}
        <div className="mt-6 bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Info aria-hidden="true" className="size-5 text-amber-400" />
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
                <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-400" />
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
                  <ArrowRight aria-hidden="true" className="mr-2 size-4" />
                  继续游戏
                </Button>
                <Button
                  variant="outline"
                  onClick={resetGame}
                  className="flex-1 border-red-500/30 text-red-400 hover:bg-red-950/30 hover:text-red-300 hover:border-red-500/50"
                >
                  <Trash2 aria-hidden="true" className="mr-2 size-4" />
                  放弃并开始新游戏
                </Button>
              </div>
            </div>
          )}

          {/* 如果有未完成的游戏，可以考虑禁用下面的按钮，或者保留让用户强制覆盖 */}
          <div className="text-center">
            <Button
              data-testid="lobby-start"
              onClick={handleStartGame}
              size="lg"
              // 如果有游戏正在进行，将主要按钮样式稍微降级，或者保持原样。
              // 这里保持原样，用户点击会直接覆盖旧游戏
              className="bg-amber-600 hover:bg-amber-500 text-lg px-8 py-6 w-full md:w-auto"
            >
              <Play aria-hidden="true" className="mr-2 size-5" />
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
