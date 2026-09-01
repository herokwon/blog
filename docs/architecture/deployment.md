# Deployment

This document defines the Blog project's deployment and release policies. It describes the durable behavior and boundaries of the deployment system rather than the implementation details of GitHub Actions or Cloudflare CLI commands.

## Environments

The project has three relevant execution environments:

| Environment | Purpose                                                | Persistent data                    |
| ----------- | ------------------------------------------------------ | ---------------------------------- |
| Local       | Local development, migration checks, and tests         | Local D1 state                     |
| Preview     | Validate a Worker version before Production deployment | No separate persistent environment |
| Production  | Serve the deployed application                         | Production D1                      |

Preview is not a separate Worker or D1 environment. It represents a Worker version uploaded for validation before Production deployment and uses the same D1 binding as Production. Preview is therefore validation-only and must not perform mutating operations against Production D1.

Production is the only deployed environment with persistent application data. Worker versions do not isolate or version D1 storage state.

## Deployment Flow

Deployment targets are determined by the branch and pull request flow rather than by arbitrary pushes:

```text
Pull request targeting release/**
              │
              ▼
            Preview

  release/** merged into main
              │
              ▼
          Production

    fix/** targeting main
              │
              ▼
       Hotfix eligibility
              │
              ▼
          Production
```

A merged pull request targeting a `release/**` branch produces a Preview deployment for validation. Merging a release branch into `main` produces a Production deployment.

A `fix/**` pull request targeting `main` follows the Hotfix policy below rather than becoming an unrestricted Production deployment path.

### Preview Deployment

Preview deployment validates the Worker version associated with the release branch before that version is promoted to Production.

Preview uses the Production D1 binding, so application behavior that would mutate persistent data must not be exercised through Preview. This constraint prevents validation deployments from changing Production state.

### Production Deployment

Production deployment promotes the selected Worker version to the Production environment. Trigger configuration is treated as a separate part of the Production deployment and is applied alongside the Worker version.

A Production deployment is considered successful only when all required Production deployment concerns succeed. A failure in the Worker version deployment or trigger configuration deployment results in a failed deployment.

### Hotfix Deployment

Hotfix deployments are reserved for recovering from a failed Production deployment.

A hotfix must use the repository's designated `fix/**` branch and pull request convention, target `main`, and be eligible only when the latest Production deployment has failed or ended in an error state. A normal `fix/**` change is not an independent path for arbitrary Production deployment.

## Release

### Release Version

A release branch uses the `release/v<major>.<minor>.<patch>` convention. The version encoded by the release branch is the intended release version.

Before the release is finalized, that version is synchronized into `package.json` through the release version-bump process. The version bump is kept associated with the release branch so the version used by the final Production deployment and the resulting GitHub Release remains consistent.

### Release Creation

A successful Production deployment creates a GitHub Release from the repository package version. The corresponding version tag is the release identifier.

Release creation is therefore downstream of a successful Production deployment:

```text
Release branch
      │
      ▼
Version synchronized
      │
      ▼
release/** merged into main
      │
      ▼
Production deployment
      │
      ▼
GitHub Release
```

An existing version tag is not recreated as another release.

## Deployment Observability

Every deployment is represented as a GitHub Deployment with a final success or failure status. The deployment environment and relevant commit are recorded with that deployment.

Deployment results are also surfaced on the originating pull request so that the result of a Preview, Production, or eligible Hotfix deployment can be understood without inspecting the deployment workflow itself.

## Automation Boundaries

Release-related repository changes are performed through a dedicated automation identity rather than the identity of the person or workflow that initiated the release process.

This separation keeps automated version changes and release-related pull requests attributable to repository automation and separates their permissions from normal user identities.
