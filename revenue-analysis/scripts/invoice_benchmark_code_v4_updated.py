import os
import pandas as pd
import numpy as np

# === Step 0: Load Input File ===
INVOICE_INPUT = "Invoice_Assigned_To_Benchmark_With_Count.xlsx"
if not os.path.isfile(INVOICE_INPUT):
    raise FileNotFoundError(f"❌ Missing required input file: {INVOICE_INPUT}")

df_inv = pd.read_excel(INVOICE_INPUT, sheet_name=0)

# === Step 1: Clean & Standardize Columns ===
df_inv = df_inv.rename(columns={
    'Primary Financial Class': 'Payer',
    'Chart E/M Code Grouping': 'Group_EM',
    'Chart E/M Code Second Layer': 'Group_EM2',
    'Charge Invoice Number': 'Invoice_Number'
})

df_inv['Year'] = pd.to_numeric(df_inv['Year'], errors='coerce').astype('Int64')
df_inv['Week'] = pd.to_numeric(df_inv['Week'], errors='coerce').astype('Int64')

# Drop records missing critical group keys
df_inv = df_inv.dropna(subset=['Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2']).copy()
df_inv['Year'] = df_inv['Year'].astype(int)
df_inv['Week'] = df_inv['Week'].astype(int)

# === Step 2: Define Benchmark Grouping Keys ===
benchmark_keys = ['Payer', 'Group_EM', 'Group_EM2']

# === Step 3: Compute CPT-Level Benchmarks ===
cpt_benchmark_df = (
    df_inv
    .groupby(benchmark_keys, dropna=False)
    .agg(
        Benchmark_Charge_Amount_within_invoice=('Charge Amount', 'mean'),
        Benchmark_Payment_Amount_within_invoice=('Payment Amount*', 'mean'),
        Benchmark_Zero_Balance_Collection_Rate=('Zero Balance Collection Rate', 'mean'),
        Benchmark_Collection_Rate=('Collection Rate*', 'mean'),
        Benchmark_NRV_Zero_Balance=('NRV Zero Balance*', 'mean'),
        Benchmark_Payment_per_Visit=('Payment per Visit', 'mean'),
        Benchmark_Invoice_Count=('Invoice_Number', 'nunique'),
        Fee_Schedule_Expected_Amount_within_invoice=('Fee Schedule Expected Amount', 'mean'),
        Expected_Amount_85_EM_within_invoice=('Expected Amount (85% E/M)', 'mean')
    )
    .reset_index()
)

# === Step 4: Remove Conflicting Merge Columns ===
df_inv = df_inv[[c for c in df_inv.columns if not c.endswith('_x') and not c.endswith('_y')]]

# === Step 5: Merge CPT-Level Benchmarks ===
df_inv = df_inv.merge(cpt_benchmark_df, on=benchmark_keys, how='left')

# === Step 6: Compute Invoice-Level Benchmarks ===
# Step 6a: Aggregate by Invoice to get totals per invoice
invoice_level = (
    df_inv.groupby(['Invoice_Number', 'Payer', 'Group_EM', 'Group_EM2'], dropna=False)
    .agg(
        Invoice_Total_Charge_Amount=('Charge Amount', 'sum'),
        Invoice_Total_Payment_Amount=('Payment Amount*', 'sum'),
        Invoice_Total_Fee_Schedule_Expected_Amount=('Fee Schedule Expected Amount', 'sum'),
        Invoice_Total_Expected_Amount_85_EM=('Expected Amount (85% E/M)', 'sum')
    )
    .reset_index()
)

# Step 6b: Compute average invoice totals for each benchmark group
invoice_benchmarks = (
    invoice_level
    .groupby(benchmark_keys, dropna=False)
    .agg(
        Benchmark_Charge_Amount_invoice_level=('Invoice_Total_Charge_Amount', 'mean'),
        Benchmark_Payment_Amount_invoice_level=('Invoice_Total_Payment_Amount', 'mean'),
        Fee_Schedule_Expected_Amount_invoice_level=('Invoice_Total_Fee_Schedule_Expected_Amount', 'mean'),
        Expected_Amount_85_EM_invoice_level=('Invoice_Total_Expected_Amount_85_EM', 'mean')
    )
    .reset_index()
)

# === Step 7: Merge Invoice-Level Benchmarks Back to Original Data ===
df_inv = df_inv.merge(invoice_benchmarks, on=benchmark_keys, how='left')

# === Step 8: Add Root Cause Tags ===
df_inv['Tag_Low_Payment'] = df_inv['Payment Amount*'] < (0.9 * df_inv['Benchmark_Payment_Amount_within_invoice'])
df_inv['Tag_Low_ZB_Collection'] = df_inv['Zero Balance Collection Rate'] < (
    0.9 * df_inv['Benchmark_Zero_Balance_Collection_Rate'])
df_inv['Tag_High_Charge'] = df_inv['Charge Amount'] > (
    1.1 * df_inv['Benchmark_Charge_Amount_within_invoice'])

# === Step 9: Add Gap Measures ===
df_inv["NRV Gap ($)"] = df_inv["Charge Billed Balance"] - df_inv["Payment Amount*"]
df_inv["NRV Gap (%)"] = np.where(
    df_inv["Charge Billed Balance"] == 0,
    np.nan,
    df_inv["NRV Gap ($)"] / df_inv["Charge Billed Balance"]
)
df_inv["NRV Gap Sum ($)"] = df_inv["NRV Gap ($)"]

# === Step 10: Second Payer Review Flag ===
df_inv["Second_Payer_Review_Flag"] = (
    (df_inv["Zero Balance Collection Rate"].round(4) == df_inv["Collection Rate*"].round(4)) &
    (df_inv["Payment Amount*"] < df_inv["Benchmark_Payment_Amount_within_invoice"])
).astype(int)

# === Step 11: Export Final Invoice-Level Output ===
OUTPUT_FILE = "invoice_level_index.csv"
df_inv.to_csv(OUTPUT_FILE, index=False)
print(f"✅ Invoice-level file written to: {OUTPUT_FILE}")
