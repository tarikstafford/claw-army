name: Documentation
description: Improve or create documentation
title: "docs: "
labels: ["type:docs", "priority:medium"]
body:
  - type: markdown
    attributes:
      value: |
        ## Problem
        What documentation is missing or incorrect?
  - type: markdown
    attributes:
      value: |
        ## Context
        What file(s) need updating? What should they contain?
  - type: markdown
    attributes:
      value: |
        ## Acceptance Criteria
        - [ ] Documentation created/updated
        - [ ] Examples added if applicable
        - [ ] Links verified
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
