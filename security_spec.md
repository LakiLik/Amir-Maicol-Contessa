# Security Spec

## Data Invariants
1. An `animal` document must belong to the user (`userId == request.auth.uid`).
2. An `animal` document's earTag must be less than 100 characters.
3. Subcollections `treatments` and `weight_history` access is derived from the parent `animal` document's ownership. The parent `animal` must exist.
4. Timestamps (`createdAt`, `updatedAt`) must strictly adhere to the server timestamp or be unmodified during updates.

## Dirty Dozen Payloads
1. Create animal without `userId`.
2. Create animal with spoofed `userId`.
3. Create animal with invalid types (e.g., `dateOfBirth` as an object).
4. Create animal with missing required fields.
5. Update animal changing the `userId` (Identity Spoofing).
6. Update animal with ghost field (Shadow Update).
7. Update animal with modified `createdAt` (Temporal Violation).
8. Read animal belonging to another user.
9. Create treatment for a non-existent animal.
10. Create treatment for another user's animal.
11. Update treatment changing `userId`.
12. Read treatments for another user's animal.

## Test Runner
A test runner would emulate the environment and assert permissions for these payloads. We will focus on generating mathematically sound rules to cover these cases.
