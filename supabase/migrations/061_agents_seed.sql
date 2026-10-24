-- 061: the first catalog rows. Payment Chaser is live (its code is in agents/payment-chaser);
-- the rest are "coming soon" cards that collect demand. Prices are config here, never UI strings.
-- Safe to run again: existing rows are left as Admin last set them.

insert into public.agent_catalog (id, name, tagline, description, category, status, sort) values
  ('payment-chaser', 'Payment Chaser', 'Chases overdue invoices so you don''t have to.', 'Reads your invoices and reminds customers to pay, on its own, every day.', 'Finance', 'live', 10),
  ('missed-lead-replier', 'Missed-Lead Replier', 'Replies to every enquiry within minutes, even at night.', 'Answers new enquiries from your website, Instagram and calls you missed, then hands warm leads to you.', 'Sales', 'coming_soon', 20),
  ('order-status-replier', 'Order Status Replier', 'Answers "where is my order?" for you.', 'Looks up the order and replies with its status, so you don''t have to.', 'Customer service', 'coming_soon', 30),
  ('instagram-comment-replier', 'Instagram Comment Replier', 'Replies to comments and DMs in your voice.', 'Answers price and availability questions on your posts and sends buyers to your store.', 'Marketing', 'coming_soon', 40),
  ('attendance-looker', 'Attendance Looker', 'Tells you who came late or didn''t come.', 'Reads attendance from your register or app and sends you a short daily summary.', 'Operations', 'coming_soon', 50),
  ('loan-file-checker', 'Loan-File Checker', 'Checks a loan file is complete before you submit it.', 'Reads the documents in a loan file and lists what''s missing or doesn''t match.', 'Finance', 'coming_soon', 60)
on conflict (id) do nothing;

insert into public.agent_plans (id, agent_id, name, price_minor, launch_price_minor, currency, included_credits) values
  ('payment-chaser:monthly', 'payment-chaser', 'Monthly', 99900, 49900, 'INR', 300)
on conflict (id) do nothing;
