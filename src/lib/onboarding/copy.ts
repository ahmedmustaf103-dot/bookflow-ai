/**
 * User-facing onboarding / tour copy.
 * English only for now — keep keys stable so translations can slot in later.
 */

export const DEFAULT_LOCALE = "en" as const;

export const BOOKING_TOUR_SLUGS = ["bookflow", "bookflow-demo"] as const;

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
    stepOf: (current: number, total: number) => `Step ${current} of ${total}`,
  },
  demoBanner: {
    title: "This is a demo",
    body: "Book an appointment the way a customer would — then you’ll get a confirmation you can manage.",
  },
  bookingTour: {
    steps: [
      {
        id: "service",
        title: "Choose a service",
        body: "Tap the haircut or treatment you want. You can change this later if you need to.",
        target: '[data-tour="booking-service"]',
      },
      {
        id: "staff",
        title: "Choose a staff member",
        body: "Pick who you’d like to see — a barber, stylist, or whoever is available.",
        target: '[data-tour="booking-staff"]',
      },
      {
        id: "time",
        title: "Choose a date and time",
        body: "Select a day, then an open time that works for you.",
        target: '[data-tour="booking-time"]',
      },
      {
        id: "details",
        title: "Enter your details",
        body: "Add your name and email so the business can send your confirmation.",
        target: '[data-tour="booking-details"]',
      },
      {
        id: "confirm",
        title: "Confirm the appointment",
        body: "When you’re ready, confirm. You’ll get a booking confirmation and a link to manage it.",
        target: '[data-tour="booking-confirm"]',
      },
    ] satisfies TourStepDef[],
  },
  ownerTour: {
    steps: [
      {
        id: "business",
        title: "Business",
        body: "Set up your business information, look, and booking page.",
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
        body: "Share this link with customers so they can book online.",
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
