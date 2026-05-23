"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type InstitutionConfig = {
  id: number;
  name: string;
  locale: string;
};

type ModuleConfig = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  fields: {
    id: number;
    key: string;
    label: string;
    type: string;
    visible: boolean;
    required: boolean;
    order: number;
    options?: { label: string; value: string }[];
  }[];
};

type NewField = {
  key: string;
  label: string;
  field_type: string;
  visible: boolean;
  required: boolean;
  optionsText: string;
};

const emptyField: NewField = {
  key: "",
  label: "",
  field_type: "text",
  visible: true,
  required: false,
  optionsText: ""
};

export function AdminConfigBuilder({
  token,
  onSaved
}: {
  token: string;
  onSaved?: () => Promise<void> | void;
}) {
  const [institution, setInstitution] = useState<InstitutionConfig | null>(null);
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [newField, setNewField] = useState<NewField>(emptyField);
  const [savingAction, setSavingAction] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [nextInstitution, nextModules] = await Promise.all([
        apiGet<InstitutionConfig>("/api/config/institution", token),
        apiGet<ModuleConfig[]>("/api/config/modules", token)
      ]);
      setInstitution(nextInstitution);
      setModules(nextModules);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load configuration");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveInstitution() {
    if (!institution) {
      return;
    }
    await runSave("institution", async () => {
      await apiPost("/api/config/institution", {
        name: institution.name.trim(),
        locale: institution.locale.trim() || "en-IN"
      }, token);
      setSaved("Institution settings saved");
      await load();
      await onSaved?.();
    });
  }

  async function toggle(module: ModuleConfig) {
    await runSave(`module-${module.key}`, async () => {
      await apiPost(
        "/api/config/modules",
        {
          key: module.key,
          label: module.label,
          description: module.description,
          enabled: !module.enabled
        },
        token
      );
      setSaved(`${module.label} visibility saved`);
      await load();
      await onSaved?.();
    });
  }

  function updateField(
    moduleKey: string,
    fieldId: number,
    patch: Partial<ModuleConfig["fields"][number]>
  ) {
    setModules((current) =>
      current.map((module) =>
        module.key !== moduleKey
          ? module
          : {
              ...module,
              fields: module.fields.map((field) =>
                field.id === fieldId ? { ...field, ...patch } : field
              )
            }
      )
    );
  }

  async function saveFields(module: ModuleConfig) {
    await runSave(`fields-${module.key}`, async () => {
      const payload = module.fields.map((field) => ({
        id: field.id,
        label: field.label.trim() || field.key,
        visible: field.visible,
        required: field.required,
        order: Number(field.order) || 0
      }));
      await apiPost(`/api/config/modules/${module.key}/fields`, payload, token);
      setSaved(`${module.label} fields saved`);
      await load();
      await onSaved?.();
    });
  }

  async function addStudentField() {
    if (!newField.key.trim() || !newField.label.trim()) {
      setSaved("");
      setError("Field key and label are required");
      return;
    }
    const options = newField.optionsText
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean);
    if (newField.field_type === "select" && options.length === 0) {
      setSaved("");
      setError("Add at least one LOV option for a select field");
      return;
    }
    await runSave("add-student-field", async () => {
      await apiPost(
        "/api/config/modules/students/fields/add",
        {
          module_key: "students",
          key: newField.key.trim(),
          label: newField.label.trim(),
          field_type: newField.field_type,
          visible: newField.visible,
          required: newField.required,
          options
        },
        token
      );
      setSaved("Student custom field added");
      setNewField(emptyField);
      await load();
      await onSaved?.();
    });
  }

  async function runSave(action: string, operation: () => Promise<void>) {
    try {
      setSavingAction(action);
      setError("");
      setSaved("");
      await operation();
    } catch (nextError) {
      setSaved("");
      setError(nextError instanceof Error ? nextError.message : "Could not save configuration");
    } finally {
      setSavingAction("");
    }
  }

  const studentsModule = modules.find((module) => module.key === "students");

  return (
    <section className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {saved}
        </div>
      ) : null}

      <article className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Institution Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          This name appears in the app sidebar and workspace context.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px_auto]">
          <label className="text-sm font-medium text-slate-700">
            Institution Name
            <input
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
              value={institution?.name ?? ""}
              onChange={(event) =>
                setInstitution((current) =>
                  current ? { ...current, name: event.target.value } : current
                )
              }
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Locale
            <input
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
              value={institution?.locale ?? "en-IN"}
              onChange={(event) =>
                setInstitution((current) =>
                  current ? { ...current, locale: event.target.value } : current
                )
              }
            />
          </label>
          <button
            className="self-end rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={saveInstitution}
            disabled={savingAction === "institution"}
          >
            {savingAction === "institution" ? "Saving..." : "Save"}
          </button>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Add Student Field</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add custom fields like Blood Group, Transport Route, House, or Emergency Contact.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Field Key
            <input
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
              placeholder="blood_group"
              value={newField.key}
              onChange={(event) => setNewField({ ...newField, key: event.target.value })}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Label
            <input
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
              placeholder="Blood Group"
              value={newField.label}
              onChange={(event) => setNewField({ ...newField, label: event.target.value })}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Type
            <select
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
              value={newField.field_type}
              onChange={(event) => setNewField({ ...newField, field_type: event.target.value })}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select / LOV</option>
            </select>
          </label>
          {newField.field_type === "select" ? (
            <label className="text-sm font-medium text-slate-700 md:col-span-3">
              LOV Options
              <input
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                placeholder="Red, Blue, Green"
                value={newField.optionsText}
                onChange={(event) =>
                  setNewField({ ...newField, optionsText: event.target.value })
                }
              />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              checked={newField.visible}
              type="checkbox"
              onChange={(event) =>
                setNewField({ ...newField, visible: event.target.checked })
              }
            />
            Visible
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              checked={newField.required}
              type="checkbox"
              onChange={(event) =>
                setNewField({ ...newField, required: event.target.checked })
              }
            />
            Required
          </label>
          <button
            className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={addStudentField}
            disabled={savingAction === "add-student-field"}
          >
            {savingAction === "add-student-field" ? "Adding..." : "Add Field"}
          </button>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Student Field Configuration</h2>
        <p className="mt-1 text-sm text-slate-500">
          Hide fields, make fields required, rename labels, or reorder the Students form and table.
        </p>
        <div className="mt-4 space-y-3">
          {(studentsModule?.fields ?? []).map((field) => (
            <div
              className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_110px_110px_80px]"
              key={field.id}
            >
              <label className="text-sm font-medium text-slate-700">
                Label
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-500"
                  value={field.label}
                  onChange={(event) =>
                    updateField("students", field.id, { label: event.target.value })
                  }
                />
                <span className="mt-1 block text-xs text-slate-400">
                  {field.key} · {field.type}
                  {field.options?.length ? ` · ${field.options.map((option) => option.label).join(", ")}` : ""}
                </span>
              </label>
              <label className="flex items-center gap-2 self-center text-sm font-medium text-slate-700">
                <input
                  checked={field.visible}
                  type="checkbox"
                  onChange={(event) =>
                    updateField("students", field.id, { visible: event.target.checked })
                  }
                />
                Visible
              </label>
              <label className="flex items-center gap-2 self-center text-sm font-medium text-slate-700">
                <input
                  checked={field.required}
                  type="checkbox"
                  onChange={(event) =>
                    updateField("students", field.id, { required: event.target.checked })
                  }
                />
                Required
              </label>
              <label className="text-sm font-medium text-slate-700">
                Order
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-500"
                  type="number"
                  value={field.order}
                  onChange={(event) =>
                    updateField("students", field.id, { order: Number(event.target.value) })
                  }
                />
              </label>
            </div>
          ))}
        </div>
        {studentsModule ? (
          <button
            className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => saveFields(studentsModule)}
            disabled={savingAction === "fields-students"}
          >
            {savingAction === "fields-students" ? "Saving..." : "Save Student Fields"}
          </button>
        ) : null}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Visible Modules</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {modules
            .filter((module) => ["students", "attendance", "fees", "configuration"].includes(module.key))
            .map((module) => (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={module.key}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{module.label}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{module.description}</p>
                  </div>
                  <button
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                      module.enabled
                        ? "bg-slate-950 text-white"
                        : "border border-slate-300 text-slate-700"
                    }`}
                    onClick={() => toggle(module)}
                    disabled={savingAction === `module-${module.key}`}
                  >
                    {savingAction === `module-${module.key}` ? "Saving..." : module.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              </div>
            ))}
        </div>
      </article>
    </section>
  );
}
