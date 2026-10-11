import * as THREE from 'three';
import { Satelites } from './satelites.js';
import { iniciarColunaEsquerda } from './colunaEsquerda.js';
import { ControleOrbital, Rotulos, FUNDO, rad, brilho } from './util3d.js';

// Por que existem as estacoes: a Terra dando a volta no Sol com o eixo sempre
// inclinado para o mesmo lado do espaco. Nas quatro posicoes marcadas estao os
// solsticios e os equinocios. No solsticio de junho o eixo aponta o hemisferio
// norte para o Sol, e no de dezembro, o sul: e isso, e nao a distancia ate o Sol,
// que troca as estacoes. Nos equinocios o eixo fica de lado e os dois hemisferios
// recebem a mesma luz. Em amarelo as estacoes que comecam no hemisferio norte, em
// branco as do sul, como nos diagramas de livro.
//
// Sistema: y para cima, a orbita no plano xz, e o solsticio de dezembro cai a
// direita do Sol (+x), que e o lado para onde o eixo aponta.

const J2000 = Date.UTC(2000, 0, 1, 12);
const INCLINACAO_DO_EIXO = 23.44;
const MS_DIA = 86_400_000;

const MARCOS = [
  { quando: '20 de março', mes: 3, dia: 20, noNorte: 'Primavera', noSul: 'Outono', acima: true },
  { quando: '20/21 de junho', mes: 6, dia: 21, noNorte: 'Verão', noSul: 'Inverno', acima: true },
  { quando: '22/23 de setembro', mes: 9, dia: 22, noNorte: 'Outono', noSul: 'Primavera', acima: false },
  { quando: '21/22 de dezembro', mes: 12, dia: 21, noNorte: 'Inverno', noSul: 'Verão', acima: true },
];

const grau = a => ((a % 360) + 360) % 360;

/** Onde a Terra esta na orbita, como angulo no plano xz. */
function anguloNaOrbita(ms) {
  const dias = (ms - J2000) / MS_DIA;
  const longitudeDoSol = grau(280.460 + 0.9856474 * dias);
  return rad(longitudeDoSol + 180 - 90);
}
const noPlano = (angulo, r = 1, alvo = new THREE.Vector3()) => alvo.set(r * Math.cos(angulo), 0, -r * Math.sin(angulo));

const canvas = document.getElementById('tela');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(FUNDO);

// so tempo real: a cena anda com o relogio de verdade
const sats = new Satelites();
sats.iniciar();
iniciarColunaEsquerda({ sats });

const camadas = { setas: true, eixos: true, rotulos: true, hoje: true };
document.querySelectorAll('[data-camada]').forEach(caixa => {
  caixa.addEventListener('change', () => { camadas[caixa.dataset.camada] = caixa.checked; });
});

const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
const controle = new ControleOrbital(canvas, { az: 0, el: 30, d: 3.6, min: 1.6, max: 9 });
document.getElementById('reiniciarCamera').addEventListener('click', () => controle.reiniciar());
const rotulos = new Rotulos(document.getElementById('rotulos3d'));

// o Sol no centro, que tambem e a luz da cena
const sol = new THREE.Group();
sol.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 24), new THREE.MeshBasicMaterial({ color: 0xfff5aa })), brilho(0xfff0a0, 1.7));
cena.add(sol);
cena.add(new THREE.PointLight(0xffffff, 4, 0, 0)); // sem queda com a distancia: a metade virada para o Sol acende inteira
// a metade de noite nao fica preta: com a luz de fundo ainda da para ver os continentes dela
cena.add(new THREE.AmbientLight(0x56688f, 2.4));

// a orbita, em vermelho, com setas no sentido anti-horario visto de cima
const orbita = new THREE.Mesh(new THREE.TorusGeometry(1, 0.007, 8, 220), new THREE.MeshBasicMaterial({ color: 0xe12d2d }));
orbita.rotation.x = Math.PI / 2;
cena.add(orbita);
const setas = new THREE.Group();
for (let i = 0; i < 4; i++) {
  const a = Math.PI / 4 + i * Math.PI / 2;
  const seta = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 14), new THREE.MeshBasicMaterial({ color: 0xe12d2d }));
  seta.position.copy(noPlano(a));
  seta.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)));
  setas.add(seta);
}
cena.add(setas);

const textura = new THREE.TextureLoader().load('/img/terra.jpg');
textura.colorSpace = THREE.SRGBColorSpace;

/**
 * Uma Terra com o eixo inclinado 23,44 graus, sempre para o mesmo lado (+x), e a
 * metade virada para o Sol iluminada pela propria luz da cena. Gira em torno do
 * eixo para mostrar as Americas de frente para o Sol, so para o desenho ficar
 * reconhecivel.
 */
function criarTerra(raio) {
  const grupo = new THREE.Group();
  const inclinada = new THREE.Group();
  inclinada.rotation.z = -rad(INCLINACAO_DO_EIXO);
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(raio, 48, 32), new THREE.MeshStandardMaterial({ map: textura, roughness: 1 }));
  inclinada.add(esfera);

  const eixo = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -(raio + 0.045), 0), new THREE.Vector3(0, raio + 0.075, 0)]),
    new THREE.LineBasicMaterial({ color: 0xd782ff }));
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(raio * 0.16, raio * 0.4, 12), new THREE.MeshBasicMaterial({ color: 0xd782ff }));
  ponta.position.set(0, raio + 0.085, 0);
  inclinada.add(eixo, ponta);
  grupo.add(inclinada);
  return { grupo, esfera, eixo: [eixo, ponta] };
}

/** Gira a Terra em torno do eixo para que o meridiano de longitude -60 fique de frente para o Sol. */
function virarParaOSol(terra, posicao) {
  const psi = Math.atan2(posicao.z, -posicao.x); // direcao do Sol vista da Terra: (-x, -z) -> (cos psi, -sin psi)
  terra.esfera.rotation.y = psi + rad(60);
}

const terrasDosMarcos = MARCOS.map(() => {
  const t = criarTerra(0.065);
  cena.add(t.grupo);
  return t;
});
const terraDeHoje = criarTerra(0.032);
cena.add(terraDeHoje.grupo);

// o anel que marca a Terra de hoje
const anelCanvas = document.createElement('canvas');
anelCanvas.width = anelCanvas.height = 64;
const ag = anelCanvas.getContext('2d');
ag.strokeStyle = '#ffcd50'; ag.lineWidth = 5;
ag.beginPath(); ag.arc(32, 32, 26, 0, Math.PI * 2); ag.stroke();
const anel = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(anelCanvas), transparent: true, depthTest: false }));
anel.scale.setScalar(0.18);
cena.add(anel);

// rotulos: a data, a estacao no norte e a estacao no sul, empilhados
const rotulosDosMarcos = MARCOS.map(m => {
  // as tres linhas ficam uma sobre a outra, de 18 em 18 pixels: acima da Terra, ou abaixo dela na que esta mais perto de quem olha
  const base = m.acima ? -58 : 34;
  const data = rotulos.criar(m.quando, '#78e1ff'); data.dy = base;
  const norte = rotulos.criar(m.noNorte, '#ffe146'); norte.dy = base + 18;
  const sul = rotulos.criar(m.noSul, '#ffffff'); sul.dy = base + 36;
  return [data, norte, sul];
});
const rHoje = rotulos.criar('hoje', '#ffcd50'); rHoje.dy = 30;

// ---- o que vai na coluna da esquerda: em que estacao estamos e quando vira ----
document.getElementById('blocoExtra').hidden = false;
document.getElementById('tituloExtra').textContent = 'Estações';
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
const vAgora = linha('Agora');
const vComecou = linha('Começou em');
const vProxima = linha('Próxima virada');
const vDias = linha('Faltam');
const nota = document.createElement('div');
nota.className = 'nota';
nota.style.marginTop = '6px';
nota.textContent = 'A distância até o Sol quase não muda: o que vira as estações é a inclinação do eixo.';
secExtra.appendChild(nota);
let escritoEm = 0;

const dataDoMarco = (m, ano) => new Date(ano, m.mes - 1, m.dia);

function situacao(ms) {
  const d = new Date(ms);
  const hoje = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // antes de 20 de marco ainda e o solsticio de dezembro do ano anterior que vale
  let indice = 3;
  MARCOS.forEach((m, i) => { if (hoje >= dataDoMarco(m, hoje.getFullYear())) indice = i; });
  const proximo = (indice + 1) % 4;
  let virada = dataDoMarco(MARCOS[proximo], hoje.getFullYear());
  if (virada <= hoje) virada = dataDoMarco(MARCOS[proximo], hoje.getFullYear() + 1);
  return { atual: MARCOS[indice], proximo: MARCOS[proximo], dias: Math.round((virada - hoje) / MS_DIA) };
}

const v3 = new THREE.Vector3();

function desenhar() {
  const ms = Date.now();
  const ano = new Date(ms).getFullYear();

  MARCOS.forEach((m, i) => {
    const posicao = noPlano(anguloNaOrbita(dataDoMarco(m, ano).getTime()), 1, v3);
    terrasDosMarcos[i].grupo.position.copy(posicao);
    virarParaOSol(terrasDosMarcos[i], posicao);
    terrasDosMarcos[i].eixo.forEach(o => { o.visible = camadas.eixos; });
    const [data, norte, sul] = rotulosDosMarcos[i];
    [data, norte, sul].forEach(r => { r.pos.copy(posicao); r.visivel = camadas.rotulos; });
  });

  const hoje = noPlano(anguloNaOrbita(ms), 1, v3);
  terraDeHoje.grupo.position.copy(hoje);
  virarParaOSol(terraDeHoje, hoje);
  terraDeHoje.grupo.visible = anel.visible = camadas.hoje;
  terraDeHoje.eixo.forEach(o => { o.visible = camadas.eixos; });
  anel.position.copy(hoje);
  rHoje.pos.copy(hoje);
  rHoje.visivel = camadas.hoje && camadas.rotulos;
  setas.visible = camadas.setas;

  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setPixelRatio(dpr);
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  controle.aplicar(camera);
  renderer.render(cena, camera);
  rotulos.atualizar(camera, w, h);

  const agora = performance.now();
  if (agora - escritoEm > 250) {
    escritoEm = agora;
    const s = situacao(ms);
    vAgora.textContent = `${s.atual.noSul} no Sul, ${s.atual.noNorte} no Norte`;
    vComecou.textContent = s.atual.quando;
    vProxima.textContent = s.proximo.quando;
    vDias.textContent = `${s.dias} dias`;
  }
  requestAnimationFrame(desenhar);
}
desenhar();
