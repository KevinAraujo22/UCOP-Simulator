import { z } from 'zod';
import {
  OP1_CLASSES,
  OP1_PATENTS,
  OP1_SKILLS,
  type DieSize,
  type GameSystem,
  type Op1Attr,
  type Op1ClassId,
} from './systems';
import { addEffects, findAbility, findOrigin, findTrail, type Effects } from './catalog';

// ---------------------------------------------------------------------------
// Blocos comuns
// ---------------------------------------------------------------------------
const id = z.string().min(1).max(64);
const text = (max: number) => z.string().max(max).default('');
const int = (min: number, max: number, def: number) => z.number().int().min(min).max(max).default(def);
const portrait = z
  .string()
  .max(300)
  .regex(/^\/uploads\/[\w-]+\/[\w.-]+$/)
  .nullable()
  .default(null);
export const dieSizeSchema = z.union([
  z.literal(4),
  z.literal(6),
  z.literal(8),
  z.literal(10),
  z.literal(12),
  z.literal(20),
]);
const dieSize = dieSizeSchema;

const LONG = 5000;
const MAX_LIST = 200;

const ability = z.object({
  id,
  name: z.string().max(120).default(''),
  /** Custo livre, ex.: "2 PE", "1 PD". */
  cost: text(40),
  description: text(LONG),
  /** Id no catálogo (vazio = habilidade personalizada). */
  ref: z.string().max(80).default(''),
  /** Poderes paranormais: o personagem tem afinidade com o elemento. */
  affinity: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Ordem 1
// ---------------------------------------------------------------------------
const op1SkillSchema = z.object({
  training: z.union([z.literal(0), z.literal(5), z.literal(10), z.literal(15)]).default(0),
  other: int(-50, 50, 0),
});

const op1Attack = z.object({
  id,
  name: z.string().max(120).default(''),
  skill: z.enum(['luta', 'pontaria']).default('luta'),
  /** Bônus extra no teste de ataque (além da perícia). */
  attackBonus: int(-50, 50, 0),
  damage: text(60),
  critical: text(20),
  range: text(40),
  damageType: text(40),
  notes: text(LONG),
});

const op1Ritual = z.object({
  id,
  name: z.string().max(120).default(''),
  element: text(30),
  circle: int(1, 4, 1),
  execution: text(60),
  range: text(60),
  target: text(120),
  duration: text(60),
  resistance: text(120),
  description: text(LONG),
  discente: text(LONG),
  verdadeiro: text(LONG),
  /** Rolagem opcional (ex.: dano) — expressão de dados. */
  roll: text(60),
  ref: z.string().max(80).default(''),
});

const op1Item = z.object({
  id,
  name: z.string().max(120).default(''),
  kind: z.enum(['arma', 'municao', 'protecao', 'geral', 'amaldicoado']).default('geral'),
  category: int(0, 4, 0),
  spaces: z.number().min(0).max(20).default(1),
  /** Ex.: "Armas Táticas · Corpo a Corpo · Duas Mãos". */
  details: text(200),
  damage: text(60),
  critical: text(20),
  damageType: text(40),
  defense: int(0, 50, 0),
  description: text(LONG),
  ref: z.string().max(80).default(''),
  /** Itens equipados aplicam seus bônus (ex.: proteção soma na Defesa). */
  equipped: z.boolean().default(true),
});

const op1Resource = z.object({ current: int(-999, 9999, 0) });

export const op1SheetSchema = z.object({
  portrait,
  origin: text(80),
  /** Origem do catálogo (vazio = origem personalizada, só texto). */
  originId: z.string().max(80).default(''),
  classId: z.enum(['combatente', 'especialista', 'ocultista', 'sobrevivente']).default('combatente'),
  trail: text(80),
  /** Trilha do catálogo (vazio = personalizada). */
  trailId: z.string().max(80).default(''),
  nex: int(0, 99, 5),
  /** Estágio (1–5) — apenas para a classe sobrevivente. */
  stage: int(1, 5, 1),
  /** Regra opcional "Nível de Experiência" (1–20). 0 = regra padrão (benefícios pelo NEX). */
  xpLevel: int(0, 20, 0),
  attributes: z
    .object({ agi: int(0, 7, 1), for: int(0, 7, 1), int: int(0, 7, 1), pre: int(0, 7, 1), vig: int(0, 7, 1) })
    .default({}),
  pv: op1Resource.default({ current: 0 }),
  pe: op1Resource.default({ current: 0 }),
  san: op1Resource.default({ current: 0 }),
  pd: op1Resource.default({ current: 0 }),
  /** Ajustes manuais nos máximos (habilidades, origens etc.). */
  bonus: z
    .object({
      pv: int(-999, 999, 0),
      pe: int(-999, 999, 0),
      san: int(-999, 999, 0),
      pd: int(-999, 999, 0),
      peLimit: int(-20, 20, 0),
      ritualDt: int(-20, 20, 0),
      load: int(-50, 50, 0),
    })
    .default({}),
  movement: z.string().max(40).default('9m / 6q'),
  defense: z.object({ equipment: int(-50, 50, 0), other: int(-50, 50, 0) }).default({}),
  protection: text(120),
  resistances: text(300),
  proficiencies: text(300),
  skills: z.record(z.string(), op1SkillSchema).default({}),
  attacks: z.array(op1Attack).max(MAX_LIST).default([]),
  abilities: z.array(ability).max(MAX_LIST).default([]),
  rituals: z.array(op1Ritual).max(MAX_LIST).default([]),
  inventory: z
    .object({
      prestige: int(0, 99999, 0),
      items: z.array(op1Item).max(MAX_LIST).default([]),
    })
    .default({}),
  description: z
    .object({
      notes: text(LONG),
      appearance: text(LONG),
      personality: text(LONG),
      history: text(LONG),
      objective: text(LONG),
    })
    .default({}),
});

export type Op1SheetData = z.output<typeof op1SheetSchema>;
export type Op1Attack = z.output<typeof op1Attack>;
export type Op1Ritual = z.output<typeof op1Ritual>;
export type Op1Item = z.output<typeof op1Item>;
export type SheetAbility = z.output<typeof ability>;

export function op1Skill(data: Op1SheetData, skillId: string): { training: 0 | 5 | 10 | 15; other: number } {
  return data.skills[skillId] ?? { training: 0, other: 0 };
}

export interface Op1EffectSource {
  /** De onde vem o bônus (ex.: "Sangue de Ferro", "Proteção leve"). */
  label: string;
  kind: 'origem' | 'trilha' | 'habilidade' | 'item';
  effects: Effects;
}

export interface Op1Derived {
  /** Quantos "novos níveis" (NEX acima de 5% ou estágios acima do 1º). */
  levels: number;
  /** Passos de NEX (5% = 1 … 99% = 20) usados por efeitos "por NEX". */
  steps: number;
  pvMax: number;
  peMax: number;
  sanMax: number;
  pdMax: number;
  peLimit: number;
  defense: number;
  /** Parte da Defesa que vem de itens equipados. */
  defenseItems: number;
  dodge: number;
  block: number;
  loadMax: number;
  loadUsed: number;
  overloaded: boolean;
  ritualDt: number;
  patent: (typeof OP1_PATENTS)[number];
  itemsByCategory: [number, number, number, number];
  skillBonus: Record<string, number>;
  /** Grau efetivo de treino (o maior entre o marcado e o recebido pela origem). */
  training: Record<string, 0 | 5 | 10 | 15>;
  /** Perícias treinadas automaticamente pela origem. */
  originSkills: string[];
  /** Bônus automáticos aplicados e de onde vieram. */
  sources: Op1EffectSource[];
  /** Soma de todos os bônus automáticos. */
  effects: Effects;
}

const SAVES = ['fortitude', 'reflexos', 'vontade'];

/** Valores calculados da ficha de Ordem 1, incluindo efeitos do catálogo. */
export function op1Derive(d: Op1SheetData): Op1Derived {
  const cls = OP1_CLASSES[d.classId as Op1ClassId];
  const a = d.attributes;
  // Regra opcional "Nível de Experiência": o nível substitui o NEX nos benefícios.
  const useXp = !cls.survivor && d.xpLevel > 0;
  const levels = cls.survivor
    ? d.stage - 1
    : useXp
      ? d.xpLevel - 1
      : d.nex >= 99
        ? 19
        : Math.max(0, Math.floor(d.nex / 5) - 1);
  const steps = cls.survivor ? 0 : levels + 1;
  const perVig = cls.survivor ? 0 : a.vig;
  const perPre = cls.survivor ? 0 : a.pre;
  const ctxBase = { steps, nex: d.nex, stage: cls.survivor ? d.stage : 0, attrs: a, affinity: false };

  // ---- efeitos automáticos (origem, trilha, habilidades, itens equipados)
  const sources: Op1EffectSource[] = [];
  const origin = findOrigin(d.originId);
  if (origin?.power.effect) sources.push({ label: origin.power.name, kind: 'origem', effects: origin.power.effect(ctxBase) });
  const trail = findTrail(d.trailId);
  if (trail && trail.classId === d.classId) {
    const reached = cls.survivor ? d.stage : useXp ? d.xpLevel * 5 : d.nex;
    for (const ab of trail.abilities) {
      if (ab.effect && (ab.nex ?? 0) <= reached) sources.push({ label: ab.name, kind: 'trilha', effects: ab.effect(ctxBase) });
    }
  }
  for (const entry of d.abilities) {
    const ab = findAbility(entry.ref);
    if (ab?.effect) sources.push({ label: ab.name, kind: 'habilidade', effects: ab.effect({ ...ctxBase, affinity: entry.affinity }) });
  }
  let defenseItems = 0;
  for (const item of d.inventory.items) {
    if (item.kind === 'protecao' && item.equipped && item.defense) {
      defenseItems += item.defense;
      sources.push({ label: item.name, kind: 'item', effects: { defense: item.defense } });
    }
  }
  const fx = sources.reduce<Effects>((acc, s) => addEffects(acc, s.effects), {});
  const fxSkill = (id: string) => (fx.skills?.[id] ?? 0) + (SAVES.includes(id) ? (fx.saves ?? 0) : 0);

  // Sobrecarregado: −5 na Defesa e nas perícias afetadas por carga.
  const loadMax = (a.for > 0 ? a.for * 5 : 2) + d.bonus.load + (fx.load ?? 0);
  const loadUsed = d.inventory.items.reduce((sum, i) => sum + i.spaces, 0);
  const overloaded = loadUsed > loadMax;

  const originSkills = origin?.skills ?? [];
  const training: Record<string, 0 | 5 | 10 | 15> = {};
  const skillBonus: Record<string, number> = {};
  for (const s of OP1_SKILLS) {
    const sk = op1Skill(d, s.id);
    const t = (originSkills.includes(s.id) ? Math.max(sk.training, 5) : sk.training) as 0 | 5 | 10 | 15;
    training[s.id] = t;
    skillBonus[s.id] = t + sk.other + fxSkill(s.id) - (overloaded && s.load ? 5 : 0);
  }

  const baseLimit = cls.survivor ? 1 : useXp ? d.xpLevel : d.nex >= 99 ? 20 : Math.floor(d.nex / 5);
  const peLimit = Math.max(1, baseLimit + d.bonus.peLimit + (fx.peLimit ?? 0));
  // fx.defense já inclui as proteções equipadas (defenseItems) e as habilidades.
  const defense = 10 + a.agi + d.defense.equipment + d.defense.other + (fx.defense ?? 0) - (overloaded ? 5 : 0);
  const patent = [...OP1_PATENTS].reverse().find((p) => d.inventory.prestige >= p.minPrestige) ?? OP1_PATENTS[0];
  const itemsByCategory: [number, number, number, number] = [0, 0, 0, 0];
  for (const item of d.inventory.items) if (item.category >= 1) itemsByCategory[item.category - 1]++;

  // Na regra de Determinação, bônus de PE passam a valer para PD.
  const peFx = fx.pe ?? 0;
  return {
    levels,
    steps,
    pvMax: cls.pv[0] + a.vig + levels * (cls.pv[1] + perVig) + d.bonus.pv + (fx.pv ?? 0),
    peMax: cls.pe[0] + a.pre + levels * (cls.pe[1] + perPre) + d.bonus.pe + peFx,
    sanMax: cls.san[0] + levels * cls.san[1] + d.bonus.san + (fx.san ?? 0),
    pdMax: cls.pd[0] + a.pre + levels * (cls.pd[1] + perPre) + d.bonus.pd + (fx.pd ?? 0) + peFx,
    peLimit,
    defense,
    defenseItems,
    dodge: defense + skillBonus.reflexos,
    block: skillBonus.fortitude,
    loadMax,
    loadUsed,
    overloaded,
    ritualDt: 10 + peLimit + a.pre + d.bonus.ritualDt + (fx.ritualDt ?? 0),
    patent,
    itemsByCategory,
    skillBonus,
    training,
    originSkills,
    sources,
    effects: fx,
  };
}

/**
 * Expressão de dados de um teste de Ordem 1: rola N d20 (N = atributo) e fica
 * com o maior; com atributo 0 (ou menos), rola 2 − N dados e fica com o menor.
 */
export function op1TestExpression(attrValue: number, bonus: number, extraDice = 0): string {
  const n = attrValue + extraDice;
  const dice = n >= 1 ? `${n}d20kh1` : `${2 - n}d20kl1`;
  if (!bonus) return dice;
  return bonus > 0 ? `${dice}+${bonus}` : `${dice}-${-bonus}`;
}

export function op1AttrOf(skillId: string): Op1Attr {
  return OP1_SKILLS.find((s) => s.id === skillId)?.attr ?? 'agi';
}

// ---------------------------------------------------------------------------
// Ordem 2 (playtest)
// ---------------------------------------------------------------------------
export const op2SheetSchema = z.object({
  portrait,
  /** Linha livre abaixo do nome (conceito/origem). */
  concept: text(120),
  /** Perfil (ex.: o selo verde da ficha). */
  profile: text(60),
  level: int(1, 10, 1),
  attributes: z
    .object({ fisico: dieSize.default(6), mente: dieSize.default(6), emocao: dieSize.default(6) })
    .default({}),
  pv: z.object({ current: int(-999, 9999, 10), max: int(0, 9999, 10), dt: int(0, 99, 7) }).default({}),
  pd: z.object({ current: int(-999, 9999, 10), max: int(0, 9999, 10), dt: int(0, 99, 7) }).default({}),
  bonusDice: z.array(dieSize.nullable()).length(2).default([null, null]),
  skillSteps: int(-5, 5, 0),
  fear: z
    .object({ die: dieSize.default(6), active: z.boolean().default(false), asBonus: z.boolean().default(false) })
    .default({}),
  skills: z.record(z.string(), dieSize).default({}),
  armorPoints: int(0, 999, 0),
  abilities: z.array(ability).max(MAX_LIST).default([]),
  equipment: z
    .array(z.object({ id, name: z.string().max(120).default(''), description: text(LONG) }))
    .max(MAX_LIST)
    .default([]),
  notes: text(LONG),
});

export type Op2SheetData = z.output<typeof op2SheetSchema>;

export function op2SkillDie(d: Op2SheetData, skillId: string): DieSize {
  return d.skills[skillId] ?? 4;
}

// ---------------------------------------------------------------------------
// Criatura / ameaça (só o mestre vê). Campos de rolagem aceitam "3O+10".
// ---------------------------------------------------------------------------
const creatureAction = z.object({
  id,
  kind: z.enum(['padrão', 'movimento', 'completa', 'reação', 'livre']).default('padrão'),
  name: z.string().max(120).default(''),
  /** Teste de ataque (ex.: "3O+10"). */
  test: text(60),
  /** Dano (ex.: "2d6+6"). */
  damage: text(60),
  damageType: text(40),
  description: text(LONG),
});

export const creatureSheetSchema = z.object({
  portrait,
  element: text(40),
  vd: int(0, 9999, 0),
  size: text(40),
  presence: z.object({ dt: int(0, 99, 0), damage: text(40), immunity: text(60) }).default({}),
  senses: text(200),
  perception: text(40),
  initiative: text(40),
  defense: int(0, 99, 10),
  saves: z.object({ fortitude: text(40), reflexos: text(40), vontade: text(40) }).default({}),
  pv: z.object({ current: int(-9999, 99999, 10), max: int(0, 99999, 10) }).default({}),
  attributes: z
    .object({ agi: int(0, 9, 1), for: int(0, 9, 1), int: int(0, 9, 1), pre: int(0, 9, 1), vig: int(0, 9, 1) })
    .default({}),
  movement: z.string().max(40).default('9m'),
  resistances: text(300),
  vulnerabilities: text(300),
  immunities: text(300),
  skills: z
    .array(z.object({ id, name: z.string().max(60).default(''), roll: text(40) }))
    .max(MAX_LIST)
    .default([]),
  actions: z.array(creatureAction).max(MAX_LIST).default([]),
  notes: text(LONG),
});

export type CreatureSheetData = z.output<typeof creatureSheetSchema>;
export type CreatureAction = z.output<typeof creatureAction>;

// ---------------------------------------------------------------------------
// Ficha genérica
// ---------------------------------------------------------------------------
export type SheetSystem = GameSystem | 'creature';
export type SheetData = Op1SheetData | Op2SheetData | CreatureSheetData;

export interface Sheet {
  id: string;
  campaignId: string;
  /** Jogador dono da ficha (null = ficha do mestre / NPC). */
  ownerId: string | null;
  system: SheetSystem;
  name: string;
  data: SheetData;
  updatedAt: string;
}

export interface CreatureSheet extends Sheet {
  system: 'creature';
  data: CreatureSheetData;
}

export interface Op1Sheet extends Sheet {
  system: 'op1';
  data: Op1SheetData;
}
export interface Op2Sheet extends Sheet {
  system: 'op2';
  data: Op2SheetData;
}

export function sheetSchemaFor(system: SheetSystem) {
  return system === 'op1' ? op1SheetSchema : system === 'op2' ? op2SheetSchema : creatureSheetSchema;
}

/** Ficha nova (valores padrão) já com recursos cheios. */
export function newSheetData(system: SheetSystem): SheetData {
  if (system === 'op2') return op2SheetSchema.parse({});
  if (system === 'creature') return creatureSheetSchema.parse({});
  const data = op1SheetSchema.parse({});
  const derived = op1Derive(data);
  data.pv.current = derived.pvMax;
  data.pe.current = derived.peMax;
  data.san.current = derived.sanMax;
  data.pd.current = derived.pdMax;
  return data;
}

export const createSheetSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do personagem').max(80),
  /** Apenas o mestre escolhe o dono; jogadores sempre criam a própria ficha. */
  ownerId: id.nullable().optional(),
  /** Mestre: cria uma ficha de criatura em vez de personagem. */
  creature: z.boolean().optional(),
});

export const updateSheetSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80).optional(),
  ownerId: id.nullable().optional(),
  /** Seções de primeiro nível a substituir (ex.: { skills: {...} }). */
  patch: z.record(z.string(), z.unknown()).default({}),
});

export type CreateSheetInput = z.input<typeof createSheetSchema>;
export type UpdateSheetInput = z.input<typeof updateSheetSchema>;
