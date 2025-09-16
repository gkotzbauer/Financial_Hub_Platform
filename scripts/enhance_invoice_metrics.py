import pandas as pd
import numpy as np
import os
import re
import zipfile

# === File Paths ===
INPUT_CSV = "invoice_level_index.csv"
INPUT_XLSX = "/mnt/data/RMT Invoice_level_index.xlsx"  # attached file
OUTPUT_CSV = "/mnt/data/invoice_level_index_enhanced.csv"
OUTPUT_ZIP = "/mnt/data/invoice_level_index_enhanced.zip"

# === Step 1: Load Data ===
if os.path.isfile(INPUT_CSV):
    df = pd.read_csv(INPUT_CSV)
elif os.path.isfile(INPUT_XLSX):
    df = pd.read_excel(INPUT_XLSX)
else:
    raise FileNotFoundError(f"Missing file: '{INPUT_CSV}' or attached '{INPUT_XLSX}'")

# === Step 1B: Remove any 'total' summary rows BEFORE processing ===
total_candidate_cols = [
    "Year", "Week", "Payer", "Group_EM", "Group_EM2",
    "Invoice_Number", "Charge CPT Code", "CPT_List_Str"
]
present_total_cols = [c for c in total_candidate_cols if c in df.columns]

def is_total_string(val: object) -> bool:
    if pd.isna(val):
        return False
    s = str(val).strip().lower()
    return bool(re.fullmatch(r"(grand\s+total|total)", s))

if present_total_cols:
    total_mask = df[present_total_cols].applymap(is_total_string).any(axis=1)
    if "Year" in df.columns and "Week" in df.columns:
        total_mask = total_mask | (
            df["Week"].astype(str).str.strip().str.lower().eq("0") &
            df["Year"].astype(str).str.strip().str.lower().str.contains(r"\bgrand\s*total\b", regex=True)
        )
    rows_before = len(df)
    df = df[~total_mask].copy()
    rows_removed = rows_before - len(df)
else:
    rows_removed = 0

# === Step 2: Ensure Numeric Columns ===
numeric_cols = [
    "Payment Amount*", "Expected Amount (85% E/M)", "Open Invoice Count",
    "Zero Balance Collection Rate", "Collection Rate*",
    "SP Charge Billed Balance", "Insurance Charge Billed Balance",
    "Charge Amount", "Payment per Visit", "Fee Schedule Expected Amount",
    "NRV Gap ($)", "NRV Gap (%)", "NRV Gap Sum ($)",
    "Benchmark_Payment_Amount_invoice_level"
]

for col in numeric_cols:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')

# === Step 3: Revenue Variance ===
if "Payment Amount*" in df.columns and "Expected Amount (85% E/M)" in df.columns:
    df["Revenue_Variance_$"] = df["Payment Amount*"] - df["Expected Amount (85% E/M)"]
    df["Revenue_Variance_%"] = np.where(
        df["Expected Amount (85% E/M)"] == 0,
        np.nan,
        df["Revenue_Variance_$"] / df["Expected Amount (85% E/M)"]
    )

# === Step 4: Overpayment Metrics ===
if "Revenue_Variance_$" in df.columns and "Expected Amount (85% E/M)" in df.columns:
    df["Overpayment ($)"] = df["Revenue_Variance_$"].apply(lambda x: x if pd.notna(x) and x > 0 else 0)
    df["Overpayment (%)"] = np.where(
        df["Expected Amount (85% E/M)"] == 0,
        np.nan,
        df["Overpayment ($)"] / df["Expected Amount (85% E/M)"]
    )

# === Step 5: Open Invoice Anomaly ===
if set(["Open Invoice Count", "Zero Balance Collection Rate", "Collection Rate*"]).issubset(df.columns):
    df["Open_Invoice_Anomaly_Flag"] = np.where(
        (df["Open Invoice Count"] == 0) &
        (df["Zero Balance Collection Rate"] < df["Collection Rate*"]),
        True, False
    )

# === Step 6: Positive Balances Only ===
if "SP Charge Billed Balance" in df.columns:
    df["SP_Positive_Balance"] = df["SP Charge Billed Balance"].apply(lambda x: x if pd.notna(x) and x > 0 else 0)
if "Insurance Charge Billed Balance" in df.columns:
    df["Insurance_Positive_Balance"] = df["Insurance Charge Billed Balance"].apply(lambda x: x if pd.notna(x) and x > 0 else 0)

# === Step 7: Invoice-Level Benchmark Metrics ===
if "Payment Amount*" in df.columns and "Benchmark_Payment_Amount_invoice_level" in df.columns:
    df["Invoice_Payment_Diff_vs_Benchmark_invoice_level"] = df["Payment Amount*"] - df["Benchmark_Payment_Amount_invoice_level"]

if "NRV Gap ($)" in df.columns:
    df["NRV_Gap_Dollar_invoice_level"] = df["NRV Gap ($)"]
if "NRV Gap (%)" in df.columns:
    df["NRV_Gap_Percent_invoice_level"] = df["NRV Gap (%)"]
if "NRV Gap Sum ($)" in df.columns:
    df["NRV_Gap_Sum_Dollar_invoice_level"] = df["NRV Gap Sum ($)"]

# === Step 8: Export CSV and ZIP ===
df.to_csv(OUTPUT_CSV, index=False)

with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(OUTPUT_CSV, arcname=os.path.basename(OUTPUT_CSV))

print(f"✅ Enhanced file saved to: {OUTPUT_CSV}")
print(f"📦 Zipped file saved to: {OUTPUT_ZIP}")
print(f"ℹ️ Rows removed as totals: {rows_removed}")
