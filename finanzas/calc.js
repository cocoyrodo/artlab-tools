// Cálculos financieros puros (sin DOM ni red) para poder probarlos.
//
// Reglas:
// - venta: lo que vendiste. Cuenta en el mes de su fecha, cobrada o no.
// - costo: material/insumo directo. gasto: gasto del negocio.
// - Un cobro NO es un ingreso nuevo: es una venta que pasa a "pagado".
// - Venta por comisión: `monto` es solo la parte de la manicurista (su ingreso).
//   Lo que pagó la clienta (`precio_cliente`) se informa como "facturado",
//   pero nunca se suma como ingreso propio.
// - Ganancia estimada del mes = ventas − costos − gastos (por fecha del movimiento).
// - Caja del mes = lo efectivamente cobrado − lo efectivamente pagado, según la
//   fecha en que se pagó (fecha_pago, o la fecha del movimiento si se pagó al momento).

export const mesDe = (fecha) => String(fecha).slice(0, 7); // "2026-10"

export const fechaPago = (m) => (m.estado === "pagado" ? m.fecha_pago || m.fecha : null);

const suma = (arr) => Math.round(arr.reduce((t, m) => t + Number(m.monto), 0) * 100) / 100;

export function resumenMes(movs, mes) {
  const delMes = movs.filter((m) => mesDe(m.fecha) === mes);
  const ventasMes = delMes.filter((m) => m.tipo === "venta");
  const ventas = suma(ventasMes);
  const facturado = Math.round(ventasMes.reduce((t, m) => t + Number(m.precio_cliente ?? m.monto), 0) * 100) / 100;
  const costos = suma(delMes.filter((m) => m.tipo === "costo"));
  const gastos = suma(delMes.filter((m) => m.tipo === "gasto"));

  const pagadosEnMes = movs.filter((m) => fechaPago(m) && mesDe(fechaPago(m)) === mes);
  const cobrado = suma(pagadosEnMes.filter((m) => m.tipo === "venta"));
  const pagado = suma(pagadosEnMes.filter((m) => m.tipo !== "venta"));

  return {
    ventas, costos, gastos, facturado,
    ganancia: Math.round((ventas - costos - gastos) * 100) / 100,
    margen: ventas > 0 ? (ventas - costos - gastos) / ventas : null,
    cobrado, pagado,
    caja: Math.round((cobrado - pagado) * 100) / 100,
  };
}

// Pendientes de todos los meses (no solo el actual)
export function pendientes(movs) {
  const p = movs.filter((m) => m.estado === "pendiente");
  return {
    porCobrar: suma(p.filter((m) => m.tipo === "venta")),
    porPagar: suma(p.filter((m) => m.tipo !== "venta")),
    lista: p.sort((a, b) => a.fecha.localeCompare(b.fecha)),
  };
}

// Ventas y costos directos agrupados por servicio. Los gastos del negocio no
// se reparten entre servicios para no inventar asignaciones.
export function porServicio(movs, mes) {
  const map = new Map();
  for (const m of movs) {
    if (mesDe(m.fecha) !== mes || m.tipo === "gasto") continue;
    const k = (m.servicio || "").trim() || "Sin servicio";
    const r = map.get(k) || { servicio: k, ventas: 0, costos: 0 };
    if (m.tipo === "venta") r.ventas += Number(m.monto);
    else r.costos += Number(m.monto);
    map.set(k, r);
  }
  return [...map.values()]
    .map((r) => ({ ...r, ganancia: r.ventas - r.costos }))
    .sort((a, b) => b.ventas - a.ventas);
}

// Resultado de cada mes del año y su acumulado, hasta `hastaMes` ("2026-10").
// Parte desde el primer mes del año con movimientos, para no mostrar meses vacíos
// antes de que la alumna empezara a usar la herramienta.
export function resultadoAnual(movs, hastaMes) {
  const anio = hastaMes.slice(0, 4);
  const conDatos = movs.map((m) => mesDe(m.fecha)).filter((m) => m.startsWith(anio) && m <= hastaMes).sort();
  if (!conDatos.length) return { anio, filas: [], total: null };
  const filas = [];
  let acumulado = 0;
  for (let m = conDatos[0]; m <= hastaMes; m = moverMes(m, 1)) {
    const r = resumenMes(movs, m);
    acumulado = Math.round((acumulado + r.ganancia) * 100) / 100;
    filas.push({ mes: m, ventas: r.ventas, costos: r.costos, gastos: r.gastos, ganancia: r.ganancia, acumulado });
  }
  const sum = (k) => Math.round(filas.reduce((t, f) => t + f[k], 0) * 100) / 100;
  const ventas = sum("ventas");
  const total = { ventas, costos: sum("costos"), gastos: sum("gastos"), ganancia: acumulado,
    margen: ventas > 0 ? acumulado / ventas : null, meses: filas.length };
  return { anio, filas, total };
}

// Parte de la manicurista en una venta por comisión
export function calcularComision(precioCliente, pct) {
  return Math.round(Number(precioCliente) * Number(pct)) / 100;
}

export function ultimosMeses(mes, n) {
  const [y, mo] = mes.split("-").map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, mo - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export function moverMes(mes, delta) {
  const [y, mo] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1 + delta, 1)).toISOString().slice(0, 7);
}

const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita fórmulas al abrir en Excel
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(movs) {
  const head = ["fecha", "tipo", "monto", "descripcion", "categoria", "servicio", "estado", "fecha_pago", "pago_clienta", "comision_pct"];
  const rows = [...movs]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => [m.fecha, m.tipo, String(m.monto).replace(".", ","), m.descripcion, m.categoria, m.servicio, m.estado, m.fecha_pago,
      m.precio_cliente == null ? "" : String(m.precio_cliente).replace(".", ","), m.comision_pct ?? ""].map(csvCell).join(";"));
  return "﻿" + [head.join(";"), ...rows].join("\r\n");
}
