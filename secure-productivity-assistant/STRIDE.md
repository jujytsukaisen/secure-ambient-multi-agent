# STRIDE Threat Modeling

| Threat | Description | Example from Project | Risk Level | Mitigation |
|---|---|---|---|---|
| **Spoofing** | Faking identity to gain access. | A fake sender pretends to be a manager. | Medium | Verify sender domain and signature (out of scope for prototype, simulated via explicit email headers). |
| **Tampering** | Unauthorized modification of data. | Modifying the tasks.json file directly or through prompt injection. | High | Use Pydantic schemas for all data passing; detect prompt injections. |
| **Repudiation** | User denies performing an action. | User denies approving a calendar booking. | Medium | Maintain an audit log of approvals and actions (e.g. tracking when approval was granted). |
| **Information Disclosure** | Private information is leaked. | Private email content leaked in logs or summary. | High | Redaction utility masks emails, phone numbers, and API keys before logging or processing. |
| **Denial of Service** | System overloaded. | Too many emails sent at once overload the assistant. | Low | Rate limiting on the email ingestion trigger (simulated in prototype). |
| **Elevation of Privilege** | Gaining unauthorized permissions. | Agent books meetings without explicit user approval. | Critical | Strict approval gates for sensitive tools (e.g. booking, deleting). |
