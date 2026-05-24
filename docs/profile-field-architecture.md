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
- Teacher fields are stored for future teacher profile screens.
- Parent fields are stored for future parent profile screens.

## Migration Note

The previous module-level student custom fields are migrated into `student` profile fields on startup. Existing values are copied from `module_record_values` into `profile_field_values`, so local work is preserved.
