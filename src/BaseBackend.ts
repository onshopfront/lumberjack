import { VerbosityLevel } from "./Lumberjack";

export interface LogDetails {
    timestamp : Date;
    arguments : Array<any>;
    namespaces: Array<string>;
    level     : VerbosityLevel;
}

export abstract class BaseBackend {
    public abstract log(message: string, details: LogDetails): void;
}
