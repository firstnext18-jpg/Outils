import { describe, expect, it } from "vitest";
import { detectImageType } from "@/server/storage";

describe("detectImageType", () => {
  it("reconnaît un PNG et un JPEG à leurs premiers octets", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(detectImageType(png)).toEqual({ extension: "png", mimeType: "image/png" });
    expect(detectImageType(jpeg)).toEqual({ extension: "jpg", mimeType: "image/jpeg" });
  });

  it("refuse tout le reste, quel que soit le nom du fichier", () => {
    expect(detectImageType(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(detectImageType(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull(); // PDF
    expect(detectImageType(new Uint8Array([]))).toBeNull();
  });
});
