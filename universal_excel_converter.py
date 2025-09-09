#!/usr/bin/env python3
"""
UNIVERSAL EXCEL TO JSON CONVERTER
=================================
This script converts ANY Excel file to JSON format for the web app
without requiring any HTML code changes.
"""

import pandas as pd
import json
import os
import sys
from datetime import datetime
from pathlib import Path

class UniversalExcelConverter:
    def __init__(self):
        self.public_dir = Path("public")
        self.backup_dir = Path("backups")
        self.backup_dir.mkdir(exist_ok=True)
        
    def convert_excel_to_json(self, excel_file_path, output_name=None):
        try:
            if not os.path.exists(excel_file_path):
                print(f"❌ Error: File {excel_file_path} not found!")
                return None
                
            print(f"🚀 Starting conversion of {excel_file_path}")
            print("=" * 60)
            
            print(f"�� Reading Excel file...")
            df = pd.read_excel(excel_file_path)
            
            print(f"📊 File structure detected:")
            print(f"   - Rows: {len(df)}")
            print(f"   - Columns: {len(df.columns)}")
            print(f"   - Column names: {list(df.columns)}")
            
            # Process data
            data = df.to_dict('records')
            
            # Replace NaN values with null for JSON compatibility
            def replace_nan(obj):
                if isinstance(obj, dict):
                    return {k: replace_nan(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [replace_nan(item) for item in obj]
                elif pd.isna(obj):
                    return None
                else:
                    return obj
            
            data = replace_nan(data)
            
            # Determine output filename
            if output_name:
                output_file = self.public_dir / f"{output_name}.json"
            else:
                base_name = Path(excel_file_path).stem
                output_file = self.public_dir / f"{base_name}.json"
            
            # Create backup of existing file if it exists
            if output_file.exists():
                backup_file = self.backup_dir / f"{output_file.name}.{datetime.now().strftime('%Y%m%d_%H%M%S')}.backup"
                print(f"�� Creating backup: {backup_file}")
                output_file.rename(backup_file)
            
            # Write JSON file
            print(f"💾 Writing JSON to {output_file}")
            with open(output_file, 'w') as f:
                json.dump(data, f, indent=2)
            
            print("=" * 60)
            print(f"✅ SUCCESS! Converted {excel_file_path} to {output_file}")
            print(f"📊 Output: {len(data)} records")
            
            return output_file
            
        except Exception as e:
            print(f"❌ Error during conversion: {str(e)}")
            return None

def main():
    converter = UniversalExcelConverter()
    
    if len(sys.argv) == 1:
        print("�� UNIVERSAL EXCEL TO JSON CONVERTER")
        print("=" * 50)
        print("Usage:")
        print("  python universal_excel_converter.py convert <file>")
        print("  python universal_excel_converter.py convert-all")
        print("\nExamples:")
        print("  python universal_excel_converter.py convert 'Financial Performance Data.xlsx'")
        print("  python universal_excel_converter.py convert-all")
        
    elif sys.argv[1] == "convert" and len(sys.argv) >= 3:
        excel_file = sys.argv[2]
        output_name = sys.argv[3] if len(sys.argv) >= 4 else None
        
        if not excel_file.startswith("public/"):
            excel_file = f"public/{excel_file}"
        
        result = converter.convert_excel_to_json(excel_file, output_name)
        if result:
            print(f"\n🎯 Next steps:")
            print(f"   1. Verify the JSON file: {result}")
            print(f"   2. Refresh your web app")
            print(f"   3. The data should load automatically!")
        
    elif sys.argv[1] == "convert-all":
        excel_files = list(converter.public_dir.glob("*.xlsx"))
        for excel_file in excel_files:
            print(f"\n🔄 Processing {excel_file.name}...")
            converter.convert_excel_to_json(str(excel_file))
            print("-" * 40)

if __name__ == "__main__":
    main()
