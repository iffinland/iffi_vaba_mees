Example Project Vision for a New Qortal qApp

Purpose

This is an example of a strong project vision file for a new Qortal
qApp. It is written in a format that an AI agent can follow directly.
Use it as a starting point and replace the content with the real project
idea.

Project name:
`Q-Showcase`

Qortal app name:
`QShowcase`

Short summary:
`Q-Showcase is a Qortal-native publishing app where creators can publish
and manage visual portfolio items on QDN. It is designed to make
publishing and browsing creator work simple, fast, and mobile-friendly.`

Primary goal:
`The app should help creators publish, organize, and present their work
on QDN without needing technical knowledge about QDN internals or manual
resource management.`

Target users:

- creators publishing art, project previews, or media
- regular Qortal users who want to browse creator profiles
- mobile users who need a simple and reliable interface

Core features:

- creator profile view
- list of published showcase items
- publish new showcase item flow
- edit metadata for user-owned items
- responsive browsing and filtering
- clear loading and fallback states for QDN resources

Must-have technical requirements:

- build the project as a Qortal qApp using the standard
  `create-qortal-app` workflow
- use the `react-default-template`
- configure `AppWrapper.tsx` correctly with `GlobalProvider`
- ensure `vite.config.*` uses `base: './'` if required
- use relative asset paths compatible with Qortal
- follow QDN readiness checks before rendering published resources
- keep the first screen lightweight and mobile-friendly

QDN / Qortal integration expectations:

- profile and item metadata should be stored as QDN JSON resources
- visual media should be loaded with QDN-aware status checks
- the app should use Qortal-compatible flows rather than assuming a
  normal web backend
- publishing should be verified instead of assuming success immediately

UI direction:

- modern but calm visual design
- easy to understand for non-technical users
- avoid technical error wording when possible
- responsive layout for desktop and mobile
- strong empty states, loading states, and publish feedback

Data model notes:

- a creator profile contains public metadata about the creator
- a showcase item contains title, description, tags, media references,
  creation date, and ownership info
- filters should support title, tags, and creator identity

Pages or sections:

- home page
- creator profile page
- item detail modal or page
- publish form
- edit form for owned items

What to avoid:

- do not depend on centralized web2 services unless explicitly approved
- do not assume QDN resources are instantly ready
- do not build a desktop-only layout
- do not expose overly technical Qortal internals directly in the main
  user flow

Definition of first usable version:

- the app boots correctly inside Qortal
- the app name and wrapper configuration are correct
- a user can browse creator items
- a user can publish at least one item type
- loading and fallback behavior is understandable
- mobile layout is usable
- GitHub sync and backup/restore workflow are set up

Suggested Agent Instruction

`Read this file as the project vision. Then follow agents/master-workflow.md. Communicate with me in Estonian, but write project files in English.`
