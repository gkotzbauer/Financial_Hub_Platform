import os
import re
import pandas as pd
import numpy as np

# === Step 0: File Paths ===
SOURCE_FILE = "v2 Rev Perf Report with Second Group Layer.xlsx"
if not os.path.isfile(SOURCE_FILE):
    raise FileNotFoundError(f"Error: File not found: {SOURCE_FILE}")

# === Step 1: Embedded Metric Rules ===
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
    "Charge Per Visit": True
}
feats = list(increase_good)
sum_override = {"Charge Billed Balance", "Zero Balance - Collection * Charges"}

# === Step 2: Metric Domains ===
operational_metrics = {
    "Visit Count", "Labs per Visit", "Avg. Charge E/M Weight", "Charge Amount",
    "Payment per Visit", "Procedure per Visit", "Procedure per Visit"
}
revenue_cycle_metrics = {
    "Charge Billed Balance", "Zero Balance - Collection * Charges", "NRV Zero Balance*",
    "Zero Balance Collection Rate", "Collection Rate*", "Payment Amount*", "Denial %",
    "NRV Gap ($)", "NRV Gap (%)", "% of Remaining Charges", "NRV Gap Sum ($)","Insurance Charge Billed Balance",
    "SP Charge Billed Balance", "AR Over 90", "Procedure per Visit", "Expected Amount (85% E/M)", "Fee Schedule Expected Amount", "Charge Per Visit"

# === Step 3: Load & Clean Source Data ===
df = pd.read_excel(SOURCE_FILE, sheet_name=0)

df = df.rename(columns={
    "Year of Visit Service Date": "Year",
    "ISO Week of Visit Service Date": "Week",
    "Primary Financial Class": "Payer",
    "Chart E/M Code Grouping": "Group_EM",
    "Chart E/M Code Second Layer": "Group_EM2",
    "Charge Invoice Number": "Invoice_Number"
})

df[["Year", "Week", "Payer", "Group_EM", "Group_EM2"]] = (
    df[["Year", "Week", "Payer", "Group_EM", "Group_EM2"]]
    .ffill().astype(str)
)

df["Year"] = df["Year"].str.replace(".0", "", regex=False)
df["Week"] = (df["Week"]
              .str.extract(r"(\d+)", expand=False)
              .astype(float)
              .fillna(0)
              .astype(int))

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

valid_em = {"Existing E/M Code", "New E/M Code"}
df.loc[~df["Group_EM"].isin(valid_em), "Avg. Charge E/M Weight"] = np.nan

# === Step 5: Export Cleaned Invoice-Level Data ===
invoice_out_excel = "Invoice_Assigned_To_Benchmark_With_Count.xlsx"
invoice_out_csv = "Invoice_Cleaned_Output.csv"

df.to_excel(invoice_out_excel, index=False)
df.to_csv(invoice_out_csv, index=False)
print(f"✅ Exported cleaned invoice data to:\n- {invoice_out_excel}\n- {invoice_out_csv}")

# === Step 6: Weekly Summary & Averages ===
agg_funcs = {"sum": lambda x: x.sum(skipna=True), "mean": lambda x: x.mean(skipna=True)}
sum_agg = {
    m: (
        agg_funcs["sum"]
        if (m.endswith("Count") or m.endswith("Amount") or m in sum_override or m == "Payment Amount*")
        else agg_funcs["mean"]
    )
    for m in feats if m in df.columns and m != "% of Remaining Charges"
}

weekly = df.groupby(["Year", "Week", "Payer", "Group_EM", "Group_EM2"]).agg(sum_agg).reset_index()

# === Step 7: Add Payer-Level Averages ===
filtered = df[df["Group_EM"].isin(valid_em)]
by_payor = (
    filtered.groupby(["Year", "Week", "Payer"])
    .agg({
        "Payment per Visit": agg_funcs["mean"],
        "Payment Amount*": agg_funcs["mean"]
    })
    .reset_index()
    .rename(columns={
        "Payment per Visit": "Avg. Payment per Visit By Payor",
        "Payment Amount*": "Avg. Payments By Payor"
    })
)

weekly = weekly.merge(
    by_payor.groupby(["Year", "Week"]).agg({
        "Avg. Payment per Visit By Payor": agg_funcs["mean"],
        "Avg. Payments By Payor": agg_funcs["mean"]
    }).reset_index(),
    on=["Year", "Week"], how="left"
)

# === Step 8: Add Remaining Fields ===
weekly["% of Remaining Charges"] = weekly["Charge Billed Balance"] / weekly["Charge Amount"]
weekly["NRV Gap ($)"] = weekly["NRV Zero Balance*"] - weekly["Payment per Visit"]
weekly["NRV Gap (%)"] = weekly["NRV Gap ($)"] / weekly["Payment per Visit"] * 100
weekly["NRV Gap Sum ($)"] = weekly["NRV Gap ($)"] * weekly["Visit Count"]
weekly["Above NRV Benchmark"] = (weekly["Payment per Visit"] > weekly["NRV Zero Balance*"]).astype(int)

# === Step 9: Export Weekly Cleaned Data ===
weekly_out = "Weekly_Cleaned_Output.csv"
weekly.to_csv(weekly_out, index=False)
print(f"✅ Exported weekly cleaned data to: {weekly_out}")
