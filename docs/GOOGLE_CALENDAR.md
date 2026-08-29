# Google Calendar (one-way, per barber)

BookFlow pushes appointments **to** the Google Calendar of the barber assigned to that chair. It does not read Google busy time and it does not implement two-way sync.

Each staff member connects **their own** Google account from **Google Calendar** in the dashboard (STAFF+). If that barber has not connected, BookFlow falls back to the **owner’s** connected calendar (useful for solo shops).

Customer "Add to calendar" / ICS files are a **separate** path. They go to the customer's own calendar app. BookFlow cannot remotely edit or delete an event the customer imported into iCloud, Apple Calendar, or a personal Google account.

## Barber Google Calendar

| BookFlow action | Google Calendar |
| --------------- | --------------- |
| New booking     | Create event on the assigned barber’s calendar (stable id derived from the booking) |
| Reschedule      | Update **the same** event (PATCH stored `googleEventId`, never a second create) |
| Cancel          | Delete that event |

If Google is disconnected, not configured, or returns an error, **the BookFlow booking still succeeds**. Failures are logged; there is no calendar retry queue.

Connecting does **not** backfill existing appointments.

## Customer ICS (email + manage page)

| BookFlow action | ICS |
| --------------- | --- |
| New booking     | `METHOD:REQUEST`, `SEQUENCE:0`, UID `{bookingId}@bookflow.ai` |
| Reschedule      | Same UID, higher SEQUENCE, new DTSTART/DTEND, attached to the reschedule email |
| Cancel          | Same UID, `METHOD:CANCEL`, attached to the cancellation email |

Apple Calendar / iCloud: if the customer **opens the updated or cancellation ICS**, many clients will update or remove the event. BookFlow cannot push that change into iCloud by itself.

## Automated tests

Unit tests mock `fetch` (no OAuth in CI): create stores `googleEventId`, reschedule PATCHes the stored id even if the caller omitted it, cancel DELETEs, HTTP/network errors do not throw.

## Manual live check

1. Each barber: Google Calendar → Connect my Google Calendar (needs `GOOGLE_CALENDAR_CLIENT_ID` / `SECRET` and the callback URL on the Google Cloud OAuth client).
2. Create a test booking on that chair. Confirm an event on **that barber’s** calendar.
3. Reschedule via the manage link. Confirm the **same** event moved (not a duplicate).
4. Cancel. Confirm the event is gone.
5. Disconnect Google, create another booking. Confirm BookFlow still books.
6. Open the confirmation / reschedule / cancel emails and confirm the ICS attachment.

Do not put OAuth client secrets in this file or in screenshots.
