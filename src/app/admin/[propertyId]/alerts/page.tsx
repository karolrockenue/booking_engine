"use client";

import { TopStrip, Btn } from "@/components/admin/TopStrip";

export default function AlertsPage() {
  return (
    <>
      <TopStrip
        title="Alerts"
        subtitle="Step 1 placeholder · auto-generated operational alerts (postReservation failures, dropped extras, expiring tokens) land in a later step"
        actions={<Btn>Mark all read</Btn>}
      />
      <Placeholder name="Alerts" />
    </>
  );
}

function Placeholder({ name }: { name: string }) {
  return (
    <div
      className="border rounded-md p-12 text-center text-[13px]"
      style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
    >
      <strong style={{ color: "var(--a-ink)" }}>{name}</strong> tab — content lands in a later step.
    </div>
  );
}
