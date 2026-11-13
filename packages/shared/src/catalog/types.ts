/**
 * Catálogo de Ordem 1 (não oficial). Contém apenas nomes, números e resumos
 * curtos escritos para este projeto — nenhum texto dos livros é reproduzido.
 * A referência de página aponta para onde a regra completa está.
 */
import type { Op1Attr, Op1ClassId, Op1ItemKind } from '../systems';

/** Contexto usado para calcular efeitos automáticos. */
export interface EffectCtx {
  /** "Passos" de NEX: NEX 5% = 1, 10% = 2… 99% = 20 (ou o nível, na regra opcional). */
  steps: number;
  nex: number;
  /** Estágio do sobrevivente (0 para as demais classes). */
  stage: number;
  attrs: Record<Op1Attr, number>;
  /** O jogador marcou "afinidade" neste poder paranormal. */
  affinity: boolean;
}

/** Bônus automáticos que uma habilidade, origem ou item aplica na ficha. */
export interface Effects {
  pv?: number;
  pe?: number;
  san?: number;
  pd?: number;
  defense?: number;
  /** Bônus em Fortitude, Reflexos e Vontade (testes de resistência). */
  saves?: number;
  peLimit?: number;
  ritualDt?: number;
  load?: number;
  skills?: Record<string, number>;
}

export type EffectFn = (ctx: EffectCtx) => Effects;

export interface CatalogAbility {
  id: string;
  name: string;
  /** origem | classe (automática) | trilha | poder de classe | paranormal */
  kind: 'origem' | 'classe' | 'trilha' | 'poder' | 'paranormal';
  /** Classe (poderes/trilhas) ou elemento (paranormais). */
  group?: string;
  cost?: string;
  prereq?: string;
  /** NEX (ou estágio, para o sobrevivente) em que a habilidade é recebida. */
  nex?: number;
  page: string;
  summary: string;
  /** Texto curto da linha "Afinidade" (poderes paranormais), resumido. */
  affinity?: string;
  effect?: EffectFn;
}

export interface CatalogOrigin {
  id: string;
  name: string;
  /** Ids das perícias treinadas (vazio = escolha do mestre). */
  skills: string[];
  skillsNote?: string;
  power: CatalogAbility;
  page: string;
}

export interface CatalogTrail {
  id: string;
  name: string;
  classId: Op1ClassId;
  page: string;
  summary: string;
  abilities: CatalogAbility[];
}

export interface CatalogRitual {
  id: string;
  name: string;
  elements: string[];
  circle: number;
  execution: string;
  range: string;
  target: string;
  duration: string;
  resistance: string;
  /** Rolagem principal (dano/cura), quando houver. */
  roll?: string;
  discente?: number;
  verdadeiro?: number;
  summary: string;
  page: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  kind: Op1ItemKind;
  category: number;
  spaces: number;
  damage?: string;
  critical?: string;
  range?: string;
  damageType?: string;
  details?: string;
  defense?: number;
  summary: string;
  page: string;
}
