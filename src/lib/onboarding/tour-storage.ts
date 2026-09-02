export const TOUR_DONE_VALUE = "1";

export function bookingTourStorageKey(orgId?: string) {
  return orgId ? `bf_tour_booking_v1_${orgId}` : "bf_tour_booking_v1";
}

export function ownerTourStorageKey(orgId: string) {
  return `bf_tour_owner_v1_${orgId}`;
}

export function staffTourStorageKey(orgId: string) {
  return `bf_tour_staff_v1_${orgId}`;
}

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export function isTourCompleted(
  key: string,
  storage: StorageLike | null | undefined,
) {
  if (!storage) return false;
  try {
    return storage.getItem(key) === TOUR_DONE_VALUE;
  } catch {
    return false;
  }
}

export function markTourCompleted(
  key: string,
  storage: StorageLike | null | undefined,
) {
  if (!storage) return;
  try {
    storage.setItem(key, TOUR_DONE_VALUE);
  } catch {
    // private mode / quota — fail closed (don't loop the tour if we can't persist)
  }
}

export function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
