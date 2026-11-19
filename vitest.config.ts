import { defineConfig } from "vitest/config";

// Las pruebas de importes y fechas se escribieron con formato español (euros, Madrid): se fijan aquí
// para que no dependan del país configurado por defecto (Costa Rica).
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], env: { APP_LOCALE: "es-ES", CURRENCY: "EUR", APP_TIMEZONE: "Europe/Madrid", TZ: "Europe/Madrid" } },
});
