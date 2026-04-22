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
