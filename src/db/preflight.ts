/**
 * Revisión de la configuración antes de un despliegue de producción (la ejecuta scripts/deploy-build.mjs).
 * Muestra TODOS los problemas a la vez, en castellano, y termina con error si hay alguno.
 */
import { checkDeployConfig } from "./deploy-checks";

const problems = checkDeployConfig(process.env);
if (problems.length) {
  console.error(`\n✖ Hay ${problems.length === 1 ? "1 problema" : `${problems.length} problemas`} en las variables de entorno (en Render: tu servicio → Environment):\n`);
  problems.forEach((p, i) => console.error(`  ${i + 1}. ${p}\n`));
  console.error("Corrígelas, guarda y vuelve a desplegar (Manual Deploy → Deploy latest commit).\n");
  process.exit(1);
}
console.log("Configuración revisada: sin problemas.");
