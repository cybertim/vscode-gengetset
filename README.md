# Generate Getter Setter

## Experimental

Does only work with TypeScript. Can easily be extended to other languages. (see github).

## Install

1. Within Visual Studio Code, open the command palette (`Ctrl-Shift-P` / `Cmd-Shift-P`)
2. Select `Install Extension` and search for 'gengetset'

## Settings

Switch between scoped or global search for private variables by setting 'genGetSet.scoped' to true or false.
When scoped (default) only available private definitions from the class where the cursor resides will be shown.

## Usage

Just place your cursor within a TypeScript class definition in the text editor window and open the command palette (`Ctrl-Shift-P` / `Cmd-Shift-P`).
Search for 'Generate Getter / Setter or Getter and Setter' and select the private definition.

A get and/or set function will be rendered at the position of your cursor.

**Enjoy!**
