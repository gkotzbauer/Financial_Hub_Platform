#!/usr/bin/env python3
"""
Universal Data Adapter for Revenue Performance Dashboard
Automatically converts any Excel file to the expected JSON format
without requiring web app code changes.

Usage:
    python universal_data_adapter.py [input_file.xlsx] [output_file.json]
    
If no arguments provided, uses default paths:
    - Input: data/revenue-data.xlsx
    - Output: data/revenue-data.json
"""

import pandas as pd
import numpy as np
import json
import sys
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
import warnings
warnings.filterwarnings('ignore')

class RevenueDataAdapter:
    """Universal adapter for revenue performance data"""
    
    def __init__(self):
        # Define the expected column structure for the web app
        self.expected_columns = {
            # Core identifiers
            'Year': 'str',
            'Week': 'str',
            
            # Visit metrics
            'Visit Count': 'int',
            'Labs per Visit': 'float',
            'Procedure per Visit': 'float',
            'Avg. Charge E/M Weight': 'float',
            '% of Visits w Radiology': 'float',
            
            # Financial metrics
            'Charge Amount': 'float',
            'Charge Billed Balance': 'float',
            'Zero Balance - Collection * Charges': 'float',
            '% of Remaining Charges': 'float',
            'Payment Amount*': 'float',
            'Payment per Visit': 'float',
            
            # Collection metrics
            'Zero Balance Collection Rate': 'float',
            'Collection Rate*': 'float',
            'Denial %': 'float',
            'NRV Zero Balance*': 'float',
            
            # Payer averages
            'Avg. Payment per Visit By Payor': 'float',
            'Avg. Payments By Payor': 'float',
            
            # Model predictions
            'Expected Payments': 'float',
            'Missed Revenue (RF)': 'float',
            '% Error (RF)': 'float',
            'Performance Diagnostic (RF)': 'str',
            
            # Performance metrics
            '% Error': 'float',
            'Performance Diagnostic': 'str',
            'Over Performed': 'int',
            'Under Performed': 'int',
            'Average Performance': 'int',
            'Volume Without Revenue Lift': 'int',
            
            # NRV gaps
            'NRV Gap ($)': 'float',
            'NRV Gap (%)': 'float',
            'NRV Gap Sum ($)': 'float',
            'Above NRV Benchmark': 'int',
            
            # Invoice metrics
            'Payment_SD': 'float',
            'Payment_CV': 'float',
            'LowPayment_Rate': 'float',
            'HighCharge_Rate': 'float',
            
            # Narrative fields
            'Operational - What Went Well': 'str',
            'Operational - What Can Be Improved': 'str',
            'Revenue Cycle - What Went Well': 'str',
            'Revenue Cycle - What Can Be Improved': 'str',
            'Zero-Balance Collection Narrative': 'str'
        }
        
        # Column mapping patterns for common variations
        self.column_mappings = {
            # Year variations
            'Year of Visit Service Date': 'Year',
            'Service Year': 'Year',
            'Visit Year': 'Year',
            
            # Week variations
            'ISO Week of Visit Service Date': 'Week',
            'Service Week': 'Week',
            'Visit Week': 'Week',
            'Week Number': 'Week',
            
            # Visit count variations
            'Total Visits': 'Visit Count',
            'Visit Volume': 'Visit Count',
            'Patient Count': 'Visit Count',
            
            # Payment variations
            'Payment Amount': 'Payment Amount*',
            'Total Payments': 'Payment Amount*',
            'Actual Payments': 'Payment Amount*',
            'Collected Amount': 'Payment Amount*',
            
            # Charge variations
            'Total Charges': 'Charge Amount',
            'Billed Amount': 'Charge Amount',
            'Gross Charges': 'Charge Amount',
            
            # Collection rate variations
            'Collection Rate': 'Collection Rate*',
            'Payment Rate': 'Collection Rate*',
            'Collection Percentage': 'Collection Rate*',
            
            # Expected payments variations
            'Expected Revenue': 'Expected Payments',
            'Predicted Payments': 'Expected Payments',
            'Forecasted Payments': 'Expected Payments',
            'Target Payments': 'Expected Payments',
            
            # Missed revenue variations
            'Revenue Gap': 'Missed Revenue (RF)',
            'Payment Variance': 'Missed Revenue (RF)',
            'Revenue Difference': 'Missed Revenue (RF)',
            'Performance Gap': 'Missed Revenue (RF)',
            
            # Performance diagnostic variations
            'Performance': 'Performance Diagnostic',
            'Performance Status': 'Performance Diagnostic',
            'Performance Category': 'Performance Diagnostic',
            'Performance Rating': 'Performance Diagnostic',
            
            # Payer variations
            'Primary Financial Class': 'Payer',
            'Insurance Provider': 'Payer',
            'Payer Type': 'Payer',
            'Financial Class': 'Payer',
            
            # E/M code variations
            'Chart E/M Code Grouping': 'Group_EM',
            'E/M Code Group': 'Group_EM',
            'Service Type': 'Group_EM',
            'Code Group': 'Group_EM',
            
            # E/M code second layer variations
            'Chart E/M Code Second Layer': 'Group_EM2',
            'E/M Code Subgroup': 'Group_EM2',
            'Service Subtype': 'Group_EM2',
            'Code Subgroup': 'Group_EM2'
        }
    
    def load_excel_file(self, file_path: str) -> pd.DataFrame:
        """Load Excel file and return DataFrame"""
        try:
            print(f"Loading Excel file: {file_path}")
            df = pd.read_excel(file_path, sheet_name=0)
            print(f"Loaded {len(df)} rows and {len(df.columns)} columns")
            print(f"Columns found: {list(df.columns)}")
            return df
        except Exception as e:
            raise Exception(f"Error loading Excel file: {e}")
    
    def map_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Map source columns to expected column names"""
        print("\nMapping columns...")
        mapped_df = df.copy()
        
        # Apply column mappings
        for source_col, target_col in self.column_mappings.items():
            if source_col in mapped_df.columns and target_col not in mapped_df.columns:
                mapped_df[target_col] = mapped_df[source_col]
                print(f"Mapped '{source_col}' → '{target_col}'")
        
        return mapped_df
    
    def add_missing_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add missing columns with default values"""
        print("\nAdding missing columns...")
        result_df = df.copy()
        
        for col, data_type in self.expected_columns.items():
            if col not in result_df.columns:
                # Set appropriate default values based on data type
                if data_type == 'str':
                    default_value = ''
                elif data_type == 'int':
                    default_value = 0
                elif data_type == 'float':
                    default_value = 0.0
                else:
                    default_value = ''
                
                result_df[col] = default_value
                print(f"Added missing column '{col}' with default value: {default_value}")
        
        return result_df
    
    def calculate_derived_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate derived columns that the web app expects"""
        print("\nCalculating derived columns...")
        result_df = df.copy()
        
        # Ensure numeric columns are numeric
        numeric_columns = ['Visit Count', 'Charge Amount', 'Payment Amount*', 'Expected Payments']
        for col in numeric_columns:
            if col in result_df.columns:
                result_df[col] = pd.to_numeric(result_df[col], errors='coerce').fillna(0)
        
        # Calculate % of Remaining Charges if not present
        if '% of Remaining Charges' not in result_df.columns or result_df['% of Remaining Charges'].isna().all():
            if 'Charge Amount' in result_df.columns and 'Charge Billed Balance' in result_df.columns:
                result_df['% of Remaining Charges'] = np.where(
                    result_df['Charge Amount'] > 0,
                    result_df['Charge Billed Balance'] / result_df['Charge Amount'],
                    0
                )
                print("Calculated '% of Remaining Charges'")
        
        # Calculate Missed Revenue if not present
        if 'Missed Revenue (RF)' not in result_df.columns or result_df['Missed Revenue (RF)'].isna().all():
            if 'Payment Amount*' in result_df.columns and 'Expected Payments' in result_df.columns:
                result_df['Missed Revenue (RF)'] = result_df['Payment Amount*'] - result_df['Expected Payments']
                print("Calculated 'Missed Revenue (RF)'")
        
        # Calculate % Error if not present
        if '% Error (RF)' not in result_df.columns or result_df['% Error (RF)'].isna().all():
            if 'Expected Payments' in result_df.columns and 'Missed Revenue (RF)' in result_df.columns:
                result_df['% Error (RF)'] = np.where(
                    result_df['Expected Payments'] > 0,
                    result_df['Missed Revenue (RF)'] / result_df['Expected Payments'] * 100,
                    0
                )
                print("Calculated '% Error (RF)'")
        
        # Calculate Performance Diagnostic if not present
        if 'Performance Diagnostic (RF)' not in result_df.columns or result_df['Performance Diagnostic (RF)'].isna().all():
            if '% Error (RF)' in result_df.columns:
                result_df['Performance Diagnostic (RF)'] = result_df['% Error (RF)'].apply(
                    lambda x: 'Over Performed' if x > 2.5 else ('Under Performed' if x < -2.5 else 'Average Performance')
                )
                print("Calculated 'Performance Diagnostic (RF)'")
        
        # Calculate Performance Diagnostic (main) if not present
        if 'Performance Diagnostic' not in result_df.columns or result_df['Performance Diagnostic'].isna().all():
            if '% Error' in result_df.columns:
                result_df['Performance Diagnostic'] = result_df['% Error'].apply(
                    lambda x: 'Over Performed' if x > 2.5 else ('Under Performed' if x < -2.5 else 'Average Performance')
                )
            else:
                result_df['Performance Diagnostic'] = result_df['Performance Diagnostic (RF)']
            print("Calculated 'Performance Diagnostic'")
        
        # Calculate boolean performance columns
        if 'Over Performed' not in result_df.columns or result_df['Over Performed'].isna().all():
            result_df['Over Performed'] = (result_df['Performance Diagnostic'] == 'Over Performed').astype(int)
            print("Calculated 'Over Performed'")
        
        if 'Under Performed' not in result_df.columns or result_df['Under Performed'].isna().all():
            result_df['Under Performed'] = (result_df['Performance Diagnostic'] == 'Under Performed').astype(int)
            print("Calculated 'Under Performed'")
        
        if 'Average Performance' not in result_df.columns or result_df['Average Performance'].isna().all():
            result_df['Average Performance'] = (result_df['Performance Diagnostic'] == 'Average Performance').astype(int)
            print("Calculated 'Average Performance'")
        
        # Calculate NRV gaps if not present
        if 'NRV Gap ($)' not in result_df.columns or result_df['NRV Gap ($)'].isna().all():
            if 'NRV Zero Balance*' in result_df.columns and 'Payment per Visit' in result_df.columns:
                result_df['NRV Gap ($)'] = result_df['NRV Zero Balance*'] - result_df['Payment per Visit']
                print("Calculated 'NRV Gap ($)'")
        
        if 'NRV Gap (%)' not in result_df.columns or result_df['NRV Gap (%)'].isna().all():
            if 'NRV Gap ($)' in result_df.columns and 'Payment per Visit' in result_df.columns:
                result_df['NRV Gap (%)'] = np.where(
                    result_df['Payment per Visit'] > 0,
                    result_df['NRV Gap ($)'] / result_df['Payment per Visit'] * 100,
                    0
                )
                print("Calculated 'NRV Gap (%)'")
        
        if 'NRV Gap Sum ($)' not in result_df.columns or result_df['NRV Gap Sum ($)'].isna().all():
            if 'NRV Gap ($)' in result_df.columns and 'Visit Count' in result_df.columns:
                result_df['NRV Gap Sum ($)'] = result_df['NRV Gap ($)'] * result_df['Visit Count']
                print("Calculated 'NRV Gap Sum ($)'")
        
        # Calculate Above NRV Benchmark if not present
        if 'Above NRV Benchmark' not in result_df.columns or result_df['Above NRV Benchmark'].isna().all():
            if 'Payment per Visit' in result_df.columns and 'NRV Zero Balance*' in result_df.columns:
                result_df['Above NRV Benchmark'] = (result_df['Payment per Visit'] > result_df['NRV Zero Balance*']).astype(int)
                print("Calculated 'Above NRV Benchmark'")
        
        # Calculate Volume Without Revenue Lift if not present
        if 'Volume Without Revenue Lift' not in result_df.columns or result_df['Volume Without Revenue Lift'].isna().all():
            if 'Visit Count' in result_df.columns and 'Over Performed' in result_df.columns:
                visit_mean = result_df['Visit Count'].mean()
                result_df['Volume Without Revenue Lift'] = (
                    (result_df['Visit Count'] > visit_mean) & 
                    (result_df['Over Performed'] == 0)
                ).astype(int)
                print("Calculated 'Volume Without Revenue Lift'")
        
        return result_df
    
    def generate_narrative_fields(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate narrative fields if they don't exist"""
        print("\nGenerating narrative fields...")
        result_df = df.copy()
        
        # Generate basic narrative fields if missing
        narrative_fields = [
            'Operational - What Went Well',
            'Operational - What Can Be Improved', 
            'Revenue Cycle - What Went Well',
            'Revenue Cycle - What Can Be Improved',
            'Zero-Balance Collection Narrative'
        ]
        
        for field in narrative_fields:
            if field not in result_df.columns or result_df[field].isna().all():
                result_df[field] = 'Data analysis in progress'
                print(f"Generated placeholder for '{field}'")
        
        return result_df
    
    def validate_data(self, df: pd.DataFrame) -> bool:
        """Validate that all required columns are present"""
        print("\nValidating data structure...")
        
        missing_columns = []
        for col in self.expected_columns.keys():
            if col not in df.columns:
                missing_columns.append(col)
        
        if missing_columns:
            print(f"⚠️  Warning: Missing columns: {missing_columns}")
            return False
        
        print("✅ All required columns are present")
        return True
    
    def convert_data_types(self, df: pd.DataFrame) -> pd.DataFrame:
        """Convert columns to expected data types"""
        print("\nConverting data types...")
        result_df = df.copy()
        
        for col, expected_type in self.expected_columns.items():
            if col in result_df.columns:
                try:
                    if expected_type == 'str':
                        result_df[col] = result_df[col].astype(str)
                    elif expected_type == 'int':
                        result_df[col] = pd.to_numeric(result_df[col], errors='coerce').fillna(0).astype(int)
                    elif expected_type == 'float':
                        result_df[col] = pd.to_numeric(result_df[col], errors='coerce').fillna(0.0)
                except Exception as e:
                    print(f"⚠️  Warning: Could not convert column '{col}' to {expected_type}: {e}")
        
        return result_df
    
    def process_data(self, input_file: str, output_file: str) -> bool:
        """Main processing function"""
        try:
            # Load Excel file
            df = self.load_excel_file(input_file)
            
            # Map columns
            df = self.map_columns(df)
            
            # Add missing columns
            df = self.add_missing_columns(df)
            
            # Calculate derived columns
            df = self.calculate_derived_columns(df)
            
            # Generate narrative fields
            df = self.generate_narrative_fields(df)
            
            # Convert data types
            df = self.convert_data_types(df)
            
            # Validate final structure
            self.validate_data(df)
            
            # Ensure we have the exact columns in the expected order
            final_columns = list(self.expected_columns.keys())
            df_final = df[final_columns]
            
            # Convert to JSON
            print(f"\nSaving to JSON: {output_file}")
            json_data = df_final.to_dict('records')
            
            with open(output_file, 'w') as f:
                json.dump(json_data, f, indent=2, default=str)
            
            print(f"✅ Successfully processed {len(df_final)} rows")
            print(f"✅ Output saved to: {output_file}")
            
            # Print summary
            print(f"\n📊 Data Summary:")
            print(f"   - Total rows: {len(df_final)}")
            print(f"   - Total columns: {len(df_final.columns)}")
            print(f"   - Years: {sorted(df_final['Year'].unique())}")
            print(f"   - Weeks: {sorted(df_final['Week'].unique())}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error processing data: {e}")
            return False

def main():
    """Main function"""
    # Get input and output file paths
    if len(sys.argv) >= 3:
        input_file = sys.argv[1]
        output_file = sys.argv[2]
    elif len(sys.argv) == 2:
        input_file = sys.argv[1]
        output_file = 'data/revenue-data.json'
    else:
        input_file = 'data/revenue-data.xlsx'
        output_file = 'data/revenue-data.json'
    
    # Ensure output directory exists
    output_dir = Path(output_file).parent
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"❌ Input file not found: {input_file}")
        print(f"Please provide a valid Excel file path")
        return False
    
    # Process the data
    adapter = RevenueDataAdapter()
    success = adapter.process_data(input_file, output_file)
    
    if success:
        print(f"\n🎉 Data processing completed successfully!")
        print(f"Your web app should now work with the updated data.")
        print(f"\nTo update data in the future, simply:")
        print(f"1. Replace {input_file} with your new Excel file")
        print(f"2. Run: python scripts/universal_data_adapter.py")
        print(f"3. The web app will automatically use the new data")
    else:
        print(f"\n❌ Data processing failed. Please check the error messages above.")
    
    return success

if __name__ == "__main__":
    main()

