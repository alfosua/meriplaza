package domain

import "testing"

func TestPriceOrder(t *testing.T) {
	seller := Seller{ID: "s_1", Currency: "VES"}
	products := map[string]Product{
		"p_1": {ID: "p_1", Title: "Cafe 500g", Price: "210.00", Currency: "VES", TaxRate: "16.00", Stock: 10, Active: true},
		"p_2": {ID: "p_2", Title: "Pan exento", Price: "50.00", Currency: "VES", TaxRate: "0.00", Stock: 10, Active: true},
	}
	ord, err := PriceOrder(seller, products, []CartItem{
		{ProductID: "p_1", Quantity: 1},
		{ProductID: "p_2", Quantity: 2},
	})
	if err != nil {
		t.Fatal(err)
	}
	// 210.00 net + 100.00 net = 310.00 subtotal; tax = 33.60 + 0 = 33.60.
	if ord.Subtotal != "310.00" {
		t.Errorf("subtotal = %s, want 310.00", ord.Subtotal)
	}
	if ord.TaxTotal != "33.60" {
		t.Errorf("taxTotal = %s, want 33.60", ord.TaxTotal)
	}
	if ord.GrandTotal != "343.60" {
		t.Errorf("grandTotal = %s, want 343.60", ord.GrandTotal)
	}
}

func TestPriceOrderRejectsOverStock(t *testing.T) {
	seller := Seller{ID: "s_1", Currency: "VES"}
	products := map[string]Product{"p_1": {ID: "p_1", Title: "X", Price: "1.00", Currency: "VES", TaxRate: "0.00", Stock: 1, Active: true}}
	if _, err := PriceOrder(seller, products, []CartItem{{ProductID: "p_1", Quantity: 5}}); err == nil {
		t.Fatal("expected insufficient stock error")
	}
}
