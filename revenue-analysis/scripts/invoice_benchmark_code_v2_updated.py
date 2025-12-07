import os
import pandas as pd
import numpy as np

# === Step 0: Load Invoice-Level Data ===
INVOICE_INPUT = "Invoice_Assigned_To_Benchmark_With_Count.xlsx"
if not os.path.isfile(INVOICE_INPUT):
    raise FileNotFoundError(f"Error: File not found: {INVOICE_INPUT}")

df_inv = pd.read_excel(INVOICE_INPUT, sheet_name=0)

# === Step 1: Standardize Column Names ===
df_inv = df_inv.rename(columns={
    'Year': 'Year',
    'Week': 'Week',
    'Primary Financial Class': 'Payer',
    'Chart E/M Code Grouping': 'Group_EM',
    'Chart E/M Code Second Layer': 'Group_EM2',
    'Charge Invoice Number': 'Invoice_Number'
})

# === Step 2: Clean Week and Convert Types ===
df_inv['Year'] = pd.to_numeric(df_inv['Year'], errors='coerce').astype('Int64')
df_inv['Week'] = df_inv['Week'].astype(str).str.replace('W', '', regex=False)
df_inv['Week'] = pd.to_numeric(df_inv['Week'], errors='coerce').astype('Int64')

df_inv = df_inv.dropna(subset=['Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2']).copy()
df_inv['Year'] = df_inv['Year'].astype(int)
df_inv['Week'] = df_inv['Week'].astype(int)

# === Step 3: Define Longitudinal Grouping Keys ===
benchmark_keys = ['Payer', 'Group_EM', 'Group_EM2']

# === Step 4: Compute Longitudinal Benchmarks ===
benchmark_df = (
    df_inv
    .groupby(benchmark_keys, dropna=False)
    .agg(
        Benchmark_Charge_Amount=('Charge Amount', 'mean'),
        Benchmark_Payment_Amount=('Payment Amount*', 'mean'),
        Benchmark_Zero_Balance_Collection_Rate=('Zero Balance Collection Rate', 'mean'),
        Benchmark_Invoice_Count=('Invoice_Number', 'count')
    )
    .reset_index()
)

# === Step 5: Drop Conflicting Benchmark Columns If They Exist ===
for col in list(df_inv.columns):
    if col.startswith("Benchmark_") or col.endswith("_x") or col.endswith("_y"):
        del df_inv[col]

# === Step 6: Merge Benchmarks Back to Invoice Records ===
df_inv = df_inv.merge(benchmark_df, on=benchmark_keys, how='left')

# === Step 7: Add Metric-Level Root Cause Tags ===
df_inv['Tag_Low_Payment'] = df_inv['Payment Amount*'] < (0.9 * df_inv['Benchmark_Payment_Amount'])
df_inv['Tag_Low_ZB_Collection'] = df_inv['Zero Balance Collection Rate'] < (
    0.9 * df_inv['Benchmark_Zero_Balance_Collection_Rate'])
df_inv['Tag_High_Charge'] = df_inv['Charge Amount'] > (
    1.1 * df_inv['Benchmark_Charge_Amount'])

# === Step 8: Add Required Downstream Fields ===
df_inv["NRV Gap ($)"] = df_inv["Charge Billed Balance"] - df_inv["Payment Amount*"]
df_inv["NRV Gap (%)"] = df_inv["NRV Gap ($)"] / df_inv["Charge Billed Balance"]
df_inv["NRV Gap Sum ($)"] = df_inv["NRV Gap ($)"]

# === Step 9: Export Final Invoice-Level Drill Index ===
OUTPUT_CSV = "invoice_level_index.csv"
df_inv.to_csv(OUTPUT_CSV, index=False)
print(f"✅ Invoice-level index written to: {OUTPUT_CSV}")
