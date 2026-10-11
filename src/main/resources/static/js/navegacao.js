// As mesmas teclas do desktop: F2 abre as orbitas gerais, F3 as estacoes, F4 o globo, F5 o ceu e, apertada de novo, volta para
// os relogios. F11 alterna a tela cheia. As outras telas entram aqui quando
// forem portadas.
const TELAS = { F2: '/orbitas', F3: '/estacoes', F4: '/globo', F5: '/ceu' };

// F1 volta para os relogios, de qualquer tela
const INICIO = '/';

addEventListener('keydown', e => {
  if (e.key === 'F11') {
    e.preventDefault();
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
    return;
  }
  if (e.key === 'F1') {
    e.preventDefault();
    if (location.pathname !== INICIO) location.href = INICIO;
    return;
  }
  const destino = TELAS[e.key];
  if (destino) {
    e.preventDefault();
    location.href = location.pathname === destino ? '/' : destino;
  }
});
