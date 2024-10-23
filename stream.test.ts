import { assertEquals } from "@std/assert/equals";
import { assertRejects } from "@std/assert/rejects";
import { PNGDecodeStream } from "./stream.ts";
import { data } from "./pngsuite-data.ts";
import { expected } from "./pngsuite-data-expected.ts";
import { Base64DecoderStream } from "@std/encoding/unstable-base64-stream";
import { FixedChunkStream } from "@std/streams/unstable-fixed-chunk-stream";
import { toTestPrintFormat } from "./debug.ts";

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
            new TransformStream({
              async transform(chunk, controller) {
                controller.enqueue(
                  await toTestPrintFormat(chunk),
                );
              },
            }),
          );
          assertEquals(await Array.fromAsync(actual) as unknown[], chunks);
        });
      }
    });
  }
});
