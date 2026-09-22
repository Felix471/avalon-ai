import { Button } from '@/components/ui/button';

interface AISeatErrorProps {
  playerId: number;
  modelName?: string;
  message: string;
  onRetry: () => void;
  onSkip: () => void;
  skipLabel?: string;
}

export default function AISeatError({
  playerId,
  modelName,
  message,
  onRetry,
  onSkip,
  skipLabel = '跳过',
}: AISeatErrorProps) {
  return (
    <div className="space-y-2 rounded-lg border border-red-800 bg-slate-800/70 p-3">
      <div className="text-sm font-medium text-amber-300">
        玩家{playerId} ({modelName || 'AI'})
      </div>
      <div className="text-sm text-red-400">{message}</div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onRetry}>
          重试
        </Button>
        <Button size="sm" variant="ghost" onClick={onSkip}>
          {skipLabel}
        </Button>
      </div>
    </div>
  );
}
