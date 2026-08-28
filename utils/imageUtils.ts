/**
 * Läser in en bildfil och skalar ner den till en liten miniatyr.
 *
 * Miniatyren sparas som en data-URL direkt i dokumentet i stället för i
 * Firebase Storage. Det är ett medvetet val: en bild i Storage kräver egna
 * regler, en uppladdning, en radering när måltiden tas bort - och glöms
 * raderingen ligger filen kvar för alltid. En miniatyr på några kilobyte
 * följer med dokumentet, försvinner med det, och behöver ingenting extra.
 *
 * Storleken är vald för att rymmas med god marginal: Firestore tillåter 1 MiB
 * per dokument och en miniatyr på 240 px landar typiskt på 10-20 kB.
 */

/** Ungefärlig storlek i bytes för en data-URL. */
export const dataUrlSizeBytes = (dataUrl: string): number => {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.round(base64.length * 0.75);
};

export interface ThumbnailOptions {
  /** Längsta sidan i pixlar. */
  maxSize?: number;
  /** JPEG-kvalitet, 0-1. */
  quality?: number;
}

/**
 * Skalar ner en bildfil till en kvadratisk miniatyr (beskuren i mitten).
 *
 * EXIF-rotationen respekteras via createImageBitmap - annars kommer bilder
 * från telefonens album ofta in liggande.
 */
export async function fileToSquareThumbnail(
  file: File,
  { maxSize = 240, quality = 0.7 }: ThumbnailOptions = {}
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Filen verkar inte vara en bild.');
  }

  let source: ImageBitmap | HTMLImageElement;
  let sourceWidth: number;
  let sourceHeight: number;

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    source = bitmap;
    sourceWidth = bitmap.width;
    sourceHeight = bitmap.height;
  } else {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Bilden kunde inte läsas.'));
        el.src = objectUrl;
      });
      source = img;
      sourceWidth = img.naturalWidth;
      sourceHeight = img.naturalHeight;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  // Beskär till en kvadrat ur mitten, så att kortet aldrig får en snedvriden bild.
  const side = Math.min(sourceWidth, sourceHeight);
  const sx = Math.round((sourceWidth - side) / 2);
  const sy = Math.round((sourceHeight - side) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = maxSize;
  canvas.height = maxSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Kunde inte bearbeta bilden.');

  context.drawImage(source as CanvasImageSource, sx, sy, side, side, 0, 0, maxSize, maxSize);

  if ('close' in source && typeof (source as ImageBitmap).close === 'function') {
    (source as ImageBitmap).close();
  }

  return canvas.toDataURL('image/jpeg', quality);
}
