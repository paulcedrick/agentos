---
id: goal-001
team: ice-cold
priority: high
status: pending
createdBy: pcartigo
createdAt: 2026-02-15T00:00:00.000Z
successCriteria: API endpoint returns paginated results,Unit tests cover edge cases,Response time under 200ms
---

Build a REST API endpoint for listing user transactions with filtering and pagination.

The endpoint should support:
- Filtering by date range, transaction type, and amount range
- Cursor-based pagination with configurable page size (default 20, max 100)
- Sorting by date (desc) or amount (asc/desc)

Constraints:
- Must follow existing API conventions in the codebase
- Include input validation and proper error responses
- Write unit tests for the handler and integration tests for the endpoint
