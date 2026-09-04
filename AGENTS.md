# Agent instructions

## Never use em dashes

Do not write the em dash character (`—`, U+2014) anywhere in this project: not in code, comments, strings, translations, copy, docs, commit messages, or chat responses to the user.

- Use `~` (the user's chosen separator for email/copy strings) or a plain hyphen `-` where grammar needs a dash.
- If you find existing em dashes while editing a file, replace them in the same change.
- Rationale: the user dislikes the character and had all of them removed from the codebase (replaced with `~`); keep it that way.
