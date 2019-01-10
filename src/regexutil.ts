import { Variable } from './variable';

const matchers = {
    ctorDef: /\s*constructor\(\s*([^)]+?)\s*\)/,
    ctorParam: /(?:public)?(private)?\s*([a-zA-Z_$][\w$]+)\s*:\s*((?:[\.<\w$\s]+[,>])+|[\.\w$\s]+),?\s*/y,
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
export function findCtorPrivateParams(line: string): Variable[] {
    const params: Variable[] = [];
    let ctor: RegExpMatchArray;
    // First match the constructor, then match each param
    if (ctor = line.match(matchers.ctorDef)) {
        let param: RegExpMatchArray;
        while (param = ctor[1].match(matchers.ctorParam)) {
            // Check if the param is private
            if (param[1]) {
                // The regex is not great and leaves a trailing comma on non-generic types
                let type = param[3];
                if (type.endsWith(',')) {
                    type = type.substr(0, type.length - 1);
                }
                params.push(new Variable(param[2], type));
            }
        }
    }
    return params;
}