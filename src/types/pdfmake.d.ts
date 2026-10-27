/**
 * Minimal typings for pdfmake 0.3 (the package ships none; @types/pdfmake describes 0.2). Only the
 * members FOODSCOPE uses (ADR-0027). The document definition itself is typed in
 * src/features/insights/pdf/document.ts.
 */
interface PdfMakeOutput {
  getBlob(): Promise<Blob>;
  getBuffer(): Promise<Uint8Array>;
}

interface PdfMakeInstance {
  createPdf(doc: object, options?: object): PdfMakeOutput;
  addVirtualFileSystem(vfs: Record<string, string>): void;
  addFonts(fonts: Record<string, Record<string, string>>): void;
  setFonts(fonts: Record<string, Record<string, string>>): void;
  setUrlAccessPolicy(callback: ((url: string) => boolean) | undefined): void;
  setLocalAccessPolicy?(callback: ((path: string) => boolean) | undefined): void;
}

declare module "pdfmake/build/pdfmake" {
  const pdfMake: PdfMakeInstance;
  export default pdfMake;
}

declare module "pdfmake" {
  const pdfMake: PdfMakeInstance;
  export default pdfMake;
}
