# === final_rev_perf_weekly_model_generator_v12v_updated.py ===
import os
import pandas as pd

# === Step 0: File Paths ===
SOURCE_FILE = "v2 Rev Perf Report with Second Group Layer(1).xlsx"
if not os.path.isfile(SOURCE_FILE):
    raise FileNotFoundError(f"Error: File not found: {SOURCE_FILE}")

# === Step 1: Read & Normalize Data ===
df = pd.read_excel(SOURCE_FILE, sheet_name='Sheet 1')
df = df.rename(columns={
    'Year of Visit Service Date': 'Year',                         # Calendar year of visit
    'ISO Week of Visit Service Date': 'Week',                    # ISO-standard week number
    'Primary Financial Class': 'Payer',                          # Primary insurance class
    'Chart E/M Code Grouping': 'Group_EM',                       # Primary E/M code bucket
    'Chart E/M Code Second Layer': 'Group_EM2'                   # More granular E/M level
})
df['Year'] = df['Year'].astype(int)
df['Week'] = df['Week'].str.replace('W', '').astype(int)

# === Step 2: Aggregate Weekly Summary ===
weekly_summary = (
    df
    .groupby(['Year', 'Week', 'Payer', 'Group_EM', 'Group_EM2'])
    .agg({
        'Charge Amount': 'sum',                     # Total billed charges
        'Payment Amount*': 'sum',                   # Total payments collected
        'Zero Balance Collection Rate': 'mean',     # Avg. zero-balance collection rate
        'NRV Zero Balance*': 'sum',                 # Net Revenue collected from zero balances
        'Visit Count': 'sum'                        # Count of visits
    })
    .reset_index()
)

# === Step 3: Export Weekly Summary ===
weekly_summary.to_csv('weekly_summary_with_layer2.csv', index=False)
print("Weekly summary with second E/M layer exported to weekly_summary_with_layer2.csv")
