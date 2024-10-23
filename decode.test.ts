import { assertEquals } from "@std/assert/equals";
import { assertThrows } from "@std/assert/throws";
import { decode } from "./decode.ts";
import { toHexColor } from "./palette.ts";
import { toText } from "@std/streams/to-text";
import { toArrayBuffer } from "@std/streams/to-array-buffer";
import { data } from "./pngsuite-data.ts";
import { expected } from "./pngsuite-data-expected.ts";
import {
  Base64DecoderStream,
  Base64EncoderStream,
} from "@std/encoding/unstable-base64-stream";

Deno.test("decode", async (t) => {
  for (const [groupName, files] of Object.entries(data)) {
    await t.step(groupName, async (t) => {
      for (const [fileName, base64content] of Object.entries(files)) {
        await t.step(fileName, async () => {
          const push = decode();
          const data = new Uint8Array(
            await toArrayBuffer(
              ReadableStream.from([base64content])
                .pipeThrough(new Base64DecoderStream())
                .pipeThrough(new DecompressionStream("gzip")),
            ),
          );

          const chunks = Reflect.get(expected, fileName);
          if (groupName === "Corrupted files") {
            assertThrows(() => push(data, true), Error, chunks, chunks);
            return;
          }
          const parsed = await Promise.all(
            push(data, true).map(async (chunk) => {
              if (chunk.type === "IDAT") {
                return { ...chunk, data: chunk.data.length };
              }
              if (chunk.type === "PLTE") {
                return {
                  ...chunk,
                  palettes: chunk.palettes.map(toHexColor),
                };
              }
              if (chunk.type === "hIST") {
                const { frequencies, ...chk } = chunk;
                return {
                  ...chk,
                  frequencies: await toText(
                    ReadableStream.from([new Uint8Array(frequencies.buffer)])
                      .pipeThrough(
                        new Base64EncoderStream(),
                      ),
                  ),
                };
              }
              if (chunk.type === "unknown") {
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
              if (chunk.type === "zTXt") {
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
              return chunk;
            }),
          );
          assertEquals(parsed as unknown[], chunks);
        });
      }
    });
  }
});
