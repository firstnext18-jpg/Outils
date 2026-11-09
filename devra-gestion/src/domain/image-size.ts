/**
 * Dimensions d'une image PNG ou JPEG, lues dans son en-tête : pour afficher le
 * logo dans les emails à la bonne taille (Outlook ignore les tailles en CSS).
 */

export type ImageInfo = { type: "png" | "jpeg"; width: number; height: number };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Marqueurs JPEG « début de trame » (SOF), qui portent la hauteur et la largeur. */
function isStartOfFrame(marker: number) {
  return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
}

export function imageInfo(data: Uint8Array): ImageInfo | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // PNG : signature, puis bloc IHDR (largeur et hauteur sur 4 octets).
  if (data.length >= 24 && PNG_SIGNATURE.every((byte, i) => data[i] === byte)) {
    return { type: "png", width: view.getUint32(16), height: view.getUint32(20) };
  }

  // JPEG : segments successifs jusqu'au premier SOF (précision, hauteur, largeur).
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 <= data.length) {
      if (data[offset] !== 0xff) return null;
      const marker = data[offset + 1]!;
      if (marker === 0xff) {
        offset += 1; // octet de remplissage
        continue;
      }
      if (isStartOfFrame(marker)) {
        return {
          type: "jpeg",
          width: view.getUint16(offset + 7),
          height: view.getUint16(offset + 5),
        };
      }
      offset += 2 + view.getUint16(offset + 2);
    }
  }
  return null;
}

/** Taille d'affichage qui tient dans le cadre donné, sans déformer l'image. */
export function fitWithin(
  size: { width: number; height: number },
  box: { width: number; height: number },
): { width: number; height: number } {
  if (size.width <= 0 || size.height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(box.width / size.width, box.height / size.height, 1);
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}
