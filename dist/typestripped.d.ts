export declare class ParseError extends Error {
}
/**
 * Transpiles TypeScript to JavaScript.
 *
 * Don't trust your production code with this. It takes some shortcuts, and I haven't looked at any standards documents to write this.
 * It's intended as a lightweigth means for transpiling live example code in the browser.
 *
 * @param code The input TypeScript.
 * @param debug When `true`, each consumed token is logged to stdout. If it's a function, the same is logged to the function.
 * @param recover When `true`, the function will attempt to continue transpilation when it encounters an error in the input (or unsupported syntax), instead of throwing. Errors are logged to `console.error`.
 * @returns The output JavaScript, if all went well.
 * @throws ParserError, if something went wrong.
 */
export declare function typestripped(code: string, debug?: boolean | ((...args: string[]) => void), recover?: boolean): string;
