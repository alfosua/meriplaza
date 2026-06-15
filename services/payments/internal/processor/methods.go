package processor

import (
	"fmt"
	"strings"
	"time"

	"github.com/catalinalabs/meriplaza/libs/money"
	"github.com/catalinalabs/meriplaza/services/payments/internal/domain"
)

// requireFields checks that the intent's MethodData carries the given keys.
func requireFields(d map[string]any, keys ...string) error {
	var missing []string
	for _, k := range keys {
		v, ok := d[k]
		if !ok || asString(v) == "" {
			missing = append(missing, k)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("missing methodData fields: %s", strings.Join(missing, ", "))
	}
	return nil
}

func asString(v any) string {
	s, _ := v.(string)
	return strings.TrimSpace(s)
}

// PagoMovil settles Venezuelan C2P mobile payments. Confirmation requires the
// payer's phone, bank code and cédula; the rail then needs an OTP (modeled as a
// requires_action step) before it succeeds.
type PagoMovil struct{}

func (PagoMovil) Method() domain.Method { return domain.MethodPagoMovil }

func (PagoMovil) Confirm(in domain.PaymentIntent) (Result, error) {
	if err := requireFields(in.MethodData, "payerPhone", "payerBankCode", "payerId"); err != nil {
		return Result{Status: domain.StatusFailed, Failure: err.Error()}, nil
	}
	otp := asString(in.MethodData["otp"])
	if otp == "" {
		// First confirm: ask the client to collect the OTP the bank sent.
		return Result{
			Status: domain.StatusRequiresAction,
			NextAction: &domain.NextAction{
				Type: "pago_movil_otp",
				Data: map[string]any{"message": "Ingrese el código (OTP) enviado por su banco"},
			},
		}, nil
	}
	if len(otp) < 4 {
		return Result{Status: domain.StatusFailed, Failure: "invalid OTP"}, nil
	}
	ref := "PM-" + in.ID
	return Result{
		Status: domain.StatusSucceeded,
		Settlement: &domain.Settlement{
			Amount:    in.Amount,
			Reference: ref,
			SettledAt: time.Now(),
		},
	}, nil
}

// Transferencia settles a domestic bolívar bank transfer. The merchant confirms
// receipt by supplying the bank reference; until then it stays requires_action.
type Transferencia struct{}

func (Transferencia) Method() domain.Method { return domain.MethodTransferencia }

func (Transferencia) Confirm(in domain.PaymentIntent) (Result, error) {
	ref := asString(in.MethodData["bankReference"])
	if ref == "" {
		return Result{
			Status: domain.StatusRequiresAction,
			NextAction: &domain.NextAction{
				Type: "await_bank_reference",
				Data: map[string]any{"message": "Confirme la transferencia con el número de referencia bancaria"},
			},
		}, nil
	}
	return Result{
		Status:     domain.StatusSucceeded,
		Settlement: &domain.Settlement{Amount: in.Amount, Reference: ref, SettledAt: time.Now()},
	}, nil
}

// DivisasCash settles foreign-currency cash (USD/EUR) against a possibly
// bolívar-denominated order. When the order currency differs from the cash
// currency, an FX rate (BCV) must be supplied and the settlement records both.
type DivisasCash struct{}

func (DivisasCash) Method() domain.Method { return domain.MethodDivisasCash }

func (DivisasCash) Confirm(in domain.PaymentIntent) (Result, error) {
	cashCur := strings.ToUpper(asString(in.MethodData["cashCurrency"]))
	if cashCur == "" {
		return Result{Status: domain.StatusFailed, Failure: "cashCurrency required"}, nil
	}
	settle := domain.Settlement{Reference: asString(in.MethodData["receiptRef"]), SettledAt: time.Now()}

	if cashCur == strings.ToUpper(in.Amount.Currency) {
		settle.Amount = in.Amount
		return Result{Status: domain.StatusSucceeded, Settlement: &settle}, nil
	}

	// Cross-currency: convert order amount into the cash currency using the rate.
	rate := asString(in.MethodData["fxRate"])
	if rate == "" {
		return Result{Status: domain.StatusFailed, Failure: "fxRate required for cross-currency divisas"}, nil
	}
	order, err := money.Parse(in.Amount.Value, in.Amount.Currency)
	if err != nil {
		return Result{Status: domain.StatusFailed, Failure: "invalid amount: " + err.Error()}, nil
	}
	cash, err := convertByRate(order, rate, cashCur)
	if err != nil {
		return Result{Status: domain.StatusFailed, Failure: err.Error()}, nil
	}
	settle.Amount = domain.Amount{Value: cash.Format(2), Currency: cashCur}
	settle.FXRate = rate
	settle.FXSource = firstNonEmpty(asString(in.MethodData["fxSource"]), "BCV")
	return Result{Status: domain.StatusSucceeded, Settlement: &settle}, nil
}

// PuntoDeVenta settles a local debit/credit card swipe on a POS terminal. The
// terminal returns an approval reference which the merchant relays here.
type PuntoDeVenta struct{}

func (PuntoDeVenta) Method() domain.Method { return domain.MethodPuntoDeVenta }

func (PuntoDeVenta) Confirm(in domain.PaymentIntent) (Result, error) {
	ref := asString(in.MethodData["approvalRef"])
	if ref == "" {
		return Result{Status: domain.StatusFailed, Failure: "approvalRef from POS terminal required"}, nil
	}
	return Result{
		Status:     domain.StatusSucceeded,
		Settlement: &domain.Settlement{Amount: in.Amount, Reference: ref, SettledAt: time.Now()},
	}, nil
}

// CardIntl settles internationally issued cards (US/Panama). It models a
// gateway authorization+capture; the stub approves any card whose token is
// present and not flagged "decline".
type CardIntl struct{}

func (CardIntl) Method() domain.Method { return domain.MethodCardIntl }

func (CardIntl) Confirm(in domain.PaymentIntent) (Result, error) {
	tok := asString(in.MethodData["cardToken"])
	if tok == "" {
		return Result{Status: domain.StatusFailed, Failure: "cardToken required"}, nil
	}
	if strings.Contains(strings.ToLower(tok), "decline") {
		return Result{Status: domain.StatusFailed, Failure: "card declined"}, nil
	}
	return Result{
		Status:     domain.StatusSucceeded,
		Settlement: &domain.Settlement{Amount: in.Amount, Reference: "AUTH-" + in.ID, SettledAt: time.Now()},
	}, nil
}

// Crypto settles stablecoin/crypto payments. It hands the client a deposit
// address (requires_action) and, once a network txn hash is supplied, treats it
// as confirmed.
type Crypto struct{}

func (Crypto) Method() domain.Method { return domain.MethodCrypto }

func (Crypto) Confirm(in domain.PaymentIntent) (Result, error) {
	asset := strings.ToUpper(firstNonEmpty(asString(in.MethodData["asset"]), "USDT"))
	txn := asString(in.MethodData["networkTxn"])
	if txn == "" {
		return Result{
			Status: domain.StatusRequiresAction,
			NextAction: &domain.NextAction{
				Type: "crypto_deposit",
				Data: map[string]any{
					"asset":   asset,
					"network": firstNonEmpty(asString(in.MethodData["network"]), "TRON"),
					"address": "deposit-" + in.ID,
				},
			},
		}, nil
	}
	return Result{
		Status: domain.StatusSucceeded,
		Settlement: &domain.Settlement{
			Amount:     in.Amount,
			NetworkTxn: txn,
			SettledAt:  time.Now(),
		},
	}, nil
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
