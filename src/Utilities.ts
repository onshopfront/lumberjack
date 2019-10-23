declare var global: any;

/**
 * Get the global object
 * @returns {WindowOrWorkerGlobalScope}
 */
export function getGlobal(): typeof globalThis {
    if(typeof globalThis !== "undefined") {
        return globalThis;
    }

    if(typeof window !== "undefined") {
        return window as never as typeof globalThis;
    }

    if(typeof self !== "undefined") {
        return self as never as typeof globalThis;
    }

    if(typeof global !== "undefined") {
        return global;
    }

    throw new Error("Could not find global object");
}

/**
 * Perform a basic replacement using the console's styling
 * Inspired / stolen from https://github.com/tmpfs/format-util/blob/master/format.js
 * @param {string} message
 * @param {Array<*>} replacements
 * @returns {string}
 */
export function printf(message: string, replacements: Array<any>): string {
    const replace = /(%?)(%([oOdisfc]))/g;
    message = message.replace(replace, (match, escaped, patten, flag) => {
        let replacement = replacements.shift();
        switch(flag) {
            case "o":
            case "O":
                replacement = JSON.stringify(replacement);
                break;
            case "d":
            case "i":
            case "f":
                replacement = Number(replacement);
                break;
            case "s":
                if(typeof replacement.toString === "function") {
                    replacement = replacement.toString();
                } else {
                    replacement = `${replacement}`;
                }

                break;
            case "c":
                replacement = ""; // Discard styling
                break;
        }

        if(!escaped) {
            return replacement;
        }

        replacements.unshift(replacement);
        return match;
    });

    if(replacements.length) {
        for(let i = 0, l = replacements.length; i < l; i++) {
            if(typeof replacements[i] === "object") {
                replacements[i] = encode(replacements[i]);
            } else if(!!replacements[i] && typeof replacements[i].toString === "function") {
                replacements[i] = replacements[i].toString();
            }
        }

        message = `${message} ${replacements.join(" ")}`;
    }

    message = message.replace(/%{2}/g, "%");

    return message;
}

/**
 * Get the intersection of all the provided arrays
 * @param {Array<*>} arrays
 * @returns {Array<*>}
 */
export function intersectArrays(...arrays: Array<Array<any>>): Array<any> {
    if (arrays.length === 0) {
        return [];
    }

    let results = [...new Set(arrays.shift())];

    for (let i = 0, l = arrays.length; i < l; i++) {
        if (results.length === 0) {
            return [];
        }

        results = results.filter(x => new Set(arrays[i]).has(x));
    }

    return results;
}

/**
 * Encode an item into a string
 * @param item
 * @returns {string}
 */
export function encode(item: any): string {
    if (!item) {
        return "";
    } else if(typeof item === "object") {
        const encoded = JSON.stringify(item);
        if(encoded === "{}" && Object.keys(item).length !== 0) {
            if(typeof item.constructor === "object") {
                if(typeof item.constructor.name === "string") {
                    return item.constructor.name;
                }
            }
        }

        return encoded;
    }

    if(typeof item.toString === "function") {
        return item.toString();
    }

    return item;
}
