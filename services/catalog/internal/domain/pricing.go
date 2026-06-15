package domain

import (
	"fmt"
	"math/big"
	"strings"

	"github.com/catalinalabsve/meriplaza/libs/money"
)

// CartItem is a buyer's requested line before pricing.
type CartItem struct {
	ProductID string `json:"productId"`
	Quantity  int    `json:"quantity"`
}

// PriceOrder builds a priced Order from cart items against the given products,
// computing per-line VAT and totals exactly (libs/money). Tax math mirrors the
// fiscal service so an order's totals match the invoice it will later produce.
func PriceOrder(seller Seller, products map[string]Product, items []CartItem) (Order, error) {
	if len(items) == 0 {
		return Order{}, fmt.Errorf("cart is empty")
	}
	cur := seller.Currency
	if cur == "" {
		cur = "VES"
	}
	subtotal := money.Zero(cur)
	taxTotal := money.Zero(cur)
	var lines []OrderLine

	for _, ci := range items {
		p, ok := products[ci.ProductID]
		if !ok {
			return Order{}, fmt.Errorf("unknown product %q", ci.ProductID)
		}
		if !p.Active {
			return Order{}, fmt.Errorf("product %q is not available", p.Title)
		}
		if ci.Quantity <= 0 {
			return Order{}, fmt.Errorf("quantity for %q must be positive", p.Title)
		}
		if ci.Quantity > p.Stock {
			return Order{}, fmt.Errorf("insufficient stock for %q (have %d, want %d)", p.Title, p.Stock, ci.Quantity)
		}
		unit, err := money.Parse(p.Price, cur)
		if err != nil {
			return Order{}, fmt.Errorf("product %q has invalid price: %w", p.Title, err)
		}
		lineNet := mul(unit, ci.Quantity, cur)
		lineTax := percent(lineNet, p.TaxRate, cur)
		subtotal, _ = subtotal.Add(lineNet)
		taxTotal, _ = taxTotal.Add(lineTax)

		lines = append(lines, OrderLine{
			ProductID: p.ID, Title: p.Title, Quantity: ci.Quantity,
			UnitPrice: unit.Format(2), TaxRate: p.TaxRate,
		})
	}

	grand, _ := subtotal.Add(taxTotal)
	return Order{
		SellerID:   seller.ID,
		Lines:      lines,
		Currency:   cur,
		Subtotal:   subtotal.Format(2),
		TaxTotal:   taxTotal.Format(2),
		GrandTotal: grand.Format(2),
		Status:     OrderPending,
	}, nil
}

func mul(m money.Money, q int, cur string) money.Money {
	r := new(big.Rat).Mul(toRat(m), new(big.Rat).SetInt64(int64(q)))
	return ratMoney(r, cur)
}

func percent(m money.Money, rate, cur string) money.Money {
	rr, ok := new(big.Rat).SetString(strings.TrimSpace(rate))
	if !ok {
		rr = new(big.Rat)
	}
	pct := new(big.Rat).Quo(rr, big.NewRat(100, 1))
	return ratMoney(new(big.Rat).Mul(toRat(m), pct), cur)
}

func toRat(m money.Money) *big.Rat {
	r, _ := new(big.Rat).SetString(m.Format(money.Scale))
	return r
}

// ratMoney rounds a rational to 2 places half-up into money.
func ratMoney(r *big.Rat, cur string) money.Money {
	scaled := new(big.Rat).Mul(r, big.NewRat(100, 1))
	q := new(big.Int).Quo(scaled.Num(), scaled.Denom())
	rem := new(big.Int).Sub(scaled.Num(), new(big.Int).Mul(q, scaled.Denom()))
	if new(big.Int).Mul(new(big.Int).Abs(rem), big.NewInt(2)).Cmp(new(big.Int).Abs(scaled.Denom())) >= 0 {
		if r.Sign() < 0 {
			q.Sub(q, big.NewInt(1))
		} else {
			q.Add(q, big.NewInt(1))
		}
	}
	cents := new(big.Int).Abs(q).String()
	for len(cents) <= 2 {
		cents = "0" + cents
	}
	dec := cents[:len(cents)-2] + "." + cents[len(cents)-2:]
	if q.Sign() < 0 {
		dec = "-" + dec
	}
	m, _ := money.Parse(dec, cur)
	return m
}
