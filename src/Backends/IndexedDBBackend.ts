import { BaseBackend, LogDetails } from "../BaseBackend";
import * as Utilities from "../Utilities";

interface IndexedDBBackendOptions {
    expire: null | number;
    flushTimer: number;
    minimumRecordsToCompress: number;
    maxNumberOfLogs: null | number;
}

type StoredDetails = Omit<LogDetails, "timestamp"> & {
    timestamp: number;
    message: string;
};

export class IndexedDBBackend extends BaseBackend {
    protected global    : typeof globalThis;
    protected toFlush   : Array<StoredDetails>;
    protected indexedDB?: IDBDatabase;
    protected options   : IndexedDBBackendOptions;

    constructor(options: Partial<IndexedDBBackendOptions> = {}) {
        super();

        this.flushToDatabase = this.flushToDatabase.bind(this);
        this.global = Utilities.getGlobal();
        this.toFlush = [];

        this.options = {
            expire                  : 7 * 24 * 60 * 60 * 1000, // 7 Days
            flushTimer              : 5000, // 5 seconds
            minimumRecordsToCompress: 10,
            maxNumberOfLogs         : 100000,
            ...options,
        };

        this.setup();
    }

    /**
     * Setup the IndexedDB database
     */
    protected setup(): void {
        const openRequest = this.global.indexedDB.open("lumberjack-logs", 1);

        openRequest.onerror = event => {
            this.global.console.error("Lumberjack: Could not open the lumberjack-logs database", event);
        };

        openRequest.onsuccess = () => {
            this.indexedDB = openRequest.result;
            this.clearOldData();
            this.setupFlush();
        };

        openRequest.onupgradeneeded = event => {
            this.indexedDB = (event.target as IDBOpenDBRequest).result;
            const objectStore = this.indexedDB.createObjectStore("logs", {
                autoIncrement: true,
            });

            objectStore.createIndex("timestamp", "timestamp", {
                unique: false,
            });

            objectStore.createIndex("level", "level", {
                unique: false,
            });

            objectStore.transaction.oncomplete = () => {
                // Done
            };
        };
    }

    /**
     * Clear the expired logs
     */
    protected clearOldData(): void {
        if(!(this.indexedDB instanceof this.global.IDBDatabase)) {
            return;
        }

        if(this.options.expire !== null) {
            const oldest      = Date.now() - this.options.expire;
            const range       = IDBKeyRange.upperBound(oldest, true);
            const objectStore = this.indexedDB.transaction("logs", "readwrite").objectStore("logs");
            const index       = objectStore.index("timestamp");
            const storeCursor = index.openCursor(range);

            storeCursor.onerror = event => {
                this.global.console.error("Lumberjack: Could not clear old logs (timestamp)", event);
            };

            storeCursor.onsuccess = event => {
                const cursor = (event.target as IDBRequest).result;
                if(cursor) {
                    const request = cursor.delete();

                    request.onsuccess = () => cursor.continue();
                }
            };
        }

        if(this.options.maxNumberOfLogs !== null && this.options.maxNumberOfLogs < Infinity) {
            const maxNumberOfLogs = this.options.maxNumberOfLogs;
            const objectStore = this.indexedDB.transaction("logs", "readwrite").objectStore("logs");
            const storeCursor = objectStore.openCursor(null, "prev");

            let numberLookedAt = 0;
            storeCursor.onerror = event => {
                this.global.console.error("Lumberjack: Could not clear old logs (maximum)", event);
            };

            storeCursor.onsuccess = event => {
                const cursor = (event.target as IDBRequest).result;
                numberLookedAt++;
                if(cursor) {
                    if(numberLookedAt > maxNumberOfLogs) {
                        const request = cursor.delete();
                        request.onsuccess = () => cursor.continue();
                    } else {
                        cursor.continue();
                    }
                }
            };
        }
    }

    /**
     * Prepare to flush the logs to the database
     */
    protected setupFlush(): void {
        setInterval(this.flushToDatabase, this.options.flushTimer);
        this.global.addEventListener("beforeunload", this.flushToDatabase);
    }

    /**
     * Flush the logs to the database
     */
    protected async flushToDatabase(): Promise<void> {
        if(this.toFlush.length === 0) {
            return;
        }

        if(!(this.indexedDB instanceof this.global.IDBDatabase)) {
            return;
        }

        const data = this.toFlush;
        this.toFlush = [];

        let addData: (dataStore: IDBObjectStore) => void;

        if(typeof CompressionStream !== "undefined" && data.length >= this.options.minimumRecordsToCompress) {
            const stream = new CompressionStream("deflate");
            const bytes  = new TextEncoder().encode(JSON.stringify(data));
            const writer = stream.writable.getWriter();

            await writer.write(bytes);
            await writer.close();
            const buffer = await (new Response(stream.readable)).arrayBuffer();

            addData = dataStore => dataStore.add({ timestamp: Date.now(), buffer });
        } else {
            addData = dataStore => {
                for(let i = 0, l = data.length; i < l; i++) {
                    dataStore.add(data[i]);
                }
            };
        }

        return new Promise((res, rej) => {
            if(!(this.indexedDB instanceof this.global.IDBDatabase)) {
                return res();
            }

            const transaction = this.indexedDB.transaction(["logs"], "readwrite");
            transaction.onerror = event => {
                this.global.console.error("Lumberjack: Could not write data to IndexedDB", event);
                this.toFlush.push(...data);

                rej();
            };

            transaction.oncomplete = () => {
                res();
            };

            const logs = transaction.objectStore("logs");
            addData(logs);
        });
    }

    /**
     * @inheritDoc
     */
    public flush(): Promise<void> {
        return this.flushToDatabase();
    }

    /**
     * Log a message to the database
     * @param {string} message
     * @param {LogDetails} details
     */
    public log(message: string, details: LogDetails): void {
        this.toFlush.push({
            ...details,
            timestamp: details.timestamp.getTime(),
            arguments: details.arguments.map(argument => Utilities.encode(argument)),
            message,
        });
    }

    /**
     * Decompress a buffer back into an array of stored details
     * @param {ArrayBuffer} value
     * @returns {Promise<string>}
     * @protected
     */
    protected decompress(value: ArrayBuffer): Promise<Array<StoredDetails>> {
        const stream = new DecompressionStream("deflate");
        const writer = stream.writable.getWriter();

        void writer.write(value);
        void writer.close();

        return (new Response(stream.readable)).arrayBuffer()
            .then(buffer => new TextDecoder().decode(buffer))
            .then(content => JSON.parse(content));
    }

    /**
     * Export the IndexedDB database
     * @returns {Promise<Array<StoredDetails>>}
     */
    public export(): Promise<Array<StoredDetails>> {
        if(!this.indexedDB) {
            throw new Error("IndexedDB has not been initialised");
        }

        const objectStore = this.indexedDB.transaction("logs").objectStore("logs");

        return new Promise((res, rej) => {
            const data: Array<StoredDetails> = [];
            const opened = objectStore.openCursor();

            opened.onerror = event => {
                this.global.console.error("Lumberjack: Error occurred while exporting", event);
                rej(event);
            };

            opened.onsuccess = event => {
                const cursor = (event.target as IDBRequest).result;
                if(cursor) {
                    if("buffer" in cursor.value && cursor.value.buffer instanceof ArrayBuffer) {
                        this.decompress(cursor.value.buffer)
                            .then(content => {
                                data.push(...content);
                                cursor.continue();
                            });
                    } else if(cursor.value instanceof ArrayBuffer) {
                        this.decompress(cursor.value)
                            .then(content => {
                                data.push(...content);
                                cursor.continue();
                            });
                    } else {
                        data.push(cursor.value);
                        cursor.continue();
                    }
                } else {
                    // Nothing left
                    res(data);
                }
            };
        });
    }

    public exportBatch(entryRunner: (entries: Array<StoredDetails>) => Promise<void>, entriesAtOnce: number = 100): Promise<void> {
        if(!this.indexedDB) {
            throw new Error("IndexedDB has not been initialised");
        }

        const objectStore = this.indexedDB.transaction("logs").objectStore("logs");

        return new Promise((res, rej) => {
            let buffered: Array<StoredDetails> = [];
            const opened = objectStore.openCursor();
            let empty    = false;
            const remainingPromises: Array<Promise<void>> = [];

            const sendBuffered = () => {
                if(buffered.length >= entriesAtOnce || empty) {
                    remainingPromises.push(entryRunner(buffered));
                    buffered = [];
                }

                if(empty) {
                    Promise.all(remainingPromises)
                        .then(() => res());
                }
            };

            opened.onerror = event => {
                this.global.console.error("Lumberjack: Error occurred while exporting", event);
                rej(event);
            };

            opened.onsuccess = event => {
                const cursor = (event.target as IDBRequest).result;
                if(cursor) {
                    if("buffer" in cursor.value && cursor.value.buffer instanceof ArrayBuffer) {
                        this.decompress(cursor.value.buffer)
                            .then(content => {
                                buffered.push(...content);
                                sendBuffered();
                            });

                        cursor.continue();
                        return;
                    } else if(cursor.value instanceof ArrayBuffer) {
                        this.decompress(cursor.value)
                            .then(content => {
                                buffered.push(...content);
                                sendBuffered();
                            });

                        cursor.continue();
                        return;
                    }

                    buffered.push(cursor.value);
                    cursor.continue();
                } else {
                    empty = true;
                }

                sendBuffered();
            };
        });
    }
}
