# merge_invoice_summary_alignment.py

import pandas as pd

# Load inputs
invoices  = pd.read_csv("invoice_level_index.csv")
summaries = pd.read_csv("weekly_summary_with_layer2.csv")

# Merge on five keys
keys = ['Year','Week','Payer','Group_EM','Group_EM2']
merged = invoices.merge(
    summaries[keys + ['Payment Amount*']],
    on=keys, how='left', suffixes=('','_Summary')
)

# Export final drill-aligned file
merged.to_csv("invoice_with_weekly_summary_joined.csv", index=False)
print("Merged invoice-to-summary output written to invoice_with_weekly_summary_joined.csv")
