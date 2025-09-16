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
df = pd.read_csv(INVOICE_CSV)

# === Step 2: Weekly Aggregation by Benchmark Key ===
weekly = (
    df.groupby(['Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2', 'Benchmark_Key'], dropna=False)
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

# === Step 3: Benchmark Metrics (merge from invoice file) ===
benchmark_cols = [
    'Benchmark_Key',
    'Benchmark_Charge_Amount_invoice_level',
    'Benchmark_Payment_Amount_invoice_level',
    'Benchmark_Zero_Balance_Collection_Rate',
    'Benchmark_Collection_Rate',
    'Benchmark_NRV_Zero_Balance',
    'Benchmark_Payment_per_Visit',
    'Benchmark_Invoice_Count',
    'Fee_Schedule_Expected_Amount_invoice_level',
    'Expected_Amount_85_EM_invoice_level'
]
bm_df = df[benchmark_cols].drop_duplicates(subset=['Benchmark_Key'])
weekly = weekly.merge(bm_df, on='Benchmark_Key', how='left')

# === Step 4: CPT Count Parsing ===
def count_cpts(key):
    try:
        cpts = ast.literal_eval(key.split('|')[-1])
        return len(cpts) if isinstance(cpts, list) else 0
    except:
        return 0
weekly['CPT_Count'] = weekly['Benchmark_Key'].apply(count_cpts)

# === Step 5: Expected Payment & Revenue Variance ===
weekly['Expected_Payment'] = weekly['Expected_Amount_85_EM_invoice_level'] * weekly['Visit_Count']
weekly['Revenue_Variance'] = weekly['Payment_Amount'] - weekly['Expected_Payment']
weekly['Revenue_Variance_Pct'] = np.where(
    weekly['Expected_Payment'] == 0,
    np.nan,
    weekly['Revenue_Variance'] / weekly['Expected_Payment']
)

# === Step 6: Volume & Rate Gaps ===
weekly['Volume_Gap'] = weekly['Group_Size'] - weekly['Benchmark_Invoice_Count']
weekly['Actual_Rate_per_Visit'] = weekly['Payment_Amount'] / weekly['Visit_Count']
weekly['Rate_Variance'] = weekly['Actual_Rate_per_Visit'] - weekly['Expected_Amount_85_EM_invoice_level']

# === Step 7: Coding Drift ===
historical_avg_cpt = (
    weekly.groupby('Benchmark_Key')['CPT_Count'].mean().rename('Avg_CPT_Count_Historical').reset_index()
)
weekly = weekly.merge(historical_avg_cpt, on='Benchmark_Key', how='left')
weekly['Potential_Coding_Issue'] = weekly['CPT_Count'] < weekly['Avg_CPT_Count_Historical']

# === Step 8: Format Percent Columns ===
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

# === Step 9: Export Output ===
weekly.to_csv(OUTPUT_CSV, index=False)
with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(OUTPUT_CSV, arcname=os.path.basename(OUTPUT_CSV))

print(f"\u2705 Output zipped to: {OUTPUT_ZIP}")
