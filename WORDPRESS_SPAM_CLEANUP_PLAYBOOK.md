# WordPress MCP + Cursor: caso práctico — limpieza de enlaces spam

**Qué es esto:** un **caso de estudio documentado** que puedes **reutilizar tal cual** en **otro dominio o proyecto similar** (mismo patrón de ataque: enlaces inyectados, constructor tipo Elementor, caché). No sustituye auditoría legal ni forense; sí te da un **orden de trabajo** y scripts listos.

Guía en español para detectar, mapear y eliminar enlaces inyectados (típicamente apuestas u ofertas no deseadas) en WordPress, incluyendo páginas construidas con Elementor. **No incluye dominios reales del caso original:** tú pones **tu** URL y credenciales en `.env` (ver `.env.example`).

## Para quién es esta guía

- **Negocio / marketing / contenido:** entender qué fue el incidente, el riesgo para la marca y el SEO, y el orden de magnitud del trabajo sin leer código.
- **SEO (perfil menos técnico):** seguir el relato, la tabla de alcance y el flujo; el glosario corto está en los apartados iniciales.
- **SEO técnico / desarrollo:** mismos contenidos más adelante con detalle de API, Elementor, scripts y MCP.

## En pocas palabras (qué pasó y cómo se cerró)

1. En el sitio aparecieron **enlaces externos no deseados** mezclados con páginas normales (inicio y landings), a menudo **escondidos** en el código para que sigan existiendo ante buscadores.
2. Parte del problema vivía en **Elementor** (datos del maquetador), no solo en el editor de texto clásico.
3. Se revisó **toda la superficie relevante** (portada, entradas, páginas, y donde aplicara los datos del maquetador) y se corrigió en **varias rondas**, comprobando después de cada una.
4. Se retiraron **más de 2000** apariciones de URLs/enlaces infectados, **sin arrasar el contenido bueno** porque el sitio **ya tenía posiciones** en Google: solo se eliminó lo identificado como spam y bloques “invisibles” típicos de este fraude.
5. Al final, los **chequeos automáticos** dejaron de marcar problemas y se **purgó caché** para alinear lo que ve el usuario con lo guardado en WordPress.

Lo que sigue baja al detalle: primero el relato del ataque, luego hallazgos, cifras y pasos concretos.

### Glosario rápido (si no vienes del mundo técnico)

| Término | Significado breve |
|--------|---------------------|
| **WordPress** | El sistema con el que está hecha la web (CMS). |
| **Enlace / URL** | La dirección a la que lleva un clic; aquí, muchas eran de sitios maliciosos insertados sin permiso. |
| **SEO spam** | Truco para colar enlaces en una web ajena y manipular buscadores o tráfico. |
| **Elementor** | Maquetador visual: el “diseño” de muchas páginas vive en datos extra, no solo en el párrafo que editas. |
| **API / REST** | Canal oficial para que programas lean o actualicen contenido en WordPress sin usar el ratón en el panel. |
| **Caché** | Copia guardada de la página; si no se vacía, puedes seguir viendo la versión “vieja” aunque ya esté limpia por dentro. |
| **MCP (en Cursor)** | Conexión para que el asistente use herramientas (en este repo, listar o editar posts en WordPress). |

---

## Resumen del caso de ataque (incidente tipo hack / SEO spam)

**Tipo de amenaza:** inyección de contenido malicioso orientada a **SEO negativo o spam de enlaces**. No implica necesariamente control total del servidor (shell), pero sí **alteración persistente** de páginas en WordPress.

**Vector habitual (hipótesis de trabajo):** credenciales filtradas, plugin o tema desactualizado, acceso de un colaborador comprometido, o alojamiento compartido con otro sitio vulnerable. El atacante suele usar el **panel o la API** para insertar HTML en páginas ya publicadas.

**Modus operandi:** enlaces hacia sitios de terceros (apuestas, afiliación, etc.) **camuflados** dentro del contenido real —a veces en listas o pies de bloque— y con técnicas de **ocultación visual** (por ejemplo `div` con posición fuera de pantalla o altura mínima) para que el enlace siga existiendo en el HTML que indexan los buscadores.

**Impacto:** daño a la **reputación** del sitio, riesgo de **sanciones algorítmicas**, tiempo de respuesta del equipo y, si no se audita a fondo, **reincidencia** si queda backdoor o credenciales sin rotar.

**Respuesta recomendada (alto nivel):** respaldo antes de cambios, inventario de páginas afectadas, limpieza de `post_content` y de meta de constructores (p. ej. Elementor), **purgado de caché**, rotación de contraseñas y contraseñas de aplicación, revisión de usuarios y plugins, y **validación** repetida del HTML público hasta que no queden patrones del incidente.

**Qué aporta este repo:** un **MCP** que habla con WordPress por REST y **scripts** para escanear y limpiar de forma repetible; sirve para documentar el caso y compartir el método, no sustituye forense completo ni hardening del hosting.

---

## Hallazgos técnicos (qué se vio en el sitio)

En un **sitio WordPress de un cliente** aparecieron **enlaces externos no deseados** mezclados con contenido legítimo:

- **Dónde:** principalmente en la **página de inicio** y en **landings** con listados de servicios o ubicaciones; el spam solía colarse **entre ítems de listas** (`<ul>` / `<li>`).
- **Qué tipo de enlaces:** dominios de **apuestas, casinos o afiliación** (patrones repetidos en campañas de SEO negativo).
- **Técnica habitual:** un **`<div>` oculto** con estilos tipo `overflow:hidden`, `height:1px`, `position:absolute` y `left:-NNNNpx` (**cloaking**), con un `<a href="…">` hacia sitios externos.
- **Por qué no bastaba solo el editor clásico:**
  - Mucho contenido provenía de **Elementor**, almacenado en la meta **`_elementor_data`** (JSON), no solo en el campo de contenido del post.
  - A veces el **HTML público** seguía mostrando basura mientras la **REST API** no reflejaba las mismas cadenas en meta (o al revés): **divergencia** por caché, datos en base de datos o regeneración de Elementor.
- **Resultado tras el flujo:** escaneo sin entradas en listas de sospechosos (`homepage_suspicious`, páginas y entradas vacías) y comprobación manual/HTML sin marcadores del incidente, tras purgar caché y actualizar contenido o meta según corresponda.

Los scripts de este repo automatizan el diagnóstico y la limpieza **donde la API lo permita**. No sustituyen revisar el servidor, plugins ni la base de datos si hay persistencia o inyección a nivel de tema/plugin.

Las heurísticas de detección en código incluyen patrones típicos de spam; si tu política es no versionar listas concretas, mantenlas en un archivo local ignorado o simplifica las expresiones regulares.

---

## Detalle del análisis y volumen hallado (incidente de referencia)

Cifras y alcance **aproximados** del caso que originó este playbook (sin citar dominios ni URLs del cliente). Sirven como orden de magnitud para otros equipos.

### Qué se analizó (superficie)

| Ámbito | Método | Cobertura |
|--------|--------|-----------|
| Portada | `GET` del HTML público + extracción de `href` | Un documento completo por ejecución; se usó *cache-busting* (`?cb=…`) en validaciones finales. |
| Entradas | REST `GET /wp-json/wp/v2/posts` paginado (`per_page=100`) | Todas las entradas accesibles con la app password (incluye estados que el script solicite, p. ej. publicadas y borrador). |
| Páginas | REST `GET /wp-json/wp/v2/pages` paginado | Todas las páginas del listado (típicamente decenas en sitios medianos). |
| Elementor | Lectura de `meta._elementor_data` vía REST (`context=edit`) | Solo páginas cuyo JSON contenía patrones de spam configurados en el script. |
| Divergencia | Comparación HTML público vs. meta / `raw` | Portada y, con scripts auxiliares, página estática de inicio vía `page_on_front`. |

**Iteraciones:** varias pasadas de `scan-malicious-links.mjs` (antes y después de limpiar), más ejecuciones de scripts de remediación y comprobaciones puntuales con `fetch` en Node.

### Limpieza a escala y cuidado con el SEO existente

En el incidente de referencia se llegó a **eliminar más de 2000 enlaces o referencias a URLs infectadas** (apariciones de `href` maliciosos y bloques asociados) repartidas en el sitio. El blog **ya tenía páginas posicionadas**; por eso el criterio fue **quirúrgico**, no un borrado masivo a ciegas:

- **Lista blanca del dominio propio** (`WP_SITE_HOST` / enlaces internos legítimos) para no tratar como spam las URLs del propio sitio.
- **Quitar solo** anclas y `div` de cloaking que coincidían con heurísticas de spam, **manteniendo** texto y estructura editorial útiles para SEO.
- **Pasadas acotadas** (contenido → Elementor → HTML renderizado) con **reescaneo** tras cada fase para no dejar el sitio a medias.
- **Purgado de caché** al final para alinear HTML público con lo guardado.

Así se redujo el riesgo de **perder rankings** por cambios innecesarios en contenido que ya rankeaba.

### Qué se encontró y en qué cantidad (orden de magnitud)

- **Escala global del incidente:** **>2000** instancias de URLs/enlaces infectados abordadas en conjunto (incluye repeticiones en varias plantillas y landings), además de lo detallado abajo por pasada.
- **Primer escaneo:** la portada acumuló **muchas decenas** de `href` externos; una parte eran **sospechosos** según heurística (apuestas/casino/afiliación); el resto, enlaces legítimos (redes, fuentes, etc.) que el informe también lista como “externos”.
- **Contenido REST:** varias **páginas** (landings de ubicación/servicio + **inicio**) aparecieron en `pages_with_spam_links` con múltiples URLs maliciosas cada una en el HTML renderizado del post.
- **Limpieza en contenido de página:** en una pasada típica sobre el listado completo de páginas, del orden de **~10 páginas** recibieron parches; en la **portada** el script contó del orden de **~25–35** elementos quitados (anclas spam + `div` de cloaking) en la pasada más intensa.
- **Elementor (`_elementor_data`):** del orden de **~9 páginas** tuvieron JSON reescrito; en las más afectadas, **decenas** de bloques de texto/HTML dentro del JSON fueron saneados por pasada.
- **HTML renderizado vs. `post_content` guardado:** otra pasada tocó del orden de **~8 páginas** donde el spam seguía visible en `content.rendered` pese a que el `raw` ya no mostraba las mismas cadenas (síntoma de constructor + caché o doble fuente de verdad).
- **Cierre:** escaneo final con **`homepage_suspicious` vacío**, **`posts_with_spam_links` y `pages_with_spam_links` vacíos**, y pruebas directas sobre el HTML de la portada sin subcadenas de validación del incidente.

### Lo que este análisis no cubre por sí solo

- Menús, widgets, pie/cabecera del tema, ni archivos PHP/tema hackeados “a pelo”.
- Búsqueda en base de datos SQL ni en logs del servidor (recomendable en incidentes persistentes).
- Tiempos: un escaneo completo puede llevar **desde decenas de segundos hasta varios minutos** según número de posts, latencia y límites del hosting.

---

## 1) Objetivo

- Detectar enlaces sospechosos en el **HTML público** de la portada y en **entradas/páginas** vía REST.
- Eliminarlos de forma controlada y **volver a validar** hasta confirmar que el sitio está limpio.

---

## 2) Requisitos

- Node.js 18+.
- Contraseña de aplicación de WordPress con permisos de edición.
- `.env` (no subirlo a Git):

```env
WP_BASE_URL=https://tu-sitio.com
WP_USERNAME=tu-usuario-wp
WP_APP_PASSWORD=tu-contraseña-de-aplicacion
# Opcional: host de tu sitio para no marcar tus propios enlaces como spam
WP_SITE_HOST=tu-sitio.com
```

Instalación:

```bash
npm install
npm install cheerio
```

---

## 3) Scripts incluidos

| Script | Función |
|--------|---------|
| `scan-malicious-links.mjs` | Escanea la home + entradas/páginas y lista `href` externos sospechosos. |
| `strip-spam-links-pages.mjs` | Quita anclas spam y bloques cloaking típicos del contenido de páginas. |
| `elementor-strip-spam.mjs` | Limpia patrones spam dentro del JSON de Elementor (`_elementor_data`). |
| `strip-rendered-to-post-content.mjs` | Limpia a partir del HTML renderizado y actualiza el contenido del post. |
| `detect-elementor-rest-divergence.mjs` | Compara home pública con meta Elementor vía REST (IDs de página vía API de ajustes). |

---

## 4) Flujo paso a paso

### Paso A — Línea base (mapear el problema)

```bash
node scan-malicious-links.mjs
```

Revisa en la salida JSON:

- `homepage_suspicious`
- `posts_with_spam_links`
- `pages_with_spam_links`

### Paso B — Primera pasada sobre páginas

```bash
node strip-spam-links-pages.mjs
```

Quita enlaces que coincidan con las heurísticas del script y `div` de cloaking habituales.

### Paso C — Meta de Elementor

Si la portada o páginas Elementor siguen mostrando spam:

```bash
node elementor-strip-spam.mjs
```

### Paso D — Respaldo: HTML renderizado

```bash
node strip-rendered-to-post-content.mjs
```

Útil cuando el renderizado aún incluye bloques que no ves en `raw`.

### Paso E — Validar de nuevo

```bash
node scan-malicious-links.mjs
```

Comprobación opcional en la home (sustituye `TU_MARCADOR` por una cadena **no sensible** que hayas visto solo en el spam de tu caso, o usa una palabra genérica como `casino` con cuidado de falsos positivos):

```bash
node --input-type=module -e "import 'dotenv/config'; const BASE=(process.env.WP_BASE_URL||'').replace(/\/$/,''); const M=process.env.SPAM_PROBE||'casino'; const r=await fetch(BASE+'/?cb='+Date.now(), {headers:{'Cache-Control':'no-cache'}}); const t=await r.text(); console.log('probe', M, ':', t.toLowerCase().includes(M.toLowerCase()));"
```

Estado limpio esperado:

- `homepage_suspicious: []`
- `posts_with_spam_links: []`
- `pages_with_spam_links: []`

---

## 5) Si el spam sigue visible

```bash
node detect-elementor-rest-divergence.mjs
```

Opcional en `.env`, subcadenas separadas por comas para comparar home vs meta (por defecto se usan comprobaciones genéricas):

```env
SPAM_PROBE_SUBSTRINGS=casino,left:-9999
```

Si la home está infectada pero la meta REST parece limpia:

1. Purgar caché (plugin, servidor, CDN, object cache).
2. Regenerar datos/archivos de Elementor.
3. Buscar en base de datos cadenas que hayas identificado en tu incidente (sin publicarlas en el repo).
4. Auditar plugins, `mu-plugins` y el tema.

---

## 6) Seguridad y publicación

- No commitear `.env`.
- No publicar credenciales ni tokens.
- No pegar dominios reales del cliente en issues ni en documentación pública.

```gitignore
.env
node_modules/
```

---

## 7) Estructura sugerida del repositorio

- `README.md` — MCP, resumen del caso y cómo replicar en otro dominio.
- `QUICKSTART.md` — **una página**: instalación, tabla de comandos, enlaces al resto.
- `.env.example` — plantilla de variables (copiar a `.env`, no subir `.env`).
- `WORDPRESS_SPAM_CLEANUP_PLAYBOOK.md` — caso de estudio + flujo detallado.
- Scripts `*.mjs` — escaneo, remediación y validación.

---

## 8. Plantilla: replicar este flujo en tu propio dominio

Este playbook documenta un **caso real**, pero el repo está pensado como **kit reutilizable**: mismo procedimiento para cualquier WordPress afectado por un patrón parecido (enlaces inyectados, SEO spam, Elementor).

### Checklist antes de tocar nada

- [ ] **Node.js 18+** instalado (`node -v`).
- [ ] **Copia de seguridad** del sitio (archivos + base de datos) o snapshot del hosting.
- [ ] En WordPress: **REST API** accesible (sin bloqueo por firewall/plugin agresivo).
- [ ] Usuario con permisos para **editar entradas y páginas** (y meta si el hosting lo permite vía REST).
- [ ] **Contraseña de aplicación** creada en *Usuarios → Tu perfil → Contraseñas de aplicación* (no uses la contraseña de acceso normal en scripts).

### Puesta en marcha en tu máquina

1. `git clone …` y `cd` al proyecto.
2. `npm install`
3. `npm install cheerio` (necesario para los scripts de limpieza HTML).
4. Copia `.env.example` a `.env`.
5. Rellena al menos:
   - `WP_BASE_URL` = `https://tu-dominio.com` (sin `/` final).
   - `WP_USERNAME` / `WP_APP_PASSWORD`.
   - `WP_SITE_HOST` = el host que usas en tus URLs propias (ej. `tu-dominio.com`), para la lista blanca en scripts.

### Orden recomendado (igual que el caso de estudio)

| Orden | Comando | Qué hace |
|------|---------|----------|
| 1 | `node scan-malicious-links.mjs` | Solo lectura: mapa de enlaces sospechosos en home + posts + páginas. |
| 2 | `node strip-spam-links-pages.mjs` | Escribe: limpia contenido de páginas según heurísticas. |
| 3 | `node elementor-strip-spam.mjs` | Escribe: limpia JSON de Elementor si aplica. |
| 4 | `node strip-rendered-to-post-content.mjs` | Escribe: corrige cuando el HTML público y el guardado no coinciden. |
| 5 | `node scan-malicious-links.mjs` | Valida de nuevo. |
| 6 | Purgar **caché** (plugin, servidor, CDN) | Alinea la web pública con lo guardado. |

Entre pasos 2–4, puedes repetir el escaneo si quieres ver la reducción progresiva.

### Ajustar a **tu** tipo de spam

Los scripts incluyen patrones orientados a **apuestas / casino / afiliación**. Si tu incidente es otro (farmacias, adultos, phishing, etc.):

- Amplía las expresiones en `isSpamHref()` dentro de los `.mjs` de limpieza, **o**
- Mantén una lista local (archivo ignorado por Git) y carga patrones desde ahí si prefieres no versionarlos.

Así el mismo flujo sirve para **proyectos similares** sin ceñirse al caso original.

### Limitaciones y avisos

- Algunos hostings **no permiten** actualizar `meta._elementor_data` vía REST: entonces habrá que editar en Elementor o en base de datos a mano.
- Los scripts **no limpian menús, widgets ni tema**: revisa aparte si el spam aparece ahí.
- Tras limpiar, **rota contraseñas** y revisa usuarios/plugins si sospechas de acceso indebido.

### Cómo saber que “tu dominio” quedó bien

- `homepage_suspicious`, `posts_with_spam_links` y `pages_with_spam_links` **vacíos** en la salida de `scan-malicious-links.mjs`.
- Vista manual de la portada y de las páginas que antes fallaban.
- Sin rastro de tus marcadores de prueba (`SPAM_PROBE`, etc.) en el HTML público.

Con esto, cualquier persona que baje el repo puede **optimizar o repetir el procedimiento** en un dominio concreto siguiendo la misma lógica del caso de estudio.
