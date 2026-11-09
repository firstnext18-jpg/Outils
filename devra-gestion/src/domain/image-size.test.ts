import { describe, expect, it } from "vitest";
import { fitWithin, imageInfo } from "@/domain/image-size";

/** En-tête PNG minimal : signature + bloc IHDR. */
function png(width: number, height: number) {
  const data = new Uint8Array(33);
  data.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(data.buffer);
  view.setUint32(8, 13);
  data.set([0x49, 0x48, 0x44, 0x52], 12); // « IHDR »
  view.setUint32(16, width);
  view.setUint32(20, height);
  return data;
}

/** En-tête JPEG minimal : SOI, un segment APP0, puis SOF0. */
function jpeg(width: number, height: number, frameMarker = 0xc0) {
  const data = new Uint8Array(2 + 18 + 19);
  const view = new DataView(data.buffer);
  data.set([0xff, 0xd8, 0xff, 0xe0]);
  view.setUint16(4, 16); // longueur du segment APP0
  data.set([0xff, frameMarker], 20);
  view.setUint16(22, 17);
  data[24] = 8; // précision
  view.setUint16(25, height);
  view.setUint16(27, width);
  return data;
}

describe("dimensions d'une image", () => {
  it("lit un PNG", () => {
    expect(imageInfo(png(640, 200))).toEqual({ type: "png", width: 640, height: 200 });
  });

  it("lit un JPEG, y compris progressif, après les segments qui précèdent l'image", () => {
    expect(imageInfo(jpeg(300, 120))).toEqual({ type: "jpeg", width: 300, height: 120 });
    expect(imageInfo(jpeg(300, 120, 0xc2))).toEqual({ type: "jpeg", width: 300, height: 120 });
  });

  it("refuse les autres formats et les fichiers tronqués", () => {
    expect(imageInfo(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBe(
      null,
    );
    expect(imageInfo(png(10, 10).slice(0, 12))).toBe(null);
    expect(imageInfo(jpeg(10, 10).slice(0, 12))).toBe(null);
  });

  it("réduit sans déformer ni agrandir", () => {
    expect(fitWithin({ width: 640, height: 200 }, { width: 200, height: 48 })).toEqual({
      width: 154,
      height: 48,
    });
    expect(fitWithin({ width: 1000, height: 100 }, { width: 200, height: 48 })).toEqual({
      width: 200,
      height: 20,
    });
    expect(fitWithin({ width: 80, height: 30 }, { width: 200, height: 48 })).toEqual({
      width: 80,
      height: 30,
    });
  });
});
