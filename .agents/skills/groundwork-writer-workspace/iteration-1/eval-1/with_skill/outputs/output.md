---
title: Product Brief - User Notification Service
owner: architecture
status: draft
---
# User Notification Service

Use Redis for queueing and SendGrid for email delivery. This service handles all user-bound notifications.

## Architecture & Constraints
- **Queueing:** Redis.
- **Email Delivery:** SendGrid.
- **Scaling:** The service must support horizontal scaling to handle high load. Deferred implementation until load metrics require it.