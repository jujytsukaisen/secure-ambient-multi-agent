import sys
import json

def main():
    try:
        input_data = sys.stdin.read()
        if not input_data:
            print("APPROVED")
            sys.exit(0)
            
        data = json.loads(input_data)
        cmd = data.get("tool_args", {}).get("CommandLine", "")
        
        blocked_patterns = [
            "rm -rf",
            "del /s",
            "Remove-Item -Recurse",
            "format",
            "mkfs",
            "shutdown",
            "curl pipe bash",
            "curl | bash"
        ]
        
        cmd_lower = cmd.lower()
        for pattern in blocked_patterns:
            if pattern.lower() in cmd_lower:
                print("BLOCKED: Dangerous command detected.")
                sys.exit(1)
                
        print("APPROVED")
        sys.exit(0)
    except Exception as e:
        # Fail open or fail closed? Fail closed for security.
        print(f"BLOCKED: Error parsing request: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
