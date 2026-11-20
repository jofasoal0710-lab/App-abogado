/**
 * Registros públicos de Costa Rica. No ofrecen un servicio público para programas: el TSE exige un usuario
 * propio (consulta civil) y el Registro Nacional se consulta en RNP Digital con usuario. Por eso la
 * aplicación abre la consulta oficial con la referencia ya copiada y deja anotar el resultado.
 * El COSEVI tampoco tiene un servicio abierto: la consulta de licencias, puntos y multas se hace en su sitio.
 * Si el despacho consigue un convenio o un proveedor autorizado, aquí es donde se conectaría.
 */
export const REGISTRY_SOURCES = {
  tse: { label: "TSE (Registro Civil)", url: "https://servicioselectorales.tse.go.cr/chc/consulta_cedula.aspx" },
  registro: { label: "Registro Nacional (RNP Digital)", url: "https://www.rnpdigital.com/" },
  siri: { label: "Registro Inmobiliario (SIRI, visor de fincas)", url: "https://siri.snitcr.go.cr/" },
  /** COSEVI: historial de conductor, licencia, puntos y multas (con usuario registrado en el sitio). */
  cosevi: { label: "COSEVI (licencias y multas)", url: "https://www.csv.go.cr/" },
} as const;
export type RegistrySource = keyof typeof REGISTRY_SOURCES;

export const REGISTRY_KINDS = {
  cedula: { label: "Cédula de persona física", source: "tse" },
  sociedad: { label: "Persona jurídica (cédula jurídica)", source: "registro" },
  finca: { label: "Bien inmueble (finca)", source: "registro" },
  placa: { label: "Vehículo (placa)", source: "registro" },
  licencia: { label: "Licencia de conducir y puntos (cédula)", source: "cosevi" },
  multas: { label: "Multas de tránsito (placa o cédula)", source: "cosevi" },
  otro: { label: "Otra consulta", source: "registro" },
} as const satisfies Record<string, { label: string; source: RegistrySource }>;
export type RegistryKind = keyof typeof REGISTRY_KINDS;

export function isRegistryKind(k: string): k is RegistryKind {
  return Object.prototype.hasOwnProperty.call(REGISTRY_KINDS, k);
}
export function isRegistrySource(s: string): s is RegistrySource {
  return Object.prototype.hasOwnProperty.call(REGISTRY_SOURCES, s);
}
