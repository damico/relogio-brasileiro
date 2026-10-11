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

import com.scicrop.relogio.brasileiro.Configuracao;
import com.scicrop.relogio.brasileiro.Horizonte;
import com.scicrop.relogio.brasileiro.Lua;
import com.scicrop.relogio.brasileiro.PosicaoDaLua;
import com.scicrop.relogio.brasileiro.PosicaoDoSol;
import com.scicrop.relogio.brasileiro.Planetas;

/**
 * O que a coluna de tempo e espaco, que aparece em todas as telas, mostra e
 * que so o servidor sabe calcular: o Sol (altura, nascer e por), a Lua (fase e
 * proximas fases), os planetas e o tempo sideral. O que e so conta de data, como
 * a estacao do ano ou a distancia da Terra ao Sol, o navegador faz sozinho.
 *
 * O instante e parametro (?t=), como nas outras rotas.
 *
 */
@RestController
@RequestMapping("/api")
public class PainelController
{
	private static final Instant J2000 = Instant.parse("2000-01-01T12:00:00Z");

	@GetMapping("/painel")
	public Map<String, Object> painel(@RequestParam(required = false) Instant t) {
		Instant instante = t != null ? t : Instant.now();
		Configuracao casa = Configuracao.ler();

		Map<String, Object> r = new LinkedHashMap<>();
		r.put("instante", instante);

		PosicaoDoSol sol = PosicaoDoSol.em(instante);
		Map<String, Object> s = new LinkedHashMap<>();
		s.put("latitudeSubsolar", sol.getLatitude());
		s.put("longitudeSubsolar", sol.getLongitude());

		double fracao = Lua.fracaoDoCiclo(instante);
		Map<String, Object> l = new LinkedHashMap<>();
		l.put("fracaoDoCiclo", fracao);
		l.put("nome", Lua.nomeDaFase(fracao));
		l.put("iluminacao", Lua.iluminacao(fracao));
		l.put("idadeEmDias", Lua.idadeEmDias(fracao));
		l.put("proximaNova", depois(instante, Lua.diasAte(fracao, 0)));
		l.put("proximaCheia", depois(instante, Lua.diasAte(fracao, 0.5)));

		if (casa == null) {
			r.put("casa", null);
			r.put("sol", s);
			r.put("lua", l);
			r.put("planetas", List.of());
			return r;
		}

		double lat = casa.getLatitude(), lon = casa.getLongitude();
		double dias = Duration.between(J2000, instante).toMillis() / 86_400_000d;
		double tempoSideral = Horizonte.tempoSideralLocal(dias, lon);

		Map<String, Object> c = new LinkedHashMap<>();
		c.put("latitude", lat);
		c.put("longitude", lon);
		r.put("casa", c);
		r.put("tempoSideral", tempoSideral);

		s.put("altura", sol.altura(lat, lon));
		s.put("azimute", sol.azimute(lat, lon));
		s.put("dia", sol.eDia(lat, lon));
		double nascer = sol.horasAteONascer(lat, lon), por = sol.horasAteOPor(lat, lon);
		s.put("nascerEm", nascer >= 0 ? depois(instante, nascer / 24) : null);
		s.put("porEm", por >= 0 ? depois(instante, por / 24) : null);

		PosicaoDaLua posicao = PosicaoDaLua.em(instante);
		l.put("altura", Horizonte.altura(posicao.getAscensaoReta(), posicao.getDeclinacao(), lat, tempoSideral));
		l.put("azimute", Horizonte.azimute(posicao.getAscensaoReta(), posicao.getDeclinacao(), lat, tempoSideral));

		List<Map<String, Object>> planetas = new ArrayList<>();
		for (Planetas.Planeta p : Planetas.em(instante)) {
			Map<String, Object> m = new LinkedHashMap<>();
			m.put("nome", p.nome());
			m.put("magnitude", p.magnitude());
			m.put("altura", Horizonte.altura(p.ascensaoReta(), p.declinacao(), lat, tempoSideral));
			m.put("azimute", Horizonte.azimute(p.ascensaoReta(), p.declinacao(), lat, tempoSideral));
			planetas.add(m);
		}

		r.put("sol", s);
		r.put("lua", l);
		r.put("planetas", planetas);
		return r;
	}

	/** Daqui a tantos dias, como instante. */
	private static Instant depois(Instant instante, double dias) {
		return instante.plusMillis(Math.round(dias * 86_400_000d));
	}
}
