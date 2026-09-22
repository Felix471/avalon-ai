'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/game/store';
import { ROLES } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertTriangle, Bot, Swords, Target, User } from 'lucide-react';

export default function AssassinFloatingButton() {
  const { gameState, assassinate } = useGameStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  if (!gameState) return null;

  const { players, humanPlayerId, variantRules, phase, goodWins } = gameState;
  const humanPlayer = players.find(p => p.id === humanPlayerId)!;

  // 检查是否显示刺客按钮
  const isAssassin = humanPlayer.role === 'assassin';
  const canAssassinateAnytime = variantRules?.assassinAnytime;
  const gameInProgress = phase !== 'game_over' && phase !== 'assassination' && phase !== 'role_reveal';

  // 不显示的条件：不是刺客、没开启随时开刀、游戏已结束、已经在刺杀阶段
  if (!isAssassin || !canAssassinateAnytime || !gameInProgress) {
    return null;
  }

  const goodPlayers = players.filter(p => ROLES[p.role!].team === 'good');

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
    setSelectedTarget(null);
    setConfirmStep(false);
  };

  const handleSelectTarget = (playerId: number) => {
    setSelectedTarget(playerId);
    setConfirmStep(true);
  };

  const handleConfirmAssassinate = () => {
    if (selectedTarget) {
      assassinate(selectedTarget);
      setIsDialogOpen(false);
    }
  };

  const handleCancel = () => {
    if (confirmStep) {
      setConfirmStep(false);
      setSelectedTarget(null);
    } else {
      setIsDialogOpen(false);
    }
  };

  return (
    <>
      {/* 浮动按钮 */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleOpenDialog}
          className="
            bg-gradient-to-r from-rose-600 to-rose-800 hover:from-rose-700 hover:to-rose-900
            text-white shadow-lg shadow-rose-900/50
            rounded-full w-16 h-16 p-0
            animate-pulse hover:animate-none
            transition-all hover:scale-110
          "
          title="刺杀梅林"
        >
          <Swords aria-hidden="true" className="size-5" />
        </Button>
        <div className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-black">
          刺客
        </div>
      </div>

      {/* 刺杀对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md border-rose-700 bg-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-400">
              <Swords aria-hidden="true" className="size-5" />
              {confirmStep ? '确认刺杀' : '选择刺杀目标'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {confirmStep
                ? '此操作不可撤销！确定要现在刺杀吗？'
                : '选择你认为是梅林的玩家。注意：刺杀后游戏立即结束！'
              }
            </DialogDescription>
          </DialogHeader>

          {/* 警告信息 */}
          <div className="p-3 bg-yellow-900/30 rounded-lg border border-yellow-700 flex items-start gap-2">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-yellow-500" />
            <div className="text-sm">
              <div className="text-yellow-400 font-medium">警告</div>
              <div className="text-yellow-200/70">
                {confirmStep
                  ? `你即将刺杀 玩家${selectedTarget}。如果猜中梅林，坏人获胜；如果猜错，好人获胜！`
                  : `当前比分：好人 ${goodWins} 胜。提前刺杀意味着放弃继续破坏任务的机会。`
                }
              </div>
            </div>
          </div>

          {!confirmStep ? (
            /* 选择目标 */
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {goodPlayers.map(player => (
                <button
                  key={player.id}
                  onClick={() => handleSelectTarget(player.id)}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left
                    bg-slate-700/50 hover:bg-rose-900/30 border-2 border-transparent hover:border-rose-500
                  `}
                >
                  <Target aria-hidden="true" className="size-5 text-slate-500" />
                  {player.id === humanPlayerId ? (
                    <User aria-hidden="true" className="size-4" />
                  ) : (
                    <Bot aria-hidden="true" className="size-4" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-white font-medium">
                      玩家{player.id}
                    </span>
                    <span className="text-xs text-slate-400">
                      {player.aiModel?.name || '人类玩家'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* 确认步骤 */
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 text-lg text-white">
                <Target aria-hidden="true" className="size-5 text-rose-400" />
                目标：<span className="font-bold text-rose-400">玩家{selectedTarget}</span>
              </div>
              <div className="text-slate-400 text-sm mt-1">
                {players.find(p => p.id === selectedTarget)?.aiModel?.name || '人类玩家'}
              </div>
            </div>
          )}

          {/* 按钮 */}
          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              {confirmStep ? '返回' : '取消'}
            </Button>
            {confirmStep && (
              <Button
                onClick={handleConfirmAssassinate}
                className="flex-1 bg-rose-600 hover:bg-rose-700"
              >
                <Swords aria-hidden="true" className="mr-2 size-4" />
                确认刺杀
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
