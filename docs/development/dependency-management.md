# Dependency Management

This document defines the Blog project's dependency-management policies and invariants. It describes which dependency changes may be automated and what must remain synchronized, rather than documenting Dependabot or GitHub Actions implementation details.

## Update Policy

### Dependency Categories

Dependency updates are managed according to three categories:

- **Production dependencies** ─ dependencies required by the application at runtime.
- **Development dependencies** ─ dependencies used to develop, validate, test, build, or maintain the project.
- **GitHub Actions** ─ dependencies used by repository automation workflows.

These categories are managed independently so that the level of automation can reflect the impact of an update on the deployed application and development environment.

### Major Updates

Major updates of foundational development tooling are not treated as routine automated updates. They require explicit review because they may introduce breaking changes across the project's build, development, test, or deployment tooling.

The exact set of dependencies subject to this policy is maintained by the dependency-update configuration rather than duplicated here.

### Auto-Merge Policy

Only dependency updates considered low-risk by the project's semantic-version policy may be automatically merged.

| Dependency type | Patch      | Minor         | Major         |
| --------------- | ---------- | ------------- | ------------- |
| Production      | Auto-merge | Manual review | Manual review |
| Development     | Auto-merge | Auto-merge    | Manual review |

Automatic merging is limited to direct dependency updates that satisfy the policy above. Updates with an ambiguous or unavailable version classification are not automatically merged unless their versions can be safely classified according to the same policy. Multi-dependency updates are not treated as safe fallback candidates.

The auto-merge policy does not bypass the repository's required status checks. An update that is eligible for auto-merge still has to satisfy the repository's normal merge requirements.

## Generated Artifacts

### Wrangler Worker Types

Generated Worker configuration types must remain synchronized with the Wrangler version used by the project.

When a Wrangler update changes the generated type contract, the generated Worker types are regenerated and synchronized with the dependency update before the update is considered complete. This keeps the checked-in type definitions consistent with the Wrangler version used by the project and prevents dependency updates from leaving generated types stale.
