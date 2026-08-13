import { vi } from "vitest";

import { loadTestEnv } from "./load-test-env";

loadTestEnv();

vi.mock("server-only", () => ({}));

vi.mock("next/server", () => ({
  after: (fn: () => void) => {
    void fn();
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));
