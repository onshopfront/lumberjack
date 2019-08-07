import * as Utilities from "./Utilities";
import { BaseBackend } from "./BaseBackend";

interface LumberjackOptions {
    timestamp?      : boolean;
    trace?          : boolean;
    applicationName?: string;
}

export enum VerbosityLevel {
    ERROR   = "ERROR",
    WARNING = "WARNING",
    NOTICE  = "NOTICE",
    INFO    = "INFO",
    DEBUG   = "DEBUG",
}

export class Lumberjack {
    protected global    : typeof globalThis;
    protected console   : any;
    protected backend   : BaseBackend;
    protected namespaces: Array<string>;
    protected timers    : Map<string, Date>;
    protected options   : LumberjackOptions;

    constructor(backend: BaseBackend, options: LumberjackOptions = {}) {
        this.global     = Utilities.getGlobal();
        this.console    = this.global.console;
        this.backend    = backend;
        this.namespaces = [];
        this.timers     = new Map();
        this.options    = options;
    }

    /**
     * Inject Lumberjack to replace the console on the window / global
     * @returns {() => void}
     */
    public inject(): () => void {
        const removal = () => {
            this.revert();
        };

        // @ts-ignore
        this.global.console = this;

        return removal;
    }

    /**
     * Revert the console to the original console
     */
    public revert(): void {
        // @ts-ignore
        this.global.console = this.console;
    }

    /**
     * Decorate the message
     * @param {T} message
     * @returns {T}
     */
    protected decorateMessage<T>(message: T): T {
        if(typeof message === "string") {
            let prepend = "";
            let append  = "";

            if(this.options.timestamp) {
                prepend = `[${(new Date()).toISOString()}]`;
            }

            if(this.options.applicationName) {
                prepend = `${prepend} ${this.options.applicationName}`.trim();
                prepend = `${prepend}:`;
            }

            if(this.options.trace) {
                const trace = (new Error()).stack;
                if(trace) {
                    const split = trace.split("\n");
                    const line  = split[split.length - 3].trim();
                    append      = `${line}`;
                }
            }

            return `${prepend} ${message} ${append}`.trim() as unknown as T; // For some reason
        } else {
            return message;
        }
    }

    /**
     * Assemble a message into a string
     * @param message
     * @param {Array<*>} optionalParams
     * @returns {string}
     */
    protected assembleMessage(message: any, optionalParams: Array<any>): string {
        if(typeof message === "string") {
            return Utilities.printf(message, optionalParams);
        } else if(typeof message === "undefined") {
            let log = "";
            for(let i = 0, l = optionalParams.length; i < l; i++) {
                log = `${log} ${this.assembleMessage(optionalParams[i], [])}`;
            }

            return log;
        } else if(typeof message === "object") {
            let log = Utilities.encode(message);

            for(let i = 0, l = optionalParams.length; i < l; i++) {
                log = `${log} ${this.assembleMessage(optionalParams[i], [])}`;
            }

            return log;
        } else if(typeof message.toString === "function") {
            return message.toString();
        }

        return "";
    }

    /**
     * Send the log to the backed
     * @param {VerbosityLevel} level
     * @param message
     * @param {Array<*>} optionalParams
     */
    protected sendToBackend(level: VerbosityLevel, message: any, optionalParams: Array<any>): void {
        const log = this.assembleMessage(message, optionalParams);

        this.backend.log(log, {
            timestamp: new Date(),
            arguments: [
                message,
                ...optionalParams,
            ],
            namespaces: this.namespaces,
            level,
        });
    }

    /**
     * Clear the console, this does not clear the history or storage of Lumberjack
     */
    public clear(): void {
        this.console.clear();
    }

    /**
     * Write a debug message
     * @param message
     * @param optionalParams
     */
    public debug(message?: any, ...optionalParams: Array<any>): void {
        message = this.decorateMessage(message);

        this.console.debug(message, ...optionalParams);
        this.sendToBackend(VerbosityLevel.DEBUG, message, optionalParams);
    }

    /**
     * Write an error message
     * @param message
     * @param optionalParams
     */
    public error(message?: any, ...optionalParams: Array<any>): void {
        message = this.decorateMessage(message);

        this.console.error(message, ...optionalParams);
        this.sendToBackend(VerbosityLevel.ERROR, message, optionalParams);
    }

    /**
     * Group a set of logs
     * @param {string} groupTitle
     */
    public group(groupTitle?: string): void {
        this.console.group(groupTitle);

        if(!groupTitle) {
            groupTitle = "";
        }

        this.namespaces.push(groupTitle);
    }

    /**
     * Group and collapse a set of logs (collapsing does not affect Lumberjack)
     * @param {string} groupTitle
     */
    public groupCollapsed(groupTitle?: string): void {
        this.console.groupCollapsed(groupTitle);

        if(!groupTitle) {
            groupTitle = "";
        }

        this.namespaces.push(groupTitle);
    }

    /**
     * End a group and remove the last namespace
     */
    public groupEnd(): void {
        this.console.groupEnd();
        this.namespaces.pop();
    }

    /**
     * Write an informational message
     * @param message
     * @param optionalParams
     */
    public info(message?: any, ...optionalParams: Array<any>): void {
        message = this.decorateMessage(message);

        this.console.info(message, ...optionalParams);
        this.sendToBackend(VerbosityLevel.INFO, message, optionalParams);
    }

    /**
     * Write a basic log
     * @param message
     * @param optionalParams
     */
    public log(message?: any, ...optionalParams: Array<any>): void {
        message = this.decorateMessage(message);

        this.console.log(message, ...optionalParams);
        this.sendToBackend(VerbosityLevel.NOTICE, message, optionalParams);
    }

    /**
     * Assemble a table from arrays into markdown
     * @param {Array<string>} headers
     * @param {Array<string | Array<string>>} data
     * @returns {string}
     */
    protected assembleTable(headers: Array<string>, data: Array<string | Array<string>>): string {
        if(headers.length === 0) {
            return "";
        }

        let table = "| (index) |";
        for(let i = 0, l = headers.length; i < l; i++) {
            table = `${table} ${headers[i]} |`;
        }

        table = `${table}\r\n| --- |`;
        for(let i = 0, l = headers.length; i < l; i++) {
            table = `${table} --- |`;
        }

        table = `${table}\r\n|`;

        for(let i = 0, l = data.length; i < l; i++) {
            table = `${table} ${i} |`;

            if(Array.isArray(data[i])) {
                for(let j = 0, n = data[i].length; j < n; j++) {
                    table = `${table} ${data[i][j]} |`;
                }
            } else {
                table = `${table} ${data[i]} |`;
            }

            table = `${table}\r\n`;
        }

        return table;
    }

    /**
     * Write a table to the console, an approximate version is also stored
     * @param data
     * @param {Array<string>} columns
     */
    public table(data: any, columns?: Array<string>): void {
        let table;
        if(Array.isArray(data)) {
            const headers   = [];
            const tableData = [];

            if(data.length === 0) {
                this.log(data);
                return;
            } else {
                if(Array.isArray(data[0])) {
                    for(let i = 0, l = data[0].length; i < l; i++) {
                        headers.push(i);
                    }

                    for(let i = 0, l = data.length; i < l; i++) {
                        const row = [];
                        for(let j = 0, n = headers.length; j < n; j++) {
                            if(typeof data[i][headers[j]] === "undefined") {
                                row.push("");
                            } else {
                                row.push(data[i][headers[j]]);
                            }
                        }

                        tableData.push(row);
                    }
                } else {
                    headers.push("Values");
                    for(let i = 0, l = data.length; i < l; i++) {
                        tableData.push(data[i]);
                    }
                }
            }

            table = this.assembleTable(headers.map(header => header.toString()), tableData);
        } else if(typeof data === "object") {
            let headers = [];
            for(const i in data) {
                if(!data.hasOwnProperty(i)) {
                    continue;
                }

                headers.push(i);
            }

            if(typeof columns !== "undefined") {
                headers = Utilities.intersectArrays(headers, columns);
            }

            const tableData = [];
            for(let i = 0, l = headers.length; i < l; i++) {
                tableData.push(data[headers[i]]);
            }

            table = this.assembleTable(headers, tableData);
        } else {
            this.log(data);
            return;
        }

        this.console.table(data, columns);
        this.sendToBackend(VerbosityLevel.NOTICE, table, []);
    }

    /**
     * Start a timer
     * @param {string} label
     */
    public time(label?: string): void {
        if(typeof label === "undefined") {
            label = "";
        }

        if(this.timers.has(label)) {
            this.console.warn(`The timer "${label}" has already been started`);
            return;
        }

        this.console.time(label);
        this.timers.set(label, new Date());
        this.sendToBackend(VerbosityLevel.NOTICE, this.decorateMessage(`Started timer "${label}"`), []);
    }

    /**
     * End a timer
     * @param {string} label
     */
    public timeEnd(label?: string): void {
        if(typeof label === "undefined") {
            label = "";
        }

        if(!this.timers.has(label)) {
            this.console.warn(`The timer "${label}" has not been started`);
            return;
        }

        this.console.timeEnd(label);
        const timer = this.timers.get(label) as Date;
        const now   = new Date();
        this.timers.delete(label);

        const difference = timer.getTime() - now.getTime();

        this.sendToBackend(VerbosityLevel.NOTICE, this.decorateMessage(`Ended timer "${label}", time taken was ${difference} seconds`), []);
    }

    /**
     * Perform a trace
     * @param message
     * @param optionalParams
     */
    public trace(message?: any, ...optionalParams: Array<any>): void {
        message = this.decorateMessage(message);
        this.console.trace(message, ...optionalParams);

        const trace = (new Error()).stack;
        optionalParams.push(trace);

        this.sendToBackend(VerbosityLevel.NOTICE, message, optionalParams);
    }

    /**
     * Write a warning message
     * @param message
     * @param optionalParams
     */
    public warn(message?: any, ...optionalParams: Array<any>): void {
        message = this.decorateMessage(message);
        this.console.log(message, ...optionalParams);
        this.sendToBackend(VerbosityLevel.WARNING, message, optionalParams);
    }
}
