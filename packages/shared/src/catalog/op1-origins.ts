import type { CatalogOrigin } from './types';

const P = (page: number) => `OPRPG p. ${page}`;

function origin(
  id: string,
  name: string,
  skills: string[],
  page: number,
  power: { name: string; summary: string; effect?: CatalogOrigin['power']['effect']; cost?: string },
  skillsNote?: string,
): CatalogOrigin {
  return {
    id,
    name,
    skills,
    skillsNote,
    page: P(page),
    power: { id: `origem-${id}`, kind: 'origem', group: name, page: P(page), ...power },
  };
}

/** Origens do livro básico. Resumos próprios; texto completo nas páginas indicadas. */
export const OP1_ORIGINS: CatalogOrigin[] = [
  origin('academico', 'Acadêmico', ['ciencias', 'investigacao'], 16, {
    name: 'Saber é Poder',
    cost: '2 PE',
    summary: 'Gaste 2 PE num teste de Intelecto para receber +5.',
  }),
  origin('agente-de-saude', 'Agente de Saúde', ['intuicao', 'medicina'], 16, {
    name: 'Técnica Medicinal',
    summary: 'Suas curas recuperam PV extras iguais ao seu Intelecto.',
  }),
  origin(
    'amnesico',
    'Amnésico',
    [],
    16,
    {
      name: 'Vislumbres do Passado',
      summary: '1×/sessão, teste de Intelecto (DT 10) para reconhecer algo do passado; se passar, ganha 1d4 PE temporários.',
    },
    'Duas perícias à escolha do mestre',
  ),
  origin('artista', 'Artista', ['artes', 'enganacao'], 17, {
    name: 'Magnum Opus',
    summary: '1×/missão, alguém numa cena social reconhece sua obra: +5 em testes de Presença contra essa pessoa.',
  }),
  origin('atleta', 'Atleta', ['acrobacia', 'atletismo'], 17, {
    name: '110%',
    cost: '2 PE',
    summary: 'Gaste 2 PE num teste de Força ou Agilidade (exceto Luta e Pontaria) para receber +5.',
  }),
  origin('chef', 'Chef', ['fortitude', 'profissao'], 17, {
    name: 'Ingrediente Secreto',
    summary: 'No interlúdio, seu prato conta como dois pratos para quem se alimentar com você.',
  }, 'Profissão (cozinheiro)'),
  origin('criminoso', 'Criminoso', ['crime', 'furtividade'], 17, {
    name: 'O Crime Compensa',
    summary: 'Guarda um item encontrado na missão para a próxima, sem contar no limite da patente.',
  }),
  origin('cultista-arrependido', 'Cultista Arrependido', ['ocultismo', 'religiao'], 18, {
    name: 'Traços do Outro Lado',
    summary: 'Começa com um poder paranormal à escolha, mas com metade da Sanidade inicial.',
  }),
  origin('desgarrado', 'Desgarrado', ['fortitude', 'sobrevivencia'], 18, {
    name: 'Calejado',
    summary: '+1 PV para cada 5% de NEX.',
    effect: ({ steps }) => ({ pv: steps }),
  }),
  origin('engenheiro', 'Engenheiro', ['profissao', 'tecnologia'], 18, {
    name: 'Ferramenta Favorita',
    summary: 'Um item à escolha (exceto armas) conta como uma categoria abaixo.',
  }),
  origin('executivo', 'Executivo', ['diplomacia', 'profissao'], 18, {
    name: 'Processo Otimizado',
    cost: '2 PE',
    summary: 'Em testes estendidos ou ao revisar documentos, gaste 2 PE para receber +5.',
  }),
  origin('investigador', 'Investigador', ['investigacao', 'percepcao'], 19, {
    name: 'Faro para Pistas',
    cost: '1 PE',
    summary: '1×/cena, ao procurar pistas, gaste 1 PE para receber +5.',
  }),
  origin('lutador', 'Lutador', ['luta', 'reflexos'], 19, {
    name: 'Mão Pesada',
    summary: '+2 nas rolagens de dano corpo a corpo.',
  }),
  origin('magnata', 'Magnata', ['diplomacia', 'pilotagem'], 19, {
    name: 'Patrocinador da Ordem',
    summary: 'Seu limite de crédito conta como um nível acima.',
  }),
  origin('mercenario', 'Mercenário', ['iniciativa', 'intimidacao'], 19, {
    name: 'Posição de Combate',
    cost: '2 PE',
    summary: 'No 1º turno de uma cena de ação, gaste 2 PE para ganhar uma ação de movimento extra.',
  }),
  origin('militar', 'Militar', ['pontaria', 'tatica'], 19, {
    name: 'Para Bellum',
    summary: '+2 nas rolagens de dano com armas de fogo.',
  }),
  origin('operario', 'Operário', ['fortitude', 'profissao'], 20, {
    name: 'Ferramenta de Trabalho',
    summary: 'Escolha uma arma simples/tática ligada à sua profissão: sabe usá-la e recebe bônus com ela.',
  }),
  origin('policial', 'Policial', ['percepcao', 'pontaria'], 20, {
    name: 'Patrulha',
    summary: '+2 na Defesa.',
    effect: () => ({ defense: 2 }),
  }),
  origin('religioso', 'Religioso', ['religiao', 'vontade'], 20, {
    name: 'Acalentar',
    summary: '+5 em Religião para acalmar; quem você acalma recupera 1d6 + Presença de Sanidade.',
  }),
  origin('servidor-publico', 'Servidor Público', ['intuicao', 'vontade'], 20, {
    name: 'Espírito Cívico',
    cost: '1 PE',
    summary: 'Ao ajudar alguém, gaste 1 PE para aumentar o bônus concedido em +2.',
  }),
  origin('teorico-da-conspiracao', 'Teórico da Conspiração', ['investigacao', 'ocultismo'], 21, {
    name: 'Eu Já Sabia',
    summary: 'Resistência a dano mental igual ao seu Intelecto.',
  }),
  origin('ti', 'T.I.', ['investigacao', 'tecnologia'], 21, {
    name: 'Motor de Busca',
    cost: '2 PE',
    summary: 'Com internet, gaste 2 PE para trocar um teste de perícia por Tecnologia (a critério do mestre).',
  }),
  origin('trabalhador-rural', 'Trabalhador Rural', ['adestramento', 'sobrevivencia'], 21, {
    name: 'Desbravador',
    cost: '2 PE',
    summary: 'Gaste 2 PE em Adestramento ou Sobrevivência para +5; ignora terreno difícil.',
  }),
  origin('trambiqueiro', 'Trambiqueiro', ['crime', 'enganacao'], 21, {
    name: 'Impostor',
    cost: '2 PE',
    summary: '1×/cena, gaste 2 PE para trocar um teste de perícia por Enganação.',
  }),
  origin('universitario', 'Universitário', ['atualidades', 'investigacao'], 21, {
    name: 'Dedicação',
    summary: '+1 PE, mais +1 PE a cada NEX ímpar (15%, 25%…), e +1 no limite de PE por turno.',
    effect: ({ steps }) => ({ pe: 1 + (steps >= 3 ? Math.floor((steps - 1) / 2) : 0), peLimit: 1 }),
  }),
  origin('vitima', 'Vítima', ['reflexos', 'vontade'], 21, {
    name: 'Cicatrizes Psicológicas',
    summary: '+1 de Sanidade para cada 5% de NEX.',
    effect: ({ steps }) => ({ san: steps }),
  }),
];
