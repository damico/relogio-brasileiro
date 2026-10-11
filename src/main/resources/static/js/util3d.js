import * as THREE from 'three';

// O que as telas de orbitas em 3D (F2 e F3) compartilham.

export const FUNDO = 0x0b0f1a;
export const rad = THREE.MathUtils.degToRad;

/** Camera que gira em volta de um ponto: arrastar gira e a roda aproxima. */
export class ControleOrbital {
  constructor(canvas, { az = 0, el = 25, d = 3, min = 1.2, max = 9 } = {}) {
    this.inicio = { az: rad(az), el: rad(el), d };
    this.az = rad(az); this.el = rad(el); this.d = d;
    this.min = min; this.max = max;

    let arrasto = null;
    canvas.addEventListener('pointerdown', e => { arrasto = e; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
    canvas.addEventListener('pointerup', () => { arrasto = null; canvas.style.cursor = 'grab'; });
    canvas.addEventListener('pointermove', e => {
      if (!arrasto) return;
      this.az -= (e.clientX - arrasto.clientX) * 0.008;
      this.el = Math.max(rad(-85), Math.min(rad(85), this.el + (e.clientY - arrasto.clientY) * 0.008));
      arrasto = e;
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.d = Math.max(this.min, Math.min(this.max, this.d * Math.exp(e.deltaY * 0.001)));
    }, { passive: false });
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';
  }

  reiniciar() {
    this.az = this.inicio.az; this.el = this.inicio.el; this.d = this.inicio.d;
  }

  aplicar(camera, alvo = new THREE.Vector3()) {
    camera.position.set(
      alvo.x + this.d * Math.cos(this.el) * Math.sin(this.az),
      alvo.y + this.d * Math.sin(this.el),
      alvo.z + this.d * Math.cos(this.el) * Math.cos(this.az));
    camera.lookAt(alvo);
    camera.updateMatrixWorld();
  }
}

/** Rotulos de texto em HTML, presos a pontos do espaco 3D e projetados a cada quadro. */
export class Rotulos {
  constructor(container) {
    this.container = container;
    this.itens = [];
  }

  criar(texto, cor = '#e8edf8', { forte = false } = {}) {
    const el = document.createElement('div');
    el.className = 'rotulo r3d';
    el.textContent = texto;
    el.style.color = cor;
    if (forte) { el.style.fontWeight = 'bold'; el.style.fontSize = '14px'; }
    this.container.appendChild(el);
    const item = { el, pos: new THREE.Vector3(), dx: 0, dy: 0, visivel: true };
    this.itens.push(item);
    return item;
  }

  /** @param camera a camera com que o desenho foi feito; w e h em pixels do canvas */
  atualizar(camera, w, h) {
    for (const it of this.itens) {
      const vista = it.pos.clone().applyMatrix4(camera.matrixWorldInverse);
      if (!it.visivel || vista.z >= 0) { it.el.style.display = 'none'; continue; }
      const p = it.pos.clone().project(camera);
      it.el.style.display = '';
      it.el.style.left = ((p.x + 1) / 2 * w + it.dx) + 'px';
      it.el.style.top = ((1 - p.y) / 2 * h + it.dy) + 'px';
    }
  }

  esconder() {
    this.itens.forEach(it => { it.el.style.display = 'none'; });
  }
}

/** Um disco de luz que aparece em volta de uma estrela, somando com o fundo. */
export function brilho(cor, tamanho) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), color: cor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(tamanho);
  return s;
}

/** Largura da coluna de tempo e espaco, ou zero se ela esta recolhida: o que fica a esquerda do desenho usa o espaco que sobra. */
export function larguraDaColunaEsquerda() {
  if (document.body.classList.contains('sem-esquerda')) return 0;
  const col = document.getElementById('colunaEsquerda');
  return col ? col.getBoundingClientRect().width : 0;
}

/** Largura da coluna de configuracoes, para o que fica no canto de baixo nao ficar por baixo dela. */
export function larguraDaColunaDireita() {
  if (document.body.classList.contains('sem-direita')) return 0;
  const col = document.getElementById('colunaDireita');
  return col ? col.getBoundingClientRect().width : 0;
}
