'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Bot, Loader2, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/lib/game/store';
import { cn } from '@/lib/utils';
import { panelClass } from './ui';

interface AISeatStatusProps {
  playerId: number;
  onRetry?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  skipHint?: string;
}

export default function AISeatStatus({
  playerId,
  onRetry,
  onSkip,
  skipLabel = '跳过',
  skipHint,
}: AISeatStatusProps) {
  const status = useGameStore(state => state.seatStatus[playerId]);
  const player = useGameStore(state => state.gameState?.players.find(candidate => candidate.id === playerId));
  const [now, setNow] = useState(() => Date.now());
  const startedAt = status?.state === 'thinking' ? status.startedAt : undefined;
  const retryAfterUntil = status?.state === 'error' ? status.retryAfterUntil : undefined;

  useEffect(() => {
    if (startedAt === undefined && retryAfterUntil === undefined) return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [startedAt, retryAfterUntil]);

  if (!status || status.state === 'idle' || status.state === 'done') return null;

  const modelName = status.modelName ?? player?.aiModel?.name ?? 'AI';

  if (status.state === 'thinking') {
    const elapsedSeconds = Math.max(0, Math.floor((now - status.startedAt) / 1000));
    const provider = status.provider ?? player?.aiModel?.provider;

    return (
      <div className={cn(panelClass, 'flex items-center gap-3 bg-slate-800/70 p-3')} title={provider}>
        <Bot aria-hidden="true" className="size-5 shrink-0 text-slate-300" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white">玩家{playerId}</div>
          <div className="truncate text-xs text-slate-400">{modelName}</div>
        </div>
        <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-amber-400" />
        <span className="text-sm text-slate-400 tabular-nums">思考中 · {elapsedSeconds} s</span>
      </div>
    );
  }

  if (status.state === 'skipped') {
    return (
      <div className={cn(panelClass, 'flex items-center gap-2 bg-slate-800/70 p-3 text-sm text-slate-500')}>
        <SkipForward aria-hidden="true" className="size-4" />
        <span>玩家{playerId} · 已跳过</span>
      </div>
    );
  }

  const provider = status.provider ?? player?.aiModel?.provider;
  const errorModelName = status.modelName ?? player?.aiModel?.name;
  const detailTitle = [
    provider,
    errorModelName,
    status.latencyMs === undefined ? undefined : `${status.latencyMs} ms`,
  ].filter(Boolean).join(' / ') || status.title;
  const retrySeconds = status.kind === 'rate_limited' && status.retryAfterUntil
    ? Math.max(0, Math.ceil((status.retryAfterUntil - now) / 1000))
    : 0;

  return (
    <div
      data-testid="seat-error"
      className={cn(panelClass, 'space-y-3 border-rose-800 bg-slate-800/70 p-3')}
      title={detailTitle}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-rose-400" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-amber-300">玩家{playerId} ({modelName})</div>
          <div className="text-sm text-rose-400">{status.message}</div>
        </div>
      </div>
      <div className="flex gap-2">
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            data-testid="seat-retry"
            onClick={onRetry}
            disabled={retrySeconds > 0}
          >
            {retrySeconds > 0 ? `重试 (${retrySeconds})` : '重试'}
          </Button>
        )}
        {onSkip && (
          <Button
            size="sm"
            variant="ghost"
            data-testid="seat-skip"
            onClick={onSkip}
            title={skipHint}
          >
            {skipLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
