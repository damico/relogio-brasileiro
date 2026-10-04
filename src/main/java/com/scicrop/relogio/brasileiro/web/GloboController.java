package com.scicrop.relogio.brasileiro.web;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import com.scicrop.relogio.brasileiro.Configuracao;
import com.scicrop.relogio.brasileiro.PosicaoDoSol;

/**
 * A tela do globo: a pagina e o dado dela. O servidor diz onde o Sol esta a
 * pino e, se houver data/config.json, como esta o Sol na casa. A hora de
 * nascer e de se por vai como "daqui a N horas", porque o fuso e do cliente.
 *
 */
@Controller
public class GloboController
{
	@GetMapping("/globo")
	public String pagina() {
		return "globo";
	}

	@GetMapping("/api/globo")
	@ResponseBody
	public Map<String, Object> dados(@RequestParam(required = false) Instant t) {
		Instant instante = t != null ? t : Instant.now();
		PosicaoDoSol sol = PosicaoDoSol.em(instante);

		Map<String, Object> r = new LinkedHashMap<>();
		r.put("instante", instante);

		Map<String, Object> subsolar = new LinkedHashMap<>();
		subsolar.put("latitude", sol.getLatitude());
		subsolar.put("longitude", sol.getLongitude());
		r.put("sol", subsolar);

		Configuracao casa = Configuracao.ler();
		if (casa == null) {
			r.put("casa", null);
			return r;
		}

		double lat = casa.getLatitude(), lon = casa.getLongitude();
		Map<String, Object> c = new LinkedHashMap<>();
		c.put("latitude", lat);
		c.put("longitude", lon);
		c.put("alturaDoSol", sol.altura(lat, lon));
		c.put("azimute", sol.azimute(lat, lon));
		c.put("dia", sol.eDia(lat, lon));
		c.put("horasAteONascer", sol.horasAteONascer(lat, lon));
		c.put("horasAteOPor", sol.horasAteOPor(lat, lon));
		r.put("casa", c);
		return r;
	}
}
