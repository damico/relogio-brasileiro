// Os satelites da pasta data/tle, no navegador. O servidor manda a trajetoria
// em amostras de 10 em 10 segundos (de poucos minutos atras ate uma volta e
// pouco a frente), e aqui se interpola entre elas pelo relogio do navegador,
// entao o satelite anda suave a cada quadro sem pedir nada de novo.

const CORES = ['#4de1ff', '#ff6bd6', '#8dff6a', '#ffb347', '#b69cff', '#ff7a66'];

const rad = Math.PI / 180;

/** Posicao no ceu em graus -> o mesmo ponto na esfera de raio 1 (y para cima, norte em -z, leste em +x). */
export function direcaoNoCeu(elevacao, azimute, raio = 1) {
  const e = elevacao * rad, a = azimute * rad;
  return [raio * Math.cos(e) * Math.sin(a), raio * Math.sin(e), -raio * Math.cos(e) * Math.cos(a)];
}

export class Satelites {
  /** @param instanteFixo texto ISO de um instante parado, ou nulo para o tempo real */
  constructor(instanteFixo = null) {
    this.instanteFixo = instanteFixo;
    this.lista = [];     // [{ nome, cor, amostras, tms, ... }]
    this.avisos = [];
    this.observador = null;
    this.versao = 0;     // sobe a cada trajetoria nova, para quem desenha refazer os tracos
    this.recebidoEm = 0;
  }

  /** O instante que as telas estao mostrando, em ms. */
  agora() {
    return this.instanteFixo ? new Date(this.instanteFixo).getTime() : Date.now();
  }

  async iniciar() {
    await this.carregar();
    setInterval(() => this.carregar(), 60_000);
  }

  async carregar() {
    try {
      const pedido = this.instanteFixo || new Date().toISOString();
      const r = await (await fetch('/api/satelites/trajetoria?t=' + pedido)).json();
      this.observador = r.observador;
      this.avisos = r.avisos || [];
      this.lista = (r.satelites || []).map((s, i) => ({
        ...s,
        cor: CORES[i % CORES.length],
        tms: Float64Array.from(s.amostras, a => a[0]),
      }));
      this.recebidoEm = Date.now();
      this.versao++;
    } catch (e) { /* servidor fora do ar: segue com a ultima trajetoria */ }
  }

  /**
   * O estado do satelite num instante, interpolado entre as duas amostras
   * vizinhas. Nulo se o instante esta fora do que o servidor mandou.
   */
  posicao(sat, ms = this.agora()) {
    const t = sat.tms, a = sat.amostras;
    if (!t.length || ms < t[0] || ms > t[t.length - 1]) return null;

    let lo = 0, hi = t.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (t[mid] <= ms) lo = mid; else hi = mid;
    }
    const p = a[lo], q = a[hi];
    const k = t[hi] === t[lo] ? 0 : (ms - t[lo]) / (t[hi] - t[lo]);
    const mistura = (x, y) => x + (y - x) * k;
    const angulo = (x, y) => { // pelo caminho mais curto, sem dar a volta em 360
      let d = y - x;
      if (d > 180) d -= 360; else if (d < -180) d += 360;
      return (x + d * k + 360) % 360;
    };
    const lon = (() => { let l = angulo(p[2] + 180, q[2] + 180) - 180; return l; })();
    const vizinha = k < 0.5 ? p : q;
    return {
      ms, indice: lo + k,
      latitude: mistura(p[1], q[1]), longitude: lon, altitude: mistura(p[3], q[3]),
      velocidade: mistura(p[4], q[4]), velocidadeSolo: mistura(p[5], q[5]),
      azimute: p[6] == null ? null : angulo(p[6], q[6]),
      elevacao: p[7] == null ? null : mistura(p[7], q[7]),
      iluminado: (vizinha[8] & 1) !== 0, visivel: (vizinha[8] & 2) !== 0,
    };
  }
}

const dois = n => String(n).padStart(2, '0');
const hhmm = ms => { const d = new Date(ms); return `${dois(d.getHours())}:${dois(d.getMinutes())}`; };
const fmt = (n, c = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
const sinal = (n, c = 0) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n), c);

/**
 * Uma linha de texto sobre o satelite: onde esta, a que altitude e velocidade,
 * onde aparece no ceu de casa e quando passa por la.
 */
export function descreverSatelite(sat, p, { comCeu = true } = {}) {
  if (!p) return `${sat.nome}: fora do intervalo da trajetoria`;
  let t = `${sat.nome}: ${fmt(p.latitude, 2)}, ${fmt(p.longitude, 2)} - altitude ${fmt(p.altitude)} km - `
    + `${fmt(p.velocidade, 2)} km/s na órbita (${fmt(p.velocidadeSolo, 2)} km/s sobre o solo)`;
  if (comCeu && p.elevacao != null) {
    t += ` - no céu de casa a ${sinal(p.elevacao)}°, azimute ${fmt(p.azimute)}°`
      + (p.visivel ? ' - visível agora' : p.iluminado ? '' : ' - na sombra da Terra');
  }
  if (comCeu && sat.proximaPassagem) {
    const g = sat.proximaPassagem;
    const subida = Date.parse(g.subida), descida = Date.parse(g.descida), agora = Date.now();
    t += agora >= subida && agora <= descida
      ? ` - passando agora até ${hhmm(descida)} (máx. ${fmt(g.elevacaoMaxima)}°)`
      : ` - próxima passagem ${hhmm(subida)}-${hhmm(descida)}, máx. ${fmt(g.elevacaoMaxima)}°${g.visivel ? ', visível' : ''}`;
  }
  if (sat.idadeDoTleEmDias > 14) t += ` - atenção: TLE com ${fmt(sat.idadeDoTleEmDias)} dias, precisão menor`;
  return t;
}
