import { startsWith } from "jsr:@std/bytes/starts-with";
import { concat } from "jsr:@std/bytes/concat";
import { crc32 } from "jsr:@takker/crc";

export type PNGChunk =
  | IHDRChunk
  | PLTEChunk
  | IDATChunk
  | IENDChunk
  | tEXtChunk
  | zTXtChunk
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
  | hISTChunk
  | UnknownChunk;

/**
 * A `IDHR` chunk, which specifies the image header.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11IHDR}
 */
export interface IHDRChunk<T extends ColorType = ColorType> {
  type: "IHDR";
  width: number;
  height: number;
  bitDepth: bitDepth<T>;
  colorType: T;
  compressionMethod: 0;
  filterMethod: number;
  interlaceMethod: 0 | 1;
}

type Grayscale = 0;
type Truecolor = 2;
type IndexedColor = 3;
type GrayscaleAlpha = 4;
type TruecolorAlpha = 6;
/**
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#3colourType}
 */
type ColorType =
  | Grayscale
  | Truecolor
  | IndexedColor
  | GrayscaleAlpha
  | TruecolorAlpha;
/**
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#table111}
 */
type bitDepth<T extends ColorType> = T extends Grayscale ? 1 | 2 | 4 | 8 | 16
  : T extends IndexedColor ? 1 | 2 | 4 | 8
  : 8 | 16;

const parseIHDRChunk = (
  type: "IHDR",
  data: Uint8Array,
): IHDRChunk => {
  const interlaceMethod = data[12];
  // https://www.w3.org/TR/2003/REC-PNG-20031110/#8InterlaceMethods
  // Only interlace method 0 and 1 are defined by ISO/IEC 15948:2003.
  if (interlaceMethod !== 0 && interlaceMethod !== 1) {
    throw new Error("Interlace method must be 0 or 1");
  }

  const bitDepth = data[8];
  const colorType = data[9];
  switch (colorType) {
    case 0:
      if (
        bitDepth !== 1 && bitDepth !== 2 && bitDepth !== 4 && bitDepth !== 8 &&
        bitDepth !== 16
      ) {
        throw new Error("Invalid bit depth for greyscale image");
      }
      bitDepth satisfies bitDepth<typeof colorType>;
      break;
    case 2:
    case 4:
    case 6:
      if (bitDepth !== 8 && bitDepth !== 16) {
        throw new Error("Invalid bit depth for truecolor image");
      }
      if (bitDepth !== 8 && bitDepth !== 16) {
        throw new Error(
          "Invalid bit depth for truecolor image and greyscale/truecolor image with alpha",
        );
      }
      bitDepth satisfies bitDepth<typeof colorType>;
      break;
    case 3:
      if (
        bitDepth !== 1 && bitDepth !== 2 && bitDepth !== 4 && bitDepth !== 8
      ) {
        throw new Error("Invalid bit depth for indexed color image");
      }
      bitDepth satisfies bitDepth<typeof colorType>;
      break;
    default:
      throw new Error("Invalid color type");
  }

  const compressionMethod = data[10];
  // https://www.w3.org/TR/2003/REC-PNG-20031110/#10CompressionCM0
  // Only compression method 0 is defined by ISO/IEC 15948:2003.
  if (compressionMethod !== 0) throw new Error("Invalid compression method");

  const filterMethod = data[11];
  // https://www.w3.org/TR/2003/REC-PNG-20031110/#9Filters
  // Only filter method 0 is defined by ISO/IEC 15948:2003.
  if (filterMethod !== 0) throw new Error("Invalid filter method");

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  return {
    type,
    width: view.getUint32(0),
    height: view.getUint32(4),
    bitDepth,
    colorType,
    compressionMethod,
    filterMethod,
    interlaceMethod,
  } satisfies IHDRChunk;
};

/**
 * A `PLTE` chunk, which specifies a palette.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11PLTE}
 */
export interface PLTEChunk {
  type: "PLTE";
  palettes: Palette[];
}

const parsePLTEChunk = (type: "PLTE", data: Uint8Array): PLTEChunk => {
  if (data.length % 3 !== 0) throw new Error("Invalid PLTE chunk");
  const palettes: Palette[] = [];
  for (let i = 0; i < data.length; i += 3) {
    palettes.push({
      red: data[i],
      green: data[i + 1],
      blue: data[i + 2],
    });
  }
  return { type, palettes };
};

export interface Palette {
  red: number;
  green: number;
  blue: number;
}

const hex = (n: number): string => n.toString(16).padStart(2, "0");
export const toHexColor = (palette: Palette): `#${string}` =>
  `#${hex(palette.red)}${hex(palette.green)}${hex(palette.blue)}`;

export interface IDATChunk {
  type: "IDAT";
  data: Uint8Array;
}

const parseIDATChunk = (type: "IDAT", data: Uint8Array): IDATChunk => {
  return { type, data };
};

export interface IENDChunk {
  type: "IEND";
}

// [Transparency information](https://www.w3.org/TR/2003/REC-PNG-20031110/#11transinfo)

/**
 * A `tRNS` chunk, which specifies transparency information for an image.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11tRNS}
 */
export interface tRNSChunk {
  type: "tRNS";
  targetColor: number | Palette | number[];
}

const parsetRNSChunk = (
  type: "tRNS",
  data: Uint8Array,
  header: IHDRChunk,
): tRNSChunk => {
  switch (header.colorType) {
    case 0:
      return { type, targetColor: data[0] };
    case 2:
      return {
        type,
        targetColor: {
          red: data[0],
          green: data[1],
          blue: data[2],
        },
      };
    case 3:
      return { type, targetColor: Array.from(data) };
    default:
      throw new Error("tRNS chunk cannot appear for color type 4 and 6.");
  }
};

// [Colour space information](https://www.w3.org/TR/2003/REC-PNG-20031110/#11addnlcolinfo)

/**
 * A `cHRM` chunk, which specifies the chromaticity of the display primaries and white point.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11cHRM}
 */
export interface cHRMChunk {
  type: "cHRM";
  whitePointX: number;
  whitePointY: number;
  redX: number;
  redY: number;
  greenX: number;
  greenY: number;
  blueX: number;
  blueY: number;
}

const parsetCHRMChunk = (type: "cHRM", data: Uint8Array): cHRMChunk => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    type,
    whitePointX: view.getUint32(0),
    whitePointY: view.getUint32(4),
    redX: view.getUint32(8),
    redY: view.getUint32(12),
    greenX: view.getUint32(16),
    greenY: view.getUint32(20),
    blueX: view.getUint32(24),
    blueY: view.getUint32(28),
  };
};

/**
 * A `gAMA` chunk, which specifies the gamma value of the image.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11gAMA}
 */
export interface gAMAChunk {
  type: "gAMA";
  gamma: number;
}

const parsetGAMAChunk = (type: "gAMA", data: Uint8Array): gAMAChunk => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { type, gamma: view.getUint32(0) / 100000 };
};

/**
 * A `iCCP` chunk containing an embedded ICC profile.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11iCCP}
 */
export interface iCCPChunk {
  type: "iCCP";
  profileName: string;
  compressionMethod: number;
  compressedProfile: Uint8Array;
}

const parsetICCPChunk = (type: "iCCP", data: Uint8Array): iCCPChunk => {
  const nullIndex = data.indexOf(0);
  if (nullIndex === -1) throw new Error("Invalid iCCP chunk");
  const profileName = String.fromCharCode(...data.subarray(0, nullIndex));
  const compressionMethod = data[nullIndex + 1];
  const compressedProfile = data.subarray(nullIndex + 2);
  return { type, profileName, compressionMethod, compressedProfile };
};

/**
 * A `sBIT` chunk, which specifies the number of significant bits in each channel.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11sBIT}
 */
export interface sBITChunk<T extends ColorType = ColorType> {
  type: "sBIT";
  significantBits: T extends Grayscale ? number
    : T extends Truecolor | IndexedColor ? Palette
    : T extends GrayscaleAlpha ? { grayscale: number; alpha: number }
    : Palette & { alpha: number };
}

const parsetSBITChunk = <T extends ColorType>(
  type: "sBIT",
  data: Uint8Array,
  header: IHDRChunk<T>,
): sBITChunk<T> => {
  switch (header.colorType) {
    case 0:
      return { type, significantBits: data[0] } satisfies sBITChunk<
        Grayscale
      > as sBITChunk<T>;
    case 2:
    case 3:
      return {
        type,
        significantBits: {
          red: data[0],
          green: data[1],
          blue: data[2],
        },
      } satisfies sBITChunk<Truecolor | IndexedColor> as sBITChunk<T>;
    case 4:
      return {
        type,
        significantBits: {
          grayscale: data[0],
          alpha: data[1],
        },
      } satisfies sBITChunk<GrayscaleAlpha> as sBITChunk<T>;
    case 6:
      return {
        type,
        significantBits: {
          red: data[0],
          green: data[1],
          blue: data[2],
          alpha: data[3],
        },
      } satisfies sBITChunk<TruecolorAlpha> as sBITChunk<T>;
  }
  throw new Error("unreachable");
};

/**
 * A `sRGB` chunk, which specifies the rendering intent of the image.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11sRGB}
 */
export interface sRGBChunk {
  type: "sRGB";
  renderingIntent: 0 | 1 | 2 | 3;
}

const parsetSRGBChunk = (type: "sRGB", data: Uint8Array): sRGBChunk => {
  const renderingIntent = data[0];
  if (
    renderingIntent !== 0 && renderingIntent !== 1 && renderingIntent !== 2 &&
    renderingIntent !== 3
  ) {
    throw new Error("Invalid rendering intent");
  }
  return { type, renderingIntent };
};

// [Textual information](https://www.w3.org/TR/2003/REC-PNG-20031110/#11textinfo)

/**
 * A `tEXt` chunk, which contains textual information.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11tEXt}
 */
export interface tEXtChunk {
  type: "tEXt";
  keyword: string;
  text: string;
}

const parsetEXtChunk = (type: "tEXt", data: Uint8Array): tEXtChunk => {
  const keywordEnd = data.indexOf(0);
  if (keywordEnd === -1) throw new Error("Invalid tEXt chunk");
  const keyword = String.fromCharCode(...data.subarray(0, keywordEnd));
  const text = String.fromCharCode(...data.subarray(keywordEnd + 1));
  return { type, keyword, text };
};

/**
 * A `zTXt` chunk, which contains compressed textual information.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11zTXt}
 */
export interface zTXtChunk {
  type: "zTXt";
  keyword: string;
  method: number;
  compressedText: Uint8Array;
}

const parsetZTXtChunk = (type: "zTXt", data: Uint8Array): zTXtChunk => {
  const keywordEnd = data.indexOf(0);
  if (keywordEnd === -1) throw new Error("Invalid zTXt chunk");
  const keyword = String.fromCharCode(...data.subarray(0, keywordEnd));
  const method = data[keywordEnd + 1];
  const compressedText = data.subarray(keywordEnd + 2);
  return { type, keyword, method, compressedText };
};

/**
 * A `iTXt` chunk, which contains international textual information.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11iTXt}
 */
export interface iTXtChunk {
  type: "iTXt";
  keyword: string;
  isCompressed: boolean;
  method: number;
  languageTag: string;
  translatedKeyword: string;
  text: string;
}

const parseiTXtChunk = (type: "iTXt", data: Uint8Array): iTXtChunk => {
  let offset = data.indexOf(0);
  if (offset === -1) throw new Error("Invalid iTXt chunk");
  const keyword = String.fromCharCode(...data.subarray(0, offset));
  const isCompressed = Boolean(data[++offset]);
  const method = data[++offset];
  const languageTagEnd = data.indexOf(0, ++offset);
  if (languageTagEnd === -1) throw new Error("Invalid iTXt chunk");
  const languageTag = String.fromCharCode(
    ...data.subarray(offset, languageTagEnd),
  );
  offset = languageTagEnd;
  const translatedKeywordEnd = data.indexOf(0, ++offset);
  if (translatedKeywordEnd === -1) throw new Error("Invalid iTXt chunk");
  const decoder = new TextDecoder();
  const translatedKeyword = decoder.decode(
    data.subarray(offset, translatedKeywordEnd),
  );
  offset = translatedKeywordEnd + 1;
  const text = decoder.decode(data.subarray(offset));
  return {
    type,
    keyword,
    isCompressed,
    method,
    languageTag,
    translatedKeyword,
    text,
  };
};

// [Miscellaneous information](https://www.w3.org/TR/2003/REC-PNG-20031110/#11miscinfo)

/**
 * A `bKGD` chunk, which specifies the default background color of the image.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11bKGD}
 */
export interface bKBGChunk<T extends ColorType = ColorType> {
  type: "bKGD";
  background: T extends Truecolor | TruecolorAlpha ? Palette : number;
}
const parsebKBGChunk = <const T extends ColorType>(
  type: "bKGD",
  data: Uint8Array,
  header: IHDRChunk<T>,
): bKBGChunk<T> => {
  switch (header.colorType) {
    case 0:
    case 4: {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      return { type, background: view.getUint16(0) } satisfies bKBGChunk<
        Grayscale | GrayscaleAlpha
      > as bKBGChunk<T>;
    }
    case 2:
    case 6:
      return {
        type,
        background: {
          red: data[0],
          green: data[1],
          blue: data[2],
        },
      } satisfies bKBGChunk<Truecolor | TruecolorAlpha> as bKBGChunk<T>;
    case 3:
      return { type, background: data[0] } satisfies bKBGChunk<
        IndexedColor
      > as bKBGChunk<
        T
      >;
  }
  throw new Error("unreachable");
};

/**
 * A `hIST` chunk, which specifies the histogram of the image.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11hIST}
 */
export interface hISTChunk {
  type: "hIST";
  frequencies: Uint16Array;
}

const parsetHISTChunk = (type: "hIST", data: Uint8Array): hISTChunk => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const frequencies = new Uint16Array(data.length / 2);
  for (let i = 0; i < frequencies.length; i++) {
    frequencies[i] = view.getUint16(i * 2);
  }
  return { type, frequencies };
};

/**
 * A `pHYs` chunk, which specifies the physical dimensions of the image.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11pHYs}
 */
export interface pHYsChunk {
  type: "pHYs";
  pixelsPerUnitXAxis: number;
  pixelsPerUnitYAxis: number;
  unitSpecifier: number;
}

const parsetPHYsChunk = (type: "pHYs", data: Uint8Array): pHYsChunk => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    type,
    pixelsPerUnitXAxis: view.getUint32(0),
    pixelsPerUnitYAxis: view.getUint32(4),
    unitSpecifier: data[8],
  };
};

/**
 * A `sPLT` chunk, which specifies a suggested palette.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11sPLT}
 */
export interface sPLTChunk {
  type: "sPLT";
  paletteName: string;
  sampleDepth: number;
  palette: { red: number; green: number; blue: number; alpha: number }[];
}

// [Time stamp information](https://www.w3.org/TR/2003/REC-PNG-20031110/#11timestampinfo)

/**
 * A `tIME` chunk, which specifies the last modification time of the image.
 *
 * {@see https://www.w3.org/TR/2003/REC-PNG-20031110/#11tIME}
 */
export interface tIMEChunk {
  type: "tIME";
  date: Date;
}

export const parsetIMEChunk = (type: "tIME", data: Uint8Array): tIMEChunk => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    type,
    date: new Date(Date.UTC(
      view.getUint16(0),
      data[2] - 1,
      data[3],
      data[4],
      data[5],
      data[6],
    )),
  };
};

// [Extensions to the PNG specification](https://ftp-osl.osuosl.org/pub/libpng/documents/pngext-1.5.0.html)

/**
 * An `eXIF` chunk, which contains Exif metadata.
 *
 * {@see https://ftp-osl.osuosl.org/pub/libpng/documents/pngext-1.5.0.html#C.eXIf}
 */
export interface eXIFChunk {
  type: "eXIF";
  data: Uint8Array;
}

export const parseeXIFChunk = (type: "eXIF", data: Uint8Array): eXIFChunk => ({
  type,
  data,
});

export interface UnknownChunk {
  type: "unknown";
  typeCode: string;
  data: Uint8Array;
}

type ChunkParser<Type extends string, Chunk> = (
  type: Type,
  data: Uint8Array,
  header: IHDRChunk,
) => Chunk;
type ChunkParserEntry<Type extends string, Chunk> = [
  Type,
  ChunkParser<Type, Chunk>,
];
type CombineResult<
  // deno-lint-ignore no-explicit-any
  ParserEntries extends readonly ChunkParserEntry<any, unknown>[],
> = ParserEntries extends [
  [
    infer ChunkType extends string,
    // deno-lint-ignore no-explicit-any
    infer Parser extends ChunkParser<any, unknown>,
  ],
  // deno-lint-ignore no-explicit-any
  ...infer Rest extends readonly ChunkParserEntry<any, unknown>[],
]
  ? Parser extends ChunkParser<ChunkType, infer Chunk>
    ? Chunk | CombineResult<Rest>
  : never
  : UnknownChunk;

const combine = <
  // deno-lint-ignore no-explicit-any
  const ParserEntries extends ChunkParserEntry<any, unknown>[],
>(
  chunkType: string,
  chunkData: Uint8Array,
  header: IHDRChunk,
  parsers: [...ParserEntries],
): CombineResult<ParserEntries> =>
  parsers.reduce(
    (acc, [type, parser]) =>
      type === chunkType
        ? parser(type, chunkData, header) as CombineResult<ParserEntries>
        : acc,
    {
      type: "unknown",
      typeCode: chunkType,
      data: chunkData,
    } as CombineResult<ParserEntries>,
  ) as CombineResult<ParserEntries>;

export const decode = (): (
  chunk: Uint8Array,
  final?: boolean,
) => PNGChunk[] => {
  let data = new Uint8Array();
  let checkSignature = false;
  let readingChunk:
    | [length: number, type: string, crcOfType: number]
    | undefined;
  let header: IHDRChunk | undefined;
  let hasIDAT = false;

  return (chunk: Uint8Array, final?: boolean): PNGChunk[] => {
    if (chunk.length > 0) data = concat([data, chunk]);
    let offset = 0;

    if (!checkSignature) {
      if (data.length < 8) {
        if (final) throw new Error("Data is too short");
        return [];
      }
      if (!startsWith(data, pngFileSignature)) {
        throw new Error("Invalid PNG file signature");
      }
      offset = 8;
      checkSignature = true;
    }

    const view = new DataView(data.buffer);
    const chunks: PNGChunk[] = [];
    while (true) {
      if (!readingChunk) {
        if (data.length - offset < 12) break;
        const length = view.getUint32(offset);
        const typeBuf = data.subarray(offset += 4, offset += 4);
        readingChunk = [
          length,
          String.fromCharCode(...typeBuf),
          crc32(typeBuf),
        ];
      }
      const [length, type, crc] = readingChunk;
      if (data.length - offset < 4 + length) break;
      const chunkData = data.subarray(offset, offset += length);
      const expectedCrc = view.getInt32(offset);
      if (expectedCrc !== crc32(chunkData, crc)) {
        throw new Error("CRC32 mismatch");
      }
      offset += 4;
      readingChunk = undefined;

      if (type === "IHDR") {
        header = parseIHDRChunk(type, chunkData);
        chunks.push({ ...header });
        continue;
      }
      if (!header) throw new Error("IHDR chunk is not found");
      if (type === "IDAT") hasIDAT = true;
      chunks.push(combine(
        type,
        chunkData,
        header,
        [
          ["PLTE", parsePLTEChunk],
          ["IDAT", parseIDATChunk],
          ["IEND", (type): IENDChunk => ({ type })],
          ["tRNS", parsetRNSChunk],
          ["tIME", parsetIMEChunk],
          ["tEXt", parsetEXtChunk],
          ["zTXt", parsetZTXtChunk],
          ["iTXt", parseiTXtChunk],
          ["pHYs", parsetPHYsChunk],
          ["gAMA", parsetGAMAChunk],
          ["cHRM", parsetCHRMChunk],
          ["sBIT", parsetSBITChunk],
          ["sRGB", parsetSRGBChunk],
          ["iCCP", parsetICCPChunk],
          ["sBIT", parsetSBITChunk],
          ["bKGD", parsebKBGChunk],
          ["hIST", parsetHISTChunk],
        ],
      ));
    }
    if (final) {
      if (offset < data.length) throw new Error("All data is not parsed.");
      if (!hasIDAT) throw new Error("missing IDAT chunk");
    }
    data = data.subarray(offset);
    return chunks;
  };
};

const pngFileSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
