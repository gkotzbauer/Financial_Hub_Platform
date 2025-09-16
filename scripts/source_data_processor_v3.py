import os
import re
import pandas as pd
import numpy as np
import zipfile

# === Step 0: File Paths ===
SOURCE_FILE = "v2 Rev Perf Report with Second Group Layer & CPT.xlsx"
CSV_FILENAME = "Invoice_Assigned_To_Benchmark_With_Count.csv"
CSV_PATH = f"/mnt/data/{CSV_FILENAME}"
ZIP_PATH = f"/mnt/data/Invoice_Assigned_To_Benchmark_With_Count.zip"

if not os.path.isfile(f"/mnt/data/{SOURCE_FILE}"):
    raise FileNotFoundError(f"Error: File not found: {SOURCE_FILE}")

# === Step 1: Metric Rules ===
increase_good = {
    "Visit Count": True,
    "Avg. Charge E/M Weight": True,
    "Charge Amount": True,
    "Charge Billed Balance": False,
    "Zero Balance - Collection * Charges": False,
    "Payment per Visit": True,
    "NRV Zero Balance*": True,
    "Zero Balance Collection Rate": True,
    "Collection Rate*": True,
    "Labs per Visit": True,
    "Payment Amount*": True,
    "Avg. Payment per Visit By Payor": True,
    "Avg. Payments By Payor": True,
    "NRV Gap ($)": False,
    "NRV Gap (%)": False,
    "NRV Gap Sum ($)": True,
    "% of Remaining Charges": False,
    "Radiology Count": True,
    "Denial %": False,
    "Insurance Charge Billed Balance": False,
    "SP Charge Billed Balance": False,
    "AR Over 90": False,
    "Procedure per Visit": True,
    "Expected Amount (85% E/M)": True,
    "Fee Schedule Expected Amount": True,
    "Charge Per Visit": True,
    "Open Invoice Count": False
}
feats = list(increase_good)
sum_override = {"Charge Billed Balance", "Zero Balance - Collection * Charges"}

# === Step 2: Metric Domains ===
operational_metrics = {
    "Visit Count", "Labs per Visit", "Avg. Charge E/M Weight", "Charge Amount",
    "Payment per Visit", "Procedure per Visit", "Radiology Count", "Charge Per Visit"
}
revenue_cycle_metrics = {
    "Charge Billed Balance", "Zero Balance - Collection * Charges", "NRV Zero Balance*",
    "Zero Balance Collection Rate", "Collection Rate*", "Payment Amount*", "Denial %",
    "NRV Gap ($)", "NRV Gap (%)", "% of Remaining Charges", "NRV Gap Sum ($)",
    "Insurance Charge Billed Balance", "SP Charge Billed Balance", "AR Over 90",
    "Expected Amount (85% E/M)", "Fee Schedule Expected Amount", "Open Invoice Count"
}

# === Step 3: Load & Clean Source Data ===
df = pd.read_excel(f"/mnt/data/{SOURCE_FILE}", sheet_name=0)

# Drop any unnamed columns
df = df.loc[:, ~df.columns.str.contains("^Unnamed")]

# Standardize column names
df = df.rename(columns={
    "Year of Visit Service Date": "Year",
    "ISO Week of Visit Service Date": "Week",
    "Primary Financial Class": "Payer",
    "Chart E/M Code Grouping": "Group_EM",
    "Chart E/M Code Second Layer": "Group_EM2",
    "Charge Invoice Number": "Invoice_Number"
})

# Fill missing metadata columns
df[["Year", "Week", "Payer", "Group_EM", "Group_EM2"]] = (
    df[["Year", "Week", "Payer", "Group_EM", "Group_EM2"]].ffill().astype(str)
)

# Clean up Year and Week formats
df["Year"] = df["Year"].str.replace(".0", "", regex=False)
df["Week"] = df["Week"].str.extract(r"(\d+)", expand=False).astype(float).fillna(0).astype(int)

# === Updated Step: Fill Down Invoice_Number ===
df["Invoice_Number"] = df["Invoice_Number"].ffill()

# === Step 4: Zero-Payment Handling ===
zero_mask = df["Payment Amount*"] == 0
df.loc[zero_mask, [
    "Payment per Visit", "NRV Zero Balance*", "Zero Balance Collection Rate", "Collection Rate*"
]] = 0
df.loc[zero_mask, "Zero Balance - Collection * Charges"] = df.loc[zero_mask, "Charge Billed Balance"]

df["% of Remaining Charges"] = np.where(
    df["Charge Amount"] == 0,
    np.nan,
    df["Charge Billed Balance"] / df["Charge Amount"]
)

# Drop invalid Avg. Charge E/M Weight values
valid_em = {"Existing E/M Code", "New E/M Code"}
df.loc[~df["Group_EM"].isin(valid_em), "Avg. Charge E/M Weight"] = np.nan

# === Step 5: Export CSV and ZIP ===
df.to_csv(CSV_PATH, index=False)

with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(CSV_PATH, arcname=CSV_FILENAME)

print("✅ CSV + ZIP export complete.")
