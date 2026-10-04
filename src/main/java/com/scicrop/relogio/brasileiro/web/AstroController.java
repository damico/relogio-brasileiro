package com.scicrop.relogio.brasileiro.web;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.scicrop.relogio.brasileiro.Lua;
import com.scicrop.relogio.brasileiro.PosicaoDaLua;
import com.scicrop.relogio.brasileiro.PosicaoDoSol;

/**
 * Primeiro pedaco da API: onde o Sol e a Lua estao num instante. O instante e
 * parametro (padrao: agora), porque quem manda na hora e o cliente, nao o
 * servidor.
 *
 */
@RestController
@RequestMapping("/api")
public class AstroController
{
	@GetMapping("/sol")
	public Map<String, Object> sol(@RequestParam(required = false) Instant t) {
		Instant instante = t != null ? t : Instant.now();
		PosicaoDoSol sol = PosicaoDoSol.em(instante);
		Map<String, Object> r = new LinkedHashMap<>();
		r.put("instante", instante);
		r.put("latitudeSubsolar", sol.getLatitude());
		r.put("longitudeSubsolar", sol.getLongitude());
		return r;
	}

	@GetMapping("/lua")
	public Map<String, Object> lua(@RequestParam(required = false) Instant t) {
		Instant instante = t != null ? t : Instant.now();
		PosicaoDaLua lua = PosicaoDaLua.em(instante);
		Map<String, Object> r = new LinkedHashMap<>();
		r.put("instante", instante);
		r.put("ascensaoReta", lua.getAscensaoReta());
		r.put("declinacao", lua.getDeclinacao());
		return r;
	}

	/**
	 * Fase da Lua. As datas das proximas fases vao como "daqui a N dias" e nao
	 * como data, porque o fuso de quem olha e do cliente.
	 */
	@GetMapping("/lua/fase")
	public Map<String, Object> fase(@RequestParam(required = false) Instant t) {
		Instant instante = t != null ? t : Instant.now();
		double fracao = Lua.fracaoDoCiclo(instante);
		Map<String, Object> r = new LinkedHashMap<>();
		r.put("instante", instante);
		r.put("fracaoDoCiclo", fracao);
		r.put("nome", Lua.nomeDaFase(fracao));
		r.put("iluminacao", Lua.iluminacao(fracao));
		r.put("idadeEmDias", Lua.idadeEmDias(fracao));
		r.put("diasParaALuaNova", Lua.diasAte(fracao, 0));
		r.put("diasParaALuaCheia", Lua.diasAte(fracao, 0.5));
		return r;
	}
}
