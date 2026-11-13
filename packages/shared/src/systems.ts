/**
 * Constantes de regras dos sistemas suportados. Apenas números e nomes de
 * termos do sistema — nenhum texto dos livros é reproduzido aqui.
 */

export type GameSystem = 'op1' | 'op2';

export const SYSTEM_LABELS: Record<GameSystem, string> = {
  op1: 'Ordem 1',
  op2: 'Ordem 2 (playtest)',
};

// ---------------------------------------------------------------------------
// Ordem 1
// ---------------------------------------------------------------------------
export const OP1_ATTRS = ['agi', 'for', 'int', 'pre', 'vig'] as const;
export type Op1Attr = (typeof OP1_ATTRS)[number];

export const OP1_ATTR_LABELS: Record<Op1Attr, { short: string; name: string }> = {
  agi: { short: 'AGI', name: 'Agilidade' },
  for: { short: 'FOR', name: 'Força' },
  int: { short: 'INT', name: 'Intelecto' },
  pre: { short: 'PRE', name: 'Presença' },
  vig: { short: 'VIG', name: 'Vigor' },
};

export interface Op1SkillDef {
  id: string;
  name: string;
  attr: Op1Attr;
  /** Só pode ser usada se treinada (marcada com * na ficha). */
  trainedOnly?: boolean;
  /** Sofre penalidade de carga (marcada com + na ficha). */
  load?: boolean;
}

export const OP1_SKILLS: Op1SkillDef[] = [
  { id: 'acrobacia', name: 'Acrobacia', attr: 'agi', load: true },
  { id: 'adestramento', name: 'Adestramento', attr: 'pre', trainedOnly: true },
  { id: 'artes', name: 'Artes', attr: 'pre', trainedOnly: true },
  { id: 'atletismo', name: 'Atletismo', attr: 'for' },
  { id: 'atualidades', name: 'Atualidades', attr: 'int' },
  { id: 'ciencias', name: 'Ciências', attr: 'int', trainedOnly: true },
  { id: 'crime', name: 'Crime', attr: 'agi', trainedOnly: true, load: true },
  { id: 'diplomacia', name: 'Diplomacia', attr: 'pre' },
  { id: 'enganacao', name: 'Enganação', attr: 'pre' },
  { id: 'fortitude', name: 'Fortitude', attr: 'vig' },
  { id: 'furtividade', name: 'Furtividade', attr: 'agi', load: true },
  { id: 'iniciativa', name: 'Iniciativa', attr: 'agi' },
  { id: 'intimidacao', name: 'Intimidação', attr: 'pre' },
  { id: 'intuicao', name: 'Intuição', attr: 'pre' },
  { id: 'investigacao', name: 'Investigação', attr: 'int' },
  { id: 'luta', name: 'Luta', attr: 'for' },
  { id: 'medicina', name: 'Medicina', attr: 'int' },
  { id: 'ocultismo', name: 'Ocultismo', attr: 'int', trainedOnly: true },
  { id: 'percepcao', name: 'Percepção', attr: 'pre' },
  { id: 'pilotagem', name: 'Pilotagem', attr: 'agi', trainedOnly: true },
  { id: 'pontaria', name: 'Pontaria', attr: 'agi' },
  { id: 'profissao', name: 'Profissão', attr: 'int', trainedOnly: true },
  { id: 'reflexos', name: 'Reflexos', attr: 'agi' },
  { id: 'religiao', name: 'Religião', attr: 'pre', trainedOnly: true },
  { id: 'sobrevivencia', name: 'Sobrevivência', attr: 'int' },
  { id: 'tatica', name: 'Tática', attr: 'int', trainedOnly: true },
  { id: 'tecnologia', name: 'Tecnologia', attr: 'int', trainedOnly: true },
  { id: 'vontade', name: 'Vontade', attr: 'pre' },
];

/** Graus de treinamento: leigo, treinado, veterano, expert. */
export const OP1_TRAINING = [
  { value: 0, label: 'Leigo' },
  { value: 5, label: 'Treinado' },
  { value: 10, label: 'Veterano' },
  { value: 15, label: 'Expert' },
] as const;

export type Op1ClassId = 'combatente' | 'especialista' | 'ocultista' | 'sobrevivente';

/** [inicial, por novo NEX/estágio]. Classes normais somam Vig/Pre aos PV/PE/PD. */
export interface Op1ClassDef {
  name: string;
  pv: [number, number];
  pe: [number, number];
  san: [number, number];
  /** Pontos de determinação (regra opcional de Sobrevivendo ao Horror). */
  pd: [number, number];
  /** Sobrevivente evolui por estágios e não soma atributos por nível. */
  survivor?: boolean;
}

export const OP1_CLASSES: Record<Op1ClassId, Op1ClassDef> = {
  combatente: { name: 'Combatente', pv: [20, 4], pe: [2, 2], san: [12, 3], pd: [6, 3] },
  especialista: { name: 'Especialista', pv: [16, 3], pe: [3, 3], san: [16, 4], pd: [8, 4] },
  ocultista: { name: 'Ocultista', pv: [12, 2], pe: [4, 4], san: [20, 5], pd: [10, 5] },
  sobrevivente: { name: 'Sobrevivente', pv: [8, 2], pe: [2, 1], san: [8, 2], pd: [4, 2], survivor: true },
};

export const OP1_NEX_VALUES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 99];

export const OP1_ELEMENTS = ['Sangue', 'Morte', 'Conhecimento', 'Energia', 'Medo'] as const;

export interface Op1PatentDef {
  name: string;
  minPrestige: number;
  credit: string;
  /** Limite de itens das categorias I, II, III e IV. */
  limits: [number, number, number, number];
}

export const OP1_PATENTS: Op1PatentDef[] = [
  { name: 'Recruta', minPrestige: 0, credit: 'Baixo', limits: [2, 0, 0, 0] },
  { name: 'Operador', minPrestige: 20, credit: 'Médio', limits: [3, 1, 0, 0] },
  { name: 'Agente especial', minPrestige: 50, credit: 'Médio', limits: [3, 2, 1, 0] },
  { name: 'Oficial de operações', minPrestige: 100, credit: 'Alto', limits: [3, 3, 2, 1] },
  { name: 'Agente de elite', minPrestige: 200, credit: 'Ilimitado', limits: [3, 3, 3, 2] },
];

export const OP1_ITEM_KINDS = [
  { id: 'arma', label: 'Arma' },
  { id: 'municao', label: 'Munição' },
  { id: 'protecao', label: 'Proteção' },
  { id: 'geral', label: 'Geral' },
  { id: 'amaldicoado', label: 'Item Amald.' },
] as const;
export type Op1ItemKind = (typeof OP1_ITEM_KINDS)[number]['id'];

// ---------------------------------------------------------------------------
// Ordem 2 (playtest)
// ---------------------------------------------------------------------------
export const DIE_SIZES = [4, 6, 8, 10, 12, 20] as const;
export type DieSize = (typeof DIE_SIZES)[number];

export const OP2_ATTRS = ['fisico', 'mente', 'emocao'] as const;
export type Op2Attr = (typeof OP2_ATTRS)[number];

export const OP2_ATTR_LABELS: Record<Op2Attr, string> = {
  fisico: 'Físico',
  mente: 'Mente',
  emocao: 'Emoção',
};

export interface Op2SkillDef {
  id: string;
  name: string;
  attr: Op2Attr;
}

export const OP2_SKILLS: Op2SkillDef[] = [
  { id: 'acrobacia', name: 'Acrobacia', attr: 'fisico' },
  { id: 'aptidao_artes', name: 'Aptidão (Artes)', attr: 'mente' },
  { id: 'aptidao_atualidades', name: 'Aptidão (Atualidades)', attr: 'mente' },
  { id: 'aptidao_burocracia', name: 'Aptidão (Burocracia)', attr: 'mente' },
  { id: 'aptidao_exatas', name: 'Aptidão (Exatas)', attr: 'mente' },
  { id: 'aptidao_humanas', name: 'Aptidão (Humanas)', attr: 'mente' },
  { id: 'aptidao_tatica', name: 'Aptidão (Tática)', attr: 'mente' },
  { id: 'atletismo', name: 'Atletismo', attr: 'fisico' },
  { id: 'crime', name: 'Crime', attr: 'fisico' },
  { id: 'disciplina', name: 'Disciplina', attr: 'emocao' },
  { id: 'enganacao', name: 'Enganação', attr: 'emocao' },
  { id: 'furtividade', name: 'Furtividade', attr: 'fisico' },
  { id: 'intimidacao', name: 'Intimidação', attr: 'emocao' },
  { id: 'intuicao', name: 'Intuição', attr: 'emocao' },
  { id: 'luta', name: 'Luta', attr: 'fisico' },
  { id: 'maquinas', name: 'Máquinas', attr: 'mente' },
  { id: 'medicina', name: 'Medicina', attr: 'mente' },
  { id: 'ocultismo', name: 'Ocultismo', attr: 'mente' },
  { id: 'percepcao', name: 'Percepção', attr: 'mente' },
  { id: 'persuasao', name: 'Persuasão', attr: 'emocao' },
  { id: 'pesquisa', name: 'Pesquisa', attr: 'mente' },
  { id: 'pontaria', name: 'Pontaria', attr: 'fisico' },
  { id: 'sobrevivencia', name: 'Sobrevivência', attr: 'mente' },
  { id: 'tecnologia', name: 'Tecnologia', attr: 'mente' },
  { id: 'vigor', name: 'Vigor', attr: 'fisico' },
];

/** Aumenta/diminui o dado em `steps` passos (d4 < d6 < d8 < d10 < d12; d20 só se já for d20). */
export function stepDie(die: DieSize, steps: number): DieSize {
  const idx = DIE_SIZES.indexOf(die);
  const maxIdx = Math.max(idx, DIE_SIZES.indexOf(12));
  const next = Math.min(maxIdx, Math.max(0, idx + steps));
  return DIE_SIZES[next];
}
