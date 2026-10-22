-- 054: a monthly revenue goal
--
-- The store's revenue goal for each month, in its own currency (minor units). Analytics and the
-- dashboard show this month's progress and the daily pace still needed. Empty: no goal.

alter table public.stores add column if not exists revenue_goal_minor bigint check (revenue_goal_minor is null or revenue_goal_minor > 0);
