import re

def detect_prompt_injection(text: str) -> bool:
    """
    Detects common prompt injection phrases.
    Returns True if an injection is detected, False otherwise.
    """
    suspicious_phrases = [
        r"ignore previous instructions",
        r"delete all",
        r"reveal system prompt",
        r"run command",
        r"bypass approval",
        r"disable security",
        r"rm -rf"
    ]
    
    text_lower = text.lower()
    for phrase in suspicious_phrases:
        if re.search(phrase, text_lower):
            return True
            
    return False
