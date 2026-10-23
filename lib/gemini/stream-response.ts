import { after } from "next/server";

// Streams the model's JSON text to the client, then runs `finish` (resolve
// links, store) BEFORE closing the stream — when the client sees the end, the
// finished result is already stored and a refresh renders it.
// Generation keeps going if the client leaves, so the model call isn't wasted.
export function streamThenStore(
  textStream: AsyncIterable<string>,
  finish: () => Promise<void>
): Response {
  let controller!: ReadableStreamDefaultController<string>;
  let clientConnected = true;

  const body = new ReadableStream<string>({
    start(c) {
      controller = c;
    },
    cancel() {
      clientConnected = false;
    },
  });

  const pipeline = (async () => {
    try {
      for await (const chunk of textStream) {
        if (clientConnected) controller.enqueue(chunk);
      }
      await finish();
      if (clientConnected) controller.close();
    } catch (error) {
      console.error("Generation failed", error);
      if (clientConnected) controller.error(error);
    }
  })();
  after(() => pipeline);

  return new Response(body.pipeThrough(new TextEncoderStream()), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// For a result someone else finished meanwhile: the whole JSON as one chunk
export function streamStored(generated: unknown): Response {
  return new Response(JSON.stringify(generated), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
