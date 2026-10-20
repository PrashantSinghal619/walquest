# Issue tracker: GitHub

Issues and specs live in GitHub Issues for
PrashantSinghal619/walquest. Use the gh CLI from this repository.

## Operations

- Create: gh issue create --title "..." --body-file <file>
- Read: gh issue view <number> --json number,title,body,labels,comments
- List: gh issue list --state open --json number,title,labels,assignees
- Comment: gh issue comment <number> --body-file <file>
- Label: gh issue edit <number> --add-label "<label>"
- Remove label: gh issue edit <number> --remove-label "<label>"
- Close: gh issue close <number>

Use UTF-8 files for multiline bodies.

“Publish to the issue tracker” means create a GitHub issue.
“Fetch the relevant ticket” means read the GitHub issue.

## Pull requests as a triage surface

PRs as a request surface: no.

## Wayfinding

Use one map issue labelled wayfinder:map and linked child issues
labelled wayfinder:<type>: research, prototype, grilling or task.
Create a required wayfinder label if missing when using this workflow.

Link children through GitHub sub-issues. If unavailable, use a task
list in the map and “Part of #<map>” in each child.

Record blockers with native GitHub issue dependencies, using issue
database IDs. If unavailable, use “Blocked by: #<number>” in the body.

Choose the first open, unassigned child in map order with no open
blockers. Claim it by assigning yourself.

Resolve by commenting with the result, closing the child, and adding
a concise finding and link to the map’s Decisions-so-far.
