export declare class ParseError extends Error {
}
export type Options = {
    debug?: boolean | ((...args: string[]) => void);
    recover?: boolean;
    transformImport?: (uri: string) => string;
};
/**
 * Transpiles TypeScript to JavaScript.
 *
 * Don't trust your production code with this. It takes some shortcuts, and I haven't looked at any standards documents to write this.
 * It's intended as a lightweight means for transpiling live example code in the browser and for other quick demo's and experiments.
 *
 * @param code The input TypeScript.
 * @param options An optional object containing the following optional properties:
 *   - `debug` When `true`, each consumed token is logged to stdout. If it's a function, the same is logged to the function.
 *   - `recover` When `true`, the function will attempt to continue transpilation when it encounters an error in the input (or unsupported syntax), instead of throwing. Errors are logged to `console.error`.
 *   - `transformImport` An async function that gets an `import` URI, and returns the URI to be include included in the transpiled output.
 * @returns The output JavaScript, if all went well.
 * @throws ParserError, if something went wrong.
 */
export declare function typestripped(code: string, { debug, recover, transformImport }?: Options): string;
