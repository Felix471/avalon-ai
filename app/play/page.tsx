'use client';

import { useRouter } from 'next/navigation';
import { useGameStore, useHydration } from '@/lib/game/store';
import {
  AI_MODELS,
  GENERATION_LIMITS,
  type VariantRules,
} from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import LocaleToggle from '@/components/LocaleToggle';
import { useT } from '@/lib/i18n';
import {
  Users, Play, Bot, Info, AlertCircle, Trash2, ArrowRight, SlidersHorizontal
} from 'lucide-react';

// Lobby content

function LobbyContent() {
  const router = useRouter();
  const t = useT();
  const {
    config,
    updateConfig,
    setSeatModel,
    setAllSeats,
    startGame,
    gameState,
    resetGame,
  } = useGameStore();
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

  const hasActiveGame = hydrated && gameState && gameState.phase !== 'game_over';

  const playerCounts = [5, 6, 7, 8, 9, 10];

  return (
    <div className="min-h-screen bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-4 mb-2">
            <img
              src="/logo.jpg"
              alt="AI Avalon"
              className="w-12 h-12 rounded-lg object-cover"
            />
            <h1 className="text-4xl font-bold text-amber-400">{t('app.name')}</h1>
            <LocaleToggle />
          </div>
          <p className="text-slate-400">{t('lobby.subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users aria-hidden="true" className="size-5 text-amber-400" />
              {t('lobby.playerCount')}
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
                  {t('player.count', { count })}
                </button>
              ))}
            </div>
            <p className="text-slate-500 text-sm mt-3">
              {t('lobby.playerHint')}
            </p>
          </div>

          {/* Right: AI seat configuration */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                <Bot aria-hidden="true" className="size-5 text-amber-400" />
                {t('lobby.aiSeats')}
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="seats-same"
                onClick={() => setAllSeats(config.seats[0]?.modelId ?? AI_MODELS[0].id)}
                className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                {t('lobby.allSame')}
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
                    <span className="w-16 shrink-0 text-sm text-slate-300">{t('player.seat', { id: index + 1 })}</span>
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
                {t('lobby.advanced')}
              </summary>
              <div className="mt-4 space-y-5">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-slate-300">{t('lobby.promptMode')}</legend>
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
                      {t('lobby.promptFull')}
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
                      {t('lobby.promptNaive')}
                    </label>
                  </div>
                  <p className="text-xs text-slate-500">{t('lobby.promptNaiveHint')}</p>
                </fieldset>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <label htmlFor="temperature" className="font-medium text-slate-300">{t('lobby.temperature')}</label>
                    <span className="tabular-nums text-slate-400">
                      {config.generation.temperature ?? t('lobby.providerDefault')}
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
                          ? { ...config.generation, temperature: undefined }
                          : { ...config.generation, temperature: 0.7 },
                      })}
                      className="accent-amber-500"
                    />
                    {t('lobby.useProviderDefault')}
                  </label>
                </div>

                <label className="block space-y-2 text-sm">
                  <span className="font-medium text-slate-300">{t('lobby.maxTokens')}</span>
                  <input
                    type="number"
                    min={GENERATION_LIMITS.maxTokens.min}
                    max={GENERATION_LIMITS.maxTokens.max}
                    data-testid="max-tokens"
                    placeholder={t('lobby.maxTokensDefault')}
                    value={config.generation.maxTokens ?? ''}
                    onChange={event => updateConfig({
                      generation: {
                        ...config.generation,
                        maxTokens: event.target.value === ''
                          ? undefined
                          : Math.min(
                              GENERATION_LIMITS.maxTokens.max,
                              Math.max(GENERATION_LIMITS.maxTokens.min, Number(event.target.value)),
                            ),
                      },
                    })}
                    className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                  />
                  <span className="block text-xs text-slate-500">{t('lobby.maxTokensHint')}</span>
                </label>

                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    data-testid="quick-mode"
                    checked={config.quickMode}
                    onChange={event => updateConfig({ quickMode: event.target.checked })}
                    className="mt-0.5 accent-amber-500"
                  />
                  {t('lobby.quickMode')}
                </label>
              </div>
            </details>
          </div>
        </div>

        <div className="mt-6 bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Info aria-hidden="true" className="size-5 text-amber-400" />
            {t('lobby.variants')}
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium">{t('lobby.assassinTiming')}</label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="assassin"
                    checked={!config.variantRules.assassinAnytime}
                    onChange={() => handleVariantChange('assassinAnytime', false)}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">{t('lobby.assassinAfterThree')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="assassin"
                    checked={config.variantRules.assassinAnytime}
                    onChange={() => handleVariantChange('assassinAnytime', true)}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">{t('lobby.assassinAnytime')}</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium">{t('lobby.discussionRule')}</label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="discussion"
                    checked={config.variantRules.discussionMode === 'every_time'}
                    onChange={() => handleVariantChange('discussionMode', 'every_time')}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">{t('lobby.discussionEvery')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="discussion"
                    checked={config.variantRules.discussionMode === 'first_only'}
                    onChange={() => handleVariantChange('discussionMode', 'first_only')}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">{t('lobby.discussionFirst')}</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium">{t('lobby.fifthVote')}</label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="fifthVote"
                    checked={config.variantRules.fifthVoteRule === 'force_team'}
                    onChange={() => handleVariantChange('fifthVoteRule', 'force_team')}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">{t('lobby.forceFifth')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="fifthVote"
                    checked={config.variantRules.fifthVoteRule === 'evil_wins'}
                    onChange={() => handleVariantChange('fifthVoteRule', 'evil_wins')}
                    className="text-amber-500"
                  />
                  <span className="text-slate-400 text-sm">{t('lobby.evilWinsFifth')}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          {hasActiveGame && (
            <div className="bg-amber-900/50 border border-amber-600 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-400" />
                <div className="text-left">
                  <p className="font-bold text-amber-400">{t('lobby.activeTitle')}</p>
                  <p className="text-slate-300 text-sm mt-1">
                    {t('lobby.activeDescription', { quest: gameState.currentQuest })}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => router.push('/game')}
                  className="flex-1 bg-green-600 hover:bg-green-500 border-none"
                >
                  <ArrowRight aria-hidden="true" className="mr-2 size-4" />
                  {t('lobby.continue')}
                </Button>
                <Button
                  variant="outline"
                  onClick={resetGame}
                  className="flex-1 border-red-500/30 text-red-400 hover:bg-red-950/30 hover:text-red-300 hover:border-red-500/50"
                >
                  <Trash2 aria-hidden="true" className="mr-2 size-4" />
                  {t('lobby.abandon')}
                </Button>
              </div>
            </div>
          )}

          <div className="text-center">
            <Button
              data-testid="lobby-start"
              onClick={handleStartGame}
              size="lg"
              className="bg-amber-600 hover:bg-amber-500 text-lg px-8 py-6 w-full md:w-auto"
            >
              <Play aria-hidden="true" className="mr-2 size-5" />
              {hasActiveGame ? t('lobby.overwrite') : t('lobby.start')}
            </Button>
          </div>
        </div>

        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>Ziyi (Felix) Wang · <a href="https://github.com/Felix471/avalon-ai" className="underline hover:text-slate-300">GitHub</a></p>
        </div>
      </div>
    </div>
  );
}

// Page shell

export default function HomePage() {
  const hydrated = useHydration();
  const t = useT();

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
        <div className="text-white text-xl">{t('lobby.loading')}</div>
      </div>
    );
  }

  return <LobbyContent />;
}
