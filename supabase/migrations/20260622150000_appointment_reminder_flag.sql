-- Track whether a WhatsApp reminder was already sent for an appointment,
-- so the reminder job never double-sends.
alter table appointments add column if not exists reminder_sent_at timestamptz;
