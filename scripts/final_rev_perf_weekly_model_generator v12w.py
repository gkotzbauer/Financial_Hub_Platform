import os
import re
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.impute import SimpleImputer
from sklearn.feature_selection import VarianceThreshold

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
df = pd.read_excel(SOURCE_FILE, sheet_name=0)
df = df.rename(columns={
    "Year of Visit Service Date": "Year",
    "ISO Week of Visit Service Date": "Week",
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
    by_payor.groupby(["Year","Week"]).agg({
        "Avg. Payment per Visit By Payor": agg_funcs["mean"],
        "Avg. Payments By Payor":          agg_funcs["mean"]
    }).reset_index(),
    on=["Year","Week"], how="left"
)
weekly["% of Remaining Charges"] = weekly["Charge Billed Balance"] / weekly["Charge Amount"]

# === Step 6: NRV Gaps ===
weekly["NRV Gap ($)"]     = weekly["NRV Zero Balance*"] - weekly["Payment per Visit"]
weekly["NRV Gap (%)"]     = weekly["NRV Gap ($)"] / weekly["Payment per Visit"] * 100
weekly["NRV Gap Sum ($)"] = weekly["NRV Gap ($)"] * weekly["Visit Count"]
weekly["Above NRV Benchmark"] = (weekly["Payment per Visit"] > weekly["NRV Zero Balance*"]).astype(int)

# === Step 7: Invoice-Level Variation Features ===
inv = pd.read_csv("invoice_with_weekly_summary_joined.csv")
inv_group = (
    inv
    .groupby(["Year","Week","Payer","Group_EM","Group_EM2"])
    .agg(
        Payment_SD              = ("Payment Amount*","std"),
        LowPayment_Rate         = ("Tag_Low_Payment","mean"),
        HighCharge_Rate         = ("Tag_High_Charge","mean"),
        Benchmark_Invoice_Count = ("Benchmark_Invoice_Count","first")
    )
    .reset_index()
)
inv_group["Payment_CV"] = inv_group["Payment_SD"] / inv_group["Benchmark_Charge_Amount"]
weekly = weekly.merge(
    inv_group,
    on=["Year","Week","Payer","Group_EM","Group_EM2"],
    how="left"
)

# === Step 8: Regression Modeling with New Features ===
model_feats = [
    "Visit Count","Labs per Visit","Procedure per Visit","Avg. Charge E/M Weight",
    "Charge Amount","Charge Billed Balance","Zero Balance - Collection * Charges",
    "% of Remaining Charges","Zero Balance Collection Rate","Collection Rate*",
    "Denial %","NRV Zero Balance*","% of Visits w Radiology",
    "Payment_SD","Payment_CV","LowPayment_Rate","HighCharge_Rate"
]
train_mask = weekly["Year"] == "2025"
X_train_raw = weekly.loc[train_mask, model_feats].copy()
# Null out self-pay rows for revenue-cycle metrics
for col in revenue_cycle_metrics:
    if col in X_train_raw.columns:
        mask = (weekly["Year"]=="2025") & (weekly["Payer"].str.upper()=="SELF PAY")
        X_train_raw.loc[mask, col] = np.nan
X_full_raw = weekly[model_feats]
y_train = weekly.loc[train_mask, "Payment Amount*"]

imputer = SimpleImputer(strategy="median")
X_train = pd.DataFrame(imputer.fit_transform(X_train_raw), columns=model_feats)
X_full  = pd.DataFrame(imputer.transform(X_full_raw), columns=model_feats)

selector = VarianceThreshold(threshold=0.0)
X_train = pd.DataFrame(
    selector.fit_transform(X_train),
    columns=[c for c, keep in zip(model_feats, selector.get_support()) if keep]
)
X_full = pd.DataFrame(selector.transform(X_full), columns=X_train.columns)

lr_model = LinearRegression()
lr_model.fit(X_train, y_train)
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

# === Step 10: Operational Diagnostics ===
priority_payers = [
    "BCBS","AETNA","MEDICAID","SELF PAY","UNITED HEALTHCARE",
    "CIGNA","HUMANA","TRICARE","MEDICARE"
]
def prioritized_top6(lst):
    seen = {}
    for pct, txt in lst:
        key = txt.split("from avg")[0].strip()
        payer_prefix = key.split("–")[0].strip().upper()
        prio = priority_payers.index(payer_prefix) if payer_prefix in priority_payers else len(priority_payers)
        if key not in seen or (prio, -pct) < seen[key][0]:
            seen[key] = ((prio, -pct), txt)
    return [v[1] for v in sorted(seen.values(), key=lambda x: x[0])[:6]]

def enforce_visit(lst):
    v = [e for e in lst if "Visit Count" in e[1] and e[0] >= 5]
    if not v:
        return prioritized_top6(lst)
    best = max(v, key=lambda x: x[0])
    rest = [e for e in lst if e[1] != best[1]]
    return [best[1]] + prioritized_top6(rest)[:5]

group_agg = {
    m: (
        agg_funcs["sum"]
        if (m.endswith("Count") or m.endswith("Amount") or m in sum_override)
        else agg_funcs["mean"]
    )
    for m in feats if m in df.columns and m != "% of Remaining Charges"
}
grp = df.groupby(["Year","Week","Payer","Group_EM","Group_EM2"]).agg(group_agg).reset_index()

grp_bench = grp.copy()
for m in revenue_cycle_metrics:
    if m in grp_bench.columns:
        grp_bench.loc[grp_bench["Payer"].str.upper()=="SELF PAY", m] = np.nan
hist_avg = grp_bench.groupby(["Payer","Group_EM","Group_EM2"]).mean(numeric_only=True).reset_index()
gw = grp.merge(hist_avg, on=["Payer","Group_EM","Group_EM2"], suffixes=("","_Avg"))

op_records = []
for (yr, wk), sub in gw.groupby(["Year","Week"]):
    good, bad = [], []
    for _, r in sub.iterrows():
        for m in operational_metrics & set(r.index):
            act, avg = r[m], r[f"{m}_Avg"]
            if pd.isna(act) or pd.isna(avg) or avg == 0:
                continue
            delta = act - avg
            pct = abs(delta / avg) * 100
            txt = f"{r['Payer']} – {r['Group_EM']} {m} {'increased' if delta>0 else 'decreased'} from avg {avg:.2f} to {act:.2f}"
            inc_ok = (delta>0 and increase_good[m]) or (delta<0 and not increase_good[m])
            (good if inc_ok else bad).append((pct, txt))
    op_records.append({
        "Year": yr, "Week": wk,
        "Operational - What Went Well": "; ".join(enforce_visit(good)),
        "Operational - What Can Be Improved": "; ".join(enforce_visit(bad))
    })
op_df = pd.DataFrame(op_records)
weekly = weekly.merge(op_df, on=["Year","Week"], how="left")

# === Step 11: Revenue Cycle Narrative Diagnostics ===
rc_records = []
for (yr, wk), sub in gw.groupby(["Year","Week"]):
    good, bad = [], []
    for _, r in sub.iterrows():
        for m in revenue_cycle_metrics & set(r.index):
            act, avg = r[m], r.get(f"{m}_Avg", np.nan)
            if pd.isna(act) or pd.isna(avg) or avg == 0:
                continue
            delta = act - avg
            pct = abs(delta / avg) * 100
            txt = f"{r['Payer']} – {r['Group_EM']} {m} {'increased' if delta>0 else 'decreased'} from avg {avg:.2f} to {act:.2f}"
            if m == "Zero Balance - Collection * Charges" and avg < 0:
                if act == 0:
                    good.append((pct, txt))
                elif act > 0:
                    bad.append((pct, txt))
                else:
                    inc_ok = (delta>0 and increase_good[m]) or (delta<0 and not increase_good[m])
                    (good if inc_ok else bad).append((pct, txt))
            else:
                inc_ok = (delta>0 and increase_good[m]) or (delta<0 and not increase_good[m])
                (good if inc_ok else bad).append((pct, txt))
    rc_records.append({
        "Year": yr, "Week": wk,
        "Revenue Cycle - What Went Well": "; ".join(prioritized_top6(good)),
        "Revenue Cycle - What Can Be Improved": "; ".join(prioritized_top6(bad))
    })
rc_df = pd.DataFrame(rc_records)
weekly = weekly.merge(rc_df, on=["Year","Week"], how="left")

# === Step 12: Boolean Diagnostic Flags ===
weekly["Over Performed"] = (weekly["Performance Diagnostic"] == "Over Performed").astype(int)
weekly["Under Performed"] = (weekly["Performance Diagnostic"] == "Under Performed").astype(int)
weekly["Average Performance"] = (weekly["Performance Diagnostic"] == "Average Performance").astype(int)
weekly["Volume Without Revenue Lift"] = (
    (weekly["Visit Count"] > weekly["Visit Count"].mean()) &
    (weekly["Over Performed"] == 0)
).astype(int)

# === Step 13: Zero-Balance Collection Narrative (Detailed) ===
zb_grp = df.groupby(["Year","Week","Payer","Group_EM","Group_EM2"]).agg({
    "Zero Balance Collection Rate":"mean","Collection Rate*":"mean"
}).reset_index()
zb_base = zb_grp.groupby(["Payer","Group_EM","Group_EM2"]).agg({
    "Zero Balance Collection Rate":"mean","Collection Rate*":"mean"
}).rename(columns={"Zero Balance Collection Rate":"ZBCR_Baseline","Collection Rate*":"CR_Baseline"}).reset_index()
zb_grp = zb_grp.merge(zb_base, on=["Payer","Group_EM","Group_EM2"], how="left")
def zb_narr(row):
    zb, cr, zb_bl, cr_bl = row["Zero Balance Collection Rate"], row["Collection Rate*"], row["ZBCR_Baseline"], row["CR_Baseline"]
    if pd.isna(zb) or pd.isna(zb_bl) or pd.isna(cr) or pd.isna(cr_bl):
        return "Collection data incomplete"
    if zb < 0.75 * zb_bl:
        return "Below baseline"
    if zb > 1.25 * zb_bl or zb > 1.2 * cr_bl:
        return "Above baseline"
    return "Normal range"
zb_grp["Zero-Balance Narrative Text"] = zb_grp.apply(zb_narr, axis=1)
zb_grp["Zero-Balance Collection Narrative"] = (
    zb_grp["Payer"] + " – " +
    zb_grp["Group_EM"] + " – " +
    zb_grp["Group_EM2"] + " – " +
    zb_grp["Zero-Balance Narrative Text"]
)
narr_summary = (
    zb_grp.groupby(["Year","Week"])["Zero-Balance Collection Narrative"]
    .apply(lambda x: "; ".join(sorted(set(x))))
    .reset_index()
)
weekly = weekly.merge(narr_summary, on=["Year","Week"], how="left")

# === Step 14: Export Validation & Final Export ===
required_cols = [
    "Year","Week","Visit Count","Labs per Visit","Procedure per Visit",
    "Avg. Charge E/M Weight","Charge Amount","Charge Billed Balance",
    "Zero Balance - Collection * Charges","% of Remaining Charges",
    "Zero Balance Collection Rate","Collection Rate*","Denial %",
    "NRV Zero Balance*","% of Visits w Radiology",
    "Avg. Payment per Visit By Payor","Avg. Payments By Payor",
    "Payment Amount*","Expected Payments","Missed Revenue (RF)","% Error (RF)",
    "Performance Diagnostic (RF)","% Error","Performance Diagnostic",
    "Operational - What Went Well","Operational - What Can Be Improved",
    "Revenue Cycle - What Went Well","Revenue Cycle - What Can Be Improved",
    "Over Performed","Under Performed","Average Performance",
    "Volume Without Revenue Lift","Zero-Balance Collection Narrative",
    "NRV Gap ($)","NRV Gap (%)","NRV Gap Sum ($)","Above NRV Benchmark",
    "Payment_SD","Payment_CV","LowPayment_Rate","HighCharge_Rate"
]
missing = [c for c in required_cols if c not in weekly.columns]
if missing:
    raise ValueError(f"Missing cols: {missing}")
out_file = SOURCE_FILE.replace(".xlsx","_LR_Final_NoPayer.xlsx")
weekly[required_cols].to_excel(out_file, index=False)
print(f"✅ Export complete: {out_file}")
