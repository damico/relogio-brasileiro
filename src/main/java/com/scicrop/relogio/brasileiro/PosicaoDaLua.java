package com.scicrop.relogio.brasileiro;

import java.time.Duration;
import java.time.Instant;

/**
 * Onde a Lua esta no ceu, em ascensao reta e declinacao.
 *
 * A orbita da Lua e cheia de irregularidades. Aqui entram os termos maiores
 * delas, o que basta para achar a Lua no ceu com erro bem abaixo de um grau.
 * A fase continua saindo da classe Lua.
 *
 */
public final class PosicaoDaLua
{
	private static final Instant J2000 = Instant.parse("2000-01-01T12:00:00Z");

	private final double ascensaoReta;
	private final double declinacao;

	private PosicaoDaLua(double ascensaoReta, double declinacao) {
		this.ascensaoReta = ascensaoReta;
		this.declinacao = declinacao;
	}

	public static PosicaoDaLua em(Instant instante) {
		double dias = Duration.between(J2000, instante).toMillis() / 86_400_000d;

		double longitudeMedia = 218.316 + 13.176396 * dias;
		double anomalia = Math.toRadians(134.963 + 13.064993 * dias);
		double argumentoDaLatitude = Math.toRadians(93.272 + 13.229350 * dias);
		double elongacao = Math.toRadians(297.850 + 12.190749 * dias);
		double anomaliaDoSol = Math.toRadians(357.529 + 0.985600 * dias);

		double longitude = longitudeMedia
				+ 6.289 * Math.sin(anomalia)
				- 1.274 * Math.sin(anomalia - 2 * elongacao)
				+ 0.658 * Math.sin(2 * elongacao)
				+ 0.214 * Math.sin(2 * anomalia)
				- 0.186 * Math.sin(anomaliaDoSol)
				- 0.114 * Math.sin(2 * argumentoDaLatitude);

		double latitude = 5.128 * Math.sin(argumentoDaLatitude)
				+ 0.281 * Math.sin(anomalia + argumentoDaLatitude)
				- 0.278 * Math.sin(argumentoDaLatitude - anomalia)
				- 0.173 * Math.sin(argumentoDaLatitude - 2 * elongacao);

		double[] equatorial = Horizonte.doPlanoDaOrbita(longitude, latitude, dias);
		return new PosicaoDaLua(equatorial[0], equatorial[1]);
	}

	public double getAscensaoReta() {
		return ascensaoReta;
	}

	public double getDeclinacao() {
		return declinacao;
	}
}
