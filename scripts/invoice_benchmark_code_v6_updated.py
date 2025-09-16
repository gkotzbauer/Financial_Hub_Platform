import os
import pandas as pd
import numpy as np
import zipfile

# === Step 0: File Paths ===
INVOICE_INPUT = "Invoice_Assigned_To_Benchmark_With_Count.xlsx"
OUTPUT_CSV = "invoice_level_index.csv"
OUTPUT_ZIP = "invoice_level_index.zip"

if not os.path.isfile(INVOICE_INPUT):
    raise FileNotFoundError(f"❌ Missing required input file: {INVOICE_INPUT}")

df_inv = pd.read_excel(INVOICE_INPUT)

# === Step 1: Standardize Columns ===
df_inv = df_inv.rename(columns={
    'Primary Financial Class': 'Payer',
    'Chart E/M Code Grouping': 'Group_EM',
    'Chart E/M Code Second Layer': 'Group_EM2',
    'Charge Invoice Number': 'Invoice_Number'
})

df_inv['Year'] = pd.to_numeric(df_inv['Year'], errors='coerce').astype('Int64')
df_inv['Week'] = pd.to_numeric(df_inv['Week'], errors='coerce').astype('Int64')
df_inv = df_inv.dropna(subset=['Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2']).copy()
df_inv['Year'] = df_inv['Year'].astype(int)
df_inv['Week'] = df_inv['Week'].astype(int)

# === Step 1B: Fill down missing Invoice_Number ===
df_inv['Invoice_Number'] = df_inv['Invoice_Number'].fillna(method='ffill')

# === Step 2: CPT Grouping Key ===
df_inv['Charge CPT Code'] = df_inv['Charge CPT Code'].astype(str)
df_inv['Invoice_CPT_Set'] = (
    df_inv.groupby('Invoice_Number')['Charge CPT Code']
    .transform(lambda x: str(sorted(set(x))))
)

df_inv['Benchmark_Key'] = (
    df_inv['Year'].astype(str) + "|" +
    df_inv['Week'].astype(str) + "|" +
    df_inv['Payer'] + "|" +
    df_inv['Group_EM'] + "|" +
    df_inv['Group_EM2'] + "|" +
    df_inv['Invoice_CPT_Set']
)

# === ✅ New Step: Abbreviated Benchmark Key ===
df_inv['Abbreviate_Benchmark_Key'] = df_inv['Benchmark_Key'].apply(lambda x: '|'.join(x.split('|')[2:]))

# === Step 3: CPT-Level Benchmarks ===
cpt_benchmark_df = (
    df_inv
    .groupby('Benchmark_Key', dropna=False)
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
df_inv = df_inv.merge(cpt_benchmark_df, on='Benchmark_Key', how='left')

# === Step 4: Invoice-Level Benchmarks ===
invoice_sums = (
    df_inv
    .groupby(['Invoice_Number', 'Benchmark_Key'], dropna=False)
    .agg(
        Invoice_Total_Charge_Amount=('Charge Amount', 'sum'),
        Invoice_Total_Payment_Amount=('Payment Amount*', 'sum'),
        Invoice_Total_Fee_Schedule_Expected_Amount=('Fee Schedule Expected Amount', 'sum'),
        Invoice_Total_Expected_Amount_85_EM=('Expected Amount (85% E/M)', 'sum')
    )
    .reset_index()
)

invoice_level_benchmarks = (
    invoice_sums
    .groupby('Benchmark_Key', dropna=False)
    .agg(
        Benchmark_Charge_Amount_invoice_level=('Invoice_Total_Charge_Amount', 'mean'),
        Benchmark_Payment_Amount_invoice_level=('Invoice_Total_Payment_Amount', 'mean'),
        Fee_Schedule_Expected_Amount_invoice_level=('Invoice_Total_Fee_Schedule_Expected_Amount', 'mean'),
        Expected_Amount_85_EM_invoice_level=('Invoice_Total_Expected_Amount_85_EM', 'mean')
    )
    .reset_index()
)
df_inv = df_inv.merge(invoice_level_benchmarks, on='Benchmark_Key', how='left')

# === Step 5: Tags ===
df_inv['Tag_Low_Payment'] = df_inv['Payment Amount*'] < (0.9 * df_inv['Benchmark_Payment_Amount_within_invoice'])
df_inv['Tag_Low_ZB_Collection'] = df_inv['Zero Balance Collection Rate'] < (0.9 * df_inv['Benchmark_Zero_Balance_Collection_Rate'])
df_inv['Tag_High_Charge'] = df_inv['Charge Amount'] > (1.1 * df_inv['Benchmark_Charge_Amount_within_invoice'])

# === Step 6: Gap Measures ===
df_inv["NRV Gap ($)"] = df_inv["Charge Billed Balance"] - df_inv["Payment Amount*"]
df_inv["NRV Gap (%)"] = np.where(
    df_inv["Charge Billed Balance"] == 0,
    np.nan,
    df_inv["NRV Gap ($)"] / df_inv["Charge Billed Balance"]
)
df_inv["NRV Gap Sum ($)"] = df_inv["NRV Gap ($)"]

# === Step 7: Second Payer Review Flag ===
df_inv["Second_Payer_Review_Flag"] = (
    (df_inv["Zero Balance Collection Rate"].round(4) == df_inv["Collection Rate*"].round(4)) &
    (df_inv["Payment Amount*"] < df_inv["Benchmark_Payment_Amount_within_invoice"])
).astype(int)

# === Step 8: Charge Billed Balance Totals ===
group_keys = ['Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2']

sp_bal = (
    df_inv[df_inv['SP Charge Billed Balance'] > 0]
    .groupby(group_keys)['SP Charge Billed Balance']
    .sum()
    .reset_index()
    .rename(columns={'SP Charge Billed Balance': 'SP Charge Billed Balance Total'})
)

ins_bal = (
    df_inv[df_inv['Insurance Charge Billed Balance'] > 0]
    .groupby(group_keys)['Insurance Charge Billed Balance']
    .sum()
    .reset_index()
    .rename(columns={'Insurance Charge Billed Balance': 'Insurance Charge Billed Balance Total'})
)

df_inv = df_inv.merge(sp_bal, on=group_keys, how='left')
df_inv = df_inv.merge(ins_bal, on=group_keys, how='left')

# === Step 9: Open Invoice Count ===
df_inv['Open_Invoice_Flag'] = df_inv['NRV Zero Balance*'].isna().astype(int)
open_inv_count = (
    df_inv[df_inv['Open_Invoice_Flag'] == 1]
    .groupby(group_keys)['Invoice_Number']
    .nunique()
    .reset_index()
    .rename(columns={'Invoice_Number': 'Open Invoice Count'})
)
df_inv = df_inv.merge(open_inv_count, on=group_keys, how='left')
if 'Open Invoice Count' not in df_inv.columns:
    df_inv['Open Invoice Count'] = 0
else:
    df_inv['Open Invoice Count'] = df_inv['Open Invoice Count'].fillna(0).astype(int)

# === Step 10: Final Output ===
df_inv.to_csv(OUTPUT_CSV, index=False)

# === Step 11: Zip the Output ===
with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(OUTPUT_CSV, arcname=os.path.basename(OUTPUT_CSV))
