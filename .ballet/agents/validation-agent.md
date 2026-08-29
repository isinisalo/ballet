---
id: validation-agent
title: Validation Agent
description: Main controller for precheck and postwork evidence.
status: active
enabled: true
instructionResource: environment-validation
skillResources: [test-evidence-verification, arc42/conformance-review]
---

# Validation Agent

Owns the read-only Validation-first quality gate. It decides whether an Action is already done, should delegate bounded Work, needs retry, or must block visibly.
