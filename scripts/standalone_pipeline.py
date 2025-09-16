#!/usr/bin/env python3
"""
Standalone Revenue Performance Pipeline
Runs the full ETL and modeling process using the Excel source file
"""

import os
import re
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.impute import SimpleImputer
from sklearn.feature_selection import VarianceThreshold

print("🚀 Starting Revenue Performance Pipeline...")

# === Step 0: File Paths ===
SOURCE_FILE = "v2 Rev Perf Report with Second Group Layer.xlsx"
if not os.path.isfile(SOURCE_FILE):
    raise FileNotFoundError(f"Error: File not found: {SOURCE_FILE}")

print(f"📊 Loading data from {SOURCE_FILE}...")

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
    "% of Visits w Radiology": True,
    "Denial %": False,
    "Procedure per Visit": True
}
feats = list(increase_good)
sum_override = {"Charge Billed Balance", "Zero Balance - Collection * Charges"}

# === Step 2: Metric Domains ===
operational_metrics = {
    "Visit Count", "Labs per Visit", "Avg. Charge E/M Weight", "Charge Amount",
    "Payment per Visit", "% of Visits w Radiology", "Procedure per Visit"
}
revenue_cycle_metrics = {
    "Charge Billed Balance", "Zero Balance - Collection * Charges", "NRV Zero Balance*",
    "Zero Balance Collection Rate", "Collection Rate*", "Payment Amount*", "Denial %",
    "NRV Gap ($)", "NRV Gap (%)", "% of Remaining Charges", "NRV Gap Sum ($)"
}

# === Step 3: Load & Clean Source Data ===
print("🔄 Processing source data...")
df = pd.read_excel(SOURCE_FILE, sheet_name=0)
df = df.rename(columns={
    "Year of Visit Service Date": "Year",
    "ISO Week of Visit Service Date": "Week",
    "Primary Financial Class": "Payer",
    "Chart E/M Code Grouping": "Group_EM",
    "Chart E/M Code Second Layer": "Group_EM2"
})

# Handle missing column names (use existing if rename fails)
if "Year" not in df.columns and "Year of Visit Service Date" not in df.columns:
    # Use existing column names
    df = df.rename(columns={
        "Primary Financial Class": "Payer",
        "Chart E/M Code Grouping": "Group_EM",
        "Chart E/M Code Second Layer": "Group_EM2"
    })

df[["Year","Week","Payer","Group_EM","Group_EM2"]] = (
    df[["Year","Week","Payer","Group_EM","Group_EM2"]]
    .ffill().astype(str)
)
df["Year"] = df["Year"].str.replace(".0","",regex=False)
df["Week"] = (df["Week"]
    .str.extract(r"(\d+)", expand=False)
    .astype(float)
    .fillna(0)
    .astype(int)
)

# === Step 4: Zero-Payment Handling ===
print("💰 Processing payment data...")
zero_mask = df["Payment Amount*"] == 0
df.loc[zero_mask, ["Payment per Visit","NRV Zero Balance*","Zero Balance Collection Rate","Collection Rate*"]] = 0
df.loc[zero_mask, "Zero Balance - Collection * Charges"] = df.loc[zero_mask, "Charge Billed Balance"]
df["% of Remaining Charges"] = np.where(
    df["Charge Amount"] == 0,
    np.nan,
    df["Charge Billed Balance"] / df["Charge Amount"]
)

valid_em = {"Existing E/M Code","New E/M Code"}
df.loc[~df["Group_EM"].isin(valid_em), "Avg. Charge E/M Weight"] = np.nan

# === Step 5: Weekly Summary & Averages ===
print("📈 Creating weekly summaries...")
agg_funcs = {"sum": lambda x: x.sum(skipna=True), "mean": lambda x: x.mean(skipna=True)}
sum_agg = {
    m: (
        agg_funcs["sum"]
        if (m.endswith("Count") or m.endswith("Amount") or m in sum_override or m=="Payment Amount*")
        else agg_funcs["mean"]
    )
    for m in feats if m in df.columns and m != "% of Remaining Charges"
}

weekly = df.groupby(["Year","Week","Payer","Group_EM","Group_EM2"]).agg(sum_agg).reset_index()

# Add payer-level payment averages
filtered = df[df["Group_EM"].isin(valid_em)]
by_payor = (
    filtered.groupby(["Year","Week","Payer"])
    .agg({
        "Payment Amount*": "mean",
        "Payment per Visit": "mean"
    })
    .rename(columns={
        "Payment Amount*": "Avg. Payment per Visit By Payor",
        "Payment per Visit": "Avg. Payments By Payor"
    })
    .reset_index()
)
weekly = weekly.merge(by_payor, on=["Year","Week","Payer"], how="left")

# === Step 6: NRV Gaps ===
print("📊 Calculating NRV gaps...")
weekly["NRV Gap ($)"]     = weekly["NRV Zero Balance*"] - weekly["Payment per Visit"]
weekly["NRV Gap (%)"]     = weekly["NRV Gap ($)"] / weekly["Payment per Visit"] * 100
weekly["NRV Gap Sum ($)"] = weekly["NRV Gap ($)"] * weekly["Visit Count"]
weekly["Above NRV Benchmark"] = (weekly["Payment per Visit"] > weekly["NRV Zero Balance*"]).astype(int)

# === Step 7: Simplified Invoice-Level Features ===
print("🔍 Creating invoice-level features...")
# Since we don't have the full invoice drill-through, create simplified features
inv_group = (
    df.groupby(["Year","Week","Payer","Group_EM","Group_EM2"])
    .agg(
        Payment_SD = ("Payment Amount*", "std"),
        Charge_SD = ("Charge Amount", "std"),
        Invoice_Count = ("Charge Invoice Number", "count")
    )
    .reset_index()
)

# Calculate coefficients of variation
inv_group["Payment_CV"] = inv_group["Payment_SD"] / inv_group["Payment_SD"].mean()
inv_group["Charge_CV"] = inv_group["Charge_SD"] / inv_group["Charge_SD"].mean()

# Create simplified tags
inv_group["LowPayment_Rate"] = 0.1  # Placeholder
inv_group["HighCharge_Rate"] = 0.1  # Placeholder

weekly = weekly.merge(inv_group, on=["Year","Week","Payer","Group_EM","Group_EM2"], how="left")

# === Step 8: Regression Modeling ===
print("🤖 Training predictive model...")
model_feats = [
    "Visit Count","Labs per Visit","Procedure per Visit","Avg. Charge E/M Weight",
    "Charge Amount","Charge Billed Balance","Zero Balance - Collection * Charges",
    "% of Remaining Charges","Zero Balance Collection Rate","Collection Rate*",
    "Denial %","NRV Zero Balance*","% of Visits w Radiology",
    "Payment_SD","Payment_CV","LowPayment_Rate","HighCharge_Rate"
]

# Filter to available features
available_feats = [f for f in model_feats if f in weekly.columns]
print(f"Using features: {available_feats}")

train_mask = weekly["Year"] == "2025"
X_train_raw = weekly.loc[train_mask, available_feats].copy()

# Null out self-pay rows for revenue-cycle metrics
for col in revenue_cycle_metrics:
    if col in X_train_raw.columns:
        mask = (weekly["Year"]=="2025") & (weekly["Payer"].str.upper()=="SELF PAY")
        X_train_raw.loc[mask, col] = np.nan

X_full_raw = weekly[available_feats]
y_train = weekly.loc[train_mask, "Payment Amount*"]

# Handle missing values
imputer = SimpleImputer(strategy="median")
X_train = pd.DataFrame(imputer.fit_transform(X_train_raw), columns=available_feats)
X_full  = pd.DataFrame(imputer.transform(X_full_raw), columns=available_feats)

# Feature selection
selector = VarianceThreshold(threshold=0.0)
X_train = pd.DataFrame(
    selector.fit_transform(X_train),
    columns=[c for c, keep in zip(available_feats, selector.get_support()) if keep]
)
X_full = pd.DataFrame(selector.transform(X_full), columns=X_train.columns)

print(f"Final model features: {list(X_train.columns)}")

# Train model
lr_model = LinearRegression()
lr_model.fit(X_train, y_train)

# Make predictions
weekly["Expected Payments"] = lr_model.predict(X_full)
weekly["Missed Revenue (RF)"] = weekly["Payment Amount*"] - weekly["Expected Payments"]
weekly["% Error (RF)"] = weekly["Missed Revenue (RF)"] / weekly["Expected Payments"] * 100

def classify_perf_rf(e):
    if e > 2.5:   return "Over Performed"
    if e < -2.5:  return "Under Performed"
    return "Average Performance"

weekly["Performance Diagnostic (RF)"] = weekly["% Error (RF)"].apply(classify_perf_rf)

# === Step 9: Performance Classification ===
def classify_perf(e):
    if e > 2.5:   return "Over Performed"
    if e < -2.5:  return "Under Performed"
    return "Average Performance"

weekly["% Error"] = weekly["Missed Revenue (RF)"] / weekly["Expected Payments"] * 100
weekly["Performance Diagnostic"] = weekly["% Error"].apply(classify_perf)

# === Step 10: Export Results ===
print("💾 Exporting results...")

# Export weekly summary
weekly.to_csv("weekly_summary_with_layer2.csv", index=False)
print("✅ Weekly summary exported to: weekly_summary_with_layer2.csv")

# Export invoice-level index (simplified)
invoice_index = df[["Year","Week","Payer","Group_EM","Group_EM2","Charge Invoice Number","Charge Amount","Payment Amount*","Zero Balance Collection Rate"]].copy()
invoice_index.to_csv("invoice_level_index.csv", index=False)
print("✅ Invoice index exported to: invoice_level_index.csv")

# Export merged file
merged = invoice_index.merge(
    weekly[["Year","Week","Payer","Group_EM","Group_EM2","Payment Amount*"]],
    on=["Year","Week","Payer","Group_EM","Group_EM2"], 
    how="left", 
    suffixes=('','_Summary')
)
merged.to_csv("invoice_with_weekly_summary_joined.csv", index=False)
print("✅ Merged file exported to: invoice_with_weekly_summary_joined.csv")

# Export final model results
final_output = weekly[["Year","Week","Payer","Group_EM","Group_EM2","Payment Amount*","Expected Payments","Missed Revenue (RF)","% Error (RF)","Performance Diagnostic (RF)"]].copy()
final_output.to_csv("revenue_performance_model_results.csv", index=False)
print("✅ Model results exported to: revenue_performance_model_results.csv")

print("🎉 Pipeline complete! Generated files:")
print("  - weekly_summary_with_layer2.csv")
print("  - invoice_level_index.csv") 
print("  - invoice_with_weekly_summary_joined.csv")
print("  - revenue_performance_model_results.csv") 