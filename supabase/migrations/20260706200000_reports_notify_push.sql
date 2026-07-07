-- Notify a human when a report is filed so the App-Store-promised 24h review
-- actually happens. Reuses the existing notify_push() dispatcher (defined in
-- 20260706150000_push_triggers.sql), which POSTs { kind, record: NEW } to the
-- `push` edge function via pg_net and is fully exception-guarded — a report
-- insert never fails because of the push enqueue.

drop trigger if exists reports_notify_push on public.reports;
create trigger reports_notify_push
  after insert on public.reports
  for each row
  execute function public.notify_push('report');
