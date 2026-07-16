import type { TDocumentDefinitions } from 'pdfmake/interfaces'

/**
 * Render a pdfmake document definition to a PDF buffer. Kept separate from the
 * pure builder so the document structure stays testable without fonts/IO. Uses
 * pdfmake's bundled VFS (Roboto) — sufficient for EN/HU and most RO diacritics.
 *
 * NOTE (M5): swap in an Inter VFS for full RO ș/ț fidelity + brand-consistent
 * type, and route the buffer to Object Storage instead of streaming inline.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let printerPromise: Promise<any> | undefined

async function getPdfMake(): Promise<any> {
  if (!printerPromise) {
    printerPromise = (async () => {
      const pdfMakeModule: any = await import('pdfmake/build/pdfmake')
      const vfsModule: any = await import('pdfmake/build/vfs_fonts')
      const pdfMake = pdfMakeModule.default ?? pdfMakeModule
      const vfs =
        vfsModule.default?.pdfMake?.vfs ?? vfsModule.pdfMake?.vfs ?? vfsModule.default?.vfs ?? vfsModule.vfs
      if (vfs) pdfMake.vfs = vfs
      return pdfMake
    })()
  }
  return printerPromise
}

export async function renderPdf(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  const pdfMake = await getPdfMake()
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = pdfMake.createPdf(docDefinition)
      doc.getBuffer((buffer: Uint8Array) => resolve(Buffer.from(buffer)))
    } catch (error) {
      reject(error instanceof Error ? error : new Error('PDF render failed'))
    }
  })
}
