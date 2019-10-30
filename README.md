#Lumberjack
Lumberjack is a plugable utility to assist with the display and storage of logs.

By default, Lumberjack comes with two back-ends built in. One for use in the browser that stores logs in IndexedDB
and one for use with Node.js which stores logs on the local filesystem. You can add more back-ends by adding a plugin.

Due to our current resources, Lumberjack only supports the same platforms that Shopfront does, currently this is:

- Chrome (up to 2 versions from latest stable)
- Node.js (LTS)

Lumberjack may work on other platforms, however it is not tested on any others.

##Installation
You can add Lumberjack to your project by installing it using Yarn or NPM:

```bash
# Yarn
yarn add @shopfront/lumberjack

# NPM
npm --save @shopfront/lumberjack
```

Lumberjack is written in Typescript so you have the power of TypeScript definitions available to be used within
your IDE or text editor. You, however, are not required to use TypeScript when working with Lumberjack (but can).

##Examples
Lumberjack has been designed to be a drop in replacement for the global `console` object. You can use most of the
methods available on the `console` object on Lumberjack.

You'll first need to initalise Lumberjack with a back-end and settings:

```javascript
import { Lumberjack } from "@shopfront/lumberjack";

// If you're using in a browser, you'll want to use the IndexedDB back-end by default
import { IndexedDBBackend } from "@shopfront/lumberjack/Backends/IndexedDBBackend";

// If you're using Node.js, you'll want to use the file back-end by default
import { FileBackend } from "@shopfront/lumberjack/Backends/FileBackend";

const isBrowser = true;
const backend   = isBrowser ? new IndexedDBBackend() : new FileBackend();
const options   = {
    timestamp      : true,
    trace          : true,
    applicationName: "Lumberjack",
};

const lumberjack = new Lumberjack(backend, options);

// You can now use Lumberjack in place of console
lumberjack.log("Here is a log");
```

You can also swap the global console object with Lumberjack:

```javascript
const lumberjack    = new Lumberjack(backend);
const revertConsole = lumberjack.inject();

console.log("Here is a log"); // This will use Lumberjack's log method

// Revert back to using the original console
// Either:
revertConsole();
// Or:
lumberjack.revert();
```

##Method Reference
```javascript
const lumberjack = new Lumberjack(backend, options);
```

Creates the Lumberjack object.

*Arguments:*
- `backend`: (Required) Instance of `BaseBackend` - the backend to store the logs in,
- `options`: (Optional) Object - the options to use,
  - `options.timestamp`: (Optional) Boolean - whether to include the timestamp in the log,
  - `options.trace`: (Optional) Boolean - whether to include a basic trace of where the call came from (file and line) in the log,
  - `options.applicationName`: (Optional) String - The name of the application to include in the log
  
*Returns:* An instance of `Lumberjack`.

```javascript
const revoke = lumberjack.inject();
```

Swaps the platform's console implementation with Lumberjack (this will still output to the console).
This allows you to easily implement Lumberjack without changing where your logs currently are.

*Arguments:* None.

*Returns:* `() => void` - Calling this function will swap the console back to using the platform's
implementation rather than using Lumberjacks (the same as calling `revert`).

```javascript
lumberjack.revert();
```

This reverts the console to use the platform's implementation rather than the implementation provided by
Lumberjack. This has no effect if `inject` hasn't been called.

*Arguments:* None.

*Returns:* None.

```javascript
lumberjack.clear()
```

This clears the console, it does not affect Lumberjack's logging in any way.

*Arguments:* None.

*Returns:* None.

```javascript
lumberjack.debug(message, ...additionalParameters)
lumberjack.error(message, ...additionalParameters)
lumberjack.info(message, ...additionalParameters)
lumberjack.log(message, ...additionalParameters)
lumberjack.warn(message, ...additionalParameters)
```

This logs a debug message and stores it in the backend.

*Arguments:*
- `message`: (Optional) Any - The message to write to the console and the log,
- `...additionalParameters`: (Optional) Any - Any additional parameters you want to add

*Returns:* None.

```javascript
lumberjack.group(groupTitle)
lumberjack.groupCollapsed(groupTitle)
```

This groups all of the next logs (until `groupEnd` is called) and increases the namespace with the `groupTitle`.
Groups can be nested.

*Arguments:*
- `groupTitle`: (Optional) String - The title of the group / namespace.

*Returns:* None.

```javascript
lumberjack.groupEnd()
```

The stops the current group and decreases the namespace.

*Arguments:* None.

*Returns:* None.

```javascript
lumberjack.table(data, columns);
```

Creates a table in the log, similar to `console.table`.

*Arguments:*
- `data`: (Required) Any - The data to transform into a table (we apply a best guess to how it should be transformed,
it may not end up the same as `console.table`),
- `columns`: (Optional) Array of Strings - The columns to show, if not specified, we will show all columns

*Returns:* None.

```javascript
lumberjack.time(label)
```

Start a timer and log it.

*Arguments:*
- `label`: (Optional) String - The label for the timer, each timer must have a unique label

*Returns:* None.

```javascript
lumberjack.timeEnd(label)
```

End a timer and log it.

*Arguments:*
- `label`: (Optional) String - The label for an existing timer

*Returns:* None.

```javascript
lumberjack.trace(message, ...additionalParameters)
```

Log a stack trace.

*Arguments:*
- `message`: (Optional) Any - The message to write to the console and the log,
- `...additionalParameters`: (Optional) Any - Any additional parameters you want to add

*Returns:* None.

##Back-ends
Please see the table below for current back-ends. If you have developed a back-end and would like promote it, please
create a pull request and add it to the below table:


| Name | Author | Browsers | Node.js |
| --- | --- | :---: | :---: |
| [IndexedDB](#indexeddb-for-browsers) | [Shopfront](https://shopfront.com.au) | ✓ | ✗ |
| [File](#file-for-nodejs) | [Shopfront](https://shopfront.com.au) | ✗ | ✓ |

###Creating Your Own Back-end
You can create your own back-end by extending the `BaseBackend` class and implementing the log function:

```javascript
class MyCustomBackend extends BaseBackend {
    log(message, details) {
        // Store the message in some way
    }
}
```

The log function should not return anything (anything it does return is ignored) and it should accept the following arguments:

- `message`: String - The message that is to be logged,
- `details`: Object - The details about the message,
  - `details.timestamp`: Date - The date and time that the message occurred,
  - `details.arguments`: Array of Any - The arguments that were originally provided to the log function,
  - `details.namespaces`: Array of Strings - The namespaces that this message occurred in,
  - `details.level`: One of "ERROR", "WARNING", "NOTICE", "INFO", "DEBUG" - What level the message occurred at

As the return value for the log function is ignored, if you need to perform an asynchronous action, we would suggest building
a queue, you can reference the IndexedDBBackend.ts file to see how we accomplished this.

###IndexedDB (for browsers)
You can store the logs generated from Lumberjack in IndexedDB by using the IndexedDBBackend provided by Shopfront.

```javascript
import { Lumberjack } from "@shopfront/lumberjack";
import { IndexedDBBackend } from "@shopfront/lumberjack/lib/Backends/IndexedDBBackend";
const backend = new IndexedDBBackend({
    expire: null,
});

const lumberjack = new Lumberjack(backend);
```

The `IndexedDBBackend` constructor accepts an object that contains the following options:

- `expire`: (Optional) Null or Number - If null, logs will never expire, if a number, it is the number of seconds until
a log expires and will be deleted. This defaults to 7 days.
- `flushTimer`: (Optional) Number - The interval to flush items to IndexedDB. This defaults to 5 seconds. 

The `IndexedDBBackend` also includes an export function which retrieves all of the stored logs. It has the following
signature:

```javascript
const logs = await backend.export();
```

*Arguments:* None.

*Returns:* Promise of an Array of Objects:
- `timestamp`: Number - The Unix time that the message occurred,
- `arguments`: Array of Any - The arguments that were originally provided to the log function,
- `namespaces`: Array of Strings - The namespaces that this message occurred in,
- `level`: One of "ERROR", "WARNING", "NOTICE", "INFO", "DEBUG" - What level the message occurred at,
- `message`: String - The message that was logged

###File (for Node.js)
When using Node.js you can store the logs generated from Lumberjack in a single flat file by using the FileBackend provided
by Shopfront.

```javascript
import { Lumberjack } from "@shopfront/lumberjack";
import { FileBackend } from "@shopfront/lumberjack/lib/Backends/FileBackend";
const backend = new FileBackend({
    file: "/path/to/my.log",
});

const lumberjack = new Lumberjack(backend);
```

The `FileBackend` constructor accepts an object that contains the following options:

- `file`: (Optional) String - The file to store the logs in, this defaults to a file called *lumberjack.log* in the current
working directory.
