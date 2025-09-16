import os
import pandas as pd
import numpy as np

# === Step 0: Load Invoice-Level Data ===
INVOICE_INPUT = "Invoice_Assigned_To_Benchmark_With_Count.xlsx"
if not os.path.isfile(INVOICE_INPUT):
    raise FileNotFoundError(f"Error: File not found: {INVOICE_INPUT}")

df_inv = pd.read_excel(INVOICE_INPUT, sheet_name=0)

# === Step 1: Clean & Standardize Columns ===
df_inv = df_inv.rename(columns={
    'Primary Financial Class': 'Payer',
    'Chart E/M Code Grouping': 'Group_EM',
    'Chart E/M Code Second Layer': 'Group_EM2',
    'Charge Invoice Number': 'Invoice_Number',
    'Charge CPT Code': 'CPT_Code'
})

df_inv['Year'] = pd.to_numeric(df_inv['Year'], errors='coerce').astype('Int64')
df_inv['Week'] = pd.to_numeric(df_inv['Week'], errors='coerce').astype('Int64')

# Drop rows missing any of the benchmark group keys
df_inv = df_inv.dropna(subset=['Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2', 'CPT_Code']).copy()
df_inv['Year'] = df_inv['Year'].astype(int)
df_inv['Week'] = df_inv['Week'].astype(int)

# === Step 2: Define Benchmark Grouping Keys ===
benchmark_keys = ['Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2', 'CPT_Code']

# === Step 3: Compute Longitudinal Benchmarks ===
benchmark_df = (
    df_inv
    .groupby(benchmark_keys, dropna=False)
    .agg(
        Benchmark_Charge_Amount=('Charge Amount', 'mean'),
        Benchmark_Payment_Amount=('Payment Amount*', 'mean'),
        Benchmark_Zero_Balance_Collection_Rate=('Zero Balance Collection Rate', 'mean'),
        Benchmark_Collection_Rate=('Collection Rate*', 'mean'),
        Benchmark_NRV_Zero_Balance=('NRV Zero Balance*', 'mean'),
        Benchmark_Payment_per_Visit=('Payment per Visit', 'mean'),
        Benchmark_Invoice_Count=('Invoice_Number', 'count'),
        Benchmark_Expected_85_EM=('Expected Amount (85% E/M)', 'mean'),
        Benchmark_Fee_Schedule=('Fee Schedule Expected Amount', 'mean')
    )
    .reset_index()
)

# === Step 4: Remove Conflicting Merge Columns ===
for col in df_inv.columns:
    if col.endswith("_x") or col.endswith("_y"):
        del df_inv[col]

# === Step 5: Merge Benchmarks Back ===
df_inv = df_inv.merge(benchmark_df, on=benchmark_keys, how='left')

# === Step 6: Add Root Cause Tags ===
df_inv['Tag_Low_Payment'] = df_inv['Payment Amount*'] < (0.9 * df_inv['Benchmark_Payment_Amount'])
df_inv['Tag_Low_ZB_Collection'] = df_inv['Zero Balance Collection Rate'] < (
    0.9 * df_inv['Benchmark_Zero_Balance_Collection_Rate'])
df_inv['Tag_High_Charge'] = df_inv['Charge Amount'] > (
    1.1 * df_inv['Benchmark_Charge_Amount'])

# === Step 7: Add Gap Measures ===
df_inv["NRV Gap ($)"] = df_inv["Charge Billed Balance"] - df_inv["Payment Amount*"]
df_inv["NRV Gap (%)"] = np.where(
    df_inv["Charge Billed Balance"] == 0,
    np.nan,
    df_inv["NRV Gap ($)"] / df_inv["Charge Billed Balance"]
)
df_inv["NRV Gap Sum ($)"] = df_inv["NRV Gap ($)"]

# === Step 8: Second Payer Review Flag ===
df_inv["Second_Payer_Review_Flag"] = (
    (df_inv["Zero Balance Collection Rate"].round(4) == df_inv["Collection Rate*"].round(4)) &
    (df_inv["Payment Amount*"] < df_inv["Benchmark_Payment_Amount"])
).astype(int)

# === Step 9: Drop Unneeded Columns ===
drop_cols = [col for col in df_inv.columns if "Unnamed:" in col]
df_inv.drop(columns=drop_cols, inplace=True)

# === Step 10: Export Invoice-Level Index ===
df_inv.to_csv("invoice_level_index.csv", index=False)
print("✅ Invoice-level index written to: invoice_level_index.csv")
