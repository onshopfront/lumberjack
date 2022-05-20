/* tslint:disable:max-classes-per-file */
type CompressionFormat = "gzip" | "deflate";

declare class CompressionStream implements GenericTransformStream {
    public readonly readable: ReadableStream;
    public readonly writable: WritableStream;

    constructor(format: CompressionFormat);
}

declare class DecompressionStream implements GenericTransformStream {
    public readonly readable: ReadableStream;
    public readonly writable: WritableStream;

    constructor(format: CompressionFormat);
}
