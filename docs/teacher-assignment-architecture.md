# Teacher Assignment Architecture

## Purpose

Teachers are not a single-class profile. A teacher can teach multiple classes, teach different subjects, and be class teacher for one section. A principal is handled as a teacher profile with wider visibility.

## Data Model

```text
teacher_assignments
- id
- teacher_user_id
- class_name
- section
- subject
- assignment_role
- active
```

Examples:

```text
Ananya Teacher -> Grade 10 / A / Maths / Subject Teacher
Ananya Teacher -> Grade 10 / A / Homeroom / Class Teacher
Principal User  -> all classes through teacher profile designation Principal
```

## Admin UX

Admins configure assignments from:

```text
Configuration -> Teacher Assignments
```

Teacher details such as employee code, designation, and contact information still live in:

```text
Configuration -> Profiles
```

To make a teacher act as principal, set the teacher profile designation to `Principal`.

## Access Rules

Teacher:

- Sees students only in assigned class/section.
- Marks attendance only for assigned class/section.
- Can edit assigned student class, section, and custom student attributes.
- Cannot change student identity fields such as name, admission number, guardian, or status.

Principal:

- Uses a teacher login/profile.
- Gets all class/section visibility when designation contains `Principal`.
- Can monitor class and section wise attendance summaries.

Admin/Super Admin:

- Can configure teacher assignments.
- Can manage all student and attendance records.
