import subprocess
import os

SCRIPT_PATH = os.path.join(".agents", "scripts", "validate_tool_call.py")

def test_validate_tool_call_safe():
    input_data = b'{"tool_args": {"CommandLine": "echo hello"}}'
    result = subprocess.run(
        ["python", SCRIPT_PATH],
        input=input_data,
        capture_output=True,
        text=True
    )
    assert "APPROVED" in result.stdout
    assert result.returncode == 0

def test_validate_tool_call_blocked():
    input_data = b'{"tool_args": {"CommandLine": "rm -rf /"}}'
    result = subprocess.run(
        ["python", SCRIPT_PATH],
        input=input_data,
        capture_output=True,
        text=True
    )
    assert "BLOCKED" in result.stdout
    assert result.returncode == 1
