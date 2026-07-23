import { strFromU8 } from "fflate";

export function readZipLocalCompressionMethods(zip: Uint8Array): Record<string, number> {
  const methods: Record<string, number> = {};
  let offset = 0;
  while (offset + 30 <= zip.length) {
    if (zip[offset] !== 0x50 || zip[offset + 1] !== 0x4b || zip[offset + 2] !== 0x03 || zip[offset + 3] !== 0x04) {
      break;
    }
    const method = zip[offset + 8]! | (zip[offset + 9]! << 8);
    const compressedSize = zip[offset + 18]! | (zip[offset + 19]! << 8) | (zip[offset + 20]! << 16) | (zip[offset + 21]! << 24);
    const nameLen = zip[offset + 26]! | (zip[offset + 27]! << 8);
    const extraLen = zip[offset + 28]! | (zip[offset + 29]! << 8);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    const dataStart = nameEnd + extraLen;
    const name = strFromU8(zip.subarray(nameStart, nameEnd));
    methods[name] = method;
    offset = dataStart + compressedSize;
  }
  return methods;
}
