-- Adds 'gemini' as an allowed provider on an already-created user_settings table.
-- Safe to run once on an existing database (idempotent-ish: drops then re-adds the checks).

alter table user_settings drop constraint if exists user_settings_chat_provider_check;
alter table user_settings
  add constraint user_settings_chat_provider_check
  check (chat_provider in ('openai', 'anthropic', 'gemini'));

alter table user_settings drop constraint if exists user_settings_embedding_provider_check;
alter table user_settings
  add constraint user_settings_embedding_provider_check
  check (embedding_provider in ('openai', 'gemini'));
