"use client";

import { useState } from "react";

export function CurrencyInput({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder: string;
}) {
  const [rawValue, setRawValue] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^0-9]/g, "");
    setRawValue(digits);
  }

  const displayValue = rawValue
    ? parseInt(rawValue, 10).toLocaleString("en-GB")
    : "";

  const formattedPlaceholder = placeholder
    ? parseInt(placeholder, 10).toLocaleString("en-GB")
    : "";

  return (
    <div>
      <label htmlFor={name} className="text-[13px] font-medium">
        {label}
      </label>
      <div
        className="mt-1.5 flex items-center rounded-lg border"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <span
          className="select-none pl-3 pr-1 text-[15px]"
          style={{ color: "var(--text-secondary)" }}
          aria-hidden
        >
          £
        </span>
        <input
          id={name}
          type="text"
          inputMode="numeric"
          required
          value={displayValue}
          onChange={handleChange}
          placeholder={formattedPlaceholder}
          className="flex-1 bg-transparent py-2.5 pr-3 text-[15px] outline-none"
        />
        <input type="hidden" name={name} value={rawValue} />
      </div>
    </div>
  );
}
