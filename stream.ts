import { decode, type PNGChunk } from "./decode.ts";

/**
 * A TransformStream that decodes a PNG image from a stream of bytes.
 */
export class PNGDecodeStream extends TransformStream<Uint8Array, PNGChunk> {
  constructor() {
    const push = decode();
    super({
      transform(chunk, controller) {
        for (const pngChunk of push(chunk)) {
          controller.enqueue(pngChunk);
        }
      },
      flush(controller) {
        for (const pngChunk of push(new Uint8Array(), true)) {
          controller.enqueue(pngChunk);
        }
      },
    });
  }
}
