'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ExitGameButton() {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleExit = () => {
    setShowConfirm(true);
  };

  const confirmExit = () => {
    // 直接返回主页，游戏状态保留在 store 中
    // 主页会检测到进行中的游戏并显示"是否继续"提示
    router.push('/');
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExit}
        className="text-slate-400 hover:text-white hover:bg-slate-700"
      >
        <LogOut className="w-4 h-4 mr-1" />
        退出
      </Button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>确认退出游戏？</DialogTitle>
            <DialogDescription className="text-slate-400">
              游戏进度会被保存，你可以稍后重新进入游戏。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              取消
            </Button>
            <Button
              onClick={confirmExit}
              className="bg-amber-600 hover:bg-amber-500"
            >
              退出到主页
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
