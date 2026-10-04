import * as THREE from 'three';
import { AZUL, VERDE, VERMELHO, PRETO, Rotulo, Painel, traco, aro, disco } from './util.js';

const R = 1; // raio do mostrador

/** Posicao na volta completa (0 no topo, sentido horario) -> ponto. */
function noMostrador(fracao, proporcao) {
  const a = fracao * 2 * Math.PI;
  return [R * proporcao * Math.sin(a), R * proporcao * Math.cos(a)];
}

/**
 * Base dos relogios: mostrador com marcacoes. Cada relogio concreto diz
 * quantas marcacoes cabem em uma volta e como posicionar os ponteiros.
 */
class Relogio extends Painel {
  constructor(titulo, marcacoes, rotulo, rotuloExterno) {
    super(2.9);
    const cena = this.cena;
    cena.add(aro(R, 0.012));

    const t = new Rotulo(titulo, 0.09);
    t.position.set(0, 1.36, 0);
    cena.add(t);

    for (let m = 0; m < marcacoes; m++) {
      const f = m / marcacoes;
      const reforcado = m % (marcacoes / 4) === 0;
      const [x1, y1] = noMostrador(f, 0.9), [x2, y2] = noMostrador(f, 1);
      cena.add(traco(x1, y1, x2, y2, reforcado ? 0.024 : 0.012));
      const r = new Rotulo(rotulo(m), 0.085);
      r.position.set(...noMostrador(f, 0.8), 0);
      cena.add(r);
      const ext = rotuloExterno && rotuloExterno(m);
      if (ext) {
        const e = new Rotulo(ext, 0.07);
        e.position.set(...noMostrador(f, 1.15), 0);
        cena.add(e);
      }
    }
  }

  /** Ponteiro como retangulo com a base na origem; gira por rotation.z. */
  ponteiro(proporcao, espessura, cor) {
    const g = new THREE.PlaneGeometry(espessura, R * proporcao);
    g.translate(0, R * proporcao / 2, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: cor }));
    m.position.z = 1;
    this.cena.add(m);
    return m;
  }
}

function pos(ponteiro, fracao) {
  ponteiro.rotation.z = -fracao * 2 * Math.PI;
}

export class RelogioNorteOcidental extends Relogio {
  constructor() {
    super('RelogioNorteOcidental', 12, m => (m === 0 ? '12' : String(m)));
    this.h = this.ponteiro(0.5, 0.03, AZUL);
    this.m = this.ponteiro(0.75, 0.02, VERDE);
    this.s = this.ponteiro(0.9, 0.01, VERMELHO);
  }

  atualizar(agora) {
    const s = agora.getSeconds();
    const m = agora.getMinutes() + s / 60;
    const h = agora.getHours() % 12 + m / 60;
    pos(this.h, h / 12);
    pos(this.m, m / 60);
    pos(this.s, s / 60);
  }
}

/**
 * A hora do dia vira o angulo ja girado pela Terra (15 graus por hora), lido
 * em graus, minutos e segundos de arco.
 */
export class RelogioNorteOcidentalGlobal extends Relogio {
  constructor() {
    super('RelogioNorteOcidentalGlobal', 24, m => String(m), m => `${m * 15}°`);
    this.g = this.ponteiro(0.5, 0.03, AZUL);
    this.m = this.ponteiro(0.75, 0.02, VERDE);
    this.s = this.ponteiro(0.9, 0.01, VERMELHO);
  }

  atualizar(agora) {
    const dia = agora.getHours() * 3600 + agora.getMinutes() * 60 + agora.getSeconds() + agora.getMilliseconds() / 1000;
    const graus = dia / 3600 * 15;
    const minutosDeArco = (graus - Math.floor(graus)) * 60;
    const segundosDeArco = (minutosDeArco - Math.floor(minutosDeArco)) * 60;
    pos(this.g, graus / 360);
    pos(this.m, minutosDeArco / 60);
    pos(this.s, segundosDeArco / 60);
  }
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// na ordem em que comecam; datas fixas, como no desktop
const ESTACOES = [
  { nome: 'Verão', mes: 12, dia: 21, cor: 0xf09628 },
  { nome: 'Outono', mes: 3, dia: 20, cor: 0xaa6428 },
  { nome: 'Inverno', mes: 6, dia: 21, cor: 0x468cd2 },
  { nome: 'Primavera', mes: 9, dia: 22, cor: 0x3ca046 },
];

const MS_DIA = 86400000;
const inicioEm = (e, ano) => new Date(ano, e.mes - 1, e.dia);
const diaDoAno = d => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 1)) / MS_DIA) + 1;
const diasNoAno = ano => (ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0)) ? 366 : 365;
const fracaoDoAno = d => (diaDoAno(d) - 1) / diasNoAno(d.getFullYear());

export class RelogioEstacoes extends Relogio {
  constructor() {
    super('RelogioEstacoes', 12, m => MESES[m]);
    this.ano = null;
    this.ponteiroAno = this.ponteiro(0.85, 0.025, AZUL);
    this.estacao = new Rotulo('', 0.09);
    this.estacao.position.set(0, -1.28, 0);
    this.faltam = new Rotulo('', 0.075);
    this.faltam.position.set(0, -1.42, 0);
    this.cena.add(this.estacao, this.faltam);
    this.arcos = [];
  }

  /** Um arco colorido por fora do mostrador para cada estacao. */
  montarArcos(ano) {
    this.arcos.forEach(o => this.cena.remove(o));
    this.arcos = [];
    ESTACOES.forEach((e, i) => {
      const proxima = ESTACOES[(i + 1) % 4];
      const ini = fracaoDoAno(inicioEm(e, ano));
      let dur = fracaoDoAno(inicioEm(proxima, ano)) - ini;
      if (dur < 0) dur += 1;
      const arco = aro(R * 1.06, 0.03, e.cor, Math.PI / 2 - 2 * Math.PI * (ini + dur), 2 * Math.PI * dur);
      const meio = (ini + dur / 2);
      const nome = new Rotulo(e.nome, 0.085);
      nome.position.set(...noMostrador(meio, 0.42), 0);
      this.cena.add(arco, nome);
      this.arcos.push(arco, nome);
    });
    this.ano = ano;
  }

  atualizar(agora) {
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    if (this.ano !== hoje.getFullYear()) this.montarArcos(hoje.getFullYear());

    // antes do inicio do outono ainda e o verao de dezembro do ano anterior
    let atual = 0;
    ESTACOES.forEach((e, i) => { if (i > 0 && hoje >= inicioEm(e, hoje.getFullYear())) atual = i; });
    if (hoje >= inicioEm(ESTACOES[0], hoje.getFullYear())) atual = 0;
    const prox = (atual + 1) % 4;
    let proximoInicio = inicioEm(ESTACOES[prox], hoje.getFullYear());
    if (proximoInicio <= hoje) proximoInicio = inicioEm(ESTACOES[prox], hoje.getFullYear() + 1);
    const dias = Math.round((proximoInicio - hoje) / MS_DIA);

    pos(this.ponteiroAno, fracaoDoAno(hoje));
    this.estacao.setTexto(ESTACOES[atual].nome);
    this.faltam.setTexto(`faltam ${dias} dias para o ${ESTACOES[prox].nome}`);
  }
}
