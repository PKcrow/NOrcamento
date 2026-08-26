import { vi } from "vitest";

/**
 * Mutable holder for the "signed-in" Clerk user id used by the mocked
 * @clerk/express module. Tests switch identity by assigning `currentUserId`.
 */
export const authState: { currentUserId: string | null } = {
  currentUserId: null,
};

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void) =>
      next(),
  getAuth: () => ({ userId: authState.currentUserId }),
  clerkClient: {
    users: {
      getUser: async (id: string) => ({
        emailAddresses: [{ emailAddress: `${id}@test.local` }],
        firstName: "Test",
        lastName: id,
      }),
    },
  },
}));
