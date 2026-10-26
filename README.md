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
