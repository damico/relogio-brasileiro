import * as THREE from 'three';
import { COR_PLANETA, planetaVisivel } from './planetas.js';

// A esfera celeste vista de fora, com quem olha no centro: o horizonte e o
// zenite, o meridiano, o equador e os polos celestes, a calota das estrelas
// circumpolares, o movimento aparente do ceu, a altura e o azimute de um astro
// e o seu angulo horario. Cada conceito e uma camada que se liga e desliga.
//
// Sistema: y para cima (zenite), norte em -z, leste em +x. Uma direcao dada
// por altura e azimute (contado do norte para o leste) vira um ponto da esfera
// de raio 1.

const rad = THREE.MathUtils.degToRad;
const deg = THREE.MathUtils.radToDeg;
const TAU = Math.PI * 2;

/** A conta do horizonte, em GLSL: usada tambem pelo disco 2D. */
export const GLSL_HORIZONTE = `
  uniform float tsl;     // tempo sideral local, em graus
  uniform float lat;     // latitude de casa, em graus
  const float D2R = 0.017453292519943295;

  // x: altura, y: azimute, em radianos
  vec2 horizonte(float ra, float dec) {
    float la = lat * D2R, d = dec * D2R, h = (tsl - ra) * D2R;
    float alt = asin(clamp(sin(la) * sin(d) + cos(la) * cos(d) * cos(h), -1.0, 1.0));
    float az = atan(-sin(h) * cos(d), cos(la) * sin(d) - sin(la) * cos(d) * cos(h));
    return vec2(alt, az);
  }
`;

const COR_NOITE = new THREE.Color().setRGB(10 / 255, 15 / 255, 40 / 255, THREE.SRGBColorSpace);
const COR_DIA = new THREE.Color().setRGB(92 / 255, 142 / 255, 212 / 255, THREE.SRGBColorSpace);
const COR_CHAO_DIA = new THREE.Color().setRGB(224 / 255, 160 / 255, 64 / 255, THREE.SRGBColorSpace);
const COR_CHAO_NOITE = new THREE.Color().setRGB(48 / 255, 34 / 255, 16 / 255, THREE.SRGBColorSpace);

const CAMADAS = [
  ['meridiano', 'Meridiano'],
  ['equador', 'Equador celeste'],
  ['polos', 'Polo e calotas'],
  ['diurno', 'Movimento diurno'],
  ['altaz', 'Altura e azimute'],
  ['horario', 'Ângulo horário'],
  ['satelites', 'Satélites'],
  ['planetas', 'Planetas'],
  ['estrelas', 'Estrelas e constelações'],
];

export const dir = (alt, az, r = 1) => new THREE.Vector3(
  Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az)).multiplyScalar(r);

/** Altura e azimute de um ponto dado pelo angulo horario H e pela declinacao. */
function horDeHD(H, dec, lat) {
  const alt = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H) * Math.cos(dec), Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(H));
  return [alt, az];
}

/** O caminho de volta: angulo horario e declinacao de um ponto dado por altura e azimute. */
function hdDeHorizonte(alt, az, lat) {
  const dec = Math.asin(Math.sin(lat) * Math.sin(alt) + Math.cos(lat) * Math.cos(alt) * Math.cos(az));
  const H = Math.atan2(-Math.cos(alt) * Math.sin(az), Math.cos(lat) * Math.sin(alt) - Math.sin(lat) * Math.cos(alt) * Math.cos(az));
  return [H, dec];
}

const dirHD = (H, dec, lat, r = 1) => dir(...horDeHD(H, dec, lat), r);

/** Pontos de um circulo de raio angular d em volta de um eixo. */
function circuloPequeno(eixo, d, n = 180) {
  const tmp = Math.abs(eixo.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const a = new THREE.Vector3().crossVectors(tmp, eixo).normalize();
  const b = new THREE.Vector3().crossVectors(eixo, a).normalize();
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n * TAU;
    pts.push(eixo.clone().multiplyScalar(Math.cos(d))
      .addScaledVector(a, Math.sin(d) * Math.cos(t)).addScaledVector(b, Math.sin(d) * Math.sin(t)));
  }
  return pts;
}

function limpar(grupo) {
  grupo.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  grupo.clear();
}

/** Uma linha, partida onde cruza o horizonte: acima forte, abaixo apagada. */
function linhaPartida(pontos, cor, { tracejada = true, opacidade = 0.95, abaixo = 0.28 } = {}) {
  const grupo = new THREE.Group();
  const runs = [];
  let atual = [];
  let lado = null;
  for (const p of pontos) {
    const l = p.y >= 0;
    if (lado !== null && l !== lado) {
      atual.push(p);
      runs.push([atual, lado]);
      atual = [];
    }
    atual.push(p);
    lado = l;
  }
  if (atual.length > 1) runs.push([atual, lado]);

  for (const [run, cima] of runs) {
    const g = new THREE.BufferGeometry().setFromPoints(run);
    const m = tracejada
      ? new THREE.LineDashedMaterial({ color: cor, dashSize: 0.045, gapSize: 0.03, transparent: true, depthTest: false })
      : new THREE.LineBasicMaterial({ color: cor, transparent: true, depthTest: false });
    m.opacity = cima ? opacidade : opacidade * abaixo;
    const l = new THREE.Line(g, m);
    if (tracejada) l.computeLineDistances();
    l.renderOrder = 10;
    grupo.add(l);
  }
  return grupo;
}

function seta(posicao, tangente, cor, tamanho = 1) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.022 * tamanho, 0.06 * tamanho, 14),
    new THREE.MeshBasicMaterial({ color: cor, depthTest: false }));
  m.position.copy(posicao);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangente.clone().normalize());
  m.renderOrder = 12;
  return m;
}

function bola(posicao, raio, cor) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(raio, 24, 16), new THREE.MeshBasicMaterial({ color: cor, depthTest: false }));
  m.position.copy(posicao);
  m.renderOrder = 12;
  return m;
}

export class EsferaCeleste {
  /**
   * @param contenedor elemento onde ficam os rotulos HTML
   * @param painel     elemento onde entram as camadas e a escolha do astro
   */
  constructor(contenedor, painel) {
    this.contenedor = contenedor;
    this.cena = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    this.visao = { az: rad(-62), el: rad(24), d: 4.3 };
    this.alvo = new THREE.Vector3(0, 0.2, 0);
    this.camadas = Object.fromEntries(CAMADAS.map(([k]) => [k, true]));
    this.referencia = 'sol';
    this.satelites = null;   // o objeto Satelites, posto de fora
    this.versaoSat = -1;
    this.marcasSat = [];
    this.soVisiveis = false; // so o que um olho nu enxerga daqui, agora
    this.limiteMagnitude = 6.0; // a estrela mais fraca que a vista alcanca
    this.catalogo = null;
    this.rotulos = new Map();
    this.n = 0;
    this.ultimo = null;
    this.grupos = {};
    this.estrelas = null;
    this.linhasConstelacoes = null;
    this.uniformes = { tsl: { value: 0 }, lat: { value: 0 } };

    this.montarBase();
    for (const [k] of CAMADAS) {
      this.grupos[k] = new THREE.Group();
      this.cena.add(this.grupos[k]);
    }
    this.grupos.astros = new THREE.Group();
    this.cena.add(this.grupos.astros);
    this.luz = new THREE.DirectionalLight(0xffffff, 3);
    this.cena.add(this.luz, new THREE.AmbientLight(0x464655, 1.4));
    this.montarPainel(painel);
  }

  // ---- o que nao muda: abobada, chao, horizonte, pontos cardeais, zenite ----
  montarBase() {
    const base = new THREE.Group();
    this.cena.add(base);

    const casca = (inicio, comprimento) => new THREE.Mesh(
      new THREE.SphereGeometry(1, 72, 36, 0, TAU, inicio, comprimento),
      new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
    this.domo = casca(0, Math.PI / 2);          // o ceu de cima
    this.domoBaixo = casca(Math.PI / 2, Math.PI / 2); // o ceu do outro lado da Terra
    this.domo.renderOrder = 0;
    this.domoBaixo.renderOrder = 0;
    base.add(this.domo, this.domoBaixo);

    // grade de alturas e azimutes, bem discreta
    const grade = new THREE.Group();
    const corGrade = new THREE.LineBasicMaterial({ color: 0xaac0e8, transparent: true, opacity: 0.16, depthTest: false });
    for (const alt of [30, 60]) {
      const pts = [];
      for (let i = 0; i <= 120; i++) pts.push(dir(rad(alt), i / 120 * TAU));
      grade.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), corGrade));
    }
    for (let az = 0; az < 360; az += 45) {
      const pts = [];
      for (let i = 0; i <= 45; i++) pts.push(dir(i / 45 * Math.PI / 2, rad(az)));
      grade.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), corGrade));
    }
    grade.renderOrder = 1;
    base.add(grade);

    this.chao = new THREE.Mesh(new THREE.CircleGeometry(1, 96),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
    this.chao.rotation.x = -Math.PI / 2;
    this.chao.renderOrder = 2;
    base.add(this.chao);

    const anel = new THREE.Mesh(new THREE.TorusGeometry(1, 0.008, 8, 160),
      new THREE.MeshBasicMaterial({ color: 0xd23c2c, depthTest: false }));
    anel.rotation.x = Math.PI / 2;
    anel.renderOrder = 3;
    base.add(anel);

    // o eixo vertical, do centro ao zenite
    const vertical = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]),
      new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.02, gapSize: 0.03, transparent: true, opacity: 0.5, depthTest: false }));
    vertical.computeLineDistances();
    base.add(vertical, bola(new THREE.Vector3(0, 1, 0), 0.016, 0xffffff));

    // quem olha, no centro
    const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.1, 12), new THREE.MeshBasicMaterial({ color: 0x2f6fdd, depthTest: false }));
    corpo.position.y = 0.05;
    const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf2c9a0, depthTest: false }));
    cabeca.position.y = 0.12;
    corpo.renderOrder = cabeca.renderOrder = 4;
    base.add(corpo, cabeca);

    this.rotulo('base', 'N', dir(0, 0, 1.09), '#ffffff', true);
    this.rotulo('base', 'S', dir(0, Math.PI, 1.09), '#ffffff', true);
    this.rotulo('base', 'L', dir(0, Math.PI / 2, 1.09), '#ffffff', true);
    this.rotulo('base', 'O', dir(0, -Math.PI / 2, 1.09), '#ffffff', true);
    this.rotulo('base', 'Z = zênite', new THREE.Vector3(0, 1.08, 0), '#ffffff');
    this.rotulo('base', 'horizonte', dir(0, rad(212), 1.1), '#ff7a66');
    this.rotulo('base', 'você', new THREE.Vector3(0, 0.2, 0), '#ffffff');
  }

  montarPainel(painel) {
    const escolha = painel.querySelector('#astroRef');
    escolha.addEventListener('change', () => { this.referencia = escolha.value; this.ultimo = null; });
    const caixas = painel.querySelector('#camadas');
    for (const [chave, nome] of CAMADAS) {
      const l = document.createElement('label');
      const c = document.createElement('input');
      c.type = 'checkbox';
      c.checked = true;
      c.addEventListener('change', () => { this.camadas[chave] = c.checked; this.aplicarCamadas(); });
      l.append(c, ' ' + nome);
      caixas.appendChild(l);
    }
    const so = document.createElement('label');
    so.title = 'Esconde o que um olho nu nao enxerga daqui: estrelas abaixo do horizonte, '
      + 'mais fracas que o alcance da vista (com a perda de brilho perto do horizonte) ou apagadas pelo Sol';
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.addEventListener('change', () => { this.soVisiveis = caixa.checked; this.ultimo = null; this.atualizarContagem(); });
    so.append(caixa, ' Só o que a vista alcança daqui');
    caixas.appendChild(so);

    const alcance = document.createElement('label');
    const valor = document.createElement('b');
    valor.textContent = this.limiteMagnitude.toFixed(1);
    const faixa = document.createElement('input');
    faixa.type = 'range';
    faixa.min = 1; faixa.max = 6.5; faixa.step = 0.1; faixa.value = this.limiteMagnitude;
    faixa.style.cssText = 'width:100%;display:block';
    faixa.addEventListener('input', () => {
      this.limiteMagnitude = +faixa.value;
      this.ultimo = null;
      valor.textContent = faixa.value;
      this.atualizarContagem();
    });
    alcance.append('Alcance da vista: magnitude ', valor, faixa);
    alcance.title = 'Quanto maior, mais estrelas fracas. 6 e um ceu escuro e limpo, 4 e o ceu de uma cidade, 2 e so as mais brilhantes';
    caixas.appendChild(alcance);

    this.contagem = document.createElement('div');
    this.contagem.style.cssText = 'margin-top:4px;color:#9696a5';
    caixas.appendChild(this.contagem);
  }

  /**
   * Visivel a olho nu: acima do horizonte e mais forte que o limite da vista,
   * que cai perto do horizonte porque a luz atravessa mais atmosfera (cerca de
   * 0,25 de magnitude por massa de ar).
   */
  atualizarContagem() {
    if (!this.catalogo || !this.ultimo || !this.ultimo.casa) return;
    const lat = rad(this.ultimo.casa.latitude), tsl = this.ultimo.tempoSideral;
    const c = this.catalogo;
    let acima = 0, alcancaveis = 0;
    for (let i = 0; i < c.ra.length; i++) {
      const [alt] = horDeHD(rad(tsl - c.ra[i]), rad(c.dec[i]), lat);
      if (alt <= 0) continue;
      acima++;
      const extincao = 0.25 * (1 / Math.max(Math.sin(alt), 0.02) - 1);
      if (c.magnitude[i] <= this.limiteMagnitude - extincao) alcancaveis++;
    }
    this.contagem.textContent = `${acima} acima do horizonte, ${alcancaveis} ao alcance da vista (de ${c.ra.length})`;
  }

  aplicarCamadas() {
    for (const [k] of CAMADAS) this.grupos[k].visible = this.camadas[k];
    if (this.estrelas) this.estrelas.visible = this.linhasConstelacoes.visible = this.camadas.estrelas;
  }

  // ---- rotulos HTML, projetados na tela a cada quadro ----
  rotulo(grupo, texto, posicao, cor = '#fff', forte = false) {
    // a chave e a ordem de criacao, porque o texto de varios rotulos muda a cada segundo
    const chave = grupo + '#' + this.n++;
    let r = this.rotulos.get(chave);
    if (!r) {
      const el = document.createElement('div');
      el.className = 'rotulo r3d';
      this.contenedor.appendChild(el);
      r = { el, grupo };
      this.rotulos.set(chave, r);
    }
    r.grupo = grupo;
    r.el.textContent = texto;
    r.el.style.color = cor;
    r.el.style.fontWeight = forte ? 'bold' : '';
    r.el.style.fontSize = forte ? '15px' : '';
    r.posicao = posicao;
    r.usado = true;
  }

  // ---- catalogo: estrelas e constelacoes na esfera, calculadas na GPU ----
  carregarCatalogo(c, corDaEstrela) {
    this.catalogo = c;
    const n = c.ra.length;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('radec', new THREE.BufferAttribute(Float32Array.from(c.ra.flatMap((r, i) => [r, c.dec[i]])), 2));
    g.setAttribute('brilho', new THREE.BufferAttribute(Float32Array.from(c.magnitude), 1));
    g.setAttribute('cor', new THREE.BufferAttribute(Float32Array.from(c.cor.flatMap(corDaEstrela)), 3));
    this.estrelas = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { ...this.uniformes, dpr: { value: 1 }, alfa: { value: 1 }, soVisiveis: { value: 0 }, limite: { value: 6 } },
      transparent: true, depthTest: false,
      vertexShader: GLSL_HORIZONTE + `
        attribute vec2 radec; attribute float brilho; attribute vec3 cor;
        uniform float dpr; uniform float soVisiveis; uniform float limite;
        varying vec3 vCor; varying float vAcima;
        void main() {
          vec2 aa = horizonte(radec.x, radec.y);
          vec3 p = vec3(cos(aa.x) * sin(aa.y), sin(aa.x), -cos(aa.x) * cos(aa.y));
          float extincao = 0.25 * (1.0 / max(sin(aa.x), 0.02) - 1.0);
          bool alcanca = aa.x > 0.0 && brilho <= limite - extincao;
          vCor = cor;
          vAcima = soVisiveis > 0.5 ? (alcanca ? 1.0 : 0.0) : (aa.x > 0.0 ? 1.0 : 0.3);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = max(1.0, (6.5 - brilho) * 0.6) * 2.0 * dpr;
        }`,
      fragmentShader: `
        uniform float alfa; varying vec3 vCor; varying float vAcima;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          if (dot(c, c) > 0.25) discard;
          gl_FragColor = vec4(vCor, alfa * vAcima);
        }`,
    }));
    this.estrelas.frustumCulled = false;
    this.estrelas.renderOrder = 6;

    const seg = [];
    for (const traco of c.constelacoes) {
      for (let i = 1; i < traco.length; i++) seg.push(...traco[i - 1], ...traco[i]);
    }
    const gl = new THREE.BufferGeometry();
    gl.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg.length / 2 * 3), 3));
    gl.setAttribute('radec', new THREE.BufferAttribute(Float32Array.from(seg), 2));
    this.linhasConstelacoes = new THREE.LineSegments(gl, new THREE.ShaderMaterial({
      uniforms: { ...this.uniformes, alfa: { value: 0 } },
      transparent: true, depthTest: false,
      vertexShader: GLSL_HORIZONTE + `
        attribute vec2 radec; varying float vVis;
        void main() {
          vec2 aa = horizonte(radec.x, radec.y);
          vec3 p = vec3(cos(aa.x) * sin(aa.y), sin(aa.x), -cos(aa.x) * cos(aa.y));
          vVis = aa.x > 0.0 ? 1.0 : 0.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform float alfa; varying float vVis;
        void main() { if (vVis < 0.999) discard; gl_FragColor = vec4(0.37, 0.49, 0.72, alfa); }`,
    }));
    this.linhasConstelacoes.frustumCulled = false;
    this.linhasConstelacoes.renderOrder = 5;
    this.cena.add(this.linhasConstelacoes, this.estrelas);
    this.aplicarCamadas();
  }

  // ---- o que muda com a hora: refeito quando chegam dados novos ----
  reconstruir(agora) {
    this.n = 0;
    this.rotulos.forEach(r => { if (r.grupo !== 'base') r.usado = false; });
    // os satelites so se refazem quando chega uma trajetoria nova, e nao a cada segundo
    for (const k of [...CAMADAS.map(([c]) => c).filter(c => c !== 'satelites'), 'astros']) limpar(this.grupos[k]);

    const lat = rad(agora.casa.latitude);
    const tsl = agora.tempoSideral;
    const sul = lat < 0;
    const polo = dir(lat, 0);                       // polo celeste norte (sob o horizonte no sul)
    const visivel = sul ? polo.clone().negate() : polo.clone();
    const oculto = visivel.clone().negate();
    const nomeVisivel = sul ? 'sul' : 'norte', nomeOculto = sul ? 'norte' : 'sul';
    const raioCalota = Math.abs(lat);

    // o astro de referencia: Sol ou Lua
    const ref = agora[this.referencia];
    const nomeRef = this.referencia === 'sol' ? 'Sol' : 'Lua';
    const corRef = this.referencia === 'sol' ? 0xffd23c : 0xe8e8dc;
    const altRef = rad(ref.altura), azRef = rad(ref.azimute);
    const [H, dec] = hdDeHorizonte(altRef, azRef, lat);
    const posRef = dir(altRef, azRef);

    // Sol e Lua na abobada; a Lua tem a fase de verdade, iluminada pela direcao do Sol
    const sol = dir(rad(agora.sol.altura), rad(agora.sol.azimute));
    const lua = dir(rad(agora.lua.altura), rad(agora.lua.azimute));
    this.grupos.astros.add(bola(sol, 0.045, 0xffd23c));
    const esferaLua = new THREE.Mesh(new THREE.SphereGeometry(0.035, 32, 24), new THREE.MeshStandardMaterial({ color: 0xf4f4e8, roughness: 1, depthTest: false }));
    esferaLua.position.copy(lua);
    esferaLua.renderOrder = 12;
    this.grupos.astros.add(esferaLua);
    this.luz.position.copy(sol.clone().normalize().multiplyScalar(5));
    this.rotulo('astros', 'Sol', sol.clone().multiplyScalar(1.06), '#ffe066', true);
    this.rotulo('astros', 'Lua', lua.clone().multiplyScalar(1.07), '#ffffff', true);

    // meridiano: o circulo que passa pelo zenite e pelos polos, de norte a sul
    this.grupos.meridiano.add(linhaPartida(circuloPequeno(new THREE.Vector3(1, 0, 0), Math.PI / 2), 0x7fb8ff));
    this.rotulo('meridiano', 'meridiano', dir(rad(38), 0, 1.03), '#9cc8ff');

    // equador celeste: a 90 graus dos polos, nasce no leste e se poe no oeste
    this.grupos.equador.add(linhaPartida(circuloPequeno(polo, Math.PI / 2), 0xff9a4d));
    this.rotulo('equador', 'equador celeste', dirHD(-rad(70), 0, lat, 1.04), '#ffae70');

    // polos, eixo e calotas: dentro da calota as estrelas nunca se poem
    const eixo = new THREE.Line(new THREE.BufferGeometry().setFromPoints([oculto.clone().multiplyScalar(1.22), visivel.clone().multiplyScalar(1.22)]),
      new THREE.LineDashedMaterial({ color: 0x78b4ff, dashSize: 0.02, gapSize: 0.025, transparent: true, opacity: 0.8, depthTest: false }));
    eixo.computeLineDistances();
    eixo.renderOrder = 10;
    this.grupos.polos.add(eixo, bola(visivel, 0.022, 0x78b4ff), bola(oculto, 0.018, 0x5a6c8c));
    this.rotulo('polos', `P = polo celeste ${nomeVisivel}`, visivel.clone().multiplyScalar(1.1), '#9cc8ff', true);
    this.rotulo('polos', `polo celeste ${nomeOculto} (sob o horizonte)`, oculto.clone().multiplyScalar(1.1), '#7d8fb0');
    if (raioCalota > rad(0.5)) {
      const calota = (eixoCalota, cor, opacidade) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1.004, 48, 14, 0, TAU, 0, raioCalota),
          new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: opacidade, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), eixoCalota);
        m.renderOrder = 7;
        return m;
      };
      this.grupos.polos.add(calota(visivel, 0x1c4fd0, 0.42), calota(oculto, 0x7a2a2a, 0.22));
      const borda = circuloPequeno(visivel, raioCalota);
      this.grupos.polos.add(linhaPartida(borda, 0x6aa0ff, { tracejada: false }));
      this.grupos.polos.add(linhaPartida(circuloPequeno(oculto, raioCalota), 0xaa5555, { tracejada: false, opacidade: 0.6 }));
      this.rotulo('polos', 'calota das estrelas circumpolares', borda[Math.round(borda.length * 0.74)].clone().multiplyScalar(1.05), '#8fb4ff');
      this.rotulo('polos', 'estrelas que nunca nascem', circuloPequeno(oculto, raioCalota)[Math.round(borda.length * 0.74)].clone().multiplyScalar(1.05), '#a07878');
    }

    // movimento diurno: o ceu gira em torno do eixo, de leste para oeste
    const paralelo = [];
    for (let i = 0; i <= 180; i++) paralelo.push(dirHD(i / 180 * TAU, dec, lat));
    this.grupos.diurno.add(linhaPartida(paralelo, corRef));
    const tangente = (h, d) => dirHD(h + 0.04, d, lat).sub(dirHD(h, d, lat));
    this.grupos.diurno.add(seta(posRef, tangente(H, dec), corRef, 1.2));
    const pontoEq = dirHD(-rad(70), 0, lat);
    this.grupos.diurno.add(seta(pontoEq, tangente(-rad(70), 0), 0xff9a4d, 1.2));
    this.rotulo('diurno', 'movimento aparente da abóbada celeste', dirHD(-rad(110), 0, lat, 1.06), '#ffae70');
    this.rotulo('diurno', `trajetória diária ${this.referencia === 'sol' ? 'do Sol' : 'da Lua'}`, dirHD(H + rad(55), dec, lat, 1.04), '#' + corRef.toString(16).padStart(6, '0'));

    // altura e azimute: a vertical do astro, o arco alpha e o arco beta
    const g = this.grupos.altaz;
    const pe = dir(0, azRef);
    const arcoAz = [], arcoAlt = [], vertical = [];
    for (let i = 0; i <= 60; i++) {
      arcoAz.push(dir(0, azRef * i / 60, 0.34));
      arcoAlt.push(dir(altRef * i / 60, azRef, 0.3));
    }
    for (let i = 0; i <= 90; i++) vertical.push(dir(altRef * i / 90, azRef));
    g.add(linhaPartida([new THREE.Vector3(0, 0, 0), pe], 0xffffff, { tracejada: false, opacidade: 0.9, abaixo: 1 }));
    g.add(linhaPartida([new THREE.Vector3(0, 0, 0), posRef], 0xffffff, { tracejada: false, opacidade: 0.9, abaixo: 0.5 }));
    g.add(linhaPartida(vertical, 0xffffff, { opacidade: 0.8, abaixo: 0.6 }));
    g.add(linhaPartida(arcoAz, 0xffb347, { tracejada: false, abaixo: 1 }));
    g.add(linhaPartida(arcoAlt, 0x8dff6a, { tracejada: false, abaixo: 0.6 }));
    g.add(bola(posRef, 0.025, corRef));
    if (Math.abs(azRef) > 0.05) g.add(seta(arcoAz[60], dir(0, azRef + 0.02).sub(dir(0, azRef - 0.02)), 0xffb347, 0.6));
    const fmt = (n, c = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
    this.rotulo('altaz', `β = azimute ${fmt(ref.azimute, 0)}°`, dir(0, azRef / 2, 0.48), '#ffc46b');
    this.rotulo('altaz', `α = altura ${fmt(ref.altura)}°`, dir(altRef / 2, azRef, 0.44), '#a8ff8c');

    // angulo horario: do meridiano ate o circulo horario do astro, ao longo do equador
    const horario = [];
    for (let i = 0; i <= 90; i++) horario.push(dirHD(H, -Math.PI / 2 + Math.PI * i / 90, lat));
    for (let i = 0; i <= 90; i++) horario.push(dirHD(H + Math.PI, Math.PI / 2 - Math.PI * i / 90, lat));
    this.grupos.horario.add(linhaPartida(horario, 0xffe066, { opacidade: 0.75 }));
    const arcoH = [];
    for (let i = 0; i <= 60; i++) arcoH.push(dirHD(H * i / 60, 0, lat, 1.006));
    this.grupos.horario.add(linhaPartida(arcoH, 0xffd23c, { tracejada: false, abaixo: 0.6 }));
    this.grupos.horario.add(seta(arcoH[60], tangente(H, 0).multiplyScalar(Math.sign(H) || 1), 0xffd23c, 0.8));
    this.rotulo('horario', `ângulo horário H = ${fmt(deg(H) / 15, 1)} h`, dirHD(H / 2, 0, lat, 1.08), '#ffe066');
    this.rotulo('horario', `círculo horário ${this.referencia === 'sol' ? 'do Sol' : 'da Lua'}`, dirHD(H, rad(62), lat, 1.04), '#ffe9a0');

    // planetas: com o filtro ligado, so os que a vista alcanca; sem ele, todos, e os de baixo do horizonte apagados
    for (const p of agora.planetas || []) {
      const acima = p.altura > 0;
      if (this.soVisiveis && !planetaVisivel(p, this.limiteMagnitude, this.claridade)) continue;
      const cor = COR_PLANETA[p.nome];
      const pos = dir(rad(p.altura), rad(p.azimute));
      const bolinha = bola(pos, 0.017 + Math.max(0, Math.min(0.012, (1.5 - p.magnitude) * 0.004)), new THREE.Color(cor).getHex());
      if (!acima) { bolinha.material.transparent = true; bolinha.material.opacity = 0.35; }
      this.grupos.planetas.add(bolinha);
      this.rotulo('planetas', p.nome, pos.clone().multiplyScalar(1.05), acima ? cor : '#6f7585');
    }

    this.rotulos.forEach(r => { if (!r.usado) r.el.style.display = 'none'; });
    this.aplicarCamadas();
    this.atualizarContagem();
  }

  /**
   * Os satelites vistos da esfera: o arco de uma volta inteira no ceu de quem
   * olha (apagado onde passa sob o horizonte) e o ponto onde ele esta agora,
   * que anda a cada quadro.
   */
  atualizarSatelites() {
    const sats = this.satelites;
    if (!sats) return;

    if (this.versaoSat !== sats.versao) {
      this.versaoSat = sats.versao;
      limpar(this.grupos.satelites);
      this.marcasSat.forEach(m => m.el.remove());
      this.marcasSat = [];
      for (const sat of sats.lista) {
        const cor = new THREE.Color(sat.cor).getHex();
        const pontos = sat.amostras.filter(a => a[7] != null).map(a => dir(rad(a[7]), rad(a[6])));
        if (pontos.length > 1) {
          this.grupos.satelites.add(linhaPartida(pontos, cor, { tracejada: false, opacidade: 0.9, abaixo: 0.35 }));
        }
        const marca = bola(new THREE.Vector3(), 0.022, cor);
        this.grupos.satelites.add(marca);
        const el = document.createElement('div');
        el.className = 'rotulo r3d';
        el.style.color = sat.cor;
        el.style.fontWeight = 'bold';
        this.contenedor.appendChild(el);
        this.marcasSat.push({ sat, marca, el, posicao: new THREE.Vector3(), ok: false });
      }
    }

    for (const m of this.marcasSat) {
      const p = sats.posicao(m.sat);
      m.ok = !!p && p.elevacao != null;
      m.marca.visible = m.ok;
      if (!m.ok) continue;
      m.posicao.copy(dir(rad(p.elevacao), rad(p.azimute), 1.04));
      m.marca.position.copy(dir(rad(p.elevacao), rad(p.azimute)));
      // na sombra da Terra o satelite nao reflete luz: fica apagado
      m.marca.material.color.set(p.iluminado ? m.sat.cor : '#555a66');
      m.el.textContent = `${m.sat.nome} ${p.elevacao >= 0 ? '+' : '\u2212'}${Math.abs(Math.round(p.elevacao))}°`;
    }
  }

  // ---- camera: arrastar gira em volta, a roda aproxima ----
  arrastar(dx, dy) {
    this.visao.az -= dx * 0.008;
    this.visao.el = Math.max(rad(-80), Math.min(rad(85), this.visao.el + dy * 0.008));
  }

  aproximar(fator) {
    this.visao.d = Math.max(2.2, Math.min(9, this.visao.d * fator));
  }

  reiniciar() {
    this.visao = { az: rad(-62), el: rad(24), d: 4.3 };
  }

  // ---- um quadro ----
  desenhar(renderer, w, h, agora, claridade, dpr) {
    this.claridade = claridade;
    if (agora !== this.ultimo) {
      this.ultimo = agora;
      this.reconstruir(agora);
    }
    this.uniformes.tsl.value = agora.tempoSideral;
    this.uniformes.lat.value = agora.casa.latitude;
    const transparencia = 1 - claridade;
    if (this.estrelas) {
      this.estrelas.material.uniforms.dpr.value = dpr;
      this.estrelas.material.uniforms.soVisiveis.value = this.soVisiveis ? 1 : 0;
      this.estrelas.material.uniforms.limite.value = this.limiteMagnitude;
      this.estrelas.material.uniforms.alfa.value = transparencia;
      this.linhasConstelacoes.material.uniforms.alfa.value = transparencia * 0.75;
    }

    // o ceu de cima segue o dia; o de baixo, que e o ceu do outro lado da Terra, faz o contrario
    this.domo.material.color.copy(COR_NOITE).lerp(COR_DIA, claridade);
    this.domo.material.opacity = 0.34;
    this.domoBaixo.material.color.copy(COR_DIA).lerp(COR_NOITE, claridade);
    this.domoBaixo.material.opacity = 0.2;
    this.chao.material.color.copy(COR_CHAO_NOITE).lerp(COR_CHAO_DIA, claridade);

    const v = this.visao;
    this.camera.aspect = w / h;
    this.camera.position.set(
      this.alvo.x + v.d * Math.cos(v.el) * Math.sin(v.az),
      this.alvo.y + v.d * Math.sin(v.el),
      this.alvo.z + v.d * Math.cos(v.el) * Math.cos(v.az));
    this.camera.lookAt(this.alvo);
    this.camera.updateProjectionMatrix();

    this.atualizarSatelites();
    renderer.render(this.cena, this.camera);

    for (const m of this.marcasSat) {
      const mostrar = m.ok && this.camadas.satelites;
      m.el.style.display = mostrar ? '' : 'none';
      if (!mostrar) continue;
      const p = m.posicao.clone().project(this.camera);
      m.el.style.left = ((p.x + 1) / 2 * w) + 'px';
      m.el.style.top = ((1 - p.y) / 2 * h) + 'px';
    }

    this.rotulos.forEach(r => {
      const mostrar = r.usado && (r.grupo === 'base' || r.grupo === 'astros' || this.camadas[r.grupo]);
      r.el.style.display = mostrar ? '' : 'none';
      if (!mostrar) return;
      const p = r.posicao.clone().project(this.camera);
      r.el.style.left = ((p.x + 1) / 2 * w) + 'px';
      r.el.style.top = ((1 - p.y) / 2 * h) + 'px';
    });
  }

  esconderRotulos() {
    this.rotulos.forEach(r => { r.el.style.display = 'none'; });
    this.marcasSat.forEach(m => { m.el.style.display = 'none'; });
  }
}
