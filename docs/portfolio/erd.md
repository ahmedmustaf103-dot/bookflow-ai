# BookFlow AI — database ERD

Source of truth: [`prisma/schema.prisma`](../../prisma/schema.prisma).  
17 models, org-centric multi-tenant design.

## Entity relationship diagram

```mermaid
erDiagram
  User ||--o{ Membership : has
  Organization ||--o{ Membership : has
  Organization ||--o| Subscription : has
  Organization ||--o{ GoogleCalendarConnection : has
  User ||--o{ GoogleCalendarConnection : connects
  Organization ||--o{ Location : has
  Organization ||--o{ Resource : has
  Organization ||--o{ Service : has
  Organization ||--o{ Client : has
  Organization ||--o{ Booking : has
  Organization ||--o{ NotificationOutbox : has
  Organization ||--o{ AuditLog : has
  Organization ||--o{ AiRun : has

  Location ||--o{ Resource : hosts
  Location ||--o{ Booking : at

  User ||--o{ Resource : "optional staff link"

  Resource ||--o{ AvailabilityRule : "weekly hours"
  Resource ||--o{ AvailabilityOverride : "date exceptions"
  Resource ||--o{ ServiceResource : offers
  Service ||--o{ ServiceResource : offered_by
  Resource ||--o{ Booking : assigned
  Service ||--o{ Booking : for
  Client ||--o{ Booking : books
  Booking ||--o{ BookingEvent : timeline

  User {
    string id PK
    string clerkUserId UK
    string email
  }

  Organization {
    string id PK
    string slug UK
    string plan
    string timezoneDefault
    string brandPrimary
    string customDomain
    string verticalPack
  }

  Membership {
    string id PK
    string role
    string status
  }

  Location {
    string id PK
    string name
    string timezone
  }

  Resource {
    string id PK
    string name
    string type
  }

  Service {
    string id PK
    string name
    int durationMin
    int priceCents
  }

  ServiceResource {
    string serviceId FK
    string resourceId FK
  }

  AvailabilityRule {
    string id PK
    int weekday
    int startMinute
    int endMinute
  }

  AvailabilityOverride {
    string id PK
    date date
    boolean isClosed
  }

  Client {
    string id PK
    string name
    string email
    string phone
  }

  Booking {
    string id PK
    string status
    string source
    datetime startAt
    datetime endAt
    string manageToken
  }

  BookingEvent {
    string id PK
    string type
  }

  Subscription {
    string id PK
    string stripeSubscriptionId
    string status
  }

  NotificationOutbox {
    string id PK
    string kind
    string channel
    string status
  }

  AuditLog {
    string id PK
    string action
  }

  AiRun {
    string id PK
    string feature
    int tokensIn
    int tokensOut
  }

  GoogleCalendarConnection {
    string id PK
    string organizationId FK
    string userId FK
    string calendarId
  }
```

## Design notes

- **Organization** is the tenancy root — branding, vertical pack, automation toggles, plan.
- **Resource** = staff / room / equipment; linked to users when the resource is a person.
- **ServiceResource** is the many-to-many that controls who can deliver which service.
- **Booking** is protected by Postgres exclusion constraints (no overlapping confirmed slots per resource).
- **NotificationOutbox** decouples “something happened” from “message sent” for reliable email/SMS.
- **AiRun** meters AI usage for plan entitlements.
