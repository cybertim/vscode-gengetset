import { Variable } from './variable';

const matchers = {
    ctorDef: /\s*constructor\(\s*([^)]+?)\s*\)/,
    ctorParam: /(?:public)?(private)?\s*([a-zA-Z_$][\w$]+)\s*\??:\s*([\.\w$]+<(?:[\.\[\]\w$\s]+,?)+>|[\.\[\]\w$]+)[^,]*,?\s*/y,
};

/**
 * Finds private constructor parameters and returns them as {@link Variable[]}.
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
                params.push(new Variable(param[2], param[3]));
            }
        }
    }
    return params;
}