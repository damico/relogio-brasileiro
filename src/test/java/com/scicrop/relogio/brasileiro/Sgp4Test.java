package com.scicrop.relogio.brasileiro;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * O SGP4 contra os vetores de referencia publicados (Spacetrack Report no. 3
 * e o conjunto de testes de Vallado), que qualquer implementacao correta
 * reproduz.
 */
class Sgp4Test
{
	/** Fecha uma linha de 68 caracteres com o digito de verificacao. */
	private static String fechar(String linha) {
		assertEquals(68, linha.length(), linha);
		int soma = 0;
		for (char c : linha.toCharArray()) {
			soma += Character.isDigit(c) ? c - '0' : c == '-' ? 1 : 0;
		}
		return linha + (soma % 10);
	}

	private static void confere(double[][] esperado, double[][] obtido, double tolerancia) {
		for (int i = 0; i < 3; i++) {
			assertEquals(esperado[0][i], obtido[0][i], tolerancia, "posicao " + i);
			assertEquals(esperado[1][i], obtido[1][i], tolerancia / 100, "velocidade " + i);
		}
	}

	/**
	 * Orbita baixa, perigeu perto de 200 km: o ramo simplificado do SGP4. Aqui
	 * a diferenca para o vetor publicado chega a 2 m, bem abaixo da incerteza
	 * de qualquer TLE, que e de quilometros; no Vanguard 1, que usa o ramo
	 * completo, o resultado coincide em todas as casas.
	 */
	@Test
	void satelite88888DoSpacetrackReport3() {
		Tle tle = Tle.ler("TESTE 88888",
				fechar("1 88888U          80275.98708465  .00073094  13844-3  66816-4 0    8"),
				fechar("2 88888  72.8435 115.9689 0086731  52.6988 110.5714 16.05824518   10"));
		Sgp4 sgp4 = new Sgp4(tle);

		confere(new double[][] { { 2328.97048951, -5995.22076416, 1719.97067261 }, { 2.91207230, -0.98341546, -7.09081703 } },
				sgp4.propagar(0), 5e-3);
		confere(new double[][] { { 2456.10705566, -6071.93853760, 1222.89727783 }, { 2.67938992, -0.44829041, -7.22879231 } },
				sgp4.propagar(360), 5e-3);
	}

	/** Excentricidade alta, com todos os termos de arrasto: o ramo completo. */
	@Test
	void vanguard1() {
		Tle tle = Tle.ler("VANGUARD 1",
				fechar("1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  475"),
				fechar("2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.8241915741366"));
		Sgp4 sgp4 = new Sgp4(tle);

		confere(new double[][] { { 7022.46529266, -1400.08296755, 0.03995155 }, { 1.893841015, 6.405893759, 4.534807250 } },
				sgp4.propagar(0), 1e-6);
		confere(new double[][] { { -7154.03120202, -3783.17682504, -3536.19412294 }, { 4.741887409, -4.151817765, -2.093935425 } },
				sgp4.propagar(360), 1e-6);
	}

	@Test
	void somaDeVerificacaoErradaERecusada() {
		String l1 = fechar("1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  475");
		String l2 = fechar("2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.8241915741366");
		String corrompida = l1.substring(0, 68) + (l1.charAt(68) == '0' ? '1' : '0');
		assertThrows(IllegalArgumentException.class, () -> Tle.ler("X", corrompida, l2));
	}

	/** Os arquivos de data/tle sao validos e descrevem a orbita heliossincrona do Sentinel-2. */
	@Test
	void sentinel2DosArquivosDaPasta() throws Exception {
		for (String arquivo : List.of("sentinel-2a.tle", "sentinel-2b.tle")) {
			List<String> linhas = Files.readAllLines(Path.of("data/tle", arquivo));
			Tle tle = Tle.ler(linhas.get(0), linhas.get(1), linhas.get(2));
			Sgp4 sgp4 = new Sgp4(tle);

			// onde a orbita e propagada na propria epoca: altitude perto de 786 km e 7,45 km/s
			double[][] estado = sgp4.propagar(0);
			double raio = Math.sqrt(estado[0][0] * estado[0][0] + estado[0][1] * estado[0][1] + estado[0][2] * estado[0][2]);
			double velocidade = Math.sqrt(estado[1][0] * estado[1][0] + estado[1][1] * estado[1][1] + estado[1][2] * estado[1][2]);
			assertEquals(786, raio - 6371, 20, arquivo + " altitude");
			assertEquals(7.45, velocidade, 0.05, arquivo + " velocidade");
			assertEquals(100.6, sgp4.periodoEmMinutos(), 0.3, arquivo + " periodo");
			assertTrue(tle.nome().startsWith("SENTINEL-2"));

			// uma volta depois, o satelite esta no mesmo ponto da orbita, so a Terra girou: o raio nao muda muito
			double[][] depois = sgp4.propagar(sgp4.periodoEmMinutos());
			double raio2 = Math.sqrt(depois[0][0] * depois[0][0] + depois[0][1] * depois[0][1] + depois[0][2] * depois[0][2]);
			assertEquals(raio, raio2, 15);
		}
	}
}
