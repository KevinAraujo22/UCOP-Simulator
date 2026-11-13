import type { CatalogItem } from './types';

const P = (page: number) => `OPRPG p. ${page}`;

function slug(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

/** [nome, categoria, dano, crítico, alcance, tipo, espaços, detalhes] */
type W = [string, number, string, string, string, string, number, string];

const WEAPONS: W[] = [
  ['Coronhada', 0, '1d4/1d6', 'x2', '', 'Impacto', 0, 'Simples · Corpo a corpo · Leve'],
  ['Faca', 0, '1d4', '19', 'Curto', 'Corte', 1, 'Simples · Corpo a corpo · Leve'],
  ['Martelo', 0, '1d6', 'x2', '', 'Impacto', 1, 'Simples · Corpo a corpo · Leve'],
  ['Punhal', 0, '1d4', 'x3', '', 'Perfuração', 1, 'Simples · Corpo a corpo · Leve'],
  ['Bastão', 0, '1d6/1d8', 'x2', '', 'Impacto', 1, 'Simples · Corpo a corpo · Uma mão'],
  ['Machete', 0, '1d6', '19', '', 'Corte', 1, 'Simples · Corpo a corpo · Uma mão'],
  ['Lança', 0, '1d6', 'x2', 'Curto', 'Perfuração', 1, 'Simples · Corpo a corpo · Uma mão'],
  ['Cajado', 0, '1d6/1d6', 'x2', '', 'Impacto', 2, 'Simples · Corpo a corpo · Duas mãos'],
  ['Arco', 0, '1d6', 'x3', 'Médio', 'Perfuração', 2, 'Simples · Disparo · Duas mãos · Flechas'],
  ['Besta', 0, '1d8', '19', 'Médio', 'Perfuração', 2, 'Simples · Disparo · Duas mãos · Flechas'],
  ['Pistola', 1, '1d12', '18', 'Curto', 'Balístico', 1, 'Simples · Fogo · Leve · Balas curtas'],
  ['Revólver', 1, '2d6', '19/x3', 'Curto', 'Balístico', 1, 'Simples · Fogo · Leve · Balas curtas'],
  ['Fuzil de caça', 1, '2d8', '19/x3', 'Médio', 'Balístico', 2, 'Simples · Fogo · Duas mãos · Balas longas'],
  ['Machadinha', 0, '1d6', 'x3', 'Curto', 'Corte', 1, 'Tática · Corpo a corpo · Leve'],
  ['Nunchaku', 0, '1d8', 'x2', '', 'Impacto', 1, 'Tática · Corpo a corpo · Leve'],
  ['Corrente', 0, '1d8', 'x2', '', 'Impacto', 1, 'Tática · Corpo a corpo · Uma mão'],
  ['Espada', 1, '1d8/1d10', '19', '', 'Corte', 1, 'Tática · Corpo a corpo · Uma mão'],
  ['Florete', 1, '1d6', '18', '', 'Corte', 1, 'Tática · Corpo a corpo · Uma mão'],
  ['Machado', 1, '1d8', 'x3', '', 'Corte', 1, 'Tática · Corpo a corpo · Uma mão'],
  ['Maça', 1, '2d4', 'x2', '', 'Impacto', 1, 'Tática · Corpo a corpo · Uma mão'],
  ['Acha', 1, '1d12', 'x3', '', 'Corte', 2, 'Tática · Corpo a corpo · Duas mãos'],
  ['Gadanho', 1, '2d4', 'x4', '', 'Corte', 2, 'Tática · Corpo a corpo · Duas mãos'],
  ['Katana', 1, '1d10', '19', '', 'Corte', 2, 'Tática · Corpo a corpo · Duas mãos'],
  ['Marreta', 1, '3d4', 'x2', '', 'Impacto', 2, 'Tática · Corpo a corpo · Duas mãos'],
  ['Montante', 1, '2d6', '19', '', 'Corte', 2, 'Tática · Corpo a corpo · Duas mãos'],
  ['Motosserra', 1, '3d6', 'x2', '', 'Corte', 2, 'Tática · Corpo a corpo · Duas mãos'],
  ['Arco composto', 1, '1d10', 'x3', 'Médio', 'Perfuração', 2, 'Tática · Disparo · Duas mãos · Flechas'],
  ['Balestra', 1, '1d12', '19', 'Médio', 'Perfuração', 2, 'Tática · Disparo · Duas mãos · Flechas'],
  ['Submetralhadora', 1, '2d6', '19/x3', 'Curto', 'Balístico', 1, 'Tática · Fogo · Uma mão · Balas curtas · Automática'],
  ['Espingarda', 1, '4d6', 'x3', 'Curto', 'Balístico', 2, 'Tática · Fogo · Duas mãos · Cartuchos'],
  ['Fuzil de assalto', 2, '2d10', '19/x3', 'Médio', 'Balístico', 2, 'Tática · Fogo · Duas mãos · Balas longas · Automática'],
  ['Fuzil de precisão', 3, '2d10', '19/x3', 'Longo', 'Balístico', 2, 'Tática · Fogo · Duas mãos · Balas longas'],
  ['Bazuca', 3, '10d8', 'x2', 'Médio', 'Impacto', 2, 'Pesada · Duas mãos · Foguete · Área'],
  ['Lança-chamas', 3, '6d6', 'x2', 'Curto', 'Fogo', 2, 'Pesada · Duas mãos · Combustível · Linha'],
  ['Metralhadora', 2, '2d12', '19/x3', 'Médio', 'Balístico', 2, 'Pesada · Duas mãos · Balas longas · Automática'],
];

const AMMO: [string, number, string][] = [
  ['Flechas', 0, 'Munição de arcos e bestas.'],
  ['Balas curtas', 0, 'Munição de pistolas, revólveres e submetralhadoras.'],
  ['Balas longas', 1, 'Munição de fuzis e metralhadoras.'],
  ['Cartuchos', 1, 'Munição de espingardas.'],
  ['Foguete', 1, 'Munição da bazuca (um disparo).'],
  ['Combustível', 1, 'Tanque do lança-chamas.'],
];

/** [nome, categoria, espaços, resumo] */
const GENERAL: [string, number, number, string][] = [
  ['Kit de perícia', 0, 1, 'Permite usar uma perícia que exige ferramentas sem penalidade.'],
  ['Utensílio', 1, 1, 'Acessório que dá +2 em uma perícia.'],
  ['Vestimenta', 1, 1, 'Roupa especial que dá +2 em uma perícia.'],
  ['Granada de atordoamento', 0, 1, 'Explosivo que atordoa quem estiver na área.'],
  ['Granada de fragmentação', 1, 1, 'Explosivo de dano em área.'],
  ['Granada de fumaça', 0, 1, 'Cria uma nuvem que obscurece a visão.'],
  ['Granada incendiária', 1, 1, 'Explosivo que causa dano de fogo e deixa os alvos em chamas.'],
  ['Mina antipessoal', 1, 1, 'Explosivo armado para disparar quando alguém se aproxima.'],
  ['Algemas', 0, 1, 'Prende os pulsos de uma pessoa.'],
  ['Arpéu', 0, 1, 'Gancho com corda para escalar e transpor obstáculos.'],
  ['Bandoleira', 1, 1, 'Facilita sacar itens rapidamente.'],
  ['Binóculos', 0, 1, 'Ajuda a observar à distância.'],
  ['Bloqueador de sinal', 1, 1, 'Interrompe comunicações sem fio por perto.'],
  ['Cicatrizante', 1, 1, 'Spray que cura PV rapidamente.'],
  ['Corda', 0, 1, 'Corda resistente para escaladas e amarras.'],
  ['Equipamento de sobrevivência', 0, 2, 'Kit para acampar e se virar em ambientes selvagens.'],
  ['Lanterna tática', 1, 1, 'Ilumina e pode ofuscar inimigos.'],
  ['Máscara de gás', 0, 1, 'Protege contra gases e fumaça.'],
  ['Mochila militar', 1, 0, 'Aumenta a capacidade de carga.'],
  ['Óculos de visão térmica', 1, 1, 'Enxerga calor, mesmo no escuro.'],
  ['Pé de cabra', 0, 1, 'Ajuda a forçar portas e caixas.'],
  ['Pistola de dardos', 1, 1, 'Dispara dardos tranquilizantes.'],
  ['Pistola sinalizadora', 0, 1, 'Dispara um sinalizador luminoso.'],
  ['Soqueira', 0, 1, 'Reforça ataques desarmados.'],
  ['Spray de pimenta', 1, 1, 'Pode cegar um alvo próximo.'],
  ['Taser', 1, 1, 'Choque que pode atordoar.'],
  ['Traje hazmat', 1, 2, 'Protege contra riscos químicos e biológicos.'],
];

const PARANORMAL: [string, number, number, string][] = [
  ['Amarras de (elemento)', 2, 1, 'Correntes que prendem criaturas do elemento.'],
  ['Câmera de aura paranormal', 2, 1, 'Fotografa auras paranormais.'],
  ['Componentes ritualísticos de (elemento)', 0, 1, 'Materiais para conjurar rituais do elemento.'],
  ['Emissor de pulsos paranormais', 2, 1, 'Emite pulsos que atraem ou afastam criaturas de um elemento.'],
  ['Escuta de ruídos paranormais', 2, 1, 'Capta sons do Outro Lado.'],
  ['Medidor de estabilidade da membrana', 2, 1, 'Mede o quão frágil a Membrana está no local.'],
  ['Scanner de manifestação paranormal de (elemento)', 2, 1, 'Indica a direção de manifestações do elemento (consome PE).'],
];

export const OP1_ITEMS: CatalogItem[] = [
  ...WEAPONS.map(([name, category, damage, critical, range, damageType, spaces, details]) => ({
    id: `arma-${slug(name)}`,
    name,
    kind: 'arma' as const,
    category,
    spaces,
    damage,
    critical,
    range,
    damageType,
    details,
    summary: `${details}. Dano ${damage}, crítico ${critical}${range ? `, alcance ${range.toLowerCase()}` : ''}.`,
    page: P(55),
  })),
  ...AMMO.map(([name, category, summary]) => ({
    id: `municao-${slug(name)}`,
    name,
    kind: 'municao' as const,
    category,
    spaces: 1,
    summary,
    page: P(55),
  })),
  {
    id: 'protecao-leve',
    name: 'Proteção leve',
    kind: 'protecao',
    category: 1,
    spaces: 2,
    defense: 5,
    details: 'Proteção leve',
    summary: 'Defesa +5.',
    page: P(62),
  },
  {
    id: 'protecao-pesada',
    name: 'Proteção pesada',
    kind: 'protecao',
    category: 2,
    spaces: 5,
    defense: 10,
    details: 'Proteção pesada',
    summary: 'Defesa +10 e resistência 2 a dano balístico, corte, impacto e perfuração. Penaliza perícias afetadas por carga.',
    page: P(62),
  },
  {
    id: 'protecao-escudo',
    name: 'Escudo',
    kind: 'protecao',
    category: 1,
    spaces: 2,
    defense: 2,
    details: 'Escudo · uma mão',
    summary: 'Defesa +2, acumula com outra proteção. Conta como proteção pesada para proficiência.',
    page: P(62),
  },
  ...GENERAL.map(([name, category, spaces, summary]) => ({
    id: `geral-${slug(name)}`,
    name,
    kind: 'geral' as const,
    category,
    spaces,
    summary,
    page: P(63),
  })),
  ...PARANORMAL.map(([name, category, spaces, summary]) => ({
    id: `paranormal-${slug(name)}`,
    name,
    kind: 'geral' as const,
    category,
    spaces,
    details: 'Item paranormal',
    summary,
    page: P(66),
  })),
];
