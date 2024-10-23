import { UntarStream } from "@std/tar/untar-stream";
import { Base64EncoderStream } from "@std/encoding/unstable-base64-stream";
import { toText } from "@std/streams/to-text";

const stream =
  (await fetch("http://www.schaik.com/pngsuite/PngSuite-2017jul19.tgz"))
    .body?.pipeThrough(new DecompressionStream("gzip"));
if (!stream) throw new Error("Failed to fetch");

const groups: Record<
  | "Basic formats"
  | "Interlacing"
  | "Odd sizes"
  | "Background colors"
  | "Transparency"
  | "Gamma values"
  | "Image filtering"
  | "Additional palettes"
  | "Ancillary chunks"
  | "Chunk ordering"
  | "Zlib compression level"
  | "Corrupted files"
  | "Miscillaneous",
  Record<string, string>
> = {
  "Basic formats": {},
  "Interlacing": {},
  "Odd sizes": {},
  "Background colors": {},
  "Transparency": {},
  "Gamma values": {},
  "Image filtering": {},
  "Additional palettes": {},
  "Ancillary chunks": {},
  "Chunk ordering": {},
  "Zlib compression level": {},
  "Corrupted files": {},
  "Miscillaneous": {},
};
let license = "";
for await (const entry of stream.pipeThrough(new UntarStream())) {
  if (entry.path.endsWith("LICENSE") || entry.path.endsWith("README")) {
    const content = `\n/// ${entry.path}\n${
      (await toText(entry.readable!)).split("\n").map((line) =>
        line ? `/// ${line}` : "///"
      ).join("\n")
    }`;
    license = license ? [license, content].join("\n") : content;
    continue;
  }
  if (!entry.path.endsWith(".png")) {
    await entry.readable?.cancel?.();
    continue;
  }
  const base64Stream = entry.readable!
    .pipeThrough(new CompressionStream("gzip"))
    .pipeThrough(new Base64EncoderStream());

  const content = await toText(base64Stream);
  // http://www.schaik.com/pngsuite/pngsuite_bas_png.html
  if (entry.path.startsWith("basn")) {
    groups["Basic formats"][entry.path] = content;
    continue;
  }
  // http://www.schaik.com/pngsuite/pngsuite_int_png.html
  if (entry.path.startsWith("basi")) {
    groups["Interlacing"][entry.path] = content;
    continue;
  }
  // http://www.schaik.com/pngsuite/pngsuite_siz_png.html
  if (entry.path.startsWith("s")) {
    groups["Odd sizes"][entry.path] = content;
    continue;
  }
  // http://www.schaik.com/pngsuite/pngsuite_bck_png.html
  if (entry.path.startsWith("bg")) {
    groups["Background colors"][entry.path] = content;
    continue;
  }
  // http://www.schaik.com/pngsuite/pngsuite_trn_png.html
  if (entry.path.startsWith("t")) {
    groups["Transparency"][entry.path] = content;
    continue;
  }
  // http://www.schaik.com/pngsuite/pngsuite_gam_png.html
  if (entry.path.startsWith("g")) {
    groups["Gamma values"][entry.path] = content;
    continue;
  }
  // http://www.schaik.com/pngsuite/pngsuite_fil_png.html
  if (entry.path.startsWith("f")) {
    groups["Image filtering"][entry.path] = content;
    continue;
  }
  // http://www.schaik.com/pngsuite/pngsuite_pal_png.html
  if (entry.path.startsWith("p")) {
    groups["Additional palettes"][entry.path] = content;
    continue;
  }
  // http://www.schaik.com/pngsuite/pngsuite_cnk_png.html
  if (entry.path.startsWith("c") || entry.path.startsWith("exif")) {
    groups["Ancillary chunks"][entry.path] = content;
    continue;
  }
  // http://www.schaik.com/pngsuite/pngsuite_ord_png.html
  if (entry.path.startsWith("o")) {
    groups["Chunk ordering"][entry.path] = content;
    continue;
  }
  // http://www.schaik.com/pngsuite/pngsuite_zlb_png.html
  if (entry.path.startsWith("z")) {
    groups["Zlib compression level"][entry.path] = content;
    continue;
  }
  // http://www.schaik.com/pngsuite/pngsuite_xxx_png.html
  if (entry.path.startsWith("x")) {
    groups["Corrupted files"][entry.path] = content;
    continue;
  }
  groups["Miscillaneous"][entry.path] = content;
}

const json =
  `// deno-lint-ignore-file\n// deno-fmt-ignore-file\n${license}\nexport const data = ${
    JSON.stringify(groups, null, 2)
  };\n`;

await Deno.writeTextFile(new URL("../pngsuite-data.ts", import.meta.url), json);

console.log("Downloaded PNGSuite");
