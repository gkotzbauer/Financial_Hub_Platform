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

# === Step 4: Export Enhanced Invoice Data for Downstream Use ===
df_inv.to_csv(OUTPUT_CSV, index=False)
with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(OUTPUT_CSV, arcname="invoice_level_index.csv")

print("✅ Export complete:")
print(f"    ➔ Clean file: {OUTPUT_CSV}")
print(f"    ➔ ZIP archive: {OUTPUT_ZIP}")
print(f"    ➔ Validation report: {VALIDATION_REPORT}")
