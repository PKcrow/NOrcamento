import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const teamName = process.env.E2E_TEAM_NAME;
const hasE2ECredentials = Boolean(email && password && teamName);

if (process.env.CI && !hasE2ECredentials) {
  throw new Error("CI E2E requires E2E_EMAIL, E2E_PASSWORD e E2E_TEAM_NAME.");
}

const isolatedNotifications = {
  overdueTasks: [],
  dueSoonTasks: [],
  pendingPaymentTasks: [],
  quoteResponses: [],
};

test.describe("Central de notificações autenticada", () => {
  test.skip(
    !hasE2ECredentials,
    "Configure E2E_EMAIL, E2E_PASSWORD e E2E_TEAM_NAME para usar a conta dedicada de E2E.",
  );

  test("abre a Central pelo Perfil e recupera uma falha com retry", async ({
    page,
  }) => {
    await page.goto("/");

    const signInForm = page.getByText("Entrar com e-mail", { exact: true });
    if (await signInForm.isVisible().catch(() => false)) {
      const inputs = page.locator("input");
      await inputs.nth(0).fill(email!);
      await inputs.nth(1).fill(password!);
      await signInForm.click();
    }

    await expect(page.getByRole("tab", { name: "Perfil" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("tab", { name: "Perfil" }).click();
    await expect(page.getByText("Sair da conta", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(teamName!, { exact: true })).toBeVisible();

    let notificationRequests = 0;
    await page.route("**/api/notifications", async (route) => {
      notificationRequests += 1;

      if (notificationRequests <= 2) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "E2E notification outage" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(isolatedNotifications),
      });
    });

    await page.getByText("Notificações", { exact: true }).click();
    await expect(page).toHaveURL(/notificacoes/);
    await expect(
      page.getByText("Não foi possível carregar as notificações", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText("Tentar novamente", { exact: true }),
    ).toBeVisible();

    await page.getByText("Tentar novamente", { exact: true }).click();
    await expect(
      page.getByText("Tudo em dia por enquanto.", { exact: true }),
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText("Não foi possível carregar as notificações", {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Tentar novamente", { exact: true }),
    ).toHaveCount(0);
    expect(notificationRequests).toBeGreaterThanOrEqual(3);
  });

  test("orienta a recuperação quando a sessão expira na Central", async ({
    page,
  }) => {
    await page.goto("/");

    const signInForm = page.getByText("Entrar com e-mail", { exact: true });
    if (await signInForm.isVisible().catch(() => false)) {
      const inputs = page.locator("input");
      await inputs.nth(0).fill(email!);
      await inputs.nth(1).fill(password!);
      await signInForm.click();
    }

    await expect(page.getByRole("tab", { name: "Perfil" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("tab", { name: "Perfil" }).click();
    await expect(page.getByText("Sair da conta", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(teamName!, { exact: true })).toBeVisible();

    let notificationRequests = 0;
    await page.route("**/api/notifications", async (route) => {
      notificationRequests += 1;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "E2E session expired" }),
      });
    });

    await page.getByText("Notificações", { exact: true }).click();
    await expect(page).toHaveURL(/notificacoes/);
    await expect(page.getByText("Sessão expirada", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText(
        "Sua sessão perdeu a validade. Renove a sessão ou entre novamente para continuar.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByText("Renovar sessão", { exact: true })).toBeVisible();
    await expect(page.getByText("Voltar ao login", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Não foi possível carregar as notificações", { exact: true }),
    ).toHaveCount(0);

    const requestsBeforeRenewal = notificationRequests;
    await page.getByText("Renovar sessão", { exact: true }).click();
    await expect
      .poll(() => notificationRequests, { timeout: 30_000 })
      .toBeGreaterThan(requestsBeforeRenewal);
    await expect(page.getByText("Sessão expirada", { exact: true })).toBeVisible();

    await page.getByText("Voltar ao login", { exact: true }).click();
    await expect(page.getByText("Entrar com e-mail", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });
});
