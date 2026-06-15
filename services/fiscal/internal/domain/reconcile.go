package domain

import (
	"fmt"
	"math/big"
	"strings"

	"github.com/catalinalabs/meriplaza/libs/ident"
	"github.com/catalinalabs/meriplaza/libs/money"
)

// ValidationError aggregates all problems found while validating a draft.
type ValidationError struct {
	Problems []string
}

func (e *ValidationError) Error() string {
	return "invoice validation failed: " + strings.Join(e.Problems, "; ")
}

func (e *ValidationError) add(format string, args ...any) {
	e.Problems = append(e.Problems, fmt.Sprintf(format, args...))
}

// Reconcile validates a draft invoice and returns a canonical copy with all
// line totals, the tax summary, and document totals recomputed server-side.
//
// Per the spec, client-supplied totals are never trusted: if the recomputed
// values disagree with what the client sent, the draft is rejected. Monetary
// math is exact (libs/money), and percentages use big.Rat to avoid rounding
// drift before the final per-amount rounding.
func Reconcile(in Invoice) (Invoice, error) {
	ve := &ValidationError{}
	out := in
	out.SchemaVersion = SchemaVersion

	cur := strings.ToUpper(in.Document.Currency)
	if len(cur) != 3 {
		ve.add("document.currency must be ISO-4217, got %q", in.Document.Currency)
		return Invoice{}, ve
	}
	if len(in.Items) == 0 {
		ve.add("at least one line item is required")
		return Invoice{}, ve
	}

	validateParty(ve, "issuer", in.Issuer, true)
	validateParty(ve, "customer", in.Customer, false)

	// Recompute each line and accumulate per-tax-category buckets.
	type bucket struct {
		cat     TaxCategory
		taxable money.Money
		tax     money.Money
	}
	buckets := map[string]*bucket{}
	var order []string

	subtotal := money.Zero(cur)
	discountTotal := money.Zero(cur)
	taxTotal := money.Zero(cur)

	recomputed := make([]Item, len(in.Items))
	for i, it := range in.Items {
		line := fmt.Sprintf("items[%d]", i)
		recomputed[i] = it
		recomputed[i].LineNumber = i + 1

		qty, err := parseDecimalRat(it.Quantity)
		if err != nil {
			ve.add("%s.quantity invalid: %v", line, err)
			continue
		}
		unit, err := money.Parse(it.UnitPrice.Amount, firstNonEmpty(it.UnitPrice.Currency, cur))
		if err != nil {
			ve.add("%s.unitPrice invalid: %v", line, err)
			continue
		}

		// gross = qty * unitPrice, computed in rationals then rounded to money.
		gross := ratMulMoney(qty, unit, cur)

		lineDiscount := money.Zero(cur)
		for di, d := range it.Discounts {
			da, err := money.Parse(d.Amount.Amount, firstNonEmpty(d.Amount.Currency, cur))
			if err != nil {
				ve.add("%s.discounts[%d] invalid: %v", line, di, err)
				continue
			}
			lineDiscount, _ = lineDiscount.Add(da)
		}

		taxable, _ := gross.Sub(lineDiscount)
		rate, err := parseDecimalRat(it.TaxCategory.Rate)
		if err != nil {
			ve.add("%s.taxCategory.rate invalid: %v", line, err)
			continue
		}
		// tax = taxable * rate/100
		lineTax := ratPercentMoney(taxable, rate, cur)
		lineTotal, _ := taxable.Add(lineTax)

		// Overwrite with canonical computed values.
		recomputed[i].LineSubtotal = toMoney(taxable)
		recomputed[i].LineTax = toMoney(lineTax)
		recomputed[i].LineTotal = toMoney(lineTotal)

		// Cross-check any client-supplied values.
		checkMoney(ve, line+".lineSubtotal", it.LineSubtotal, taxable)
		checkMoney(ve, line+".lineTax", it.LineTax, lineTax)
		checkMoney(ve, line+".lineTotal", it.LineTotal, lineTotal)

		subtotal, _ = subtotal.Add(gross)
		discountTotal, _ = discountTotal.Add(lineDiscount)
		taxTotal, _ = taxTotal.Add(lineTax)

		key := it.TaxCategory.Code + "|" + it.TaxCategory.Rate
		b := buckets[key]
		if b == nil {
			b = &bucket{cat: it.TaxCategory, taxable: money.Zero(cur), tax: money.Zero(cur)}
			buckets[key] = b
			order = append(order, key)
		}
		b.taxable, _ = b.taxable.Add(taxable)
		b.tax, _ = b.tax.Add(lineTax)
	}
	out.Items = recomputed

	// Build the tax summary from buckets in first-seen order.
	summary := make([]TaxSummaryLine, 0, len(order))
	for _, k := range order {
		b := buckets[k]
		summary = append(summary, TaxSummaryLine{
			TaxCategory:   b.cat,
			TaxableAmount: toMoney(b.taxable),
			TaxAmount:     toMoney(b.tax),
		})
	}
	out.TaxSummary = summary

	grand, _ := subtotal.Sub(discountTotal)
	grand, _ = grand.Add(taxTotal)

	out.Totals = Totals{
		Subtotal:      toMoney(subtotal),
		DiscountTotal: toMoney(discountTotal),
		TaxTotal:      toMoney(taxTotal),
		GrandTotal:    toMoney(grand),
		AmountPayable: toMoney(grand),
		ItemCount:     len(in.Items),
	}

	// Validate payments reconcile to the grand total (in invoice currency).
	if len(in.Payments) == 0 {
		ve.add("at least one payment is required")
	} else {
		paid := money.Zero(cur)
		for i, p := range in.Payments {
			pc := strings.ToUpper(firstNonEmpty(p.Currency, cur))
			if pc != cur {
				// Foreign-currency leg: must be backed by a FX rate to convert.
				conv, err := convertPayment(in.ForeignExchange, p, cur)
				if err != nil {
					ve.add("payments[%d]: %v", i, err)
					continue
				}
				paid, _ = paid.Add(conv)
				continue
			}
			amt, err := money.Parse(p.Amount.Amount, cur)
			if err != nil {
				ve.add("payments[%d].amount invalid: %v", i, err)
				continue
			}
			paid, _ = paid.Add(amt)
		}
		if !paid.Equal(grand) {
			ve.add("payments total %s does not reconcile with grand total %s", paid, grand)
		}
	}

	if len(ve.Problems) > 0 {
		return Invoice{}, ve
	}
	return out, nil
}

func validateParty(ve *ValidationError, role string, p Party, isIssuer bool) {
	switch p.PersonType {
	case "natural_person":
		if p.NaturalPerson == nil {
			ve.add("%s.naturalPerson required for natural_person", role)
		}
	case "company":
		if p.Company == nil || p.Company.RazonSocial == "" {
			ve.add("%s.company.razonSocial required for company", role)
		}
	case "final_consumer":
		if isIssuer {
			ve.add("issuer cannot be final_consumer")
		}
	default:
		ve.add("%s.personType invalid: %q", role, p.PersonType)
	}
	if p.Identifier != nil && p.Identifier.Value != "" {
		if _, err := ident.Parse(p.Identifier.Value); err != nil {
			ve.add("%s.identifier invalid: %v", role, err)
		}
	} else if isIssuer {
		ve.add("issuer.identifier is required")
	}
}

func convertPayment(fx *ForeignExchange, p Payment, invoiceCur string) (money.Money, error) {
	if fx == nil {
		return money.Money{}, fmt.Errorf("foreign-currency payment %s requires foreignExchange", p.Currency)
	}
	rate, err := parseDecimalRat(fx.Rate)
	if err != nil {
		return money.Money{}, fmt.Errorf("foreignExchange.rate invalid: %v", err)
	}
	amt, err := money.Parse(p.Amount.Amount, strings.ToUpper(p.Currency))
	if err != nil {
		return money.Money{}, fmt.Errorf("amount invalid: %v", err)
	}
	// rate is quoteCurrency per 1 baseCurrency; convert base->quote.
	return ratMulMoney(rate, amt, invoiceCur), nil
}

func checkMoney(ve *ValidationError, field string, supplied Money, want money.Money) {
	if supplied.Amount == "" {
		return // client omitted it; we fill it in
	}
	got, err := money.Parse(supplied.Amount, firstNonEmpty(supplied.Currency, want.Currency()))
	if err != nil {
		ve.add("%s invalid: %v", field, err)
		return
	}
	if !got.Equal(want) {
		ve.add("%s = %s does not reconcile, expected %s", field, got, want)
	}
}

func toMoney(m money.Money) Money {
	return Money{Amount: m.Format(currencyDecimals(m.Currency())), Currency: m.Currency()}
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// parseDecimalRat parses a non-negative decimal string into a big.Rat.
func parseDecimalRat(s string) (*big.Rat, error) {
	s = strings.TrimSpace(s)
	r, ok := new(big.Rat).SetString(s)
	if !ok {
		return nil, fmt.Errorf("invalid decimal %q", s)
	}
	return r, nil
}

// ratMulMoney multiplies a rational by a money amount and rounds half-up to the
// money Scale, returning a money value in cur.
func ratMulMoney(r *big.Rat, m money.Money, cur string) money.Money {
	mr := moneyToRat(m)
	prod := new(big.Rat).Mul(r, mr)
	return ratToMoney(prod, cur)
}

// ratPercentMoney computes m * (rate/100), rounded half-up to Scale.
func ratPercentMoney(m money.Money, rate *big.Rat, cur string) money.Money {
	mr := moneyToRat(m)
	pct := new(big.Rat).Quo(rate, big.NewRat(100, 1))
	prod := new(big.Rat).Mul(mr, pct)
	return ratToMoney(prod, cur)
}

func moneyToRat(m money.Money) *big.Rat {
	r, _ := new(big.Rat).SetString(m.Format(money.Scale))
	return r
}

// currencyDecimals returns the number of fractional digits used when rounding
// computed amounts for a currency's minor unit. Venezuelan fiscal receipts
// round to centimos (2 places); USD and PAB also use 2.
func currencyDecimals(cur string) int {
	switch strings.ToUpper(cur) {
	case "VES", "USD", "PAB", "EUR", "COP":
		return 2
	default:
		return 2
	}
}

// ratToMoney rounds a rational to the currency's minor unit (half-up) and
// builds a money.Money in cur.
func ratToMoney(r *big.Rat, cur string) money.Money {
	decimals := currencyDecimals(cur)
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	scaled := new(big.Rat).Mul(r, new(big.Rat).SetInt(scale))
	// round half-up
	num := scaled.Num()
	den := scaled.Denom()
	q, rem := new(big.Int).QuoRem(num, den, new(big.Int))
	twiceRem := new(big.Int).Abs(new(big.Int).Mul(rem, big.NewInt(2)))
	if twiceRem.Cmp(new(big.Int).Abs(den)) >= 0 {
		if num.Sign() < 0 {
			q.Sub(q, big.NewInt(1))
		} else {
			q.Add(q, big.NewInt(1))
		}
	}
	// q is the amount in 10^-decimals units; format back to a decimal string.
	m, _ := money.Parse(scaledIntToDecimal(q, decimals), cur)
	return m
}

func scaledIntToDecimal(q *big.Int, decimals int) string {
	neg := q.Sign() < 0
	digits := new(big.Int).Abs(q).String()
	if decimals == 0 {
		if neg {
			return "-" + digits
		}
		return digits
	}
	for len(digits) <= decimals {
		digits = "0" + digits
	}
	intPart := digits[:len(digits)-decimals]
	fracPart := digits[len(digits)-decimals:]
	s := intPart + "." + fracPart
	if neg {
		s = "-" + s
	}
	return s
}
