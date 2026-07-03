def request_approval(action: str, details: str) -> bool:
    """
    Simulate an approval gate.
    In a real system, this would block and wait for user input (e.g. via UI/Slack).
    For the prototype, we automatically reject destructive actions and ask for approval otherwise.
    """
    print(f"\n[APPROVAL NEEDED] Action: {action}")
    print(f"Details: {details}")
    
    # Simulate user approval logic
    if "delete" in action.lower() or "rm" in action.lower():
        print("[DENIED] Destructive actions are not approved by default.")
        return False
    
    print("[APPROVED] Simulated user approval granted.")
    return True
