-- Apply after 004. Preserve the existing notification types and allow the
-- order_update events used by checkout, delivery tracking and admin review.
begin;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type = any (array[
      'order_placed'::text,
      'order_confirmed'::text,
      'order_shipped'::text,
      'order_delivered'::text,
      'order_cancelled'::text,
      'order_update'::text
    ])
  );

commit;
