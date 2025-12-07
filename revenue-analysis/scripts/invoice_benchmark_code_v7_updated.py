import os
import pandas as pd
import numpy as np
import zipfile

# === Step 0: File Paths ===
INVOICE_INPUT = "Invoice_Assigned_To_Benchmark_With_Count.xlsx"
OUTPUT_CSV = "invoice_level_index.csv"
OUTPUT_ZIP = "invoice_level_index.zip"

input_path = f"/mnt/data/{INVOICE_INPUT}"
csv_path = f"/mnt/data/{OUTPUT_CSV}"
zip_path = f"/mnt/data/{OUTPUT_ZIP}"

if not os.path.isfile(input_path):
    raise FileNotFoundError(f"Missing input file: {INVOICE_INPUT}")

# === Step 1: Load Invoice-Level Data ===
df_inv = pd.read_excel(input_path)

# === Step 2: Fill Down Invoice_Number ===
df_inv['Invoice_Number'] = df_inv['Invoice_Number'].fillna(method='ffill')

# === Step 3: Normalize Fields ===
df_inv["Invoice_Number"] = df_inv["Invoice_Number"].astype(str).str.strip()
df_inv["Payer"] = df_inv["Payer"].astype(str).str.strip()
df_inv["Group_EM"] = df_inv["Group_EM"].astype(str).str.strip()
df_inv["Group_EM2"] = df_inv["Group_EM2"].astype(str).str.strip()
df_inv["Charge CPT Code"] = df_inv["Charge CPT Code"].astype(str).str.strip()

# === Step 4: Build Charge CPT Code Sets ===
df_inv["CPT_List"] = df_inv.groupby(["Invoice_Number", "Payer", "Group_EM", "Group_EM2"])["Charge CPT Code"]\
                           .transform(lambda s: sorted(set(s)))
df_inv["CPT_List_Str"] = df_inv["CPT_List"].apply(str)

# === Step 5: Keys for Benchmarking and Matching ===
df_inv["Abbrev_Key_With_Invoices"] = (
    df_inv["Invoice_Number"] + "|" +
    df_inv["Payer"] + "|" +
    df_inv["Group_EM"] + "|" +
    df_inv["Group_EM2"] + "|" +
    df_inv["CPT_List_Str"]
)

df_inv["Benchmark_Key"] = (
    df_inv["Payer"] + "|" +
    df_inv["Group_EM"] + "|" +
    df_inv["Group_EM2"] + "|" +
    df_inv["CPT_List_Str"]
)

# === Step 6: CPT-Level Benchmarks ===
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

# === Step 7: Invoice-Level Benchmarks ===
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

# === Step 8: Tags ===
df_inv['Tag_Low_Payment'] = df_inv['Payment Amount*'] < (0.9 * df_inv['Benchmark_Payment_Amount_within_invoice'])
df_inv['Tag_Low_ZB_Collection'] = df_inv['Zero Balance Collection Rate'] < (0.9 * df_inv['Benchmark_Zero_Balance_Collection_Rate'])
df_inv['Tag_High_Charge'] = df_inv['Charge Amount'] > (1.1 * df_inv['Benchmark_Charge_Amount_within_invoice'])

# === Step 9: Gap Measures ===
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

# === Step 11: Charge Billed Balance Totals ===
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

# === Step 12: Open Invoice Count ===
df_inv['Open_Invoice_Flag'] = df_inv['NRV Zero Balance*'].isna().astype(int)
open_inv_count = (
    df_inv[df_inv['Open_Invoice_Flag'] == 1]
    .groupby(group_keys)['Invoice_Number']
    .nunique()
    .reset_index()
    .rename(columns={'Invoice_Number': 'Open Invoice Count'})
)
df_inv = df_inv.merge(open_inv_count, on=group_keys, how='left')
df_inv['Open Invoice Count'] = df_inv['Open Invoice Count'].fillna(0).astype(int)

# === Step 13: Invoice Payment Difference vs Benchmark ===
df_inv["Invoice_Payment_Diff_vs_Benchmark"] = (
    df_inv["Payment Amount*"] - df_inv["Benchmark_Payment_Amount_within_invoice"]
)

df_inv["Invoice_Payment_Pct_Diff_vs_Benchmark"] = np.where(
    df_inv["Benchmark_Payment_Amount_within_invoice"] == 0,
    np.nan,
    df_inv["Invoice_Payment_Diff_vs_Benchmark"] / df_inv["Benchmark_Payment_Amount_within_invoice"]
)

# === Step 14: Export Final CSV and ZIP ===
df_inv.to_csv(csv_path, index=False)

with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(csv_path, arcname=OUTPUT_CSV)

print(f"✅ CSV: {csv_path}")
print(f"✅ ZIP: {zip_path}")
