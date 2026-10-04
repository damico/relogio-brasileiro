import * as THREE from 'three';
import { PRETO, Rotulo, Painel, linha, traco, disco, aro } from './util.js';

const EXCENTRICIDADE = 0.0167086;
const SEMI_EIXO_MAIOR_KM = 149_598_023;
const UA_EM_KM = 149_597_870.7;
const INCLINACAO_DO_EIXO = 23.44;
const DIA_DO_PERIELIO = 3;
const DIAS_DO_ANO = 365.2425;

const A = 1.0;                                    // semi eixo maior no mundo
const B = A * Math.sqrt(1 - EXCENTRICIDADE ** 2);
const FOCO = A * EXCENTRICIDADE;

const MARCOS = [
  { nome: 'Equinócio', quando: 'de março', efeito: 'eixo de lado', mes: 3, dia: 20, solsticio: false },
  { nome: 'Solstício', quando: 'de junho', efeito: 'Norte ao Sol', mes: 6, dia: 21, solsticio: true },
  { nome: 'Equinócio', quando: 'de setembro', efeito: 'eixo de lado', mes: 9, dia: 22, solsticio: false },
  { nome: 'Solstício', quando: 'de dezembro', efeito: 'Sul ao Sol', mes: 12, dia: 21, solsticio: true },
];

const diaDoAno = d => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1;

/** Angulo desde o perielio, em radianos, com velocidade angular constante (aproximacao). */
function anguloDesdeOPerielio(dia) {
  let dias = dia - DIA_DO_PERIELIO;
  if (dias < 0) dias += DIAS_DO_ANO;
  return dias / DIAS_DO_ANO * 2 * Math.PI;
}

const distanciaEmKm = angulo => SEMI_EIXO_MAIOR_KM * (1 - EXCENTRICIDADE * Math.cos(angulo));
const milhoesDeKm = km => `${(km / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} milhões de km`;
const naOrbita = a => [A * Math.cos(a), B * Math.sin(a)];

/**
 * Terra na orbita, com perielio, afelio, solsticios e equinocios, o
 * mostrador da distancia ate o Sol e a fase da Lua (esta vem do servidor).
 */
export class OrbitaTerraSol extends Painel {
  constructor() {
    super(2.9);
    const cena = this.cena;

    this.titulo = new Rotulo('', 0.075);
    this.titulo.position.set(0, 1.42, 0);
    const nomeTela = new Rotulo('OrbitaTerraSol', 0.09);
    nomeTela.position.set(0, 1.28, 0);
    this.titulo.position.set(0, 1.12, 0);
    cena.add(nomeTela, this.titulo);

    // orbita
    const pts = [];
    for (let i = 0; i <= 180; i++) pts.push(naOrbita(i / 180 * 2 * Math.PI));
    cena.add(linha(pts, 0x787878));

    this.sol = [FOCO, 0];
    const sol = disco(0.11, 0xffbe00, ...this.sol);
    const rotSol = new Rotulo('Sol', 0.07);
    rotSol.position.set(this.sol[0], -0.2, 0);
    cena.add(sol, rotSol);

    for (const lado of [1, -1]) {
      cena.add(traco(lado * A * 0.93, 0, lado * A * 1.07, 0, 0.012));
      const r = new Rotulo(lado === 1 ? 'Periélio (3 jan)' : 'Afélio (4 jul)', 0.065);
      r.position.set(lado * (A + 0.27), 0.075, 0);
      cena.add(r);
    }

    this.marcos = MARCOS.map(m => ({ ...m, rotulos: null }));
    this.terraHoje = new THREE.Group();
    this.terraHoje.add(disco(0.05, 0x005ac8), aro(0.068, 0.012));
    const rotTerra = new Rotulo('Terra hoje', 0.065);
    rotTerra.position.set(0, -0.16, 0);
    this.terraHoje.add(rotTerra);
    this.raioHoje = null;
    cena.add(this.terraHoje);
    this.ano = null;
    this.marcosObjs = [];

    this.montarMostrador(cena);
    this.montarLua(cena);
  }

  /** Marcos dependem so do ano; refaz quando ele muda. */
  montarMarcos(ano) {
    this.marcosObjs.forEach(o => this.cena.remove(o));
    this.marcosObjs = [];
    for (const m of MARCOS) {
      const angulo = anguloDesdeOPerielio(diaDoAno(new Date(ano, m.mes - 1, m.dia)));
      const [x, y] = naOrbita(angulo);
      const g = new THREE.Group();
      g.add(linha([this.sol, [x, y]], 0xf5cd6e));
      const terra = new THREE.Group();
      terra.position.set(x, y, 0);
      terra.add(disco(0.045, 0x005ac8));
      // o eixo nao acompanha a orbita: fica sempre inclinado para o mesmo lado
      const inc = THREE.MathUtils.degToRad(INCLINACAO_DO_EIXO);
      const meio = 0.045 + 0.03;
      terra.add(linha([[-meio * Math.sin(inc), -meio * Math.cos(inc)], [meio * Math.sin(inc), meio * Math.cos(inc)]]));
      const n = new Rotulo('N', 0.05);
      n.position.set((meio + 0.03) * Math.sin(inc), (meio + 0.03) * Math.cos(inc), 0);
      terra.add(n);
      g.add(terra);

      let rx = x, ry = y + (y < 0 ? 0.2 : -0.2);
      if (m.solsticio) {
        const k = 1 + 0.36 / A;
        rx = A * k * Math.cos(angulo);
        ry = B * k * Math.sin(angulo);
      }
      [m.nome, m.quando, m.efeito].forEach((texto, i) => {
        const r = new Rotulo(texto, 0.055);
        r.position.set(rx, ry + (1 - i) * 0.075, 0);
        g.add(r);
      });
      this.cena.add(g);
      this.marcosObjs.push(g);
    }
    this.ano = ano;
  }

  /** Meia volta: a esquerda o perielio, a direita o afelio. */
  montarMostrador(cena) {
    const cx = 2.35, cy = -0.1, r = 0.62;
    this.mostrador = { cx, cy, r };
    const t = new Rotulo('Distância do Sol agora', 0.07);
    t.position.set(cx, cy + r + 0.17, 0);
    cena.add(t, aro(r, 0.012, PRETO, 0, Math.PI, cx, cy));
    cena.add(traco(cx - r, cy, cx - r + 0.08, cy, 0.012), traco(cx + r - 0.08, cy, cx + r, cy, 0.012));

    const dMin = distanciaEmKm(0), dMax = distanciaEmKm(Math.PI);
    const textos = [
      ['Periélio', cx - r + 0.12, cy - 0.1], [milhoesDeKm(dMin), cx - r + 0.12, cy - 0.2],
      ['Afélio', cx + r - 0.12, cy - 0.1], [milhoesDeKm(dMax), cx + r - 0.12, cy - 0.2],
    ];
    for (const [s, x, y] of textos) {
      const l = new Rotulo(s, 0.055);
      l.position.set(x, y, 0);
      cena.add(l);
    }
    this.dist1 = new Rotulo('', 0.07);
    this.dist1.position.set(cx, cy - 0.36, 0);
    this.dist2 = new Rotulo('', 0.06);
    this.dist2.position.set(cx, cy - 0.46, 0);
    cena.add(this.dist1, this.dist2);

    const g = new THREE.PlaneGeometry(0.022, r * 0.9);
    g.translate(0, r * 0.45, 0);
    this.agulha = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    this.agulha.position.set(cx, cy, 1);
    cena.add(this.agulha, disco(0.035, 0xff0000, cx, cy));
  }

  /**
   * A Lua e uma esfera de verdade, iluminada por uma luz direcional: a fase
   * sai da posicao da luz, nao de um recorte. Ceu do hemisferio sul: a
   * crescente fica iluminada do lado esquerdo.
   */
  montarLua(cena) {
    const cx = -3.25, cy = -0.1;
    const t = new Rotulo('Fase da Lua', 0.07);
    t.position.set(cx, cy + 0.5, 0);
    cena.add(t);

    this.luaCena = new THREE.Group();
    this.luaCena.position.set(cx, cy, 0);
    const esfera = new THREE.Mesh(new THREE.SphereGeometry(0.34, 48, 32), new THREE.MeshStandardMaterial({ color: 0xfafaeb, roughness: 1 }));
    this.luaCena.add(esfera);
    // a luz so ilumina esta esfera: ela fica no mesmo grupo da cena, com a propria camera ortografica
    this.luz = new THREE.DirectionalLight(0xffffff, 3.2);
    this.luaCena.add(this.luz, new THREE.AmbientLight(0x464655, 1.2));
    cena.add(this.luaCena);

    this.faseTextos = [0, 1, 2, 3, 4].map(i => {
      const l = new Rotulo('', 0.06);
      l.position.set(cx + 0.45, cy + 0.22 - i * 0.12, 0);
      l.center.set(0, 0.5);
      cena.add(l);
      return l;
    });
    this.faseTextos[0].negrito = true;
    this.fase = null;
  }

  async carregarFase() {
    try {
      const r = await fetch('/api/lua/fase');
      this.fase = await r.json();
      this.fase.recebidoEm = Date.now();
    } catch (e) { /* o servidor pode ter caido: segue com a ultima fase */ }
  }

  atualizar(agora) {
    const ano = agora.getFullYear();
    if (this.ano !== ano) this.montarMarcos(ano);

    const angulo = anguloDesdeOPerielio(diaDoAno(agora));
    const [x, y] = naOrbita(angulo);
    this.terraHoje.position.set(x, y, 0);
    if (this.raioHoje) this.cena.remove(this.raioHoje);
    this.raioHoje = linha([this.sol, [x, y]], 0x787878);
    this.cena.add(this.raioHoje);

    const data = agora.toLocaleDateString('pt-BR');
    this.titulo.setTexto(`${data} - dia ${diaDoAno(agora)} do ano - ${(angulo * 180 / Math.PI).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} graus desde o periélio`);

    const d = distanciaEmKm(angulo);
    const frac = (d - distanciaEmKm(0)) / (distanciaEmKm(Math.PI) - distanciaEmKm(0));
    this.agulha.rotation.z = Math.PI * (1 - frac) - Math.PI / 2;
    this.dist1.setTexto(milhoesDeKm(d));
    this.dist2.setTexto(`${Math.round(d).toLocaleString('pt-BR')} km - ${(d / UA_EM_KM).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} UA`);

    if (this.fase) {
      const f = this.fase.fracaoDoCiclo;
      const th = f * 2 * Math.PI;
      this.luz.position.set(-Math.sin(th) * 5, 0, -Math.cos(th) * 5);
      const dataEm = dias => new Date(agora.getTime() + dias * 86400000)
        .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const linhas = [
        this.fase.nome,
        `${Math.round(this.fase.iluminacao * 100)}% iluminada`,
        `${this.fase.idadeEmDias.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} dias de idade`,
        `Nova em ${dataEm(this.fase.diasParaALuaNova)} (${Math.round(this.fase.diasParaALuaNova)} dias)`,
        `Cheia em ${dataEm(this.fase.diasParaALuaCheia)} (${Math.round(this.fase.diasParaALuaCheia)} dias)`,
      ];
      linhas.forEach((s, i) => this.faseTextos[i].setTexto(s));
    }
  }
}
