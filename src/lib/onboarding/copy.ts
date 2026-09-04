/**
 * User-facing onboarding / tour copy.
 * English only for now — keep keys stable so translations can slot in later.
 */

export const DEFAULT_LOCALE = "en" as const;

export const BOOKING_TOUR_SLUGS = ["bookflow-demo"] as const;

export type TourStepDef = {
  id: string;
  title: string;
  body: string;
  target: string;
  href?: string;
  openNav?: boolean;
};

export function isPublicDemoSlug(slug: string) {
  return (BOOKING_TOUR_SLUGS as readonly string[]).includes(slug);
}

const en = {
  common: {
    skip: "Skip",
    next: "Next",
    done: "Got it",
    close: "Close tour",
    showGuide: "How it works",
    stepOf: (current: number, total: number) => `Step ${current} of ${total}`,
  },
  tryDemo: {
    nav: "Try the Demo",
    kicker: "Explore BookFlow as a real business owner.",
    title: "Explore the BookFlow demo",
    body: "You can explore a sample business and see how BookFlow works. No setup required.",
    continue: "Continue to Demo",
    book: "Try a booking",
    unavailable: "This feature is unavailable in the demo.",
    missingShop: "The sample business isn’t available right now. Try a booking instead.",
    signedInTitle: "You’re already signed in",
    signedInBody:
      "The sample business is for visitors who aren’t signed in, so it never mixes with your real shop. Open a private window to try the demo, or go to your dashboard.",
    dashboard: "Go to dashboard",
    bannerTitle: "Demo mode",
    bannerBody:
      "You’re exploring a sample business. Your changes won’t affect a real business.",
    exit: "Exit Demo",
    backHome: "Back to BookFlow",
    unavailableBilling: "Billing is unavailable in the demo.",
    unavailableGoogle:
      "Connect your own Google Calendar to sync appointments. This isn’t available in the sample business.",
    unavailableTeam: "Inviting people is unavailable in the demo.",
    unavailableAi:
      "Demo AI uses example answers from this sample business.",
    unavailableEdit: "Editing is unavailable in the demo.",
  },
  demoIntro: {
    kicker: "Try a booking yourself",
    body: "See how a customer books an appointment with your business.",
    path: "Choose a service → Choose your barber → Pick a time → Enter your details → Confirm",
  },
  bookingPage: {
    intro: "Choose a service, then who you’d like, then a time.",
  },
  bookingWizard: {
    steps: [
      { id: "service", rail: "Service", title: "Choose a service" },
      { id: "staff", rail: "Staff", title: "Choose who you’d like" },
      { id: "time", rail: "Time", title: "Choose a date and time" },
      { id: "details", rail: "Details", title: "Your details" },
      { id: "confirm", rail: "Confirm", title: "Confirm booking" },
    ],
    emptyStaff: "No one is available for this service yet.",
    chooseServiceFirst: "Choose a service first, then pick who you’d like.",
    pickFirst: "Pick a service, who you’d like, and a time first.",
  },
  marketing: {
    heroBody:
      "Online booking for barbers, salons, clinics, and other appointment businesses.",
    productHeading: "Everything you need to take bookings",
    productIntro:
      "Your customers book online. You manage the day from one place.",
    howHeading: "How BookFlow works",
    howIntro: "Set up your business, share a link, and manage appointments.",
    steps: [
      {
        n: "01",
        title: "Set up your business",
        body: "Add your services, staff and opening hours.",
      },
      {
        n: "02",
        title: "Share your booking link",
        body: "Send the link to customers so they can book online.",
      },
      {
        n: "03",
        title: "Manage your appointments",
        body: "See bookings, customers and staff in one place.",
      },
    ],
    capabilities: [
      {
        title: "Online booking that follows your hours",
        body: "Customers pick a service, choose who they’d like, and take a time that is actually free.",
      },
      {
        title: "One place to run the shop",
        body: "See the calendar, customers, staff, services, and hours together.",
      },
      {
        title: "Messages that go out on time",
        body: "Confirmations, reminders, follow-ups, and review requests send automatically.",
      },
      {
        title: "Optional AI help",
        body: "Drafts and summaries when you want them, with clear plan limits.",
      },
    ],
    ctaHeading: "See BookFlow for yourself",
    ctaBody: "Explore a sample shop, or try a booking as a customer.",
  },
  bookingTour: {
    steps: [
      {
        id: "service",
        title: "Choose a service",
        body: "Tap the service you want.",
        target: '[data-tour="booking-service"]',
      },
      {
        id: "staff",
        title: "Choose who you’d like",
        body: "Pick the barber, stylist, or team member you’d like to see.",
        target: '[data-tour="booking-staff"]',
      },
      {
        id: "time",
        title: "Choose a date and time",
        body: "Select a day, then a time that works for you.",
        target: '[data-tour="booking-time"]',
      },
      {
        id: "details",
        title: "Enter your details",
        body: "Add your name and email so the shop can send your confirmation.",
        target: '[data-tour="booking-details"]',
      },
      {
        id: "confirm",
        title: "Confirm your booking",
        body: "Tap confirm when you’re ready. You’ll get a confirmation you can manage.",
        target: '[data-tour="booking-confirm"]',
      },
    ] satisfies TourStepDef[],
  },
  ownerTour: {
    steps: [
      {
        id: "business",
        title: "Business",
        body: "Set up your business information.",
        target: '[data-tour="owner-business"]',
        href: "/dashboard/settings",
        openNav: true,
      },
      {
        id: "services",
        title: "Services",
        body: "Add the services your customers can book.",
        target: '[data-tour="owner-services"]',
        href: "/dashboard/services",
        openNav: true,
      },
      {
        id: "staff",
        title: "Staff",
        body: "Add your barbers, stylists, or team members.",
        target: '[data-tour="owner-staff"]',
        href: "/dashboard/staff",
        openNav: true,
      },
      {
        id: "hours",
        title: "Opening hours",
        body: "Tell us when your business is available.",
        target: '[data-tour="owner-hours"]',
        href: "/dashboard/availability",
        openNav: true,
      },
      {
        id: "booking-link",
        title: "Booking link",
        body: "Send this link to customers so they can book online.",
        target: '[data-tour="owner-booking-link"]',
        href: "/dashboard",
        openNav: false,
      },
      {
        id: "calendar",
        title: "Calendar",
        body: "Manage your appointments here.",
        target: '[data-tour="nav-calendar"]',
        href: "/dashboard/appointments",
        openNav: true,
      },
    ] satisfies TourStepDef[],
  },
  staffTour: {
    steps: [
      {
        id: "calendar",
        title: "Calendar",
        body: "See your upcoming appointments here.",
        target: '[data-tour="nav-calendar"]',
        href: "/dashboard/appointments",
        openNav: true,
      },
      {
        id: "customers",
        title: "Customers",
        body: "See customers who have appointments with you.",
        target: '[data-tour="nav-customers"]',
        href: "/dashboard/clients",
        openNav: true,
      },
      {
        id: "actions",
        title: "Appointment actions",
        body: "Open an appointment to view details or manage it.",
        target: '[data-tour="staff-appointment-actions"]',
        href: "/dashboard/appointments",
        openNav: false,
      },
    ] satisfies TourStepDef[],
  },
} as const;

export const onboardingCopy = en;

export type OnboardingCopy = typeof onboardingCopy;
