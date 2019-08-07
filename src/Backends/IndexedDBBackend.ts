import { BaseBackend, LogDetails } from "../BaseBackend";
import * as Utilities from "../Utilities";

interface IndexedDBBackendOptions {
    expire: null | number;
}

type StoredDetails = Omit<LogDetails, "timestamp"> & {
    timestamp: number;
    message  : string;
};

export class IndexedDBBackend extends BaseBackend {
    protected global    : typeof globalThis;
    protected toFlush   : Array<StoredDetails>;
    protected indexedDB?: IDBDatabase;
    protected options   : IndexedDBBackendOptions;

    constructor(options: Partial<IndexedDBBackendOptions> = {}) {
        super();

        this.flush   = this.flush.bind(this);
        this.global  = Utilities.getGlobal();
        this.toFlush = [];

        this.options = {
            expire: 7 * 24 * 60 * 60 * 1000, // 7 Days
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

        if(this.options.expire === null) {
            return; // Don't expire the logs
        }

        const oldest      = Date.now() - this.options.expire;
        const range       = IDBKeyRange.upperBound(oldest, true);
        const objectStore = this.indexedDB.transaction("logs", "readwrite").objectStore("logs");
        const index       = objectStore.index("timestamp");
        const storeCursor = index.openCursor(range);

        storeCursor.onerror = event => {
            this.global.console.error("Lumberjack: Could not clear old logs", event);
        };

        storeCursor.onsuccess = event => {
            const cursor = (event.target as IDBRequest).result;
            if(cursor) {
                const request = cursor.delete();

                request.onsuccess = () => cursor.continue();
            }
        };
    }

    /**
     * Prepare to flush the logs to the database
     */
    protected setupFlush(): void {
        setInterval(this.flush, 5000);
        this.global.addEventListener("beforeunload", this.flush);
    }

    /**
     * Flush the logs to the database
     */
    protected flush(): void {
        if(this.toFlush.length === 0) {
            return;
        }

        if(!(this.indexedDB instanceof this.global.IDBDatabase)) {
            return;
        }

        const data   = this.toFlush;
        this.toFlush = [];

        const transaction = this.indexedDB.transaction(["logs"], "readwrite");
        transaction.onerror = event => {
            this.global.console.error("Lumberjack: Could not write data to IndexedDB", event);
            this.toFlush.push(...data);
        };

        const logs = transaction.objectStore("logs");
        for(let i = 0, l = data.length; i < l; i++) {
            logs.add(data[i]);
        }
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
                    data.push(cursor.value);
                    cursor.continue();
                } else {
                    // Nothing left
                    res(data);
                }
            };
        });
    }
}
