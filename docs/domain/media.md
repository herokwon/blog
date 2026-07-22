# Media Domain

## Overview

The Media domain manages all media assets used by the application.

It defines how media assets are associated with content, how ownership is determined, and how media is removed throughout its lifecycle.

Implementation details such as object storage configuration are intentionally omitted.

<br />

## Responsibilities

The Media domain is responsible for:

- Managing media assets uploaded by administrators.
- Defining the ownership of media assets.
- Associating media assets with content.
- Defining media deletion behavior.
- Preventing orphaned media assets.

The Media domain does not define content lifecycle, authentication, or storage implementation.

<br />

## Ownership

Media assets are owned by the Content domain.

A media assets may exist only as part of a content item.

Ownership is established when a media asset is associated with content.

The Content domain is responsible for managing these associations.

<br />

## Lifecycle

The Media domain follows the lifecycle of its owning content.

When content is permanently deleted, all associated media assets are immediately removed from object storage.

The system does not retain orphaned media assets.

<br />

## Business Rules

The Media domain follows these rules.

- A media asset may be referenced by a content item.
- Media ownership is determined by its associated content.
- Deleting content permanently deletes all associated media assets.
- The system should not leave unused media assets in storage.
- Media lifecycle is derived from content ownership rather than managed independently.

Business rules remain independent of infrastructure and implementation details.

<br />

## Boundaries

The Media domain is responsible for business ownership and lifecycle rules.

The following concerns are intentionally outside its scope:

- Object storage implementation
- Upload protocol
- Authentication
- Authorization
- Image optimization
- CDN configuration

These concerns belong to infrastructure or application implementation.

<br />

## Future Evolution

The current model assumes that media assets are exclusively owned by a single content item.

If future requirements introduce shared assets or a media library, the ownership model should be revisited through a new Architecture Decision Record (ADR).
