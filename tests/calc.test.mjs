import assert from "node:assert/strict";
import { resumenMes, pendientes, porServicio, ultimosMeses, moverMes, toCSV } from "../finanzas/calc.js";
const movs = [
  { tipo:"venta", monto:20000, fecha:"2026-10-05", estado:"pagado", fecha_pago:null, servicio:"Soft gel" },
  { tipo:"venta", monto:15000, fecha:"2026-10-20", estado:"pendiente", fecha_pago:null, servicio:"Soft gel" },
  { tipo:"venta", monto:10000, fecha:"2026-09-28", estado:"pagado", fecha_pago:"2026-10-02", servicio:"Kapping" },
  { tipo:"costo", monto:3000, fecha:"2026-10-05", estado:"pagado", fecha_pago:null, servicio:"Soft gel" },
  { tipo:"gasto", monto:8000, fecha:"2026-10-01", estado:"pendiente", fecha_pago:null, descripcion:"=HYPERLINK(1)" },
];
const oct = resumenMes(movs, "2026-10");
assert.equal(oct.ventas, 35000);          // venta de septiembre no cuenta en octubre
assert.equal(oct.costos, 3000);
assert.equal(oct.gastos, 8000);
assert.equal(oct.ganancia, 24000);
assert.equal(oct.cobrado, 30000);          // 20000 + cobro en oct de venta de sept; NO el pendiente
assert.equal(oct.pagado, 3000);            // gasto pendiente no sale de caja
assert.equal(oct.caja, 27000);
const sep = resumenMes(movs, "2026-09");
assert.equal(sep.ventas, 10000); assert.equal(sep.cobrado, 0);
const p = pendientes(movs);
assert.equal(p.porCobrar, 15000); assert.equal(p.porPagar, 8000);
const s = porServicio(movs, "2026-10");
assert.deepEqual(s.map(x=>[x.servicio,x.ventas,x.costos,x.ganancia]), [["Soft gel",35000,3000,32000]]);
assert.deepEqual(ultimosMeses("2026-02", 3), ["2025-12","2026-01","2026-02"]);
assert.equal(moverMes("2026-12", 1), "2027-01");
assert.equal(resumenMes(movs,"2026-11").margen, null);
const csv = toCSV(movs);
assert.ok(csv.includes("'=HYPERLINK(1)"));
assert.equal(resumenMes([{tipo:"venta",monto:"0.1",fecha:"2026-10-01",estado:"pagado"},{tipo:"venta",monto:"0.2",fecha:"2026-10-01",estado:"pagado"}],"2026-10").ventas, 0.3);
console.log("OK: todos los cálculos pasan");
