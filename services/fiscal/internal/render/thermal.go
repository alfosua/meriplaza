// Package render produces printable representations of fiscal invoices.
//
// Thermal renders a plain-text 80mm receipt (the common 42-column thermal
// width). It is deliberately dependency-free and ASCII-biased so it can run on
// constrained POS hardware and degrade gracefully on low-connectivity links.
package render

import (
	"strings"

	"github.com/catalinalabs/salesfactory/services/fiscal/internal/domain"
)

// Width80mm is the typical printable column count for an 80mm thermal head.
const Width80mm = 42

// Thermal renders inv as a fixed-width receipt string for an 80mm printer.
func Thermal(inv domain.Invoice) string {
	w := Width80mm
	var b strings.Builder
	line := func(s string) { b.WriteString(s + "\n") }

	line(center("*** "+inv.FiscalAuthority()+" ***", w))
	line(center(issuerName(inv), w))
	if inv.Issuer.Identifier != nil {
		line(center("RIF: "+inv.Issuer.Identifier.Value, w))
	}
	if inv.Issuer.Address != nil {
		for _, l := range inv.Issuer.Address.Lines {
			line(center(l, w))
		}
	}
	line(rule(w))
	line(center(inv.Document.DisplayName, w))
	if inv.Document.Number != "" {
		line(lr("No:", inv.Document.Number, w))
	}
	if inv.Document.IssuedAt != "" {
		line(lr("Fecha:", inv.Document.IssuedAt, w))
	}
	line(customerLine(inv))
	if inv.POS != nil && (inv.POS.RegisterCode != "" || inv.POS.TransactionCode != "") {
		line(lr("Rg:"+inv.POS.RegisterCode, "Tr:"+inv.POS.TransactionCode, w))
	}
	line(rule(w))

	for _, it := range inv.Items {
		line(trunc(it.Description, w))
		mark := it.TaxCategory.Code
		left := "  " + it.Quantity + " x " + it.UnitPrice.Amount
		right := it.LineTotal.Amount
		if mark != "" {
			right += " " + mark
		}
		line(lr(left, right, w))
	}
	line(rule(w))

	cur := inv.Document.Currency
	line(lr("SUBTOTAL:", inv.Totals.Subtotal.Amount+" "+cur, w))
	if inv.Totals.DiscountTotal.Amount != "" && inv.Totals.DiscountTotal.Amount != "0.00" {
		line(lr("DESCUENTO:", "-"+inv.Totals.DiscountTotal.Amount+" "+cur, w))
	}
	for _, ts := range inv.TaxSummary {
		label := "IVA " + ts.TaxCategory.Rate + "%:"
		line(lr(label, ts.TaxAmount.Amount+" "+cur, w))
	}
	line(lr("TOTAL:", inv.Totals.GrandTotal.Amount+" "+cur, w))
	line(rule(w))

	for _, p := range inv.Payments {
		line(lr(payLabel(p.Method)+":", p.Amount.Amount+" "+p.Currency, w))
	}

	if fx := inv.ForeignExchange; fx != nil {
		line(rule(w))
		if fx.DisplayEquivalent != nil {
			line(lr("Compra en Divisas:", fx.DisplayEquivalent.Amount+" "+fx.DisplayEquivalent.Currency, w))
		}
		line(lr("Tasa "+fx.Source+":", fx.Rate+" Bs.", w))
	}

	if inv.FiscalControl != nil {
		line(rule(w))
		if inv.FiscalControl.FiscalPrinterRegisterNumber != "" {
			line(center(inv.FiscalControl.FiscalPrinterRegisterNumber, w))
		}
		if inv.FiscalControl.Barcode != nil {
			line(center(inv.FiscalControl.Barcode.Value, w))
		}
	}

	if inv.Footer != nil {
		line(rule(w))
		for _, m := range inv.Footer.Messages {
			for _, wl := range wrap(m, w) {
				line(center(wl, w))
			}
		}
	}
	return b.String()
}

func issuerName(inv domain.Invoice) string {
	if inv.Issuer.Company != nil {
		if inv.Issuer.Company.CommercialName != "" {
			return inv.Issuer.Company.CommercialName
		}
		return inv.Issuer.Company.RazonSocial
	}
	if inv.Issuer.NaturalPerson != nil {
		return inv.Issuer.NaturalPerson.DisplayName
	}
	return ""
}

func customerLine(inv domain.Invoice) string {
	c := inv.Customer
	name := ""
	if c.NaturalPerson != nil {
		name = c.NaturalPerson.DisplayName
		if name == "" {
			name = strings.TrimSpace(c.NaturalPerson.FirstName + " " + c.NaturalPerson.FirstLastName)
		}
	} else if c.Company != nil {
		name = c.Company.RazonSocial
	} else {
		name = "CONSUMIDOR FINAL"
	}
	id := ""
	if c.Identifier != nil {
		id = c.Identifier.Value
	}
	return trunc(strings.TrimSpace(id+" "+name), Width80mm)
}

func payLabel(method string) string {
	switch method {
	case "cash":
		return "EFECTIVO"
	case "debit_card":
		return "T. DEBITO"
	case "credit_card":
		return "T. CREDITO"
	case "mobile_payment":
		return "PAGO MOVIL"
	case "bank_transfer":
		return "TRANSFERENCIA"
	case "foreign_currency_cash":
		return "DIVISAS"
	default:
		return strings.ToUpper(method)
	}
}

// --- fixed-width helpers ---

func center(s string, w int) string {
	s = trunc(s, w)
	if len(s) >= w {
		return s
	}
	pad := (w - len(s)) / 2
	return strings.Repeat(" ", pad) + s
}

// lr places left and right strings on one line, right-justified to width w.
func lr(left, right string, w int) string {
	if len(left)+len(right) >= w {
		// Truncate the left side to make room.
		max := w - len(right) - 1
		if max < 0 {
			max = 0
		}
		left = trunc(left, max)
	}
	gap := w - len(left) - len(right)
	if gap < 1 {
		gap = 1
	}
	return left + strings.Repeat(" ", gap) + right
}

func rule(w int) string { return strings.Repeat("-", w) }

func trunc(s string, w int) string {
	if len(s) <= w {
		return s
	}
	return s[:w]
}

func wrap(s string, w int) []string {
	words := strings.Fields(s)
	if len(words) == 0 {
		return []string{""}
	}
	var lines []string
	cur := ""
	for _, word := range words {
		if cur == "" {
			cur = word
		} else if len(cur)+1+len(word) <= w {
			cur += " " + word
		} else {
			lines = append(lines, cur)
			cur = word
		}
	}
	if cur != "" {
		lines = append(lines, cur)
	}
	return lines
}
