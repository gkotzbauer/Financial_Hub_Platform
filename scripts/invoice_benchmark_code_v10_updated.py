import os
import pandas as pd
import numpy as np
import zipfile

# === Step 0: File Paths ===
INVOICE_INPUT = "/mnt/data/Invoice_Assigned_To_Benchmark_With_Count v3.xlsx"
OUTPUT_CSV = "/mnt/data/invoice_level_index.csv"
OUTPUT_ZIP = "/mnt/data/invoice_level_index.zip"
VALIDATION_REPORT = "/mnt/data/validation_report.csv"

# === Step 1: Load & Normalize Data ===
df_inv = pd.read_excel(INVOICE_INPUT)

key_cols = ["Invoice_Number", "Payer", "Group_EM", "Group_EM2", "Charge CPT Code"]
df_inv[key_cols] = df_inv[key_cols].astype(str).apply(lambda x: x.str.strip())

# === Step 2: Validate Required Fields ===
invalid_mask = df_inv[key_cols].isna().any(axis=1)
df_inv[invalid_mask].to_csv(VALIDATION_REPORT, index=False)
df_inv = df_inv[~invalid_mask].copy()

# === Step 3: CPT List & Benchmark Keys ===
cpt_list_df = (
    df_inv.groupby("Invoice_Number")["Charge CPT Code"]
    .apply(lambda x: sorted(set(x))).reset_index(name="CPT_List")
)
cpt_list_df["CPT_List_Str"] = cpt_list_df["CPT_List"].astype(str)
df_inv = df_inv.merge(cpt_list_df, on="Invoice_Number", how="left")

key_parts = ["Payer", "Group_EM", "Group_EM2", "CPT_List_Str"]
df_inv["Benchmark_Key"] = df_inv[key_parts].agg("|".join, axis=1)
df_inv["Abbreviate_Benchmark_Key"] = df_inv[["Invoice_Number"] + key_parts].agg("|".join, axis=1)

# === Step 4: Row-Level Metrics ===
df_inv["NRV Gap ($)"] = df_inv["Charge Billed Balance"] - df_inv["Payment Amount*"]
df_inv["NRV Gap (%)"] = np.where(
    df_inv["Charge Billed Balance"] == 0,
    np.nan,
    df_inv["NRV Gap ($)"] / df_inv["Charge Billed Balance"]
)
df_inv["NRV Gap Sum ($)"] = df_inv["NRV Gap ($)"]

# === Step 5: Benchmark Aggregates ===
cpt_benchmark_df = df_inv.groupby("Benchmark_Key", dropna=False).agg({
    'Charge Amount': 'mean',
    'Payment Amount*': 'mean',
    'Zero Balance Collection Rate': 'mean',
    'Collection Rate*': 'mean',
    'NRV Zero Balance*': 'mean',
    'Payment per Visit': 'mean',
    'Invoice_Number': pd.Series.nunique,
    'Fee Schedule Expected Amount': 'mean',
    'Expected Amount (85% E/M)': 'mean',
    'NRV Gap ($)': 'sum',
    'NRV Gap (%)': 'mean',
    '% of Remaining Charges': 'mean',
    'NRV Gap Sum ($)': 'sum',
    'Open Invoice Count': 'sum'
}).rename(columns={
    'Charge Amount': 'Benchmark_Charge_Amount_within_invoice',
    'Payment Amount*': 'Benchmark_Payment_Amount_within_invoice',
    'Zero Balance Collection Rate': 'Benchmark_Zero_Balance_Collection_Rate',
    'Collection Rate*': 'Benchmark_Collection_Rate',
    'NRV Zero Balance*': 'Benchmark_NRV_Zero_Balance',
    'Payment per Visit': 'Benchmark_Payment_per_Visit',
    'Invoice_Number': 'Benchmark_Invoice_Count',
    'Fee Schedule Expected Amount': 'Fee_Schedule_Expected_Amount_within_invoice',
    'Expected Amount (85% E/M)': 'Expected_Amount_85_EM_within_invoice',
    'NRV Gap ($)': 'NRV_Gap_Dollar',
    'NRV Gap (%)': 'NRV_Gap_Percent',
    '% of Remaining Charges': 'Remaining_Charges_Percent',
    'NRV Gap Sum ($)': 'NRV_Gap_Sum_Dollar',
    'Open Invoice Count': 'Open_Invoice_Count'
}).reset_index()

df_inv = df_inv.merge(cpt_benchmark_df, on="Benchmark_Key", how="left")

# === Step 6: Row-Level Variance ===
df_inv["Invoice_Payment_Diff_vs_Benchmark"] = df_inv["Payment Amount*"] - df_inv["Benchmark_Payment_Amount_within_invoice"]
df_inv["Invoice_Payment_Pct_Diff_vs_Benchmark"] = np.where(
    df_inv["Benchmark_Payment_Amount_within_invoice"] == 0,
    np.nan,
    df_inv["Invoice_Payment_Diff_vs_Benchmark"] / df_inv["Benchmark_Payment_Amount_within_invoice"]
)

# === Step 7: Invoice Aggregates ===
invoice_sums = df_inv.groupby(["Invoice_Number", "Benchmark_Key"], dropna=False).agg({
    'Charge Amount': 'sum',
    'Payment Amount*': 'sum',
    'Fee Schedule Expected Amount': 'sum',
    'Expected Amount (85% E/M)': 'sum',
    'NRV Gap ($)': 'sum',
    'NRV Gap Sum ($)': 'sum',
    'Invoice_Payment_Diff_vs_Benchmark': 'mean',
    'Invoice_Payment_Pct_Diff_vs_Benchmark': 'mean'
}).rename(columns={
    'Charge Amount': 'Invoice_Total_Charge_Amount',
    'Payment Amount*': 'Invoice_Total_Payment_Amount',
    'Fee Schedule Expected Amount': 'Invoice_Total_Fee_Schedule_Expected_Amount',
    'Expected Amount (85% E/M)': 'Invoice_Total_Expected_Amount_85_EM',
    'NRV Gap ($)': 'Invoice_NRV_Gap_Dollar',
    'NRV Gap Sum ($)': 'Invoice_NRV_Gap_Sum_Dollar'
}).reset_index()

invoice_sums["Invoice_NRV_Gap_Percent"] = np.where(
    invoice_sums["Invoice_Total_Charge_Amount"] == 0,
    np.nan,
    invoice_sums["Invoice_NRV_Gap_Dollar"] / invoice_sums["Invoice_Total_Charge_Amount"]
)

df_inv = df_inv.merge(invoice_sums, on=["Invoice_Number", "Benchmark_Key"], how="left")

# === Step 8: Invoice-Level Benchmark Aggregates ===
bench_df = invoice_sums.assign(
    Benchmark_Payment_Variance=lambda d: d["Invoice_Total_Payment_Amount"] - d["Invoice_Total_Expected_Amount_85_EM"],
    Benchmark_Payment_Variance_Pct=lambda d: np.where(
        d["Invoice_Total_Expected_Amount_85_EM"] == 0,
        np.nan,
        (d["Invoice_Total_Payment_Amount"] - d["Invoice_Total_Expected_Amount_85_EM"]) / d["Invoice_Total_Expected_Amount_85_EM"]
    )
).groupby("Benchmark_Key", dropna=False).agg({
    'Invoice_Total_Charge_Amount': 'mean',
    'Invoice_Total_Payment_Amount': 'mean',
    'Invoice_Total_Fee_Schedule_Expected_Amount': 'mean',
    'Invoice_Total_Expected_Amount_85_EM': 'mean',
    'Invoice_NRV_Gap_Dollar': 'mean',
    'Invoice_NRV_Gap_Percent': 'mean',
    'Invoice_NRV_Gap_Sum_Dollar': 'mean',
    'Invoice_Payment_Diff_vs_Benchmark': 'mean',
    'Invoice_Payment_Pct_Diff_vs_Benchmark': 'mean',
    'Benchmark_Payment_Variance': 'mean',
    'Benchmark_Payment_Variance_Pct': 'mean'
}).rename(columns=lambda x: x + "_invoice_level").reset_index()

df_inv = df_inv.merge(bench_df, on="Benchmark_Key", how="left")

# === Step 9: Export ===
df_inv = df_inv.loc[:, ~df_inv.columns.duplicated(keep="first")]
df_inv.to_csv(OUTPUT_CSV, index=False)

with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(OUTPUT_CSV, arcname="invoice_level_index.csv")

print("\u2705 Export complete:")
print(f"    ➔ Clean file: {OUTPUT_CSV}")
print(f"    ➔ ZIP archive: {OUTPUT_ZIP}")
print(f"    ➔ Validation report: {VALIDATION_REPORT}")
