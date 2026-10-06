import { afterAll, describe, expect, it } from 'vitest';
import { clientAs } from '../env';

const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const employeeIds: string[] = [];
const courseIds: string[] = [];

afterAll(async () => {
  const admin = await clientAs('admin');
  if (courseIds.length) await admin.from('courses').delete().in('id', courseIds);
  if (employeeIds.length) await admin.from('employees').delete().in('id', employeeIds);
});

describe('employees and course assignments', () => {
  it('lets a recruiter onboard an employee, who starts in onboarding with an EMP code', async () => {
    const recruiter = await clientAs('recruiter');
    const { data, error } = await recruiter
      .from('employees')
      .insert({ full_name: `QA Employee ${RUN}`, job_title: 'Analyst', is_test: true })
      .select('id, display_code, status')
      .single();
    expect(error).toBeNull();
    employeeIds.push(data!.id);
    expect(data!.status).toBe('onboarding');
    expect(data!.display_code).toMatch(/^EMP-\d{4,}$/);
  });

  it('refuses a sourcer and a bd user, who can still read the list', async () => {
    for (const persona of ['sourcer', 'bd'] as const) {
      const client = await clientAs(persona);
      const { error } = await client.from('employees').insert({ full_name: `QA Denied ${RUN}`, is_test: true });
      expect(error, `${persona} must not create employees`).not.toBeNull();
      const { data: rows, error: readError } = await client.from('employee_list').select('id').in('id', employeeIds);
      expect(readError).toBeNull();
      expect(rows).toHaveLength(employeeIds.length);
    }
  });

  it('rejects a malformed work email at the database', async () => {
    const admin = await clientAs('admin');
    const { error } = await admin.from('employees').insert({ full_name: `QA Bad ${RUN}`, email: 'not-an-email', is_test: true });
    expect(error?.code).toBe('23514');
  });

  it('assigns a course once per employee and counts it on both views', async () => {
    const recruiter = await clientAs('recruiter');
    const { data: course, error: courseError } = await recruiter
      .from('courses')
      .insert({ title: `QA Course ${RUN}` })
      .select('id, display_code')
      .single();
    expect(courseError).toBeNull();
    courseIds.push(course!.id);
    expect(course!.display_code).toMatch(/^CRS-\d{4,}$/);

    const employeeId = employeeIds[0]!;
    const assignment = { course_id: course!.id, employee_id: employeeId };
    const { error: firstError } = await recruiter.from('course_assignments').insert(assignment);
    expect(firstError).toBeNull();
    const { error: duplicateError } = await recruiter.from('course_assignments').insert(assignment);
    expect(duplicateError?.code).toBe('23505');
    const { error: upsertError } = await recruiter
      .from('course_assignments')
      .upsert(assignment, { onConflict: 'course_id,employee_id', ignoreDuplicates: true });
    expect(upsertError).toBeNull();

    const { data: employee } = await recruiter
      .from('employee_list')
      .select('course_count, open_course_count')
      .eq('id', employeeId)
      .single();
    expect(employee).toEqual({ course_count: 1, open_course_count: 1 });
    const { data: listed } = await recruiter
      .from('course_list')
      .select('assigned_count, completed_count')
      .eq('id', course!.id)
      .single();
    expect(listed).toEqual({ assigned_count: 1, completed_count: 0 });
  });

  it('refuses a second course with the same title, ignoring case', async () => {
    const admin = await clientAs('admin');
    const { error } = await admin.from('courses').insert({ title: `qa course ${RUN}`.toUpperCase() });
    expect(error?.code).toBe('23505');
  });
});
