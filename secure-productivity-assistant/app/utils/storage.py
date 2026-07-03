import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")

def load_json(filename: str):
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        return []
    with open(filepath, 'r') as f:
        return json.load(f)

def save_json(filename: str, data):
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
