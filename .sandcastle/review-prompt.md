# TASK

Review the code changes on branch `{{BRANCH}}` and improve code clarity, consistency, and maintainability while preserving exact functionality.

# CONTEXT

## Changed files

!`git diff --stat main...{{BRANCH}}`

!`git diff --name-only main...{{BRANCH}}`

## Commits on this branch

!`git log main..{{BRANCH}} --oneline`

Inspect only the files you need with targeted commands such as `git diff main...{{BRANCH}} -- <path>` and `sed -n`.

## Conditional frontend accessibility context

If the changed files include frontend surfaces such as `src/routes/**`, `src/components/**`, `src/design-system/**`, `src/styles/**`, or other UI-facing React/CSS files, load and apply the local accessibility guidance before reviewing those files:

- `@.agents/skills/a11y-best-practices/SKILL.md`
- `@.agents/skills/a11y-best-practices/REFERENCE.md`

For backend-, domain-, storage-, or infrastructure-only changes, do not load the accessibility guidance.

# REVIEW PROCESS

1. **Understand the change**: Read the diff and commits above to understand the intent.

2. **Analyze for improvements**: Look for opportunities to:
   - Reduce unnecessary complexity and nesting
   - Eliminate redundant code and abstractions
   - Improve readability through clear variable and function names
   - Consolidate related logic
   - Remove unnecessary comments that describe obvious code
   - Avoid nested ternary operators - prefer switch statements or if/else chains
   - Choose clarity over brevity - explicit code is often better than overly compact code

3. **Check correctness**:
   - Does the implementation match the intent? Are edge cases handled?
   - Are new/changed behaviours covered by tests?
   - Are there unsafe casts, `any` types, or unchecked assumptions?
   - Does the change introduce injection vulnerabilities, credential leaks, or other security issues?
   - For frontend changes, check keyboard access, focus visibility, semantic structure, accessible names, form labeling, status/error announcements, contrast-sensitive UI states, and whether the implementation preserves the repo's WCAG baseline.

4. **Maintain balance**: Avoid over-simplification that could:
   - Reduce code clarity or maintainability
   - Create overly clever solutions that are hard to understand
   - Combine too many concerns into single functions or components
   - Remove helpful abstractions that improve code organization
   - Make the code harder to debug or extend

5. **Apply project standards**: Follow the coding standards defined in @.sandcastle/CODING_STANDARDS.md

6. **Preserve functionality**: Never change what the code does - only how it does it. All original features, outputs, and behaviors must remain intact.

# EXECUTION

If you find improvements to make:

1. Make the changes directly on this branch
2. Run tests and type checking to ensure nothing is broken
3. Commit describing the refinements

If the code is already clean and well-structured, do nothing.

Once complete, output <promise>COMPLETE</promise>.
