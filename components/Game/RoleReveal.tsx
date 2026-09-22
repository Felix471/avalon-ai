'use client';

import { useGameStore } from '@/lib/game/store';
import { getPlayerVision } from '@/lib/game/engine';
import { ROLES } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Drama, Eye, Handshake, ShieldCheck, Skull, Swords } from 'lucide-react';
import { RoleIcon } from './roleIcon';
import { evilColor, goodColor, panelHeadingClass } from './ui';
import { useT } from '@/lib/i18n';

export default function RoleReveal() {
  const t = useT();
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
      <h2 className={`${panelHeadingClass} justify-center text-xl`}>
        <Drama aria-hidden="true" className="size-5" />
        {t('roleReveal.title')}
      </h2>

      <div className={`
        p-6 rounded-xl border-2
        ${role.team === 'good' 
          ? 'border-sky-500 bg-sky-900/30'
          : 'border-rose-500 bg-rose-900/30'
        }
      `}>
        <RoleIcon role={role.type} className={`mx-auto mb-2 size-12 ${role.team === 'good' ? goodColor : evilColor}`} />
        <div className={`text-2xl font-bold ${role.team === 'good' ? goodColor : evilColor}`}>
          {t(`role.${role.type}.name`)}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1 text-sm text-slate-400">
          {role.team === 'good' ? (
            <ShieldCheck aria-hidden="true" className={`size-4 ${goodColor}`} />
          ) : (
            <Skull aria-hidden="true" className={`size-4 ${evilColor}`} />
          )}
          <span>{t(role.team === 'good' ? 'team.good' : 'team.evil')}</span>
        </div>
        <div className="text-slate-300 text-sm mt-3 leading-relaxed">
          {t(`role.${role.type}.description`)}
        </div>
      </div>

      {vision.knownEvil.length > 0 && (
        <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-500">
          <div className="mb-2 flex items-center justify-center gap-2 font-medium text-purple-400">
            <Eye aria-hidden="true" className="size-4" />
            {t('roleReveal.knownEvil')}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {vision.knownEvil.map(id => {
              const p = gameState.players.find(pl => pl.id === id)!;
              return (
                <span key={id} className="rounded bg-rose-900/50 px-2 py-1 text-sm text-rose-300">
                  {t('player.label', { id })} ({p.aiModel?.name || t('common.human')})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {vision.knownMerlinOrMorgana.length > 0 && (
        <div className="rounded-lg border border-sky-500 bg-sky-900/30 p-4">
          <div className="mb-2 flex items-center justify-center gap-2 font-medium text-sky-400">
            <Eye aria-hidden="true" className="size-4" />
            {t('roleReveal.merlinOrMorgana')}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {vision.knownMerlinOrMorgana.map(id => {
              const p = gameState.players.find(pl => pl.id === id)!;
              return (
                <span key={id} className="rounded bg-sky-900/50 px-2 py-1 text-sm text-sky-300">
                  {t('player.label', { id })} ({p.aiModel?.name || t('common.human')})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {vision.teammates.length > 0 && (
        <div className="rounded-lg border border-rose-500 bg-rose-900/30 p-4">
          <div className="mb-2 flex items-center justify-center gap-2 font-medium text-rose-400">
            <Handshake aria-hidden="true" className="size-4" />
            {t('roleReveal.teammates')}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {vision.teammates.map(id => {
              const p = gameState.players.find(pl => pl.id === id)!;
              const r = ROLES[p.role!];
              return (
                <span key={id} className="rounded bg-rose-900/50 px-2 py-1 text-sm text-rose-300">
                  {t('player.label', { id })} ({t(`role.${r.type}.name`)})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {isAssassin && assassinAnytime && (
        <div className="rounded-lg border border-rose-500 bg-gradient-to-r from-rose-900/40 to-orange-900/40 p-4">
          <div className="mb-2 flex items-center gap-2 font-medium text-rose-400">
            <Swords aria-hidden="true" className="size-5" />
            {t('roleReveal.anytimeTitle')}
          </div>
          <div className="text-sm text-rose-200/80">
            {t('roleReveal.anytimeDescription')}
          </div>
        </div>
      )}

      <Button
        data-testid="role-reveal-continue"
        onClick={handleContinue}
        className="w-full bg-amber-500 hover:bg-amber-600"
      >
        {t('roleReveal.continue')}
      </Button>
    </div>
  );
}
