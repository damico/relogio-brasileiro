import * as THREE from 'three';
import { GLSL_HORIZONTE, dir } from './esfera.js';
import { COR_PLANETA, planetaVisivel } from './planetas.js';

// Observador em primeira pessoa: voce em pe no centro da abobada, olhando em
// volta. O ceu e visto por dentro, o chao fica sob os pes e o horizonte e a
// linha onde os dois se encontram. Arrastar vira a cabeca, a roda do mouse
// muda o campo de visao (zoom). Mesmo sistema da esfera: y para cima, norte em
// -z, leste em +x, azimute contado do norte para o leste.

const rad = THREE.MathUtils.degToRad;
const deg = THREE.MathUtils.radToDeg;
const R = 40; // raio da abobada, em unidades de mundo
const VENTOS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const srgb = (r, g, b) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);

const OPCOES = [
  ['linhas', 'Constelações'],
  ['planetas', 'Planetas'],
  ['satelites', 'Satélites'],
  ['nomes', 'Nomes das estrelas'],
  ['cardeais', 'Pontos cardeais e escala do horizonte'],
  ['grade', 'Grade de alturas e azimutes'],
];

export class Observador {
  constructor(contenedor, painel, hud) {
    this.contenedor = contenedor;
    this.painel = painel;
    this.hud = hud;
    this.cena = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
    this.padrao = { az: 0, alt: 25, fov: 70 };
    this.visao = { ...this.padrao };
    this.opcoes = { linhas: true, planetas: true, satelites: true, nomes: true, cardeais: true, grade: false };
    this.planetas = new Map();
    this.satelites = null;   // o objeto Satelites, posto de fora
    this.versaoSat = -1;
    this.marcasSat = [];
    this.grupoSat = new THREE.Group();
    this.cena.add(this.grupoSat);
    this.limiteMagnitude = 6.0;
    this.catalogo = null;
    this.nomes = [];
    this.agora = null;
    this.rotulos = [];
    this.uniformes = { tsl: { value: 0 }, lat: { value: 0 } };

    this.montarCeuEChao();
    this.montarEscala();
    this.montarAstros();
    this.montarPainel();
  }

  // ---- o ceu e o chao: uma esfera vista por dentro, pintada por um shader ----
  montarCeuEChao() {
    this.sky = {
      claridade: { value: 0 }, crepusculo: { value: 0 }, sol: { value: new THREE.Vector3(0, -1, 0) },
      zenNoite: { value: srgb(3, 5, 16) }, horNoite: { value: srgb(16, 22, 48) },
      zenDia: { value: srgb(48, 108, 205) }, horDia: { value: srgb(160, 198, 236) },
      chaoNoite: { value: srgb(9, 11, 9) }, chaoDia: { value: srgb(78, 118, 62) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.sky, side: THREE.BackSide, depthWrite: false, depthTest: false,
      vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float claridade, crepusculo; uniform vec3 sol;
        uniform vec3 zenNoite, horNoite, zenDia, horDia, chaoNoite, chaoDia;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 c;
          if (h >= 0.0) {
            // ceu: mais claro junto ao horizonte, e com o brilho do crepusculo do lado do Sol
            vec3 zen = mix(zenNoite, zenDia, claridade), hor = mix(horNoite, horDia, claridade);
            c = mix(zen, hor, pow(1.0 - h, 3.0));
            float perto = pow(max(dot(d, normalize(vec3(sol.x, 0.0, sol.z) + 1e-5)), 0.0), 3.0);
            c += vec3(1.0, 0.42, 0.14) * crepusculo * perto * pow(1.0 - h, 2.0) * 0.85;
          } else {
            // chao: uma quadricula que some na distancia, para dar a noção de espaco
            vec3 chao = mix(chaoNoite, chaoDia, claridade);
            vec2 g = d.xz / (-h) * 0.5;
            vec2 f = abs(fract(g - 0.5) - 0.5) / max(fwidth(g), vec2(1e-4));
            float linha = 1.0 - min(min(f.x, f.y), 1.0);
            float perto = smoothstep(-0.015, -0.12, h);
            c = chao * (0.75 + 0.25 * smoothstep(-0.5, 0.0, h)) + chao * 0.9 * linha * perto;
            c = mix(c, mix(horNoite, horDia, claridade) * 0.5, smoothstep(-0.08, 0.0, h) * 0.6);
          }
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const esfera = new THREE.Mesh(new THREE.SphereGeometry(R * 1.2, 64, 48), material);
    esfera.renderOrder = -10;
    this.cena.add(esfera);
  }

  // ---- escala do horizonte, grade e rotulos fixos ----
  montarEscala() {
    this.escala = new THREE.Group();
    const pts = [];
    for (let az = 0; az < 360; az += 5) {
      const len = az % 45 === 0 ? 3.2 : az % 15 === 0 ? 2 : 1;
      pts.push(dir(0, rad(az), R * 0.95), dir(rad(len), rad(az), R * 0.95));
    }
    const anel = [];
    for (let az = 0; az <= 360; az += 2) anel.push(dir(0, rad(az), R * 0.95));
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthTest: false });
    this.escala.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), material),
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(anel), material));
    this.escala.renderOrder = 8;
    this.cena.add(this.escala);

    this.grade = new THREE.Group();
    const m = new THREE.LineBasicMaterial({ color: 0xaac0e8, transparent: true, opacity: 0.22, depthTest: false });
    for (const alt of [15, 30, 45, 60, 75]) {
      const p = [];
      for (let az = 0; az <= 360; az += 3) p.push(dir(rad(alt), rad(az), R * 0.95));
      this.grade.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), m));
    }
    for (let az = 0; az < 360; az += 30) {
      const p = [];
      for (let alt = 0; alt <= 90; alt += 3) p.push(dir(rad(alt), rad(az), R * 0.95));
      this.grade.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), m));
    }
    this.grade.renderOrder = 7;
    this.cena.add(this.grade);

    VENTOS.forEach((nome, i) => this.rotulo('cardeais', nome, dir(rad(4.5), rad(i * 45), R * 0.95),
      i % 2 === 0 ? '#ffffff' : '#c9d4ea', i % 2 === 0));
    for (const az of [30, 60, 120, 150, 210, 240, 300, 330]) {
      this.rotulo('cardeais', az + '°', dir(rad(3.4), rad(az), R * 0.95), '#9aa6c0');
    }
    this.rotulo('grade', 'zênite', dir(rad(89), 0, R * 0.95), '#c9d4ea');
    for (const alt of [30, 60]) this.rotulo('grade', alt + '°', dir(rad(alt), rad(8), R * 0.95), '#9aa6c0');
  }

  rotulo(grupo, texto, posicao, cor, forte = false) {
    const el = document.createElement('div');
    el.className = 'rotulo r3d';
    el.textContent = texto;
    el.style.color = cor;
    if (forte) { el.style.fontWeight = 'bold'; el.style.fontSize = '15px'; }
    this.contenedor.appendChild(el);
    const r = { el, grupo, posicao };
    this.rotulos.push(r);
    return r;
  }

  // ---- Sol e Lua ----
  montarAstros() {
    this.sol = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff1b0, depthTest: false }));
    this.sol.scale.setScalar(R * 0.9 * Math.tan(rad(1.7))); // com o tamanho aparente exagerado: o real e 0,5 grau
    this.sol.renderOrder = 12;

    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,240,180,0.95)');
    grad.addColorStop(0.25, 'rgba(255,200,90,0.35)');
    grad.addColorStop(1, 'rgba(255,170,60,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    this.brilhoSol = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, blending: THREE.AdditiveBlending, depthTest: false }));
    this.brilhoSol.scale.setScalar(R * 0.9 * Math.tan(rad(9)));
    this.brilhoSol.renderOrder = 11;

    this.lua = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshStandardMaterial({ color: 0xf4f4e8, roughness: 1, depthTest: false }));
    this.lua.scale.setScalar(R * 0.9 * Math.tan(rad(1.7)));
    this.lua.renderOrder = 12;
    this.luz = new THREE.DirectionalLight(0xffffff, 3);
    this.cena.add(this.sol, this.brilhoSol, this.lua, this.luz, new THREE.AmbientLight(0x464655, 1.4));
    this.rSol = this.rotulo('astros', 'Sol', new THREE.Vector3(), '#ffe066', true);
    this.rLua = this.rotulo('astros', 'Lua', new THREE.Vector3(), '#ffffff', true);
  }

  /** Um disco de luz com a cor do planeta, criado na primeira vez que ele aparece. */
  planeta(nome) {
    if (!this.planetas.has(nome)) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c), color: new THREE.Color(COR_PLANETA[nome]), transparent: true, depthTest: false }));
      sprite.renderOrder = 9;
      this.cena.add(sprite);
      this.planetas.set(nome, { sprite, r: this.rotulo('planetas', nome, new THREE.Vector3(), COR_PLANETA[nome], true), visivel: false });
    }
    return this.planetas.get(nome);
  }

  /**
   * Os satelites no ceu do observador: o arco da passagem, so acima do
   * horizonte, e um ponto de luz onde ele esta agora, que anda a cada quadro.
   * Na sombra da Terra ele nao reflete luz, e o ponto fica quase apagado.
   */
  atualizarSatelites(w, h) {
    const sats = this.satelites;
    if (!sats) return;

    if (this.versaoSat !== sats.versao) {
      this.versaoSat = sats.versao;
      for (const l of [...this.grupoSat.children]) { this.grupoSat.remove(l); l.geometry?.dispose(); l.material?.dispose(); }
      this.marcasSat.forEach(m => { this.cena.remove(m.sprite); m.sprite.material.map.dispose(); m.sprite.material.dispose(); m.r.el.remove(); });
      this.marcasSat = [];
      for (const sat of sats.lista) {
        const cor = new THREE.Color(sat.cor);
        let atual = [];
        const fechar = () => {
          if (atual.length > 1) {
            const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(atual),
              new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: 0.9, depthTest: false }));
            l.renderOrder = 9;
            this.grupoSat.add(l);
          }
          atual = [];
        };
        for (const a of sat.amostras) {
          if (a[7] != null && a[7] > 0) atual.push(dir(rad(a[7]), rad(a[6]), R * 0.9)); else fechar();
        }
        fechar();

        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.4, 'rgba(255,255,255,0.85)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: cor, transparent: true, depthTest: false }));
        sprite.scale.setScalar(R * 0.9 * Math.tan(rad(1.6)));
        sprite.renderOrder = 10;
        this.cena.add(sprite);
        const el = document.createElement('div');
        el.className = 'rotulo r3d';
        el.style.color = sat.cor;
        el.style.fontWeight = 'bold';
        this.contenedor.appendChild(el);
        this.marcasSat.push({ sat, sprite, r: { el, posicao: new THREE.Vector3() } });
      }
    }

    this.grupoSat.visible = this.opcoes.satelites;
    for (const m of this.marcasSat) {
      const p = sats.posicao(m.sat);
      const ok = this.opcoes.satelites && p && p.elevacao != null && p.elevacao > 0;
      m.sprite.visible = !!ok;
      if (!ok) { m.r.el.style.display = 'none'; continue; }
      const pos = dir(rad(p.elevacao), rad(p.azimute), R * 0.9);
      m.sprite.position.copy(pos);
      m.sprite.material.opacity = p.iluminado ? 1 : 0.25;
      m.r.posicao = pos.clone().add(new THREE.Vector3(0, R * 0.04, 0));
      m.r.el.textContent = `${m.sat.nome} ${p.elevacao >= 0 ? '+' : '\u2212'}${Math.abs(Math.round(p.elevacao))}° - ${p.velocidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km/s`
        + (p.iluminado ? '' : ' (na sombra)');
      m.r.el.style.display = this.projetar(m.r, w, h) ? '' : 'none';
    }
  }

  // ---- painel: opcoes, alcance da vista e atalhos para olhar ----
  montarPainel() {
    const p = this.painel;
    for (const [chave, nome] of OPCOES) {
      const l = document.createElement('label');
      const c = document.createElement('input');
      c.type = 'checkbox';
      c.checked = this.opcoes[chave];
      c.addEventListener('change', () => { this.opcoes[chave] = c.checked; });
      l.append(c, ' ' + nome);
      p.appendChild(l);
    }

    const alcance = document.createElement('label');
    const valor = document.createElement('b');
    valor.textContent = this.limiteMagnitude.toFixed(1);
    const faixa = document.createElement('input');
    faixa.type = 'range'; faixa.min = 1; faixa.max = 6.5; faixa.step = 0.1; faixa.value = this.limiteMagnitude;
    faixa.style.cssText = 'width:100%;display:block';
    faixa.addEventListener('input', () => { this.limiteMagnitude = +faixa.value; valor.textContent = faixa.value; });
    alcance.title = 'A estrela mais fraca que a sua vista alcanca. 6 e um ceu escuro e limpo, 4 e o ceu de uma cidade';
    alcance.append('Alcance da vista: magnitude ', valor, faixa);
    p.appendChild(alcance);

    const titulo = document.createElement('div');
    titulo.textContent = 'Olhar para';
    titulo.style.cssText = 'margin-top:6px;color:#9696a5';
    p.appendChild(titulo);
    const botoes = document.createElement('div');
    botoes.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:2px';
    const atalhos = [
      ['Norte', () => ({ az: 0, alt: 15 })], ['Leste', () => ({ az: 90, alt: 15 })],
      ['Sul', () => ({ az: 180, alt: 15 })], ['Oeste', () => ({ az: 270, alt: 15 })],
      ['Zênite', () => ({ az: this.visao.az, alt: 89 })],
      ['Sol', () => this.agora && ({ az: this.agora.sol.azimute, alt: Math.max(this.agora.sol.altura, 0) })],
      ['Lua', () => this.agora && ({ az: this.agora.lua.azimute, alt: Math.max(this.agora.lua.altura, 0) })],
      ['Polo sul', () => this.agora && ({ az: this.agora.casa.latitude < 0 ? 180 : 0, alt: Math.abs(this.agora.casa.latitude) })],
    ];
    for (const [nome, alvo] of atalhos) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = nome;
      b.addEventListener('click', () => {
        const a = alvo();
        if (a) { this.visao.az = a.az; this.visao.alt = a.alt; }
      });
      botoes.appendChild(b);
    }
    p.appendChild(botoes);
  }

  // ---- catalogo: estrelas e constelacoes, calculadas na placa de video ----
  carregarCatalogo(c, corDaEstrela) {
    this.catalogo = c;
    const n = c.ra.length;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('radec', new THREE.BufferAttribute(Float32Array.from(c.ra.flatMap((r, i) => [r, c.dec[i]])), 2));
    g.setAttribute('brilho', new THREE.BufferAttribute(Float32Array.from(c.magnitude), 1));
    g.setAttribute('cor', new THREE.BufferAttribute(Float32Array.from(c.cor.flatMap(corDaEstrela)), 3));
    this.estrelas = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { ...this.uniformes, dpr: { value: 1 }, alfa: { value: 1 }, limite: { value: 6 }, escala: { value: 1 } },
      transparent: true, depthTest: false,
      vertexShader: GLSL_HORIZONTE + `
        attribute vec2 radec; attribute float brilho; attribute vec3 cor;
        uniform float dpr, limite, escala;
        varying vec3 vCor; varying float vAlfa;
        void main() {
          vec2 aa = horizonte(radec.x, radec.y);
          vec3 p = vec3(cos(aa.x) * sin(aa.y), sin(aa.x), -cos(aa.x) * cos(aa.y)) * ${R.toFixed(1)};
          // a perda de brilho perto do horizonte: a luz atravessa mais atmosfera
          float extincao = 0.25 * (1.0 / max(sin(aa.x), 0.02) - 1.0);
          float folga = limite - extincao - brilho;
          vAlfa = aa.x > 0.0 && folga >= 0.0 ? clamp(0.45 + folga * 0.4, 0.45, 1.0) : 0.0;
          vCor = cor;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = max(1.8, (6.8 - brilho) * 1.15) * escala * dpr;
        }`,
      fragmentShader: `
        uniform float alfa; varying vec3 vCor; varying float vAlfa;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = dot(c, c);
          if (d > 0.25) discard;
          gl_FragColor = vec4(vCor, alfa * vAlfa * (1.0 - smoothstep(0.08, 0.25, d)));
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
    this.constelacoes = new THREE.LineSegments(gl, new THREE.ShaderMaterial({
      uniforms: { ...this.uniformes, alfa: { value: 0 } },
      transparent: true, depthTest: false,
      vertexShader: GLSL_HORIZONTE + `
        attribute vec2 radec; varying float vVis;
        void main() {
          vec2 aa = horizonte(radec.x, radec.y);
          vec3 p = vec3(cos(aa.x) * sin(aa.y), sin(aa.x), -cos(aa.x) * cos(aa.y)) * ${R.toFixed(1)};
          vVis = aa.x > 0.0 ? 1.0 : 0.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform float alfa; varying float vVis;
        void main() { if (vVis < 0.999) discard; gl_FragColor = vec4(0.42, 0.56, 0.82, alfa); }`,
    }));
    this.constelacoes.frustumCulled = false;
    this.constelacoes.renderOrder = 5;
    this.cena.add(this.constelacoes, this.estrelas);

    this.nomes = Object.entries(c.nomes).map(([i, nome]) => ({
      i: +i, r: this.rotulo('nomes', nome, new THREE.Vector3(), '#e6ebf5'),
    }));
  }

  // ---- olhar em volta ----
  arrastar(dx, dy, h) {
    const porPixel = this.visao.fov / h;
    this.visao.az = ((this.visao.az - dx * porPixel) % 360 + 360) % 360;
    this.visao.alt = Math.max(-89, Math.min(89, this.visao.alt + dy * porPixel));
  }

  aproximar(fator) {
    this.visao.fov = Math.max(10, Math.min(100, this.visao.fov * fator));
  }

  reiniciar() {
    this.visao = { ...this.padrao };
  }

  /** Setas viram a cabeca de 5 em 5 graus (menos com o zoom fechado). */
  tecla(k) {
    const passo = 5 * this.visao.fov / 70;
    if (k === 'ArrowLeft') this.visao.az = (this.visao.az - passo + 360) % 360;
    else if (k === 'ArrowRight') this.visao.az = (this.visao.az + passo) % 360;
    else if (k === 'ArrowUp') this.visao.alt = Math.min(89, this.visao.alt + passo);
    else if (k === 'ArrowDown') this.visao.alt = Math.max(-89, this.visao.alt - passo);
    else if (k === '+') this.aproximar(1 / 1.15);
    else if (k === '-') this.aproximar(1.15);
    else if (k === '0') this.reiniciar();
  }

  // ---- um quadro ----
  desenhar(renderer, w, h, agora, claridade, dpr) {
    this.agora = agora;
    const lat = agora.casa.latitude;
    this.uniformes.tsl.value = agora.tempoSideral;
    this.uniformes.lat.value = lat;

    const altSol = agora.sol.altura;
    const sol = dir(rad(altSol), rad(agora.sol.azimute));
    this.sky.claridade.value = claridade;
    this.sky.crepusculo.value = ss(-18, -4, altSol) * (1 - ss(0, 12, altSol));
    this.sky.sol.value.copy(sol);

    const transparencia = 1 - claridade;
    const escala = Math.max(0.9, Math.min(2.2, Math.sqrt(70 / this.visao.fov)));
    if (this.estrelas) {
      const u = this.estrelas.material.uniforms;
      u.dpr.value = dpr; u.alfa.value = transparencia; u.limite.value = this.limiteMagnitude; u.escala.value = escala;
      this.constelacoes.material.uniforms.alfa.value = transparencia * 0.7;
      this.constelacoes.visible = this.opcoes.linhas && transparencia > 0.03;
    }
    this.escala.visible = this.opcoes.cardeais;
    this.grade.visible = this.opcoes.grade;

    // Sol e Lua: so aparecem acima do horizonte, porque o chao os esconde
    const solAcima = altSol > -1.5;
    this.sol.visible = this.brilhoSol.visible = solAcima;
    this.sol.position.copy(sol).multiplyScalar(R * 0.9);
    this.brilhoSol.position.copy(this.sol.position);
    this.brilhoSol.material.opacity = Math.min(1, 0.4 + claridade);
    this.rSol.posicao = sol.clone().multiplyScalar(R * 0.9).add(new THREE.Vector3(0, R * 0.05, 0));

    const lua = dir(rad(agora.lua.altura), rad(agora.lua.azimute));
    this.lua.visible = agora.lua.altura > -1.5;
    this.lua.position.copy(lua).multiplyScalar(R * 0.9);
    this.rLua.posicao = lua.clone().multiplyScalar(R * 0.9).add(new THREE.Vector3(0, R * 0.05, 0));
    this.luz.position.copy(sol).multiplyScalar(5); // a fase vem da direcao do Sol

    for (const p of agora.planetas || []) {
      const o = this.planeta(p.nome);
      o.visivel = planetaVisivel(p, this.limiteMagnitude, claridade);
      o.sprite.visible = o.visivel && this.opcoes.planetas;
      if (!o.visivel) continue;
      const pos = dir(rad(p.altura), rad(p.azimute), R * 0.9);
      o.sprite.position.copy(pos);
      // o disco de luz cresce com o brilho, bem maior que o tamanho real, senao nao se veria
      o.sprite.scale.setScalar(R * 0.9 * Math.tan(rad(Math.max(1.1, Math.min(3.4, 1.6 + (1.5 - p.magnitude) * 0.4)))));
      o.r.posicao = pos.clone().add(new THREE.Vector3(0, R * 0.045, 0));
    }

    const v = this.visao;
    this.camera.fov = v.fov;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0, 0);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(dir(rad(v.alt), rad(v.az)));
    this.camera.updateMatrixWorld();

    this.atualizarSatelites(w, h);
    renderer.render(this.cena, this.camera);

    // rotulos HTML, so os que estao na frente da camera
    const mostrar = (r, quando = true) => {
      const visivel = quando && this.projetar(r, w, h);
      r.el.style.display = visivel ? '' : 'none';
    };
    for (const r of this.rotulos) {
      if (r.grupo === 'nomes') continue;
      const ligado = r.grupo === 'astros' ? (r === this.rSol ? solAcima : this.lua.visible)
        : r.grupo === 'planetas' ? this.opcoes.planetas && this.visivelPlaneta(r)
        : r.grupo === 'cardeais' ? this.opcoes.cardeais : this.opcoes.grade;
      mostrar(r, ligado);
    }
    if (this.catalogo) {
      const latR = rad(lat), tsl = agora.tempoSideral;
      for (const { i, r } of this.nomes) {
        const H = rad(tsl - this.catalogo.ra[i]), d = rad(this.catalogo.dec[i]);
        const alt = Math.asin(Math.sin(latR) * Math.sin(d) + Math.cos(latR) * Math.cos(d) * Math.cos(H));
        const az = Math.atan2(-Math.sin(H) * Math.cos(d), Math.cos(latR) * Math.sin(d) - Math.sin(latR) * Math.cos(d) * Math.cos(H));
        const extincao = 0.25 * (1 / Math.max(Math.sin(alt), 0.02) - 1);
        const alcanca = alt > 0 && this.catalogo.magnitude[i] <= this.limiteMagnitude - extincao;
        r.posicao = dir(alt, az, R);
        mostrar(r, this.opcoes.nomes && alcanca && transparencia > 0.3);
        r.el.style.opacity = transparencia;
      }
    }

    const ponto = VENTOS[Math.round(v.az / 45) % 8];
    this.hud.textContent = `Olhando para ${ponto} (azimute ${Math.round(v.az)}°), altura ${v.alt >= 0 ? '+' : '−'}${Math.abs(Math.round(v.alt))}° - campo de visão ${Math.round(v.fov)}°`;
  }

  /** O rotulo de um planeta so aparece quando o proprio planeta esta visivel. */
  visivelPlaneta(r) {
    for (const o of this.planetas.values()) if (o.r === r) return o.visivel;
    return false;
  }

  /** Posiciona o rotulo na tela. Falso quando o ponto esta atras de quem olha. */
  projetar(r, w, h) {
    const p = r.posicao.clone();
    const vista = p.clone().applyMatrix4(this.camera.matrixWorldInverse);
    if (vista.z >= -0.01) return false;
    p.project(this.camera);
    if (Math.abs(p.x) > 1.15 || Math.abs(p.y) > 1.15) return false;
    r.el.style.left = ((p.x + 1) / 2 * w) + 'px';
    r.el.style.top = ((1 - p.y) / 2 * h) + 'px';
    return true;
  }

  esconderRotulos() {
    for (const r of this.rotulos) r.el.style.display = 'none';
    this.marcasSat.forEach(m => { m.r.el.style.display = 'none'; });
  }
}
