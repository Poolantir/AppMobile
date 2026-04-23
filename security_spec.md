# Poolantir Security Specification

## Data Invariants
1. A **Stall** must belong to an existing **Restroom**.
2. An **Issue** must reference a valid **RestroomId**.
3. **Users** cannot elevate themselves to `isAdmin: true`.
4. **Stall Status** can only be modified by Admins (simulating the IoT gateway).

## The Dirty Dozen Payloads
1. **Self-Admin Spoof**: User tries to `create` or `update` their `/users/{uid}` with `isAdmin: true`.
2. **Ghost Issues**: Creating an issue for a non-existent `restroomId`.
3. **Zombie Stalls**: Creating a stall without a parent restroom.
4. **Sensor Hijack**: Regular user trying to set a stall to `occupied: true`.
5. **Issue Tampering**: User trying to resolve another user's issue (only admins should resolve).
6. **ID Poisoning**: Injecting 1MB strings as `issueId`.
7. **Timestamp Fraud**: Providing a `reportedAt` in the past.
8. **Shadow Fields**: Adding `isVerified: true` to a Restroom document.
9. **Anonymous Spam**: Create issues without auth.
10. **Global Read**: Querying all users' PII (email).
11. **Outcome Locking Bypass**: Modifying a resolved issue's core data.
12. **Relational Orphan**: Deleting a restroom that still has stalls.

## The Test Runner (Conceptual logic for firestore.rules.test.ts)
- `test('fails self-admin elevation')`
- `test('fails unauthorized stall update')`
- `test('allows user issue report with valid restroomId')`
- `test('allows admin resolve issue')`
