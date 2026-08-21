export type SetupItem = {
  id: string;
  label: string;
  href: string;
  done: boolean;
  optional?: boolean;
};

export function buildPilotSetupItems(input: {
  hasBusinessName: boolean;
  hasBranding: boolean;
  hasServices: boolean;
  hasStaff: boolean;
  hasHours: boolean;
  hasBookingLinkShared: boolean;
  remindersConfigured: boolean;
  emailConfigured: boolean;
  googleConnected: boolean;
}): SetupItem[] {
  return [
    {
      id: "business",
      label: "Business name",
      href: "/dashboard/settings",
      done: input.hasBusinessName,
    },
    {
      id: "branding",
      label: "Branding (logo)",
      href: "/dashboard/settings",
      done: input.hasBranding,
    },
    {
      id: "services",
      label: "Services",
      href: "/dashboard/services",
      done: input.hasServices,
    },
    {
      id: "staff",
      label: "Staff",
      href: "/dashboard/staff",
      done: input.hasStaff,
    },
    {
      id: "hours",
      label: "Opening hours",
      href: "/dashboard/availability",
      done: input.hasHours,
    },
    {
      id: "link",
      label: "Booking link",
      href: input.hasBookingLinkShared ? "/dashboard" : "/dashboard",
      done: input.hasBookingLinkShared,
    },
    {
      id: "reminders",
      label: "Reminder settings",
      href: "/dashboard/settings",
      done: input.remindersConfigured,
    },
    {
      id: "email",
      label: "Email sending (Resend)",
      href: "/dashboard/settings",
      done: input.emailConfigured,
    },
    {
      id: "google",
      label: "Google Calendar",
      href: "/dashboard/settings",
      done: input.googleConnected,
      optional: true,
    },
  ];
}

export function requiredSetupComplete(items: SetupItem[]) {
  return items.filter((item) => !item.optional).every((item) => item.done);
}
