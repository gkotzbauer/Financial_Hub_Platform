import os
import pandas as pd
import numpy as np
import zipfile
import ast

# =============================
# Config / Inputs & Outputs
# =============================
ATTACHED_XLSX = "/mnt/data/invoice_level_index_enhanced 4.xlsx"  # fallback if CSV missing
INVOICE_CSV = "invoice_level_index.csv"  # preferred if present

GRANULAR_CSV = "v2_Rev_Perf_Weekly_Model_Output_Final_granular.csv"
GRANULAR_ZIP = "v2_Rev_Perf_Weekly_Model_Output_Final_granular.zip"

AGG_CSV = "v2_Rev_Perf_Weekly_Model_Output_Final_agg.csv"
AGG_ZIP = "v2_Rev_Perf_Weekly_Model_Output_Final_agg.zip"

# =============================
# Step 1: Load invoice-level data
# =============================
if os.path.isfile(INVOICE_CSV):
    base_df = pd.read_csv(INVOICE_CSV)
elif os.path.isfile(ATTACHED_XLSX):
    base_df = pd.read_excel(ATTACHED_XLSX)
else:
    raise FileNotFoundError(f"Missing '{INVOICE_CSV}' and '{ATTACHED_XLSX}'")

# Compatibility: ensure 'Lab per Visit' exists
if "Lab per Visit" not in base_df.columns and "Lab per Visit (copy)" in base_df.columns:
    base_df["Lab per Visit"] = base_df["Lab per Visit (copy)"]

# Ensure expected columns exist to avoid groupby errors (zero-fill if absent)
for missing_col in ["NRV Gap ($)", "NRV Gap (%)", "NRV Gap Sum ($)"]:
    if missing_col not in base_df.columns:
        base_df[missing_col] = 0.0

# =============================
# Step 2: Numeric coercion (keep numeric until end)
# =============================
num_cols = [
    "Charge Amount", "Payment Amount*", "Avg. Charge E/M Weight", "Lab per Visit",
    "Procedure per Visit", "Radiology Count", "Zero Balance Collection Rate",
    "Collection Rate*", "Denial %", "Charge Billed Balance",
    "Zero Balance - Collection * Charges", "NRV Zero Balance*",
    "NRV Gap ($)", "NRV Gap (%)", "% of Remaining Charges", "NRV Gap Sum ($)",
    "Open Invoice Count", "Expected Amount (85% E/M)"
]
for c in num_cols:
    if c in base_df.columns:
        base_df[c] = pd.to_numeric(base_df[c], errors="coerce")

# =============================
# Step 3: Build missing benchmark fields from base data
# =============================
# 3A) Expected_Amount_85_EM_invoice_level (rate per visit) by Benchmark_Key
exp_rate_by_key = (
    base_df.groupby("Benchmark_Key", dropna=False)["Expected Amount (85% E/M)"]
           .mean()
           .rename("Expected_Amount_85_EM_invoice_level")
           .reset_index()
)

# 3B) Historical Benchmark_Invoice_Count by Benchmark_Key (mean weekly visits)
weekly_visits_by_key = (
    base_df.groupby(["Benchmark_Key","Year","Week"], dropna=False)["Invoice_Number"]
           .nunique()
           .rename("Visit_Count_Weekly")
           .reset_index()
)
bench_inv_count = (
    weekly_visits_by_key.groupby("Benchmark_Key", dropna=False)["Visit_Count_Weekly"]
                        .mean()
                        .rename("Benchmark_Invoice_Count")
                        .reset_index()
)

# =============================
# Step 4: Granular weekly (Benchmark_Key) aggregation
# =============================
group_cols_granular = ['Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2', 'Benchmark_Key']

weekly = (
    base_df.groupby(group_cols_granular, dropna=False)
    .agg(
        Visit_Count=('Invoice_Number', 'nunique'),
        Group_Size=('Invoice_Number', 'count'),
        Charge_Amount=('Charge Amount', 'sum'),
        Payment_Amount=('Payment Amount*', 'sum'),
        Avg_Charge_EM_Weight=('Avg. Charge E/M Weight', 'mean'),
        Labs_per_Visit=('Lab per Visit', 'mean'),
        Procedure_per_Visit=('Procedure per Visit', 'mean'),
        Radiology_Count=('Radiology Count', 'mean'),
        Zero_Balance_Collection_Rate=('Zero Balance Collection Rate', 'mean'),
        Collection_Rate=('Collection Rate*', 'mean'),
        Denial_Percent=('Denial %', 'mean'),
        Charge_Billed_Balance=('Charge Billed Balance', 'sum'),
        Zero_Balance_Collection_Star_Charges=('Zero Balance - Collection * Charges', 'sum'),
        NRV_Zero_Balance=('NRV Zero Balance*', 'sum'),
        NRV_Gap_Dollar=('NRV Gap ($)', 'sum'),
        NRV_Gap_Percent=('NRV Gap (%)', 'mean'),
        Remaining_Charges_Percent=('% of Remaining Charges', 'mean'),
        NRV_Gap_Sum_Dollar=('NRV Gap Sum ($)', 'sum'),
        Open_Invoice_Count=('Open Invoice Count', 'sum')
    )
    .reset_index()
)

# Merge derived benchmark fields into granular
weekly = weekly.merge(exp_rate_by_key, on="Benchmark_Key", how="left")
weekly = weekly.merge(bench_inv_count, on="Benchmark_Key", how="left")

# CPT count parsed from Benchmark_Key's CPT list segment
def count_cpts(key):
    try:
        cpts = ast.literal_eval(str(key).split('|')[-1])
        return len(cpts) if isinstance(cpts, list) else 0
    except Exception:
        return 0
weekly['CPT_Count'] = weekly['Benchmark_Key'].apply(count_cpts)

# =============================
# Step 5: Derived metrics (numeric) — granular
# =============================
weekly['Expected_Payment'] = weekly['Expected_Amount_85_EM_invoice_level'] * weekly['Visit_Count']
weekly['Revenue_Variance'] = weekly['Payment_Amount'] - weekly['Expected_Payment']
weekly['Revenue_Variance_Pct'] = np.where(
    weekly['Expected_Payment'] == 0,
    np.nan,
    weekly['Revenue_Variance'] / weekly['Expected_Payment']
)
weekly['Volume_Gap'] = weekly['Group_Size'] - weekly['Benchmark_Invoice_Count']
weekly['Actual_Rate_per_Visit'] = np.where(
    weekly['Visit_Count'] == 0, np.nan, weekly['Payment_Amount'] / weekly['Visit_Count']
)
weekly['Rate_Variance'] = weekly['Actual_Rate_per_Visit'] - weekly['Expected_Amount_85_EM_invoice_level']

# =============================
# Step 6: Aggregated weekly payer/E/M-level (macro view)
# =============================
group_cols_agg = ['Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2']

# 6A) Aggregate numeric fields from granular (kept numeric)
agg = (
    weekly.groupby(group_cols_agg, dropna=False)
    .agg(
        Visit_Count=('Visit_Count', 'sum'),             # sum of unique-per-key; valid if each invoice maps to one key
        Group_Size=('Group_Size', 'sum'),
        Charge_Amount=('Charge_Amount', 'sum'),
        Payment_Amount=('Payment_Amount', 'sum'),
        Avg_Charge_EM_Weight=('Avg_Charge_EM_Weight', 'mean'),
        Labs_per_Visit=('Labs_per_Visit', 'mean'),
        Procedure_per_Visit=('Procedure_per_Visit', 'mean'),
        Radiology_Count=('Radiology_Count', 'mean'),
        Zero_Balance_Collection_Rate=('Zero_Balance_Collection_Rate', 'mean'),
        Collection_Rate=('Collection_Rate', 'mean'),
        Denial_Percent=('Denial_Percent', 'mean'),
        Charge_Billed_Balance=('Charge_Billed_Balance', 'sum'),
        Zero_Balance_Collection_Star_Charges=('Zero_Balance_Collection_Star_Charges', 'sum'),
        NRV_Zero_Balance=('NRV_Zero_Balance', 'sum'),
        NRV_Gap_Dollar=('NRV_Gap_Dollar', 'sum'),
        NRV_Gap_Percent=('NRV_Gap_Percent', 'mean'),
        Remaining_Charges_Percent=('Remaining_Charges_Percent', 'mean'),
        NRV_Gap_Sum_Dollar=('NRV_Gap_Sum_Dollar', 'sum'),
        Open_Invoice_Count=('Open_Invoice_Count', 'sum'),
        Expected_Payment=('Expected_Payment', 'sum')
    )
    .reset_index()
)

# 6B) 🔧 CORRECT Benchmark_Invoice_Count at the aggregated level:
#     Count unique invoices for (Year, Week, Payer, Group_EM, Group_EM2) directly from base_df.
agg_benchmark_counts = (
    base_df.groupby(group_cols_agg, dropna=False)["Invoice_Number"]
           .nunique()
           .rename("Benchmark_Invoice_Count")
           .reset_index()
)

# 6C) ➕ Add Benchmark_Keys list for each aggregated row
agg_keys = (
    base_df.groupby(group_cols_agg, dropna=False)["Benchmark_Key"]
           .apply(lambda s: sorted(map(str, set(s.dropna()))))
           .rename("Benchmark_Keys")
           .reset_index()
)

# 6D) Merge fixes/additions into aggregated table
agg = agg.merge(agg_benchmark_counts, on=group_cols_agg, how="left")
agg = agg.merge(agg_keys, on=group_cols_agg, how="left")

# 6E) Aggregated derived metrics
agg['Actual_Rate_per_Visit'] = np.where(
    agg['Visit_Count'] == 0, np.nan, agg['Payment_Amount'] / agg['Visit_Count']
)
# Weighted expected rate per visit across keys
agg['Expected_Amount_85_EM_invoice_level'] = np.where(
    agg['Visit_Count'] == 0, np.nan, agg['Expected_Payment'] / agg['Visit_Count']
)
agg['Revenue_Variance'] = agg['Payment_Amount'] - agg['Expected_Payment']
agg['Revenue_Variance_Pct'] = np.where(
    agg['Expected_Payment'] == 0, np.nan, agg['Revenue_Variance'] / agg['Expected_Payment']
)
# Keep your original Volume_Gap definition; now Benchmark_Invoice_Count is an integer (unique invoices)
agg['Volume_Gap'] = agg['Group_Size'] - agg['Benchmark_Invoice_Count']
agg['Rate_Variance'] = agg['Actual_Rate_per_Visit'] - agg['Expected_Amount_85_EM_invoice_level']

# =============================
# Step 7: Percent formatting (at the very end)
# =============================
def format_pct_columns(df_in, cols):
    df_out = df_in.copy()
    for col in cols:
        if col in df_out.columns:
            df_out[col] = (df_out[col].astype(float) * 100).round().astype('Int64').astype(str) + '%'
    return df_out

pct_cols = [
    'Zero_Balance_Collection_Rate', 'Collection_Rate', 'Denial_Percent',
    'NRV_Gap_Percent', 'Remaining_Charges_Percent', 'Revenue_Variance_Pct'
]

weekly_out = format_pct_columns(weekly, pct_cols)
agg_out = format_pct_columns(agg, pct_cols)

# OPTIONAL: stringify Benchmark_Keys for CSV readability
if "Benchmark_Keys" in agg_out.columns:
    agg_out["Benchmark_Keys"] = agg_out["Benchmark_Keys"].apply(lambda x: str(x) if isinstance(x, list) else x)

# =============================
# Step 8: Export both outputs
# =============================
weekly_out.to_csv(GRANULAR_CSV, index=False)
with zipfile.ZipFile(GRANULAR_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(GRANULAR_CSV, arcname=os.path.basename(GRANULAR_CSV))

agg_out.to_csv(AGG_CSV, index=False)
with zipfile.ZipFile(AGG_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(AGG_CSV, arcname=os.path.basename(AGG_CSV))

print(f"✅ Granular CPT-level export: {GRANULAR_ZIP}")
print(f"✅ Aggregated weekly payer/E/M export: {AGG_ZIP}")
