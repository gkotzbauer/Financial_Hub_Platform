import os
import pandas as pd
import numpy as np

# === Step 0: Load Input File ===
INFILE = "v2_Rev_Perf_Weekly_Model_Output_Final.xlsx"
if not os.path.isfile(INFILE):
    raise FileNotFoundError(f"Missing required input file: {INFILE}")

df = pd.read_excel(INFILE)

# === Step 1: Expected Payment and Variance ===
df["Expected_Payment"] = df["Benchmark_Payment_Amount"] * df["Visit_Count"]
df["Revenue_Variance"] = df["Payment_Amount"] - df["Expected_Payment"]

# === Step 2: Label Performance ===
def classify_performance(actual, expected):
    if pd.isna(actual) or pd.isna(expected) or expected == 0:
        return "No Data"
    diff_pct = (actual - expected) / expected
    if diff_pct > 0.05:
        return "Over Performing"
    elif diff_pct < -0.05:
        return "Under Performing"
    else:
        return "Average Performance"

df["Performance_Label"] = df.apply(
    lambda row: classify_performance(row["Payment_Amount"], row["Expected_Payment"]),
    axis=1
)

# === Step 3: Percent Variance ===
df["Percent_Variance"] = df["Revenue_Variance"] / df["Expected_Payment"]

# === Step 4: Compute Baseline Averages Per Payer + Group ===
metrics = [
    "Charge Billed Balance", "Zero Balance - Collection * Charges",
    "NRV Zero Balance*", "Zero Balance Collection Rate", "Collection Rate*",
    "Payment Amount*", "Denial %", "NRV Gap ($)", "NRV Gap (%)",
    "% of Remaining Charges", "NRV Gap Sum ($)"
]

baseline_avgs = (
    df.groupby(["Payer", "Group_EM", "Group_EM2"])[metrics]
    .mean(numeric_only=True)
    .add_suffix("_Avg")
    .reset_index()
)

# === Step 5: Merge Baseline Averages into Main Data ===
df = df.merge(baseline_avgs, on=["Payer", "Group_EM", "Group_EM2"], how="left")

# === Step 6: Export Final Diagnostic-Ready File ===
OUTFILE = "v2_Rev_Perf_Weekly_Model_With_Diagnostics_Base.xlsx"
df.to_excel(OUTFILE, index=False)
print(f"✅ Revenue performance model exported to: {OUTFILE}")
