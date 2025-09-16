# drill_through_invoice_explainer.py

import pandas as pd

class DrillThroughExplainer:
    """
    Utility for drilling from summary-level metrics to invoice-level data.
    """

    def __init__(self, invoice_index_path: str):
        self.df_inv = pd.read_csv(invoice_index_path)

    def get_invoice_details(self, year: int, week: int, payer: str,
                            group_em: str, group_em2: str) -> pd.DataFrame:
        mask = (
            (self.df_inv['Year'] == year) &
            (self.df_inv['Week'] == week) &
            (self.df_inv['Payer'] == payer) &
            (self.df_inv['Group_EM'] == group_em) &
            (self.df_inv['Group_EM2'] == group_em2)
        )
        return self.df_inv[mask]

    def export_invoice_details(self, year: int, week: int, payer: str,
                               group_em: str, group_em2: str,
                               output_csv: str):
        df_details = self.get_invoice_details(year, week, payer, group_em, group_em2)
        df_details.to_csv(output_csv, index=False)
        print(f"Exported {len(df_details)} invoices to {output_csv}")
