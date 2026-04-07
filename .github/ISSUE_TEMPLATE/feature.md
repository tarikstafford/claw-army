name: Feature
description: Request a new feature or enhancement
title: "feat: "
labels: ["type:feature", "priority:medium"]
body:
  - type: markdown
    attributes:
      value: |
        ## Problem
        What problem does this solve? Why is this needed?
  - type: markdown
    attributes:
      value: |
        ## Context
        Links to related PRDs, architecture docs, or issues.
        What existing functionality does this build upon?
  - type: markdown
    attributes:
      value: |
        ## Acceptance Criteria
        - [ ] Criteria 1
        - [ ] Criteria 2
        - [ ] Criteria 3
  - type: markdown
    attributes:
      value: |
        ## Technical Notes
        Implementation hints, affected files, breaking concerns.
  - type: dropdown
    id: domain
    attributes:
      label: Domain
      options:
        - frontend
        - backend
        - database
        - infra
    validations:
      required: true
  - type: dropdown
    id: effort
    attributes:
      label: Effort Estimate
      options:
        - small (<1 day)
        - medium (1-3 days)
        - large (3+ days)
    validations:
      required: true
