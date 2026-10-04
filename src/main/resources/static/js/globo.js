import * as THREE from 'three';
import { Satelites, descreverSatelite } from './satelites.js';

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
marcaCasa.style.display = 'none';

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
      marcaCasa.style.display = '';
      marcaCasa.style.setProperty('--cor', dados.casa.dia ? COR_DIA : COR_NOITE);
    }
    if (!carregar.centrou) {
      carregar.centrou = true;
      const c = dados.casa || dados.sol;
      visao.lat = c.latitude;
      visao.lon = c.longitude;
    }
    escreverInformacoes();
  } catch (e) { /* servidor fora do ar: mantem o ultimo quadro */ }
}

const dois = n => String(n).padStart(2, '0');
const hhmm = d => `${dois(d.getHours())}:${dois(d.getMinutes())}`;
const fmt = (n, c = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });

function escreverInformacoes() {
  if (!dados) return;
  const agora = new Date();
  const utc = `${dois(agora.getUTCHours())}:${dois(agora.getUTCMinutes())}:${dois(agora.getUTCSeconds())}`;
  const aqui = `${dois(agora.getHours())}:${dois(agora.getMinutes())}:${dois(agora.getSeconds())}`;
  let html = `${aqui} aqui, ${utc} UTC &nbsp;|&nbsp; Sol a pino em ${fmt(dados.sol.latitude)}, ${fmt(dados.sol.longitude)}`;

  const c = dados.casa;
  if (!c) {
    html += '<br>Sem data/config.json com a chave home, então a casa não aparece no mapa';
  } else {
    html += `<br>Casa em ${fmt(c.latitude, 4)}, ${fmt(c.longitude, 4)}: ${c.dia ? 'dia' : 'noite'}, `
      + `Sol a ${fmt(c.alturaDoSol, 1)} de altura e ${fmt(c.azimute, 0)} de azimute`;
    if (c.horasAteONascer >= 0 && c.horasAteOPor >= 0) {
      const quando = h => hhmm(new Date(agora.getTime() + h * 3600_000));
      html += ` &nbsp;|&nbsp; nasce ${quando(c.horasAteONascer)}, se põe ${quando(c.horasAteOPor)}`;
    }
  }
  document.getElementById('infoCasa').innerHTML = html;
}

// ---- satelites: a trilha no mapa e na esfera, e a posicao agora ----
const RAIO_DA_TERRA_KM = 6371;
const sats = new Satelites();
sats.iniciar();
let mostrarSatelites = true;
let versaoDesenhada = -1;
let trilhas = []; // por satelite: { sat, marca, segmentos: [{ i0, n, passadoPlano, futuroPlano, passadoEsfera, futuroEsfera }] }

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

    trilhas.push({ sat, objetos, segmentos: info, marca: criarMarca(sat.nome, sat.cor, 11) });
  }
}

/** A cada quadro: o satelite anda, e o trecho que ele ja percorreu fica mais apagado que o que falta. */
function atualizarSatelites() {
  refazerTrilhas();
  for (const t of trilhas) {
    const p = mostrarSatelites ? sats.posicao(t.sat) : null;
    t.marca.style.display = p ? '' : 'none';
    for (const s of t.segmentos) {
      const k = p ? p.indice - s.i0 : -1; // onde o satelite esta, contado desde o inicio do segmento
      const passado = Math.max(0, Math.min(s.n, Math.floor(k) + 1));
      const lados = [[s.passadoPlano, s.futuroPlano, !modo3d], [s.passadoEsfera, s.futuroEsfera, modo3d]];
      for (const [antes, depois, ligado] of lados) {
        antes.visible = depois.visible = ligado && mostrarSatelites;
        antes.geometry.setDrawRange(0, Math.max(passado + 1, 0));
        depois.geometry.setDrawRange(Math.max(passado - 1, 0), s.n);
      }
    }
    if (p) posicionar(t.marca, p.latitude, p.longitude, 1 + p.altitude / RAIO_DA_TERRA_KM);
  }
}

function escreverSatelites() {
  const caixa = document.getElementById('infoSat');
  caixa.replaceChildren();
  if (!mostrarSatelites) return;
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

const botaoSat = document.getElementById('botaoSat');
botaoSat.addEventListener('click', () => {
  mostrarSatelites = !mostrarSatelites;
  botaoSat.textContent = mostrarSatelites ? 'Satélites: sim' : 'Satélites: não';
  escreverSatelites();
});

const botao = document.getElementById('modo');
botao.addEventListener('click', () => {
  modo3d = !modo3d;
  botao.textContent = modo3d ? 'Mapa plano' : 'Globo 3D';
});

// ---- quadro ----
function desenhar() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) renderer.setSize(w, h, false);

  const aspecto = w / h;
  esfera.visible = modo3d;
  plano.visible = !modo3d;

  // o mapa plano ocupa a largura e deixa espaco para a barra de informacoes, que cresce com os satelites
  const util = Math.max(h - document.getElementById('informacoes').offsetHeight - 4, 1);
  if (modo3d) {
    camera3d.aspect = aspecto;
    camera3d.position.copy(normal(visao.lat, visao.lon)).multiplyScalar(visao.distancia);
    camera3d.lookAt(0, 0, 0);
    // sobe o centro da esfera para a area acima da barra de informacoes
    camera3d.setViewOffset(w, h, 0, (h - util) / 2, w, h);
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

  if (dados) {
    posicionar(marcaSol, dados.sol.latitude, dados.sol.longitude);
    if (dados.casa) posicionar(marcaCasa, dados.casa.latitude, dados.casa.longitude);
  }
  requestAnimationFrame(desenhar);
}

carregar();
setInterval(carregar, 1000);
setInterval(escreverInformacoes, 1000);
setInterval(escreverSatelites, 1000);
desenhar();
