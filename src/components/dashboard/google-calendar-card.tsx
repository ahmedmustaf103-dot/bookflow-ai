import { Button, ButtonLink } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

type MyConnection = {
  accountEmail: string | null;
};

type TeamConnection = {
  memberName: string;
  memberEmail: string;
  accountEmail: string | null;
};

export function GoogleCalendarCard({
  configured,
  status,
  myConnection,
  teamConnections,
}: {
  configured: boolean;
  status?: string;
  myConnection: MyConnection | null;
  teamConnections?: TeamConnection[];
}) {
  return (
    <Surface className="max-w-lg">
      <h2 className="text-sm font-semibold">Google Calendar</h2>
      <p className="mt-1 text-sm text-[var(--ink-secondary)]">
        Connect your own Google account. Bookings on your chair go to your
        calendar. Reschedules update the same event; cancellations remove it.
        Google never blocks a BookFlow booking if sync fails. Connecting does
        not backfill past appointments.
      </p>
      {status === "connected" ? (
        <p className="mt-2 text-sm text-[var(--accent)]">Connected.</p>
      ) : null}
      {status === "disconnected" ? (
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">Disconnected.</p>
      ) : null}
      {status === "error" ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          Couldn’t complete Google connection. Try again.
        </p>
      ) : null}
      {status === "not_configured" ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          Add GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET to
          the environment first.
        </p>
      ) : null}

      {!configured ? (
        <p className="mt-3 text-xs text-[var(--ink-tertiary)]">
          Google Calendar sync is not configured on this server. See
          .env.example for OAuth setup.
        </p>
      ) : myConnection ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm">
            Connected as{" "}
            <span className="font-medium">
              {myConnection.accountEmail ?? "Google account"}
            </span>
          </p>
          <form
            action="/api/integrations/google-calendar/disconnect"
            method="post"
          >
            <Button type="submit" variant="secondary" size="sm">
              Disconnect
            </Button>
          </form>
        </div>
      ) : (
        <div className="mt-4">
          <ButtonLink
            href="/api/integrations/google-calendar/connect"
            variant="primary"
            size="sm"
          >
            Connect my Google Calendar
          </ButtonLink>
        </div>
      )}

      {teamConnections && teamConnections.length > 0 ? (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <h3 className="text-xs font-semibold tracking-wide text-[var(--ink-tertiary)] uppercase">
            Team calendars
          </h3>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {teamConnections.map((row) => (
              <li key={row.memberEmail} className="py-2">
                <p className="text-sm font-medium">{row.memberName}</p>
                <p className="text-xs text-[var(--ink-tertiary)]">
                  {row.accountEmail
                    ? `Google: ${row.accountEmail}`
                    : "Not connected"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Surface>
  );
}
