import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teamsTable = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  logoUrl: text("logo_url"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  legalName: text("legal_name"),
  taxId: text("tax_id"),
  website: text("website"),
  pixKey: text("pix_key"),
  bankDetails: text("bank_details"),
  paymentInstructions: text("payment_instructions"),
  additionalInfo: text("additional_info"),
  marketingHeadline: text("marketing_headline"),
  marketingAbout: text("marketing_about"),
  marketingServices: text("marketing_services"),
  marketingDifferentials: text("marketing_differentials"),
  showPhoneOnQuotes: boolean("show_phone_on_quotes").notNull().default(true),
  showEmailOnQuotes: boolean("show_email_on_quotes").notNull().default(true),
  showAddressOnQuotes: boolean("show_address_on_quotes").notNull().default(true),
  showLegalNameOnQuotes: boolean("show_legal_name_on_quotes").notNull().default(false),
  showTaxIdOnQuotes: boolean("show_tax_id_on_quotes").notNull().default(false),
  showWebsiteOnQuotes: boolean("show_website_on_quotes").notNull().default(false),
  showPixKeyOnQuotes: boolean("show_pix_key_on_quotes").notNull().default(false),
  showBankDetailsOnQuotes: boolean("show_bank_details_on_quotes").notNull().default(false),
  showPaymentInstructionsOnQuotes: boolean("show_payment_instructions_on_quotes").notNull().default(false),
  showAdditionalInfoOnQuotes: boolean("show_additional_info_on_quotes").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTeamSchema = createInsertSchema(teamsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
