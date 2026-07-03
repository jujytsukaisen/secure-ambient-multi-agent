import re

def redact_sensitive_data(text: str) -> str:
    """
    Redacts email addresses, phone numbers, and API-key-like strings.
    """
    # Redact email addresses
    text = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '[REDACTED_EMAIL]', text)
    
    # Redact phone numbers (simple pattern for prototyping)
    text = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[REDACTED_PHONE]', text)
    
    # Redact API-key-like strings (e.g., AIzaSy... for Google API keys)
    text = re.sub(r'AIzaSy[A-Za-z0-9_-]{33}', '[REDACTED_API_KEY]', text)
    
    return text
