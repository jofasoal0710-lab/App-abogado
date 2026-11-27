/**
 * Reconocer el formato real de un documento (por sus primeros bytes) y leer RTF a texto. Lógica pura.
 */
export type DocKind = "pdf" | "docx" | "doc" | "rtf" | "txt" | null;

/** Tipo real del archivo por sus primeros bytes (y, si no se reconoce, por el tipo declarado). */
export function sniffDocument(data: Buffer, mimeType: string): DocKind {
  const head = data.subarray(0, 8);
  if (head.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (head[0] === 0x50 && head[1] === 0x4b) return "docx"; // ZIP (Office Open XML)
  if (head.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return "doc"; // OLE (Word 97-2003)
  if (data.subarray(0, 5).toString("latin1") === "{\\rtf") return "rtf";
  if (mimeType === "text/plain") return "txt";
  return null;
}

/** Texto de un RTF (los .doc «guardados como» RTF): quita grupos de control, decodifica \\'xx y \\uN. */
export function rtfToText(rtf: string): string {
  let out = "";
  let i = 0;
  const skipStack: boolean[] = [];
  let skip = false;
  let ucSkip = 1;
  while (i < rtf.length) {
    const c = rtf[i];
    if (c === "{") {
      skipStack.push(skip);
      // Grupos que no son texto: fuentes, colores, estilos, información, imágenes…
      if (/^\{\\(?:\*|fonttbl|colortbl|stylesheet|info|pict|header|footer|listtable|listoverridetable|rsidtbl|generator|xmlnstbl|themedata|colorschememapping|latentstyles|datastore)/.test(rtf.slice(i, i + 24))) skip = true;
      i++;
    } else if (c === "}") {
      skip = skipStack.pop() ?? false;
      i++;
    } else if (c === "\\") {
      const m = /^\\(?:([a-z]+)(-?\d+)? ?|'([0-9a-f]{2})|(.))/i.exec(rtf.slice(i, i + 40));
      if (!m) { i++; continue; }
      i += m[0].length;
      if (skip) continue;
      if (m[3]) out += Buffer.from([parseInt(m[3], 16)]).toString("latin1");
      else if (m[4]) out += m[4] === "~" ? " " : /[\\{}]/.test(m[4]) ? m[4] : "";
      else if (m[1] === "par" || m[1] === "line") out += "\n";
      else if (m[1] === "tab") out += "\t";
      else if (m[1] === "uc") ucSkip = Number(m[2] ?? 1);
      else if (m[1] === "u") {
        out += String.fromCharCode((Number(m[2]) + 65536) % 65536);
        // Se salta el carácter de reemplazo que sigue a \uN.
        for (let k = 0; k < ucSkip && i < rtf.length; k++) i += rtf[i] === "\\" && rtf[i + 1] === "'" ? 4 : 1;
      }
    } else {
      if (!skip && c !== "\r" && c !== "\n") out += c;
      i++;
    }
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** ¿Puede analizarse como demanda? (por tipo o por extensión: Word antiguo, RTF…). */
export function isReadableDemand(name: string, mimeType: string): boolean {
  if (["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "application/rtf", "text/rtf", "text/plain"].includes(mimeType)) return true;
  return /\.(pdf|docx?|rtf|txt)$/i.test(name);
}

