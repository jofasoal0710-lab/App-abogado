import type { PDFFont } from "pdf-lib";

/**
 * Los PDF con fuentes estándar solo codifican WinAnsi (Latin-1 ampliado, con €). Un carácter fuera de ese
 * juego (p. ej. «ł», «ž» o un emoji en el nombre de un cliente) haría FALLAR la generación, así que se
 * sustituye: primero por su letra base sin acento («ž» → «z») y, si no hay, por «?».
 */
export function safeText(font: Pick<PDFFont, "getCharacterSet">, input: string): string {
  const supported = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of input.replace(/[  ]/g, " ").replace(/\t/g, " ")) {
    const cp = ch.codePointAt(0)!;
    if (cp < 32 && ch !== "\n") continue; // controles
    if (ch === "\n" || supported.has(cp)) {
      out += ch;
      continue;
    }
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    out += base && [...base].every((b) => supported.has(b.codePointAt(0)!)) ? base : "?";
  }
  return out;
}

/** Tamaño de letra que hace caber `text` en `maxWidth` (reduciendo desde `size` hasta `minSize`). */
export function fitFontSize(font: Pick<PDFFont, "widthOfTextAtSize">, text: string, maxWidth: number, size: number, minSize = 6): number {
  let s = size;
  while (s > minSize && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.5;
  return s;
}

/** Parte un texto en líneas que quepan en `maxWidth`, respetando saltos de línea y partiendo palabras demasiado largas. */
export function wrapText(text: string, font: Pick<PDFFont, "widthOfTextAtSize">, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = "";
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
    lines.push(current);
  }
  return lines.length ? lines : [""];
}
