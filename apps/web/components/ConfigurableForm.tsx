"use client";

import { FormEvent, useEffect, useState } from "react";

type FieldConfig = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: { label: string; value: string }[];
};

type ConfigurableFormProps = {
  fields: FieldConfig[];
  initialValues?: Record<string, string>;
  onSubmit: (payload: Record<string, string>) => Promise<void>;
  submitLabel: string;
};

export function ConfigurableForm({
  fields,
  initialValues = {},
  onSubmit,
  submitLabel
}: ConfigurableFormProps) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const editableFields = fields.filter((field) => field.key !== "id");

  useEffect(() => {
    setValues(initialValues);
    setMessage("");
  }, [initialValues]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");
    try {
      await onSubmit(values);
      setValues(initialValues);
      setMessage("Saved. Workspace data refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save record");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="grid gap-4 md:grid-cols-3" onSubmit={submit}>
      {editableFields.map((field) => (
        <label className="text-sm font-medium text-slate-700" key={field.key}>
          <span>
            {field.label}
            {field.required ? <span className="ml-1 text-red-500">*</span> : null}
          </span>
          {field.type === "select" ? (
            <select
              className="mt-1 h-11 w-full rounded-2xl border border-[#e6d6bf] bg-white/80 px-3 text-slate-950 outline-none transition focus:border-[#173b45] focus:ring-4 focus:ring-[#d6ece8]"
              required={field.required}
              value={values[field.key] ?? ""}
              onChange={(event) =>
                setValues({ ...values, [field.key]: event.target.value })
              }
            >
              <option value="">Select {field.label}</option>
              {(field.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="mt-1 h-11 w-full rounded-2xl border border-[#e6d6bf] bg-white/80 px-3 text-slate-950 outline-none transition focus:border-[#173b45] focus:ring-4 focus:ring-[#d6ece8]"
              required={field.required}
              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              value={values[field.key] ?? ""}
              onChange={(event) =>
                setValues({ ...values, [field.key]: event.target.value })
              }
            />
          )}
        </label>
      ))}
      <button
        className="self-end rounded-2xl bg-[#173b45] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f2c34] disabled:opacity-60"
        disabled={isSaving}
      >
        {isSaving ? "Saving..." : submitLabel}
      </button>
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 md:col-span-3">
          {message}
        </div>
      ) : null}
    </form>
  );
}
