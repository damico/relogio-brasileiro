package com.scicrop.relogio.brasileiro;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Um satelite: o TLE, o propagador e as contas que levam o resultado do SGP4
 * (inercial, em km) ate o que se quer ver: sobre que ponto da Terra ele esta,
 * a que altitude e velocidade, e onde aparece no ceu de quem olha.
 *
 * O SGP4 devolve posicao e velocidade num referencial que nao gira com a
 * Terra. Girando esse vetor pelo tempo sideral de Greenwich chega-se ao
 * referencial preso a Terra, e dele saem a latitude, a longitude e a altitude
 * (no elipsoide WGS-84) e a direcao vista do observador.
 *
 * Ha duas velocidades: a inercial, que e a da orbita (cerca de 7,5 km/s em
 * orbita baixa), e a relativa ao solo, que desconta a rotacao da Terra e diz
 * com que rapidez o satelite varre o chao.
 *
 */
public final class Satelite
{
	private static final Instant J2000 = Instant.parse("2000-01-01T12:00:00Z");

	private static final double WGS84_A = 6378.137;
	private static final double WGS84_F = 1 / 298.257223563;
	private static final double WGS84_E2 = WGS84_F * (2 - WGS84_F);

	/** Velocidade de rotacao da Terra, em rad/s. */
	private static final double OMEGA_DA_TERRA = 7.2921150e-5;

	/** O Sol precisa estar mais fundo que isso para o ceu estar escuro o bastante para ver um satelite. */
	private static final double SOL_PARA_VER_O_SATELITE = -6;

	/**
	 * Onde o satelite esta num instante.
	 *
	 * @param velocidadeKmS a velocidade da orbita (inercial)
	 * @param velocidadeSoloKmS a velocidade em relacao ao chao
	 * @param azimute graus a partir do norte, nulo se nao ha observador
	 * @param elevacao graus acima do horizonte, nulo se nao ha observador
	 * @param distanciaKm distancia ate o observador, nulo se nao ha observador
	 * @param iluminado falso quando o satelite esta na sombra da Terra
	 * @param visivel acima do horizonte, iluminado e com o ceu do observador escuro
	 */
	public record Estado(Instant instante, double latitude, double longitude, double altitudeKm,
			double velocidadeKmS, double velocidadeSoloKmS, Double azimute, Double elevacao, Double distanciaKm,
			boolean iluminado, boolean visivel)
	{
	}

	/** Uma passagem sobre o observador, do nascer ao se pôr do satelite. */
	public record Passagem(Instant subida, Instant culminacao, double elevacaoMaxima, Instant descida,
			boolean visivel)
	{
	}

	private final Tle tle;
	private final Sgp4 sgp4;

	public Satelite(Tle tle) {
		this.tle = tle;
		this.sgp4 = new Sgp4(tle);
	}

	public Tle getTle() {
		return tle;
	}

	public double periodoEmMinutos() {
		return sgp4.periodoEmMinutos();
	}

	/**
	 * @param latitudeObservador em graus, ou NaN se nao ha observador
	 * @param longitudeObservador em graus, ou NaN se nao ha observador
	 */
	public Estado em(Instant instante, double latitudeObservador, double longitudeObservador) {
		double minutos = Duration.between(tle.epoca(), instante).toMillis() / 60_000d;
		double[][] rv = sgp4.propagar(minutos);
		double[] r = rv[0];
		double[] v = rv[1];

		double dias = Duration.between(J2000, instante).toMillis() / 86_400_000d;
		double gmst = Math.toRadians(Horizonte.tempoSideralDeGreenwich(dias));
		double c = Math.cos(gmst), s = Math.sin(gmst);

		// do referencial inercial para o preso a Terra
		double x = c * r[0] + s * r[1];
		double y = -s * r[0] + c * r[1];
		double z = r[2];
		double vx = c * v[0] + s * v[1];
		double vy = -s * v[0] + c * v[1];
		double vz = v[2];

		// a velocidade relativa ao chao desconta a rotacao da Terra: v - (omega x r)
		double vsx = vx + OMEGA_DA_TERRA * y;
		double vsy = vy - OMEGA_DA_TERRA * x;

		double[] geodesica = geodesica(x, y, z);

		// onde esta o Sol, no referencial inercial, para saber se a sombra da Terra cobre o satelite
		PosicaoDoSol sol = PosicaoDoSol.em(instante);
		double declinacao = Math.toRadians(sol.getLatitude());
		double lonSol = Math.toRadians(sol.getLongitude());
		double sx = Math.cos(declinacao) * Math.cos(lonSol);
		double sy = Math.cos(declinacao) * Math.sin(lonSol);
		double sz = Math.sin(declinacao);
		double solX = c * sx - s * sy;
		double solY = s * sx + c * sy;
		boolean iluminado = !naSombra(r, new double[] { solX, solY, sz });

		Double azimute = null, elevacao = null, distancia = null;
		boolean visivel = false;
		if (!Double.isNaN(latitudeObservador) && !Double.isNaN(longitudeObservador)) {
			double[] topo = topocentrica(x, y, z, latitudeObservador, longitudeObservador);
			azimute = topo[0];
			elevacao = topo[1];
			distancia = topo[2];
			visivel = elevacao > 0 && iluminado
					&& sol.altura(latitudeObservador, longitudeObservador) < SOL_PARA_VER_O_SATELITE;
		}

		return new Estado(instante, geodesica[0], geodesica[1], geodesica[2],
				Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
				Math.sqrt(vsx * vsx + vsy * vsy + vz * vz),
				azimute, elevacao, distancia, iluminado, visivel);
	}

	/** Os estados de um intervalo, de passo em passo, para desenhar a orbita. */
	public List<Estado> trajetoria(Instant inicio, Instant fim, int passoEmSegundos,
			double latitudeObservador, double longitudeObservador) {
		List<Estado> estados = new ArrayList<>();
		for (Instant t = inicio; !t.isAfter(fim); t = t.plusSeconds(passoEmSegundos)) {
			estados.add(em(t, latitudeObservador, longitudeObservador));
		}
		return estados;
	}

	/**
	 * A proxima passagem acima do horizonte do observador, ou nenhuma nas
	 * proximas horas. Se o satelite ja esta no ceu, e a passagem em curso, com
	 * a subida no instante pedido.
	 */
	public Passagem proximaPassagem(Instant a_partir_de, double latitudeObservador, double longitudeObservador,
			int horas) {
		Instant subida = null, culminacao = null;
		double maxima = -90;
		boolean visivel = false;

		Instant fim = a_partir_de.plus(Duration.ofHours(horas));
		for (Instant t = a_partir_de; t.isBefore(fim); t = t.plusSeconds(15)) {
			Estado e = em(t, latitudeObservador, longitudeObservador);
			boolean acima = e.elevacao() > 0;

			if (acima && subida == null) {
				subida = t;
			}
			if (subida != null) {
				if (e.elevacao() > maxima) {
					maxima = e.elevacao();
					culminacao = t;
				}
				visivel |= e.visivel();
				if (!acima) {
					return new Passagem(subida, culminacao, maxima, t, visivel);
				}
			}
		}
		return null;
	}

	/** Latitude e longitude em graus e altitude em km, no elipsoide WGS-84. */
	private static double[] geodesica(double x, double y, double z) {
		double lon = Math.atan2(y, x);
		double p = Math.sqrt(x * x + y * y);
		double lat = Math.atan2(z, p * (1 - WGS84_E2));
		double altitude = 0;
		for (int i = 0; i < 6; i++) {
			double seno = Math.sin(lat);
			double n = WGS84_A / Math.sqrt(1 - WGS84_E2 * seno * seno);
			altitude = p / Math.cos(lat) - n;
			lat = Math.atan2(z, p * (1 - WGS84_E2 * n / (n + altitude)));
		}
		return new double[] { Math.toDegrees(lat), Math.toDegrees(lon), altitude };
	}

	/** Azimute e elevacao em graus e distancia em km, de quem esta na superficie. */
	private static double[] topocentrica(double x, double y, double z, double latitude, double longitude) {
		double lat = Math.toRadians(latitude), lon = Math.toRadians(longitude);
		double n = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(lat) * Math.sin(lat));
		double ox = n * Math.cos(lat) * Math.cos(lon);
		double oy = n * Math.cos(lat) * Math.sin(lon);
		double oz = n * (1 - WGS84_E2) * Math.sin(lat);

		double dx = x - ox, dy = y - oy, dz = z - oz;
		double leste = -Math.sin(lon) * dx + Math.cos(lon) * dy;
		double norte = -Math.sin(lat) * Math.cos(lon) * dx - Math.sin(lat) * Math.sin(lon) * dy + Math.cos(lat) * dz;
		double cima = Math.cos(lat) * Math.cos(lon) * dx + Math.cos(lat) * Math.sin(lon) * dy + Math.sin(lat) * dz;

		double distancia = Math.sqrt(dx * dx + dy * dy + dz * dz);
		double azimute = Math.toDegrees(Math.atan2(leste, norte));
		if (azimute < 0) {
			azimute += 360;
		}
		return new double[] { azimute, Math.toDegrees(Math.asin(cima / distancia)), distancia };
	}

	/**
	 * A sombra da Terra como um cilindro paralelo aos raios do Sol: o satelite
	 * esta na sombra se esta do lado da noite e a menos de um raio da Terra do
	 * eixo Terra-Sol.
	 */
	private static boolean naSombra(double[] posicao, double[] sol) {
		double projecao = posicao[0] * sol[0] + posicao[1] * sol[1] + posicao[2] * sol[2];
		if (projecao >= 0) {
			return false;
		}
		double r2 = posicao[0] * posicao[0] + posicao[1] * posicao[1] + posicao[2] * posicao[2];
		return Math.sqrt(r2 - projecao * projecao) < WGS84_A;
	}
}
