export class ParseError extends Error {}

function descr(regexp: RegExp, string): RegExp {
    regexp.toString = () => '<'+string+'>';
    return regexp;
}

const
// Atoms
    WHITESPACE = descr(/(\s|\/\/.*|\/\*[\s\S]*?\*\/)+/y, "whitespace"),
    IDENTIFIER = descr(/[a-zA-Z_$][0-9a-zA-Z_$]*/y, "identifier"),
    STRING = descr(/(['"])(?:(?=(\\?))\2.)*?\1/y, "string"),
    NUMBER = descr(/[+-]?(?:0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/y, "number"),
    OPERATOR = descr(/instanceof\b|in\b|[!=]==|\|\|=?|>>=?|<<=?|&&=?|[+\-*\/%&|^!=<>]=|[+\-*\/%&|^=<>]/y, "bin-op"),
    BACKTICK_STRING = descr(/[\s\S]*?(\${|`)/y, "`string`"),
    EXPRESSION_PREFIX = descr(/\+\+|--|!|~|\+|-|typeof\b|delete\b|await\b/y, "unary-op"),
    REGEXP = descr(/\/(\\.|[^\/])+\/[gimsuyd]*/y, "regexp"),    
// Other regexes
    ANYTHING = /[\s\S]/y,
    ALL_NOT_WHITESPACE = /\S/g,
    ALPHA_NUM = /^[a-zA-Z0-9]+$/;

export type Options = {
    debug?: boolean | ((...args: string[]) => void),
    recover?: boolean,
    transformImport?: (uri: string) => string,
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
export function typestripped(code: string, {debug,recover,transformImport}: Options = {}): string {
    let pos = 0; // Current char in `code`
    let line = 1; // Line number for `pos`
    let col = 1; // Column for `pos`
    let out = ''; // The output we've created so far
    let skipping = 0; // When > 0, we're writing whitespace instead of actual output
    let peeking = 0; // When > 0, we're within `skip()` sneekily reading ahead (reverting all state when we're done)
    let attempting = 0; // When > 0, we within `attempt()`, meaning on error we have a fallback point for another parsing strategy
    let matchOptions: Set<RegExp | string | ParseError | (RegExp | string)[]> = new Set(); // The set of tokens we've tried and failed to match at this `pos`
    let postNewline = true; // We've muffled away a newline after the previous token (for semicolon insertion)
    let statementOutStart = 0; // The length of `out` before we started working on a new statement (used by `wipestatement()`)

    parseMain();
    return out;


    ///// Recursive decent parser functions /////

    function parseMain() {
        eat(WHITESPACE);
        while(pos < code.length) must(recoverErrors(parseStatement, true));
    }

    function parseStatement() {
        // if (a==3) throw new Error();
        statementOutStart = out.length;

        if (parseVarDecl() || parseTypeDecl() || parseBlock() || parseExport() || parseEnum() || parseClass() ||
            parseReturn() || parseIfWhile() || parseThrow() || parseDoWhile() || parseFor() || parseImport() ||
            parseTry() || parseDeclare() || parseSwitch() || parseExpressionStatement() || eat(';')) return true;
        return false;
    }

    function parseExpressionStatement() {
        if (!parseExpressionSeq()) return false;
        mustEos();
        return true;
    }

    function parseExport() {
        // export class X {];
        if (!eat('export')) return false;

        if (eat('default')) {
            must(parseExpression() || parseClass());
        } else {            
            must(parseVarDecl() || parseTypeDecl() || parseClass() || parseExpression() || parseLiteralObject());
        }
        mustEos();
        return true;
    }

    function parseVarDecl() {
        // let x = 3;
        if (!eat('let') && !eat('const') && !eat('var')) return false;
        if (peek('enum')) {
            console.error("Const enums are not supported");
            return parseEnum();
        }
        while(true) {
            must(eat(IDENTIFIER)); // var name
            if (skip(':')) {
                must(skip(parseType));
            }
            if (eat('=')) must(parseExpression);
            if (!eat(',')) break;
        }
        mustEos();
        return true;
    }
    
    function parseTypeDecl() {
        // type X = number | string;
        if (!skip('type')) return false;
        wipeStatement(); // remove 'export' if it was there
        must(skip(IDENTIFIER)); // var name
        skip(parseTemplateDef);
        if (skip('=')) must(skip(parseType));
        mustEos();
        return true;
    }

    function parseEnum() {
        // enum Directions { Up, Down }
        let oldOutLen = out.length;
        if (!eat('enum')) return false;
        let identifier = must(eat(IDENTIFIER));
        must(eat('{'))

        replaceOutput(oldOutLen, `var ${identifier} = (function (${identifier}) {`);
        let nextNum = 0, repeat = true;
        while(repeat) {
            oldOutLen = out.length;
            let option = eat(IDENTIFIER);
            if (!option) break;
            if (eat('=')) {
                nextNum = parseInt(must(eat(NUMBER)));
            }
            if (!eat(',')) repeat = false;
            replaceOutput(oldOutLen, `${identifier}[(${identifier}["${option}"] = ${nextNum++})] = "${option}";`);
        }

        oldOutLen = out.length;
        must(eat('}'));
        replaceOutput(oldOutLen, `return ${identifier};})(${identifier} || {});`);
        return true;
    }
    
    function parseReturn() {
        // return 123;
        // yield 234;
        if (!eat('return') && !eat('yield')) return false;
        parseExpression();
        mustEos();
        return true;
    }

    function parseIfWhile() {
        // if (go) launch(); else abort();
        const name = eat('if') || eat('while');
        if (!name) return false;
        must(eat('('));
        must(parseExpression);
        must(eat(')'));
        must(parseStatement);
        if (name==='if' && eat('else')) must(parseStatement);
        return true;
    }

    function parseThrow() {
        // throw Error();
        if(!eat('throw')) return false;
        must(parseExpression);
        mustEos();
        return true;
    }

    function parseDoWhile() {
        // do { this() } while (that);
        if (!eat('do')) return false;
        must(parseStatement);
        must(eat('while'));
        must(eat('('));
        must(parseExpression);
        must(eat(')'));
        mustEos();
        return true;
    }

    function parseFor() {
        // for(let x=0; x<10; x++) log(x);
        // for(let x of xs) {}
        if (!eat('for')) return false;
        must(eat('('));
        if (eat('let') || eat('const') || eat('var')) {
            must(eat(IDENTIFIER));
            if (skip(':')) must(skip(parseType));
            if (eat('=')) must(parseExpression);
        } else {
            parseExpressionSeq(); // may also be empty
        }
        if (eat('of') || eat('in')) {
            must(parseExpressionSeq());
        } else {
            must(eat(';'))
            parseExpressionSeq(); // may also be empty
            must(eat(';'))
            parseExpressionSeq(); // may also be empty
        }
        must(eat(')'));
        must(parseStatement);
        return true;
    }

    function parseSwitch() {
        if (!eat('switch')) return false;
        must(eat('('));
        must(parseExpression);
        must(eat(')'));
        must(eat('{'));
        let inCase = false;
        while(!eat('}')) {
            if ((eat('case') && must(parseExpression)) || eat('default')) {
                must(eat(':'));
                inCase = true;
            } else {
                must(inCase && recoverErrors(parseStatement));
            }
        }
    }

    function parseImport() {
        // import * as x from 'file';
        // import {a,b as c} from 'file';
        if (!eat('import')) return false;
        if (eat('*')) {
            must(eat('as'));
            must(eat(IDENTIFIER));
        }
        else {
            must(eat('{'));
            while(true) {
                if (!eat(IDENTIFIER)) break;
                if (eat('as')) must(eat(IDENTIFIER));
                if (!eat(',')) break;
            }
            must(eat('}'));
        }
        must(eat('from'));
        let stringStart = out.length;
        must(eat(STRING));
        if (transformImport) {
            let url = out.substring(stringStart+1, out.length-1);
            url = transformImport(url);
            replaceOutput(stringStart, '"'+url+'"');
        }
        mustEos();
        return true;
    }

    function parseTry() {
        // try { something(); } catch(e: any) { log(e); } finally { log('done'); }
        if (!eat('try')) return;
        must(parseBlock);
        if (eat('catch')) {
            if (eat('(')) {
                must(eat(IDENTIFIER));
                if (skip(':')) must(skip(parseType));
                must(eat(')'));
            }
            must(parseBlock);
        }
        if (eat('finally')) must(parseBlock);
        return true;
    }

    function parseDeclare() {
        // declare global { interface String { x(): void; }}
        if (!skip('declare')) return false;
        skip('enum');
        must(skip(IDENTIFIER));
        must(skip(parseBlock));
        return true;
    }

    function parseBlock() {
        // { x=3; log(x); }
        if (!eat('{')) return false;
        while(!eat('}')) must(recoverErrors(parseStatement, true));
        return true;
    }

    function parseTemplateDef() {
        // <A, B extends number|string>
        if (skip('<')) {
            while(true) {
                must(skip(IDENTIFIER));
                if (skip('extends')) must(skip(parseType));
                if (!skip(',')) break;
            }
            must(skip('>'));
            return true;
        }
        return false;
    }

    function parseFuncParams(isConstructor=false) {
        let fields = "";
        // (public a, b?: string, c=3, ...d: any[])
        if (!eat('(')) return false;
        while (true) {
            // ... cannot be combined with access modifiers
            if (eat('...')) must(eat(IDENTIFIER));
            else if (isConstructor && (skip('public') || skip('private') || skip('protected'))) {
                const name = must(eat(IDENTIFIER));
                fields += `this.${name}=${name};`
            }
            else if (!eat(IDENTIFIER)) break;
            skip('?');
            if (skip(':')) must(skip(parseType));
            if (eat('=')) must(parseExpression);
            if (!eat(',')) break;
        }
        must(eat(')'));
        return isConstructor && fields ? fields : true;
    }


    function parseFunction() {
        // async function<T>(a: T): T { return a+1; }
        // async function<T>(a: T): T;
        if (!eat('async', 'function') && !eat('function')) return false;
        eat(IDENTIFIER);
        parseTemplateDef();
        must(parseFuncParams);
        if (skip(':')) must(skip(parseType));
        if (parseBlock()) return true;

        // Turns out this is an overload signature. Let's replace everything we've just written (incl 'export') by spaces.
        mustEos();
        wipeStatement();
        return true;
    }

    function parseArrowFunction() {
        // <A,B>(a: A, b: B): A|B => a || b
        // async (a,b) => { await log(a); await log(b); }
        if (!attempt(() => {
            eat('async');
            parseTemplateDef();
            if (!parseFuncParams() && !eat(IDENTIFIER)) return false;
            if (skip(':')) must(skip(parseType));
            if (!eat('=>')) return false;
            return true;
        })) return false;

        must(parseBlock() || parseExpression());
        return true;
    }

    function parseSequence() {
        // (3+4, test(), ()=>123)
        if (!eat('(')) return false;
        must(parseExpressionSeq);
        must(eat(')'));
        return true;
    }

    function parseExpressionSeq() {
        // 3+4, test(), ()=>123
        if (!parseExpression()) return false;
        while (eat(',')) must(parseExpression);
        return true;
    }

    function parseExpression() {
        // (3+4+test()) / c!.cnt++ as any
        let required = false;
        while(eat(EXPRESSION_PREFIX)) required = true;

        if (eat('new')) required = true;
        
        // IDENTIFIER also covers things like `break` and `continue`
        if (eat(STRING) || parseBacktickString() || eat(NUMBER) || parseClass() || parseFunction() || parseArrowFunction() || parseSequence() || eat(IDENTIFIER) || parseLiteralArray() || parseLiteralObject() || eat(REGEXP)) {}
        else {
            if (required) must(false);
            return false;
        }

        while(true) {
            if (peek('(')) parseCall();
            else if (peek('[')) parseIndex();
            else if (eat('++') || eat('--')) {}
            else if (skip('as')) must(skip(parseType));
            else if (eat('?.')) must(eat(IDENTIFIER) || parseIndex());
            else if (eat('.')) must(eat(IDENTIFIER));
            else if (peek('<') && parseTemplateArg()) {}
            else if (eat(OPERATOR)) {
                must(parseExpression);
                return true;
            }
            else if (skip('!')) {}
            else break;
        }

        if (eat('?')) {
            must(parseExpression);
            must(eat(':'));
            must(parseExpression);
        }
        return true;
    }

    function parseBacktickString() {
        // `The answer: ${3+4}.. ${`test`}`
        if (!eat('`')) return false;
        while(true) {
            let m = must(eat(BACKTICK_STRING));
            if (m.slice(-1) === '`') break;
            // interpolate
            must(parseExpression);
            must(eat('}'));
        }
        return true;
    }

    function parseLiteralArray() {
        // [3, 'test', func() as string, ...more]
        if (!eat('[')) return false;
        while (true) {
            if (eat('...')) must(parseExpression);
            else parseExpression(); // Can be empty: [1 ,,, 2] is valid
            if (!eat(',')) break;
        }
        must(eat(']'));
        return true;
    }
        
    function parseLiteralObject() {
        // {...original, x: 1, y, [myVar as number]: 24, myFunc<T>(t: T) { return t+1 }}
        if (!eat('{')) return false;
        while (true) {
            if (eat('...')) must(parseExpression);
            else {
                eat('*'); // generator support
                if (eat('[')) {
                    must(parseExpression);
                    must(eat(']'));
                }
                else {
                    if (!eat(IDENTIFIER) && !eat(NUMBER) && !eat(STRING) && !parseBacktickString) break;
                }
                if ((parseTemplateDef() && must(parseFuncParams())) || parseFuncParams()) {
                    // it's a function shortcut
                    if (skip(':')) {
                        skip(parseType);
                    }
                    must(parseBlock());
                } else {
                    if (eat(':')) must(parseExpression);
                    // else it's a {shortcut}
                }
                if (!eat(',')) break;
            }
        }
        must(eat('}'));
        return true;
    }

    function parseTemplateArg() {
        // <T,A>
        // What's hard here is making the distinction between a template argument and < comparison.
        // (3+4)<test | sdf>(x); // template type
        // (3+4)<test | sdf>x; // comparison
        return attempt(() => {
            if (!skip('<')) return false;
            must(skip(parseType));
            while(skip(',')) must(skip(parseType));
            must(skip('>'));
            // Look ahead to see if we have a template argument or a comparison
            if (peek('.') || peek('(') || peek('{') || peek(';') || pos >= code.length) return true;
            // Based on the next token, this doesn't look like a template argument.
            // Comparisons perhaps then?
            return false;
        });
    }

    function parseCall() {
        // myFunc(a, ...rest)
        if (!(eat('('))) return false;
        while (true) {
            if (eat('...')) must(parseExpression);
            else if (!parseExpression()) break;
            if (!eat(',')) break;
        }
        must(eat(')'));
        return true;
    }

    function parseIndex() {
        // [12, a]
        if (!(eat('['))) return false;
        must(parseExpressionSeq);
        must(eat(']'));
        return true;
    }

    function parseType(allowFunction=true) {
        // number | (string & StringExtras)
        // X extends MyClass ? keyof X : 'default'
        let required = false;
        if (eat('typeof')) return must(parseExpression);
        if (eat('keyof')) required = true;
        if (eat(IDENTIFIER)) { // includes: true,false,undefined,null
            if (eat('<')) {
                must(parseType);
                while(eat(',')) {
                    must(parseType);
                }
                must(eat('>'));
            }
        }
        else if (eat('{')) {
            while (true) {
                if (eat('[')) {
                    must(eat(IDENTIFIER));
                    must(eat(':'));
                    must(parseType);
                    must(eat(']'))
                }
                else if (!eat(IDENTIFIER) && !eat(NUMBER) && !eat(STRING)) break;
                must(eat(':'));
                must(parseType);
                if (!eat(',')) break;
            }
            must(eat('}'));
        }
        else if (eat('[')) { // array
            while(true) {
                if (!parseType()) break;
                if (!eat(',')) break;
            }
            must(eat(']'));
        }
        else if (allowFunction && attempt(parseFuncParams)) {
            must(eat('=>'));
            must(parseType);
            return true;
        }
        else if (eat('(')) { // subtype surrounded by parentheses
            must(parseType);
            must(eat(')'));
        }
        else if (!eat(NUMBER) && !eat(STRING)) {
            if (required) must(false);
            return false;
        }
        while (eat('[')) {
            parseType(); // If present: indexing a type, otherwise indicating an array
            must(eat(']'));
        }
        while (true) {
            if (eat('|') || eat('&')) {
                must(parseType(false));
            } else {
                break;
            }
        }
        if (eat('extends')) {
            // conditional type
            must(parseType);
            must(eat('?'));
            must(parseType);
            must(eat(':'));
            must(parseType);
        }
        return true;
    }

    function parseClass() {
        // abstract class X { public val: number = 3; get lala() { return 3; } }
        // interface Y {}
        let isInterface = false;
        if (skip('abstract')){
            must(eat("class"));
        } else {
            if (skip('interface')) {
                isInterface = true;
                wipeStatement(); // remove any 'export'
                skipping++;
            } else if (!eat("class")) {
                return false;
            }
        }
        eat(IDENTIFIER);
        parseTemplateDef();
        if (eat('extends')) must(parseExpression());
        while (skip('implements')) must(skip(parseType));
        must(eat('{'));
        while (!eat('}')) {
            must(eat(';') || recoverErrors(() => parseMethod(isInterface), true));
        }
        if (isInterface) skipping--;
        return true;
    }

    function parseMethod(isAbstract: boolean = false) {
        // static public val: number = 3;
        // abstract myMethod(a: number);
        // constructor(public x) {}
        // get lala() { return 3; }
        // static { log('init'); }
        statementOutStart = out.length;
        isAbstract ||= !!skip('abstract');
        skip('public') || skip('private') || skip('protected');
        isAbstract ||= !!skip('abstract');
        (peek('get', IDENTIFIER) && eat('get')) || (peek('set', IDENTIFIER) && eat('set'));
        if (eat('static')) {
            if (parseBlock()) return true;
        }
        eat('async');

        eat('*'); // generator support

        const name = eat(IDENTIFIER);
        if (!name) {
            if (eat('[')) {
                must(parseExpression);
                must(eat(']'));
            } else {
                if (out.length !== statementOutStart) {
                    // We've already consumed some modifiers.. identifier was a must.
                    must(false);
                }
                return false;
            }
        }

        if (!peek('<') && !peek('(')) {
            // It's an attribute
            if (skip(':')) must(skip(parseType));
            if (eat('=')) must(parseExpression);
            mustEos();
            return true;
        }

        // It's a method
        skip(parseTemplateDef);
        let initFields = must(parseFuncParams(name==='constructor'));
        if (skip(':')) must(skip(parseType));

        if (isAbstract || !eat('{')) {
            // An overload signature / abstract method
            mustEos();
            wipeStatement();
            return true;
        }

        if (typeof initFields !== 'string') {
            while(!eat('}')) must(recoverErrors(parseStatement));
            return true;
        }
        
        // Add the `this.arg = arg;` statements at the start of the constructor body
        if (attempt(() => {
            // Add the initFields at the start of the body
            replaceOutput(out.length, initFields);
            while(!eat('}')) {
                if (peek('super', '(')) return false; // Fail the attempt!
                must(recoverErrors(parseStatement));
            }
            return true;
        })) return true;

        // If the above encountered super(), add initFields after super() call.
        while(!eat('}')) {
            let isSuper = peek('super', '(');
            must(recoverErrors(parseStatement));
            if (isSuper) replaceOutput(out.length, initFields);
        }
        return true;
    }

    ///// Helper functions /////

    function replaceOutput(outPos: number, text: string) {
        let replacedText = out.substring(outPos)
        let replacedLines = replacedText.split("\n");
        let replacedLineCount = replacedLines.length - 1;

        let textLineCount = text.split("\n").length - 1;
        if (textLineCount > replacedLineCount) throw new Error("Invalid replaceOutput");

        out = out.substring(0, outPos) + text;

        // Preserve the appropriate amount of newlines:
        out += "\n".repeat(replacedLineCount - textLineCount);

        // Preserve any indent on the last line we replaced:
        let lastReplacedLine = replacedLines[replacedLines.length-1];
        if (lastReplacedLine.trim() === '') out += lastReplacedLine;

        if (debug) debugLog('replace output', toJson(replacedText), "by", toJson(out.substr(outPos)));
    }

    function must<T extends string | true>(result: T | undefined | false | (() => T | undefined | false)): T {
        if (typeof result === 'function') result = result();
        if (result) return result;
        let stack = new Error().stack || '';
        let m = /\bat parse([A-Z][a-zA-Z]*)/.exec(stack) || ['', 'top-level'];

        let expect: any = [];
        let attempts: string[] = [];
        for (let m of matchOptions) {
            if (m instanceof ParseError) attempts.push(m.message);
            else if (m instanceof Array) expect.push(joinTokens(m, ' + '));
            else expect.push(m);
        }

        let error = new ParseError(`Could not parse ${m[1]} at ${line}:${col}, got ${toJson(code.substr(pos,24))}, expected one of:   ${joinTokens(expect, '   ')}`);
        if (attempts.length) (error as any).attempts = attempts;
        throw error;
    }

    function recoverErrors(func, required=false) {
        if (attempting || !recover) return func();
        let startPos = pos;
        try {
            const res = func();
            if (required && startPos === pos) must(false);
            return res;
        } catch(e) {
            if (!(e instanceof ParseError)) throw e;
            console.error(e);
            console.error('Attempting to recover...')

            while(pos < code.length && !eat(';') && !eat('}')) {
                must(eat(WHITESPACE) || eat(IDENTIFIER) || eat(STRING) || eat(ANYTHING));
                if (postNewline) break;
            }
            // We fake success if at least *something* was read.
            return (pos > startPos);
        }
    }

    function attempt<T>(func: () => T): T | false {
        let saved = {pos, line, col, out, matchOptions};
        matchOptions = new Set();
        attempting++;
        try {
            let result = func();
            if (result) return result;
            if (pos === saved.pos && out===saved.out) return false; // no need to revert
            must(false);
        } catch (e) {
            if (!(e instanceof ParseError)) throw e;
            saved.matchOptions.add(e);
        }
        finally {
            attempting--;
        }
        pos = saved.pos;
        line = saved.line;
        col = saved.col;
        out = saved.out;
        if (debug) debugLog('reverted attempt');
        matchOptions = saved.matchOptions;
        return false;
    }

    function wipeStatement() {
        const orgText = out.substr(statementOutStart);
        const newText = orgText.replace(ALL_NOT_WHITESPACE, ' ');
        if (orgText !== newText) {
            if (debug) debugLog('wipe output', toJson(orgText));
            out = out.substr(0, statementOutStart) + newText;
        }
    }

    function mustEos() {
        // Force end-of-statement: either a semicolon or a newline
        if (pos >= code.length) return true;
        if (eat(';')) return true;
        if (postNewline) return true;
        if (peek('}')) return true;
        must(false); // throws
        return false; // does not happen
    }
    
    function skip(func: () => string | boolean | undefined);
    function skip(...whats: (RegExp | string)[]);
    function skip(...whats: any[]) {
        skipping++;
        const result = whats.length===1 && typeof whats[0] === 'function' ? whats[0]() : eat(...whats);
        skipping--;
        return result;
    }

    function peek(...whats: (RegExp | string)[]);
    function peek(...whats: any[]) {
        peeking++;
        const result = eat(...whats);
        peeking--;
        return result;
    }

    function eat(...whats: (RegExp | string)[]): string | undefined {
        let oldPos = pos;
        let result;
        let _postNewline = false;
        for(let what of whats) {
            result = undefined;
            if (typeof what === 'string') {
                // If the what matches exactly *and* (`what` ends with a non-alpha-num
                // char *or* the char that comes after `what` is non-alpha-num).
                if (code.substr(pos, what.length) === what && (
                    !what.slice(-1).match(ALPHA_NUM) ||
                    !code.substr(pos+what.length,1).match(ALPHA_NUM)
                )) result = what;
            } else {
                what.lastIndex = pos;
                const match = what.exec(code);
                if (match) result = match[0];
            }
            if (result === undefined) {
                pos = oldPos;
                matchOptions.add(whats.length==1 ? whats[0] : whats);
                return;
            }
            pos += result.length;
            WHITESPACE.lastIndex = pos;
            let whitespace = (WHITESPACE.exec(code) || [""])[0];
            pos += whitespace.length;
            _postNewline = whitespace.indexOf("\n") >= 0;
        }

        if (peeking) {
            pos = oldPos;
            return result;
        }

        const matched = code.substring(oldPos, pos);
        matchOptions.clear();
        postNewline = _postNewline;

        if (debug) debugLog(skipping ? 'skip' : 'eat', toJson(matched), 'as', joinTokens(whats, ' + '));

        const lastNewline = matched.lastIndexOf('\n');
        if (lastNewline >= 0) {
            line += matched.split('\n').length - 1;
            col = matched.length - lastNewline;
        } else {
            col += matched.length;
        }
        if (skipping) out += matched.replace(ALL_NOT_WHITESPACE, ' ');
        else out += matched;

        return result;
    }

    function getParseStack() {
        let m = Array(...((new Error().stack || '').matchAll(/\bat parse([A-Z][a-zA-Z]+).*?(:\d+)/g) || [])).map(i => i[1]+i[2]);
        return m.join(' <- ')
    }

    function debugLog(...args: string[]) {
        (typeof debug==='function' ? debug : console.debug)(line+':'+col, ...args, "parsing", getParseStack())
    }    
}

function toJson(v: any) {
    return JSON.stringify(v)
}

function joinTokens(tokens, joinStr: string) {
    return tokens.map(e => typeof e==='string' ? toJson(e) : e.toString() ).toSorted().join(joinStr);
}