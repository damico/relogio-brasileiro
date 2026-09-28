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

O suporte a GDAL foi retirado. Ele servia para ler arquivos de raster do
disco, coisa que nenhuma tela do projeto faz, e obrigava a carregar as
ligacoes Java do GDAL so para o codigo compilar.

Sairam os arquivos:

- `gov/nasa/worldwind/data/GDAL.java`
- `gov/nasa/worldwind/data/GDALMetadata.java`
- `gov/nasa/worldwind/data/GDALDataRaster.java`
- `gov/nasa/worldwind/data/GDALDataRasterReader.java`
- a pasta `gov/nasa/worldwind/util/gdal` inteira

E foram ajustados, tirando as referencias a essas classes:

- `gov/nasa/worldwind/layers/SurfaceImageLayer.java`
- `gov/nasa/worldwind/data/TiledImageProducer.java`
- `gov/nasa/worldwind/data/TiledElevationProducer.java`
- `gov/nasa/worldwind/data/BasicDataRasterReaderFactory.java`

Os cabecalhos de licenca dos arquivos originais continuam citando o GDAL
entre os componentes de terceiros do WorldWind. Nao foram mexidos.
