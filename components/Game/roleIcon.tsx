import {
  EyeOff,
  Ghost,
  Shield,
  ShieldCheck,
  Skull,
  Sparkles,
  Swords,
  Wand2,
} from 'lucide-react';
import type { RoleType } from '@/lib/game/types';

interface RoleIconProps {
  role: RoleType;
  className?: string;
}

const roleIcons = {
  merlin: Wand2,
  percival: ShieldCheck,
  loyal: Shield,
  assassin: Swords,
  morgana: Sparkles,
  mordred: EyeOff,
  oberon: Ghost,
  minion: Skull,
} satisfies Record<RoleType, typeof Wand2>;

export function RoleIcon({ role, className = 'size-4' }: RoleIconProps) {
  const Icon = roleIcons[role];
  return <Icon aria-hidden="true" className={className} />;
}
