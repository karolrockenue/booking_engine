"use client";

import { useState } from "react";
import type { PropertyTheme } from "@/lib/theme";

interface ThemeEditorProps {
  theme: PropertyTheme;
  onSave: (theme: PropertyTheme) => Promise<void>;
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded border cursor-pointer p-0"
      />
      <div className="flex-1">
        <label className="block text-xs text-gray-500">{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs font-mono text-gray-700 border-0 p-0 bg-transparent"
        />
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded text-sm text-gray-900"
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded text-sm text-gray-900"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const fontOptions = [
  { value: "Georgia, serif", label: "Georgia (Serif)" },
  { value: "'Playfair Display', serif", label: "Playfair Display (Serif)" },
  { value: "'Times New Roman', serif", label: "Times New Roman (Serif)" },
  { value: "system-ui, -apple-system, sans-serif", label: "System UI (Sans)" },
  { value: "'Inter', sans-serif", label: "Inter (Sans)" },
  { value: "'Helvetica Neue', Arial, sans-serif", label: "Helvetica (Sans)" },
  { value: "'DM Sans', sans-serif", label: "DM Sans (Sans)" },
];

export function ThemeEditor({ theme, onSave }: ThemeEditorProps) {
  const [t, setT] = useState<PropertyTheme>({ ...theme });
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<"colors" | "typography" | "layout" | "style" | "hero" | "contact">("colors");

  function updateColors(key: keyof PropertyTheme["colors"], value: string) {
    setT({ ...t, colors: { ...t.colors, [key]: value } });
  }

  function updateTypography(key: keyof PropertyTheme["typography"], value: string | number) {
    setT({ ...t, typography: { ...t.typography, [key]: value } });
  }

  function updateLayout(key: keyof PropertyTheme["layout"], value: string) {
    setT({ ...t, layout: { ...t.layout, [key]: value } });
  }

  function updateStyle(key: keyof PropertyTheme["style"], value: string) {
    setT({ ...t, style: { ...t.style, [key]: value } as PropertyTheme["style"] });
  }

  function updateHero(key: keyof PropertyTheme["hero"], value: string | number | null) {
    setT({ ...t, hero: { ...t.hero, [key]: value } });
  }

  function updateContact(key: keyof PropertyTheme["contact"], value: string) {
    setT({ ...t, contact: { ...t.contact, [key]: value } });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(t);
    } finally {
      setSaving(false);
    }
  }

  const sections = ["colors", "typography", "layout", "style", "hero", "contact"] as const;

  return (
    <div>
      {/* Section tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto">
        {sections.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-3 py-1.5 text-xs font-medium capitalize rounded-full whitespace-nowrap ${
              section === s
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Colors */}
      {section === "colors" && (
        <div className="grid gap-4 md:grid-cols-2">
          <ColorInput label="Primary" value={t.colors.primary} onChange={(v) => updateColors("primary", v)} />
          <ColorInput label="Secondary" value={t.colors.secondary} onChange={(v) => updateColors("secondary", v)} />
          <ColorInput label="Accent" value={t.colors.accent} onChange={(v) => updateColors("accent", v)} />
          <ColorInput label="Background" value={t.colors.background} onChange={(v) => updateColors("background", v)} />
          <ColorInput label="Surface" value={t.colors.surface} onChange={(v) => updateColors("surface", v)} />
          <ColorInput label="Text" value={t.colors.text} onChange={(v) => updateColors("text", v)} />
          <ColorInput label="Text Muted" value={t.colors.textMuted} onChange={(v) => updateColors("textMuted", v)} />
          <ColorInput label="Border" value={t.colors.border} onChange={(v) => updateColors("border", v)} />
          <ColorInput label="Error" value={t.colors.error} onChange={(v) => updateColors("error", v)} />
          <ColorInput label="Success" value={t.colors.success} onChange={(v) => updateColors("success", v)} />

          {/* Preview swatches */}
          <div className="md:col-span-2 mt-4">
            <p className="text-xs text-gray-500 mb-2">Preview</p>
            <div className="flex gap-2">
              {Object.entries(t.colors).map(([key, val]) => (
                <div
                  key={key}
                  className="w-10 h-10 rounded border"
                  style={{ backgroundColor: val }}
                  title={key}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Typography */}
      {section === "typography" && (
        <div className="grid gap-4 md:grid-cols-2">
          <SelectInput
            label="Heading Font"
            value={t.typography.headingFont}
            onChange={(v) => updateTypography("headingFont", v)}
            options={fontOptions}
          />
          <SelectInput
            label="Body Font"
            value={t.typography.bodyFont}
            onChange={(v) => updateTypography("bodyFont", v)}
            options={fontOptions}
          />
          <SelectInput
            label="Heading Weight"
            value={t.typography.headingWeight}
            onChange={(v) => updateTypography("headingWeight", v)}
            options={[
              { value: "400", label: "Regular (400)" },
              { value: "500", label: "Medium (500)" },
              { value: "600", label: "Semibold (600)" },
              { value: "700", label: "Bold (700)" },
              { value: "800", label: "Extra Bold (800)" },
              { value: "900", label: "Black (900)" },
            ]}
          />
          <TextInput
            label="Heading Letter Spacing"
            value={t.typography.headingLetterSpacing}
            onChange={(v) => updateTypography("headingLetterSpacing", v)}
            placeholder="-0.02em"
          />
          <TextInput
            label="Base Font Size"
            value={t.typography.baseSize}
            onChange={(v) => updateTypography("baseSize", v)}
            placeholder="16px"
          />
          <TextInput
            label="Body Line Height"
            value={t.typography.bodyLineHeight}
            onChange={(v) => updateTypography("bodyLineHeight", v)}
            placeholder="1.6"
          />

          {/* Typography preview */}
          <div className="md:col-span-2 mt-4 p-6 border rounded" style={{ backgroundColor: t.colors.background }}>
            <h2
              style={{
                fontFamily: t.typography.headingFont,
                fontWeight: t.typography.headingWeight,
                letterSpacing: t.typography.headingLetterSpacing,
                color: t.colors.text,
                fontSize: "28px",
                marginBottom: "8px",
              }}
            >
              Heading Preview
            </h2>
            <p
              style={{
                fontFamily: t.typography.bodyFont,
                fontWeight: t.typography.bodyWeight,
                lineHeight: t.typography.bodyLineHeight,
                color: t.colors.textMuted,
                fontSize: t.typography.baseSize,
              }}
            >
              Body text preview. This is how your hotel description and content will look to guests visiting your website.
            </p>
          </div>
        </div>
      )}

      {/* Layout */}
      {section === "layout" && (
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Max Width" value={t.layout.maxWidth} onChange={(v) => updateLayout("maxWidth", v)} placeholder="1280px" />
          <TextInput label="Section Padding" value={t.layout.sectionPadding} onChange={(v) => updateLayout("sectionPadding", v)} placeholder="96px" />
          <TextInput label="Container Padding" value={t.layout.containerPadding} onChange={(v) => updateLayout("containerPadding", v)} placeholder="24px" />
          <TextInput label="Border Radius" value={t.layout.borderRadius} onChange={(v) => updateLayout("borderRadius", v)} placeholder="2px" />
          <TextInput label="Button Radius" value={t.layout.buttonRadius} onChange={(v) => updateLayout("buttonRadius", v)} placeholder="0px" />
          <TextInput label="Card Radius" value={t.layout.cardRadius} onChange={(v) => updateLayout("cardRadius", v)} placeholder="4px" />

          {/* Radius preview */}
          <div className="md:col-span-2 mt-4 flex gap-4">
            <div className="p-4 border text-center text-xs text-gray-500" style={{ borderRadius: t.layout.borderRadius }}>
              Input ({t.layout.borderRadius})
            </div>
            <div
              className="px-6 py-2 text-center text-xs text-white"
              style={{ borderRadius: t.layout.buttonRadius, backgroundColor: t.colors.primary }}
            >
              Button ({t.layout.buttonRadius})
            </div>
            <div className="p-6 border text-center text-xs text-gray-500" style={{ borderRadius: t.layout.cardRadius }}>
              Card ({t.layout.cardRadius})
            </div>
          </div>
        </div>
      )}

      {/* Style */}
      {section === "style" && (
        <div className="grid gap-4 md:grid-cols-2">
          <SelectInput
            label="Nav Style"
            value={t.style.navStyle}
            onChange={(v) => updateStyle("navStyle", v)}
            options={[
              { value: "transparent", label: "Transparent (overlays hero)" },
              { value: "solid", label: "Solid (white background)" },
              { value: "sticky", label: "Sticky (stays at top)" },
            ]}
          />
          <SelectInput
            label="Button Style"
            value={t.style.buttonStyle}
            onChange={(v) => updateStyle("buttonStyle", v)}
            options={[
              { value: "solid", label: "Solid (filled)" },
              { value: "outline", label: "Outline (border only)" },
              { value: "ghost", label: "Ghost (text only)" },
            ]}
          />
          <SelectInput
            label="Hero Style"
            value={t.style.heroStyle}
            onChange={(v) => updateStyle("heroStyle", v)}
            options={[
              { value: "fullbleed", label: "Full Bleed (100vh)" },
              { value: "contained", label: "Contained" },
              { value: "split", label: "Split (text + image)" },
            ]}
          />
          <SelectInput
            label="Image Treatment"
            value={t.style.imageTreatment}
            onChange={(v) => updateStyle("imageTreatment", v)}
            options={[
              { value: "none", label: "None (sharp)" },
              { value: "rounded", label: "Rounded corners" },
              { value: "shadow", label: "Drop shadow" },
              { value: "border", label: "Border" },
            ]}
          />
        </div>
      )}

      {/* Hero */}
      {section === "hero" && (
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Headline" value={t.hero.headline} onChange={(v) => updateHero("headline", v)} />
          <TextInput label="Subheadline" value={t.hero.subheadline} onChange={(v) => updateHero("subheadline", v)} />
          <TextInput label="Image URL" value={t.hero.imageUrl ?? ""} onChange={(v) => updateHero("imageUrl", v || null)} placeholder="https://..." />
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Overlay Opacity ({t.hero.overlayOpacity})
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={t.hero.overlayOpacity}
              onChange={(e) => updateHero("overlayOpacity", parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Contact */}
      {section === "contact" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <TextInput label="Address" value={t.contact.address} onChange={(v) => updateContact("address", v)} placeholder="123 Hotel Street, London" />
          </div>
          <TextInput label="Phone" value={t.contact.phone} onChange={(v) => updateContact("phone", v)} placeholder="+44 20 1234 5678" />
          <TextInput label="Email" value={t.contact.email} onChange={(v) => updateContact("email", v)} placeholder="hello@hotel.com" />
          <TextInput
            label="Instagram URL"
            value={t.social.instagram ?? ""}
            onChange={(v) => setT({ ...t, social: { ...t.social, instagram: v || null } })}
          />
          <TextInput
            label="TripAdvisor URL"
            value={t.social.tripadvisor ?? ""}
            onChange={(v) => setT({ ...t, social: { ...t.social, tripadvisor: v || null } })}
          />
        </div>
      )}

      {/* Save button */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-gray-900 text-white rounded text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Theme"}
        </button>
        <p className="text-xs text-gray-400">Changes are live immediately after saving.</p>
      </div>
    </div>
  );
}
