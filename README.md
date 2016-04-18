# Generate Getter Setter

## Experimental

Currently only works with TypeScript.
Can easily be extended to other languages. (see github).

## Changelog

### v0.1.3
+ generate constructor
+ filter already generated getter/setters
+ quick menu with `alt+shift+G`

### v0.1.2
+ generate getter / setter
+ scoped variable listing

## Settings

1. `genGetSet.scoped` (default: enabled) switch between scoped or global search for private variables, when scoped only available private definitions from the class where the cursor resides will be shown.
2. `genGetSet.filter` (default: enabled) show only private varaibles which haven't been generated yet based on getter and/or setter selection.

## Usage

1. Just place your cursor within a TypeScript class definition in the text editor window
2. Open the command palette `ctrl+shift+P` / `cmd+shift+P`.
3. Search for 'Generate Getter', 'Setter' or 'Constructor'
4. Select the private variable you would like to generate

or

1. Just place your cursor within a TypeScript class definition in the text editor window
2. Press `alt+shift+G` for a quick selection
3. Select the private variable you would like to generate (or constructor)

The generated method will be placed at the cursors position.

## Best Practice

Best practice is naming your variables with a `_` for private use.
The extension will remove the `_` when generating the methods.

This: `private _name: string;`

Will render in:
```
public get name(): string {
    return this._name;
}

public set name(value: string) {
    this._name = value;
}
```

If there is no `_` the method will start with a `$`.

This: `private name: string;`

Will render in:
```
public get $name(): string {
    return this.name;
}

public set $name(value: string) {
    this.name = value;
}
```

## Known Problems

Always `type` your variables. Even when your variable is being initialized, else the extension cannot read the typing.
Always do this: `private _name: boolean = false;`

**Enjoy!**
