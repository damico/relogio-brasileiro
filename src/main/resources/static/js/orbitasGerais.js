import * as THREE from 'three';
import { Satelites } from './satelites.js';
import { iniciarColunaEsquerda } from './colunaEsquerda.js';
import { ControleOrbital, Rotulos, FUNDO, rad, brilho, larguraDaColunaDireita } from './util3d.js';

// As orbitas juntas: a ecliptica, que e o plano em que a Terra e o Sol se veem, e
// o plano da orbita da Lua, inclinado 5,1 graus em relacao a ela. Os dois planos
// se cortam numa reta que passa pela Terra, a linha dos nos. A Lua so cruza a
// ecliptica nos dois nos, e por isso nao ha eclipse todo mes: so quando a lua
// nova ou a cheia acontece perto de um no. A linha dos nos ainda gira para tras,
// uma volta a cada 18,6 anos, o que faz as temporadas de eclipse andarem pelo
// calendario. As posicoes saem das formulas de elementos medios, com precisao de
// cerca de um grau.
//
// Sistema: y para cima (norte da ecliptica), o plano da ecliptica e o xz, e a
// longitude cresce no sentido anti-horario visto de cima, com 0 grau em +x.

const J2000 = Date.UTC(2000, 0, 1, 12);
const INCLINACAO = 5.1;
const LIMITE_DA_TEMPORADA = 17; // de quanto o Sol pode estar longe de um no e ainda haver eclipse
const NOMES_FASE = ['Lua nova', 'Crescente côncava', 'Quarto crescente', 'Crescente gibosa',
  'Lua cheia', 'Minguante gibosa', 'Quarto minguante', 'Minguante côncava'];

const grau = a => ((a % 360) + 360) % 360;
const fmt = (n, c = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });

const canvas = document.getElementById('tela');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(FUNDO);
renderer.autoClear = false;

// so tempo real: a cena anda com o relogio de verdade
const sats = new Satelites();
sats.iniciar();
iniciarColunaEsquerda({ sats });

const camadas = { ecliptica: true, planoDaLua: true, nos: true, visaoDeCima: true, rotulos: true, exagero: true };
document.querySelectorAll('[data-camada]').forEach(caixa => {
  caixa.addEventListener('change', () => { camadas[caixa.dataset.camada] = caixa.checked; });
});

// ---- a cena principal ----
const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
const controle = new ControleOrbital(canvas, { az: 0, el: 25, d: 3.4, min: 1.6, max: 8 });
document.getElementById('reiniciarCamera').addEventListener('click', () => controle.reiniciar());
const rotulos = new Rotulos(document.getElementById('rotulos3d'));

const sol = new THREE.Group();
sol.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 24), new THREE.MeshBasicMaterial({ color: 0xffc828 })), brilho(0xffd060, 0.5));
cena.add(sol);

const textura = new THREE.TextureLoader().load('/img/terra.jpg');
textura.colorSpace = THREE.SRGBColorSpace;
const terra = new THREE.Group();
terra.add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 48, 32), new THREE.MeshStandardMaterial({ map: textura, roughness: 1 })));
terra.rotation.z = -rad(23.44); // o eixo da Terra, inclinado em relacao a ecliptica
cena.add(terra);

const lua = new THREE.Mesh(new THREE.SphereGeometry(0.045, 32, 24), new THREE.MeshStandardMaterial({ color: 0xeeeee4, roughness: 1 }));
cena.add(lua);

// a luz do Sol vem da direcao em que ele esta: ilumina a metade da Terra e da Lua virada para ele
const luz = new THREE.DirectionalLight(0xffffff, 3);
cena.add(luz, new THREE.AmbientLight(0x364055, 1.3));

// o plano e o anel da ecliptica
const planoEcliptica = new THREE.Mesh(new THREE.CircleGeometry(1, 160),
  new THREE.MeshBasicMaterial({ color: 0xbebecd, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
planoEcliptica.rotation.x = -Math.PI / 2;
const aroPontos = [];
for (let i = 0; i < 160; i++) aroPontos.push(new THREE.Vector3(Math.cos(i / 160 * 2 * Math.PI), 0, -Math.sin(i / 160 * 2 * Math.PI)));
const aroEcliptica = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(aroPontos), new THREE.LineBasicMaterial({ color: 0xbebecd }));
cena.add(planoEcliptica, aroEcliptica);

// o plano e o anel da orbita da Lua, refeitos a cada quadro porque os nos andam
const PASSOS = 180;
const posicoesPlano = new Float32Array((PASSOS + 2) * 3);
const geometriaPlano = new THREE.BufferGeometry();
geometriaPlano.setAttribute('position', new THREE.BufferAttribute(posicoesPlano, 3));
const indices = [];
for (let i = 1; i <= PASSOS; i++) indices.push(0, i, i + 1);
geometriaPlano.setIndex(indices);
const planoDaLua = new THREE.Mesh(geometriaPlano,
  new THREE.MeshBasicMaterial({ color: 0x78aafa, transparent: true, opacity: 0.17, side: THREE.DoubleSide, depthWrite: false }));
const posicoesAro = new Float32Array(PASSOS * 3);
const geometriaAro = new THREE.BufferGeometry();
geometriaAro.setAttribute('position', new THREE.BufferAttribute(posicoesAro, 3));
const aroDaLua = new THREE.LineLoop(geometriaAro, new THREE.LineBasicMaterial({ color: 0x96befa }));
planoDaLua.frustumCulled = aroDaLua.frustumCulled = false;
cena.add(planoDaLua, aroDaLua);

// a linha dos nos, com um no em cada ponta
const posicoesNos = new Float32Array(6);
const geometriaNos = new THREE.BufferGeometry();
geometriaNos.setAttribute('position', new THREE.BufferAttribute(posicoesNos, 3));
const linhaDosNos = new THREE.Line(geometriaNos, new THREE.LineBasicMaterial({ color: 0xffcd50 }));
linhaDosNos.frustumCulled = false;
const noAscendente = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffcd50 }));
const noDescendente = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffcd50 }));
cena.add(linhaDosNos, noAscendente, noDescendente);

// ponto da orbita da Lua a um angulo u contado do no ascendente
function pontoDaLua(u, no, inclinacao, r = 1, alvo = new THREE.Vector3()) {
  return alvo.set(
    r * (Math.cos(u) * Math.cos(no) - Math.sin(u) * Math.sin(no) * Math.cos(inclinacao)),
    r * Math.sin(u) * Math.sin(inclinacao),
    -r * (Math.cos(u) * Math.sin(no) + Math.sin(u) * Math.cos(no) * Math.cos(inclinacao)));
}

const rTerra = rotulos.criar('Terra', '#9cc8ff'); rTerra.dy = 26;
const rSol = rotulos.criar('Sol', '#ffd873'); rSol.dy = -30;
const rLua = rotulos.criar('Lua', '#f4f4e8'); rLua.dy = -24;
const rEcliptica = rotulos.criar('Eclíptica', '#bebecd'); rEcliptica.pos.set(0, 0, 1.0); rEcliptica.dy = 16;
const rNoAsc = rotulos.criar('nó ascendente', '#ffcd50'); rNoAsc.dy = 18;
const rNoDesc = rotulos.criar('nó descendente', '#ffcd50'); rNoDesc.dy = -16;
const rLinha = rotulos.criar('linha dos nós', '#ffcd50'); rLinha.dy = 18;

// ---- o quadro de canto, visto de cima da ecliptica ----
const cena2 = new THREE.Scene();
const camera2 = new THREE.OrthographicCamera(-1.25, 1.25, 1.25, -1.25, -5, 5);
const fundo2 = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5),
  new THREE.MeshBasicMaterial({ color: FUNDO, transparent: true, opacity: 0.7 }));
fundo2.position.z = -2;
const orbita2 = [];
for (let i = 0; i <= 120; i++) orbita2.push(new THREE.Vector3(0.8 * Math.cos(i / 120 * 2 * Math.PI), 0.8 * Math.sin(i / 120 * 2 * Math.PI), 0));
const sol2 = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshBasicMaterial({ color: 0xffc828 }));
const terra2 = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), new THREE.MeshBasicMaterial({ color: 0x468ce6 }));
const posicoesNos2 = new Float32Array(6);
const geometriaNos2 = new THREE.BufferGeometry();
geometriaNos2.setAttribute('position', new THREE.BufferAttribute(posicoesNos2, 3));
const linhaNos2 = new THREE.Line(geometriaNos2, new THREE.LineBasicMaterial({ color: 0xffcd50 }));
linhaNos2.frustumCulled = false;
cena2.add(fundo2, new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(orbita2), new THREE.LineBasicMaterial({ color: 0xbebecd })),
  sol2, terra2, linhaNos2);
const tituloQuadro = document.createElement('div');
tituloQuadro.className = 'rotulo r3d';
tituloQuadro.style.color = '#bcc7dc';
tituloQuadro.textContent = 'Visto de cima da eclíptica';
document.getElementById('rotulos3d').appendChild(tituloQuadro);

// ---- o que vai na coluna da esquerda: as longitudes e a temporada de eclipses ----
document.getElementById('blocoExtra').hidden = false;
document.getElementById('tituloExtra').textContent = 'Órbitas e eclipses';
const secExtra = document.getElementById('secExtra');
const linha = rotulo => {
  const d = document.createElement('div');
  d.className = 'par';
  const v = document.createElement('span');
  const r = document.createElement('span');
  r.textContent = rotulo;
  d.append(r, v);
  secExtra.appendChild(d);
  return v;
};
const vLonSol = linha('Longitude do Sol');
const vLonLua = linha('Longitude da Lua');
const vLonNo = linha('Nó ascendente');
const vFase = linha('Fase da Lua');
const vDistNo = linha('Sol, do nó mais próximo');
const vTemporada = document.createElement('div');
vTemporada.style.marginTop = '6px';
secExtra.appendChild(vTemporada);
let escritoEm = 0;

/** Quantos graus separam o Sol do no mais proximo, de 0 a 90. */
const distanciaAoNo = (lonSol, lonNo) => {
  const d = grau(lonSol - lonNo) % 180;
  return d > 90 ? 180 - d : d;
};

const v3 = new THREE.Vector3();

function desenhar() {
  const dias = (Date.now() - J2000) / 86_400_000;
  const lonSol = grau(280.460 + 0.9856474 * dias);
  const lonLua = grau(218.316 + 13.176396 * dias);
  const lonNo = grau(125.0445 - 0.0529538083 * dias);
  const no = rad(lonNo);
  const inclinacao = rad(INCLINACAO * (camadas.exagero ? 2 : 1));

  // o Sol corre pela ecliptica; a Lua, pelo plano dela
  sol.position.set(Math.cos(rad(lonSol)), 0, -Math.sin(rad(lonSol)));
  luz.position.copy(sol.position).multiplyScalar(5);
  pontoDaLua(rad(lonLua - lonNo), no, inclinacao, 1, lua.position);

  for (let i = 0; i <= PASSOS; i++) {
    pontoDaLua(i * 2 * Math.PI / PASSOS, no, inclinacao, 1, v3);
    posicoesPlano.set([v3.x, v3.y, v3.z], (i + 1) * 3);
    if (i < PASSOS) posicoesAro.set([v3.x, v3.y, v3.z], i * 3);
  }
  geometriaPlano.attributes.position.needsUpdate = true;
  geometriaAro.attributes.position.needsUpdate = true;

  const dx = Math.cos(no), dz = -Math.sin(no);
  posicoesNos.set([-1.22 * dx, 0, -1.22 * dz, 1.22 * dx, 0, 1.22 * dz]);
  geometriaNos.attributes.position.needsUpdate = true;
  noAscendente.position.set(dx, 0, dz);
  noDescendente.position.set(-dx, 0, -dz);

  planoEcliptica.visible = aroEcliptica.visible = camadas.ecliptica;
  planoDaLua.visible = aroDaLua.visible = camadas.planoDaLua;
  linhaDosNos.visible = noAscendente.visible = noDescendente.visible = camadas.nos;

  // ---- o desenho ----
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setPixelRatio(dpr);
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) renderer.setSize(w, h, false);

  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  renderer.clear();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  controle.aplicar(camera);
  renderer.render(cena, camera);

  // rotulos presos aos astros
  rTerra.pos.set(0, 0, 0);
  rSol.pos.copy(sol.position);
  rLua.pos.copy(lua.position);
  rNoAsc.pos.set(dx, 0, dz);
  rNoDesc.pos.set(-dx, 0, -dz);
  rLinha.pos.set(1.22 * dx, 0, 1.22 * dz);
  rotulos.itens.forEach(r => { r.visivel = camadas.rotulos; });
  rEcliptica.visivel = camadas.rotulos && camadas.ecliptica;
  rNoAsc.visivel = rNoDesc.visivel = rLinha.visivel = camadas.rotulos && camadas.nos;
  rotulos.atualizar(camera, w, h);

  // o quadro de canto fica ao lado da coluna da direita, para nao ficar por baixo dela
  tituloQuadro.style.display = camadas.visaoDeCima ? '' : 'none';
  if (camadas.visaoDeCima) {
    const lado = Math.round(Math.max(150, Math.min(300, Math.min(w, h) * 0.27)));
    const x = Math.round(w - larguraDaColunaDireita() - lado - 18), y = 18;
    const terraAngulo = rad(lonSol + 180); // a Terra fica no lado oposto ao que o Sol aparece no ceu
    terra2.position.set(0.8 * Math.cos(terraAngulo), 0.8 * Math.sin(terraAngulo), 0);
    const nx = Math.cos(no) * 0.5, ny = Math.sin(no) * 0.5;
    posicoesNos2.set([terra2.position.x - nx, terra2.position.y - ny, 0, terra2.position.x + nx, terra2.position.y + ny, 0]);
    geometriaNos2.attributes.position.needsUpdate = true;

    renderer.setScissorTest(true);
    renderer.setViewport(x, y, lado, lado);
    renderer.setScissor(x, y, lado, lado);
    renderer.clearDepth();
    renderer.render(cena2, camera2);
    renderer.setScissorTest(false);
    tituloQuadro.style.left = (x + lado / 2) + 'px';
    tituloQuadro.style.top = (h - y - lado - 12) + 'px';
  }

  // ---- as longitudes e a temporada, na coluna da esquerda, umas 4 vezes por segundo ----
  const agora = performance.now();
  if (agora - escritoEm > 250) {
    escritoEm = agora;
    const fase = (((lonLua - lonSol) / 360) % 1 + 1) % 1;
    const distancia = distanciaAoNo(lonSol, lonNo);
    const temporada = distancia <= LIMITE_DA_TEMPORADA;
    vLonSol.textContent = `${fmt(lonSol)}°`;
    vLonLua.textContent = `${fmt(lonLua)}°`;
    vLonNo.textContent = `${fmt(lonNo)}°`;
    vFase.textContent = `${NOMES_FASE[Math.round(fase * 8) % 8]}, ${fmt((1 - Math.cos(fase * 2 * Math.PI)) / 2 * 100, 0)}%`;
    vDistNo.textContent = `${fmt(distancia)}°`;
    vTemporada.className = 'nota' + (temporada ? ' alerta' : '');
    vTemporada.textContent = temporada
      ? 'Temporada de eclipses: a lua nova ou cheia daqui pode cair em cima de um nó.'
      : 'Fora de temporada: nesta lunação a Lua passa longe da eclíptica na nova e na cheia.';
  }

  requestAnimationFrame(desenhar);
}
desenhar();
