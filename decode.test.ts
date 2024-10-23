import { assertEquals } from "@std/assert/equals";
import { assertThrows } from "@std/assert/throws";
import { makeDecoder } from "./decoder.ts";
import { toArrayBuffer } from "@std/streams/to-array-buffer";
import { data } from "./pngsuite-data.ts";
import { expected } from "./pngsuite-data-expected.ts";
import { Base64DecoderStream } from "@std/encoding/unstable-base64-stream";
import { toTestPrintFormat } from "./debug.ts";

Deno.test("decode", async (t) => {
  for (const [groupName, files] of Object.entries(data)) {
    await t.step(groupName, async (t) => {
      for (const [fileName, base64content] of Object.entries(files)) {
        await t.step(fileName, async () => {
          const push = makeDecoder();
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
            push(data, true).map(toTestPrintFormat),
          );
          assertEquals(parsed as unknown[], chunks);
        });
      }
    });
  }
});
