# WorldWind Java, em codigo fonte

Aqui esta o fonte do NASA WorldWind Java v2.2.1, copiado de
https://github.com/NASAWorldWind/WorldWindJava sob a licenca Apache 2.0.

- `java/gov/nasa/worldwind` - o nucleo do SDK
- `java/org/codehaus/jackson` - o Jackson 1.x, que o proprio WorldWind ja
  trazia em codigo fonte
- `resources/config` e `resources/images` - configuracao e imagens que o SDK
  procura no classpath

Nada aqui e jar pronto: o `mvn compile` compila este fonte junto com o do
projeto. As unicas dependencias binarias sao o JOGL e as ligacoes Java do
GDAL, que vem do Maven Central e estao declaradas no pom.xml.

O pacote `gov.nasa.worldwindx`, com os exemplos do SDK, nao foi copiado. Ele
tem coisas uteis, como as camadas de luz do Sol e atmosfera, e pode ser
acrescentado depois do mesmo jeito.

## Alteracoes feitas no fonte original

- `gov/nasa/worldwind/util/gdal/GDALUtils.java`: o metodo
  `replaceLibraryLoader` instalava um carregador de bibliotecas proprio
  usando `gdal.setLibraryLoader`, que so existe no `gdal.jar` de 2011
  distribuido pelo WorldWind. Nenhuma versao publicada das ligacoes Java do
  GDAL tem essa API, entao o metodo agora so registra o fato e segue. Sem
  isso o fonte nao compila contra o GDAL do Maven Central.
