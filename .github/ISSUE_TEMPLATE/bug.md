name: Bug
description: Report a bug or unexpected behavior
title: "fix: "
labels: ["type:bug", "priority:high"]
body:
  - type: markdown
    attributes:
      value: |
        ## Problem
        Describe the bug clearly. What did you expect vs what happened?
  - type: markdown
    attributes:
      value: |
        ## Steps to Reproduce
        1.
        2.
        3.
  - type: markdown
    attributes:
      value: |
        ## Context
        Environment details, logs, affected code paths.
  - type: markdown
    attributes:
      value: |
        ## Acceptance Criteria
        - [ ] Bug is fixed
        - [ ] No regressions
        - [ ] Test added if applicable
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
    id: priority
    attributes:
      label: Priority
      options:
        - critical (must fix immediately)
        - high (important)
        - medium (normal)
    validations:
      required: true
