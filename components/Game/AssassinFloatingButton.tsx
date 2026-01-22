'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/game/store';
import { ROLES } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Target, Swords, AlertTriangle } from 'lucide-react';

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
            bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900
            text-white shadow-lg shadow-red-900/50
            rounded-full w-16 h-16 p-0
            animate-pulse hover:animate-none
            transition-all hover:scale-110
          "
          title="刺杀梅林"
        >
          <Swords className="w-7 h-7" />
        </Button>
        <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
          刺客
        </div>
      </div>

      {/* 刺杀对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-slate-800 border-red-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <Swords className="w-5 h-5" />
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
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
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
                    bg-slate-700/50 hover:bg-red-900/30 border-2 border-transparent hover:border-red-500
                  `}
                >
                  <Target className="w-5 h-5 text-slate-500" />
                  <span className="text-xl">{player.id === humanPlayerId ? '👤' : '🤖'}</span>
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
              <div className="text-4xl mb-3">🎯</div>
              <div className="text-white text-lg">
                目标：<span className="text-red-400 font-bold">玩家{selectedTarget}</span>
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
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                <Swords className="w-4 h-4 mr-2" />
                确认刺杀
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}