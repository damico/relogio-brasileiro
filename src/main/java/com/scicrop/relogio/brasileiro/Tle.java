package com.scicrop.relogio.brasileiro;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

/**
 * Os elementos de um satelite, lidos de duas linhas TLE (two-line element set).
 *
 * O formato e de colunas fixas, de 69 caracteres por linha, e termina com um
 * digito de verificacao: a soma dos digitos da linha, contando cada sinal de
 * menos como 1, modulo 10. Uma linha com a soma errada foi corrompida e e
 * recusada, em vez de produzir uma orbita sem sentido.
 *
 * @param movimentoMedio voltas por dia
 * @param bstar termo de arrasto atmosferico, em 1 por raio da Terra
 */
public record Tle(String nome, int numero, Instant epoca, double inclinacao, double nodo,
		double excentricidade, double argumentoDoPerigeu, double anomaliaMedia,
		double movimentoMedio, double bstar)
{
	/**
	 * @param nome o nome do satelite, ou nulo para usar o numero
	 * @throws IllegalArgumentException se as linhas nao forem um TLE valido
	 */
	public static Tle ler(String nome, String linha1, String linha2) {
		validar(linha1, '1');
		validar(linha2, '2');

		int numero = Integer.parseInt(linha1.substring(2, 7).trim());
		if (numero != Integer.parseInt(linha2.substring(2, 7).trim())) {
			throw new IllegalArgumentException("as duas linhas sao de satelites diferentes");
		}

		int ano = Integer.parseInt(linha1.substring(18, 20).trim());
		ano += ano < 57 ? 2000 : 1900;
		double dia = Double.parseDouble(linha1.substring(20, 32).trim());
		Instant epoca = LocalDate.ofYearDay(ano, 1).atStartOfDay(ZoneOffset.UTC).toInstant()
				.plusMillis(Math.round((dia - 1) * 86_400_000d));

		return new Tle(nome != null && !nome.isBlank() ? nome.trim() : "NORAD " + numero, numero, epoca,
				Double.parseDouble(linha2.substring(8, 16).trim()),
				Double.parseDouble(linha2.substring(17, 25).trim()),
				Double.parseDouble("0." + linha2.substring(26, 33).trim()),
				Double.parseDouble(linha2.substring(34, 42).trim()),
				Double.parseDouble(linha2.substring(43, 51).trim()),
				Double.parseDouble(linha2.substring(52, 63).trim()),
				fracaoComExpoente(linha1.substring(53, 61)));
	}

	/** Le "-62220-4" como -0,62220 vezes 10 elevado a -4: o ponto decimal e o expoente ficam subentendidos. */
	private static double fracaoComExpoente(String campo) {
		double sinal = campo.charAt(0) == '-' ? -1 : 1;
		double mantissa = Double.parseDouble("0." + campo.substring(1, 6).trim());
		int expoente = Integer.parseInt(campo.substring(6, 8).trim());
		return sinal * mantissa * Math.pow(10, expoente);
	}

	private static void validar(String linha, char numeroDaLinha) {
		if (linha == null || linha.length() < 69 || linha.charAt(0) != numeroDaLinha || linha.charAt(1) != ' ') {
			throw new IllegalArgumentException("a linha " + numeroDaLinha + " do TLE deve ter 69 caracteres");
		}

		int soma = 0;
		for (int i = 0; i < 68; i++) {
			char c = linha.charAt(i);
			if (Character.isDigit(c)) {
				soma += c - '0';
			} else if (c == '-') {
				soma++;
			}
		}
		if (soma % 10 != linha.charAt(68) - '0') {
			throw new IllegalArgumentException("a soma de verificacao da linha " + numeroDaLinha + " nao confere");
		}
	}
}
