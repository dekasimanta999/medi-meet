import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

export type ProfessionalDropdownOption = {
  value: string;
  label: string;
};

type ProfessionalDropdownProps = {
  id?: string;
  value: string;
  options: ProfessionalDropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: "default" | "patient" | "doctor";
  leftIcon?: ReactNode;
  required?: boolean;
};

export function ProfessionalDropdown({
  id,
  value,
  options,
  onChange,
  placeholder = "Select",
  variant = "default",
  leftIcon,
  required = false,
}: ProfessionalDropdownProps) {
  const generatedId = useId();
  const buttonId = id || generatedId;
  const menuId = `${buttonId}-menu`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value);
  const variantClass = `professional-dropdown--${variant}`;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className={`professional-dropdown ${variantClass}`}>
      <button
        id={buttonId}
        type="button"
        className={`professional-dropdown__trigger ${leftIcon ? "professional-dropdown__trigger--with-icon" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-required={required}
        onClick={() => setOpen((current) => !current)}
      >
        {leftIcon ? <span className="professional-dropdown__left-icon">{leftIcon}</span> : null}
        <span className={selected ? "professional-dropdown__value" : "professional-dropdown__placeholder"}>
          {selected?.label || placeholder}
        </span>
        <span className="professional-dropdown__chevron">
          <ChevronDown size={16} strokeWidth={2.4} />
        </span>
      </button>

      {open ? (
        <div id={menuId} className="professional-dropdown__menu" role="listbox" aria-labelledby={buttonId}>
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                className={`professional-dropdown__option ${isSelected ? "is-selected" : ""}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {isSelected ? <Check size={16} strokeWidth={2.6} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
