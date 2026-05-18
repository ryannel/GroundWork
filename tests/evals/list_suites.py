import os
import json
from pathlib import Path

def print_row(col1, col2, col3):
    # Ensure strings are clamped or the layout has enough width
    # 25 + 15 + 40 = 80 chars inner width
    print(f"  \033[2m│\033[0m  {col1:<25} {col2:<15} {col3:<40} \033[2m│\033[0m")

def main():
    base_dir = Path(__file__).parent / "scenarios"
    if not base_dir.exists():
        return
        
    print("  \033[2m╭─\033[0m \033[1mEvaluation Suites\033[0m \033[2m─────────────────────────────────────────────────────────────────╮\033[0m")
    
    suites = sorted(base_dir.iterdir())
    for item in suites:
        if item.name.startswith("."):
            continue
            
        suite_name = item.stem
        
        if item.is_dir():
            scenarios = list(item.glob("*.json"))
            count = len(scenarios)
            type_str = f"({count} scenarios)"
            
            # Read the first scenario to get a hint of what this suite tests
            target = ""
            if count > 0:
                try:
                    with open(scenarios[0], 'r') as f:
                        data = json.load(f)
                        target = data.get("skill_name", "")
                except:
                    pass
                    
            print_row(suite_name, type_str, f"Target: {target}" if target else "")
            
        elif item.is_file() and item.suffix == ".json":
            type_str = "(1 scenario)"
            try:
                with open(item, 'r') as f:
                    data = json.load(f)
                    target = data.get("skill_name", "")
            except:
                target = ""
                
            print_row(suite_name, type_str, f"Target: {target}" if target else "")

    print("  \033[2m╰────────────────────────────────────────────────────────────────────────────────────╯\033[0m")

if __name__ == "__main__":
    main()
