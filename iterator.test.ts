import { assertEquals } from "@std/assert/equals";
import { assertRejects } from "@std/assert/rejects";
import { decode } from "./iterator.ts";
import { data } from "./pngsuite-data.ts";
import { expected } from "./pngsuite-data-expected.ts";
import { Base64DecoderStream } from "@std/encoding/unstable-base64-stream";
import { FixedChunkStream } from "@std/streams/unstable-fixed-chunk-stream";
import { toTestPrintFormat } from "./debug.ts";
import { map } from "@core/iterutil/async/map";

Deno.test("decode", async (t) => {
  for (const [groupName, files] of Object.entries(data)) {
    await t.step(groupName, async (t) => {
      for (const [fileName, base64content] of Object.entries(files)) {
        await t.step(fileName, async () => {
          const chunkIter = map(
            decode(
              await Array.fromAsync(
                ReadableStream.from([base64content])
                  .pipeThrough(new Base64DecoderStream())
                  .pipeThrough(new DecompressionStream("gzip"))
                  .pipeThrough(new FixedChunkStream(64)),
              ),
            ),
            toTestPrintFormat,
          );

          const chunks = Reflect.get(expected, fileName);
          if (groupName === "Corrupted files") {
            assertRejects(
              () => Array.fromAsync(chunkIter),
              Error,
              chunks,
              chunks,
            );
            return;
          }
          assertEquals(await Array.fromAsync(chunkIter) as unknown[], chunks);
        });
      }
    });
  }
});
