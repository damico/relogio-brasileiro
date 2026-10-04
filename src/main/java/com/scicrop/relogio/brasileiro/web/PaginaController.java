package com.scicrop.relogio.brasileiro.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** As paginas sao templates Thymeleaf em src/main/resources/templates. */
@Controller
public class PaginaController
{
	@GetMapping("/")
	public String index() {
		return "index";
	}
}
