package domain

import "testing"

func baseInvoice() Invoice {
	return Invoice{
		Environment: "test",
		Document: Document{
			Type:            "invoice",
			DisplayName:     "FACTURA",
			Currency:        "VES",
			EmissionChannel: "fiscal_machine",
		},
		Issuer: Party{
			PersonType: "company",
			Identifier: &Identifier{Value: "J-09512461-4"},
			Company:    &Company{RazonSocial: "CENTRAL SANTO TOME III, C.A"},
		},
		Customer: Party{
			PersonType:    "natural_person",
			Identifier:    &Identifier{Value: "V-28476588"},
			NaturalPerson: &NaturalPerson{FirstName: "ALFONZO", FirstLastName: "SUAREZ"},
		},
	}
}

func TestReconcileComputesTotals(t *testing.T) {
	inv := baseInvoice()
	inv.Items = []Item{{
		Description: "MARI/PAM/CHOC/100G",
		Quantity:    "2",
		UnitPrice:   Money{Amount: "300.33", Currency: "VES"},
		TaxCategory: TaxCategory{Code: "G", Type: "general", Rate: "16.00"},
	}}
	inv.Payments = []Payment{
		{Method: "cash", Amount: Money{Amount: "696.77", Currency: "VES"}, Currency: "VES"},
	}

	out, err := Reconcile(inv)
	if err != nil {
		t.Fatalf("reconcile: %v", err)
	}
	if got := out.Items[0].LineSubtotal.Amount; got != "600.66" {
		t.Errorf("lineSubtotal = %s, want 600.66", got)
	}
	if got := out.Items[0].LineTax.Amount; got != "96.11" {
		t.Errorf("lineTax = %s, want 96.11", got)
	}
	if got := out.Totals.GrandTotal.Amount; got != "696.77" {
		t.Errorf("grandTotal = %s, want 696.77", got)
	}
	if len(out.TaxSummary) != 1 || out.TaxSummary[0].TaxAmount.Amount != "96.11" {
		t.Errorf("tax summary wrong: %+v", out.TaxSummary)
	}
}

func TestReconcileRejectsBadClientTotal(t *testing.T) {
	inv := baseInvoice()
	inv.Items = []Item{{
		Description: "X",
		Quantity:    "2",
		UnitPrice:   Money{Amount: "300.33", Currency: "VES"},
		TaxCategory: TaxCategory{Code: "G", Type: "general", Rate: "16.00"},
		LineTax:     Money{Amount: "0.01", Currency: "VES"}, // wrong
	}}
	inv.Payments = []Payment{{Method: "cash", Amount: Money{Amount: "696.77", Currency: "VES"}, Currency: "VES"}}
	if _, err := Reconcile(inv); err == nil {
		t.Fatal("expected rejection of bad client lineTax")
	}
}

func TestReconcileRejectsUnbalancedPayments(t *testing.T) {
	inv := baseInvoice()
	inv.Items = []Item{{
		Description: "X", Quantity: "1",
		UnitPrice:   Money{Amount: "100.00", Currency: "VES"},
		TaxCategory: TaxCategory{Code: "G", Type: "general", Rate: "16.00"},
	}}
	inv.Payments = []Payment{{Method: "cash", Amount: Money{Amount: "1.00", Currency: "VES"}, Currency: "VES"}}
	if _, err := Reconcile(inv); err == nil {
		t.Fatal("expected payment reconciliation failure")
	}
}

func TestReconcileForeignCurrencyPayment(t *testing.T) {
	inv := baseInvoice()
	inv.Items = []Item{{
		Description: "X", Quantity: "1",
		UnitPrice:   Money{Amount: "577.55", Currency: "VES"},
		TaxCategory: TaxCategory{Code: "E", Type: "exempt", Rate: "0.00"},
	}}
	inv.ForeignExchange = &ForeignExchange{BaseCurrency: "USD", QuoteCurrency: "VES", Rate: "577.55", Source: "BCV"}
	inv.Payments = []Payment{{Method: "foreign_currency_cash", Amount: Money{Amount: "1.00", Currency: "USD"}, Currency: "USD"}}
	if _, err := Reconcile(inv); err != nil {
		t.Fatalf("expected USD payment to convert and balance: %v", err)
	}
}
