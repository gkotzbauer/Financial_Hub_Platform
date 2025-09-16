import os
import pandas as pd
import numpy as np

# === STEP 0: Load Invoice-Level Data ===
INVOICE_INPUT = "Invoice_Assigned_To_Benchmark_With_Count.xlsx"
if not os.path.isfile(INVOICE_INPUT):
    raise FileNotFoundError(f"Error: File not found: {INVOICE_INPUT}")

df_inv = pd.read_excel(INVOICE_INPUT, sheet_name='Sheet1')

# === STEP 1: Standardize Column Names ===
df_inv = df_inv.rename(columns={
    'Year': 'Year',
    'Week': 'Week',
    'Primary Financial Class': 'Payer',
    'Chart E/M Code Grouping': 'Group_EM',
    'Chart E/M Code Second Layer': 'Group_EM2',
    'Charge Invoice Number': 'Invoice_Number'
})

# === STEP 2: Clean Week and Convert Types ===
df_inv['Year'] = df_inv['Year'].astype(int)
df_inv['Week'] = df_inv['Week'].astype(str).str.replace('W', '', regex=False).astype(int)

# === STEP 3: Define Benchmark Grouping Keys (longitudinal) ===
benchmark_keys = ['Payer', 'Group_EM', 'Group_EM2']

# === STEP 4: Compute Longitudinal Benchmarks ===
benchmark_df = (
    df_inv
    .groupby(benchmark_keys)
    .agg(
        Benchmark_Charge_Amount=('Charge Amount', 'mean'),
        Benchmark_Payment_Amount=('Payment Amount*', 'mean'),
        Benchmark_Zero_Balance_Collection_Rate=('Zero Balance Collection Rate', 'mean'),
        Benchmark_Invoice_Count=('Invoice_Number', 'count')
    )
    .reset_index()
)

# === STEP 5: Clean old benchmark columns if they exist ===
df_inv = df_inv.drop(columns=[
    "Benchmark_Charge_Amount_x", "Benchmark_Payment_Amount_x", "Benchmark_Collection_Rate",
    "Charge Amount Flag", "Payment Amount Flag", "Collection Rate Flag"
], errors="ignore")

# === STEP 6: Merge Benchmarks Back to Invoice Records ===
df_inv = df_inv.drop(columns=[col for col in df_inv.columns if col.endswith("_y")], errors='ignore')
df_inv = df_inv.merge(benchmark_df, on=benchmark_keys, how='left')

# === STEP 7: Clean any bad suffixes ===
df_inv = df_inv.rename(columns={
    "Benchmark_Zero_Balance_Collection_Rate_y": "Benchmark_Zero_Balance_Collection_Rate",
    "Benchmark_Invoice_Count_y": "Benchmark_Invoice_Count"
})

# === STEP 8: Add Metric-Level Root Cause Tags ===
df_inv['Tag_Low_Payment'] = df_inv['Payment Amount*'] < (0.9 * df_inv['Benchmark_Payment_Amount'])
df_inv['Tag_Low_ZB_Collection'] = df_inv['Zero Balance Collection Rate'] < (
    0.9 * df_inv['Benchmark_Zero_Balance_Collection_Rate'])
df_inv['Tag_High_Charge'] = df_inv['Charge Amount'] > (
    1.1 * df_inv['Benchmark_Charge_Amount'])

# === STEP 9: Export Invoice-Level Drill Index ===
OUTPUT_CSV = 'invoice_level_index.csv'
df_inv.to_csv(OUTPUT_CSV, index=False)
print(f"✅ Invoice-level index written to: {OUTPUT_CSV}")
