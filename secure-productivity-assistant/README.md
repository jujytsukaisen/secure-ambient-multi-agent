# Secure Ambient Multi-Agent Productivity Assistant

## Problem Statement
Managing a busy inbox, scheduling meetings, and tracking daily tasks is time-consuming and error-prone. Modern LLMs can assist, but introducing autonomous agents to personal data introduces security risks (prompt injection, unauthorized actions).

## Proposed Solution
A secure, prototype ambient assistant comprising four specialized agents. It processes simulated emails, extracts actionable tasks, suggests calendar bookings, and produces a daily summary—all while enforcing strict security gates (approvals, redaction, and prompt injection detection).

## Four Agents
1. **Planner Agent**: Coordinator that routes ambient events.
2. **Email Filter Agent**: Classifies emails and identifies actionable tasks.
3. **Calendar Booking Agent**: Suggests time slots and enforces approval gates.
4. **Daily Summary Agent**: Generates an end-of-day task status report.

## Course Concepts Covered
- **Prototype**: Operates on local JSON data, no live external API connections.
- **Agent Skill**: Documented in `.agents/skills/productivity-assistant-skill/SKILL.md`.
- **Agent Security**: Input validation via Pydantic, data redaction, prompt injection detection.
- **Ambient Agent**: Event-driven CLI commands to simulate background activity.
- **LLM Judgment**: Evaluation criteria defined in `tests/eval`.
- **Semgrep**: Static analysis rules in `.semgrep/rules.yaml`.
- **Agent Hook**: `validate_tool_call.py` blocks dangerous shell commands before execution.
- **STRIDE Threat Modeling**: Documented in `STRIDE.md`.
- **Gate the TDD Plan Phase**: Tests written prior to full business logic (`TDD_PLAN.md`).
- **Deploy and Host**: Cloud mapping documented in `GOOGLE_CLOUD_DEPLOYMENT.md`.

## Setup Instructions (Windows PowerShell)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

## How to Run Tests
```powershell
pytest
```

## How to Run Semgrep
```powershell
semgrep --error --config .semgrep/rules.yaml app/
```

## How to Run Pre-commit
```powershell
pre-commit install
pre-commit run --all-files
```

## How to Run the Demo
```powershell
python -m app.main demo
```
Other ambient triggers:
```powershell
python -m app.main process-emails
python -m app.main daily-summary
```

## Security Explanation
The prototype uses multiple layers of security:
1. **Redaction**: Masks PII before logs/processing.
2. **Injection Detection**: Scans inputs for phrases attempting to bypass instructions.
3. **Approval Gates**: Sensitive actions (like `book_meeting`) require explicit approval.
4. **Agent Hooks**: Pre-execution hook script blocks dangerous OS commands.

## Manual Hook Tests
Test the agent hook script directly in PowerShell:
```powershell
'{"tool_args":{"CommandLine":"echo hello"}}' | python .agents/scripts/validate_tool_call.py
'{"tool_args":{"CommandLine":"rm -rf /"}}' | python .agents/scripts/validate_tool_call.py
```
