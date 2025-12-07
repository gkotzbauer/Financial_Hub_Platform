import os
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.impute import SimpleImputer
from sklearn.feature_selection import VarianceThreshold

# === Step 0: File Paths ===
INVOICE_CSV = "invoice_level_index.csv"
if not os.path.isfile(INVOICE_CSV):
    raise FileNotFoundError(f"Missing required file: {INVOICE_CSV}")

# === Step 1: Load Invoice-Level Data ===
invoice_df = pd.read_csv(INVOICE_CSV)

# === Step 2: Group Keys for Weekly Aggregation ===
group_keys = ['Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2']

# === Step 3: Compute Weekly Aggregates ===
weekly = (
    invoice_df
    .groupby(group_keys, dropna=False)
    .agg(
        Visit_Count=('Invoice_Number', 'count'),
        Charge_Amount=('Charge Amount', 'sum'),
        Payment_Amount=('Payment Amount*', 'sum'),
        Avg_Charge_EM_Weight=('Avg. Charge E/M Weight', 'mean'),
        Lab_per_Visit=('Lab per Visit (copy)', 'mean'),
        Procedure_per_Visit=('Procedure per Visit', 'mean'),
        Percent_with_Radiology=('% of Visits w Radiology', 'mean'),
        Zero_Balance_Collection_Rate=('Zero Balance Collection Rate', 'mean'),
        Benchmark_Charge_Amount=('Benchmark_Charge_Amount', 'mean'),
        Benchmark_Payment_Amount=('Benchmark_Payment_Amount', 'mean'),
        Benchmark_Zero_Balance_Collection_Rate=('Benchmark_Zero_Balance_Collection_Rate', 'mean'),
        Benchmark_Invoice_Count=('Benchmark_Invoice_Count', 'mean'),
        Tag_Low_Payment=('Tag_Low_Payment', 'mean'),
        Tag_Low_ZB_Collection=('Tag_Low_ZB_Collection', 'mean'),
        Tag_High_Charge=('Tag_High_Charge', 'mean'),
        Charge_Billed_Balance=('Charge Billed Balance', 'sum'),
        Zero_Balance_Collection_Star_Charges=('Zero Balance - Collection * Charges', 'sum'),
        NRV_Zero_Balance=('NRV Zero Balance*', 'sum'),
        Collection_Rate_Star=('Collection Rate*', 'mean'),
        Payment_Amount_Star=('Payment Amount*', 'sum'),
        Denial_Percent=('Denial %', 'mean'),
        NRV_Gap_Dollar=('NRV Gap ($)', 'sum'),
        NRV_Gap_Percent=('NRV Gap (%)', 'mean'),
        Remaining_Charges_Percent=('% of Remaining Charges', 'mean'),
        NRV_Gap_Sum_Dollar=('NRV Gap Sum ($)', 'sum')
    )
    .reset_index()
)

# === Step 3B: Add Low Payment Invoice Counts and Missed Payment Amounts ===
low_payment_stats = (
    invoice_df[invoice_df['Tag_Low_Payment'] == True]
    .assign(
        Missed_Amount=lambda df: df['Benchmark_Payment_Amount'] - df['Payment Amount*']
    )
    .groupby(group_keys)
    .agg(
        number_of_below_payment_invoices=('Invoice_Number', 'count'),
        missed_payments_for_below_payment_invoices=('Missed_Amount', 'sum')
    )
    .reset_index()
)
weekly = weekly.merge(low_payment_stats, on=group_keys, how='left')

# === Step 3C: Add % of Missed Payments Per Week and Payer Review Flag ===
weekly['missed_payments_for_below_payment_invoices'] = weekly['missed_payments_for_below_payment_invoices'].fillna(0)
weekly['number_of_below_payment_invoices'] = weekly['number_of_below_payment_invoices'].fillna(0)

total_missed_by_week = (
    weekly.groupby(['Year', 'Week'])['missed_payments_for_below_payment_invoices']
    .transform('sum')
)

weekly['pct_of_total_missed_payment_in_week'] = np.where(
    total_missed_by_week == 0,
    0,
    weekly['missed_payments_for_below_payment_invoices'] / total_missed_by_week
)

# === Updated Logic: Flag all groups where Tag_Low_Payment is True ===
weekly['flag_group_for_payer_review'] = np.where(
    weekly['Tag_Low_Payment'] == 1,
    1,
    0
)

# === Step 4: Derived Weekly Metrics ===
weekly['Payment_per_Visit'] = weekly['Payment_Amount'] / weekly['Visit_Count']
weekly['Charge_per_Visit'] = weekly['Charge_Amount'] / weekly['Visit_Count']
weekly['Collection_Rate'] = weekly['Payment_Amount'] / weekly['Charge_Amount']

# === Step 5: Payment Consistency (Population SD) ===
weekly['Payment_SD'] = invoice_df.groupby(group_keys)['Payment Amount*'].std(ddof=0).values
weekly['Payment_CV'] = weekly['Payment_SD'] / weekly['Payment_per_Visit']

# === Step 6: Outlier Rates ===
outlier_rates = (
    invoice_df
    .groupby(group_keys)
    .apply(lambda grp: pd.Series({
        'LowPayment_Rate': (grp['Payment Amount*'] < grp['Payment Amount*'].quantile(0.10)).mean(),
        'HighCharge_Rate': (grp['Charge Amount'] > grp['Charge Amount'].quantile(0.90)).mean()
    }))
    .reset_index()
)
weekly = weekly.merge(outlier_rates, on=group_keys, how='left')

# === Step 7: Rename Diagnostic Columns for Compatibility ===
weekly.rename(columns={
    'Charge_Billed_Balance': 'Charge Billed Balance',
    'Zero_Balance_Collection_Star_Charges': 'Zero Balance - Collection * Charges',
    'NRV_Zero_Balance': 'NRV Zero Balance*',
    'Collection_Rate_Star': 'Collection Rate*',
    'Payment_Amount_Star': 'Payment Amount*',
    'Denial_Percent': 'Denial %',
    'NRV_Gap_Dollar': 'NRV Gap ($)',
    'NRV_Gap_Percent': 'NRV Gap (%)',
    'Remaining_Charges_Percent': '% of Remaining Charges',
    'NRV_Gap_Sum_Dollar': 'NRV Gap Sum ($)'
}, inplace=True)

# === Step 8: Export Final Weekly Model Output ===
OUTPUT_XLSX = "v2_Rev_Perf_Weekly_Model_Output_Final.xlsx"
weekly.to_excel(OUTPUT_XLSX, index=False)
print(f"✅ Weekly model output written to: {OUTPUT_XLSX}")
