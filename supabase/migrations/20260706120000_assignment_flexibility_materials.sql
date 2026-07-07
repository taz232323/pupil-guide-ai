alter table public.assignments
  add column if not exists assignment_type text not null default 'practice',
  add column if not exists material_notes text,
  add column if not exists resource_links jsonb not null default '[]'::jsonb;

alter table public.assignments
  drop constraint if exists assignments_assignment_type_check;

alter table public.assignments
  add constraint assignments_assignment_type_check
  check (
    assignment_type in (
      'practice',
      'written_response',
      'quiz',
      'project',
      'discussion',
      'upload',
      'resource_review'
    )
  );

alter table public.assignments
  drop constraint if exists assignments_resource_links_array_check;

alter table public.assignments
  add constraint assignments_resource_links_array_check
  check (jsonb_typeof(resource_links) = 'array');
