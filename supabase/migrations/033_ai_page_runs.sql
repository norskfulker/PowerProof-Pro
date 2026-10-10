-- 033: start_ai_page couldn't record a run. ai_generations was made for the image maker: status
-- only 'done' or 'failed', prompt 3 to 1000 characters. A page run starts as 'running' (until
-- finish_ai_page) and its prompt is the whole brief, so:
--   * status may also be 'running'
--   * a page's prompt may be up to 4000 characters (images keep 1000)

alter table public.ai_generations drop constraint ai_generations_status_check;
alter table public.ai_generations add constraint ai_generations_status_check
  check (status in ('done', 'failed', 'running'));

alter table public.ai_generations drop constraint ai_generations_prompt_check;
alter table public.ai_generations add constraint ai_generations_prompt_check
  check (char_length(prompt) >= 3 and char_length(prompt) <= case when kind = 'page' then 4000 else 1000 end);
