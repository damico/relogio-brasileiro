// As mesmas teclas do desktop: F4 abre o globo, F5 o ceu e, apertada de novo, volta para
// os relogios. F11 alterna a tela cheia. As outras telas entram aqui quando
// forem portadas.
const TELAS = { F4: '/globo', F5: '/ceu' };

addEventListener('keydown', e => {
  if (e.key === 'F11') {
    e.preventDefault();
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
    return;
  }
  const destino = TELAS[e.key];
  if (destino) {
    e.preventDefault();
    location.href = location.pathname === destino ? '/' : destino;
  }
});
