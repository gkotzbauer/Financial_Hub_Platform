import os
import pandas as pd
import numpy as np
import zipfile

# === Step 0: File Paths ===
INVOICE_CSV = "invoice_level_index.csv"
OUTPUT_CSV = "v2_Rev_Perf_Weekly_Model_Output_Final.csv"
OUTPUT_ZIP = "v2_Rev_Perf_Weekly_Model_Output_Final.zip"

if not os.path.isfile(INVOICE_CSV):
    raise FileNotFoundError(f"Missing required file: {INVOICE_CSV}")

# === Step 1: Load Invoice-Level Data ===
invoice_df = pd.read_csv(INVOICE_CSV)

# === Step 1B: Build Benchmark Values Based on Abbreviate_Benchmark_Key ===
abbrev_key = 'Abbreviate_Benchmark_Key'

# CPT-Level Benchmarks by Abbreviate_Benchmark_Key
cpt_benchmarks = (
    invoice_df
    .groupby(abbrev_key, dropna=False)
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

# Invoice-Level Benchmarks by Abbreviate_Benchmark_Key
invoice_sums = (
    invoice_df
    .groupby(['Invoice_Number', abbrev_key], dropna=False)
    .agg(
        Invoice_Total_Charge_Amount=('Charge Amount', 'sum'),
        Invoice_Total_Payment_Amount=('Payment Amount*', 'sum'),
        Invoice_Total_Fee_Schedule_Expected_Amount=('Fee Schedule Expected Amount', 'sum'),
        Invoice_Total_Expected_Amount_85_EM=('Expected Amount (85% E/M)', 'sum')
    )
    .reset_index()
)

invoice_benchmarks = (
    invoice_sums
    .groupby(abbrev_key, dropna=False)
    .agg(
        Benchmark_Charge_Amount_invoice_level=('Invoice_Total_Charge_Amount', 'mean'),
        Benchmark_Payment_Amount_invoice_level=('Invoice_Total_Payment_Amount', 'mean'),
        Fee_Schedule_Expected_Amount_invoice_level=('Invoice_Total_Fee_Schedule_Expected_Amount', 'mean'),
        Expected_Amount_85_EM_invoice_level=('Invoice_Total_Expected_Amount_85_EM', 'mean')
    )
    .reset_index()
)

# Merge benchmarks back to invoice_df
invoice_df = invoice_df.merge(cpt_benchmarks, on=abbrev_key, how='left')
invoice_df = invoice_df.merge(invoice_benchmarks, on=abbrev_key, how='left')

# === Step 2: Group Keys for Weekly Aggregation ===
group_keys = ['Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2']

# === Step 3: Compute Weekly Aggregates ===
weekly = (
    invoice_df
    .groupby(group_keys, dropna=False)
    .agg(
        Abbreviate_Benchmark_Key=('Abbreviate_Benchmark_Key', lambda x: x.mode().iloc[0] if not x.mode().empty else np.nan),
        Visit_Count=('Invoice_Number', 'count'),
        Charge_Amount=('Charge Amount', 'sum'),
        Payment_Amount=('Payment Amount*', 'sum'),
        Avg_Charge_EM_Weight=('Avg. Charge E/M Weight', 'mean'),
        Labs_per_Visit=('Lab per Visit', 'mean'),
        Procedure_per_Visit=('Procedure per Visit', 'mean'),
        Radiology_Count=('Radiology Count', 'mean'),
        Zero_Balance_Collection_Rate=('Zero Balance Collection Rate', 'mean'),
        Collection_Rate=('Collection Rate*', 'mean'),
        Denial_Percent=('Denial %', 'mean'),

        Benchmark_Charge_Amount_within_invoice=('Benchmark_Charge_Amount_within_invoice', 'mean'),
        Benchmark_Payment_Amount_within_invoice=('Benchmark_Payment_Amount_within_invoice', 'mean'),
        Fee_Schedule_Expected_Amount_within_invoice=('Fee_Schedule_Expected_Amount_within_invoice', 'mean'),
        Expected_Amount_85_EM_within_invoice=('Expected_Amount_85_EM_within_invoice', 'mean'),

        Benchmark_Charge_Amount_invoice_level=('Benchmark_Charge_Amount_invoice_level', 'mean'),
        Benchmark_Payment_Amount_invoice_level=('Benchmark_Payment_Amount_invoice_level', 'mean'),
        Fee_Schedule_Expected_Amount_invoice_level=('Fee_Schedule_Expected_Amount_invoice_level', 'mean'),
        Expected_Amount_85_EM_invoice_level=('Expected_Amount_85_EM_invoice_level', 'mean'),

        Benchmark_Zero_Balance_Collection_Rate=('Benchmark_Zero_Balance_Collection_Rate', 'mean'),
        Benchmark_Invoice_Count=('Benchmark_Invoice_Count', 'max'),

        Tag_Low_Payment=('Tag_Low_Payment', 'mean'),
        Tag_Low_ZB_Collection=('Tag_Low_ZB_Collection', 'mean'),
        Tag_High_Charge=('Tag_High_Charge', 'mean'),

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

# === Step 4: Format Rate Columns as Percentages ===
rate_cols = [
    'Zero_Balance_Collection_Rate', 'Collection_Rate', 'Denial_Percent',
    'Benchmark_Zero_Balance_Collection_Rate',
    'Tag_Low_Payment', 'Tag_Low_ZB_Collection', 'Tag_High_Charge',
    'NRV_Gap_Percent', 'Remaining_Charges_Percent'
]

for col in rate_cols:
    if col in weekly.columns:
        weekly[col] = (weekly[col] * 100).round().astype('Int64').astype(str) + '%'

# === Step 5: Export to CSV ===
weekly.to_csv(OUTPUT_CSV, index=False)

# === Step 6: Zip the CSV ===
with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(OUTPUT_CSV, arcname=os.path.basename(OUTPUT_CSV))

print(f"✅ Output zipped to: {OUTPUT_ZIP}")
