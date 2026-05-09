# Inicio rápido (una página)

Todo lo necesario para **replicar el caso de estudio en tu dominio**. Para el relato completo, glosario y matices: [WORDPRESS_SPAM_CLEANUP_PLAYBOOK.md](WORDPRESS_SPAM_CLEANUP_PLAYBOOK.md). Para el MCP en Cursor: [README.md](README.md).

---

## 1. Requisitos

- Node.js **18+**
- WordPress con **REST API** usable y usuario con permiso de edición
- **Contraseña de aplicación** (Perfil de usuario → Contraseñas de aplicación)
- **Backup** del sitio antes de ejecutar scripts que escriben en páginas

## 2. Instalación

```bash
git clone https://github.com/Devpwilmer/caso-estudio-wordpress-mcp-cursor.git
cd caso-estudio-wordpress-mcp-cursor
npm install
npm install cheerio
cp .env.example .env
```

Edita `.env`: `WP_BASE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD`, y **muy recomendado** `WP_SITE_HOST` (tu dominio sin `https://`).

## 3. Solo MCP (Cursor)

En la config MCP, apunta `args` al `index.js` de **tu** clon y pasa las mismas variables `WP_*` que en `.env`. Arranque: `npm start`. Herramientas: `list_posts`, `create_post`, `delete_post`.

## 4. Limpieza de spam (orden fijo)

| Paso | Comando | Escribe en WP |
|------|---------|---------------|
| 1 | `node scan-malicious-links.mjs` | No |
| 2 | `node strip-spam-links-pages.mjs` | Sí |
| 3 | `node elementor-strip-spam.mjs` | Sí |
| 4 | `node strip-rendered-to-post-content.mjs` | Sí |
| 5 | `node scan-malicious-links.mjs` | No |
| 6 | Purgar caché en hosting / CDN | — |

**Listo cuando:** en el JSON del paso 5, `homepage_suspicious`, `posts_with_spam_links` y `pages_with_spam_links` van **vacíos** (y revisas la web a ojo).

## 5. Si algo sigue raro

```bash
node detect-elementor-rest-divergence.mjs
```

Opcional en `.env`: `SPAM_PROBE_SUBSTRINGS=...`, `WP_FRONT_PAGE_ID=...` (ver comentarios en `.env.example`).

## 6. Ajustar a tu tipo de spam

Si no es el patrón “casino/apuestas”, edita las reglas en `isSpamHref()` dentro de los scripts `strip-*.mjs` y `elementor-strip-spam.mjs`, o mantén patrones en un archivo local no versionado.

## 7. No subas secretos

`.env` debe estar solo en tu máquina (ya está en `.gitignore`).

---

**Checklist ampliada** (WordPress, limitaciones, personalizar patrones): [playbook §8](WORDPRESS_SPAM_CLEANUP_PLAYBOOK.md#8-plantilla-replicar-este-flujo-en-tu-propio-dominio).
