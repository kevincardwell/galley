import "server-only";
import { Readable, Transform } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import Busboy from "busboy";

/** Thrown into the file pipeline when a part grows past `maxBytes`; the writer's pipeline rejects with it. */
export class FileTooLargeError extends Error {
  constructor(public readonly maxBytes: number) {
    super("File is larger than the upload limit");
    this.name = "FileTooLargeError";
  }
}

export type MultipartFile = {
  /** Field name the part arrived under (`files`). */
  fieldname: string;
  /** Filename as sent by the browser, untrusted. */
  filename: string;
  mimeType: string;
  /** Text fields seen so far; clients must append fields before files for these to be complete. */
  fields: Readonly<Record<string, string>>;
  /** Bytes of the part. Destroys itself with FileTooLargeError once `maxBytes` is exceeded. */
  stream: Readable;
  /** Bytes read so far; final once the stream has ended. */
  readonly bytes: number;
};

export type ParseOptions = {
  /** Called for every file part, one at a time, in order. Consume `file.stream` (or return early and it is drained). */
  onFile: (file: MultipartFile) => Promise<void>;
  /** Per-file cap in bytes. */
  maxBytes: number;
  /** Cap on text fields so a hostile client cannot fill memory. */
  maxFieldBytes?: number;
};

export type ParseResult = { fields: Record<string, string>; files: number };

export class NotMultipartError extends Error {
  constructor() {
    super("Expected multipart form data");
    this.name = "NotMultipartError";
  }
}

/**
 * Stream a multipart request through busboy. Each file part is handed to `onFile` while it is still
 * arriving, so the body never sits in memory. The whole body is always consumed, so the caller can
 * respond with a normal status afterwards even when every file was rejected.
 */
export async function parseMultipartUpload(request: Request, opts: ParseOptions): Promise<ParseResult> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!request.body || !contentType.toLowerCase().startsWith("multipart/form-data")) throw new NotMultipartError();

  let bb: Busboy.Busboy;
  try {
    bb = Busboy({ headers: { "content-type": contentType }, limits: { fieldSize: opts.maxFieldBytes ?? 64 * 1024 } });
  } catch {
    throw new NotMultipartError();
  }

  const fields: Record<string, string> = {};
  let files = 0;
  // Handlers run strictly one after another; busboy applies backpressure to the request until each part is drained.
  let chain: Promise<void> = Promise.resolve();
  let failure: unknown = null;

  bb.on("field", (name, value) => {
    fields[name] = value;
  });

  bb.on("file", (fieldname, stream, info) => {
    files++;
    let bytes = 0;
    const counted = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        bytes += chunk.length;
        if (bytes > opts.maxBytes) {
          cb(new FileTooLargeError(opts.maxBytes));
          return;
        }
        cb(null, chunk);
      },
    });
    stream.pipe(counted);
    // If the consumer bails (or the cap trips), keep draining the raw part so busboy can reach the next boundary.
    counted.on("error", () => stream.resume());
    counted.on("close", () => { if (!stream.readableEnded) stream.resume(); });

    const file: MultipartFile = {
      fieldname,
      filename: info.filename ?? "",
      mimeType: info.mimeType,
      fields,
      stream: counted,
      get bytes() {
        return bytes;
      },
    };
    chain = chain
      .then(() => opts.onFile(file))
      .catch((err) => { failure ??= err; })
      .finally(() => { if (!counted.destroyed) counted.resume(); });
  });

  const finished = new Promise<void>((resolve, reject) => {
    bb.on("error", reject);
    bb.on("close", resolve);
  });

  const source = Readable.fromWeb(request.body as unknown as NodeReadableStream<Uint8Array>);
  source.pipe(bb);
  try {
    await finished;
  } catch (err) {
    source.destroy();
    throw err;
  }
  await chain;
  if (failure) throw failure;
  return { fields, files };
}
