import os
import pandas as pd
import numpy as np
import zipfile
import ast

# =============================
# Inputs (use your latest granular file)
# =============================
GRANULAR_CSV = "/mnt/data/v2_Rev_Perf_Weekly_Model_Output_Final_granular.csv"

# Outputs
OUT_DIR = "/mnt/data"
BY_KEY_CSV = os.path.join(OUT_DIR, "cpt_rate_drivers_by_key.csv")
BY_PAYER_KEY_CSV = os.path.join(OUT_DIR, "cpt_rate_drivers_by_payer_key.csv")
BY_TIME_CSV = os.path.join(OUT_DIR, "cpt_rate_drivers_time.csv")
ZIP_PATH = os.path.join(OUT_DIR, "cpt_rate_drivers.zip")

# =============================
# Load
# =============================
if not os.path.isfile(GRANULAR_CSV):
    raise FileNotFoundError(f"Missing {GRANULAR_CSV}. Run the pipeline to create the granular file first.")

df = pd.read_csv(GRANULAR_CSV)

# =============================
# Helpers
# =============================
def to_float_safe(x):
    """Convert strings (incl. percents) to float; keep NaN where appropriate."""
    if pd.isna(x):
        return np.nan
    if isinstance(x, (int, float, np.integer, np.floating)):
        return float(x)
    s = str(x).strip().replace(",", "")
    if s.endswith("%"):
        try:
            return float(s[:-1]) / 100.0
        except:
            return np.nan
    try:
        return float(s)
    except:
        return np.nan

# Coerce the numeric columns we need
num_cols = [
    "Visit_Count",
    "Payment_Amount",
    "Expected_Payment",
    "Actual_Rate_per_Visit",
    "Expected_Amount_85_EM_invoice_level",
    "Revenue_Variance",
]
for c in num_cols:
    if c in df.columns:
        df[c] = df[c].apply(to_float_safe)

# If Actual_Rate_per_Visit or Expected_* not present for some reason, rebuild them
if "Actual_Rate_per_Visit" not in df.columns or df["Actual_Rate_per_Visit"].isna().all():
    df["Actual_Rate_per_Visit"] = np.where(df["Visit_Count"] == 0, np.nan, df["Payment_Amount"] / df["Visit_Count"])

if "Expected_Amount_85_EM_invoice_level" not in df.columns or df["Expected_Amount_85_EM_invoice_level"].isna().all():
    # Fallback: derive expected rate from Expected_Payment / visits
    if "Expected_Payment" in df.columns:
        df["Expected_Amount_85_EM_invoice_level"] = np.where(
            df["Visit_Count"] == 0, np.nan, df["Expected_Payment"] / df["Visit_Count"]
        )

# Always rebuild expected payment dollars for safety:
df["Expected_Payment_Recalc"] = df["Expected_Amount_85_EM_invoice_level"] * df["Visit_Count"]
# Rebuild dollar variance vs 85% benchmark
df["Revenue_Variance_Recalc"] = df["Payment_Amount"] - df["Expected_Payment_Recalc"]

# =============================
# CORE: rate and dollar variances vs 85% E/M, with visit-weighting
# =============================
# Rate variance (per visit) at the row level
df["Rate_Diff_vs_85EM"] = df["Actual_Rate_per_Visit"] - df["Expected_Amount_85_EM_invoice_level"]

# -----------------------------
# A) Roll-up by Benchmark_Key
# -----------------------------
# Visit-weighted actual and expected rates:
#   weighted_actual_rate = sum(rate * visits) / sum(visits)
#   weighted_expected_rate = sum(expected_rate * visits) / sum(visits)
group_cols_key = ["Benchmark_Key"]

by_key = (
    df.groupby(group_cols_key, dropna=False)
      .agg(
          Total_Visits=("Visit_Count", "sum"),
          Total_Payment_Amount=("Payment_Amount", "sum"),
          Total_Expected_Payment_vs_85EM=("Expected_Payment_Recalc", "sum"),
          Dollar_Variance_vs_85EM=("Revenue_Variance_Recalc", "sum"),
          # numerators for weighted rates
          _w_actual=("Actual_Rate_per_Visit", lambda s: np.nansum(s * df.loc[s.index, "Visit_Count"])),
          _w_expected=("Expected_Amount_85_EM_invoice_level", lambda s: np.nansum(s * df.loc[s.index, "Visit_Count"]))
      )
      .reset_index()
)

# Avoid divide-by-zero
by_key["Weighted_Actual_Rate_per_Visit"] = np.where(
    by_key["Total_Visits"] == 0, np.nan, by_key["_w_actual"] / by_key["Total_Visits"]
)
by_key["Weighted_Expected_Rate_per_Visit"] = np.where(
    by_key["Total_Visits"] == 0, np.nan, by_key["_w_expected"] / by_key["Total_Visits"]
)
by_key["Rate_Diff_vs_85EM"] = by_key["Weighted_Actual_Rate_per_Visit"] - by_key["Weighted_Expected_Rate_per_Visit"]

# Clean up helper cols
by_key = by_key.drop(columns=["_w_actual", "_w_expected"])

# Rank drivers: most negative dollar variance (underpaid) and most positive (over)
by_key = by_key.sort_values("Dollar_Variance_vs_85EM")  # negative at top = worst underpayment

# -----------------------------
# B) Roll-up by Payer + Benchmark_Key
# -----------------------------
group_cols_payer_key = ["Payer", "Benchmark_Key"]

by_payer_key = (
    df.groupby(group_cols_payer_key, dropna=False)
      .agg(
          Total_Visits=("Visit_Count", "sum"),
          Total_Payment_Amount=("Payment_Amount", "sum"),
          Total_Expected_Payment_vs_85EM=("Expected_Payment_Recalc", "sum"),
          Dollar_Variance_vs_85EM=("Revenue_Variance_Recalc", "sum"),
          _w_actual=("Actual_Rate_per_Visit", lambda s: np.nansum(s * df.loc[s.index, "Visit_Count"])),
          _w_expected=("Expected_Amount_85_EM_invoice_level", lambda s: np.nansum(s * df.loc[s.index, "Visit_Count"]))
      )
      .reset_index()
)

by_payer_key["Weighted_Actual_Rate_per_Visit"] = np.where(
    by_payer_key["Total_Visits"] == 0, np.nan, by_payer_key["_w_actual"] / by_payer_key["Total_Visits"]
)
by_payer_key["Weighted_Expected_Rate_per_Visit"] = np.where(
    by_payer_key["Total_Visits"] == 0, np.nan, by_payer_key["_w_expected"] / by_payer_key["Total_Visits"]
)
by_payer_key["Rate_Diff_vs_85EM"] = by_payer_key["Weighted_Actual_Rate_per_Visit"] - by_payer_key["Weighted_Expected_Rate_per_Visit"]
by_payer_key = by_payer_key.drop(columns=["_w_actual", "_w_expected"]).sort_values("Dollar_Variance_vs_85EM")

# -----------------------------
# C) Time trend (Year–Week–Payer–Group_EM–Group_EM2–Benchmark_Key)
# -----------------------------
group_cols_time = ["Year", "Week", "Payer", "Group_EM", "Group_EM2", "Benchmark_Key"]

by_time = (
    df.groupby(group_cols_time, dropna=False)
      .agg(
          Visit_Count=("Visit_Count", "sum"),
          Payment_Amount=("Payment_Amount", "sum"),
          Expected_Payment_vs_85EM=("Expected_Payment_Recalc", "sum"),
          Dollar_Variance_vs_85EM=("Revenue_Variance_Recalc", "sum")
      )
      .reset_index()
      .sort_values(["Year", "Week", "Payer", "Group_EM", "Group_EM2", "Benchmark_Key"])
)

# =============================
# Save files
# =============================
by_key.to_csv(BY_KEY_CSV, index=False)
by_payer_key.to_csv(BY_PAYER_KEY_CSV, index=False)
by_time.to_csv(BY_TIME_CSV, index=False)

with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
    zf.write(BY_KEY_CSV, arcname=os.path.basename(BY_KEY_CSV))
    zf.write(BY_PAYER_KEY_CSV, arcname=os.path.basename(BY_PAYER_KEY_CSV))
    zf.write(BY_TIME_CSV, arcname=os.path.basename(BY_TIME_CSV))

print("✅ Drivers built:")
print(" -", BY_KEY_CSV)
print(" -", BY_PAYER_KEY_CSV)
print(" -", BY_TIME_CSV)
print("📦 Zip:", ZIP_PATH)
