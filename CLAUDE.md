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

## Build

- `mvn clean package` gera `target/relogio.brasileiro-0.0.1-SNAPSHOT.jar` com as
  dependencias em `target/lib`. Mantenha esse empacotamento: o JOGL (globo do
  modo desktop) depende dele.
- Se mexer no `pom.xml`, rode `clean`: o Maven nao recompila sozinho.
