package com.scicrop.relogio.brasileiro;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * As estrelas a olho nu.
 *
 * O catalogo vem junto com o fonte do WorldWind: 5044 estrelas do Hipparcos
 * ate magnitude 6, que e mais ou menos o limite do olho humano num ceu bem
 * escuro. Cada linha traz ascensao reta, declinacao, magnitude e o indice de
 * cor B menos V, que diz se a estrela e azulada ou avermelhada.
 *
 */
public final class CatalogoDeEstrelas
{
	private static final String ARQUIVO = "/config/Hipparcos_Stars_Mag6x5044.tsv";

	/** As mais brilhantes, para dar nome ao que se ve. */
	private static final Map<Integer, String> NOMES = new HashMap<>();

	static {
		NOMES.put(32349, "Sirius");
		NOMES.put(30438, "Canopus");
		NOMES.put(71683, "Alfa Centauri");
		NOMES.put(69673, "Arcturus");
		NOMES.put(91262, "Vega");
		NOMES.put(24608, "Capella");
		NOMES.put(24436, "Rigel");
		NOMES.put(37279, "Procyon");
		NOMES.put(7588, "Achernar");
		NOMES.put(27989, "Betelgeuse");
		NOMES.put(68702, "Hadar");
		NOMES.put(97649, "Altair");
		NOMES.put(21421, "Aldebaran");
		NOMES.put(80763, "Antares");
		NOMES.put(65474, "Spica");
		NOMES.put(37826, "Pollux");
		NOMES.put(113368, "Fomalhaut");
		NOMES.put(102098, "Deneb");
		NOMES.put(49669, "Regulus");
		NOMES.put(60718, "Acrux");
		NOMES.put(62434, "Mimosa");
		NOMES.put(61084, "Gacrux");
		NOMES.put(11767, "Polaris");
		NOMES.put(11484, "Sigma Octantis");
	}

	private static CatalogoDeEstrelas catalogo;

	private final double[] ascensaoReta;
	private final double[] declinacao;
	private final double[] magnitude;
	private final double[] cor;
	private final String[] nome;

	private CatalogoDeEstrelas(List<double[]> linhas, List<String> nomes) {
		int tamanho = linhas.size();
		ascensaoReta = new double[tamanho];
		declinacao = new double[tamanho];
		magnitude = new double[tamanho];
		cor = new double[tamanho];
		nome = new String[tamanho];

		for (int i = 0; i < tamanho; i++) {
			double[] estrela = linhas.get(i);
			ascensaoReta[i] = estrela[0];
			declinacao[i] = estrela[1];
			magnitude[i] = estrela[2];
			cor[i] = estrela[3];
			nome[i] = nomes.get(i);
		}
	}

	/** Le o catalogo do classpath na primeira vez e guarda. */
	public static synchronized CatalogoDeEstrelas carregar() {
		if (catalogo != null) {
			return catalogo;
		}

		List<double[]> estrelas = new ArrayList<>();
		List<String> nomes = new ArrayList<>();

		try (InputStream entrada = CatalogoDeEstrelas.class.getResourceAsStream(ARQUIVO)) {
			if (entrada == null) {
				return catalogo = new CatalogoDeEstrelas(estrelas, nomes);
			}

			BufferedReader leitor = new BufferedReader(new InputStreamReader(entrada, StandardCharsets.UTF_8));
			String linha;
			while ((linha = leitor.readLine()) != null) {
				String[] campos = linha.split(";");
				if (campos.length < 6) {
					continue;
				}

				try {
					// a primeira coluna e o numero do registro, a segunda e o HIP
					int hip = Integer.parseInt(campos[1].trim());
					double[] estrela = { emGraus(campos[2], 15), emGraus(campos[3], 1),
							Double.parseDouble(campos[4].trim()), Double.parseDouble(campos[5].trim()) };
					estrelas.add(estrela);
					nomes.add(NOMES.get(hip));
				} catch (NumberFormatException naoEUmaEstrela) {
					// cabecalho e linhas de separacao caem aqui
				}
			}
		} catch (IOException e) {
			// fica com o que deu para ler
		}

		return catalogo = new CatalogoDeEstrelas(estrelas, nomes);
	}

	/**
	 * Converte "00 01 04.60" ou "+61 13 22.1" para graus.
	 *
	 * @param fator 15 para horas de ascensao reta, 1 para graus de declinacao
	 */
	private static double emGraus(String texto, double fator) {
		String[] partes = texto.trim().split("\\s+");
		double graus = Double.parseDouble(partes[0]);
		double minutos = Double.parseDouble(partes[1]);
		double segundos = Double.parseDouble(partes[2]);
		double sinal = texto.trim().startsWith("-") ? -1 : 1;
		return (graus + sinal * (minutos / 60 + segundos / 3600)) * fator;
	}

	public int tamanho() {
		return ascensaoReta.length;
	}

	public double getAscensaoReta(int i) {
		return ascensaoReta[i];
	}

	public double getDeclinacao(int i) {
		return declinacao[i];
	}

	public double getMagnitude(int i) {
		return magnitude[i];
	}

	/** Indice de cor B menos V: negativo e azulado, acima de 1 e alaranjado. */
	public double getCor(int i) {
		return cor[i];
	}

	/** Nome da estrela, ou nulo se ela nao for uma das conhecidas. */
	public String getNome(int i) {
		return nome[i];
	}
}
