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
import { useT } from '@/lib/i18n';

export function ExitGameButton() {
  const router = useRouter();
  const t = useT();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleExit = () => {
    setShowConfirm(true);
  };

  const confirmExit = () => {
    router.push('/play');
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExit}
        className="text-slate-400 hover:text-white hover:bg-slate-700"
      >
        <LogOut aria-hidden="true" className="mr-1 size-4" />
        {t('exit.button')}
      </Button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>{t('exit.title')}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {t('exit.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={confirmExit}
              className="bg-amber-600 hover:bg-amber-500"
            >
              {t('exit.home')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
