/**
 * Fija la zona horaria del proceso (las horas de la agenda se introducen y se muestran en la hora
 * local del despacho, no en la del servidor). Se hace al importar este módulo, y lo importa el módulo
 * de base de datos, que toda petición usa: no se depende de que el alojamiento ejecute instrumentation.ts.
 */
const tz = process.env.APP_TIMEZONE || "America/Costa_Rica";
if (process.env.TZ !== tz) process.env.TZ = tz;
export const APP_TIMEZONE = tz;
