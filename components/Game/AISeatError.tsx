import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { panelClass } from './ui';

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
    <div data-testid="seat-error" className={cn(panelClass, 'space-y-2 border-rose-800 bg-slate-800/70 p-3')}>
      <div className="text-sm font-medium text-amber-300">
        玩家{playerId} ({modelName || 'AI'})
      </div>
      <div className="text-sm text-rose-400">{message}</div>
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
