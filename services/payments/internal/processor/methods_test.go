package processor

import (
	"testing"

	"github.com/catalinalabs/salesfactory/services/payments/internal/domain"
)

func TestPagoMovilRequiresOTPThenSucceeds(t *testing.T) {
	p := PagoMovil{}
	in := domain.PaymentIntent{
		ID:     "pi_1",
		Amount: domain.Amount{Value: "100.00", Currency: "VES"},
		MethodData: map[string]any{
			"payerPhone": "04141234567", "payerBankCode": "0102", "payerId": "V-28476588",
		},
	}
	res, _ := p.Confirm(in)
	if res.Status != domain.StatusRequiresAction {
		t.Fatalf("expected requires_action, got %s", res.Status)
	}
	in.MethodData["otp"] = "123456"
	res, _ = p.Confirm(in)
	if res.Status != domain.StatusSucceeded || res.Settlement == nil {
		t.Fatalf("expected success, got %s", res.Status)
	}
}

func TestDivisasCrossCurrencyConverts(t *testing.T) {
	// 57755 Bs order paid in USD at BCV 577.55 => 100.00 USD.
	in := domain.PaymentIntent{
		ID:     "pi_2",
		Amount: domain.Amount{Value: "57755.00", Currency: "VES"},
		MethodData: map[string]any{
			"cashCurrency": "USD", "fxRate": "577.55", "fxSource": "BCV",
		},
	}
	res, _ := DivisasCash{}.Confirm(in)
	if res.Status != domain.StatusSucceeded {
		t.Fatalf("status = %s, failure = %s", res.Status, res.Failure)
	}
	if got := res.Settlement.Amount.Value; got != "100.00" {
		t.Errorf("converted amount = %s, want 100.00", got)
	}
	if res.Settlement.Amount.Currency != "USD" {
		t.Errorf("currency = %s, want USD", res.Settlement.Amount.Currency)
	}
}

func TestCardDecline(t *testing.T) {
	res, _ := CardIntl{}.Confirm(domain.PaymentIntent{
		MethodData: map[string]any{"cardToken": "tok_decline_visa"},
	})
	if res.Status != domain.StatusFailed {
		t.Errorf("expected failed, got %s", res.Status)
	}
}

func TestCryptoDepositThenConfirm(t *testing.T) {
	in := domain.PaymentIntent{ID: "pi_3", Amount: domain.Amount{Value: "50.00", Currency: "USD"},
		MethodData: map[string]any{"asset": "USDT", "network": "TRON"}}
	res, _ := Crypto{}.Confirm(in)
	if res.Status != domain.StatusRequiresAction || res.NextAction == nil {
		t.Fatalf("expected deposit action, got %s", res.Status)
	}
	in.MethodData["networkTxn"] = "0xabc123"
	res, _ = Crypto{}.Confirm(in)
	if res.Status != domain.StatusSucceeded || res.Settlement.NetworkTxn != "0xabc123" {
		t.Fatalf("expected success with txn, got %s", res.Status)
	}
}
