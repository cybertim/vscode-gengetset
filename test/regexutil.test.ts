import * as assert from 'assert';

import * as regexutil from '../src/regexutil';

suite("Regex Util Constructor Tests", () => {

    test("Does match private params in constructor", () => {
        const matches = regexutil.findCtorPrivateParams("constructor(private _name: string, private _age: number, _gender: string)");
        assert.equal(2, matches.length);
        assert.equal("_name", matches[0][2]);
        assert.equal("string", matches[0][3]);
        assert.equal("_age", matches[1][2]);
        assert.equal("number", matches[1][3]);
    });

    test("Does ignore public and default params", () => {
        const matches = regexutil.findCtorPrivateParams("constructor(public _name: string, private _age: number, _gender: string)");
        assert.equal(1, matches.length);
        assert.equal("_age", matches[0][2]);
        assert.equal("number", matches[0][3]);
    });

    test("Does match private params after public and default params", () => {
        const matches = regexutil.findCtorPrivateParams("constructor(public test: boolean, private _name: string, _gender: string, private _age: number)");
        assert.equal(2, matches.length);
        assert.equal("_name", matches[0][2]);
        assert.equal("string", matches[0][3]);
        assert.equal("_age", matches[1][2]);
        assert.equal("number", matches[1][3]);
    });

    test("Does not match if not constructor", () => {
        const matches = regexutil.findCtorPrivateParams("myMethod(private _name: string, private _age: number)");
        assert.equal(0, matches.length);
    });

    test("Can match zero private params in constructor", () => {
        const matches = regexutil.findCtorPrivateParams("constructor(name: string, age: number)");
        assert.equal(0, matches.length);
    });

    test("Does not match if empty constructor", () => {
        const matches = regexutil.findCtorPrivateParams("constructor()");
        assert.equal(0, matches.length);
    });

});