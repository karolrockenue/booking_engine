import { db } from "@/db";
import { emailTemplates, emailSchedules, properties } from "@/db/schema";
import { and, eq } from "drizzle-orm";

import { buildDefaultTemplates } from "./template-defaults";
import { resolveEmailFonts, PORTICO_FONTS, type EmailFontStacks } from "./fonts";
import { parseTheme } from "@/lib/get-property";

// Seed default email templates + schedules for a property. Idempotent —
// existing rows are left alone (admin edits are owned forever).
// Resolves the property's theme typography into email-safe font stacks so the
// seeded templates match the live site's headings + body type.

export async function seedEmailTemplatesForProperty(
  propertyId: string
): Promise<{
  templatesInserted: number;
  schedulesInserted: number;
  fonts: EmailFontStacks;
}> {
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (!property) {
    throw new Error(`property_not_found:${propertyId}`);
  }

  // If this Railway deployment runs the Portico theme, use the brand stack
  // regardless of what `properties.theme.typography` says (admin may have
  // overridden it to something off-brand). For other themes, pull from the
  // theme tokens.
  const isPortico = process.env.THEME === "portico-ivory";
  const fonts = isPortico ? PORTICO_FONTS : resolveEmailFonts(parseTheme(property.theme));

  const defs = buildDefaultTemplates(fonts);

  let templatesInserted = 0;
  let schedulesInserted = 0;

  for (const def of defs) {
    const [existing] = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.propertyId, propertyId),
          eq(emailTemplates.key, def.key)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(emailTemplates).values({
        propertyId,
        key: def.key,
        name: def.name,
        subject: def.subject,
        body: def.design,
        bodyFormat: "unlayer",
        htmlCached: def.html,
        status: def.status,
        isTransactional: def.isTransactional,
      });
      templatesInserted++;
    }

    if (def.defaultSchedule) {
      const [existingSchedule] = await db
        .select({ id: emailSchedules.id })
        .from(emailSchedules)
        .where(
          and(
            eq(emailSchedules.propertyId, propertyId),
            eq(emailSchedules.templateKey, def.key)
          )
        )
        .limit(1);
      if (!existingSchedule) {
        await db.insert(emailSchedules).values({
          propertyId,
          templateKey: def.key,
          enabled: def.defaultSchedule.enabled,
          trigger: def.defaultSchedule.trigger,
          offsetDays: def.defaultSchedule.offsetDays,
          timeOfDay: def.defaultSchedule.timeOfDay,
          audience: def.defaultSchedule.audience,
        });
        schedulesInserted++;
      }
    }
  }

  return { templatesInserted, schedulesInserted, fonts };
}
