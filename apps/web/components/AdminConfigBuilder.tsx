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

type ProfileField = {
  id: number;
  profile_type: string;
  field_key: string;
  key: string;
  label: string;
  field_type: string;
  type: string;
  required: boolean;
  visible: boolean;
  active: boolean;
  order: number;
  options?: { label: string; value: string }[];
};

type ProfileFieldGroup = {
  profile_type: string;
  label: string;
  description: string;
  fields: ProfileField[];
};

type RoleProfileField = ProfileField & {
  value?: unknown;
};

type RoleProfile = {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  profile_type: string;
  employee_code?: string | null;
  department?: string | null;
  designation?: string | null;
  subjects?: string | null;
  assigned_class?: string | null;
  assigned_section?: string | null;
  occupation?: string | null;
  relationship_type?: string | null;
  preferred_language?: string | null;
  contact_email?: string | null;
  whatsapp_number?: string | null;
  active: boolean;
  custom_values?: Record<string, unknown> | null;
  fields?: RoleProfileField[];
};

type RoleProfilesResponse = {
  profile_types: { label: string; value: string }[];
  profiles: RoleProfile[];
};

type TeacherAssignment = {
  id: number;
  teacher_user_id: number;
  teacher_name: string;
  class_name: string;
  section: string;
  subject: string;
  assignment_role: string;
  active: boolean;
};

type TeacherAssignmentOptions = {
  teachers: { label: string; value: number }[];
  classes: { label: string; value: string }[];
  sections: { label: string; value: string }[];
  subjects: { label: string; value: string }[];
  assignment_roles: { label: string; value: string }[];
};

type TeacherAssignmentsResponse = {
  options: TeacherAssignmentOptions;
  assignments: TeacherAssignment[];
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

type RoleProfileForm = {
  user_id: string;
  profile_type: string;
  employee_code: string;
  department: string;
  designation: string;
  subjects: string;
  assigned_class: string;
  assigned_section: string;
  occupation: string;
  relationship_type: string;
  preferred_language: string;
  contact_email: string;
  whatsapp_number: string;
  active: boolean;
  custom_values: Record<string, string>;
};

type TeacherAssignmentForm = {
  id?: number;
  teacher_user_id: string;
  class_name: string;
  section: string;
  subject: string;
  assignment_role: string;
  active: boolean;
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

const emptyRoleProfile: RoleProfileForm = {
  user_id: "",
  profile_type: "teacher",
  employee_code: "",
  department: "",
  designation: "",
  subjects: "",
  assigned_class: "",
  assigned_section: "",
  occupation: "",
  relationship_type: "",
  preferred_language: "",
  contact_email: "",
  whatsapp_number: "",
  active: true,
  custom_values: {}
};

const emptyTeacherAssignment: TeacherAssignmentForm = {
  teacher_user_id: "",
  class_name: "",
  section: "",
  subject: "",
  assignment_role: "Subject Teacher",
  active: true
};

const inputClass =
  "mt-1 h-10 w-full rounded-2xl border border-[#e6d6bf] bg-white/80 px-3 text-sm outline-none transition focus:border-[#173b45] focus:ring-4 focus:ring-[#d6ece8]";

const cardClass = "rounded-[24px] border border-white/75 bg-white/65 p-5 shadow-sm backdrop-blur";

const tabs = [
  { key: "institution", label: "Institution" },
  { key: "users", label: "Users" },
  { key: "profiles", label: "Profiles" },
  { key: "master-data", label: "Master Data" },
  { key: "profile-fields", label: "Profile Fields" },
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
  const [roleProfiles, setRoleProfiles] = useState<RoleProfilesResponse>({
    profile_types: [],
    profiles: []
  });
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignmentsResponse>({
    options: { teachers: [], classes: [], sections: [], subjects: [], assignment_roles: [] },
    assignments: []
  });
  const [masterData, setMasterData] = useState<MasterDataSet[]>([]);
  const [profileFields, setProfileFields] = useState<ProfileFieldGroup[]>([]);
  const [activeProfileType, setActiveProfileType] = useState("student");
  const [activeModuleKey, setActiveModuleKey] = useState("classes");
  const [newField, setNewField] = useState<NewField>(emptyField);
  const [userForm, setUserForm] = useState<UserForm>(emptyUser);
  const [roleProfileForm, setRoleProfileForm] = useState<RoleProfileForm>(emptyRoleProfile);
  const [teacherAssignmentForm, setTeacherAssignmentForm] =
    useState<TeacherAssignmentForm>(emptyTeacherAssignment);
  const [passwordReset, setPasswordReset] = useState<Record<number, string>>({});
  const [optionDrafts, setOptionDrafts] = useState<Record<string, OptionDraft>>({});
  const [activeTab, setActiveTab] = useState("institution");
  const [savingAction, setSavingAction] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [
        nextInstitution,
        nextModules,
        nextUsers,
        nextUserOptions,
        nextRoleProfiles,
        nextTeacherAssignments,
        nextMasterData,
        nextProfileFields
      ] =
        await Promise.all([
          apiGet<InstitutionConfig>("/api/config/institution", token),
          apiGet<ModuleConfig[]>("/api/config/modules", token),
          apiGet<AdminUser[]>("/api/admin/users", token),
          apiGet<UserOptions>("/api/admin/user-options", token),
          apiGet<RoleProfilesResponse>("/api/admin/role-profiles", token),
          apiGet<TeacherAssignmentsResponse>("/api/admin/teacher-assignments", token),
          apiGet<MasterDataSet[]>("/api/admin/master-data", token),
          apiGet<ProfileFieldGroup[]>("/api/config/profile-fields", token)
        ]);
      setInstitution(nextInstitution);
      setModules(nextModules);
      setUsers(nextUsers);
      setUserOptions(nextUserOptions);
      setRoleProfiles(nextRoleProfiles);
      setTeacherAssignments(nextTeacherAssignments);
      setRoleProfileForm((current) => {
        const profileTypeValues = nextRoleProfiles.profile_types.map((type) => type.value);
        return current.profile_type && profileTypeValues.includes(current.profile_type)
          ? current
          : { ...current, profile_type: nextRoleProfiles.profile_types[0]?.value ?? "teacher" };
      });
      setMasterData(nextMasterData);
      setProfileFields(nextProfileFields);
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

  function editRoleProfile(profile: RoleProfile) {
    const valuesFromFields =
      profile.fields?.reduce<Record<string, string>>((values, field) => {
        const key = field.field_key || field.key;
        if (key && field.value !== undefined && field.value !== null) {
          values[key] = String(field.value);
        }
        return values;
      }, {}) ?? {};

    setRoleProfileForm({
      user_id: String(profile.user_id),
      profile_type: profile.profile_type,
      employee_code: profile.employee_code ?? "",
      department: profile.department ?? "",
      designation: profile.designation ?? "",
      subjects: profile.subjects ?? "",
      assigned_class: profile.assigned_class ?? "",
      assigned_section: profile.assigned_section ?? "",
      occupation: profile.occupation ?? "",
      relationship_type: profile.relationship_type ?? "",
      preferred_language: profile.preferred_language ?? "",
      contact_email: profile.contact_email ?? "",
      whatsapp_number: profile.whatsapp_number ?? "",
      active: profile.active,
      custom_values: {
        ...valuesFromFields,
        ...Object.fromEntries(
          Object.entries(profile.custom_values ?? {}).map(([key, value]) => [
            key,
            value === undefined || value === null ? "" : String(value)
          ])
        )
      }
    });
    setActiveTab("profiles");
  }

  async function saveRoleProfile() {
    if (!roleProfileForm.user_id || !roleProfileForm.profile_type) {
      setSaved("");
      setError("Select a user and profile type first");
      return;
    }

    await runSave("role-profile", async () => {
      const payload = {
        employee_code: roleProfileForm.employee_code.trim(),
        department: roleProfileForm.department.trim(),
        designation: roleProfileForm.designation.trim(),
        subjects: roleProfileForm.subjects.trim(),
        assigned_class: roleProfileForm.assigned_class.trim(),
        assigned_section: roleProfileForm.assigned_section.trim(),
        occupation: roleProfileForm.occupation.trim(),
        relationship_type: roleProfileForm.relationship_type.trim(),
        preferred_language: roleProfileForm.preferred_language.trim(),
        contact_email: roleProfileForm.contact_email.trim().toLowerCase(),
        whatsapp_number: roleProfileForm.whatsapp_number.trim(),
        active: roleProfileForm.active,
        custom_values: roleProfileForm.custom_values
      };
      await apiPost(
        `/api/admin/role-profiles/${roleProfileForm.user_id}/${roleProfileForm.profile_type}`,
        payload,
        token
      );
      setSaved("Profile saved");
      setRoleProfileForm({
        ...emptyRoleProfile,
        profile_type: roleProfiles.profile_types[0]?.value ?? "teacher"
      });
      await load();
    });
  }

  function editTeacherAssignment(assignment: TeacherAssignment) {
    setTeacherAssignmentForm({
      id: assignment.id,
      teacher_user_id: String(assignment.teacher_user_id),
      class_name: assignment.class_name,
      section: assignment.section,
      subject: assignment.subject,
      assignment_role: assignment.assignment_role,
      active: assignment.active
    });
    setActiveTab("teacher-assignments");
  }

  async function saveTeacherAssignment() {
    if (!teacherAssignmentForm.teacher_user_id) {
      setSaved("");
      setError("Select a teacher first");
      return;
    }
    await runSave("teacher-assignment", async () => {
      const payload = {
        teacher_user_id: Number(teacherAssignmentForm.teacher_user_id),
        class_name: teacherAssignmentForm.class_name,
        section: teacherAssignmentForm.section,
        subject: teacherAssignmentForm.subject,
        assignment_role: teacherAssignmentForm.assignment_role,
        active: teacherAssignmentForm.active
      };
      if (teacherAssignmentForm.id) {
        await apiPatch(
          `/api/admin/teacher-assignments/${teacherAssignmentForm.id}`,
          payload,
          token
        );
        setSaved("Teacher assignment updated");
      } else {
        await apiPost("/api/admin/teacher-assignments", payload, token);
        setSaved("Teacher assignment created");
      }
      setTeacherAssignmentForm(emptyTeacherAssignment);
      await load();
    });
  }

  async function deleteTeacherAssignment(assignment: TeacherAssignment) {
    if (!window.confirm(`Delete ${assignment.teacher_name} assignment?`)) {
      return;
    }
    await runSave(`teacher-assignment-delete-${assignment.id}`, async () => {
      await apiDelete(`/api/admin/teacher-assignments/${assignment.id}`, token);
      setSaved("Teacher assignment deleted");
      await load();
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

  async function addModuleField() {
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
    await runSave("add-module-field", async () => {
      await apiPost(
        `/api/config/modules/${activeModuleKey}/fields/add`,
        {
          module_key: activeModuleKey,
          key: newField.key.trim(),
          label: newField.label.trim(),
          field_type: newField.field_type,
          visible: newField.visible,
          required: newField.required,
          options
        },
        token
      );
      setSaved("Module field added");
      setNewField(emptyField);
      await load();
      await onSaved?.();
    });
  }

  function updateProfileFieldLocal(fieldId: number, patch: Partial<ProfileField>) {
    setProfileFields((current) =>
      current.map((group) =>
        group.profile_type !== activeProfileType
          ? group
          : {
              ...group,
              fields: group.fields.map((field) =>
                field.id === fieldId ? { ...field, ...patch } : field
              )
            }
      )
    );
  }

  async function addProfileField() {
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
    await runSave("add-profile-field", async () => {
      await apiPost(
        `/api/config/profile-fields/${activeProfileType}/fields`,
        {
          profile_type: activeProfileType,
          field_key: newField.key.trim(),
          label: newField.label.trim(),
          field_type: newField.field_type,
          visible: newField.visible,
          required: newField.required,
          options
        },
        token
      );
      setSaved("Profile field added");
      setNewField(emptyField);
      await load();
    });
  }

  async function saveProfileFields() {
    const group = profileFields.find((item) => item.profile_type === activeProfileType);
    if (!group) {
      return;
    }
    await runSave(`profile-fields-${activeProfileType}`, async () => {
      await apiPost(
        `/api/config/profile-fields/${activeProfileType}/fields/update`,
        group.fields.map((field) => ({
          id: field.id,
          label: field.label,
          field_type: field.field_type,
          required: field.required,
          visible: field.visible,
          active: field.active,
          order: Number(field.order) || 0,
          options: field.options?.map((option) => option.label) ?? []
        })),
        token
      );
      setSaved("Profile fields saved");
      await load();
    });
  }

  const configurableModuleKeys = [
    "classes",
    "sections",
    "subjects",
    "students",
    "teachers",
    "attendance",
    "fees",
    "exams",
    "configuration"
  ];
  const configurableModules = modules.filter((module) => configurableModuleKeys.includes(module.key));
  const activeModule = configurableModules.find((module) => module.key === activeModuleKey) ?? configurableModules[0];
  const needsStudentLink = userForm.role === "student" || userForm.role === "parent";
  const activeProfileGroup = profileFields.find((group) => group.profile_type === activeProfileType);
  const roleProfileTypeValues = roleProfiles.profile_types.map((type) => type.value);
  const roleProfileUsers = users.filter(
    (user) => user.role !== "student" && roleProfileTypeValues.includes(user.role)
  );
  const selectedRoleProfileFields =
    profileFields
      .find((group) => group.profile_type === roleProfileForm.profile_type)
      ?.fields.filter((field) => field.active && field.visible) ?? [];
  const selectedRoleProfileLabel =
    roleProfiles.profile_types.find((type) => type.value === roleProfileForm.profile_type)?.label ??
    "Profile";
  const roleProfileCoreFields: {
    key: keyof RoleProfileForm;
    label: string;
    type?: string;
  }[] =
    roleProfileForm.profile_type === "parent"
      ? [
          { key: "relationship_type", label: "Relationship Type" },
          { key: "occupation", label: "Occupation" },
          { key: "preferred_language", label: "Preferred Language" },
          { key: "contact_email", label: "Contact Email", type: "email" },
          { key: "whatsapp_number", label: "WhatsApp Number" }
        ]
      : roleProfileForm.profile_type === "teacher"
        ? [
            { key: "employee_code", label: "Employee Code" },
            { key: "department", label: "Department" },
            { key: "designation", label: "Designation" },
            { key: "subjects", label: "Subjects" },
            { key: "assigned_class", label: "Assigned Class" },
            { key: "assigned_section", label: "Assigned Section" },
            { key: "contact_email", label: "Contact Email", type: "email" },
            { key: "whatsapp_number", label: "WhatsApp Number" }
          ]
        : [
            { key: "employee_code", label: "Employee Code" },
            { key: "department", label: "Department" },
            { key: "designation", label: "Designation" },
            { key: "contact_email", label: "Contact Email", type: "email" },
            { key: "whatsapp_number", label: "WhatsApp Number" }
          ];

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
          Add logins. Login email must be unique; shared family/contact emails belong in Profiles.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Name
            <input className={inputClass} value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Login Email
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

      {activeTab === "profiles" ? (
      <article className={cardClass}>
        <h2 className="text-lg font-semibold">Profiles</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage role-specific details for parent, staff, finance, and admin users. Teacher details and assignments now live in the Teachers module.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            User
            <select
              className={inputClass}
              value={roleProfileForm.user_id}
              onChange={(event) => {
                const selectedUser = roleProfileUsers.find(
                  (user) => String(user.id) === event.target.value
                );
                const existingProfile = roleProfiles.profiles.find(
                  (profile) => String(profile.user_id) === event.target.value
                );
                if (existingProfile) {
                  editRoleProfile(existingProfile);
                  return;
                }
                setRoleProfileForm({
                  ...emptyRoleProfile,
                  user_id: event.target.value,
                  profile_type: selectedUser?.role ?? roleProfileForm.profile_type
                });
              }}
            >
              <option value="">Select user</option>
              {roleProfileUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} - {user.email}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Profile Type
            <select
              className={inputClass}
              disabled={Boolean(roleProfileForm.user_id)}
              value={roleProfileForm.profile_type}
              onChange={(event) =>
                setRoleProfileForm({
                  ...roleProfileForm,
                  profile_type: event.target.value,
                  custom_values: {}
                })
              }
            >
              {roleProfiles.profile_types.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end text-sm font-medium text-slate-700">
            <input
              checked={roleProfileForm.active}
              type="checkbox"
              onChange={(event) =>
                setRoleProfileForm({ ...roleProfileForm, active: event.target.checked })
              }
            />
            Active
          </label>
          {roleProfileCoreFields.map((field) => (
            <label className="text-sm font-medium text-slate-700" key={field.key}>
              {field.label}
              <input
                className={inputClass}
                type={field.type ?? "text"}
                value={String(roleProfileForm[field.key] ?? "")}
                onChange={(event) =>
                  setRoleProfileForm({
                    ...roleProfileForm,
                    [field.key]: event.target.value
                  })
                }
              />
            </label>
          ))}
        </div>

        {selectedRoleProfileFields.length ? (
          <div className="mt-5 rounded-2xl border border-[#eadcc9] bg-white/55 p-4">
            <h3 className="font-semibold">{selectedRoleProfileLabel} Custom Fields</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {selectedRoleProfileFields.map((field) => {
                const key = field.field_key || field.key;
                return (
                  <label className="text-sm font-medium text-slate-700" key={field.id}>
                    {field.label}
                    {field.field_type === "select" ? (
                      <select
                        className={inputClass}
                        value={roleProfileForm.custom_values[key] ?? ""}
                        onChange={(event) =>
                          setRoleProfileForm({
                            ...roleProfileForm,
                            custom_values: {
                              ...roleProfileForm.custom_values,
                              [key]: event.target.value
                            }
                          })
                        }
                      >
                        <option value="">Select</option>
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className={inputClass}
                        type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                        value={roleProfileForm.custom_values[key] ?? ""}
                        onChange={(event) =>
                          setRoleProfileForm({
                            ...roleProfileForm,
                            custom_values: {
                              ...roleProfileForm.custom_values,
                              [key]: event.target.value
                            }
                          })
                        }
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            className="rounded-2xl bg-[#173b45] px-4 py-2.5 text-sm font-semibold text-white"
            disabled={savingAction === "role-profile"}
            onClick={saveRoleProfile}
          >
            {savingAction === "role-profile" ? "Saving..." : "Save Profile"}
          </button>
          <button
            className="rounded-2xl border border-[#e6d6bf] bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700"
            onClick={() =>
              setRoleProfileForm({
                ...emptyRoleProfile,
                profile_type: roleProfiles.profile_types[0]?.value ?? "teacher"
              })
            }
          >
            Clear
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="py-2">User</th>
                <th>Profile</th>
                <th>Work Details</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roleProfiles.profiles.length === 0 ? (
                <tr className="border-t border-[#eadcc9]">
                  <td className="py-4 text-sm text-slate-500" colSpan={6}>
                    No role profiles configured yet.
                  </td>
                </tr>
              ) : null}
              {roleProfiles.profiles.map((profile) => (
                <tr className="border-t border-[#eadcc9]" key={profile.id}>
                  <td className="py-3">
                    <p className="font-semibold">{profile.user_name}</p>
                    <p className="text-xs text-slate-500">{profile.user_email}</p>
                  </td>
                  <td>
                    {roleProfiles.profile_types.find((type) => type.value === profile.profile_type)
                      ?.label ?? profile.profile_type}
                  </td>
                  <td>
                    <p>{profile.designation || profile.department || "-"}</p>
                    <p className="text-xs text-slate-500">
                      {[profile.employee_code, profile.assigned_class, profile.assigned_section]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </p>
                  </td>
                  <td>
                    <p>{profile.contact_email || profile.whatsapp_number || "-"}</p>
                    <p className="text-xs text-slate-500">
                      {[profile.whatsapp_number, profile.preferred_language].filter(Boolean).join(" / ")}
                    </p>
                  </td>
                  <td>{profile.active ? "Active" : "Disabled"}</td>
                  <td>
                    <button
                      className="rounded-xl border border-[#d9b980] px-3 py-1.5 text-xs font-semibold text-[#70470f]"
                      onClick={() => editRoleProfile(profile)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      ) : null}

      {activeTab === "teacher-assignments" ? (
      <article className={cardClass}>
        <h2 className="text-lg font-semibold">Teacher Assignments</h2>
        <p className="mt-1 text-sm text-slate-500">
          Assign teachers to classes, sections, and subjects. A teacher with designation Principal in Profiles can monitor all classes.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Teacher
            <select
              className={inputClass}
              value={teacherAssignmentForm.teacher_user_id}
              onChange={(event) =>
                setTeacherAssignmentForm({
                  ...teacherAssignmentForm,
                  teacher_user_id: event.target.value
                })
              }
            >
              <option value="">Select teacher</option>
              {teacherAssignments.options.teachers.map((teacher) => (
                <option key={teacher.value} value={teacher.value}>
                  {teacher.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Class
            <select
              className={inputClass}
              value={teacherAssignmentForm.class_name}
              onChange={(event) =>
                setTeacherAssignmentForm({ ...teacherAssignmentForm, class_name: event.target.value })
              }
            >
              <option value="">Select class</option>
              {teacherAssignments.options.classes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Section
            <select
              className={inputClass}
              value={teacherAssignmentForm.section}
              onChange={(event) =>
                setTeacherAssignmentForm({ ...teacherAssignmentForm, section: event.target.value })
              }
            >
              <option value="">Select section</option>
              {teacherAssignments.options.sections.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Subject
            <select
              className={inputClass}
              value={teacherAssignmentForm.subject}
              onChange={(event) =>
                setTeacherAssignmentForm({ ...teacherAssignmentForm, subject: event.target.value })
              }
            >
              <option value="">Select subject</option>
              {teacherAssignments.options.subjects.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Assignment Role
            <select
              className={inputClass}
              value={teacherAssignmentForm.assignment_role}
              onChange={(event) =>
                setTeacherAssignmentForm({
                  ...teacherAssignmentForm,
                  assignment_role: event.target.value
                })
              }
            >
              {teacherAssignments.options.assignment_roles.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end text-sm font-medium text-slate-700">
            <input
              checked={teacherAssignmentForm.active}
              type="checkbox"
              onChange={(event) =>
                setTeacherAssignmentForm({ ...teacherAssignmentForm, active: event.target.checked })
              }
            />
            Active
          </label>
          <div className="flex items-end gap-2">
            <button
              className="rounded-2xl bg-[#173b45] px-4 py-2.5 text-sm font-semibold text-white"
              disabled={savingAction === "teacher-assignment"}
              onClick={saveTeacherAssignment}
            >
              {teacherAssignmentForm.id ? "Update Assignment" : "Add Assignment"}
            </button>
            {teacherAssignmentForm.id ? (
              <button
                className="rounded-2xl border border-[#e6d6bf] bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700"
                onClick={() => setTeacherAssignmentForm(emptyTeacherAssignment)}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="py-2">Teacher</th>
                <th>Class</th>
                <th>Section</th>
                <th>Subject</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teacherAssignments.assignments.length === 0 ? (
                <tr className="border-t border-[#eadcc9]">
                  <td className="py-4 text-sm text-slate-500" colSpan={7}>
                    No teacher assignments yet.
                  </td>
                </tr>
              ) : null}
              {teacherAssignments.assignments.map((assignment) => (
                <tr className="border-t border-[#eadcc9]" key={assignment.id}>
                  <td className="py-3 font-semibold">{assignment.teacher_name}</td>
                  <td>{assignment.class_name}</td>
                  <td>{assignment.section}</td>
                  <td>{assignment.subject || "-"}</td>
                  <td>{assignment.assignment_role}</td>
                  <td>{assignment.active ? "Active" : "Disabled"}</td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="rounded-xl border border-[#d9b980] px-3 py-1.5 text-xs font-semibold text-[#70470f]"
                        onClick={() => editTeacherAssignment(assignment)}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700"
                        onClick={() => deleteTeacherAssignment(assignment)}
                      >
                        Delete
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

      {activeTab === "profile-fields" ? (
      <article className={cardClass}>
        <h2 className="text-lg font-semibold">Profile Fields</h2>
        <p className="mt-1 text-sm text-slate-500">
          Custom fields are profile-specific. Student fields appear on student records; teacher and parent fields stay ready for those profile screens.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {profileFields.map((group) => (
            <button
              className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                activeProfileType === group.profile_type
                  ? "bg-[#173b45] text-white"
                  : "border border-[#e6d6bf] bg-white/70 text-slate-700"
              }`}
              key={group.profile_type}
              onClick={() => {
                setActiveProfileType(group.profile_type);
                setNewField(emptyField);
              }}
            >
              {group.label}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
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
          <button className="rounded-2xl bg-[#173b45] px-4 py-2.5 text-sm font-semibold text-white" onClick={addProfileField}>
            Add {activeProfileGroup?.label ?? "Profile"} Field
          </button>
        </div>
      </article>
      ) : null}

      {activeTab === "profile-fields" ? (
      <article className={cardClass}>
        <h2 className="text-lg font-semibold">{activeProfileGroup?.label ?? "Profile"} Field Configuration</h2>
        <div className="mt-4 space-y-3">
          {(activeProfileGroup?.fields ?? []).length === 0 ? (
            <div className="rounded-2xl border border-[#eadcc9] bg-white/55 p-4 text-sm text-slate-500">
              No custom fields configured for this profile yet.
            </div>
          ) : null}
          {(activeProfileGroup?.fields ?? []).map((field) => (
            <div className="grid gap-3 rounded-2xl border border-[#eadcc9] bg-white/55 p-3 md:grid-cols-[1fr_110px_110px_80px]" key={field.id}>
              <label className="text-sm font-medium text-slate-700">
                Label
                <input className={inputClass} value={field.label} onChange={(event) => updateProfileFieldLocal(field.id, { label: event.target.value })} />
                <span className="mt-1 block text-xs text-slate-400">
                  {field.field_key} - {field.field_type}
                  {field.options?.length ? ` - ${field.options.map((option) => option.label).join(", ")}` : ""}
                </span>
              </label>
              <label className="flex items-center gap-2 self-center text-sm font-medium text-slate-700">
                <input checked={field.visible} type="checkbox" onChange={(event) => updateProfileFieldLocal(field.id, { visible: event.target.checked })} />
                Visible
              </label>
              <label className="flex items-center gap-2 self-center text-sm font-medium text-slate-700">
                <input checked={field.required} type="checkbox" onChange={(event) => updateProfileFieldLocal(field.id, { required: event.target.checked })} />
                Required
              </label>
              <label className="text-sm font-medium text-slate-700">
                Order
                <input className={inputClass} type="number" value={field.order} onChange={(event) => updateProfileFieldLocal(field.id, { order: Number(event.target.value) })} />
              </label>
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Type
                <select className={inputClass} value={field.field_type} onChange={(event) => updateProfileFieldLocal(field.id, { field_type: event.target.value })}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="select">Select / LOV</option>
                </select>
              </label>
              {field.field_type === "select" ? (
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Options
                  <input
                    className={inputClass}
                    value={field.options?.map((option) => option.label).join(", ") ?? ""}
                    onChange={(event) =>
                      updateProfileFieldLocal(field.id, {
                        options: event.target.value
                          .split(",")
                          .map((option) => option.trim())
                          .filter(Boolean)
                          .map((option) => ({ label: option, value: option }))
                      })
                    }
                  />
                </label>
              ) : null}
              <label className="flex items-center gap-2 self-center text-sm font-medium text-slate-700">
                <input checked={field.active} type="checkbox" onChange={(event) => updateProfileFieldLocal(field.id, { active: event.target.checked })} />
                Active
              </label>
            </div>
          ))}
        </div>
        <button className="mt-4 rounded-2xl border border-[#e6d6bf] bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700" onClick={saveProfileFields}>
          Save Profile Fields
        </button>
      </article>
      ) : null}

      {activeTab === "modules" ? (
      <article className={cardClass}>
        <h2 className="text-lg font-semibold">Modules</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enable core modules and extend their fields without changing frontend code.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {configurableModules.map((module) => (
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
        {activeModule ? (
          <div className="mt-6 rounded-2xl border border-[#eadcc9] bg-white/55 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Field Configuration</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Add or adjust fields for the selected module.
                </p>
              </div>
              <select
                className={inputClass}
                value={activeModule.key}
                onChange={(event) => {
                  setActiveModuleKey(event.target.value);
                  setNewField(emptyField);
                }}
              >
                {configurableModules.map((module) => (
                  <option key={module.key} value={module.key}>
                    {module.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 space-y-3">
              {activeModule.fields.map((field) => (
                <div
                  className="grid gap-3 rounded-2xl border border-[#eadcc9] bg-white/60 p-3 md:grid-cols-[1fr_110px_110px_80px]"
                  key={field.id}
                >
                  <label className="text-sm font-medium text-slate-700">
                    Label
                    <input
                      className={inputClass}
                      value={field.label}
                      onChange={(event) =>
                        updateField(activeModule.key, field.id, { label: event.target.value })
                      }
                    />
                    <span className="mt-1 block text-xs text-slate-400">
                      {field.key} - {field.type}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 self-center text-sm font-medium text-slate-700">
                    <input
                      checked={field.visible}
                      type="checkbox"
                      onChange={(event) =>
                        updateField(activeModule.key, field.id, { visible: event.target.checked })
                      }
                    />
                    Visible
                  </label>
                  <label className="flex items-center gap-2 self-center text-sm font-medium text-slate-700">
                    <input
                      checked={field.required}
                      type="checkbox"
                      onChange={(event) =>
                        updateField(activeModule.key, field.id, { required: event.target.checked })
                      }
                    />
                    Required
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Order
                    <input
                      className={inputClass}
                      type="number"
                      value={field.order}
                      onChange={(event) =>
                        updateField(activeModule.key, field.id, { order: Number(event.target.value) })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            <button
              className="mt-4 rounded-2xl border border-[#e6d6bf] bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={() => saveFields(activeModule)}
            >
              Save {activeModule.label} Fields
            </button>
            <div className="mt-5 grid gap-3 rounded-2xl border border-[#eadcc9] bg-white/60 p-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">
                Field Key
                <input
                  className={inputClass}
                  placeholder="short_name"
                  value={newField.key}
                  onChange={(event) => setNewField({ ...newField, key: event.target.value })}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Label
                <input
                  className={inputClass}
                  placeholder="Short Name"
                  value={newField.label}
                  onChange={(event) => setNewField({ ...newField, label: event.target.value })}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Type
                <select
                  className={inputClass}
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
                    className={inputClass}
                    placeholder="Option A, Option B"
                    value={newField.optionsText}
                    onChange={(event) => setNewField({ ...newField, optionsText: event.target.value })}
                  />
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  checked={newField.visible}
                  type="checkbox"
                  onChange={(event) => setNewField({ ...newField, visible: event.target.checked })}
                />
                Visible
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  checked={newField.required}
                  type="checkbox"
                  onChange={(event) => setNewField({ ...newField, required: event.target.checked })}
                />
                Required
              </label>
              <button
                className="rounded-2xl bg-[#173b45] px-4 py-2.5 text-sm font-semibold text-white"
                onClick={addModuleField}
              >
                Add Field
              </button>
            </div>
          </div>
        ) : null}
      </article>
      ) : null}
    </section>
  );
}
