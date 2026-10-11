// O que a coluna de tempo e espaco calcula sozinha no navegador, so com a data:
// a estacao do ano e a posicao da Terra na orbita.

const MS_DIA = 86_400_000;

// na ordem em que comecam no hemisferio sul; as datas mudam um dia conforme o ano, aqui estao fixas
const ESTACOES = [
  { nome: 'Verão', mes: 12, dia: 21, cor: '#f09628' },
  { nome: 'Outono', mes: 3, dia: 20, cor: '#c98a4a' },
  { nome: 'Inverno', mes: 6, dia: 21, cor: '#68a8e8' },
  { nome: 'Primavera', mes: 9, dia: 22, cor: '#4cc062' },
];

const inicioEm = (e, ano) => new Date(ano, e.mes - 1, e.dia);

/** A estacao de uma data, de onde comecou ate onde acaba, e quanto falta para a proxima. */
export function estacaoDe(data) {
  const hoje = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const ano = hoje.getFullYear();

  // antes do outono ainda e o verao que comecou em dezembro do ano anterior
  let atual = 0;
  ESTACOES.forEach((e, i) => { if (i > 0 && hoje >= inicioEm(e, ano)) atual = i; });
  if (hoje >= inicioEm(ESTACOES[0], ano)) atual = 0;

  const proxima = (atual + 1) % 4;
  let inicio = inicioEm(ESTACOES[atual], ano);
  if (inicio > hoje) inicio = inicioEm(ESTACOES[atual], ano - 1);
  let fim = inicioEm(ESTACOES[proxima], ano);
  if (fim <= hoje) fim = inicioEm(ESTACOES[proxima], ano + 1);

  return {
    nome: ESTACOES[atual].nome, cor: ESTACOES[atual].cor, proxima: ESTACOES[proxima].nome,
    inicio, fim,
    diasQueFaltam: Math.round((fim - hoje) / MS_DIA),
    diasPassados: Math.round((hoje - inicio) / MS_DIA),
    progresso: Math.max(0, Math.min(1, (hoje - inicio) / (fim - inicio))),
  };
}

const EXCENTRICIDADE = 0.0167086;
const SEMI_EIXO_MAIOR_KM = 149_598_023;
const UA_EM_KM = 149_597_870.7;
const DIA_DO_PERIELIO = 3;
const DIAS_DO_ANO = 365.2425;

const diaDoAno = d => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 1)) / MS_DIA) + 1;
/** O dia do ano com fracao, em UTC: 1,0 e a meia-noite de 1 de janeiro. E continuo, entao a distancia ao Sol anda a cada segundo, e nao so uma vez por dia. */
export function diaDoAnoContinuo(ms) {
  const ano = new Date(ms).getUTCFullYear();
  return (ms - Date.UTC(ano, 0, 1)) / MS_DIA + 1;
}

export const distanciaEmKm = angulo => SEMI_EIXO_MAIOR_KM * (1 - EXCENTRICIDADE * Math.cos(angulo));

/**
 * Onde a Terra esta na orbita: a distancia ao Sol e quanto falta para o afelio.
 * Assume velocidade angular constante, entao e uma aproximacao: perto do Sol a
 * Terra corre um pouco mais.
 */
export function orbitaDaTerra(data) {
  let dias = diaDoAnoContinuo(+data) - DIA_DO_PERIELIO;
  if (dias < 0) dias += DIAS_DO_ANO;
  const angulo = dias / DIAS_DO_ANO * 2 * Math.PI;
  const km = distanciaEmKm(angulo);
  const minima = distanciaEmKm(0), maxima = distanciaEmKm(Math.PI);
  return {
    diaDoAno: diaDoAno(data), grausDesdeOPerielio: angulo * 180 / Math.PI,
    distanciaKm: km, distanciaUA: km / UA_EM_KM,
    minimaKm: minima, maximaKm: maxima, posicaoNaFaixa: (km - minima) / (maxima - minima),
  };
}
