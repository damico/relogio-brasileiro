package com.scicrop.relogio.brasileiro.web;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import com.scicrop.relogio.brasileiro.CatalogoDeEstrelas;
import com.scicrop.relogio.brasileiro.Configuracao;
import com.scicrop.relogio.brasileiro.Horizonte;
import com.scicrop.relogio.brasileiro.LinhasDasConstelacoes;
import com.scicrop.relogio.brasileiro.Lua;
import com.scicrop.relogio.brasileiro.PosicaoDaLua;
import com.scicrop.relogio.brasileiro.Planetas;
import com.scicrop.relogio.brasileiro.PosicaoDoSol;

/**
 * O ceu visto de casa. O que nao muda (estrelas e figuras das constelacoes, em
 * ascensao reta e declinacao) vai uma vez so em /api/ceu/catalogo, e o que
 * muda a cada instante (tempo sideral, Sol e Lua) vai em /api/ceu. A conta de
 * altura e azimute das estrelas e feita no navegador, na placa de video.
 *
 */
@Controller
public class CeuController
{
	private static final Instant J2000 = Instant.parse("2000-01-01T12:00:00Z");

	@GetMapping("/ceu")
	public String pagina() {
		return "ceu";
	}

	@GetMapping("/api/ceu/catalogo")
	@ResponseBody
	public Map<String, Object> catalogo() {
		CatalogoDeEstrelas estrelas = CatalogoDeEstrelas.carregar();
		int n = estrelas.tamanho();
		double[] ra = new double[n], dec = new double[n], mag = new double[n], cor = new double[n];
		Map<Integer, String> nomes = new LinkedHashMap<>();
		for (int i = 0; i < n; i++) {
			ra[i] = arredondar(estrelas.getAscensaoReta(i));
			dec[i] = arredondar(estrelas.getDeclinacao(i));
			mag[i] = estrelas.getMagnitude(i);
			cor[i] = estrelas.getCor(i);
			if (estrelas.getNome(i) != null && mag[i] < 1.8) {
				nomes.put(i, estrelas.getNome(i));
			}
		}

		LinhasDasConstelacoes linhas = LinhasDasConstelacoes.carregar();
		List<double[][]> tracos = new ArrayList<>();
		for (int i = 0; i < linhas.quantidade(); i++) {
			tracos.add(linhas.getTraco(i));
		}

		Map<String, Object> r = new LinkedHashMap<>();
		r.put("ra", ra);
		r.put("dec", dec);
		r.put("magnitude", mag);
		r.put("cor", cor);
		r.put("nomes", nomes);
		r.put("constelacoes", tracos);
		return r;
	}

	@GetMapping("/api/ceu")
	@ResponseBody
	public Map<String, Object> agora(@RequestParam(required = false) Instant t) {
		Instant instante = t != null ? t : Instant.now();
		Map<String, Object> r = new LinkedHashMap<>();
		r.put("instante", instante);

		Configuracao casa = Configuracao.ler();
		if (casa == null) {
			r.put("casa", null);
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

		PosicaoDoSol sol = PosicaoDoSol.em(instante);
		Map<String, Object> s = new LinkedHashMap<>();
		s.put("altura", sol.altura(lat, lon));
		s.put("azimute", sol.azimute(lat, lon));
		r.put("sol", s);

		PosicaoDaLua posicao = PosicaoDaLua.em(instante);
		double fracao = Lua.fracaoDoCiclo(instante);
		Map<String, Object> l = new LinkedHashMap<>();
		l.put("altura", Horizonte.altura(posicao.getAscensaoReta(), posicao.getDeclinacao(), lat, tempoSideral));
		l.put("azimute", Horizonte.azimute(posicao.getAscensaoReta(), posicao.getDeclinacao(), lat, tempoSideral));
		l.put("fracaoDoCiclo", fracao);
		l.put("nome", Lua.nomeDaFase(fracao));
		l.put("iluminacao", Lua.iluminacao(fracao));
		r.put("lua", l);

		List<Map<String, Object>> planetas = new ArrayList<>();
		for (Planetas.Planeta planeta : Planetas.em(instante)) {
			Map<String, Object> m = new LinkedHashMap<>();
			m.put("nome", planeta.nome());
			m.put("ascensaoReta", planeta.ascensaoReta());
			m.put("declinacao", planeta.declinacao());
			m.put("altura", Horizonte.altura(planeta.ascensaoReta(), planeta.declinacao(), lat, tempoSideral));
			m.put("azimute", Horizonte.azimute(planeta.ascensaoReta(), planeta.declinacao(), lat, tempoSideral));
			m.put("magnitude", planeta.magnitude());
			m.put("distanciaEmUA", planeta.distanciaEmUA());
			planetas.add(m);
		}
		r.put("planetas", planetas);
		return r;
	}

	private static double arredondar(double v) {
		return Math.round(v * 10_000d) / 10_000d;
	}
}
