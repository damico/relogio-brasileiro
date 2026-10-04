import * as THREE from 'three';
import { RelogioNorteOcidental, RelogioNorteOcidentalGlobal, RelogioEstacoes } from './relogios.js';
import { OrbitaTerraSol } from './orbita.js';

const canvas = document.getElementById('tela');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setScissorTest(true);
renderer.setClearColor(0xffffff);

const relogios = [new RelogioNorteOcidental(), new RelogioNorteOcidentalGlobal(), new RelogioEstacoes()];
const orbita = new OrbitaTerraSol();
orbita.carregarFase();
setInterval(() => orbita.carregarFase(), 60_000);

/** Mesma divisao do desktop: tres relogios em cima, a orbita embaixo. */
function desenhar() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) renderer.setSize(w, h, false);

  const agora = new Date();
  const metade = Math.floor(h / 2), terco = Math.floor(w / 3);
  relogios.forEach((r, i) => {
    r.atualizar(agora);
    r.desenhar(renderer, i * terco, h - metade, i === 2 ? w - 2 * terco : terco, metade);
  });
  orbita.atualizar(agora);
  orbita.desenhar(renderer, 0, 0, w, h - metade);
  requestAnimationFrame(desenhar);
}
desenhar();
