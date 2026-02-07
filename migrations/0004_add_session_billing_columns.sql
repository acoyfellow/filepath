-- Add billing timestamp columns to multi_agent_session for per-minute credit deduction
ALTER TABLE multi_agent_session ADD COLUMN started_at INTEGER;
ALTER TABLE multi_agent_session ADD COLUMN last_billed_at INTEGER;
