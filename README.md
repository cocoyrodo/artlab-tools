# ART LAB Tools

Herramientas digitales para la comunidad ART LAB — **https://tools.artcocoyrodo.com**

| Ruta | Herramienta | Estado |
|---|---|---|
| `/` | Portal de herramientas | Activa |
| `/finanzas/` | Control financiero | Activa |
| `/organizador/` | Organizador | Pronto |
| `/calculadora/` | Calculadora de precios | Pronto |
| `/contenido/` | Planificador de contenido | Pronto |

## Arquitectura

- **Frontend:** HTML/CSS/JS estático, sin build. Cada herramienta vive en su carpeta.
- **Publicación:** GitHub Pages con el workflow `.github/workflows/pages.yml` (cada push a `main`).
- **Backend:** Supabase, proyecto `psljtvkwhenjvbinrowk` (`artlab-tools`).
  - Auth con correo y contraseña. Una cuenta sirve para todas las herramientas.
  - Postgres con Row Level Security: cada usuaria solo ve sus propias filas.
- `assets/auth.js` — cliente Supabase y login compartidos.
- `assets/config.js` — URL y clave **publishable** (pública). Nunca la `service_role`.
- `supabase/migrations/` — esquema de la base de datos.

## Datos y privacidad

Este repositorio es público. **Nunca** guardar aquí datos de alumnas, claves
secretas, la `service_role` key ni contraseñas. Los datos viven solo en Supabase.

## Reglas del control financiero

- **Venta**: lo vendido. Cuenta en el mes de su fecha, esté cobrada o no.
- **Cobro**: no es un movimiento nuevo, es una venta marcada como pagada.
- **Costo**: material directo de un servicio. **Gasto**: gasto del negocio.
- **Ganancia estimada** = ventas − costos − gastos del mes.
- **Caja del mes** = cobrado − pagado según la fecha real de pago.
- **Comisión** (manicurista en salón): `monto` es solo su parte; `precio_cliente` y
  `comision_pct` guardan lo que pagó la clienta y el %. Lo de la clienta se muestra
  como "Clientas pagaron", nunca como ingreso propio. Las propinas son 100% suyas.
- La forma de trabajo (`profiles.modalidad`: independiente, comision, arriendo, otro)
  se pregunta al entrar por primera vez a Finanzas y se cambia en "Tus datos".

Pruebas: `node tests/calc.test.mjs`

## Agregar una herramienta nueva

1. Crear la carpeta `nombre/` con su `index.html`.
2. Importar `withSession` desde `/assets/auth.js`.
3. Crear sus tablas en una migración nueva, con RLS por `user_id`.
4. Agregar la carpeta al paso "Armar sitio" del workflow y la tarjeta en `index.html`.

## Reglas de contenido y publicación

- **Nunca usar "gratis", "gratuito" ni "regalo"** en textos, correos o descripciones.
  Las herramientas son trabajo de valor de ART LAB, independiente de su precio.
- **Versión de archivos:** cada CSS/JS se carga con `?v=AAAAMMDDx`. Al cambiar
  cualquier archivo, subir el mismo valor en **todas** las referencias
  (`index.html`, `finanzas/index.html`, `finanzas/app.js`, `assets/shell.js`,
  `assets/auth.js`). `auth.js` debe importarse siempre con la misma URL para no
  crear dos clientes de Supabase.

## Idiomas y traducciones

Seis idiomas, como la App ART LAB: ES (original), EN, FR, IT, PT y NL, con el
mismo selector y la misma preferencia (`artlab_language`). De dónde sale cada
traducción, en orden:

1. **`assets/i18n-dict.js`**: traducciones revisadas a mano, incluidas en el
   sitio. Funcionan al instante y también en el ingreso, sin sesión.
2. **Memoria del dispositivo** (`localStorage`) con lo ya traído antes.
3. **Edge Function `translate`** (Supabase): busca en la tabla
   `translation_cache` y, si el texto es nuevo, lo traduce con **Google Cloud
   Translation API** (igual que la App) y lo guarda ahí. Cada texto se paga una
   sola vez. Requiere sesión, para que nadie ajeno gaste la cuota.

`translation_cache.origen` = `manual` (cargadas desde i18n-dict.js) o `google`.
La clave de Google es el secreto `ARTLAB_GOOGLE_TRANSLATE_API_KEY` del proyecto
Supabase (mismo nombre que en la App); nunca va en este repositorio.

**Texto nuevo en el código:** se escribe en español dentro de `t("…")`. Se
traducirá solo con Google la primera vez que alguien lo vea. Para revisarlo a
mano, agregarlo también a `i18n-dict.js` (`node tests/i18n.test.mjs` avisa los
que faltan; la publicación exige que el diccionario esté completo).
