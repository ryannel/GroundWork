import sys
from pathlib import Path

# Stage tests exercise the service modules directly (no server needed).
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "services" / "inventory"))
