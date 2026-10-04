package com.scicrop.relogio.brasileiro;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Os satelites que estao na pasta data/tle.
 *
 * Cada arquivo .tle ou .txt pode ter um ou varios satelites, no formato de
 * tres linhas (nome e as duas linhas do TLE) ou so de duas. A pasta e relida a
 * cada poucos segundos, entao trocar um TLE velho por um novo, ou acrescentar
 * outro satelite, vale sem reiniciar o programa. O que nao for um TLE valido
 * nao derruba os outros: vira um aviso, que a tela mostra.
 *
 */
public final class CatalogoDeSatelites
{
	private static final Path PASTA = Path.of("data", "tle");
	private static final long VALIDADE_MS = 5_000;

	private static long carregadoEm;
	private static List<Satelite> satelites = List.of();
	private static List<String> avisos = List.of();

	private CatalogoDeSatelites() {
	}

	public static synchronized List<Satelite> carregar() {
		recarregarSeVelho();
		return satelites;
	}

	/** Os problemas do ultimo carregamento: arquivos ilegiveis, TLE corrompido, orbita nao suportada. */
	public static synchronized List<String> avisos() {
		recarregarSeVelho();
		return avisos;
	}

	private static void recarregarSeVelho() {
		long agora = System.currentTimeMillis();
		if (carregadoEm != 0 && agora - carregadoEm < VALIDADE_MS) {
			return;
		}
		carregadoEm = agora;

		List<Satelite> lidos = new ArrayList<>();
		List<String> problemas = new ArrayList<>();

		if (!Files.isDirectory(PASTA)) {
			problemas.add("a pasta " + PASTA + " nao existe");
		} else {
			try (DirectoryStream<Path> arquivos = Files.newDirectoryStream(PASTA, "*.{tle,txt}")) {
				List<Path> ordenados = new ArrayList<>();
				arquivos.forEach(ordenados::add);
				ordenados.sort(Comparator.comparing(Path::toString));
				for (Path arquivo : ordenados) {
					lerArquivo(arquivo, lidos, problemas);
				}
			} catch (IOException e) {
				problemas.add("nao foi possivel ler " + PASTA + ": " + e.getMessage());
			}
		}

		satelites = List.copyOf(lidos);
		avisos = List.copyOf(problemas);
	}

	private static void lerArquivo(Path arquivo, List<Satelite> destino, List<String> problemas) {
		List<String> linhas;
		try {
			linhas = Files.readAllLines(arquivo);
		} catch (IOException e) {
			problemas.add(arquivo.getFileName() + ": " + e.getMessage());
			return;
		}

		String nome = null;
		for (int i = 0; i < linhas.size(); i++) {
			String linha = linhas.get(i).stripTrailing();
			if (linha.isBlank()) {
				continue;
			}

			boolean eLinha1 = linha.startsWith("1 ") && i + 1 < linhas.size() && linhas.get(i + 1).startsWith("2 ");
			if (!eLinha1) {
				nome = linha.startsWith("0 ") ? linha.substring(2).trim() : linha.trim();
				continue;
			}

			try {
				destino.add(new Satelite(Tle.ler(nome, linha, linhas.get(i + 1).stripTrailing())));
			} catch (RuntimeException e) {
				problemas.add(arquivo.getFileName() + ": " + (nome != null ? nome : "TLE") + " - " + e.getMessage());
			}
			nome = null;
			i++;
		}
	}
}
