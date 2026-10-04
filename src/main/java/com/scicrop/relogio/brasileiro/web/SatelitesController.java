package com.scicrop.relogio.brasileiro.web;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.scicrop.relogio.brasileiro.CatalogoDeSatelites;
import com.scicrop.relogio.brasileiro.Configuracao;
import com.scicrop.relogio.brasileiro.Satelite;
import com.scicrop.relogio.brasileiro.Satelite.Estado;
import com.scicrop.relogio.brasileiro.Satelite.Passagem;

/**
 * Os satelites da pasta data/tle: onde estao agora e a trajetoria em volta do
 * instante pedido. A trajetoria vai em amostras compactas, cada uma um vetor:
 * [instante em ms, latitude, longitude, altitude km, velocidade da orbita km/s,
 * velocidade sobre o chao km/s, azimute, elevacao, bits], com bit 1 para
 * iluminado e bit 2 para visivel. O cliente interpola entre as amostras, entao
 * o satelite anda suave sem pedir nada de novo a cada quadro.
 *
 */
@RestController
@RequestMapping("/api/satelites")
public class SatelitesController
{
	@GetMapping
	public Map<String, Object> agora(@RequestParam(required = false) Instant t) {
		Instant instante = t != null ? t : Instant.now();
		double[] obs = observador();

		Map<String, Object> r = cabecalho(instante, obs);
		List<Map<String, Object>> lista = new ArrayList<>();
		List<String> avisos = new ArrayList<>(CatalogoDeSatelites.avisos());

		for (Satelite s : CatalogoDeSatelites.carregar()) {
			try {
				Map<String, Object> m = descricao(s, instante);
				m.put("estado", s.em(instante, obs[0], obs[1]));
				lista.add(m);
			} catch (RuntimeException e) {
				avisos.add(s.getTle().nome() + ": " + e.getMessage());
			}
		}
		r.put("satelites", lista);
		r.put("avisos", avisos);
		return r;
	}

	@GetMapping("/trajetoria")
	public Map<String, Object> trajetoria(@RequestParam(required = false) Instant t,
			@RequestParam(defaultValue = "900") int antes,
			@RequestParam(defaultValue = "0") int depois,
			@RequestParam(defaultValue = "10") int passo) {
		Instant instante = t != null ? t : Instant.now();
		double[] obs = observador();
		passo = Math.max(1, Math.min(passo, 600));

		Map<String, Object> r = cabecalho(instante, obs);
		List<Map<String, Object>> lista = new ArrayList<>();
		List<String> avisos = new ArrayList<>(CatalogoDeSatelites.avisos());

		for (Satelite s : CatalogoDeSatelites.carregar()) {
			try {
				// por padrao, vai ate uma volta completa e um pouco mais
				int ate = depois > 0 ? depois : (int) (s.periodoEmMinutos() * 60) + 300;
				Map<String, Object> m = descricao(s, instante);

				List<List<Object>> amostras = new ArrayList<>();
				for (Estado e : s.trajetoria(instante.minusSeconds(antes), instante.plusSeconds(ate), passo, obs[0], obs[1])) {
					amostras.add(java.util.Arrays.asList(e.instante().toEpochMilli(), arredondar(e.latitude(), 4),
							arredondar(e.longitude(), 4), arredondar(e.altitudeKm(), 2),
							arredondar(e.velocidadeKmS(), 4), arredondar(e.velocidadeSoloKmS(), 4),
							e.azimute() == null ? null : arredondar(e.azimute(), 3),
							e.elevacao() == null ? null : arredondar(e.elevacao(), 3),
							(e.iluminado() ? 1 : 0) | (e.visivel() ? 2 : 0)));
				}
				m.put("amostras", amostras);

				if (!Double.isNaN(obs[0])) {
					Passagem p = s.proximaPassagem(instante, obs[0], obs[1], 48);
					m.put("proximaPassagem", p);
				}
				lista.add(m);
			} catch (RuntimeException e) {
				avisos.add(s.getTle().nome() + ": " + e.getMessage());
			}
		}
		r.put("satelites", lista);
		r.put("avisos", avisos);
		return r;
	}

	private static Map<String, Object> cabecalho(Instant instante, double[] obs) {
		Map<String, Object> r = new LinkedHashMap<>();
		r.put("instante", instante);
		if (Double.isNaN(obs[0])) {
			r.put("observador", null);
		} else {
			Map<String, Object> o = new LinkedHashMap<>();
			o.put("latitude", obs[0]);
			o.put("longitude", obs[1]);
			r.put("observador", o);
		}
		return r;
	}

	private static Map<String, Object> descricao(Satelite s, Instant instante) {
		Map<String, Object> m = new LinkedHashMap<>();
		m.put("nome", s.getTle().nome());
		m.put("numero", s.getTle().numero());
		m.put("epoca", s.getTle().epoca());
		m.put("idadeDoTleEmDias", arredondar(Duration.between(s.getTle().epoca(), instante).toMillis() / 86_400_000d, 2));
		m.put("periodoEmMinutos", arredondar(s.periodoEmMinutos(), 2));
		m.put("inclinacao", s.getTle().inclinacao());
		return m;
	}

	/** Latitude e longitude de casa, ou NaN quando nao ha data/config.json. */
	private static double[] observador() {
		Configuracao casa = Configuracao.ler();
		return casa == null ? new double[] { Double.NaN, Double.NaN }
				: new double[] { casa.getLatitude(), casa.getLongitude() };
	}

	private static double arredondar(double v, int casas) {
		double f = Math.pow(10, casas);
		return Math.round(v * f) / f;
	}
}
