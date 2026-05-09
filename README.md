# Caso de estudio: WordPress + MCP + Cursor (inyección / SEO spam)

**Repositorio enfocado en el caso:** playbook en español, scripts Node para escanear y limpiar, y el servidor **MCP** incluido para quien quiera un solo clon.

**Repositorio hermano (solo conector MCP):** [github.com/Devpwilmer/wordpress-mcp-cursor](https://github.com/Devpwilmer/wordpress-mcp-cursor)

---

El **MCP** expone herramientas contra la **REST API de WordPress** (`list_posts`, `create_post`, `delete_post`). El **caso de estudio** está en [WORDPRESS_SPAM_CLEANUP_PLAYBOOK.md](WORDPRESS_SPAM_CLEANUP_PLAYBOOK.md) (limpieza de contenido inyectado); los scripts de limpieza se ejecutan con Node aparte de `npm start`.

**¿Primera vez?** Abre **[QUICKSTART.md](QUICKSTART.md)** (una página: instalación, `.env`, orden de comandos, MCP).

Cualquiera que clone el repo puede **aplicar el mismo método a su propio dominio**: configuración mínima en `.env`, escaneo sin escribir nada, y luego limpieza por fases con validación (ver [§8 al final del playbook](WORDPRESS_SPAM_CLEANUP_PLAYBOOK.md#8-plantilla-replicar-este-flujo-en-tu-propio-dominio)).

## Replicar en tu dominio (resumen)

1. Clona el repositorio e instala: `npm install` y, para los scripts, `npm install cheerio`.
2. Copia `.env.example` a `.env` y completa `WP_BASE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD` (contraseña de aplicación desde el perfil de WordPress).
3. Añade `WP_SITE_HOST` con el host de **tu** web (sin `https://`) para que la limpieza no confunda tus enlaces internos con spam.
4. Haz **copia de seguridad** del sitio antes de ejecutar scripts que modifican páginas.
5. Ejecuta en orden: `node scan-malicious-links.mjs` → revisa el informe → scripts de limpieza del playbook → vuelve a escanear → purga caché en el hosting.

Detalle, comprobaciones de WordPress y solución de problemas: [playbook, sección 8](WORDPRESS_SPAM_CLEANUP_PLAYBOOK.md#8-plantilla-replicar-este-flujo-en-tu-propio-dominio).

## Ruta del proyecto

Clona este repositorio en la carpeta que prefieras. En la configuración de Cursor debes usar la **ruta absoluta** a `index.js` en tu máquina (sustituye por tu ruta real).

Ejemplo genérico:

`/ruta/donde/clonaste/este-repositorio`

## Ejecución local

```bash
npm start
```

## Fragmento de configuración MCP en Cursor

```json
{
  "mcpServers": {
    "wordpress": {
      "command": "node",
      "args": ["/ruta/donde/clonaste/este-repositorio/index.js"],
      "env": {
        "WP_BASE_URL": "https://your-site.com",
        "WP_USERNAME": "your-wp-user",
        "WP_APP_PASSWORD": "your-app-password"
      }
    }
  }
}
```

Variables recomendadas están documentadas en [`.env.example`](.env.example). Mínimo para MCP: `WP_BASE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD`. Para limpieza segura en **tu** dominio, añade `WP_SITE_HOST`.

## Herramientas disponibles

- `list_posts` (opcional `per_page`)
- `create_post` (`title`, `content`, opcional `status`)
- `delete_post` (`id`, opcional `force`)

## Caso práctico (español)

Está pensado **no solo para perfiles muy técnicos**: sirve para **marketing, contenido, negocio y SEO** que necesiten entender *qué pasó*, *a qué escala* y *cómo se resolvió* sin entrar en código hasta que quieran.

**Documento principal:** [`WORDPRESS_SPAM_CLEANUP_PLAYBOOK.md`](WORDPRESS_SPAM_CLEANUP_PLAYBOOK.md). Ahí encontrarás, en orden:

1. **Qué ocurrió** — explicación del ataque en lenguaje claro (sin nombrar dominios del caso).
2. **Qué se vio en el sitio** — dónde aparecía el problema y por qué a veces no se veía en el editor.
3. **Cuánto se analizó y corrigió** — tabla de alcance (qué partes del sitio se revisaron) y **órdenes de magnitud** (páginas tocadas, miles de enlaces maliciosos, pasadas de limpieza).
4. **Cómo se hizo paso a paso** — checklist con scripts y Cursor + MCP para quien vaya a ejecutarlo.
5. **Detalle técnico** — apartados para desarrolladores o SEO técnico (API, Elementor, caché).

---

### Resumen del caso (lenguaje sencillo)

- Alguien **coló enlaces no deseados** (típicamente apuestas u otros sitios de terceros) dentro de páginas públicas de WordPress; es un patrón conocido de **manipulación de enlaces** para perjudicar o lucrar a costa del sitio.
- Esos enlaces estaban **mezclados con el contenido bueno** del sitio; a veces **casi invisibles** para el visitante pero **presentes en el código** de la página (lo que ven Google y herramientas).
- En muchas páginas el diseño estaba hecho con **Elementor** (maquetador): parte del “ensucio” vivía en datos internos del maquetador, no solo en el texto que ves al editar.
- Se **eliminaron más de 2000 enlaces o apariciones de URLs maliciosas**, con **mucho cuidado** porque el blog **ya rankeaba**: no se tocó el contenido legítimo; solo se quitaron enlaces y bloques ocultos identificados como spam, y se **comprobó** el resultado **por fases**.
- La limpieza se hizo **desde herramientas conectadas a WordPress** (contenido + datos del maquetador), se **volvió a escanear** todo hasta dejar de detectar problemas y se **limpió la caché** para que la web pública mostrara la versión sana.
- **Cierre:** el sitio quedó **validado** (sin señales del incidente en los chequeos automáticos) y quedó **documentado el método** para repetirlo si hiciera falta.
