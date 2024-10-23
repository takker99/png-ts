import { makeDecoder, type PNGChunk } from "./decoder.ts";

/**
 * Decode PNG into {@linkcode PNGChunk}s.
 * @param source The source of PNG data.
 * @returns The generator that yields PNG chunks.
 */
export async function* decode(
  source: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
): AsyncGenerator<PNGChunk, void, unknown> {
  const push = makeDecoder();
  for await (const chunk of source) {
    yield* push(chunk);
  }
  yield* push(new Uint8Array(), true);
}
