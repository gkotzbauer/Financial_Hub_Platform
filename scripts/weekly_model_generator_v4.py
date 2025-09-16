import os
import pandas as pd
import numpy as np
import zipfile
import ast

# === Step 0: File Paths ===
INVOICE_CSV = "invoice_level_index.csv"
OUTPUT_CSV = "v2_Rev_Perf_Weekly_Model_Output_Final.csv"
OUTPUT_ZIP = "v2_Rev_Perf_Weekly_Model_Output_Final.zip"

if not os.path.isfile(INVOICE_CSV):
    raise FileNotFoundError(f"Missing required file: {INVOICE_CSV}")

# === Step 1: Load Invoice-Level Data ===
invoice_df = pd.read_csv(INVOICE_CSV)

# === Step 2: Pre-Aggregate at Invoice Level ===
invoice_level_summary = (
    invoice_df
    .groupby([
        'Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2', 'Benchmark_Key', 'Invoice_Number'
    ], dropna=False)
    .agg(
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
        Payment_Amount_Star=('Payment Amount*', 'sum'),
        NRV_Gap_Dollar=('NRV Gap ($)', 'sum'),
        NRV_Gap_Percent=('NRV Gap (%)', 'mean'),
        Remaining_Charges_Percent=('% of Remaining Charges', 'mean'),
        NRV_Gap_Sum_Dollar=('NRV Gap Sum ($)', 'sum'),
        Open_Invoice_Count=('Open Invoice Count', 'sum')
    )
    .reset_index()
)

# === Step 3: Weekly Aggregation by Benchmark_Key ===
weekly = (
    invoice_level_summary
    .groupby([
        'Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2', 'Benchmark_Key'
    ], dropna=False)
    .agg(
        Visit_Count=('Invoice_Number', 'nunique'),
        Group_Size=('Invoice_Number', 'count'),
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
        Payment_Amount_Star=('Payment_Amount_Star', 'sum'),
        NRV_Gap_Dollar=('NRV_Gap_Dollar', 'sum'),
        NRV_Gap_Percent=('NRV_Gap_Percent', 'mean'),
        Remaining_Charges_Percent=('Remaining_Charges_Percent', 'mean'),
        NRV_Gap_Sum_Dollar=('NRV_Gap_Sum_Dollar', 'sum'),
        Open_Invoice_Count=('Open_Invoice_Count', 'sum')
    )
    .reset_index()
)

# === Step 4: Benchmark-Level Metrics ===
benchmark_metrics = (
    invoice_df
    .groupby('Benchmark_Key', dropna=False)
    .agg(
        Benchmark_Charge_Amount=('Charge Amount', 'mean'),
        Benchmark_Payment_Amount=('Payment Amount*', 'mean'),
        Benchmark_Zero_Balance_Collection_Rate=('Zero Balance Collection Rate', 'mean'),
        Benchmark_Collection_Rate=('Collection Rate*', 'mean'),
        Benchmark_NRV_Zero_Balance=('NRV Zero Balance*', 'mean'),
        Benchmark_Payment_per_Visit=('Payment per Visit', 'mean'),
        Benchmark_Invoice_Count=('Invoice_Number', 'nunique'),
        Benchmark_Fee_Schedule_Expected_Amount=('Fee Schedule Expected Amount', 'mean'),
        Benchmark_Expected_Amount_85_EM=('Expected Amount (85% E/M)', 'mean')
    )
    .reset_index()
)

# === Step 5: Merge Benchmark Metrics ===
weekly = weekly.merge(benchmark_metrics, on='Benchmark_Key', how='left')

# === Step 6: CPT Count ===
def count_cpts(key):
    try:
        cpts = ast.literal_eval(key.split('|')[-1])
        return len(cpts) if isinstance(cpts, list) else 0
    except:
        return 0

weekly['CPT_Count'] = weekly['Benchmark_Key'].apply(count_cpts)

# === Step 7: Expected Payment + Variance ===
weekly['Expected_Payment'] = weekly['Benchmark_Expected_Amount_85_EM'] * weekly['Visit_Count']
weekly['Payment_Difference_vs_Expected'] = weekly['Payment_Amount'] - weekly['Expected_Payment']
weekly['Revenue_Variance'] = weekly['Payment_Difference_vs_Expected']
weekly['Revenue_Variance_Pct'] = np.where(
    weekly['Expected_Payment'] == 0,
    np.nan,
    weekly['Revenue_Variance'] / weekly['Expected_Payment']
)

# === Step 8: Volume Gap ===
weekly['Volume_Gap'] = weekly['Group_Size'] - weekly['Benchmark_Invoice_Count']

# === Step 9: Rate Gap ===
weekly['Actual_Rate_per_Visit'] = weekly['Payment_Amount'] / weekly['Visit_Count']
weekly['Rate_Variance'] = weekly['Actual_Rate_per_Visit'] - weekly['Benchmark_Expected_Amount_85_EM']

# === Step 10: Coding Drift ===
historical_avg_cpt_count = (
    weekly.groupby('Benchmark_Key')['CPT_Count']
    .mean()
    .rename('Avg_CPT_Count_Historical')
    .reset_index()
)
weekly = weekly.merge(historical_avg_cpt_count, on='Benchmark_Key', how='left')
weekly['Potential_Coding_Issue'] = weekly['CPT_Count'] < weekly['Avg_CPT_Count_Historical']

# === Step 11: Format Percent Columns ===
rate_cols = [
    'Zero_Balance_Collection_Rate', 'Collection_Rate', 'Denial_Percent',
    'NRV_Gap_Percent', 'Remaining_Charges_Percent',
    'Benchmark_Zero_Balance_Collection_Rate', 'Benchmark_Collection_Rate',
    'Revenue_Variance_Pct'
]
for col in rate_cols:
    if col in weekly.columns:
        weekly[col] = (
            weekly[col].astype(float).fillna(0) * 100
        ).round().astype('Int64').astype(str) + '%'

# === Step 12: Export Output ===
weekly.to_csv(OUTPUT_CSV, index=False)
with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(OUTPUT_CSV, arcname=os.path.basename(OUTPUT_CSV))

print(f"✅ Output zipped to: {OUTPUT_ZIP}")
