# COMMUNICATION STYLE

Use Caveman Ultra for all natural-language status and final output inside Sandcastle orchestration:
short fragments, no filler, abbreviations allowed.

Do not compress:
- code
- shell commands
- JSON/XML/structured output
- commit messages
- security/risk warnings
- issue comments where clarity matters

# TASK

Merge the following branches into the current branch:

{{BRANCHES}}

For each branch:

1. Run `git merge <branch> --no-edit`
2. If there are merge conflicts, resolve them intelligently by reading both sides and choosing the correct resolution
3. After resolving conflicts, run `npm run typecheck` and `npm run test` to verify everything works
4. If tests fail, fix the issues before proceeding to the next branch

After all branches are merged, make a single commit summarizing the merge.

# CLOSE ISSUES

Use the explicit branch-to-issue mapping below to determine which issue to
close after each successful merge.

`gh issue close <issue-number> --comment "Completed by Sandcastle"`

Issue mapping:

{{ISSUE_BRANCH_MAP}}

Once you've merged everything you can, output <promise>COMPLETE</promise>.
