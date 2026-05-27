---
name: TypeScript Conventions
description: >
  Authoritative TypeScript conventions for this repository. For matching
  .ts files, follow these rules for style, naming, module structure,
  class patterns, and type-system usage.
applyTo: '**/*.ts'
---

Use these rules for matching files. If a rule here is silent on something, use
idiomatic modern TypeScript.

# Formatting

Follow the formatting defined in `.prettierrc`, even if Prettier is not
running.

Additional rule: use a leading `;` only when ASI would otherwise misparse.

# Strings

Apply this order of preference:

- Use template literals for interpolation or multi-line content.
- Use single quotes for static strings.
- Use double quotes only when the string contains an apostrophe.

Never use `+` for string concatenation. Use template literals with
interpolation instead.

# Naming

- Variables, functions, parameters, and properties: `camelCase`.
- Classes, types, and enums: `PascalCase`.
- True constants and enum members: `SCREAMING_SNAKE_CASE`.
- File names: lowercase `kebab-case` only.
- Booleans do not require `is`/`has`; choose the clearest noun phrase.

Spell words out. Avoid abbreviations like `obj`, `rec`, `err`, `req`, and
`res`. Established acronyms like `tcp`, `http`, `url`, and `id` are allowed.

## Acronym rule

When an uppercase acronym appears inside an identifier and another capitalized
word follows it, add `_` to mark the boundary.

1. Acronym in the middle and followed by another capitalized word:
   `myTCP_Port`, `CustomTCP_Processor`, `myHTTP_URL_Handler`.
2. Acronym at the start of a camelCase identifier: lowercase it and do not add
   underscore (`tcpAddress`, `httpURL_Handler`).
3. Acronym at the start of a PascalCase identifier: keep uppercase and add
   underscore before the next word (`TCP_PacketProcessor`, `HTTP_Response`).
4. Acronym at the end: no trailing underscore (`hostNameTCP`, `ProcessesTCP`).

# Files, modules, and imports

- Prefer named exports and put `export` on declarations directly.
- Do not use bottom-of-file aggregated export lists.
- Use default export only when there is one obvious primary export and default
  usage reads better at the call site.
- Use `index.ts` barrels only at module/package boundaries, not inside module
  internals.
- Split files by cohesion when they grow or mix concerns.
- Use explicit named imports, not namespace imports and not default imports when
  named imports are the natural form.
- Alias imports on symbol conflicts.
- Use `import type` for type-only imports.
- Use `@foo`-style aliases when import paths would go up (`../`).
- Keep sibling/descendant imports relative (`./sibling`, `./child/thing`).
- Prefer `@foo` over `@/foo` for new configs; keep `@/foo` only if tsconfig
  already uses it.

Within each file, keep this top-down order:

1. Imports
2. Types
3. Constants
4. Main implementation
5. Helpers

# Functions and classes

- For module-level functions, use `function` declarations, not `const` arrows.
- In classes, prefer `#privateField` over `private`.
- Use `private` only when declaration-merging or compatibility constraints
  require it.
- Declare class fields in the class body.
- Assign fields explicitly in the constructor body.
- Do not use constructor parameter properties.

# Type system and errors

- Prefer `type` over `interface`.
- Use `interface` only when declaration merging is explicitly needed.
- Use `unknown` at trust boundaries; narrow before use.
- Use `any` only as a deliberate escape hatch.
- When using `any`, a brief reason comment is welcome.
- Use `never` for exhaustiveness and impossible states.
- Use `!!value` for explicit truthy/falsy to boolean coercion.
- Prefer `!!value` over `Boolean(value)` and never use `new Boolean(value)`.
- Use type-system tools (`as const`, `satisfies`, unions, branded/conditional
  types) only when they improve clarity.
- Avoid type-level complexity for its own sake.
- Throw exceptions and use normal `try`/`catch`.
- Do not introduce `Result`/`Either` patterns unless the existing codebase
  already uses them.

# Nullability

- Prefer `null` for intentional "no value".
- Treat `undefined` as missing/not-set.
- Return `null` when a function intentionally cannot produce a value.
- Keep `undefined` for optional params/properties and uninitialized state.
- If the language forces `undefined` (optional syntax), do not fight it.
- Use `??` (nullish coalescing) for defaults when `null`/`undefined` mean
  "missing".
- Do not use `||` for defaulting when `0`, `false`, or `''` are valid values.
- Use `?.` (optional chaining) for safe property access, element access, and
  optional calls when a value may be nullish.

# Access patterns

- Use dot property access for known identifier-safe keys.
- Use bracket access only for dynamic keys, non-identifier keys, or strict index
  access constraints.
- If a known field is on `Record<string, unknown>`, narrow or cast once, then
  use normal dot access.

# Regex

- Assign regex patterns to named variables before use.
- Do not inline regexes directly in `.match()`, `.test()`, or `.replace()`.
- Name regex variables for intent (what they match/why they exist), not syntax.
- If a regex is hard to name, simplify or split it.

# Destructuring

- Destructure when pulling multiple object fields.
- Destructure options-style parameters.
- Use named imports and array unpacking when it improves clarity.

# Control flow style

- Single-statement `if` uses one line without braces.
- If a one-line `if` body wraps, separate consecutive wrapped one-line `if`
  statements with a blank line.
- Any `if` with `else` must use braces on both branches.
- Prefer simple ternaries for simple value assignment/returns.
- Avoid nested or sprawling ternaries; switch to `if`/`else` when logic grows.

# Comments

- Use block comments `/* ... */` only; do not use `//`.
- Default to no comments.
- Add comments only when explaining non-obvious "why" (constraints,
  invariants, workarounds).
- Do not narrate obvious code behavior.
- Do not reference current task/PR context in code comments.
