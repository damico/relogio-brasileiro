import * as THREE from 'three';
import { RelogioNorteOcidental, RelogioSulOcidental, RelogioNorteOcidentalGlobal, RelogioEstacoes } from './relogios.js';
import { OrbitaTerraSol } from './orbita.js';
import { Satelites } from './satelites.js';
import { iniciarColunaEsquerda } from './colunaEsquerda.js';
import { larguraDaColunaEsquerda } from './util3d.js';

const canvas = document.getElementById('tela');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setScissorTest(true);
renderer.setClearColor(0x0b0f1a);

// o do Hemisferio Sul vem logo depois do comum, para dar para comparar os dois sentidos lado a lado
// em cima, os tres relogios: o comum, o do Hemisferio Sul (logo depois dele, para dar para comparar os dois sentidos) e o em graus
const relogios = [new RelogioNorteOcidental(), new RelogioSulOcidental(), new RelogioNorteOcidentalGlobal()];
// embaixo, o relogio do ano fica a esquerda da orbita; ele e desenhado por cima do painel dela, entao nao tem fundo proprio
const relogioDoAno = new RelogioEstacoes();
relogioDoAno.cena.background = null;
renderer.autoClear = false; // quem limpa a tela e o comeco de cada quadro, para um painel nao apagar o outro
const orbita = new OrbitaTerraSol();

// ---- configuracao: quais paineis aparecem (os quatro relogios e a orbita), lembrado entre visitas ----
const ativos = [true, true, true, true, true];
try {
  const guardado = JSON.parse(localStorage.getItem('paineisAtivos') || 'null');
  if (Array.isArray(guardado) && guardado.length === 5) guardado.forEach((v, i) => { ativos[i] = !!v; });
} catch (e) { /* sem armazenamento: comeca com tudo ligado */ }

document.querySelectorAll('input[data-painel]').forEach(caixa => {
  const i = +caixa.dataset.painel;
  caixa.checked = ativos[i];
  caixa.addEventListener('change', () => {
    ativos[i] = caixa.checked;
    try { localStorage.setItem('paineisAtivos', JSON.stringify(ativos)); } catch (e) { /* so nao lembra */ }
  });
});

// ---- a coluna de tempo e espaco, que o relogio divide com as outras telas ----
const sats = new Satelites();
sats.iniciar();
iniciarColunaEsquerda({ sats });

/**
 * Em cima, os relogios ligados lado a lado; embaixo, a orbita da Terra com o
 * relogio do ano a esquerda dela, no espaco entre a coluna de tempo e espaco e
 * o desenho da orbita. Sem os relogios, o de baixo ocupa a tela toda.
 */
function desenhar() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) renderer.setSize(w, h, false);

  renderer.setViewport(0, 0, w, h);
  renderer.setScissor(0, 0, w, h);
  renderer.clear();

  const agora = new Date();
  const ligados = relogios.map((_, i) => i).filter(i => ativos[i]);
  const linhaDeBaixo = ativos[3] || ativos[4];

  const alturaRelogios = !ligados.length ? 0 : linhaDeBaixo ? Math.floor(h / 2) : h;
  const largura = ligados.length ? Math.floor(w / ligados.length) : 0;
  ligados.forEach((i, posicao) => {
    relogios[i].atualizar(agora);
    const ultimo = posicao === ligados.length - 1;
    relogios[i].desenhar(renderer, posicao * largura, h - alturaRelogios, ultimo ? w - posicao * largura : largura, alturaRelogios);
  });

  if (linhaDeBaixo) {
    const alturaBaixo = h - alturaRelogios;
    if (ativos[4]) {
      orbita.atualizar(agora);
      orbita.desenhar(renderer, 0, 0, w, alturaBaixo);
    }
    if (ativos[3]) {
      relogioDoAno.atualizar(agora);

      // com a orbita ligada, o relogio fica no vao entre a coluna da esquerda e o comeco do desenho dela
      // (o painel da orbita tem 2,9 de altura no mundo, e seu rotulo mais a esquerda fica em x = -1,8)
      let lado = Math.floor(alturaBaixo * 0.88);
      let centro = w / 2;
      if (ativos[4]) {
        const comecoDaOrbita = w / 2 - 1.8 * (alturaBaixo / 2.9);
        const comecoLivre = larguraDaColunaEsquerda() * dpr;
        centro = (comecoLivre + comecoDaOrbita) / 2;
        // o relogio, com os arcos das estacoes, ocupa cerca de 0,73 do lado do quadrado em que e desenhado
        lado = Math.max(120 * dpr, Math.min(lado, (comecoDaOrbita - comecoLivre) * 1.25));
      }
      relogioDoAno.desenhar(renderer, Math.round(centro - lado / 2), Math.round((alturaBaixo - lado) / 2), Math.round(lado), Math.round(lado));
    }
  }
  requestAnimationFrame(desenhar);
}
desenhar();
