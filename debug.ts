import { toText } from "@std/streams/to-text";
import type {
  bKBGChunk,
  cHRMChunk,
  eXIFChunk,
  gAMAChunk,
  hISTChunk,
  iCCPChunk,
  IDATChunk,
  IENDChunk,
  IHDRChunk,
  iTXtChunk,
  pHYsChunk,
  PLTEChunk,
  PNGChunk,
  sBITChunk,
  sPLTChunk,
  sRGBChunk,
  tEXtChunk,
  tIMEChunk,
  tRNSChunk,
  UnknownChunk,
  zTXtChunk,
} from "./decoder.ts";
import { toHexColor } from "./palette.ts";
import { Base64EncoderStream } from "@std/encoding/unstable-base64-stream";

export const toTestPrintFormat = async (chunk: PNGChunk): Promise<
  | IHDRChunk
  | Omit<PLTEChunk, "palettes"> & { palettes: `#${string}`[] }
  | Omit<IDATChunk, "data"> & { data: number }
  | IENDChunk
  | tEXtChunk
  | Omit<zTXtChunk, "compressedText"> & { text: string }
  | iTXtChunk
  | pHYsChunk
  | sPLTChunk
  | tIMEChunk
  | eXIFChunk
  | gAMAChunk
  | cHRMChunk
  | sRGBChunk
  | iCCPChunk
  | sBITChunk
  | tRNSChunk
  | bKBGChunk
  | Omit<hISTChunk, "frequencies"> & { frequencies: string }
  | Omit<UnknownChunk, "data"> & { data: string }
> => {
  switch (chunk.type) {
    case "IDAT":
      return { ...chunk, data: chunk.data.length };
    case "PLTE":
      return {
        ...chunk,
        palettes: chunk.palettes.map(toHexColor),
      };
    case "zTXt": {
      const { compressedText, ...chk } = chunk;
      return {
        ...chk,
        text: await toText(
          ReadableStream.from([compressedText]).pipeThrough(
            new DecompressionStream("deflate"),
          ),
        ),
      };
    }
    case "hIST": {
      const { frequencies, ...chk } = chunk;
      return {
        ...chk,
        frequencies: await toText(
          ReadableStream.from([
            new Uint8Array(frequencies.buffer),
          ])
            .pipeThrough(
              new Base64EncoderStream(),
            ),
        ),
      };
    }
    case "unknown": {
      const { data, ...chk } = chunk;
      return {
        ...chk,
        data: await toText(
          ReadableStream.from([data]).pipeThrough(
            new Base64EncoderStream(),
          ),
        ),
      };
    }
    default:
      return chunk;
  }
};
