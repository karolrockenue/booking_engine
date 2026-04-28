"use client";

import { type FormEvent } from "react";

interface GuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  specialRequests: string;
}

interface GuestDetailsFormProps {
  details: GuestDetails;
  onChange: (details: GuestDetails) => void;
  onSubmit: () => void;
  submitting?: boolean;
  /** Hide the submit button (when parent handles submission separately) */
  hideSubmit?: boolean;
}

const inputStyle = {
  fontFamily: "var(--font-body)",
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  color: "var(--color-text)",
};

export function GuestDetailsForm({
  details,
  onChange,
  onSubmit,
  submitting = false,
  hideSubmit = false,
}: GuestDetailsFormProps) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  function update(field: keyof GuestDetails, value: string) {
    onChange({ ...details, [field]: value });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3
        className="text-xl mb-2"
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: "var(--font-heading-weight)",
          color: "var(--color-text)",
        }}
      >
        Guest Details
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            className="block text-xs uppercase tracking-wider mb-2 font-medium"
            style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
          >
            First Name
          </label>
          <input
            type="text"
            required
            value={details.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            className="w-full px-4 py-3 text-sm"
            style={inputStyle}
          />
        </div>
        <div>
          <label
            className="block text-xs uppercase tracking-wider mb-2 font-medium"
            style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
          >
            Last Name
          </label>
          <input
            type="text"
            required
            value={details.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            className="w-full px-4 py-3 text-sm"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label
          className="block text-xs uppercase tracking-wider mb-2 font-medium"
          style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
        >
          Email
        </label>
        <input
          type="email"
          required
          value={details.email}
          onChange={(e) => update("email", e.target.value)}
          className="w-full px-4 py-3 text-sm"
          style={inputStyle}
        />
      </div>

      <div>
        <label
          className="block text-xs uppercase tracking-wider mb-2 font-medium"
          style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
        >
          Phone
        </label>
        <input
          type="tel"
          value={details.phone}
          onChange={(e) => update("phone", e.target.value)}
          className="w-full px-4 py-3 text-sm"
          style={inputStyle}
        />
      </div>

      <div>
        <label
          className="block text-xs uppercase tracking-wider mb-2 font-medium"
          style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
        >
          Country
        </label>
        <select
          required
          value={details.country}
          onChange={(e) => update("country", e.target.value)}
          className="w-full px-4 py-3 text-sm"
          style={inputStyle}
        >
          <option value="">Select country</option>
          <option value="GB">United Kingdom</option>
          <option value="US">United States</option>
          <option value="DE">Germany</option>
          <option value="FR">France</option>
          <option value="ES">Spain</option>
          <option value="IT">Italy</option>
          <option value="NL">Netherlands</option>
          <option value="BE">Belgium</option>
          <option value="CH">Switzerland</option>
          <option value="AT">Austria</option>
          <option value="IE">Ireland</option>
          <option value="AU">Australia</option>
          <option value="CA">Canada</option>
          <option value="JP">Japan</option>
          <option value="CN">China</option>
          <option value="AE">United Arab Emirates</option>
          <option value="SA">Saudi Arabia</option>
          <option value="IN">India</option>
          <option value="BR">Brazil</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      <div>
        <label
          className="block text-xs uppercase tracking-wider mb-2 font-medium"
          style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}
        >
          Special Requests <span className="normal-case tracking-normal font-normal">(optional)</span>
        </label>
        <textarea
          value={details.specialRequests}
          onChange={(e) => update("specialRequests", e.target.value)}
          rows={3}
          placeholder="Early check-in, extra pillows, dietary requirements..."
          className="w-full px-4 py-3 text-sm resize-none"
          style={inputStyle}
        />
        <p
          className="text-[11px] mt-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          We&apos;ll do our best to accommodate your requests.
        </p>
      </div>

      {!hideSubmit && (
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 px-8 py-3 text-sm uppercase tracking-widest transition-colors disabled:opacity-50"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: "600",
            borderRadius: "var(--radius-button)",
            backgroundColor: "var(--color-primary)",
            color: "#FFFFFF",
            border: "none",
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Processing..." : "Continue to Payment"}
        </button>
      )}
    </form>
  );
}

export type { GuestDetails };
