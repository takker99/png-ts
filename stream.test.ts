import { assertEquals } from "@std/assert/equals";
import { assertRejects } from "@std/assert/rejects";
import { PNGDecodeStream } from "./stream.ts";
import { toText } from "@std/streams/to-text";
import { toTransformStream } from "@std/streams/to-transform-stream";
import { data } from "./pngsuite-data.ts";
import { expected } from "./pngsuite-data-expected.ts";
import {
  Base64DecoderStream,
  Base64EncoderStream,
} from "@std/encoding/unstable-base64-stream";
import { toHexColor } from "./palette.ts";
import { FixedChunkStream } from "@std/streams/unstable-fixed-chunk-stream";

Deno.test("decode", async (t) => {
  for (const [groupName, files] of Object.entries(data)) {
    await t.step(groupName, async (t) => {
      for (const [fileName, base64content] of Object.entries(files)) {
        await t.step(fileName, async () => {
          const chunkStream = ReadableStream.from([base64content])
            .pipeThrough(new Base64DecoderStream())
            .pipeThrough(new DecompressionStream("gzip"))
            .pipeThrough(new FixedChunkStream(64))
            .pipeThrough(new PNGDecodeStream());

          const chunks = Reflect.get(expected, fileName);
          if (groupName === "Corrupted files") {
            assertRejects(
              () => Array.fromAsync(chunkStream),
              Error,
              chunks,
              chunks,
            );
            return;
          }
          const actual = chunkStream.pipeThrough(
            toTransformStream(async function* (readable) {
              for await (const chunk of readable) {
                switch (chunk.type) {
                  case "IDAT":
                    yield { ...chunk, data: chunk.data.length };
                    break;
                  case "PLTE":
                    yield {
                      ...chunk,
                      palettes: chunk.palettes.map(toHexColor),
                    };
                    break;
                  case "zTXt": {
                    const { compressedText, ...chk } = chunk;
                    yield {
                      ...chk,
                      text: await toText(
                        ReadableStream.from([compressedText]).pipeThrough(
                          new DecompressionStream("deflate"),
                        ),
                      ),
                    };
                    break;
                  }
                  case "hIST": {
                    const { frequencies, ...chk } = chunk;
                    yield {
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
                    break;
                  }
                  case "unknown": {
                    const { data, ...chk } = chunk;
                    yield {
                      ...chk,
                      data: await toText(
                        ReadableStream.from([data]).pipeThrough(
                          new Base64EncoderStream(),
                        ),
                      ),
                    };
                    break;
                  }
                  default:
                    yield chunk;
                    break;
                }
              }
            }),
          );
          assertEquals(await Array.fromAsync(actual) as unknown[], chunks);
        });
      }
    });
  }
});
