-- Cómo trabaja cada manicurista y ventas por comisión.
-- En una venta por comisión, `monto` es SOLO la parte de la manicurista
-- (lo que cuenta como su ingreso); `precio_cliente` y `comision_pct`
-- guardan lo que pagó la clienta y el % aplicado, para mostrarlo.
alter table public.profiles
  add column if not exists modalidad text check (modalidad in ('independiente', 'comision', 'arriendo', 'otro')),
  add column if not exists comision_pct numeric(5, 2) check (comision_pct > 0 and comision_pct <= 100),
  add column if not exists materiales_salon boolean not null default false;

alter table public.fin_movements
  add column if not exists precio_cliente numeric(14, 2) check (precio_cliente > 0),
  add column if not exists comision_pct numeric(5, 2) check (comision_pct > 0 and comision_pct <= 100);
