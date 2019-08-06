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
            if(typeof replacements[i].toString === "function") {
                replacements[i] = replacements[i].toString();
            } else if(typeof replacements[i] === "object") {
                const encoded = JSON.stringify(replacements[i]);
                if(encoded === "{}") {
                    if(typeof replacements[i].constructor === "object") {
                        if(typeof replacements[i].constructor.name === "string") {
                            replacements[i] = replacements[i].constructor.name;
                            continue;
                        }
                    }
                }

                replacements[i] = encoded;
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
