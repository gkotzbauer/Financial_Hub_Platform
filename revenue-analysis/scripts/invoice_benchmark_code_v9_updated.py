import os
import pandas as pd
import numpy as np
import zipfile

# === Step 0: File Paths ===
INVOICE_INPUT = "/mnt/data/Invoice_Assigned_To_Benchmark_With_Count v3.xlsx"
OUTPUT_CSV = "/mnt/data/invoice_level_index.csv"
OUTPUT_ZIP = "/mnt/data/invoice_level_index.zip"
VALIDATION_REPORT = "/mnt/data/validation_report.csv"

# === Step 1: Load Invoice-Level Data ===
df_inv = pd.read_excel(INVOICE_INPUT)

# === Step 2: Normalize Key Fields ===
for col in ["Invoice_Number", "Payer", "Group_EM", "Group_EM2", "Charge CPT Code"]:
    df_inv[col] = df_inv[col].astype(str).str.strip()

# === Step 3: Identify and Exclude Invalid Records ===
required_cols = ["Invoice_Number", "Payer", "Group_EM", "Group_EM2", "Charge CPT Code"]
invalid_mask = df_inv[required_cols].isna().any(axis=1)
validation_report = df_inv[invalid_mask].copy()
df_inv = df_inv[~invalid_mask].copy()

# Export excluded rows for auditing
validation_report.to_csv(VALIDATION_REPORT, index=False)

# === Step 4: Build CPT Code List per Invoice ===
cpt_list_df = (
    df_inv.groupby("Invoice_Number")["Charge CPT Code"]
    .apply(lambda x: sorted(set(x)))
    .reset_index()
    .rename(columns={"Charge CPT Code": "CPT_List"})
)
cpt_list_df["CPT_List_Str"] = cpt_list_df["CPT_List"].apply(str)
df_inv = df_inv.merge(cpt_list_df, on="Invoice_Number", how="left")

# === Step 5: Build Benchmark Keys ===
df_inv["Abbreviate_Benchmark_Key"] = (
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

# === Step 6: Row-Level Metrics ===
df_inv["NRV Gap ($)"] = df_inv["Charge Billed Balance"] - df_inv["Payment Amount*"]
df_inv["NRV Gap (%)"] = np.where(
    df_inv["Charge Billed Balance"] == 0,
    np.nan,
    df_inv["NRV Gap ($)"] / df_inv["Charge Billed Balance"]
)
df_inv["NRV Gap Sum ($)"] = df_inv["NRV Gap ($)"]

# === Step 7: CPT-Level Benchmarks ===
cpt_benchmark_df = (
    df_inv
    .groupby("Benchmark_Key", dropna=False)
    .agg(
        Benchmark_Charge_Amount_within_invoice=('Charge Amount', 'mean'),
        Benchmark_Payment_Amount_within_invoice=('Payment Amount*', 'mean'),
        Benchmark_Zero_Balance_Collection_Rate=('Zero Balance Collection Rate', 'mean'),
        Benchmark_Collection_Rate=('Collection Rate*', 'mean'),
        Benchmark_NRV_Zero_Balance=('NRV Zero Balance*', 'mean'),
        Benchmark_Payment_per_Visit=('Payment per Visit', 'mean'),
        Benchmark_Invoice_Count=('Invoice_Number', 'nunique'),
        Fee_Schedule_Expected_Amount_within_invoice=('Fee Schedule Expected Amount', 'mean'),
        Expected_Amount_85_EM_within_invoice=('Expected Amount (85% E/M)', 'mean'),
        NRV_Gap_Dollar=('NRV Gap ($)', 'sum'),
        NRV_Gap_Percent=('NRV Gap (%)', 'mean'),
        Remaining_Charges_Percent=('% of Remaining Charges', 'mean'),
        NRV_Gap_Sum_Dollar=('NRV Gap Sum ($)', 'sum'),
        Open_Invoice_Count=('Open Invoice Count', 'sum')
    )
    .reset_index()
)
df_inv = df_inv.merge(cpt_benchmark_df, on="Benchmark_Key", how="left")

# === Step 8: Row-Level Variance from Benchmark ===
df_inv["Invoice_Payment_Diff_vs_Benchmark"] = (
    df_inv["Payment Amount*"] - df_inv["Benchmark_Payment_Amount_within_invoice"]
)
df_inv["Invoice_Payment_Pct_Diff_vs_Benchmark"] = np.where(
    df_inv["Benchmark_Payment_Amount_within_invoice"] == 0,
    np.nan,
    df_inv["Invoice_Payment_Diff_vs_Benchmark"] / df_inv["Benchmark_Payment_Amount_within_invoice"]
)

# === Step 9: Invoice-Level Aggregates ===
invoice_sums = (
    df_inv
    .groupby(["Invoice_Number", "Benchmark_Key"], dropna=False)
    .agg(
        Invoice_Total_Charge_Amount=('Charge Amount', 'sum'),
        Invoice_Total_Payment_Amount=('Payment Amount*', 'sum'),
        Invoice_Total_Fee_Schedule_Expected_Amount=('Fee Schedule Expected Amount', 'sum'),
        Invoice_Total_Expected_Amount_85_EM=('Expected Amount (85% E/M)', 'sum'),
        Invoice_NRV_Gap_Dollar=('NRV Gap ($)', 'sum'),
        Invoice_NRV_Gap_Sum_Dollar=('NRV Gap Sum ($)', 'sum'),
        Invoice_Payment_Diff_vs_Benchmark=('Invoice_Payment_Diff_vs_Benchmark', 'mean'),
        Invoice_Payment_Pct_Diff_vs_Benchmark=('Invoice_Payment_Pct_Diff_vs_Benchmark', 'mean')
    )
    .reset_index()
)

invoice_sums["Invoice_NRV_Gap_Percent"] = np.where(
    invoice_sums["Invoice_Total_Charge_Amount"] == 0,
    np.nan,
    invoice_sums["Invoice_NRV_Gap_Dollar"] / invoice_sums["Invoice_Total_Charge_Amount"]
)

# === Step 10: Merge Invoice Aggregates Back ===
df_inv = df_inv.merge(invoice_sums, on=["Invoice_Number", "Benchmark_Key"], how="left")

# === Step 11: Invoice-Level Benchmark Aggregates ===
invoice_level_benchmarks = (
    invoice_sums
    .assign(
        Benchmark_Payment_Variance=lambda d: (
            d["Invoice_Total_Payment_Amount"] - d["Invoice_Total_Expected_Amount_85_EM"]
        ),
        Benchmark_Payment_Variance_Pct=lambda d: np.where(
            d["Invoice_Total_Expected_Amount_85_EM"] == 0,
            np.nan,
            (d["Invoice_Total_Payment_Amount"] - d["Invoice_Total_Expected_Amount_85_EM"]) / d["Invoice_Total_Expected_Amount_85_EM"]
        )
    )
    .groupby("Benchmark_Key", dropna=False)
    .agg(
        Benchmark_Charge_Amount_invoice_level=('Invoice_Total_Charge_Amount', 'mean'),
        Benchmark_Payment_Amount_invoice_level=('Invoice_Total_Payment_Amount', 'mean'),
        Fee_Schedule_Expected_Amount_invoice_level=('Invoice_Total_Fee_Schedule_Expected_Amount', 'mean'),
        Expected_Amount_85_EM_invoice_level=('Invoice_Total_Expected_Amount_85_EM', 'mean'),
        NRV_Gap_Dollar_invoice_level=('Invoice_NRV_Gap_Dollar', 'mean'),
        NRV_Gap_Percent_invoice_level=('Invoice_NRV_Gap_Percent', 'mean'),
        NRV_Gap_Sum_Dollar_invoice_level=('Invoice_NRV_Gap_Sum_Dollar', 'mean'),
        Invoice_Payment_Diff_vs_Benchmark_invoice_level=('Invoice_Payment_Diff_vs_Benchmark', 'mean'),
        Invoice_Payment_Pct_Diff_vs_Benchmark_invoice_level=('Invoice_Payment_Pct_Diff_vs_Benchmark', 'mean'),
        Benchmark_Payment_Variance_invoice_level=('Benchmark_Payment_Variance', 'mean'),
        Benchmark_Payment_Variance_Pct_invoice_level=('Benchmark_Payment_Variance_Pct', 'mean')
    )
    .reset_index()
)

df_inv = df_inv.merge(invoice_level_benchmarks, on="Benchmark_Key", how="left")

# === Step 12: Eliminate Duplicate Columns ===
df_inv = df_inv.loc[:, ~df_inv.columns.duplicated(keep="first")]

# === Step 13: Export Final Outputs ===
df_inv.to_csv(OUTPUT_CSV, index=False)
with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(OUTPUT_CSV, arcname="invoice_level_index.csv")

print("✅ Export complete:")
print(f"    ➤ Clean file: {OUTPUT_CSV}")
print(f"    ➤ ZIP archive: {OUTPUT_ZIP}")
print(f"    ➤ Validation report: {VALIDATION_REPORT}")
