---
name: branch-done
description: Post-merge branch cleanup — switches to master, pulls latest, and deletes the merged feature branch. Use this skill when the user says "branch done", "PR merged", "cleanup branch", "done with branch", or "/branch-done". Also use when the user indicates they've finished merging a pull request and want to return to a clean state.
---

# Post-Merge Branch Cleanup

You are performing a post-merge cleanup after a PR has been merged into master.

## Steps

1. **Detect current branch**
   ```bash
   git branch --show-current
   ```
   If already on `master`, abort with a message: "You're already on master — nothing to clean up."

2. **Check for uncommitted changes**
   ```bash
   git status --porcelain
   ```
   If there are uncommitted changes, warn the user and ask whether to stash or abort.

3. **Switch to master**
   ```bash
   git checkout master
   ```

4. **Pull latest**
   ```bash
   git pull origin master
   ```

5. **Delete the feature branch (safe)**
   ```bash
   git branch -d <branch-name>
   ```
   Use `-d` (not `-D`) so git refuses to delete if the branch wasn't actually merged.
   If `-d` fails, tell the user the branch appears unmerged and ask for confirmation before using `-D`.

6. **Confirm** — Print a short summary:
   ```
   Cleaned up:
   - Switched to master
   - Pulled latest from origin
   - Deleted branch: <branch-name>
   ```
