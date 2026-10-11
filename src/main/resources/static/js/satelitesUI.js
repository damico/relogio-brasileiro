// A lista "Satelites visiveis" da coluna de configuracoes: uma caixa por
// satelite da pasta data/tle, com a cor que ele tem no desenho. Refaz-se sozinha
// quando chega uma trajetoria nova (por exemplo, um TLE acrescentado na pasta).

export function montarListaDeSatelites(container, sats) {
  let versao = -1;

  function refazer() {
    container.replaceChildren();
    if (!sats.lista.length) {
      const nota = document.createElement('div');
      nota.className = 'nota';
      nota.textContent = 'Nenhum satélite em data/tle';
      container.appendChild(nota);
      return;
    }

    for (const sat of sats.lista) {
      const rotulo = document.createElement('label');
      rotulo.className = 'opcao';
      const caixa = document.createElement('input');
      caixa.type = 'checkbox';
      caixa.checked = sats.visivel(sat);
      caixa.addEventListener('change', () => sats.definirVisivel(sat, caixa.checked));
      const ponto = document.createElement('span');
      ponto.style.cssText = `width:10px;height:10px;border-radius:50%;background:${sat.cor};display:inline-block`;
      rotulo.append(caixa, ponto, sat.nome);
      container.appendChild(rotulo);
    }

    const botoes = document.createElement('div');
    botoes.className = 'botoes';
    for (const [texto, valor] of [['Todos', true], ['Nenhum', false]]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = texto;
      b.addEventListener('click', () => {
        sats.lista.forEach(s => sats.definirVisivel(s, valor));
        container.querySelectorAll('input').forEach(c => { c.checked = valor; });
      });
      botoes.appendChild(b);
    }
    container.appendChild(botoes);
  }

  setInterval(() => {
    if (sats.versao !== versao) {
      versao = sats.versao;
      refazer();
    }
  }, 400);
}
