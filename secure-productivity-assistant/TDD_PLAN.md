# TDD Plan

## Main System Behaviors
1. **Email Filtering**: Classifies incoming emails into specific categories (important, meeting_request, task, needs_reply, low_priority, spam).
2. **Task Extraction**: Pulls actionable tasks from emails and adds them to a task list.
3. **Calendar Booking**: Suggests time slots based on availability and requests approval before booking.
4. **Daily Summary**: Generates a daily report aggregating task statuses.
5. **Security enforcement**: Detects prompt injections, redacts sensitive info, blocks dangerous tool usage.

## Unit Tests
- `test_email_filter_agent.py`: Verify email classification and task extraction.
- `test_calendar_booking_agent.py`: Verify reading available slots, checking approvals, and updating calendar.
- `test_daily_summary_agent.py`: Verify reading all tasks and outputting expected summary format.
- `test_security.py`: Verify redaction rules (emails, phone numbers, API keys) and prompt injection detection functions.
- `test_validate_tool_call.py`: Verify `validate_tool_call.py` blocks dangerous shell commands and allows safe ones.

## Integration Tests
- `test_full_workflow.py`: Verify the complete ambient flow. E.g., incoming important email -> email filter -> task -> daily summary contains task.

## Security Tests
- `test_security.py` contains specific cases for prompt injection (e.g., "ignore previous instructions") to ensure it returns `True` and the email is marked as `security_flagged`.

## Evaluation Tests
- Evaluation datasets and config ensure LLM behavior is systematically graded.

## Expected Pass/Fail Criteria
- Tests MUST fail initially (TDD process) before business logic is added.
- All tests MUST pass against the final implementation.
- Semgrep must catch any intentional or accidental hardcoded credentials or dangerous `os.system` / `eval` usage.
