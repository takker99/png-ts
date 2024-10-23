import { makeDecoder, type PNGChunk } from "./decoder.ts";

/**
 * Decode PNG into {@linkcode PNGChunk}s.
 * @param source The source of PNG data.
 * @returns The generator that yields PNG chunks.
 */
export function* decode(
  source: Iterable<Uint8Array>,
): Generator<PNGChunk, void, unknown> {
  const push = makeDecoder();
  for (const chunk of source) {
    yield* push(chunk);
  }
  yield* push(new Uint8Array(), true);
}
