package com.scicrop.relogio.brasileiro;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.scicrop.relogio.brasileiro.Planetas.Planeta;

/** As posicoes contra eventos que todo mundo conhece. */
class PlanetasTest
{
	private static Planeta de(String nome, String instante) {
		return Planetas.em(Instant.parse(instante)).stream()
				.filter(p -> p.nome().equals(nome)).findFirst().orElseThrow();
	}

	private static double separacao(Planeta a, Planeta b) {
		double ra1 = Math.toRadians(a.ascensaoReta()), d1 = Math.toRadians(a.declinacao());
		double ra2 = Math.toRadians(b.ascensaoReta()), d2 = Math.toRadians(b.declinacao());
		return Math.toDegrees(Math.acos(Math.max(-1, Math.min(1,
				Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(ra1 - ra2)))));
	}

	@Test
	void seteplanetasNaLista() {
		assertEquals(7, Planetas.em(Instant.parse("2026-10-01T12:00:00Z")).size());
	}

	@Test
	void grandeConjuncaoDeJupiterESaturnoEm2020() {
		// 21/12/2020: os dois a cerca de 6 minutos de arco um do outro
		String t = "2020-12-21T18:00:00Z";
		assertTrue(separacao(de("Júpiter", t), de("Saturno", t)) < 0.25);
	}

	@Test
	void conjuncaoDeVenusEJupiterEm2015() {
		// 30/06/2015: cerca de 0,4 grau de separacao
		String t = "2015-06-30T12:00:00Z";
		assertTrue(separacao(de("Vênus", t), de("Júpiter", t)) < 0.7);
	}

	@Test
	void marteNaOposicaoDe2020() {
		// aproximacao maxima em 6/10/2020: 62,07 milhoes de km (0,4149 UA), e brilho perto de -2,6
		Planeta marte = de("Marte", "2020-10-06T12:00:00Z");
		assertEquals(0.4149, marte.distanciaEmUA(), 0.003);
		assertEquals(-2.6, marte.magnitude(), 0.25);
	}

	@Test
	void brilhoDeVenusJupiterESaturno() {
		assertEquals(-4.7, de("Vênus", "2020-04-28T12:00:00Z").magnitude(), 0.3);
		assertEquals(-2.75, de("Júpiter", "2020-07-14T12:00:00Z").magnitude(), 0.25);
		assertEquals(0.1, de("Saturno", "2020-07-20T12:00:00Z").magnitude(), 0.4);
	}

	@Test
	void declinacaoDeMarteNaOposicaoFicaPertoDoEquador() {
		Planeta marte = de("Marte", "2020-10-13T23:00:00Z");
		assertEquals(5.7, marte.declinacao(), 1.0);
		assertEquals(20.0, marte.ascensaoReta(), 2.0);
	}
}
