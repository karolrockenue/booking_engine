"use client";

import { TopStrip, Btn } from "@/components/admin/TopStrip";

export default function DomainPage() {
  return (
    <>
      <TopStrip
        title="Domain & deploy"
        subtitle="Step 1 placeholder · domain config, DNS records, SSL status, Railway service info land in a later step"
        actions={null}
      />
      <Placeholder name="Domain & deploy" />
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
