import type { Op1ClassId } from '../systems';
import type { CatalogAbility, CatalogTrail } from './types';

const P = (page: number) => `OPRPG p. ${page}`;
const SAH = (page: number) => `Sobrevivendo ao Horror p. ${page}`;

// ---------------------------------------------------------------------------
// Habilidades recebidas automaticamente pela classe (por NEX ou estágio)
// ---------------------------------------------------------------------------
type Feature = Omit<CatalogAbility, 'id' | 'kind' | 'group'> & { levels: number[] };

const COMMON = (cls: string): Feature[] => [
  { name: 'Aumento de Atributo', levels: [20, 50, 80, 95], page: '', summary: 'Aumente um atributo em +1 (máximo 5).' },
  { name: 'Grau de Treinamento', levels: [35, 70], page: '', summary: 'Algumas perícias treinadas sobem um grau (treinado → veterano → expert).' },
  { name: 'Versatilidade', levels: [50], page: '', summary: `Um poder de ${cls} ou o 1º poder de outra trilha da classe.` },
];

const FEATURES: Record<Op1ClassId, Feature[]> = {
  combatente: [
    {
      name: 'Ataque Especial',
      levels: [5],
      cost: '2 PE',
      page: P(24),
      summary: 'Gaste PE ao atacar para +5 no ataque ou no dano. Escala: 3 PE/+10 (25%), 4 PE/+15 (55%), 5 PE/+20 (85%).',
    },
    ...COMMON('combatente').map((f) => ({ ...f, page: P(26) })),
  ],
  especialista: [
    { name: 'Eclético', levels: [5], cost: '2 PE', page: P(28), summary: 'Gaste 2 PE para fazer um teste como se fosse treinado na perícia.' },
    {
      name: 'Perito',
      levels: [5],
      cost: '2 PE',
      page: P(28),
      summary: 'Em duas perícias treinadas (exceto Luta/Pontaria), gaste PE para somar +1d6. Escala até 5 PE/+1d12.',
    },
    { name: 'Engenhosidade', levels: [40, 75], page: P(30), summary: 'Com Eclético, pague PE extras para ter os benefícios de veterano (40%) ou expert (75%).' },
    ...COMMON('especialista').map((f) => ({ ...f, page: P(30) })),
  ],
  ocultista: [
    {
      name: 'Escolhido pelo Outro Lado',
      levels: [5, 25, 55, 85],
      page: P(32),
      summary: 'Conjura rituais; libera o 1º círculo em 5%, 2º em 25%, 3º em 55% e 4º em 85%. Começa com três rituais de 1º círculo.',
    },
    ...COMMON('ocultista').map((f) => ({ ...f, page: P(34) })),
  ],
  sobrevivente: [
    { name: 'Empenho', levels: [1], cost: '1 PE', page: SAH(31), summary: 'Gaste 1 PE num teste de perícia para receber +2.' },
    { name: 'Aumento de Atributo', levels: [3], page: SAH(31), summary: 'No 3º estágio, aumente um atributo em +1 (máximo 3).' },
    { name: 'Cicatrizado', levels: [5], page: SAH(31), summary: 'Um trauma de um perigo enfrentado; tem penalidade contra ele, mas também ganha força com isso.' },
  ],
};

/** Habilidades automáticas da classe até o NEX (ou estágio) atual. */
export function op1ClassFeatures(classId: Op1ClassId, level: number): CatalogAbility[] {
  return FEATURES[classId]
    .filter((f) => f.levels[0] <= level)
    .map((f) => ({
      id: `classe-${classId}-${f.name.toLowerCase().replace(/\s+/g, '-')}`,
      kind: 'classe' as const,
      group: classId,
      name: f.name,
      cost: f.cost,
      nex: f.levels[0],
      page: f.page,
      summary: f.summary,
    }));
}

// ---------------------------------------------------------------------------
// Poderes de classe
// ---------------------------------------------------------------------------
function power(group: string, page: number, name: string, summary: string, extra: Partial<CatalogAbility> = {}): CatalogAbility {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return { id: `poder-${group}-${slug}`, kind: 'poder', group, name, page: P(page), summary, ...extra };
}

const SHARED_POWERS = (group: string, page: number) => [
  power(group, page, 'Transcender', 'Recebe um poder paranormal, mas não ganha Sanidade neste aumento de NEX.'),
  power(group, page, 'Treinamento em Perícia', 'Torna-se treinado em duas perícias (a partir de 35%, pode subir o grau).'),
];

export const OP1_CLASS_POWERS: CatalogAbility[] = [
  // Combatente
  power('combatente', 25, 'Armamento Pesado', 'Proficiência com armas pesadas.', { prereq: 'For 2' }),
  power('combatente', 25, 'Artista Marcial', 'Ataques desarmados causam 1d6 (1d8 em 35%, 1d10 em 70%), letais e ágeis.'),
  power('combatente', 25, 'Ataque de Oportunidade', 'Reação + 1 PE para atacar quem sai do espaço adjacente.', { cost: '1 PE' }),
  power('combatente', 25, 'Combater com Duas Armas', 'Ao agredir com duas armas (uma leve), faz dois ataques com penalidade.', { prereq: 'Agi 3, treinado em Luta ou Pontaria' }),
  power('combatente', 25, 'Combate Defensivo', 'Ao agredir, sofre –1 dado no ataque e ganha +5 na Defesa até seu próximo turno.', { prereq: 'Int 2' }),
  power('combatente', 25, 'Golpe Demolidor', 'Ao quebrar ou atacar objetos, 1 PE para +2 dados de dano.', { cost: '1 PE', prereq: 'For 2, treinado em Luta' }),
  power('combatente', 25, 'Golpe Pesado', 'Armas corpo a corpo causam um dado de dano extra.'),
  power('combatente', 25, 'Incansável', '1×/cena, 2 PE para uma ação de investigação extra usando Força ou Agilidade.', { cost: '2 PE' }),
  power('combatente', 25, 'Presteza Atlética', 'Ao facilitar a investigação, 1 PE para usar Força ou Agilidade.', { cost: '1 PE' }),
  power('combatente', 25, 'Proteção Pesada', 'Proficiência com proteções pesadas.', { prereq: 'NEX 30%' }),
  power('combatente', 25, 'Reflexos Defensivos', '+2 na Defesa e em testes de resistência.', {
    prereq: 'Agi 2',
    effect: () => ({ defense: 2, saves: 2 }),
  }),
  power('combatente', 25, 'Saque Rápido', 'Saca ou guarda itens como ação livre.', { prereq: 'Treinado em Iniciativa' }),
  power('combatente', 25, 'Segurar o Gatilho', 'Ao acertar com arma de fogo, pode atacar de novo pagando PE crescente.', { prereq: 'NEX 60%' }),
  power('combatente', 26, 'Sentido Tático', 'Ação de movimento + 2 PE: bônus na Defesa e resistências igual ao Intelecto até o fim da cena.', {
    cost: '2 PE',
    prereq: 'Int 2, treinado em Percepção e Tática',
  }),
  power('combatente', 26, 'Tanque de Guerra', 'Com proteção pesada, a Defesa e a RD dela aumentam em +2.', { prereq: 'Proteção Pesada' }),
  power('combatente', 26, 'Tiro Certeiro', 'Com armas de disparo, soma Agilidade no dano e ignora a penalidade por combate corpo a corpo.', {
    prereq: 'Treinado em Pontaria',
  }),
  power('combatente', 26, 'Tiro de Cobertura', 'Ação padrão + 1 PE para forçar um alvo a se proteger.', { cost: '1 PE' }),
  ...SHARED_POWERS('combatente', 26),
  // Especialista
  power('especialista', 29, 'Artista Marcial', 'Ataques desarmados causam 1d6 (1d8 em 35%, 1d10 em 70%), letais e ágeis.'),
  power('especialista', 29, 'Balística Avançada', 'Proficiência com armas táticas de fogo e +2 no dano com armas de fogo.'),
  power('especialista', 29, 'Conhecimento Aplicado', '2 PE para trocar o atributo-base de uma perícia por Intelecto.', { cost: '2 PE', prereq: 'Int 2' }),
  power('especialista', 29, 'Hacker', '+5 em Tecnologia para invadir sistemas e faz isso mais rápido.', { prereq: 'Treinado em Tecnologia' }),
  power('especialista', 29, 'Mãos Rápidas', '1 PE para fazer um teste de Crime como ação livre.', { cost: '1 PE', prereq: 'Agi 3, treinado em Crime' }),
  power('especialista', 29, 'Mochila de Utilidades', 'Um item (exceto armas) conta uma categoria abaixo e ocupa 1 espaço a menos.'),
  power('especialista', 29, 'Movimento Tático', '1 PE para ignorar terreno difícil e escalada até o fim do turno.', { cost: '1 PE', prereq: 'Treinado em Atletismo' }),
  power('especialista', 29, 'Na Trilha Certa', 'Ao achar uma pista, 1 PE para +1 dado no próximo teste de investigação.', { cost: '1 PE' }),
  power('especialista', 29, 'Nerd', '1×/cena, 2 PE para um teste de Atualidades (DT 20) que revela uma informação útil.', { cost: '2 PE' }),
  power('especialista', 29, 'Ninja Urbano', 'Proficiência com armas táticas corpo a corpo e de disparo (exceto de fogo) e proteções leves.'),
  power('especialista', 29, 'Pensamento Ágil', '1×/rodada em investigação, 2 PE para procurar pistas mais uma vez.', { cost: '2 PE' }),
  power('especialista', 29, 'Perito em Explosivos', 'Soma Intelecto na DT dos seus explosivos e pode excluir alvos da explosão.'),
  power('especialista', 29, 'Primeira Impressão', '+2 dados no primeiro teste social (Diplomacia, Enganação, Intimidação ou Intuição) da cena.'),
  ...SHARED_POWERS('especialista', 29),
  // Ocultista
  power('ocultista', 33, 'Camuflar Ocultismo', 'Esconde símbolos e sigilos e conjura rituais sem deixar sinais aparentes.'),
  power('ocultista', 33, 'Criar Selo', 'Fabrica selos paranormais de rituais que conhece.'),
  power('ocultista', 33, 'Envolto em Mistério', 'Sua aparência assombrosa ajuda a manipular e assustar pessoas supersticiosas.'),
  power('ocultista', 33, 'Especialista em Elemento', 'Escolha um elemento: a DT dos seus rituais dele aumenta em +2.'),
  power('ocultista', 33, 'Ferramentas Paranormais', 'Reduz a categoria de um item paranormal e o ativa sem pagar PE.'),
  power('ocultista', 33, 'Fluxo de Poder', 'Mantém dois efeitos sustentados com uma única ação livre.', { prereq: 'NEX 60%' }),
  power('ocultista', 33, 'Identificação Paranormal', '+10 em Ocultismo para identificar criaturas, objetos e rituais.'),
  power('ocultista', 33, 'Improvisar Componentes', '1×/cena, ação completa e teste de Investigação (DT 15) para achar componentes de um elemento.'),
  power('ocultista', 33, 'Intuição Paranormal', 'Ao facilitar a investigação, soma Intelecto ou Presença no teste.'),
  power('ocultista', 33, 'Mestre em Elemento', 'Rituais do elemento escolhido custam –1 PE.', { prereq: 'Especialista em Elemento, NEX 45%' }),
  power('ocultista', 33, 'Ritual Potente', 'Soma Intelecto no dano ou na cura dos seus rituais.', { prereq: 'Int 2' }),
  power('ocultista', 33, 'Ritual Predileto', 'Um ritual conhecido custa –1 PE.'),
  power('ocultista', 33, 'Tatuagem Ritualística', 'Rituais pessoais com você como alvo custam –1 PE.'),
  ...SHARED_POWERS('ocultista', 33),
];

// ---------------------------------------------------------------------------
// Trilhas
// ---------------------------------------------------------------------------
function trail(
  classId: Op1ClassId,
  id: string,
  name: string,
  page: string,
  summary: string,
  abilities: [number, string, string, CatalogAbility['effect']?][],
): CatalogTrail {
  return {
    id,
    name,
    classId,
    page,
    summary,
    abilities: abilities.map(([nex, abName, abSummary, effect]) => ({
      id: `trilha-${id}-${nex}`,
      kind: 'trilha',
      group: name,
      name: abName,
      nex,
      page,
      summary: abSummary,
      effect,
    })),
  };
}

export const OP1_TRAILS: CatalogTrail[] = [
  // Combatente
  trail('combatente', 'aniquilador', 'Aniquilador', P(26), 'Especialista em uma arma favorita.', [
    [10, 'A Favorita', 'Escolha uma arma favorita: a categoria dela é reduzida em I.'],
    [40, 'Técnica Secreta', 'Categoria da favorita reduzida em II; 2 PE por ataque para efeitos extras (amplo, destruidor).'],
    [65, 'Técnica Sublime', 'Novos efeitos para a Técnica Secreta (letal, perfurante).'],
    [99, 'Máquina de Matar', 'Categoria reduzida em III, +2 na margem de ameaça e um dado de dano extra com a favorita.'],
  ]),
  trail('combatente', 'comandante-de-campo', 'Comandante de Campo', P(26), 'Coordena e fortalece os aliados em combate.', [
    [10, 'Inspirar Confiança', 'Reação + 2 PE para um aliado próximo rolar de novo um teste.'],
    [40, 'Estrategista', 'Ação padrão + PE para dar uma ação de movimento a aliados (limitado por Intelecto).'],
    [65, 'Brecha na Guarda', 'Quando um aliado causa dano, reação + 2 PE para outro aliado atacar o mesmo alvo.'],
    [99, 'Oficial Comandante', 'Ação padrão + 5 PE: aliados à vista recebem uma ação padrão adicional.'],
  ]),
  trail('combatente', 'guerreiro', 'Guerreiro', P(27), 'Transforma o corpo numa arma corpo a corpo.', [
    [10, 'Técnica Letal', '+2 na margem de ameaça em ataques corpo a corpo.'],
    [40, 'Revidar', 'Ao bloquear, reação + 2 PE para contra-atacar.'],
    [65, 'Força Opressora', 'Ao acertar corpo a corpo, 1 PE para derrubar ou empurrar como ação livre.'],
    [99, 'Potência Máxima', 'Bônus numéricos do Ataque Especial corpo a corpo são dobrados.'],
  ]),
  trail('combatente', 'operacoes-especiais', 'Operações Especiais', P(27), 'Eficiência e agilidade em combate.', [
    [10, 'Iniciativa Aprimorada', '+5 em Iniciativa e uma ação de movimento extra na primeira rodada.', () => ({ skills: { iniciativa: 5 } })],
    [40, 'Ataque Extra', '1×/rodada, 2 PE para um ataque adicional.'],
    [65, 'Surto de Adrenalina', '1×/rodada, 5 PE para uma ação padrão ou de movimento adicional.'],
    [99, 'Sempre Alerta', 'Uma ação padrão adicional no início de cada combate.'],
  ]),
  trail('combatente', 'tropa-de-choque', 'Tropa de Choque', P(27), 'Resiste a tudo e protege os aliados.', [
    [10, 'Casca Grossa', '+1 PV para cada 5% de NEX e soma Vigor na RD ao bloquear.', ({ steps }) => ({ pv: steps })],
    [40, 'Cai Dentro', 'Reação + 1 PE para forçar um inimigo a atacar você em vez de um aliado.'],
    [65, 'Duro de Matar', 'Reação + 2 PE para reduzir à metade um dano não paranormal.'],
    [99, 'Inquebrável', 'Machucado: +5 na Defesa e RD 5; morrendo, ainda age.'],
  ]),
  // Especialista
  trail('especialista', 'atirador-de-elite', 'Atirador de Elite', P(30), 'Precisão com armas de fogo de longo alcance.', [
    [10, 'Mira de Elite', 'Proficiência com armas de balas longas e soma Intelecto no dano com elas.'],
    [40, 'Disparo Letal', 'Ao mirar, 1 PE para +2 na margem de ameaça do próximo ataque.'],
    [65, 'Disparo Impactante', 'Com calibre grosso, 2 PE para fazer uma manobra em vez de causar dano.'],
    [99, 'Atirar para Matar', 'Acertos críticos com armas de fogo causam dano máximo.'],
  ]),
  trail('especialista', 'infiltrador', 'Infiltrador', P(30), 'Furtividade, invasão e golpes precisos.', [
    [10, 'Ataque Furtivo', '1×/rodada, 1 PE para +1d6 de dano contra alvo desprevenido ou flanqueado (+2d6 em 40%, +3d6 em 65%…).'],
    [40, 'Gatuno', '+5 em Atletismo e Crime e se esconde sem reduzir o deslocamento.', () => ({ skills: { atletismo: 5, crime: 5 } })],
    [65, 'Assassinar', 'Analisa um alvo (3 PE) para um ataque furtivo devastador.'],
    [99, 'Sombra Fugaz', '3 PE para não sofrer a penalidade de Furtividade após ações chamativas.'],
  ]),
  trail('especialista', 'medico-de-campo', 'Médico de Campo', P(30), 'Cuida dos feridos no meio do caos.', [
    [10, 'Paramédico', 'Ação padrão + 2 PE para curar 2d10 PV (aumenta com o NEX).'],
    [40, 'Equipe de Trauma', 'Ação padrão + 2 PE para remover uma condição negativa de um aliado.'],
    [65, 'Resgate', 'Aproxima-se de aliados feridos como ação livre; você e ele ganham +5 na Defesa ao curar.'],
    [99, 'Reanimação', '1×/cena, ação completa + 10 PE para trazer de volta um aliado que morreu na cena.'],
  ]),
  trail('especialista', 'negociador', 'Negociador', P(31), 'Domina conversas e manipulação.', [
    [10, 'Eloquência', 'Ação completa + PE para fascinar pessoas com a fala.'],
    [40, 'Discurso Motivador', 'Ação padrão + 4 PE para dar bônus aos aliados.'],
    [65, 'Eu Conheço um Cara', '1×/missão, pede um favor à sua rede de contatos.'],
    [99, 'Truque de Mestre', '5 PE para simular uma habilidade que viu um aliado usar.'],
  ]),
  trail('especialista', 'tecnico', 'Técnico', P(31), 'Equipamento, improviso e manutenção.', [
    [10, 'Inventário Otimizado', 'Soma Intelecto à Força para a capacidade de carga.', ({ attrs }) => ({ load: attrs.int * 5 })],
    [40, 'Remendão', 'Ação completa + 1 PE para consertar um item quebrado até o fim da cena.'],
    [65, 'Improvisar', 'Ação completa + 2 PE para improvisar um equipamento geral.'],
    [99, 'Preparado para Tudo', 'PE para “ter trazido” qualquer item (exceto armas) que precisar.'],
  ]),
  // Ocultista
  trail('ocultista', 'conduite', 'Conduíte', P(34), 'Amplia e manipula rituais.', [
    [10, 'Ampliar Ritual', '+2 PE para aumentar o alcance do ritual em um passo.'],
    [40, 'Acelerar Ritual', '1×/rodada, +4 PE para conjurar um ritual como ação livre.'],
    [65, 'Anular Ritual', 'Gaste PE para tentar anular um ritual lançado contra você.'],
    [99, 'Canalizar o Medo', 'Aprende o ritual Canalizar o Medo.'],
  ]),
  trail('ocultista', 'flagelador', 'Flagelador', P(34), 'Paga o preço do Outro Lado com o próprio corpo.', [
    [10, 'Poder do Flagelo', 'Paga o custo de rituais com PV em vez de PE.'],
    [40, 'Abraçar a Dor', 'Reação + 2 PE para reduzir à metade um dano não paranormal.'],
    [65, 'Absorver Agonia', 'Ao derrubar inimigos com rituais, ganha PE temporários.'],
    [99, 'Medo Tangível', 'Aprende o ritual Medo Tangível.'],
  ]),
  trail('ocultista', 'graduado', 'Graduado', P(35), 'Estudo profundo e grimórios.', [
    [10, 'Saber Ampliado', 'Aprende um ritual de 1º círculo e um extra a cada novo círculo.'],
    [40, 'Grimório Ritualístico', 'Cria um grimório com rituais extras.'],
    [65, 'Rituais Eficientes', '+5 na DT de todos os seus rituais.', () => ({ ritualDt: 5 })],
    [99, 'Conhecendo o Medo', 'Aprende o ritual Conhecendo o Medo.'],
  ]),
  trail('ocultista', 'intuitivo', 'Intuitivo', P(35), 'Mente resiliente diante do Outro Lado.', [
    [10, 'Mente Sã', 'Resistência paranormal +5 (testes contra efeitos paranormais).'],
    [40, 'Presença Poderosa', 'Soma Presença ao limite de PE, só para conjurar rituais.'],
    [65, 'Inabalável', 'Resistência 10 a dano mental e paranormal.'],
    [99, 'Presença do Medo', 'Aprende o ritual Presença do Medo.'],
  ]),
  trail('ocultista', 'lamina-paranormal', 'Lâmina Paranormal', P(35), 'Mistura combate corpo a corpo e rituais.', [
    [10, 'Lâmina Maldita', 'Aprende Amaldiçoar Arma (mais barato) e pode usar Ocultismo para atacar com a arma amaldiçoada.'],
    [40, 'Gladiador Paranormal', 'Ganha 2 PE temporários ao acertar ataques corpo a corpo.'],
    [65, 'Conjuração Marcial', '1×/rodada, 2 PE para atacar ao conjurar um ritual de ação padrão.'],
    [99, 'Lâmina do Medo', 'Aprende o ritual Lâmina do Medo.'],
  ]),
  // Sobrevivente (Sobrevivendo ao Horror) — "nex" aqui é o estágio
  trail('sobrevivente', 'durao', 'Durão', SAH(31), 'Resistente e protetor.', [
    [2, 'Durão', '+4 PV; +2 PV ao chegar ao 3º estágio.', ({ stage }) => ({ pv: (stage >= 2 ? 4 : 0) + (stage >= 3 ? 2 : 0) })],
    [4, 'Pancada Forte', '1 PE para +1 dado num teste de ataque.'],
  ]),
  trail('sobrevivente', 'esperto', 'Esperto', SAH(31), 'Conhecimento e persuasão.', [
    [2, 'Esperto', 'Torna-se treinado em uma perícia adicional.'],
    [4, 'Entendido', 'Em duas perícias treinadas, 1 PE para somar +1d4.'],
  ]),
  trail('sobrevivente', 'esoterico', 'Esotérico', SAH(31), 'Sensibilidade espiritual ao paranormal.', [
    [2, 'Esotérico', 'Ação padrão + 1 PE para sentir energias paranormais por perto.'],
    [4, 'Iniciado', 'Aprende e conjura um ritual de 1º círculo.'],
  ]),
];
