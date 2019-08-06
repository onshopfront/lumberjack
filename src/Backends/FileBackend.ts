import { BaseBackend, LogDetails } from "../BaseBackend";
import * as Utilities from "../Utilities";
import fs from "fs";
import path from "path";

interface FileBackendOptions {
    file: string;
}

export class FileBackend extends BaseBackend {
    protected global : typeof globalThis;
    protected options: FileBackendOptions;
    protected stream?: fs.WriteStream;
    protected ready  : boolean;
    protected waiting: Array<string>;

    constructor(options: Partial<FileBackendOptions> = {}) {
        super();

        this.global  = Utilities.getGlobal();
        this.ready   = false;
        this.waiting = [];
        this.options = {
            file: path.resolve(process.cwd(), "./lumberjack.log"),
            ...options,
        };

        this.setup();
    }

    /**
     * Setup the file to write to
     */
    protected setup(): void {
        this.stream = fs.createWriteStream(this.options.file);

        this.stream.on("ready", () => {
            this.ready = true;
            this.write(this.waiting);
            this.waiting = [];
        });
    }

    /**
     * Write a message to the stream
     * @param {Array<string>} messages
     */
    protected write(messages: Array<string>): void {
        if(messages.length === 0) {
            return;
        }

        if(!this.ready) {
            this.waiting = [
                ...this.waiting,
                ...messages,
            ];

            return;
        }

        if(typeof this.stream === "undefined") {
            return;
        }

        const lines      = messages.join("\r\n");
        const successful = this.stream.write(lines);

        if(!successful) {
            this.stream.once("drain", () => {
                this.write(messages);
            });
        }
    }

    /**
     * Log a message
     * @param {string} message
     * @param {LogDetails} details
     */
    public log(message: string, details: LogDetails): void {
        this.write([message]);
    }
}
