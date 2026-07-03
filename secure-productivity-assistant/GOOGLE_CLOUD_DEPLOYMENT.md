# Google Cloud Deployment

This document outlines how to deploy this prototype to Google Cloud.

## Local Prototype
The current implementation runs locally using JSON files for state and manual CLI triggers.

## Containerization
Create a `Dockerfile` to package the Python application and its dependencies.
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml ./
RUN pip install .
COPY . .
CMD ["python", "-m", "app.main", "demo"]
```

## Cloud Run
Host the agents on **Cloud Run** as a web service. The web service will expose HTTP endpoints that receive ambient events (e.g., via Pub/Sub). Cloud Run provides autoscaling and a secure environment.

## Event Triggers
- **New Email Events**: Use **Pub/Sub** combined with Gmail push notifications. When an email arrives, a message is published to a Pub/Sub topic, which pushes to the Cloud Run endpoint.
- **Daily Summary**: Use **Cloud Scheduler** to trigger an HTTP request to the Cloud Run endpoint every day at 5:00 PM to run the end-of-day summary.

## Secret Management
Use **Secret Manager** to securely store real API keys (e.g., Gemini API key, Google Workspace tokens). Inject these as environment variables in Cloud Run.

## Logging and Monitoring
Use **Cloud Logging** to capture application logs, security flags, and audit trails of approvals.

## CI/CD Security
- Integrate the `semgrep` security scan and `pre-commit` hooks into Cloud Build or GitHub Actions.
- Ensure the build fails if hardcoded secrets or dangerous shell commands are detected.

## Production Approval Gates
Approval gates must remain active in production. Approvals can be integrated via an interactive UI (e.g., clicking an "Approve" button in a notification message or chat interface).
