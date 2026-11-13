import { createContext, useContext } from 'react';
import type { Campaign, DieSize, Member, Role, RollRecord, Sheet } from '@ucop/shared';
import type { GameSocket } from './socket';

/** Estado e ações da mesa compartilhados pelos painéis e fichas. */
export interface GameContextValue {
  socket: GameSocket;
  campaign: Campaign;
  role: Role;
  userId: string;
  members: Member[];
  sheets: Sheet[];
  flash(message: string): void;
  openSheet(sheetId: string | null): void;
  /** Rola uma expressão (ex.: "3d20kh1+5") no servidor. */
  rollExpr(expression: string, label: string): Promise<RollRecord | null>;
  /** Rola um teste de Ordem 2 (dados somados + dado de pavor). */
  rollOp2(dice: DieSize[], fear: DieSize | null, label: string): Promise<RollRecord | null>;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame precisa estar dentro da mesa');
  return ctx;
}

export function memberName(members: Member[], userId: string | null): string {
  if (!userId) return 'Mestre';
  return members.find((m) => m.userId === userId)?.name ?? '?';
}
