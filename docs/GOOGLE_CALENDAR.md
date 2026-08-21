# Google Calendar (one-way)

BookFlow pushes appointments **to** Google Calendar. It does not read Google busy time and it does not implement two-way sync.

## What happens

| BookFlow action | Google Calendar |
| --------------- | --------------- |
| New booking     | Create event    |
| Reschedule      | Update event    |
| Cancel          | Delete event    |

If Google is disconnected, not configured, or returns an error, **the BookFlow booking still succeeds**. Failures are logged; there is no calendar retry queue.

Connecting does **not** backfill existing appointments.

## Automated tests

Unit tests mock `fetch` (no OAuth in CI): create stores `googleEventId`, reschedule PATCHes, cancel DELETEs, HTTP/network errors do not throw.

## Manual live check

1. Settings → Connect Google Calendar (needs `GOOGLE_CALENDAR_CLIENT_ID` / `SECRET` and the callback URL on the Google Cloud OAuth client).
2. Create a test booking. Confirm an event on the connected calendar.
3. Reschedule via the manage link. Confirm the same event moved.
4. Cancel. Confirm the event is gone.
5. Disconnect Google, create another booking. Confirm BookFlow still books.

Do not put OAuth client secrets in this file or in screenshots.
