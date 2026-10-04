import * as THREE from 'three';
import { EsferaCeleste, GLSL_HORIZONTE } from './esfera.js';
import { Observador } from './observador.js';
import { COR_PLANETA, planetaVisivel } from './planetas.js';
import { Satelites, descreverSatelite } from './satelites.js';

// O ceu inteiro acima do horizonte achatado num disco: o zenite no centro e o
// horizonte na borda. Como se olha para cima, o leste fica a esquerda. A
// projecao e a estereografica: o raio cresce com a tangente de metade da
// distancia ao zenite. A conta de cada estrela e feita na placa de video.

// o fundo passa pelo material do three, que converte para sRGB: cores dadas em sRGB
const COR_NOITE = new THREE.Color().setRGB(6 / 255, 8 / 255, 20 / 255, THREE.SRGBColorSpace);
const COR_DIA = new THREE.Color().setRGB(92 / 255, 142 / 255, 212 / 255, THREE.SRGBColorSpace);
const COR_GRADE = 0x465a82;
const COR_HORIZONTE = 0x96aad2;
const COR_SOL = 0xffe15a;
const COR_CONSTELACAO = new THREE.Color(95 / 255, 125 / 255, 185 / 255);
const FIM_DO_CREPUSCULO = -18; // abaixo disso o Sol ja nao clareia o ceu
const MARGEM_DE_CIMA = 56;
const MARGEM_DE_BAIXO = 76;
const rad = THREE.MathUtils.degToRad;

const canvas = document.getElementById('tela');
const rotulos = document.getElementById('rotulos');
const painel3d = document.getElementById('painel3d');
const rotulos3d = document.getElementById('rotulos3d');
rotulos3d.style.display = 'none'; // so aparecem no modo 3D
const esfera = new EsferaCeleste(rotulos3d, painel3d);
const painelObs = document.getElementById('painelObs');
const rotulosObs = document.getElementById('rotulosObs');
rotulosObs.style.display = 'none';
const hud = document.getElementById('hud');
const observador = new Observador(rotulosObs, painelObs, hud);
let modo = '2d'; // '2d' (disco), 'esfera' (esfera celeste vista de fora) ou 'obs' (observador)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x12121a);
const cena = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10); // em pixels, y para cima

// ---- a conta do horizonte, em GLSL, para estrelas e tracos ----
const GLSL_CEU = GLSL_HORIZONTE + `
  uniform vec2 centro;   // centro do disco, em pixels (y para cima)
  uniform float raio;
  uniform vec2 tela;

  vec2 projetar(vec2 aa) {
    float r = min(tan((1.5707963 - aa.x) * 0.5), 50.0);
    return centro + raio * r * vec2(-sin(aa.y), cos(aa.y));
  }
  vec4 emTela(vec2 px) { return vec4(px / tela * 2.0 - 1.0, 0.0, 1.0); }
`;
const uniformes = {
  tsl: { value: 0 }, lat: { value: 0 },
  centro: { value: new THREE.Vector2() }, raio: { value: 100 }, tela: { value: new THREE.Vector2(1, 1) },
};

// ---- o disco do ceu e a grade, num grupo de raio 1 que escala com o zoom ----
const disco = new THREE.Group();
cena.add(disco);

const fundo = new THREE.Mesh(new THREE.CircleGeometry(1, 160), new THREE.MeshBasicMaterial({ color: COR_NOITE }));
disco.add(fundo);

function linhas(pontos, cor, laco = false) {
  const g = new THREE.BufferGeometry().setFromPoints(pontos.map(p => new THREE.Vector3(p[0], p[1], 0.1)));
  const m = new THREE.LineBasicMaterial({ color: cor });
  return laco ? new THREE.LineLoop(g, m) : new THREE.Line(g, m);
}
function circulo(raioDoCirculo) {
  const p = [];
  for (let i = 0; i < 160; i++) p.push([raioDoCirculo * Math.cos(i / 160 * 2 * Math.PI), raioDoCirculo * Math.sin(i / 160 * 2 * Math.PI)]);
  return p;
}
const projetar = altura => Math.tan(rad(90 - altura) / 2);
[30, 60].forEach(a => disco.add(linhas(circulo(projetar(a)), COR_GRADE, true)));
for (let az = 0; az < 360; az += 45) {
  disco.add(linhas([[0, 0], [-Math.sin(rad(az)), Math.cos(rad(az))]], COR_GRADE));
}
const horizonte = linhas(circulo(1), COR_HORIZONTE, true);
const horizonte2 = linhas(circulo(1.004), COR_HORIZONTE, true); // borda de 2 px
disco.add(horizonte, horizonte2);

// ---- constelacoes e estrelas (preenchidas quando o catalogo chega) ----
let catalogo = null;
let linhasDasConstelacoes = null;
let estrelas = null;

function montarCatalogo(c) {
  catalogo = c;
  const n = c.ra.length;

  // estrelas: um ponto por estrela, com a posicao no ceu e a cor B-V
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); // so para o three contar os pontos
  g.setAttribute('radec', new THREE.BufferAttribute(Float32Array.from(c.ra.flatMap((r, i) => [r, c.dec[i]])), 2));
  g.setAttribute('brilho', new THREE.BufferAttribute(Float32Array.from(c.magnitude), 1));
  g.setAttribute('cor', new THREE.BufferAttribute(Float32Array.from(c.cor.flatMap(corDaEstrela)), 3));
  estrelas = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: { ...uniformes, dpr: { value: 1 }, alfa: { value: 1 } },
    transparent: true, depthTest: false,
    vertexShader: GLSL_CEU + `
      attribute vec2 radec; attribute float brilho; attribute vec3 cor;
      uniform float dpr;
      varying vec3 vCor;
      void main() {
        vec2 aa = horizonte(radec.x, radec.y);
        vCor = cor;
        gl_Position = aa.x > 0.0 ? emTela(projetar(aa)) : vec4(2.0, 2.0, 2.0, 1.0);
        gl_PointSize = aa.x > 0.0 ? max(0.7, (6.5 - brilho) * 0.55) * 2.0 * dpr : 0.0;
      }`,
    fragmentShader: `
      uniform float alfa; varying vec3 vCor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (dot(c, c) > 0.25) discard;
        gl_FragColor = vec4(vCor, alfa);
      }`,
  }));
  estrelas.frustumCulled = false;
  estrelas.renderOrder = 3;

  // tracos: cada par de pontos consecutivos vira um segmento
  const seg = [];
  for (const traco of c.constelacoes) {
    for (let i = 1; i < traco.length; i++) seg.push(...traco[i - 1], ...traco[i]);
  }
  const gl = new THREE.BufferGeometry();
  const nv = seg.length / 2;
  gl.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  gl.setAttribute('radec', new THREE.BufferAttribute(Float32Array.from(seg), 2));
  linhasDasConstelacoes = new THREE.LineSegments(gl, new THREE.ShaderMaterial({
    uniforms: { ...uniformes, alfa: { value: 0 }, cor: { value: COR_CONSTELACAO } },
    transparent: true, depthTest: false,
    // um traco so aparece com as duas pontas acima do horizonte: perto da
    // borda a projecao estica sem limite
    vertexShader: GLSL_CEU + `
      attribute vec2 radec; varying float vVis;
      void main() {
        vec2 aa = horizonte(radec.x, radec.y);
        vVis = aa.x > 0.0 ? 1.0 : 0.0;
        gl_Position = emTela(projetar(aa));
      }`,
    fragmentShader: `
      uniform float alfa; uniform vec3 cor; varying float vVis;
      void main() { if (vVis < 0.999) discard; gl_FragColor = vec4(cor, alfa); }`,
  }));
  linhasDasConstelacoes.frustumCulled = false;
  linhasDasConstelacoes.renderOrder = 2;
  cena.add(linhasDasConstelacoes, estrelas);
  esfera.carregarCatalogo(c, corDaEstrela);
  observador.carregarCatalogo(c, corDaEstrela);

  // nomes das estrelas mais brilhantes, como rotulos HTML
  nomes = Object.entries(c.nomes).map(([i, nome]) => ({ i: +i, el: rotulo(nome, 'esq') }));
}

/** A cor da estrela pelo indice B menos V: azulada, branca ou alaranjada. */
function corDaEstrela(b) {
  const t = b < 0 ? [170, 195, 255] : b < 0.3 ? [225, 235, 255] : b < 0.6 ? [255, 250, 235]
    : b < 1.0 ? [255, 235, 190] : b < 1.5 ? [255, 205, 150] : [255, 175, 130];
  return t.map(v => v / 255);
}

// ---- Sol e Lua ----
const sol = new THREE.Mesh(new THREE.CircleGeometry(11, 32), new THREE.MeshBasicMaterial({ color: COR_SOL, depthTest: false }));
sol.renderOrder = 5;
cena.add(sol);

const luaCanvas = document.createElement('canvas');
luaCanvas.width = luaCanvas.height = 96;
const luaTextura = new THREE.CanvasTexture(luaCanvas);
luaTextura.colorSpace = THREE.SRGBColorSpace;
const lua = new THREE.Sprite(new THREE.SpriteMaterial({ map: luaTextura, depthTest: false }));
lua.scale.set(26, 26, 1);
lua.renderOrder = 4;
cena.add(lua);

/**
 * A Lua como se ve daqui: o disco escuro com a parte iluminada recortada pelo
 * terminador, uma elipse que vai estreitando. Ceu do hemisferio sul: a
 * crescente fica iluminada do lado esquerdo.
 */
function desenharLua(fracao) {
  const g = luaCanvas.getContext('2d');
  const r = 44, c = 48;
  g.clearRect(0, 0, 96, 96);
  g.fillStyle = 'rgb(70,70,85)';
  g.beginPath(); g.arc(c, c, r, 0, 2 * Math.PI); g.fill();

  const crescente = fracao < 0.5;
  const largura = r * Math.abs(Math.cos(fracao * 2 * Math.PI));
  const iluminacao = (1 - Math.cos(fracao * 2 * Math.PI)) / 2;

  g.save();
  g.beginPath(); g.arc(c, c, r, 0, 2 * Math.PI); g.clip();
  g.fillStyle = 'rgb(240,240,228)';
  g.beginPath();
  g.rect(crescente ? c - r : c, c - r, r, 2 * r); // a metade iluminada
  g.fill();
  g.fillStyle = iluminacao > 0.5 ? 'rgb(240,240,228)' : 'rgb(70,70,85)';
  g.beginPath(); g.ellipse(c, c, Math.max(largura, 0.01), r, 0, 0, 2 * Math.PI); g.fill();
  g.restore();

  g.strokeStyle = '#465a82'; g.lineWidth = 2;
  g.beginPath(); g.arc(c, c, r, 0, 2 * Math.PI); g.stroke();
  luaTextura.needsUpdate = true;
}

// ---- planetas: um ponto colorido com o nome ao lado ----
const LIMITE_2D = 6.0;
const planetas2D = new Map();
function planeta2D(nome) {
  if (!planetas2D.has(nome)) {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: COR_PLANETA[nome], depthTest: false }));
    mesh.renderOrder = 4;
    cena.add(mesh);
    planetas2D.set(nome, { mesh, el: rotulo(nome, 'esq', COR_PLANETA[nome]) });
  }
  return planetas2D.get(nome);
}

// ---- satelites no disco: o arco da passagem e a posicao agora ----
let versaoSat2D = -1;
const trilhas2D = [];

/** Refaz os arcos quando chega uma trajetoria nova: so a parte acima do horizonte aparece no disco. */
function refazerSatelites2D() {
  if (sats.versao === versaoSat2D) return;
  versaoSat2D = sats.versao;
  for (const t of trilhas2D) {
    t.linhas.forEach(l => { disco.remove(l); l.geometry.dispose(); l.material.dispose(); });
    cena.remove(t.marcador);
    t.marcador.geometry.dispose();
    t.marcador.material.dispose();
    t.el.remove();
  }
  trilhas2D.length = 0;

  for (const sat of sats.lista) {
    const cor = new THREE.Color(sat.cor);
    const linhas = [];
    let atual = [];
    const fechar = () => {
      if (atual.length > 1) {
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(atual),
          new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: 0.85 }));
        disco.add(l);
        linhas.push(l);
      }
      atual = [];
    };
    for (const a of sat.amostras) {
      if (a[7] != null && a[7] > 0) {
        const r = Math.tan(rad(90 - a[7]) / 2);
        atual.push(new THREE.Vector3(-r * Math.sin(rad(a[6])), r * Math.cos(rad(a[6])), 0.2));
      } else {
        fechar();
      }
    }
    fechar();

    const marcador = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: cor, depthTest: false }));
    marcador.scale.set(5, 5, 1);
    marcador.renderOrder = 6;
    cena.add(marcador);
    trilhas2D.push({ sat, linhas, marcador, el: rotulo(sat.nome, 'esq', sat.cor) });
  }
}

function atualizarSatelites2D(naTela, h) {
  refazerSatelites2D();
  for (const t of trilhas2D) {
    const p = sats.posicao(t.sat);
    const visivel = modo === '2d' && p && p.elevacao != null && p.elevacao > 0;
    t.marcador.visible = !!visivel;
    t.el.style.display = visivel ? '' : 'none';
    if (!visivel) continue;
    const [x, y] = naTela(rad(p.elevacao), rad(p.azimute));
    t.marcador.position.set(x, h - y, 0);
    // na sombra da Terra o satelite nao reflete luz: fica apagado
    t.marcador.material.color.set(p.iluminado ? t.sat.cor : '#555a66');
    t.el.textContent = `${t.sat.nome} ${sinal(p.elevacao)}°`;
    colocar(t.el, x + 9, y);
  }
}

let satEscritoEm = 0;
/** Uma linha de texto por satelite, uma vez por segundo. */
function escreverSatelitesCeu() {
  if (Date.now() - satEscritoEm < 1000) return;
  satEscritoEm = Date.now();
  const caixa = document.getElementById('linhasSat');
  caixa.replaceChildren();
  for (const sat of sats.lista) {
    const linha = document.createElement('div');
    const ponto = document.createElement('span');
    ponto.textContent = '\u25cf ';
    ponto.style.color = sat.cor;
    linha.append(ponto, descreverSatelite(sat, sats.posicao(sat)));
    caixa.appendChild(linha);
  }
  for (const aviso of sats.avisos) {
    const linha = document.createElement('div');
    linha.textContent = 'Aviso: ' + aviso;
    linha.style.color = '#ff9a66';
    caixa.appendChild(linha);
  }
}

// ---- rotulos HTML ----
function rotulo(texto, classe = '', cor = '') {
  const el = document.createElement('div');
  el.className = 'rotulo ' + classe;
  el.textContent = texto;
  if (cor) el.style.color = cor;
  rotulos.appendChild(el);
  return el;
}
const hex = n => '#' + n.toString(16).padStart(6, '0');
const rosa = {
  N: rotulo('N', '', hex(COR_HORIZONTE)), S: rotulo('S', '', hex(COR_HORIZONTE)),
  L: rotulo('L', '', hex(COR_HORIZONTE)), O: rotulo('O', '', hex(COR_HORIZONTE)),
};
const rotuloZenite = rotulo('zênite', '', hex(COR_GRADE));
const rotuloSol = rotulo('Sol');
const rotuloLua = rotulo('Lua');
let nomes = [];

function colocar(el, x, y) { // x, y em pixels, y para baixo
  el.style.left = x + 'px';
  el.style.top = y + 'px';
}

// ---- estado: zoom, deslocamento e o que o servidor mandou ----
let zoom = 1, deslocX = 0, deslocY = 0;
let agora = null; // resposta de /api/ceu
let faseDesenhada = -1;

const largura = () => canvas.clientWidth;
const altura = () => canvas.clientHeight;
const centroDaBase = () => (MARGEM_DE_CIMA + altura() - MARGEM_DE_BAIXO) / 2;
const raioBase = () => Math.min((altura() - MARGEM_DE_CIMA - MARGEM_DE_BAIXO) / 2 - 18, largura() / 2 - 60);

/** Aproxima ou afasta mantendo parado o ponto do ceu que esta sob o cursor. */
function aproximar(fator, ancoraX, ancoraY) {
  const anterior = zoom;
  zoom = Math.max(1, Math.min(20, zoom * fator));
  const mudanca = zoom / anterior;
  const baseX = largura() / 2, baseY = centroDaBase();
  deslocX = (ancoraX - baseX) - mudanca * (ancoraX - baseX - deslocX);
  deslocY = (ancoraY - baseY) - mudanca * (ancoraY - baseY - deslocY);
}

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (modo === 'esfera') return esfera.aproximar(Math.exp(e.deltaY * 0.001));
  if (modo === 'obs') return observador.aproximar(Math.exp(e.deltaY * 0.001));
  aproximar(Math.pow(1.2, -Math.sign(e.deltaY)), e.clientX, e.clientY);
}, { passive: false });
let arrasto = null;
canvas.addEventListener('pointerdown', e => { arrasto = e; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
canvas.addEventListener('pointerup', () => { arrasto = null; canvas.style.cursor = 'grab'; });
canvas.addEventListener('pointermove', e => {
  if (!arrasto) return;
  if (modo === 'esfera') {
    esfera.arrastar(e.clientX - arrasto.clientX, e.clientY - arrasto.clientY);
    arrasto = e;
    return;
  }
  if (modo === 'obs') {
    observador.arrastar(e.clientX - arrasto.clientX, e.clientY - arrasto.clientY, altura());
    arrasto = e;
    return;
  }
  deslocX += e.clientX - arrasto.clientX;
  deslocY += e.clientY - arrasto.clientY;
  arrasto = e;
});
addEventListener('keydown', e => {
  if (modo === 'obs') {
    if (e.key.startsWith('Arrow')) e.preventDefault();
    observador.tecla(e.key);
    return;
  }
  if (modo === 'esfera') {
    if (e.key === '+') esfera.aproximar(1 / 1.2);
    else if (e.key === '-') esfera.aproximar(1.2);
    else if (e.key === '0') esfera.reiniciar();
    return;
  }
  if (e.key === '+') aproximar(1.25, largura() / 2, centroDaBase() + deslocY);
  else if (e.key === '-') aproximar(1 / 1.25, largura() / 2, centroDaBase() + deslocY);
  else if (e.key === '0') { zoom = 1; deslocX = 0; deslocY = 0; }
});

// ---- disco 2D ou esfera 3D ----
const modos = document.getElementById('modos');
function mudarModo(novo) {
  modo = novo;
  modos.querySelectorAll('button').forEach(b => b.classList.toggle('ativo', b.dataset.modo === novo));
  painel3d.hidden = novo !== 'esfera';
  painelObs.hidden = novo !== 'obs';
  hud.hidden = novo !== 'obs';
  rotulos.style.display = novo === '2d' ? '' : 'none';
  rotulos3d.style.display = novo === 'esfera' ? '' : 'none';
  rotulosObs.style.display = novo === 'obs' ? '' : 'none';
  if (novo !== 'esfera') esfera.esconderRotulos();
  if (novo !== 'obs') observador.esconderRotulos();
}
modos.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) mudarModo(b.dataset.modo);
});
// ?modo=esfera ou ?modo=obs abre direto no modo
const modoInicial = new URLSearchParams(location.search).get('modo');
if (['esfera', 'obs'].includes(modoInicial)) mudarModo(modoInicial);

// ---- dados ----
// ?t=2026-06-21T15:00:00Z mostra o ceu de outro instante, parado
const instanteFixo = new URLSearchParams(location.search).get('t');

// os satelites da pasta data/tle, que as tres visoes desenham
const sats = new Satelites(instanteFixo);
esfera.satelites = sats;
observador.satelites = sats;
sats.iniciar();
async function carregarCatalogo() {
  montarCatalogo(await (await fetch('/api/ceu/catalogo')).json());
}
async function carregarAgora() {
  try {
    const pedido = new Date();
    const novo = await (await fetch('/api/ceu?t=' + (instanteFixo || pedido.toISOString()))).json();
    // o tempo sideral anda 0,0041781 grau por segundo: entre uma resposta e outra o ceu segue girando
    novo.tsl0 = novo.tempoSideral;
    novo.pedidoEm = pedido.getTime();
    agora = novo;
    if (agora.lua) agora.lua.fracaoDoCiclo !== faseDesenhada && (faseDesenhada = agora.lua.fracaoDoCiclo, desenharLua(faseDesenhada));
  } catch (e) { /* servidor fora do ar: mantem o ultimo quadro */ }
}

// ---- textos ----
const fmt = (n, c = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
const sinal = (n, c = 1) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n), c);
const dois = n => String(n).padStart(2, '0');

function nomeDoDia(a) {
  return a > 0 ? 'dia' : a > -6 ? 'crepúsculo civil' : a > -12 ? 'crepúsculo náutico'
    : a > -18 ? 'crepúsculo astronômico' : 'noite fechada';
}

function alturaAzimute(ra, dec) {
  const la = rad(agora.casa.latitude), d = rad(dec), h = rad(agora.tempoSideral - ra);
  const alt = Math.asin(Math.sin(la) * Math.sin(d) + Math.cos(la) * Math.cos(d) * Math.cos(h));
  const az = Math.atan2(-Math.sin(h) * Math.cos(d), Math.cos(la) * Math.sin(d) - Math.sin(la) * Math.cos(d) * Math.cos(h));
  return [alt, az];
}

// ---- quadro ----
function desenhar() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = largura(), h = altura();
  renderer.setPixelRatio(dpr);
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) renderer.setSize(w, h, false);
  camera.right = w; camera.top = h;
  camera.updateProjectionMatrix();

  const d = instanteFixo ? new Date(instanteFixo) : new Date();
  document.getElementById('data').textContent =
    `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())} - ${instanteFixo ? 'instante fixo' : 'tempo real'}`;
  document.getElementById('rodape').textContent = modo === 'esfera'
    ? 'Tempo real - arrastar gira a esfera, roda do mouse aproxima, 0 volta ao normal - F4 e F5 trocam de tela - F11 tela cheia'
    : modo === 'obs'
    ? 'Tempo real - arrastar ou setas viram a cabeça, roda do mouse muda o zoom, 0 volta ao normal - F4 e F5 trocam de tela - F11 tela cheia'
    : `Tempo real - roda do mouse aproxima (${fmt(zoom)}x), arrastar move, 0 volta ao normal - F4 e F5 trocam de tela - F11 tela cheia`;

  if (agora && agora.casa && !instanteFixo) {
    agora.tempoSideral = (agora.tsl0 + (Date.now() - agora.pedidoEm) / 1000 * 0.0041780745) % 360;
  }

  if (!agora || !agora.casa) {
    document.getElementById('linha1').textContent = agora ? 'Sem data/config.json com a chave home' : '';
    disco.visible = false;
    renderer.render(cena, camera);
    requestAnimationFrame(desenhar);
    return;
  }

  const raio = raioBase() * zoom;
  const cx = w / 2 + deslocX, cy = centroDaBase() + deslocY; // y para baixo
  const cyCima = h - cy;

  const claridade = Math.max(0, Math.min(1, (agora.sol.altura - FIM_DO_CREPUSCULO) / -FIM_DO_CREPUSCULO));
  disco.visible = true;
  disco.position.set(cx, cyCima, 0);
  disco.scale.set(raio, raio, 1);
  fundo.material.color.copy(COR_NOITE).lerp(COR_DIA, claridade);

  uniformes.tsl.value = agora.tempoSideral;
  uniformes.lat.value = agora.casa.latitude;
  uniformes.centro.value.set(cx, cyCima);
  uniformes.raio.value = raio;
  uniformes.tela.value.set(w, h);

  const transparencia = 1 - claridade;
  if (estrelas) {
    estrelas.material.uniforms.dpr.value = dpr;
    estrelas.material.uniforms.alfa.value = transparencia;
    estrelas.visible = transparencia >= 0.02;
    linhasDasConstelacoes.material.uniforms.alfa.value = transparencia * 0.75;
    linhasDasConstelacoes.visible = transparencia * 0.75 >= 0.02;
  }

  // posicao de um astro no disco, em pixels, y para baixo
  const naTela = (alt, az) => {
    const r = Math.min(Math.tan((Math.PI / 2 - alt) / 2), 50);
    return [cx - raio * r * Math.sin(az), cy - raio * r * Math.cos(az)];
  };

  // Sol
  const alturaSol = agora.sol.altura;
  sol.visible = alturaSol > -1;
  rotuloSol.style.display = sol.visible ? '' : 'none';
  if (sol.visible) {
    const [x, y] = naTela(rad(alturaSol), rad(agora.sol.azimute));
    sol.position.set(x, h - y, 0);
    colocar(rotuloSol, x, y - 20);
  }

  // Lua
  const alturaLua = agora.lua.altura;
  const luaVisivel = alturaLua > -1;
  lua.visible = luaVisivel;
  rotuloLua.style.display = luaVisivel ? '' : 'none';
  if (luaVisivel) {
    const [x, y] = naTela(rad(alturaLua), rad(agora.lua.azimute));
    lua.position.set(x, h - y, 0);
    colocar(rotuloLua, x, y - 22);
  }

  const visiveis3 = [];
  for (const p of agora.planetas || []) {
    const o = planeta2D(p.nome);
    const vis = planetaVisivel(p, LIMITE_2D, claridade);
    o.mesh.visible = vis && modo === '2d';
    o.el.style.display = vis ? '' : 'none';
    if (vis) {
      visiveis3.push(`${p.nome} (${sinal(p.magnitude)})`);
      const [x, y] = naTela(rad(p.altura), rad(p.azimute));
      const r = Math.max(2.5, Math.min(7, 3.5 + (1.5 - p.magnitude) * 0.9));
      o.mesh.position.set(x, h - y, 0);
      o.mesh.scale.set(r, r, 1);
      colocar(o.el, x + r + 4, y);
    }
  }
  document.getElementById('linha3').textContent = visiveis3.length
    ? 'Planetas visíveis: ' + visiveis3.join(', ') : 'Nenhum planeta visível agora';

  atualizarSatelites2D(naTela, h);
  escreverSatelitesCeu();

  colocar(rosa.N, cx, cy - raio - 16);
  colocar(rosa.S, cx, cy + raio + 16);
  colocar(rosa.L, cx - raio - 16, cy);
  colocar(rosa.O, cx + raio + 16, cy);
  colocar(rotuloZenite, cx, cy - 12);

  // nomes das estrelas e contagem das que estao acima do horizonte
  nomes.forEach(({ i, el }) => {
    const [alt, az] = alturaAzimute(catalogo.ra[i], catalogo.dec[i]);
    el.style.display = alt > 0 && transparencia >= 0.02 ? '' : 'none';
    if (alt > 0) {
      const [x, y] = naTela(alt, az);
      const tamanho = Math.max(0.7, (6.5 - catalogo.magnitude[i]) * 0.55);
      colocar(el, x + tamanho + 4, y);
      el.style.opacity = transparencia * 0.85;
    }
  });
  if (catalogo && contado !== agora.tempoSideral) {
    contado = agora.tempoSideral;
    visiveis = 0;
    for (let i = 0; i < catalogo.ra.length; i++) if (alturaAzimute(catalogo.ra[i], catalogo.dec[i])[0] > 0) visiveis++;
  }

  document.getElementById('linha1').textContent =
    `Casa em ${fmt(agora.casa.latitude, 4)}, ${fmt(agora.casa.longitude, 4)} - tempo sideral local ${fmt(agora.tempoSideral / 15, 2)} h - ${visiveis} estrelas acima do horizonte`;
  document.getElementById('linha2').textContent =
    `Sol a ${sinal(alturaSol)} de altura, ${nomeDoDia(alturaSol)} - Lua a ${sinal(alturaLua)}, ${agora.lua.nome}, ${fmt(agora.lua.iluminacao * 100, 0)}% iluminada`;

  if (modo === 'esfera') {
    renderer.setViewport(0, 0, w, h);
    esfera.desenhar(renderer, w, h, agora, claridade, dpr);
  } else if (modo === 'obs') {
    renderer.setViewport(0, 0, w, h);
    observador.desenhar(renderer, w, h, agora, claridade, dpr);
  } else {
    renderer.render(cena, camera);
  }
  requestAnimationFrame(desenhar);
}
let contado = null, visiveis = 0;

carregarCatalogo();
carregarAgora();
setInterval(carregarAgora, 1000);
desenhar();
