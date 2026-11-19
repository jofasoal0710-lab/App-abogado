/**
 * País de la aplicación: Costa Rica por defecto (colones, formato es-CR). Se puede cambiar con las
 * variables APP_LOCALE y CURRENCY. Se leen al usarse (no al importar) para poder fijarlas en las pruebas.
 */
export const appLocale = (): string => process.env.APP_LOCALE || "es-CR";
export const appCurrency = (): string => process.env.CURRENCY || "CRC";
