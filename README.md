# Generate Getter Setter

## Experimental

Does only work with TypeScript. Can easily be extended to other languages. (see github).

## Install

1. Within Visual Studio Code, open the command palette (`Ctrl-Shift-P` / `Cmd-Shift-P`)
2. Select `Install Extension` and search for 'generate getter setter'

## Settings

Switch between scoped or global search for private variables by setting 'genGetSet.scoped' to true or false.
When scoped (default) only available private definitions from the class where the cursor resides will be shown.

## Usage

Just place your cursor within a TypeScript class definition in the text editor window and open the command palette (`Ctrl-Shift-P` / `Cmd-Shift-P`).
Search for 'Generate Getter / Setter or Getter and Setter' and select the private definition.

A get and/or set function will be rendered at the position of your cursor.

## Best Practice

Best practice is naming your variables with a `_` for private use like:
`private _name: string;`
The extension will remove the `_` when generating.

If there is no `_` the functions will be named:
`public get $name(): string`
... so a `$` is used to define the public get and set function.

## Known Problems

Always `type` your variables.
Even when they are initialized like this:
`private _name: boolean = false;`
... else the extension cannot read the typing.

**Enjoy!**
