package com.scicrop.relogio.brasileiro;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.scicrop.relogio.brasileiro.Satelite.Estado;

/** As contas de referencial, checadas contra o que se sabe da orbita do Sentinel-2. */
class SateliteTest
{
	private static Satelite sentinel(String arquivo) throws Exception {
		List<String> l = Files.readAllLines(Path.of("data/tle", arquivo));
		return new Satelite(Tle.ler(l.get(0), l.get(1), l.get(2)));
	}

	@Test
	void pastaDeTlesCarregaOsTresSentinels() {
		List<Satelite> lidos = CatalogoDeSatelites.carregar();
		assertEquals(3, lidos.size(), CatalogoDeSatelites.avisos().toString());
		assertTrue(CatalogoDeSatelites.avisos().isEmpty());
	}

	@Test
	void grandezasDaOrbita() throws Exception {
		Satelite s2a = sentinel("sentinel-2a.tle");
		double maiorLatitude = 0;
		for (Estado e : s2a.trajetoria(s2a.getTle().epoca(), s2a.getTle().epoca().plus(Duration.ofMinutes(101)), 30, Double.NaN, Double.NaN)) {
			// o raio da orbita e quase constante, mas a Terra e achatada: a altitude sobre o elipsoide
			// vai de cerca de 786 km no equador a mais de 800 km perto dos polos (o raio da orbita ainda oscila alguns km por causa do J2)
			assertTrue(e.altitudeKm() > 775 && e.altitudeKm() < 820, "altitude " + e.altitudeKm());
			assertEquals(7.45, e.velocidadeKmS(), 0.05);
			// a velocidade em relacao ao chao e a da orbita menos o arrasto da rotacao da Terra
			assertEquals(e.velocidadeKmS(), e.velocidadeSoloKmS(), 0.5);
			maiorLatitude = Math.max(maiorLatitude, Math.abs(e.latitude()));
		}
		// inclinacao de 98,57 graus: a trilha chega a 81,4 graus de latitude
		assertEquals(81.4, maiorLatitude, 1.0);
	}

	/**
	 * O Sentinel-2 e heliossincrono, com a descida pelo equador as 10h30 de hora
	 * solar local. Essa hora so sai certa se o giro da Terra, a latitude e a
	 * longitude estiverem certos.
	 */
	@Test
	void descidaPeloEquadorAs1030DeHoraSolarLocal() throws Exception {
		for (String arquivo : List.of("sentinel-2a.tle", "sentinel-2b.tle", "sentinel-2c.tle")) {
			Satelite s = sentinel(arquivo);
			Instant inicio = s.getTle().epoca();
			Estado anterior = s.em(inicio, Double.NaN, Double.NaN);
			boolean achou = false;
			for (int i = 1; i < 400 && !achou; i++) {
				Estado e = s.em(inicio.plusSeconds(i * 20L), Double.NaN, Double.NaN);
				if (anterior.latitude() > 0 && e.latitude() <= 0) {
					double lonSol = PosicaoDoSol.em(e.instante()).getLongitude();
					double horaLocal = 12 + (e.longitude() - lonSol) / 15;
					horaLocal = ((horaLocal % 24) + 24) % 24;
					assertEquals(10.5, horaLocal, 0.6, arquivo + " hora solar local da descida");
					achou = true;
				}
				anterior = e;
			}
			assertTrue(achou, arquivo + ": nao cruzou o equador descendo");
		}
	}

	@Test
	void sombraDaTerraEElevacaoSobreOObservador() throws Exception {
		Satelite s = sentinel("sentinel-2a.tle");
		Instant t = s.getTle().epoca();
		int iluminados = 0, sombra = 0, acima = 0;
		for (int i = 0; i < 202; i++) {
			Estado e = s.em(t.plusSeconds(i * 30L), -23.6678, -46.6879);
			assertNotNull(e.elevacao());
			if (e.iluminado()) iluminados++; else sombra++;
			if (e.elevacao() > 0) acima++;
			assertTrue(e.distanciaKm() > 780 && e.distanciaKm() < 13000);
			// nunca visivel se esta abaixo do horizonte ou na sombra
			if (e.visivel()) {
				assertTrue(e.elevacao() > 0 && e.iluminado());
			}
		}
		// numa orbita de 100 min, uma boa parte e iluminada e outra parte, de noite, fica na sombra
		assertTrue(iluminados > 0 && sombra > 0, "iluminados=" + iluminados + " sombra=" + sombra);
		assertTrue(acima < 100);
	}

	/** Os tres voam no mesmo plano e no mesmo sentido; o par 2B e 2C esta a 180 graus um do outro na orbita. */
	@Test
	void mesmoPlanoEPar2BE2CEmOposicao() throws Exception {
		Satelite a = sentinel("sentinel-2a.tle"), b = sentinel("sentinel-2b.tle"), c = sentinel("sentinel-2c.tle");
		Instant t = Instant.parse("2026-10-02T12:00:00Z");

		assertEquals(180, angulo(b, c, t, false), 2.0);
		assertEquals(37, angulo(a, b, t, false), 2.0);
		// o produto vetorial r x v aponta para o polo da orbita: planos iguais e mesmo sentido
		assertEquals(0, angulo(a, b, t, true), 0.3);
		assertEquals(0, angulo(b, c, t, true), 0.3);
	}

	/** Angulo entre as posicoes (ou entre os polos das orbitas, se orbita for verdadeiro). */
	private static double angulo(Satelite x, Satelite y, Instant t, boolean orbita) {
		double[][] rx = estadoInercial(x, t), ry = estadoInercial(y, t);
		double[] u = orbita ? cruz(rx[0], rx[1]) : rx[0], v = orbita ? cruz(ry[0], ry[1]) : ry[0];
		double dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
		double n = Math.sqrt((u[0] * u[0] + u[1] * u[1] + u[2] * u[2]) * (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]));
		return Math.toDegrees(Math.acos(Math.max(-1, Math.min(1, dot / n))));
	}

	private static double[][] estadoInercial(Satelite s, Instant t) {
		return new Sgp4(s.getTle()).propagar(Duration.between(s.getTle().epoca(), t).toMillis() / 60000d);
	}

	private static double[] cruz(double[] a, double[] b) {
		return new double[] { a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0] };
	}
}
