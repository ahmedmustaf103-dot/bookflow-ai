"use client";

export function ConfirmActiveCheckbox({
  name,
  defaultChecked,
  label,
  deactivateMessage,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  deactivateMessage: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-[var(--ink)]">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5"
        onChange={(event) => {
          if (defaultChecked && !event.target.checked) {
            const confirmed = window.confirm(deactivateMessage);
            if (!confirmed) {
              event.target.checked = true;
            }
          }
        }}
      />
      <span>
        <span className="font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--ink-tertiary)]">
          Uncheck to hide from new bookings. Existing appointments stay on the
          calendar.
        </span>
      </span>
    </label>
  );
}
