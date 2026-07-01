-- =====================================================================
-- Reputation settings on the branch: the Google review link to route happy
-- clients to, and the rating threshold above which we surface that link
-- (the "review gate" — high ratings -> Google, low ratings stay private).
-- =====================================================================
alter table branches add column if not exists google_review_url    text;
alter table branches add column if not exists review_gate_threshold int not null default 4;

update branches
set google_review_url = 'https://g.page/r/your-salon-review-link'
where google_review_url is null;
