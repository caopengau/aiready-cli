# Landing Release Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LANDING RELEASE WORKFLOW                          │
│                  make release-landing TYPE=minor                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Version Bump                                                 │
│ • Update landing/package.json: 0.1.0 → 0.2.0                        │
│ • Command: npm version minor --no-git-tag-version                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Build Validation                                             │
│ • Run: cd landing && pnpm build                                      │
│ • Abort if build fails                                               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Git Commit (Monorepo)                                        │
│ • Add: landing/package.json                                          │
│ • Commit: "chore(release): @aiready/landing v0.2.0"                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Monorepo Tagging                                             │
│ • Tag: landing-v0.2.0                                                │
│ • Annotated: "Release @aiready/landing v0.2.0"                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: Subtree Split                                                │
│ • Create split branch from landing/ directory                        │
│ • Remove sensitive files: sst.config.ts, .env                       │
│ • Amend commit: "chore(release): landing v0.2.0"                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: Push to Sub-repo                                             │
│ • Remote: aiready-landing                                            │
│ • Push: publish-landing → main (force)                              │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: Sub-repo Tagging                                             │
│ • Tag split commit: v0.2.0                                           │
│ • Push tag to aiready-landing                                        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 8: Push Monorepo                                                │
│ • Push main branch to origin                                         │
│ • Push all tags (--follow-tags)                                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                            ✅ COMPLETE!

═══════════════════════════════════════════════════════════════════════

                        RESULTING STRUCTURE

┌──────────────────────────────────────────────────────────────────────┐
│ getaiready/aiready (monorepo)                                          │
├──────────────────────────────────────────────────────────────────────┤
│ main branch:                                                          │
│   • landing/package.json → version: 0.2.0                            │
│   • git log: "chore(release): @aiready/landing v0.2.0"              │
│                                                                       │
│ tags:                                                                 │
│   • landing-v0.1.0                                                   │
│   • landing-v0.2.0 ← NEW                                             │
│   • core-v0.7.5                                                      │
│   • cli-v0.7.13                                                      │
│   • ... (other package tags)                                         │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ git subtree split
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ getaiready/aiready-landing (public sub-repo)                          │
├──────────────────────────────────────────────────────────────────────┤
│ main branch:                                                          │
│   • package.json → version: 0.2.0                                    │
│   • git log: "chore(release): landing v0.2.0"                       │
│   • ⚠️  EXCLUDED: sst.config.ts, .env (security)                     │
│                                                                       │
│ tags:                                                                 │
│   • v0.1.0                                                           │
│   • v0.2.0 ← NEW                                                     │
└──────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════

                     TAG NAMING CONVENTIONS

┌──────────────────────────┬─────────────────────────────────────────┐
│ Repository               │ Tag Format                               │
├──────────────────────────┼─────────────────────────────────────────┤
│ Monorepo (aiready)       │ landing-v<version>                      │
│                          │ Examples: landing-v0.1.0, landing-v1.0.0│
├──────────────────────────┼─────────────────────────────────────────┤
│ Sub-repo (aiready-landing│ v<version>                              │
│                          │ Examples: v0.1.0, v1.0.0                │
├──────────────────────────┼─────────────────────────────────────────┤
│ Package Spokes           │ <spoke>-v<version>                      │
│                          │ Examples: cli-v0.7.13, core-v0.7.5      │
└──────────────────────────┴─────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════

                      INTEGRATION POINTS

┌──────────────────────────────────────────────────────────────────────┐
│ make push-all                                                         │
├──────────────────────────────────────────────────────────────────────┤
│ 1. git push origin main                                              │
│ 2. for each spoke: make publish SPOKE=<name>                         │
│ 3. make publish-landing ← automatically syncs landing with version   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ make release-status                                                   │
├──────────────────────────────────────────────────────────────────────┤
│ Package                  Local        npm/tag      Status             │
│ @aiready/cli            0.7.13       0.7.13       ✓                  │
│ @aiready/core           0.7.5        0.7.5        ✓                  │
│ @aiready/landing        0.2.0        0.1.0        ahead ← shows delta│
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ Deployment (separate from release)                                   │
├──────────────────────────────────────────────────────────────────────┤
│ make deploy-landing-prod                                             │
│ • Deploys to AWS using SST                                           │
│ • Uses current code (regardless of version tags)                     │
│ • Typical workflow: release → deploy                                 │
└──────────────────────────────────────────────────────────────────────┘
```
