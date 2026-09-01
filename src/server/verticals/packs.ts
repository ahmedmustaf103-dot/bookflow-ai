export type VerticalPackId =
  | "barber_salon"
  | "dental"
  | "tutors"
  | "gyms";

export type VerticalPack = {
  id: VerticalPackId;
  label: string;
  description: string;
  terminology: {
    resource: string;
    resources: string;
    client: string;
    clients: string;
    service: string;
    services: string;
    location: string;
  };
  /** Seeded on org create when pack has defaults */
  defaultServices: Array<{
    name: string;
    durationMin: number;
    priceCents: number;
    bufferAfter?: number;
  }>;
  clientFormHints: {
    phoneRequired: boolean;
    notesPlaceholder: string;
  };
};

export const VERTICAL_PACKS: Record<VerticalPackId, VerticalPack> = {
  barber_salon: {
    id: "barber_salon",
    label: "Barber / Salon",
    description: "Cuts, colour, and salon appointments",
    terminology: {
      resource: "Staff",
      resources: "Staff",
      client: "Client",
      clients: "Clients",
      service: "Service",
      services: "Services",
      location: "Location",
    },
    defaultServices: [
      { name: "Haircut", durationMin: 30, priceCents: 3500, bufferAfter: 5 },
      { name: "Beard trim", durationMin: 15, priceCents: 1500 },
      { name: "Cut & style", durationMin: 45, priceCents: 5500, bufferAfter: 5 },
    ],
    clientFormHints: {
      phoneRequired: false,
      notesPlaceholder: "Allergies, preferred stylist, notes…",
    },
  },
  dental: {
    id: "dental",
    label: "Dental",
    description: "Hygiene, exams, and appointments",
    terminology: {
      resource: "Provider",
      resources: "Providers",
      client: "Patient",
      clients: "Patients",
      service: "Procedure",
      services: "Procedures",
      location: "Clinic",
    },
    defaultServices: [
      { name: "Cleaning", durationMin: 45, priceCents: 12000 },
      { name: "Exam", durationMin: 30, priceCents: 8000 },
    ],
    clientFormHints: {
      phoneRequired: true,
      notesPlaceholder: "Insurance, referring dentist, notes…",
    },
  },
  tutors: {
    id: "tutors",
    label: "Tutors",
    description: "1:1 lessons and sessions",
    terminology: {
      resource: "Tutor",
      resources: "Tutors",
      client: "Student",
      clients: "Students",
      service: "Lesson",
      services: "Lessons",
      location: "Studio",
    },
    defaultServices: [
      { name: "60-min lesson", durationMin: 60, priceCents: 6000 },
      { name: "30-min lesson", durationMin: 30, priceCents: 3500 },
    ],
    clientFormHints: {
      phoneRequired: false,
      notesPlaceholder: "Subject, level, goals…",
    },
  },
  gyms: {
    id: "gyms",
    label: "Gyms",
    description: "PT sessions and room bookings",
    terminology: {
      resource: "Trainer",
      resources: "Trainers",
      client: "Member",
      clients: "Members",
      service: "Session",
      services: "Sessions",
      location: "Gym",
    },
    defaultServices: [
      { name: "Personal training", durationMin: 60, priceCents: 7500 },
      { name: "Intro consult", durationMin: 30, priceCents: 0 },
    ],
    clientFormHints: {
      phoneRequired: true,
      notesPlaceholder: "Goals, injuries, preferred times…",
    },
  },
};

export function isVerticalPackId(value: string): value is VerticalPackId {
  return value in VERTICAL_PACKS;
}

export function getVerticalPack(id: string): VerticalPack {
  if (isVerticalPackId(id)) return VERTICAL_PACKS[id];
  return VERTICAL_PACKS.barber_salon;
}

export function listVerticalPacks(): VerticalPack[] {
  return Object.values(VERTICAL_PACKS);
}
