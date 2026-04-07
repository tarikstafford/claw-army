name: Technical Debt
description: Refactor, clean up, or improve code quality
title: "techdebt: "
labels: ["type:techdebt", "priority:medium"]
body:
  - type: markdown
    attributes:
      value: |
        ## Problem
        What code smell, design issue, or cleanup item needs addressing?
  - type: markdown
    attributes:
      value: |
        ## Context
        Affected files, why it's a problem, potential risks of leaving it.
  - type: markdown
    attributes:
      value: |
        ## Acceptance Criteria
        - [ ] Code improved
        - [ ] No functionality changes
        - [ ] Tests pass
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
