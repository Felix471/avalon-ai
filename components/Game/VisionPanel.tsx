'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/game/store';
import { getPlayerVision } from '@/lib/game/engine';
import { ROLES } from '@/lib/game/types';
import { AlertTriangle, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RoleIcon } from './roleIcon';
import { panelClass } from './ui';
import { useT, type TranslationKey } from '@/lib/i18n';

export default function VisionPanel() {
  const t = useT();
  const { gameState } = useGameStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!gameState) return null;

  const humanPlayer = gameState.players.find(p => p.id === gameState.humanPlayerId);
  if (!humanPlayer || !humanPlayer.role) return null;

  const role = ROLES[humanPlayer.role];
  const vision = getPlayerVision(gameState, humanPlayer.id);

  const hasSpecialVision =
    vision.knownEvil.length > 0 ||
    vision.knownMerlinOrMorgana.length > 0 ||
    vision.teammates.length > 0;

  if (!hasSpecialVision) return null;

  const getVisionSummary = (): { label: TranslationKey; players: number[]; color: 'rose' | 'sky'; hint: TranslationKey } | null => {
    if (vision.knownEvil.length > 0 && humanPlayer.role === 'merlin') {
      return {
        label: 'vision.knownEvil',
        players: vision.knownEvil,
        color: 'rose',
        hint: 'vision.mordredHidden',
      };
    }
    if (vision.knownMerlinOrMorgana.length > 0) {
      return {
        label: 'vision.merlinOrMorgana',
        players: vision.knownMerlinOrMorgana,
        color: 'sky',
        hint: 'vision.distinguish',
      };
    }
    if (vision.teammates.length > 0) {
      return {
        label: 'vision.teammates',
        players: vision.teammates,
        color: 'rose',
        hint: 'vision.oberonHidden',
      };
    }
    return null;
  };

  const visionInfo = getVisionSummary();
  if (!visionInfo) return null;

  const colorClasses = {
    rose: 'border-rose-500/50 bg-rose-900/30 text-rose-300',
    sky: 'border-sky-500/50 bg-sky-900/30 text-sky-300',
  };

  return (
    <div className={cn(panelClass, 'overflow-hidden p-0', colorClasses[visionInfo.color as 'rose' | 'sky'])}>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-black/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <RoleIcon role={role.type} className="size-4" />
          <span className="text-sm font-medium">{t('vision.title', { role: t(`role.${role.type}.name`) })}</span>
        </div>
        <div className="flex items-center gap-1">
          <Eye aria-hidden="true" className="size-4" />
          {isCollapsed ? (
            <ChevronDown aria-hidden="true" className="size-4" />
          ) : (
            <ChevronUp aria-hidden="true" className="size-4" />
          )}
        </div>
      </button>

      {!isCollapsed && (
        <div className="px-3 pb-2 border-t border-current/20">
          <div className="pt-2 space-y-1">
            <div className="text-xs opacity-80">{t(visionInfo.label)}:</div>
            <div className="flex flex-wrap gap-1">
              {visionInfo.players.map(id => {
                const player = gameState.players.find(p => p.id === id);
                if (!player) return null;
                return (
                  <span
                    key={id}
                    className="px-2 py-0.5 bg-black/30 rounded text-xs"
                  >
                    {t('player.label', { id })} ({player.aiModel?.name || t('common.human')})
                  </span>
                );
              })}
            </div>
            <p className="flex items-center gap-1 text-xs italic opacity-60">
              <AlertTriangle aria-hidden="true" className="size-4" />
              {t(visionInfo.hint)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
