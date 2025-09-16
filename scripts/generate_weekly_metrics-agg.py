import os
import pandas as pd
import numpy as np
import zipfile
import ast

# =============================
# Config / Inputs & Outputs
# =============================
PREFERRED_CSV = "invoice_level_index.csv"  # preferred if present
ATTACHED_XLSX_CANDIDATES = [
    "/mnt/data/invoice_level_index_enhanced 4.xlsx",
    "/mnt/data/RMT Invoice_level_index.xlsx",
]

AGG_CSV = "/mnt/data/v2_Rev_Perf_Weekly_Model_Output_Final_agg.csv"
AGG_ZIP = "/mnt/data/v2_Rev_Perf_Weekly_Model_Output_Final_agg.zip"

# =============================
# Step 1: Load invoice-level data
# =============================
if os.path.isfile(PREFERRED_CSV):
    base_df = pd.read_csv(PREFERRED_CSV)
else:
    path = next((p for p in ATTACHED_XLSX_CANDIDATES if os.path.isfile(p)), None)
    if path is None:
        raise FileNotFoundError(f"Missing '{PREFERRED_CSV}' and none of {ATTACHED_XLSX_CANDIDATES} exists.")
    base_df = pd.read_excel(path)

# Ensure 'Lab per Visit'
if "Lab per Visit" not in base_df.columns and "Lab per Visit (copy)" in base_df.columns:
    base_df["Lab per Visit"] = base_df["Lab per Visit (copy)"]

# Ensure some expected columns exist
for missing_col in ["NRV Gap ($)", "NRV Gap (%)", "NRV Gap Sum ($)"]:
    if missing_col not in base_df.columns:
        base_df[missing_col] = 0.0

# =============================
# Step 2: Numeric coercion
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
# Step 3: Per-key historical benchmarks (same as granular script)
# =============================
exp_rate_by_key = (
    base_df.groupby("Benchmark_Key", dropna=False)["Expected Amount (85% E/M)"]
           .mean()
           .rename("Expected_Amount_85_EM_invoice_level")
           .reset_index()
)
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
weekly_key_totals = (
    base_df.groupby(["Benchmark_Key","Year","Week"], dropna=False)
           .agg(Payment_Amount_week=("Payment Amount*", "sum"),
                Visit_Count_week=("Invoice_Number", "nunique"))
           .reset_index()
)
weekly_key_totals["Benchmark_Payment_Rate_week"] = np.where(
    weekly_key_totals["Visit_Count_week"] == 0,
    np.nan,
    weekly_key_totals["Payment_Amount_week"] / weekly_key_totals["Visit_Count_week"]
)
bench_pay_rate_by_key = (
    weekly_key_totals.groupby("Benchmark_Key", dropna=False)["Benchmark_Payment_Rate_week"]
                     .mean()
                     .rename("Benchmark_Payment_Rate_per_Visit")
                     .reset_index()
)

# =============================
# Step 4: Weekly granular (Benchmark_Key) — needed as a staging table
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

weekly = weekly.merge(exp_rate_by_key, on="Benchmark_Key", how="left")
weekly = weekly.merge(bench_inv_count, on="Benchmark_Key", how="left")
weekly = weekly.merge(bench_pay_rate_by_key, on="Benchmark_Key", how="left")

weekly['Expected_Payment'] = weekly['Expected_Amount_85_EM_invoice_level'] * weekly['Visit_Count']
weekly['Benchmark_Payment'] = weekly['Benchmark_Payment_Rate_per_Visit'] * weekly['Visit_Count']

# =============================
# Step 5: Aggregated weekly payer/E/M-level roll-up
# =============================
group_cols_agg = ['Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2']

agg = (
    weekly.groupby(group_cols_agg, dropna=False)
    .agg(
        Visit_Count=('Visit_Count', 'sum'),
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
        Expected_Payment=('Expected_Payment', 'sum'),
        benchmark_payment=('Benchmark_Payment', 'sum')
    )
    .reset_index()
)

# Correct Benchmark_Invoice_Count for the macro grouping (unique invoices)
agg_benchmark_counts = (
    base_df.groupby(group_cols_agg, dropna=False)["Invoice_Number"]
           .nunique()
           .rename("Benchmark_Invoice_Count")
           .reset_index()
)
# Add Benchmark_Keys list for each aggregated row
agg_keys = (
    base_df.groupby(group_cols_agg, dropna=False)["Benchmark_Key"]
           .apply(lambda s: sorted(map(str, set(s.dropna()))))
           .rename("Benchmark_Keys")
           .reset_index()
)
agg = agg.merge(agg_benchmark_counts, on=group_cols_agg, how="left")
agg = agg.merge(agg_keys, on=group_cols_agg, how="left")

# Aggregated derived metrics
agg['Actual_Rate_per_Visit'] = np.where(
    agg['Visit_Count'] == 0, np.nan, agg['Payment_Amount'] / agg['Visit_Count']
)
agg['Expected_Amount_85_EM_invoice_level'] = np.where(
    agg['Visit_Count'] == 0, np.nan, agg['Expected_Payment'] / agg['Visit_Count']
)
agg['Revenue_Variance'] = agg['Payment_Amount'] - agg['Expected_Payment']
agg['Revenue_Variance_Pct'] = np.where(
    agg['Expected_Payment'] == 0, np.nan, agg['Revenue_Variance'] / agg['Expected_Payment']
)
agg['Volume_Gap'] = agg['Visit_Count'] - agg['Benchmark_Invoice_Count']
agg['Rate_Variance'] = agg['Actual_Rate_per_Visit'] - agg['Expected_Amount_85_EM_invoice_level']

# Expected vs Benchmark payment variances (aggregated)
agg['Expected_vs_Benchmark_Payment_Variance_$'] = agg['Expected_Payment'] - agg['benchmark_payment']
agg['Expected_vs_Benchmark_Payment_Variance_%'] = np.where(
    agg['benchmark_payment'] == 0, np.nan,
    agg['Expected_vs_Benchmark_Payment_Variance_$'] / agg['benchmark_payment']
)

# =============================
# Step 6: Weighted vs Unweighted benchmark_payment diagnostics
# =============================
MATERIALITY_PCT = 0.03  # 3% threshold

agg_weighting = (
    weekly.assign(_w=weekly["Benchmark_Payment_Rate_per_Visit"] * weekly["Visit_Count"])
          .groupby(group_cols_agg, dropna=False)
          .agg(
              benchmark_payment_weighted=("_w","sum"),
              total_visits=("Visit_Count","sum"),
              mean_rate_unweighted=("Benchmark_Payment_Rate_per_Visit","mean")
          )
          .reset_index()
)
agg_weighting["benchmark_payment_unweighted"] = (
    agg_weighting["mean_rate_unweighted"] * agg_weighting["total_visits"]
)
agg_weighting["Benchmark_Payment_Weighting_Diff_$"] = (
    agg_weighting["benchmark_payment_weighted"] - agg_weighting["benchmark_payment_unweighted"]
)
agg_weighting["Benchmark_Payment_Weighting_Diff_%"] = np.where(
    agg_weighting["benchmark_payment_unweighted"] == 0, np.nan,
    agg_weighting["Benchmark_Payment_Weighting_Diff_$"] / agg_weighting["benchmark_payment_unweighted"]
)
agg_weighting["Benchmark_Payment_Weighting_Material_Flag"] = (
    agg_weighting["Benchmark_Payment_Weighting_Diff_%"].abs() >= MATERIALITY_PCT
)

agg = agg.merge(agg_weighting, on=group_cols_agg, how="left")

# If 'benchmark_payment' is missing (shouldn't be), default to weighted
if "benchmark_payment" not in agg.columns or agg["benchmark_payment"].isna().all():
    agg["benchmark_payment"] = agg["benchmark_payment_weighted"]

# =============================
# Step 7: Percent formatting (end)
# =============================
def format_pct_columns(df_in, cols):
    df_out = df_in.copy()
    for col in cols:
        if col in df_out.columns:
            df_out[col] = (df_out[col].astype(float) * 100).round().astype('Int64').astype(str) + '%'
    return df_out

pct_cols = [
    'Zero_Balance_Collection_Rate', 'Collection_Rate', 'Denial_Percent',
    'NRV_Gap_Percent', 'Remaining_Charges_Percent', 'Revenue_Variance_Pct',
    'Expected_vs_Benchmark_Payment_Variance_%', 'Benchmark_Payment_Weighting_Diff_%'
]
agg_out = format_pct_columns(agg, pct_cols)

# Pretty-print Benchmark_Keys for CSV readability
if "Benchmark_Keys" in agg_out.columns:
    agg_out["Benchmark_Keys"] = agg_out["Benchmark_Keys"].apply(lambda x: str(x) if isinstance(x, list) else x)

# =============================
# Step 8: Export
# =============================
agg_out.to_csv(AGG_CSV, index=False)
with zipfile.ZipFile(AGG_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(AGG_CSV, arcname=os.path.basename(AGG_CSV))

print(f"✅ Aggregated weekly payer/E/M export (with weighting diagnostics): {AGG_ZIP}")
