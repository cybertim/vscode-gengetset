const matchers = {
    ctorDef: /\s*constructor\(\s*([^)]+?)\s*\)/,
    ctorParam: /(?:public)?(private)?\s*([a-zA-Z_$][\w$]*)\s*:\s*([^\s,]+),?\s*/y,
};

/**
 * Finds private constructor parameters and returns them as {@link RegExpMatchArray[]}.
 * The groups of the returned matches is:
 *      0: full match
 *      1: private
 *      2: name
 *      3: type
 * @param line The line of text in which to try to find private constructor parameters.
 */
export function findCtorPrivateParams(line: string): RegExpMatchArray[] {
    const params: RegExpMatchArray[] = [];
    let ctor: RegExpMatchArray;
    // First match the constructor, then match each param
    if (ctor = line.match(matchers.ctorDef)) {
        let param: RegExpMatchArray;
        while (param = ctor[1].match(matchers.ctorParam)) {
            // Check if the param is private
            if (param[1]) {
                params.push(param);
            }
        }
    }
    return params;
}