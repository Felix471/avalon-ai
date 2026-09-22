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
import LocaleToggle from '@/components/LocaleToggle';
import { useT } from '@/lib/i18n';
import { panelClass, panelHeadingClass, subtleTextClass } from '@/components/Game/ui';
import { DISCUSSION_ROUNDS } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AlertTriangle, ScrollText, Settings, Swords, X } from 'lucide-react';

export default function GamePage() {
  const router = useRouter();
  const t = useT();
  const hydrated = useHydration();
  const {
    gameState,
    providerFailureCounts,
    dismissedProviderBanner,
    dismissProviderBanner,
  } = useGameStore();

  useEffect(() => {
    if (hydrated && !gameState) {
      router.push('/play');
    }
  }, [hydrated, gameState, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
        <div className="text-white text-xl">{t('game.initializing')}</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
        <div className="text-white text-xl">{t('game.redirecting')}</div>
      </div>
    );
  }

  const isInteractivePhase = ['discussion', 'team_building', 'team_vote', 'quest', 'assassination'].includes(gameState.phase);
  const unavailableProvider = Object.entries(providerFailureCounts)
    .find(([provider, failures]) => failures >= 3 && dismissedProviderBanner !== provider)?.[0];
  const providerLabel = unavailableProvider
    ? gameState.players.find(player => player.aiModel?.provider === unavailableProvider)?.aiModel?.name
      ?? unavailableProvider
    : null;

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
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="AI Avalon"
              className="w-10 h-10 rounded-lg object-cover"
            />
            <h1 className="text-2xl font-bold text-amber-400">{t('app.name')}</h1>
          </div>

          <div className="ml-auto flex basis-full flex-wrap items-center justify-end gap-2 sm:basis-auto sm:gap-4">
            <div className="rounded-lg bg-slate-800/50 px-3 py-1 text-sm text-slate-300 tabular-nums">
              {t('game.status', { quest: gameState.currentQuest, vote: gameState.consecutiveRejects + 1 })}
            </div>
            <div className="order-last flex basis-full justify-end sm:order-none sm:basis-auto">
              <QuestTracker />
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  data-testid="settings-open"
                  aria-label={t('game.settingsLabel')}
                  className="border-slate-600 bg-slate-800/70 text-slate-200 hover:bg-slate-700 hover:text-white"
                >
                  <Settings aria-hidden="true" className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="border-slate-700 bg-slate-900 text-white">
                <DialogHeader>
                  <DialogTitle>{t('game.settingsTitle')}</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    {t('game.settingsDescription')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <div>
                    <h3 className="mb-2 font-medium text-slate-200">{t('game.settingsSeats')}</h3>
                    <div className="space-y-1 text-slate-300">
                      {gameState.players.filter(player => !player.isHuman).map(player => (
                        <div key={player.id} className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: player.aiModel?.color }}
                          />
                          <span>{t('game.settingsSeat', { id: player.id, model: player.aiModel?.name ?? t('common.unknownModel') })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-slate-300">
                    <dt>{t('game.settingsPromptMode')}</dt>
                    <dd>{t(gameState.promptMode === 'naive' ? 'lobby.promptNaive' : 'lobby.promptFull')}</dd>
                    <dt>{t('game.settingsTemperature')}</dt>
                    <dd>{gameState.generation.temperature ?? t('lobby.providerDefault')}</dd>
                    <dt>{t('game.settingsMaxTokens')}</dt>
                    <dd>{gameState.generation.maxTokens ?? t('lobby.maxTokensDefault')}</dd>
                    <dt>{t('game.settingsDiscussionRounds')}</dt>
                    <dd>{gameState.discussionRounds ?? DISCUSSION_ROUNDS}</dd>
                  </dl>
                </div>
              </DialogContent>
            </Dialog>
            <LocaleToggle />
            <ExitGameButton />
          </div>
        </div>

        {unavailableProvider && providerLabel && (
          <div
            data-testid="provider-banner"
            className="mb-4 flex items-center gap-3 rounded-lg border border-rose-800 bg-rose-950/50 px-4 py-3 text-sm text-rose-200"
          >
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-rose-400" />
            <span className="flex-1">
              {t('game.providerUnavailable', { provider: providerLabel })}
            </span>
            <button
              type="button"
              onClick={() => dismissProviderBanner(unavailableProvider)}
              aria-label={t('game.dismissProvider')}
              className="rounded p-1 text-rose-300 hover:bg-rose-900/60 hover:text-white"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
            <VisionPanel />

            <VoteMatrix />

            {gameState.phase === 'quest' && (
              <div className={panelClass}>
                <h3 className={`${panelHeadingClass} mb-2 text-amber-400`}>
                  <Swords aria-hidden="true" className="size-5" />
                  {t('game.questRunning')}
                </h3>
                <p className={subtleTextClass}>
                  {t('game.questRunningHint')}
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 order-1 lg:order-2">
            <PlayerCircle />
          </div>

          <div data-testid="phase-panel" className="order-3 flex flex-col gap-4 lg:col-span-4">
            <div className={`${panelClass} min-h-[280px]`}>
              {renderPhasePanel()}
            </div>

            <Transcript />

            <details>
              <summary className={`${panelClass} flex cursor-pointer list-none items-center gap-2 text-sm text-slate-300`}>
                <ScrollText aria-hidden="true" className="size-4" />
                {t('game.fullLog')}
              </summary>
              <div className="mt-2">
                <GameLog />
              </div>
            </details>
          </div>
        </div>
      </div>

      <AssassinFloatingButton />
    </main>
  );
}
