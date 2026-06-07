# Academic Year And Enrollment Model

This product keeps the day-to-day school setup simple by separating identity from yearly placement.

## Core Objects

- `Academic Years`: defines a school year such as `2026-27`.
- `Classes`: defines a grade for an academic year, such as `Grade 6` in `2026-27`.
- `Sections`: defines a section inside a class and year, such as `Grade 6 / A`.
- `Students`: stores stable student identity, admission number, guardian name, and configurable student attributes.
- `Student Enrollments`: connects a student to an academic year, class, section, roll number, and active/inactive status.
- `Teachers`: stores teacher identity and profile attributes.
- `Teacher Assignments`: connects a teacher to an academic year, class, section, subject, and assignment role.

## Why This Is Cleaner

A student should not become a new student every year. The student record stays stable, while enrollment records show where the student studies each year.

Example:

| Object | Data |
| --- | --- |
| Academic Year | `2026-27` |
| Class | `Grade 6`, year `2026-27` |
| Section | `Grade 6`, `A`, year `2026-27` |
| Student | `Anni`, admission `A001` |
| Student Enrollment | `Anni`, `2026-27`, `Grade 6`, `A`, roll `12`, active |
| Teacher | `Lakshmi` |
| Teacher Assignment | `Lakshmi`, `2026-27`, `Grade 6`, `A`, `Mathematics`, `Class Teacher` |

## Current Compatibility Rule

The existing `students` table still has `class_name` and `section` columns so Attendance and Fees continue to work. When an active Student Enrollment is created or edited, the system syncs the student's current class and section into those compatibility columns.

When displaying or checking access, the app first looks for an active Student Enrollment. If one exists, enrollment is treated as the current placement. If no enrollment exists, the app falls back to the older student class and section fields.

## End-User Flow

1. Create an Academic Year.
2. Create Classes for that year.
3. Create Sections for those classes.
4. Create Students.
5. Enroll Students into the right year, class, and section.
6. Create Teachers.
7. Add Teacher Assignments for the year, class, section, and subject.

This keeps the UI understandable while preserving a model that can support promotion, transfers, multi-year history, exams, attendance, and teacher allocation later.
