import * as THREE from 'three';

export const AZUL = 0x0000ff;
export const VERDE = 0x008000;
export const VERMELHO = 0xff0000;
export const PRETO = 0x000000;

/** Texto como sprite. setTexto redesenha, para os textos que mudam. */
export class Rotulo extends THREE.Sprite {
  constructor(texto, altura = 0.075, cor = '#000', negrito = false) {
    super(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    this.altura = altura;
    this.cor = cor;
    this.negrito = negrito;
    this.setTexto(texto);
  }

  setTexto(texto) {
    if (texto === this.texto) return;
    this.texto = texto;
    const px = 64;
    const fonte = `${this.negrito ? 'bold ' : ''}${px}px sans-serif`;
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    g.font = fonte;
    const largura = Math.ceil(g.measureText(texto).width) + 8;
    c.width = largura;
    c.height = Math.ceil(px * 1.3);
    g.font = fonte;
    g.fillStyle = this.cor;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(texto, largura / 2, c.height / 2);
    if (this.material.map) this.material.map.dispose();
    this.material.map = new THREE.CanvasTexture(c);
    this.material.map.colorSpace = THREE.SRGBColorSpace;
    this.material.needsUpdate = true;
    this.scale.set(this.altura * c.width / c.height * 1.3, this.altura * 1.3, 1);
  }
}

export function linha(pontos, cor = PRETO) {
  const g = new THREE.BufferGeometry().setFromPoints(pontos.map(p => new THREE.Vector3(p[0], p[1], 0)));
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color: cor }));
}

/** Traco grosso: um retangulo entre dois pontos. */
export function traco(x1, y1, x2, y2, espessura, cor = PRETO) {
  const dx = x2 - x1, dy = y2 - y1;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(dx, dy), espessura),
    new THREE.MeshBasicMaterial({ color: cor }));
  m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0);
  m.rotation.z = Math.atan2(dy, dx);
  return m;
}

export function disco(raio, cor, x = 0, y = 0) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(raio, 48), new THREE.MeshBasicMaterial({ color: cor }));
  m.position.set(x, y, 0);
  return m;
}

export function aro(raio, espessura, cor = PRETO, inicio = 0, tamanho = Math.PI * 2, x = 0, y = 0) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(raio - espessura / 2, raio + espessura / 2, 96, 1, inicio, tamanho),
    new THREE.MeshBasicMaterial({ color: cor }));
  m.position.set(x, y, 0);
  return m;
}

/** Painel: uma cena com camera ortografica de altura fixa, desenhada numa fatia da tela. */
export class Painel {
  constructor(altura) {
    this.altura = altura;
    this.cena = new THREE.Scene();
    this.cena.background = new THREE.Color(0xffffff);
    this.camera = new THREE.OrthographicCamera(-1, 1, altura / 2, -altura / 2, -10, 10);
  }

  desenhar(renderer, x, y, w, h) {
    const aspecto = w / h;
    this.camera.left = -this.altura * aspecto / 2;
    this.camera.right = this.altura * aspecto / 2;
    this.camera.updateProjectionMatrix();
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.render(this.cena, this.camera);
  }

  atualizar() {}
}
