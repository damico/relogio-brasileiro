import * as THREE from 'three';
import { Satelites } from './satelites.js';
import { iniciarColunaEsquerda } from './colunaEsquerda.js';
import { montarListaDeSatelites } from './satelitesUI.js';

const COR_DIA = '#ffd246';
const COR_NOITE = '#78aaff';
const rad = THREE.MathUtils.degToRad;

const canvas = document.getElementById('tela');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const cena = new THREE.Scene();

/** Ponto da esfera para latitude e longitude, no mesmo quadro do SphereGeometry do three. */
function normal(lat, lon, alvo = new THREE.Vector3()) {
  return alvo.set(Math.cos(rad(lat)) * Math.cos(rad(lon)), Math.sin(rad(lat)), -Math.cos(rad(lat)) * Math.sin(rad(lon)));
}

// ---- a Terra: a mesma textura e o mesmo shader no mapa plano e na esfera ----
const textura = new THREE.TextureLoader().load('/img/terra.jpg');
textura.colorSpace = THREE.SRGBColorSpace;
textura.anisotropy = 8;

/**
 * O dia e a noite saem de um produto escalar por pixel: a normal do ponto
 * (lida da latitude e da longitude da textura) contra a direcao do Sol a
 * pino. O terminador e a linha onde o produto vale zero, e ele anda 15 graus
 * por hora sem precisar de nenhum circulo desenhado.
 */
const material = new THREE.ShaderMaterial({
  uniforms: { mapa: { value: textura }, sol: { value: new THREE.Vector3(1, 0, 0) } },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D mapa;
    uniform vec3 sol;
    varying vec2 vUv;
    void main() {
      float lon = (vUv.x - 0.5) * 6.28318530718;
      float lat = (vUv.y - 0.5) * 3.14159265359;
      vec3 n = vec3(cos(lat) * cos(lon), sin(lat), -cos(lat) * sin(lon));
      float d = dot(n, sol);
      float luz = smoothstep(-0.10, 0.06, d);
      vec3 cor = texture2D(mapa, vUv).rgb;
      vec3 noite = cor * vec3(0.05, 0.07, 0.16);
      float borda = 1.0 - smoothstep(0.0, 0.012, abs(d));
      gl_FragColor = vec4(mix(noite, cor, luz) + vec3(0.35, 0.5, 0.8) * borda * 0.35, 1.0);
      #include <colorspace_fragment>
    }`,
});

const esfera = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), material);
const plano = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), material);
cena.add(esfera, plano);

const camera3d = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
const cameraPlana = new THREE.OrthographicCamera(-2, 2, 1, -1, -5, 5);

// ---- estado ----
let modo3d = false;
let dados = null;
let visao = { lat: 20, lon: -46, distancia: 3.2 };

// ---- marcas em HTML, projetadas na tela a cada quadro ----
function criarMarca(texto, cor, tamanho) {
  const el = document.createElement('div');
  el.className = 'marca';
  el.style.setProperty('--cor', cor);
  el.style.setProperty('--d', tamanho + 'px');
  el.textContent = texto;
  document.getElementById('marcas').appendChild(el);
  return el;
}
const marcaSol = criarMarca('Sol a pino', COR_DIA, 14);
const marcaCasa = criarMarca('casa', COR_NOITE, 11);

function noMapa(lat, lon) {
  return new THREE.Vector3(lon / 180 * 2, lat / 90, 0.01);
}

function posicionar(el, lat, lon, raio = 1.004) {
  const cam = modo3d ? camera3d : cameraPlana;
  const p = modo3d ? normal(lat, lon).multiplyScalar(raio) : noMapa(lat, lon);
  // do outro lado da esfera a marca some
  if (modo3d && normal(lat, lon).dot(camera3d.position.clone().normalize()) < 0.05) {
    el.style.visibility = 'hidden';
    return;
  }
  el.style.visibility = 'visible';
  const v = p.clone().project(cam);
  el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px';
  el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
}

// ---- dados do servidor ----
async function carregar() {
  try {
    const r = await fetch('/api/globo?t=' + new Date().toISOString());
    dados = await r.json();
    material.uniforms.sol.value.copy(normal(dados.sol.latitude, dados.sol.longitude));
    if (dados.casa) {
      marcaCasa.style.setProperty('--cor', dados.casa.dia ? COR_DIA : COR_NOITE);
    }
    if (!carregar.centrou) {
      carregar.centrou = true;
      const c = dados.casa || dados.sol;
      visao.lat = c.latitude;
      visao.lon = c.longitude;
    }
  } catch (e) { /* servidor fora do ar: mantem o ultimo quadro */ }
}

// ---- satelites: a trilha no mapa e na esfera, e a posicao agora ----
const RAIO_DA_TERRA_KM = 6371;
const sats = new Satelites();
sats.iniciar();
let mostrarSatelites = true;
let mostrarFaixa = true;
let mostrarSol = true;
let mostrarCasa = true;
let versaoDesenhada = -1;
let trilhas = []; // por satelite: { sat, marca, segmentos: [{ i0, n, passadoPlano, futuroPlano, passadoEsfera, futuroEsfera }] }

/** Rumo inicial do circulo maximo de um ponto a outro, em graus. */
function rumoEntre(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
  return Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) * 180 / Math.PI;
}

/** O ponto a uma distancia, num rumo, de outro ponto da esfera. */
function destinoDe(lat, lon, rumo, km) {
  const d = km / RAIO_DA_TERRA_KM, la = lat * Math.PI / 180, lo = lon * Math.PI / 180, b = rumo * Math.PI / 180;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return [la2 * 180 / Math.PI, ((lo2 * 180 / Math.PI + 540) % 360) - 180];
}

/**
 * A faixa que o satelite imageia: uma tira de largura fixa centrada na trilha.
 * Em cada amostra, as bordas ficam a meia largura para cada lado, no rumo
 * perpendicular a trilha. Onde a borda cruza o meridiano de 180 graus, o mapa
 * plano nao desenha, para nao riscar o mapa inteiro.
 */
function montarFaixa(sat, cor, objetos) {
  const a = sat.amostras, meia = sat.larguraDaFaixaKm / 2, n = a.length;
  const esq = [], dir = [];
  for (let i = 0; i < n; i++) {
    const j = i < n - 1 ? i : i - 1;
    const rumo = rumoEntre(a[j][1], a[j][2], a[j + 1][1], a[j + 1][2]);
    esq.push(destinoDe(a[i][1], a[i][2], rumo - 90, meia));
    dir.push(destinoDe(a[i][1], a[i][2], rumo + 90, meia));
  }

  const plano = new Float32Array(n * 6), esfera = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    [esq[i], dir[i]].forEach(([lat, lon], lado) => {
      const pl = noMapa(lat, lon), es = normal(lat, lon).multiplyScalar(1.003);
      plano.set([pl.x, pl.y, 0.015], (i * 2 + lado) * 3);
      esfera.set([es.x, es.y, es.z], (i * 2 + lado) * 3);
    });
  }

  // um trecho so existe no mapa plano se os seis vertices dele ficam do mesmo lado do meridiano de 180 graus.
  // Comparar so vizinhos do mesmo lado nao basta: com a trilha em cima do meridiano, uma borda cai em +180 e a outra
  // em -180, e ligar as duas riscaria o mapa de ponta a ponta
  const pulo = i => {
    const lons = [esq[i][1], dir[i][1], a[i][2], esq[i + 1][1], dir[i + 1][1], a[i + 1][2]];
    return Math.max(...lons) - Math.min(...lons) > 180;
  };
  const triPlano = [], triEsfera = [], ladosPlano = [], ladosEsfera = [];
  for (let i = 0; i < n - 1; i++) {
    const quad = [i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2];
    triEsfera.push(...quad);
    ladosEsfera.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 3);
    if (!pulo(i)) {
      triPlano.push(...quad);
      ladosPlano.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 3);
    }
  }

  const criar = (posicoes, tri, lados, profundidade) => {
    const attr = new THREE.BufferAttribute(posicoes, 3);
    const gf = new THREE.BufferGeometry();
    gf.setAttribute('position', attr);
    gf.setIndex(tri);
    const preenchimento = new THREE.Mesh(gf, new THREE.MeshBasicMaterial({
      color: cor, transparent: true, opacity: 0.17, side: THREE.DoubleSide, depthWrite: false, depthTest: profundidade }));
    const ge = new THREE.BufferGeometry();
    ge.setAttribute('position', attr);
    ge.setIndex(lados);
    const bordas = new THREE.LineSegments(ge, new THREE.LineBasicMaterial({
      color: cor, transparent: true, opacity: 0.55, depthTest: profundidade }));
    [preenchimento, bordas].forEach(o => { o.frustumCulled = false; cena.add(o); objetos.push(o); });
    return [preenchimento, bordas];
  };
  return { plano: criar(plano, triPlano, ladosPlano, false), esfera: criar(esfera, triEsfera, ladosEsfera, true) };
}

function descartar(objetos) {
  for (const o of objetos) {
    cena.remove(o);
    o.geometry.dispose();
    o.material.dispose();
  }
}

/** Refaz as trilhas quando chega uma trajetoria nova. A de cada satelite e um tracado so, partido onde cruza o meridiano de 180 graus. */
function refazerTrilhas() {
  if (sats.versao === versaoDesenhada) return;
  versaoDesenhada = sats.versao;

  trilhas.forEach(t => { descartar(t.objetos); t.marca.remove(); });
  trilhas = [];

  for (const sat of sats.lista) {
    const cor = new THREE.Color(sat.cor);
    const objetos = [];
    const a = sat.amostras;

    // um segmento termina onde a longitude da um salto: a trilha sai de um lado do mapa e volta do outro
    const segmentos = [];
    let i0 = 0;
    for (let i = 1; i <= a.length; i++) {
      if (i === a.length || Math.abs(a[i][2] - a[i - 1][2]) > 180) {
        segmentos.push([i0, i - 1]);
        i0 = i;
      }
    }

    const linha = (posicoes, opacidade, profundidade) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', posicoes);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: opacidade, depthTest: profundidade }));
      l.frustumCulled = false;
      cena.add(l);
      objetos.push(l);
      return l;
    };

    const info = segmentos.map(([ini, fim]) => {
      const n = fim - ini + 1;
      const plano = new Float32Array(n * 3), esfera = new Float32Array(n * 3);
      for (let j = 0; j < n; j++) {
        const [, lat, lon, alt] = a[ini + j];
        const pl = noMapa(lat, lon);
        plano.set([pl.x, pl.y, 0.02], j * 3);
        const es = normal(lat, lon).multiplyScalar(1 + alt / RAIO_DA_TERRA_KM);
        esfera.set([es.x, es.y, es.z], j * 3);
      }
      const attrPlano = new THREE.BufferAttribute(plano, 3), attrEsfera = new THREE.BufferAttribute(esfera, 3);
      return {
        i0: ini, n,
        passadoPlano: linha(attrPlano, 0.35, false), futuroPlano: linha(attrPlano, 1, false),
        passadoEsfera: linha(attrEsfera, 0.35, true), futuroEsfera: linha(attrEsfera, 1, true),
      };
    });

    const faixa = sat.larguraDaFaixaKm ? montarFaixa(sat, cor, objetos) : null;
    trilhas.push({ sat, objetos, faixa, segmentos: info, marca: criarMarca(sat.nome, sat.cor, 11) });
  }
}

/** A cada quadro: o satelite anda, e o trecho que ele ja percorreu fica mais apagado que o que falta. */
function atualizarSatelites() {
  refazerTrilhas();
  for (const t of trilhas) {
    const ligado = mostrarSatelites && sats.visivel(t.sat);
    const p = ligado ? sats.posicao(t.sat) : null;
    t.marca.style.display = p ? '' : 'none';
    for (const s of t.segmentos) {
      const k = p ? p.indice - s.i0 : -1; // onde o satelite esta, contado desde o inicio do segmento
      const passado = Math.max(0, Math.min(s.n, Math.floor(k) + 1));
      const lados = [[s.passadoPlano, s.futuroPlano, !modo3d], [s.passadoEsfera, s.futuroEsfera, modo3d]];
      for (const [antes, depois, lado] of lados) {
        antes.visible = depois.visible = lado && ligado;
        antes.geometry.setDrawRange(0, Math.max(passado + 1, 0));
        depois.geometry.setDrawRange(Math.max(passado - 1, 0), s.n);
      }
    }
    if (t.faixa) {
      const ligada = ligado && mostrarFaixa;
      t.faixa.plano.forEach(o => { o.visible = ligada && !modo3d; });
      t.faixa.esfera.forEach(o => { o.visible = ligada && modo3d; });
    }
    if (p) posicionar(t.marca, p.latitude, p.longitude, 1 + p.altitude / RAIO_DA_TERRA_KM);
  }
}

// ---- interacao: arrastar gira o globo, a roda aproxima ----
let arrasto = null;
canvas.addEventListener('pointerdown', e => { if (modo3d) { arrasto = e; canvas.setPointerCapture(e.pointerId); } });
canvas.addEventListener('pointerup', () => { arrasto = null; });
canvas.addEventListener('pointermove', e => {
  if (!arrasto) return;
  const k = 0.25 * visao.distancia / 3.2;
  visao.lon -= (e.clientX - arrasto.clientX) * k;
  visao.lat = Math.max(-85, Math.min(85, visao.lat + (e.clientY - arrasto.clientY) * k));
  arrasto = e;
});
canvas.addEventListener('wheel', e => {
  if (!modo3d) return;
  e.preventDefault();
  visao.distancia = Math.max(1.4, Math.min(6, visao.distancia * Math.exp(e.deltaY * 0.001)));
}, { passive: false });

// ---- configuracao: a coluna da direita ----
const segmentos = document.querySelectorAll('#visaoGlobo button');
segmentos.forEach(b => b.addEventListener('click', () => {
  modo3d = b.dataset.visao === '3d';
  segmentos.forEach(x => x.classList.toggle('ativo', x === b));
  document.getElementById('notaVisao').textContent = modo3d
    ? 'Arraste para girar o globo e use a roda do mouse para aproximar.'
    : 'O mapa inteiro de uma vez, com a noite sombreada.';
}));

const camada = (id, aplicar) => {
  const caixa = document.getElementById(id);
  caixa.addEventListener('change', () => aplicar(caixa.checked));
};
camada('camSatelites', v => { mostrarSatelites = v; });
camada('camFaixa', v => { mostrarFaixa = v; });
camada('camSol', v => { mostrarSol = v; });
camada('camCasa', v => { mostrarCasa = v; });

iniciarColunaEsquerda({ sats });
montarListaDeSatelites(document.getElementById('listaSatelites'), sats);

// ---- quadro ----
function desenhar() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) renderer.setSize(w, h, false);

  const aspecto = w / h;
  esfera.visible = modo3d;
  plano.visible = !modo3d;

  // o mapa ocupa a tela inteira: as informacoes ficam nas colunas, que sao transparentes
  const util = h;
  if (modo3d) {
    camera3d.aspect = aspecto;
    camera3d.position.copy(normal(visao.lat, visao.lon)).multiplyScalar(visao.distancia);
    camera3d.lookAt(0, 0, 0);
    camera3d.updateProjectionMatrix();
  } else {
    // mundo por pixel: o mapa (4 x 2) cabe inteiro na area util, centralizado nela
    const m = Math.max(2 / util, 4 / w);
    cameraPlana.left = -w * m / 2;
    cameraPlana.right = w * m / 2;
    cameraPlana.top = util * m / 2;
    cameraPlana.bottom = util * m / 2 - h * m;
    cameraPlana.updateProjectionMatrix();
  }

  renderer.render(cena, modo3d ? camera3d : cameraPlana);

  atualizarSatelites();

  marcaSol.style.display = mostrarSol && dados ? '' : 'none';
  marcaCasa.style.display = mostrarCasa && dados && dados.casa ? '' : 'none';
  if (dados) {
    if (mostrarSol) posicionar(marcaSol, dados.sol.latitude, dados.sol.longitude);
    if (dados.casa && mostrarCasa) posicionar(marcaCasa, dados.casa.latitude, dados.casa.longitude);
  }
  requestAnimationFrame(desenhar);
}

carregar();
setInterval(carregar, 1000);
desenhar();
