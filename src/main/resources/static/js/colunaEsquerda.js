// A coluna da esquerda, igual em todas as telas: tudo o que e tempo e espaco,
// atualizado sozinho. O relogio e a data andam pelo relogio do navegador; a
// fase da Lua, o Sol, os planetas e o tempo sideral vem do servidor, e os
// satelites sao interpolados a cada segundo.

import { estacaoDe, orbitaDaTerra } from './tempoEspaco.js';
import { COR_PLANETA, planetaVisivel } from './planetas.js';
import { textoDaPassagem, textoDaFaixa } from './satelites.js';

const VENTOS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
const dois = n => String(n).padStart(2, '0');
const fmt = (n, c = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
const sinal = (n, c = 0) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n), c);
const hhmm = d => `${dois(d.getHours())}:${dois(d.getMinutes())}`;
const ddmm = d => `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`;
const vento = az => VENTOS[Math.round(az / 45) % 8];

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

/** Uma linha "rotulo ..... valor", devolvendo o elemento do valor para ser atualizado. */
function par(rotulo, valor = '') {
  const linha = el('div', 'par');
  const v = el('span', '', valor);
  linha.append(el('span', '', rotulo), v);
  return { linha, v };
}

function nomeDoDia(alturaDoSol) {
  return alturaDoSol > 0 ? 'dia' : alturaDoSol > -6 ? 'crepúsculo civil' : alturaDoSol > -12 ? 'crepúsculo náutico'
    : alturaDoSol > -18 ? 'crepúsculo astronômico' : 'noite fechada';
}

/**
 * A Lua como se ve daqui: disco escuro com a parte iluminada recortada pelo
 * terminador. Ceu do hemisferio sul: a crescente fica iluminada a esquerda.
 */
function desenharLua(canvas, fracao) {
  const g = canvas.getContext('2d');
  const r = canvas.width / 2 - 3, c = canvas.width / 2;
  const clara = 'rgb(240,240,228)', escura = 'rgb(62,66,84)';
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = escura;
  g.beginPath(); g.arc(c, c, r, 0, 2 * Math.PI); g.fill();

  const crescente = fracao < 0.5;
  const largura = r * Math.abs(Math.cos(fracao * 2 * Math.PI));
  const iluminacao = (1 - Math.cos(fracao * 2 * Math.PI)) / 2;
  g.save();
  g.beginPath(); g.arc(c, c, r, 0, 2 * Math.PI); g.clip();
  g.fillStyle = clara;
  g.fillRect(crescente ? c - r : c, c - r, r, 2 * r);
  g.fillStyle = iluminacao > 0.5 ? clara : escura;
  g.beginPath(); g.ellipse(c, c, Math.max(largura, 0.01), r, 0, 0, 2 * Math.PI); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(170,190,230,0.6)'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(c, c, r, 0, 2 * Math.PI); g.stroke();
}

/**
 * @param sats o objeto Satelites, ou nulo se a tela nao tiver satelites
 * @param instanteFixo um instante parado (?t=), ou nulo para o tempo real
 */
export function iniciarColunaEsquerda({ sats = null, instanteFixo = null }) {
  const agoraMs = () => (instanteFixo ? new Date(instanteFixo).getTime() : Date.now());
  let dados = null; // a ultima resposta de /api/painel

  document.getElementById('estadoTempo').textContent = instanteFixo ? 'instante fixo' : '● ao vivo';

  // ---- Agora ----
  const secAgora = document.getElementById('secAgora');
  const hms = el('div', 'relogio-digital');
  const horaMin = el('span'), segundos = el('small');
  hms.append(horaMin, segundos);
  const utc = el('div', 'linha-utc');
  const dataLonga = el('div', 'data-longa');
  const diaDoAno = par('Dia do ano');
  const fuso = par('Fuso horário');
  secAgora.append(hms, utc, dataLonga, diaDoAno.linha, fuso.linha);

  // ---- Estacao ----
  const secEstacao = document.getElementById('secEstacao');
  const estacaoNome = el('div', 'estacao-nome');
  const estacaoFalta = el('div', 'nota');
  const barraEstacao = el('div', 'barra');
  const preenchimento = el('i');
  barraEstacao.appendChild(preenchimento);
  const estacaoDatas = par('Começou em / termina em');
  secEstacao.append(estacaoNome, barraEstacao, estacaoFalta, estacaoDatas.linha);

  // ---- Lua ----
  const secLua = document.getElementById('secLua');
  const luaCanvas = el('canvas');
  luaCanvas.width = luaCanvas.height = 64;
  const luaNome = el('div', 'estacao-nome');
  const luaTexto = el('div');
  const luaLinha = el('div', 'lua-linha');
  const luaColuna = el('div');
  luaColuna.append(luaNome, luaTexto);
  luaLinha.append(luaCanvas, luaColuna);
  const luaIluminacao = par('Iluminada');
  const luaIdade = par('Idade do ciclo');
  const luaNova = par('Próxima nova');
  const luaCheia = par('Próxima cheia');
  const luaCeu = par('No céu de casa');
  secLua.append(luaLinha, luaIluminacao.linha, luaIdade.linha, luaNova.linha, luaCheia.linha, luaCeu.linha);

  // ---- Sol e Terra ----
  const secSol = document.getElementById('secSolTerra');
  const distancia = par('Distância ao Sol');
  const distanciaUA = par('Em unidades astronômicas');
  const barraDistancia = el('div', 'barra marcador');
  const marcador = el('i');
  barraDistancia.appendChild(marcador);
  const extremos = el('div', 'nota');
  const grausPerielio = par('Desde o periélio');
  const tempoSideral = par('Tempo sideral local');
  const solAltura = par('Sol, altura');
  const solAzimute = par('Sol, azimute');
  const solEstado = par('Agora é');
  const solNascer = par('Nasce');
  const solPor = par('Se põe');
  const solPino = par('Sol a pino em');
  const casa = par('Casa');
  secSol.append(distancia.linha, distanciaUA.linha, barraDistancia, extremos, grausPerielio.linha, tempoSideral.linha,
    solAltura.linha, solAzimute.linha, solEstado.linha, solNascer.linha, solPor.linha, solPino.linha, casa.linha);

  const secPlanetas = document.getElementById('secPlanetas');
  const secSatelites = document.getElementById('secSatelites');

  // ---- o que anda com o relogio ----
  function atualizarRelogio() {
    const d = new Date(agoraMs());
    horaMin.textContent = `${dois(d.getHours())}:${dois(d.getMinutes())}`;
    segundos.textContent = `:${dois(d.getSeconds())}`;
    utc.textContent = `UTC ${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}:${dois(d.getUTCSeconds())}`;
    dataLonga.textContent = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    const orbita = orbitaDaTerra(d);
    diaDoAno.v.textContent = `${orbita.diaDoAno}`;
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const desvio = -d.getTimezoneOffset() / 60;
    fuso.v.textContent = `${zona} (GMT${desvio >= 0 ? '+' : '−'}${fmt(Math.abs(desvio), Number.isInteger(desvio) ? 0 : 1)})`;

    const e = estacaoDe(d);
    estacaoNome.textContent = e.nome;
    estacaoNome.style.color = e.cor;
    preenchimento.style.width = (e.progresso * 100) + '%';
    preenchimento.style.background = e.cor;
    estacaoFalta.textContent = `faltam ${e.diasQueFaltam} dias para o ${e.proxima}`;
    estacaoDatas.v.textContent = `${ddmm(e.inicio)} / ${ddmm(e.fim)}`;

    // com casas decimais de sobra para ver a distancia correndo: o Sol se afasta ou se aproxima ate 0,5 km a cada segundo
    distancia.v.textContent = `${fmt(orbita.distanciaKm, 2)} km`;
    distanciaUA.v.textContent = `${fmt(orbita.distanciaUA, 9)} UA`;
    marcador.style.left = `calc(${orbita.posicaoNaFaixa * 100}% - 1px)`;
    extremos.textContent = `periélio ${fmt(orbita.minimaKm / 1e6, 1)} (3 jan) — afélio ${fmt(orbita.maximaKm / 1e6, 1)} milhões de km (4 jul)`;
    grausPerielio.v.textContent = `${fmt(orbita.grausDesdeOPerielio, 5)}°`;
  }

  // ---- o que vem do servidor ----
  function atualizarPainel() {
    if (!dados) return;
    const l = dados.lua;
    desenharLua(luaCanvas, l.fracaoDoCiclo);
    luaNome.textContent = l.nome;
    luaTexto.textContent = '';
    luaIluminacao.v.textContent = `${fmt(l.iluminacao * 100)}%`;
    luaIdade.v.textContent = `${fmt(l.idadeEmDias, 1)} dias`;
    const nova = new Date(l.proximaNova), cheia = new Date(l.proximaCheia);
    const dias = d => Math.max(0, Math.round((d - new Date(agoraMs())) / 86_400_000));
    luaNova.v.textContent = `${ddmm(nova)} (${dias(nova)} dias)`;
    luaCheia.v.textContent = `${ddmm(cheia)} (${dias(cheia)} dias)`;
    luaCeu.linha.hidden = l.altura === undefined;
    if (l.altura !== undefined) luaCeu.v.textContent = `${sinal(l.altura)}°, azimute ${fmt(l.azimute)}° (${vento(l.azimute)})`;

    const s = dados.sol;
    solPino.v.textContent = `${fmt(s.latitudeSubsolar, 2)}, ${fmt(s.longitudeSubsolar, 2)}`;
    const temCasa = !!dados.casa;
    [tempoSideral, solAltura, solAzimute, solEstado, solNascer, solPor, casa].forEach(p => { p.linha.hidden = !temCasa; });
    if (!temCasa) return;

    casa.v.textContent = `${fmt(dados.casa.latitude, 4)}, ${fmt(dados.casa.longitude, 4)}`;
    const horas = dados.tempoSideral / 15;
    tempoSideral.v.textContent = `${dois(Math.floor(horas))}h${dois(Math.floor((horas % 1) * 60))}`;
    solAltura.v.textContent = `${sinal(s.altura, 1)}°`;
    solAzimute.v.textContent = `${fmt(s.azimute)}° (${vento(s.azimute)})`;
    solEstado.v.textContent = nomeDoDia(s.altura);
    solNascer.v.textContent = s.nascerEm ? hhmm(new Date(s.nascerEm)) : '—';
    solPor.v.textContent = s.porEm ? hhmm(new Date(s.porEm)) : '—';

    // planetas: todos os sete, com o estado de cada um
    const claridade = Math.max(0, Math.min(1, (s.altura + 18) / 18));
    secPlanetas.replaceChildren();
    for (const p of dados.planetas) {
      const visivel = planetaVisivel(p, 6, claridade);
      const linha = el('div', 'planeta-linha' + (visivel ? '' : ' apagado'));
      const nome = el('span', 'nome');
      const ponto = el('span', 'ponto');
      ponto.style.background = COR_PLANETA[p.nome];
      nome.append(ponto, p.nome);
      const estado = p.altura <= 0 ? 'sob o horizonte' : visivel ? `${sinal(p.altura)}° ${vento(p.azimute)}` : `${sinal(p.altura)}° (apagado)`;
      linha.append(nome, el('span', '', `${sinal(p.magnitude, 1)} · ${estado}`));
      secPlanetas.appendChild(linha);
    }
  }

  async function buscar() {
    try {
      dados = await (await fetch('/api/painel?t=' + new Date(agoraMs()).toISOString())).json();
      atualizarPainel();
    } catch (e) { /* servidor fora do ar: segue com o ultimo quadro */ }
  }

  // ---- satelites: um cartao por satelite que o usuario deixou ligado ----
  function atualizarSatelites() {
    const bloco = document.getElementById('blocoSatelites');
    bloco.hidden = !sats || !sats.lista.length;
    if (bloco.hidden) return;

    secSatelites.replaceChildren();
    const ligados = sats.lista.filter(s => sats.visivel(s));
    if (!ligados.length) secSatelites.appendChild(el('div', 'nota', 'Nenhum satélite ligado na coluna de configurações'));

    for (const sat of ligados) {
      const p = sats.posicao(sat);
      const cartao = el('div', 'cartao-sat');
      const nome = el('div', 'nome');
      const ponto = el('span', 'ponto');
      ponto.style.background = sat.cor;
      nome.append(ponto, sat.nome);
      if (p) {
        if (p.visivel) nome.appendChild(el('span', 'selo visivel', 'visível agora'));
        else if (!p.iluminado) nome.appendChild(el('span', 'selo sombra', 'na sombra da Terra'));
        else if (p.elevacao != null && p.elevacao > 0) nome.appendChild(el('span', 'selo', 'acima do horizonte'));
      }
      cartao.appendChild(nome);

      const linha = (rotulo, texto) => {
        if (!texto) return;
        const d = el('div', 'linha');
        d.append(`${rotulo} `, el('b', '', texto));
        cartao.appendChild(d);
      };
      if (p) {
        linha('Altitude', `${fmt(p.altitude)} km`);
        linha('Velocidade', `${fmt(p.velocidade, 2)} km/s na órbita, ${fmt(p.velocidadeSolo, 2)} sobre o solo`);
        linha('Sob o satélite', `${fmt(p.latitude, 2)}, ${fmt(p.longitude, 2)}`);
        if (p.elevacao != null) linha('No céu de casa', `${sinal(p.elevacao)}°, azimute ${fmt(p.azimute)}° (${vento(p.azimute)})`);
      } else {
        linha('', 'fora do intervalo da trajetória');
      }
      linha('Órbita', `período ${fmt(sat.periodoEmMinutos, 1)} min, inclinação ${fmt(sat.inclinacao, 2)}°`);
      linha('Próxima passagem', textoDaPassagem(sat));
      linha('Faixa', textoDaFaixa(sat));
      if (sat.idadeDoTleEmDias > 14) linha('Atenção', `TLE com ${fmt(sat.idadeDoTleEmDias)} dias, precisão menor`);
      secSatelites.appendChild(cartao);
    }
    for (const aviso of sats.avisos) {
      const a = el('div', 'nota', 'Aviso: ' + aviso);
      a.style.color = '#ff9a66';
      secSatelites.appendChild(a);
    }
  }

  atualizarRelogio();
  atualizarSatelites();
  buscar();
  setInterval(buscar, instanteFixo ? 10_000 : 2_000);
  setInterval(atualizarRelogio, 500);
  setInterval(atualizarSatelites, 1000);
}
