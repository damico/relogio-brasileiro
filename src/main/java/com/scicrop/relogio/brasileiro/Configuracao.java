package com.scicrop.relogio.brasileiro;

import java.io.File;
import java.io.IOException;

import org.codehaus.jackson.JsonFactory;
import org.codehaus.jackson.JsonParser;
import org.codehaus.jackson.JsonToken;

/**
 * O que esta em data/config.json.
 *
 * Por enquanto so a chave home, com as coordenadas de casa na ordem do
 * GeoJSON, primeiro a longitude e depois a latitude.
 *
 * O leitor de JSON e o Jackson que ja vem no fonte do WorldWind.
 *
 */
public final class Configuracao
{
	private static final File ARQUIVO = new File("data/config.json");

	private final double latitude;
	private final double longitude;

	private Configuracao(double longitude, double latitude) {
		this.longitude = longitude;
		this.latitude = latitude;
	}

	/**
	 * Le o arquivo e devolve a casa, ou nulo se o arquivo nao existir ou nao
	 * tiver a chave home.
	 */
	public static Configuracao ler() {
		if (!ARQUIVO.isFile()) {
			return null;
		}

		try (JsonParser leitor = new JsonFactory().createJsonParser(ARQUIVO)) {
			while (leitor.nextToken() != null) {
				if (leitor.getCurrentToken() == JsonToken.FIELD_NAME && "home".equals(leitor.getCurrentName())) {
					if (leitor.nextToken() != JsonToken.START_ARRAY) {
						return null;
					}
					leitor.nextToken();
					double longitude = leitor.getDoubleValue();
					leitor.nextToken();
					double latitude = leitor.getDoubleValue();
					return new Configuracao(longitude, latitude);
				}
			}
		} catch (IOException e) {
			return null;
		}

		return null;
	}

	public double getLatitude() {
		return latitude;
	}

	public double getLongitude() {
		return longitude;
	}

	public String getCaminho() {
		return ARQUIVO.getPath();
	}
}
