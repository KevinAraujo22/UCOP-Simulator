import { z } from 'zod';
import { dieSizeSchema } from './sheets';
import type { DieSize } from './systems';

/** Gera um inteiro uniforme em [1, sides]. O servidor injeta um RNG criptográfico. */
export type DieRoller = (sides: number) => number;

// ---------------------------------------------------------------------------
// Expressões: "3d20kh1+5", "2d6+2", "d20", "1d8-1+1d4"
// ---------------------------------------------------------------------------
export interface DiceTerm {
  kind: 'dice';
  sign: 1 | -1;
  count: number;
  sides: number;
  keep: { mode: 'h' | 'l'; n: number } | null;
  rolls: number[];
  kept: boolean[];
  subtotal: number;
}
export interface ConstTerm {
  kind: 'const';
  sign: 1 | -1;
  value: number;
}
export type Term = DiceTerm | ConstTerm;

export interface ExprRollDetail {
  type: 'expr';
  expression: string;
  terms: Term[];
  total: number;
}

const MAX_DICE = 100;
const MAX_SIDES = 1000;
const TERM_RE = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$|^(\d+)$/;

type ParsedTerm =
  | { kind: 'dice'; sign: 1 | -1; count: number; sides: number; keep: DiceTerm['keep'] }
  | { kind: 'const'; sign: 1 | -1; value: number };

/** Interpreta uma expressão de dados. Lança Error com mensagem em português se inválida. */
export function parseDiceExpression(input: string): ParsedTerm[] {
  // Notação dos livros: "3O+10" = 3d20 ficando com o maior.
  const src = input
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/(\d*)o/g, (_, n: string) => `${n || 1}d20kh1`);
  if (!src) throw new Error('Expressão vazia');
  if (src.length > 100) throw new Error('Expressão longa demais');
  const parts = src.match(/[+-]?[^+-]+/g);
  if (!parts || parts.join('') !== src) throw new Error('Expressão inválida');

  let totalDice = 0;
  const terms = parts.map((raw): ParsedTerm => {
    const sign: 1 | -1 = raw.startsWith('-') ? -1 : 1;
    const body = raw.replace(/^[+-]/, '');
    const m = TERM_RE.exec(body);
    if (!m) throw new Error(`Termo inválido: "${body}"`);
    if (m[5] !== undefined) return { kind: 'const', sign, value: Number(m[5]) };
    const count = m[1] === '' ? 1 : Number(m[1]);
    const sides = Number(m[2]);
    if (count < 1 || count > MAX_DICE) throw new Error(`Quantidade de dados deve ser entre 1 e ${MAX_DICE}`);
    if (sides < 2 || sides > MAX_SIDES) throw new Error('Tipo de dado inválido');
    totalDice += count;
    let keep: DiceTerm['keep'] = null;
    if (m[3]) {
      const n = Number(m[4]);
      if (n < 1 || n > count) throw new Error('Quantidade mantida inválida');
      keep = { mode: m[3] === 'kh' ? 'h' : 'l', n };
    }
    return { kind: 'dice', sign, count, sides, keep };
  });
  if (totalDice > MAX_DICE) throw new Error(`No máximo ${MAX_DICE} dados por rolagem`);
  if (!terms.some((t) => t.kind === 'dice')) throw new Error('A expressão precisa ter ao menos um dado');
  return terms;
}

export function formatDiceExpression(terms: ParsedTerm[]): string {
  return terms
    .map((t, i) => {
      const sign = t.sign < 0 ? '-' : i > 0 ? '+' : '';
      if (t.kind === 'const') return `${sign}${t.value}`;
      const keep = t.keep ? `k${t.keep.mode}${t.keep.n}` : '';
      return `${sign}${t.count}d${t.sides}${keep}`;
    })
    .join('');
}

export function rollExpression(input: string, roll: DieRoller): ExprRollDetail {
  const parsed = parseDiceExpression(input);
  const terms: Term[] = parsed.map((t) => {
    if (t.kind === 'const') return t;
    const rolls = Array.from({ length: t.count }, () => roll(t.sides));
    let kept = rolls.map(() => true);
    if (t.keep) {
      const order = rolls
        .map((v, i) => ({ v, i }))
        .sort((a, b) => (t.keep!.mode === 'h' ? b.v - a.v : a.v - b.v))
        .slice(0, t.keep.n)
        .map((x) => x.i);
      kept = rolls.map((_, i) => order.includes(i));
    }
    const subtotal = rolls.reduce((s, v, i) => s + (kept[i] ? v : 0), 0);
    return { ...t, rolls, kept, subtotal };
  });
  const total = terms.reduce((s, t) => s + t.sign * (t.kind === 'const' ? t.value : t.subtotal), 0);
  return { type: 'expr', expression: formatDiceExpression(parsed), terms, total };
}

// ---------------------------------------------------------------------------
// Ordem 2 (playtest): soma dos dados do teste, com dado de pavor e críticos
// ---------------------------------------------------------------------------
export interface Op2DieResult {
  sides: DieSize;
  value: number;
  /** Anulado pelo dado de pavor (resultado menor que o pavor). */
  cancelled: boolean;
  /** Entrou na soma (no máximo 3 dados somados). */
  counted: boolean;
}

export interface Op2RollDetail {
  type: 'op2';
  dice: Op2DieResult[];
  fear: { sides: DieSize; value: number } | null;
  total: number;
  outcome: 'critical-success' | 'critical-failure' | null;
  /** Dado de pavor tirou 1: o efeito de pavor termina. */
  fearEnds: boolean;
}

export const OP2_MAX_DICE = 4;
export const OP2_MAX_SUMMED = 3;

export function rollOp2(dice: DieSize[], fear: DieSize | null, roll: DieRoller): Op2RollDetail {
  const used = dice.slice(0, OP2_MAX_DICE);
  const fearRoll = fear ? { sides: fear, value: roll(fear) } : null;
  const results: Op2DieResult[] = used.map((sides) => {
    const value = roll(sides);
    return { sides, value, cancelled: !!fearRoll && value < fearRoll.value, counted: false };
  });
  const survivors = results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !r.cancelled)
    .sort((a, b) => b.r.value - a.r.value)
    .slice(0, OP2_MAX_SUMMED);
  for (const { r } of survivors) r.counted = true;
  const total = survivors.reduce((s, { r }) => s + r.value, 0);

  let outcome: Op2RollDetail['outcome'] = null;
  const live = results.filter((r) => !r.cancelled).map((r) => r.value);
  const pairHigh = live.some((v, i) => v >= 6 && live.indexOf(v) !== i);
  if (live.length === 0 || results.every((r) => r.value === 1)) outcome = 'critical-failure';
  else if (pairHigh) outcome = 'critical-success';

  return { type: 'op2', dice: results, fear: fearRoll, total, outcome, fearEnds: fearRoll?.value === 1 };
}

// ---------------------------------------------------------------------------
// Pedido e registro de rolagem (trafegam pelo Socket.IO)
// ---------------------------------------------------------------------------
const label = z.string().trim().max(120).optional();

export const rollRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('expr'),
    expression: z.string().min(1).max(100),
    label,
    /** Apenas o mestre: rolagem visível só para mestres. */
    secret: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('op2'),
    dice: z.array(dieSizeSchema).min(1).max(8),
    fear: dieSizeSchema.nullable().optional(),
    label,
    secret: z.boolean().optional(),
  }),
]);

export type RollRequest = z.input<typeof rollRequestSchema>;

export interface RollRecord {
  id: string;
  campaignId: string;
  userId: string;
  userName: string;
  label: string;
  secret: boolean;
  createdAt: string;
  detail: ExprRollDetail | Op2RollDetail;
}
