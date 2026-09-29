package com.scicrop.relogio.brasileiro;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import org.codehaus.jackson.JsonFactory;
import org.codehaus.jackson.JsonParser;
import org.codehaus.jackson.JsonToken;

/**
 * Os tracos que ligam as estrelas nas figuras das constelacoes.
 *
 * As estrelas o catalogo ja dava, mas quais ligar em quais e uma escolha de
 * desenho, nao um dado do ceu. Estes vem do projeto d3-celestial, de Olaf
 * Frohn, sob licenca BSD de tres clausulas, que esta junto do arquivo em
 * src/main/resources/ceu.
 *
 * Cada traco e uma sequencia de pontos em ascensao reta e declinacao, no
 * mesmo sistema do catalogo de estrelas, entao e so converter para o
 * horizonte de quem olha, do mesmo jeito.
 *
 */
public final class LinhasDasConstelacoes
{
	private static final String ARQUIVO = "/ceu/constelacoes.json";

	private static LinhasDasConstelacoes linhas;

	/** Cada traco: uma lista de pontos, cada ponto com ascensao reta e declinacao. */
	private final double[][][] tracos;

	private LinhasDasConstelacoes(List<double[][]> lidos) {
		tracos = lidos.toArray(new double[0][][]);
	}

	public static synchronized LinhasDasConstelacoes carregar() {
		if (linhas != null) {
			return linhas;
		}

		List<double[][]> lidos = new ArrayList<>();

		try (InputStream entrada = LinhasDasConstelacoes.class.getResourceAsStream(ARQUIVO)) {
			if (entrada != null) {
				JsonParser leitor = new JsonFactory().createJsonParser(entrada);
				while (leitor.nextToken() != null) {
					if (leitor.getCurrentToken() == JsonToken.FIELD_NAME
							&& "coordinates".equals(leitor.getCurrentName())) {
						leitor.nextToken();
						lerTracos(leitor, lidos);
					}
				}
				leitor.close();
			}
		} catch (IOException e) {
			// fica com o que deu para ler
		}

		return linhas = new LinhasDasConstelacoes(lidos);
	}

	/**
	 * Le a lista de tracos de uma constelacao. O cursor esta no abre colchetes
	 * que envolve todos eles.
	 */
	private static void lerTracos(JsonParser leitor, List<double[][]> destino) throws IOException {
		while (leitor.nextToken() == JsonToken.START_ARRAY) {
			List<double[]> pontos = new ArrayList<>();

			while (leitor.nextToken() == JsonToken.START_ARRAY) {
				leitor.nextToken();
				double ascensaoReta = leitor.getDoubleValue();
				leitor.nextToken();
				double declinacao = leitor.getDoubleValue();
				leitor.nextToken();

				pontos.add(new double[] { ascensaoReta < 0 ? ascensaoReta + 360 : ascensaoReta, declinacao });
			}

			if (pontos.size() > 1) {
				destino.add(pontos.toArray(new double[0][]));
			}
		}
	}

	public int quantidade() {
		return tracos.length;
	}

	public double[][] getTraco(int i) {
		return tracos[i];
	}
}
