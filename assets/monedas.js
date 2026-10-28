// Monedas de ART LAB Tools. La moneda se elige sola según el país (la base de
// datos la ajusta con public.moneda_por_pais); esta tabla es la misma, para
// mostrar en pantalla cuál corresponde a "Automática".
import { lang } from "/assets/i18n.js?v=20261028a";

export const MONEDA_POR_PAIS = {
  AR: "ARS", BO: "BOB", BR: "BRL", CA: "CAD", CL: "CLP", CO: "COP", CR: "CRC", CU: "CUP",
  EC: "USD", SV: "USD", ES: "EUR", US: "USD", FR: "EUR", GT: "GTQ", HN: "HNL", IT: "EUR",
  MX: "MXN", NI: "NIO", PA: "USD", PY: "PYG", PE: "PEN", PT: "EUR", PR: "USD", GB: "GBP",
  DO: "DOP", CH: "CHF", UY: "UYU", VE: "USD", NL: "EUR", BE: "EUR", DE: "EUR",
};

export const MONEDAS = [...new Set(Object.values(MONEDA_POR_PAIS))].sort();

export const monedaDelPais = (iso) => MONEDA_POR_PAIS[String(iso || "").toUpperCase()] || "USD";

export function nombreMoneda(codigo) {
  try { return new Intl.DisplayNames([lang], { type: "currency" }).of(codigo); }
  catch { return codigo; }
}
