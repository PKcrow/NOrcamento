---
name: Clerk EAS environment separation
description: How to validate Clerk publishable keys when Replit development and EAS production use different Clerk instances.
---

The Replit development secret and the EAS production variable are not required to match byte-for-byte: development can use a test Clerk instance while the production EAS profile uses the live instance. Validate the production variable from EAS itself, require it to be non-empty for the production profile, and never replace it with the development secret by assumption.

**Why:** A direct comparison can report a mismatch that is intentional when the environments use different Clerk instances; overwriting production with the development key would break the published app.

**How to apply:** Inspect EAS production variable metadata or pull it to a temporary file for a local validation check, never print the value, and keep the production key outside the repository.