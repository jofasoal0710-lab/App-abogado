// Diccionario español (Hunspell) para las pruebas del asistente, como en el servidor.
import nspell from "nspell";
import dict from "dictionary-es";
const s = nspell({ aff: Buffer.from(dict.aff), dic: Buffer.from(dict.dic) });
export const isWord = (w: string) => s.correct(w);
