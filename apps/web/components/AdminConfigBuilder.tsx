"use client";

import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";

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

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  linked_student_id?: number | null;
  linked_student_name?: string;
};

type UserOptions = {
  roles: { label: string; value: string }[];
  students: { label: string; value: number }[];
};

type MasterDataSet = {
  key: string;
  label: string;
  description: string;
  options: MasterDataOption[];
};

type MasterDataOption = {
  id: number;
  label: string;
  value: string;
  order: number;
  active: boolean;
};

type NewField = {
  key: string;
  label: string;
  field_type: string;
  visible: boolean;
  required: boolean;
  optionsText: string;
};

type UserForm = {
  id?: number;
  name: string;
  email: string;
  role: string;
  password: string;
  active: boolean;
  linked_student_id: string;
};

type OptionDraft = {
  label: string;
  value: string;
};

const emptyField: NewField = {
  key: "",
  label: "",
  field_type: "text",
  visible: true,
  required: false,
  optionsText: ""
};

const emptyUser: UserForm = {
  name: "",
  email: "",
  role: "teacher",
  password: "",
  active: true,
  linked_student_id: ""
};

const inputClass =
  "mt-1 h-10 w-full rounded-2xl border border-[#e6d6bf] bg-white/80 px-3 text-sm outline-none transition focus:border-[#173b45] focus:ring-4 focus:ring-[#d6ece8]";

const cardClass = "rounded-[24px] border border-white/75 bg-white/65 p-5 shadow-sm backdrop-blur";

const tabs = [
  { key: "institution", label: "Institution" },
  { key: "users", label: "Users" },
  { key: "master-data", label: "Master Data" },
  { key: "student-fields", label: "Student Fields" },
  { key: "modules", label: "Modules" }
];

export function AdminConfigBuilder({
  token,
  onSaved
}: {
  token: string;
  onSaved?: () => Promise<void> | void;
}) {
  const [institution, setInstitution] = useState<InstitutionConfig | null>(null);
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userOptions, setUserOptions] = useState<UserOptions>({ roles: [], students: [] });
  const [masterData, setMasterData] = useState<MasterDataSet[]>([]);
  const [newField, setNewField] = useState<NewField>(emptyField);
  const [userForm, setUserForm] = useState<UserForm>(emptyUser);
  const [passwordReset, setPasswordReset] = useState<Record<number, string>>({});
  const [optionDrafts, setOptionDrafts] = useState<Record<string, OptionDraft>>({});
  const [activeTab, setActiveTab] = useState("institution");
  const [savingAction, setSavingAction] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [nextInstitution, nextModules, nextUsers, nextUserOptions, nextMasterData] =
        await Promise.all([
          apiGet<InstitutionConfig>("/api/config/institution", token),
          apiGet<ModuleConfig[]>("/api/config/modules", token),
          apiGet<AdminUser[]>("/api/admin/users", token),
          apiGet<UserOptions>("/api/admin/user-options", token),
          apiGet<MasterDataSet[]>("/api/admin/master-data", token)
        ]);
      setInstitution(nextInstitution);
      setModules(nextModules);
      setUsers(nextUsers);
      setUserOptions(nextUserOptions);
      setMasterData(nextMasterData);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load configuration");
    }
  }

  useEffect(() => {
    load();
  }, []);

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

  async function saveInstitution() {
    if (!institution) {
      return;
    }
    await runSave("institution", async () => {
      await apiPost(
        "/api/config/institution",
        { name: institution.name.trim(), locale: institution.locale.trim() || "en-IN" },
        token
      );
      setSaved("Institution settings saved");
      await load();
      await onSaved?.();
    });
  }

  function editUser(user: AdminUser) {
    setUserForm({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      password: "",
      active: user.active,
      linked_student_id: user.linked_student_id ? String(user.linked_student_id) : ""
    });
  }

  async function saveUser() {
    await runSave("user", async () => {
      const body = {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        active: userForm.active,
        linked_student_id: userForm.linked_student_id ? Number(userForm.linked_student_id) : null
      };
      if (userForm.id) {
        await apiPatch(`/api/admin/users/${userForm.id}`, body, token);
        setSaved("User updated");
      } else {
        await apiPost("/api/admin/users", { ...body, password: userForm.password }, token);
        setSaved("User created");
      }
      setUserForm(emptyUser);
      await load();
    });
  }

  async function toggleUser(user: AdminUser) {
    await runSave(`user-${user.id}`, async () => {
      await apiPost(`/api/admin/users/${user.id}/${user.active ? "disable" : "enable"}`, {}, token);
      setSaved(user.active ? "User disabled" : "User enabled");
      await load();
    });
  }

  async function resetPassword(user: AdminUser) {
    const password = passwordReset[user.id] ?? "";
    if (!password) {
      setError("Enter a new password first");
      return;
    }
    await runSave(`reset-${user.id}`, async () => {
      await apiPost(`/api/admin/users/${user.id}/reset-password`, { password }, token);
      setPasswordReset((current) => ({ ...current, [user.id]: "" }));
      setSaved("Password reset");
    });
  }

  async function addMasterOption(setKey: string) {
    const draft = optionDrafts[setKey] ?? { label: "", value: "" };
    await runSave(`option-${setKey}`, async () => {
      await apiPost(`/api/admin/master-data/${setKey}/options`, draft, token);
      setOptionDrafts((current) => ({ ...current, [setKey]: { label: "", value: "" } }));
      setSaved("Master data option added");
      await load();
    });
  }

  async function updateMasterOption(setKey: string, option: MasterDataOption, patch: Partial<MasterDataOption>) {
    const next = { ...option, ...patch };
    await runSave(`option-${option.id}`, async () => {
      await apiPatch(`/api/admin/master-data/${setKey}/options/${option.id}`, next, token);
      setSaved("Master data option updated");
      await load();
    });
  }

  async function deleteMasterOption(setKey: string, option: MasterDataOption) {
    if (!window.confirm(`Delete ${option.label}?`)) {
      return;
    }
    await runSave(`option-delete-${option.id}`, async () => {
      await apiDelete(`/api/admin/master-data/${setKey}/options/${option.id}`, token);
      setSaved("Master data option deleted");
      await load();
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

  const studentsModule = modules.find((module) => module.key === "students");
  const needsStudentLink = userForm.role === "student" || userForm.role === "parent";

  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-white/75 bg-white/55 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "bg-[#173b45] text-white shadow-sm"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
              }`}
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setError("");
                setSaved("");
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {saved}
        </div>
      ) : null}

      {activeTab === "institution" ? (
      <article className={cardClass}>
        <h2 className="text-lg font-semibold">Institution Settings</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px_auto]">
          <label className="text-sm font-medium text-slate-700">
            Institution Name
            <input
              className={inputClass}
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
              className={inputClass}
              value={institution?.locale ?? "en-IN"}
              onChange={(event) =>
                setInstitution((current) =>
                  current ? { ...current, locale: event.target.value } : current
                )
              }
            />
          </label>
          <button
            className="self-end rounded-2xl bg-[#173b45] px-4 py-2.5 text-sm font-semibold text-white"
            onClick={saveInstitution}
            disabled={savingAction === "institution"}
          >
            {savingAction === "institution" ? "Saving..." : "Save"}
          </button>
        </div>
      </article>
      ) : null}

      {activeTab === "users" ? (
      <article className={cardClass}>
        <h2 className="text-lg font-semibold">Users</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add staff, parent, and student logins. Student and parent users must be linked to a student record.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Name
            <input className={inputClass} value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Email
            <input className={inputClass} value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Role
            <select className={inputClass} value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}>
              {userOptions.roles.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </label>
          {!userForm.id ? (
            <label className="text-sm font-medium text-slate-700">
              Password
              <input className={inputClass} type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
            </label>
          ) : null}
          {needsStudentLink ? (
            <label className="text-sm font-medium text-slate-700">
              Linked Student
              <select className={inputClass} value={userForm.linked_student_id} onChange={(event) => setUserForm({ ...userForm, linked_student_id: event.target.value })}>
                <option value="">Select student</option>
                {userOptions.students.map((student) => (
                  <option key={student.value} value={student.value}>{student.label}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex items-center gap-2 self-end text-sm font-medium text-slate-700">
            <input checked={userForm.active} type="checkbox" onChange={(event) => setUserForm({ ...userForm, active: event.target.checked })} />
            Active
          </label>
          <div className="flex items-end gap-2">
            <button className="rounded-2xl bg-[#173b45] px-4 py-2.5 text-sm font-semibold text-white" onClick={saveUser} disabled={savingAction === "user"}>
              {userForm.id ? "Update User" : "Add User"}
            </button>
            {userForm.id ? (
              <button className="rounded-2xl border border-[#e6d6bf] bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700" onClick={() => setUserForm(emptyUser)}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="py-2">User</th>
                <th>Role</th>
                <th>Linked Student</th>
                <th>Status</th>
                <th>Reset Password</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr className="border-t border-[#eadcc9]" key={user.id}>
                  <td className="py-3">
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </td>
                  <td>{user.role}</td>
                  <td>{user.linked_student_name || "-"}</td>
                  <td>{user.active ? "Active" : "Disabled"}</td>
                  <td>
                    <div className="flex gap-2">
                      <input
                        className="h-9 w-36 rounded-xl border border-[#e6d6bf] bg-white/80 px-2 text-xs"
                        type="password"
                        value={passwordReset[user.id] ?? ""}
                        onChange={(event) => setPasswordReset((current) => ({ ...current, [user.id]: event.target.value }))}
                        placeholder="New password"
                      />
                      <button className="rounded-xl border border-[#e6d6bf] px-3 text-xs font-semibold" onClick={() => resetPassword(user)}>Reset</button>
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="rounded-xl border border-[#d9b980] px-3 py-1.5 text-xs font-semibold text-[#70470f]" onClick={() => editUser(user)}>Edit</button>
                      <button className="rounded-xl border border-[#e6d6bf] px-3 py-1.5 text-xs font-semibold" onClick={() => toggleUser(user)}>
                        {user.active ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      ) : null}

      {activeTab === "master-data" ? (
      <article className={cardClass}>
        <h2 className="text-lg font-semibold">Master Data LOV</h2>
        <p className="mt-1 text-sm text-slate-500">
          Configure dropdown values used by Students, Attendance, and Fees.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {masterData.map((set) => {
            const draft = optionDrafts[set.key] ?? { label: "", value: "" };
            return (
              <div className="rounded-2xl border border-[#eadcc9] bg-white/55 p-4" key={set.key}>
                <h3 className="font-semibold">{set.label}</h3>
                <p className="mt-1 text-sm text-slate-500">{set.description}</p>
                <div className="mt-3 space-y-2">
                  {set.options.map((option) => (
                    <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]" key={option.id}>
                      <input className={inputClass} defaultValue={option.label} onBlur={(event) => updateMasterOption(set.key, option, { label: event.target.value })} />
                      <input className={inputClass} defaultValue={option.value} onBlur={(event) => updateMasterOption(set.key, option, { value: event.target.value })} />
                      <button className="rounded-xl border border-[#e6d6bf] px-3 text-xs font-semibold" onClick={() => updateMasterOption(set.key, option, { active: !option.active })}>
                        {option.active ? "Active" : "Disabled"}
                      </button>
                      <button className="rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-700" onClick={() => deleteMasterOption(set.key, option)}>
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <input className={inputClass} placeholder="Label" value={draft.label} onChange={(event) => setOptionDrafts((current) => ({ ...current, [set.key]: { ...draft, label: event.target.value } }))} />
                  <input className={inputClass} placeholder="Value optional" value={draft.value} onChange={(event) => setOptionDrafts((current) => ({ ...current, [set.key]: { ...draft, value: event.target.value } }))} />
                  <button className="rounded-2xl bg-[#173b45] px-4 py-2.5 text-sm font-semibold text-white" onClick={() => addMasterOption(set.key)}>
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </article>
      ) : null}

      {activeTab === "student-fields" ? (
      <article className={cardClass}>
        <h2 className="text-lg font-semibold">Add Student Field</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Field Key
            <input className={inputClass} placeholder="blood_group" value={newField.key} onChange={(event) => setNewField({ ...newField, key: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Label
            <input className={inputClass} placeholder="Blood Group" value={newField.label} onChange={(event) => setNewField({ ...newField, label: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Type
            <select className={inputClass} value={newField.field_type} onChange={(event) => setNewField({ ...newField, field_type: event.target.value })}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select / LOV</option>
            </select>
          </label>
          {newField.field_type === "select" ? (
            <label className="text-sm font-medium text-slate-700 md:col-span-3">
              LOV Options
              <input className={inputClass} placeholder="Red, Blue, Green" value={newField.optionsText} onChange={(event) => setNewField({ ...newField, optionsText: event.target.value })} />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input checked={newField.visible} type="checkbox" onChange={(event) => setNewField({ ...newField, visible: event.target.checked })} />
            Visible
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input checked={newField.required} type="checkbox" onChange={(event) => setNewField({ ...newField, required: event.target.checked })} />
            Required
          </label>
          <button className="rounded-2xl bg-[#173b45] px-4 py-2.5 text-sm font-semibold text-white" onClick={addStudentField}>
            Add Field
          </button>
        </div>
      </article>
      ) : null}

      {activeTab === "student-fields" ? (
      <article className={cardClass}>
        <h2 className="text-lg font-semibold">Student Field Configuration</h2>
        <div className="mt-4 space-y-3">
          {(studentsModule?.fields ?? []).map((field) => (
            <div className="grid gap-3 rounded-2xl border border-[#eadcc9] bg-white/55 p-3 md:grid-cols-[1fr_110px_110px_80px]" key={field.id}>
              <label className="text-sm font-medium text-slate-700">
                Label
                <input className={inputClass} value={field.label} onChange={(event) => updateField("students", field.id, { label: event.target.value })} />
                <span className="mt-1 block text-xs text-slate-400">
                  {field.key} - {field.type}
                  {field.options?.length ? ` - ${field.options.map((option) => option.label).join(", ")}` : ""}
                </span>
              </label>
              <label className="flex items-center gap-2 self-center text-sm font-medium text-slate-700">
                <input checked={field.visible} type="checkbox" onChange={(event) => updateField("students", field.id, { visible: event.target.checked })} />
                Visible
              </label>
              <label className="flex items-center gap-2 self-center text-sm font-medium text-slate-700">
                <input checked={field.required} type="checkbox" onChange={(event) => updateField("students", field.id, { required: event.target.checked })} />
                Required
              </label>
              <label className="text-sm font-medium text-slate-700">
                Order
                <input className={inputClass} type="number" value={field.order} onChange={(event) => updateField("students", field.id, { order: Number(event.target.value) })} />
              </label>
            </div>
          ))}
        </div>
        {studentsModule ? (
          <button className="mt-4 rounded-2xl border border-[#e6d6bf] bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => saveFields(studentsModule)}>
            Save Student Fields
          </button>
        ) : null}
      </article>
      ) : null}

      {activeTab === "modules" ? (
      <article className={cardClass}>
        <h2 className="text-lg font-semibold">Visible Modules</h2>
        <p className="mt-1 text-sm text-slate-500">
          Keep only complete, usable modules visible to users.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {modules
            .filter((module) => ["students", "attendance", "fees", "configuration"].includes(module.key))
            .map((module) => (
              <div className="rounded-2xl border border-[#eadcc9] bg-white/55 p-4" key={module.key}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{module.label}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{module.description}</p>
                  </div>
                  <button
                    className={`rounded-2xl px-3 py-2 text-xs font-semibold ${module.enabled ? "bg-[#173b45] text-white" : "border border-[#e6d6bf] text-slate-700"}`}
                    onClick={() => toggle(module)}
                  >
                    {module.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              </div>
            ))}
        </div>
      </article>
      ) : null}
    </section>
  );
}
