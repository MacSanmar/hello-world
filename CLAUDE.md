# Claude Code Skills Configuration

This repository is equipped with two curated skills frameworks for AI-assisted development.

## Superpowers (obra/superpowers)

Core development methodology skills. Read the relevant SKILL.md before starting a workflow.

| Skill | Path | When to use |
|-------|------|-------------|
| **Brainstorming** | `.claude/skills/brainstorming/SKILL.md` | Before implementing — Socratic design refinement |
| **Writing Plans** | `.claude/skills/writing-plans/SKILL.md` | Creating detailed implementation plans |
| **Executing Plans** | `.claude/skills/executing-plans/SKILL.md` | Batch execution with checkpoints |
| **Test-Driven Development** | `.claude/skills/test-driven-development/SKILL.md` | RED-GREEN-REFACTOR cycle |
| **Systematic Debugging** | `.claude/skills/systematic-debugging/SKILL.md` | 4-phase root cause investigation |
| **Subagent-Driven Development** | `.claude/skills/subagent-driven-development/SKILL.md` | Fresh subagent per task with review |
| **Dispatching Parallel Agents** | `.claude/skills/dispatching-parallel-agents/SKILL.md` | Concurrent independent tasks |
| **Requesting Code Review** | `.claude/skills/requesting-code-review/SKILL.md` | Pre-review checklist and dispatch |
| **Receiving Code Review** | `.claude/skills/receiving-code-review/SKILL.md` | Evaluating feedback, anti-sycophancy |
| **Verification Before Completion** | `.claude/skills/verification-before-completion/SKILL.md` | Evidence before claims |
| **Finishing a Branch** | `.claude/skills/finishing-a-development-branch/SKILL.md` | Merge/PR/discard decisions |
| **Using Git Worktrees** | `.claude/skills/using-git-worktrees/SKILL.md` | Isolated workspaces |
| **Writing Skills** | `.claude/skills/writing-skills/SKILL.md` | Authoring new skills |
| **Using Superpowers** | `.claude/skills/using-superpowers/SKILL.md` | Meta: how to find and use skills |

## Engineering Skills (alirezarezvani/claude-skills)

Specialized engineering skills — cherry-picked for quality.

| Skill | Path | When to use |
|-------|------|-------------|
| **Code Reviewer** | `.claude/skills/code-reviewer/SKILL.md` | Automated code quality review |
| **PR Review Expert** | `.claude/skills/pr-review-expert/SKILL.md` | Deep PR analysis with blast radius |
| **TDD Guide** | `.claude/skills/tdd-guide/SKILL.md` | Test generation and coverage analysis |
| **Senior Security** | `.claude/skills/senior-security/SKILL.md` | Threat modeling, security architecture |
| **Skill Security Auditor** | `.claude/skills/skill-security-auditor/SKILL.md` | Audit skills before installation |
| **Focused Fix** | `.claude/skills/focused-fix/SKILL.md` | Systematic deep-dive debugging |
| **Git Worktree Manager** | `.claude/skills/git-worktree-manager/SKILL.md` | Parallel development with worktrees |
| **CI/CD Pipeline Builder** | `.claude/skills/ci-cd-pipeline-builder/SKILL.md` | Generate CI/CD pipelines |
| **Self-Eval** | `.claude/skills/self-eval/SKILL.md` | Honest work quality evaluation |
| **Dependency Auditor** | `.claude/skills/dependency-auditor/SKILL.md` | Vulnerability and license scanning |
| **Performance Profiler** | `.claude/skills/performance-profiler/SKILL.md` | CPU, memory, bundle profiling |

## Design Skills (cathrynlavery/diagram-design)

| Skill | Path | When to use |
|-------|------|-------------|
| **Diagram Design** | `.claude/skills/diagram-design/SKILL.md` | Architecture, flowchart, sequence, ER, timeline, Sankey and ~45 other diagram types as self-contained HTML/SVG/PNG |

## Workflow Guidelines

1. **Before coding**: Read the relevant SKILL.md for the workflow you're about to use
2. **New features**: Start with Brainstorming → Writing Plans → TDD → Implementation
3. **Bug fixes**: Use Systematic Debugging or Focused Fix
4. **Code review**: Use Requesting Code Review → PR Review Expert
5. **Before finishing**: Always use Verification Before Completion
