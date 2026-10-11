# relogio.brasileiro

Um jar executavel do Spring Boot com dois modos: janela desktop (Swing, padrao)
e servidor web (`--web`). Os dois saem do mesmo `mvn package`.

## Regras do projeto web

- **Nenhum JS ou CSS vem de CDN.** Toda biblioteca de front-end fica no proprio
  projeto (em `src/main/resources/static/vendor`) e e servida localmente, para o
  programa rodar sem internet. Isso vale tambem para fontes e icones.
- **As paginas sao Thymeleaf** (`src/main/resources/templates`), renderizadas pelo
  Spring. Nada de Vue, React, Angular ou outro framework de SPA.
- **Bootstrap, no maximo,** e tambem local. O desenho 3D e feito com three.js
  (local, em `static/vendor`), em JavaScript puro com modulos ES.
- O servidor calcula o que ja existe em Java (Sol, Lua, fases) e expoe em `/api`.
  O instante e sempre parametro (`?t=`), porque quem manda na hora e o cliente.

## Padrao de layout de todas as telas web

Toda tela segue o mesmo desenho: a largura e dividida em 5 partes iguais, e o
**conteudo ocupa as 5**. Por cima dele ficam duas colunas de um quinto cada,
**translucidas** (o que esta atras continua visivel) e **recolhiveis**:

- **Coluna 1 (esquerda): tempo e espaco.** E igual em todas as telas, atualizada
  sozinha: relogio e data, estacao do ano, fase da Lua, distancia ao Sol e dados
  da orbita da Terra, Sol (altura, nascer e por), planetas e satelites. Vem do
  fragmento `colunaEsquerda` (`templates/fragmentos.html`), do
  `static/js/colunaEsquerda.js` e do endpoint `/api/painel`. Tudo o que for
  tempo ou espaco entra aqui, nao em barras soltas no rodape.
- **Coluna 5 (direita): configuracoes.** Cada tela preenche a sua: tipos de
  visao, filtros, camadas, satelites visiveis. A tela abre com o fragmento
  `cabecaDireita('<tela>')` (navegacao entre telas e tela cheia) e poe o resto
  em `<div class="corpo">`, em secoes `<details class="secao">`.
- As colunas se recolhem pelo botao da borda ou com `[` (esquerda) e `]`
  (direita); o estado fica no navegador (`static/js/layout.js`).
- O estilo e de `static/css/layout.css`; `tela.css` so tem o que e do desenho
  de cada tela. **Tema escuro em todas as telas**: fundo `#0b0f1a`, tinta clara.
- **Tudo em tempo real.** Nenhuma tela tem ritmo acelerado do tempo (as de
  orbitas e estacoes, F2 e F3, tambem so andam com o relogio de verdade). O
  instante e do navegador e vai para o servidor em `?t=`.
- **Distancia ao Sol sempre com muitas casas decimais** (km com 2 casas, UA com
  9, graus com 5), em qualquer tela ou coluna, e calculada com o dia do ano
  **continuo** (`diaDoAnoContinuo` em `tempoEspaco.js`), para dar para ver que
  ela esta atualizando: ela muda ate cerca de 0,5 km por segundo. Com o dia
  inteiro o valor ficaria parado o dia todo.
- Uma tela nova copia o padrao de `templates/globo.html`. Nao ponha botoes
  soltos sobre o desenho: configuracao vai na coluna 5.

## Build

- `mvn clean package` gera `target/relogio.brasileiro-0.0.1-SNAPSHOT.jar` com as
  dependencias em `target/lib`. Mantenha esse empacotamento: o JOGL (globo do
  modo desktop) depende dele.
- Se mexer no `pom.xml`, rode `clean`: o Maven nao recompila sozinho.
