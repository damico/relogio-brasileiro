// As duas colunas de todas as telas: recolher e expandir. O estado fica no
// navegador, para a tela voltar como foi deixada; sem espaco (tela estreita) as
// colunas comecam recolhidas.

const guardar = (lado, colapsada) => {
  try { localStorage.setItem('colunaColapsada.' + lado, colapsada ? '1' : '0'); } catch (e) { /* sem armazenamento: so nao lembra */ }
};
const lembrado = lado => {
  try { return localStorage.getItem('colunaColapsada.' + lado); } catch (e) { return null; }
};

const colunas = {};
document.querySelectorAll('.coluna').forEach(coluna => {
  const lado = coluna.dataset.coluna;
  const botao = coluna.querySelector('.alternar');
  const aplicar = colapsada => {
    coluna.classList.toggle('colapsada', colapsada);
    botao.setAttribute('aria-expanded', String(!colapsada));
    document.body.classList.toggle('sem-' + lado, colapsada);
  };
  const antes = lembrado(lado);
  aplicar(antes === null ? innerWidth < 900 : antes === '1');
  const alternar = () => {
    const nova = !coluna.classList.contains('colapsada');
    aplicar(nova);
    guardar(lado, nova);
  };
  botao.addEventListener('click', alternar);
  colunas[lado] = alternar;
});

// [ recolhe a coluna de tempo e espaco e ] a de configuracoes
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, select, textarea')) return;
  if (e.key === '[' && colunas.esquerda) colunas.esquerda();
  else if (e.key === ']' && colunas.direita) colunas.direita();
});

const cheia = document.getElementById('botaoTelaCheia');
if (cheia) {
  cheia.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });
}
