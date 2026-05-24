# Profile-Specific Custom Field Architecture

## Purpose

Institution OS needs to let each institution add its own attributes without changing database columns for every school. The product should stay simple for admins while remaining extensible for future student, teacher, parent, staff, finance, and admin profiles.

## Rule

Use fixed columns for fields required by core workflows. Use profile-specific custom fields for institution-specific attributes.

Examples of fixed fields:

- Student admission number
- Student class and section
- Attendance date and status
- Fee amount and paid amount
- User email, role, and active status

Examples of custom profile fields:

- Student blood group
- Student transport route
- Teacher qualification
- Teacher subject specialization
- Parent preferred language
- Parent alternate phone

## Data Model

```text
user_accounts
- id
- email
- name
- role
- linked_student_id
- active

role_profiles
- id
- user_id
- profile_type
- employee_code
- department
- designation
- subjects
- assigned_class
- assigned_section
- occupation
- relationship_type
- preferred_language
- contact_email
- whatsapp_number
- active

profile_field_definitions
- id
- profile_type
- field_key
- label
- field_type
- required
- visible
- order
- active

profile_field_options
- id
- field_id
- label
- value
- order
- active

profile_field_values
- id
- profile_type
- profile_id
- field_key
- value
```

`profile_type` is one of:

```text
student
teacher
parent
staff
finance
admin
```

`profile_id` points to the profile record for that profile type. In the current incremental implementation, `student` profile values point to the existing `students.id`. When full person/profile tables are introduced, `profile_id` will point to `student_profiles.id`, `teacher_profiles.id`, and so on.

For non-student users, `role_profiles` is the current role-specific profile record. A teacher user has one teacher profile, a parent user has one parent profile, and so on. This gives admins a simple place to manage role attributes now, while keeping a clean path toward a full person/profile model later.

`user_accounts.email` is the login identifier and must stay unique until multi-role login is introduced. Profile contact email is different: it is a communication field and can repeat. For example, a student profile and parent profile can both store the same family email address.

## Query Behavior

When the UI asks for student records, the backend returns fixed fields and custom student profile fields together.

Example response:

```json
{
  "id": 1,
  "admission_number": "ADM-001",
  "full_name": "Ravi Sharma",
  "class_name": "Grade 1",
  "section": "A",
  "status": "active",
  "blood_group": "O+",
  "transport_route": "Route 4"
}
```

The UI does not need to know whether `blood_group` is fixed or custom. It renders from metadata.

## Save Behavior

On save, the backend separates the payload:

```text
admission_number -> students.admission_number
full_name        -> students.full_name
class_name       -> students.class_name
blood_group      -> profile_field_values
transport_route  -> profile_field_values
```

## Admin UX

Admins configure custom fields under:

```text
Configuration -> Profile Fields
```

They choose a profile type, then add fields for that profile. This keeps the UI simple:

- Student fields affect student records.
- Teacher fields appear in `Configuration -> Profiles` for teacher users.
- Parent fields appear in `Configuration -> Profiles` for parent users.
- Staff, finance, and admin fields also appear in `Configuration -> Profiles`.

Admins manage role profile values under:

```text
Configuration -> Profiles
```

Selecting a user automatically uses that user's role profile type, so the admin does not need to understand the database model.

## Migration Note

The previous module-level student custom fields are migrated into `student` profile fields on startup. Existing values are copied from `module_record_values` into `profile_field_values`, so local work is preserved.

## Future Person/Profile Step

The next architecture step is to split human identity from login and role assignment:

```text
people
- id
- full_name
- phone
- email

person_roles
- person_id
- role

student_profiles / teacher_profiles / parent_profiles
- person_id
- role-specific fixed fields
```

That step should be done when the product needs one person to hold multiple roles, for example a teacher who is also a parent. Until then, the current `user_accounts` plus `role_profiles` model is simpler for the end user and enough for the working product.
