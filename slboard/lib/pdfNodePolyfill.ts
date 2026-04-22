/**
 * pdfjs (über pdf-parse v2) erwartet Browser-Globals wie DOMMatrix. Unter Node/Vercel
 * fehlen diese, wenn pdf-parse als serverExternalPackage geladen wird.
 * Dieses Modul muss vor dem ersten Import von `pdf-parse` ausgeführt werden.
 */
import DOMMatrixImpl from '@thednp/dommatrix';

const w = globalThis as unknown as Record<string, unknown>;

if (typeof w.DOMMatrix === 'undefined') {
  w.DOMMatrix = DOMMatrixImpl;
}

/** pdfjs / Matrix-Helfer erwarten ggf. DOMPoint (Browser-API). */
if (typeof w.DOMPoint === 'undefined') {
  class DOMPointPoly {
    x: number;
    y: number;
    z: number;
    w: number;
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
    }
    static fromPoint(other?: { x?: number; y?: number; z?: number; w?: number }) {
      const o = other ?? {};
      return new DOMPointPoly(o.x ?? 0, o.y ?? 0, o.z ?? 0, o.w ?? 1);
    }
  }
  w.DOMPoint = DOMPointPoly;
}
