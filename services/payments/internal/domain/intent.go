// Package domain defines the Meriplaza payment gateway core model.
//
// The gateway is built from scratch (no Stripe dependency) but borrows Stripe's
// proven shape: a PaymentIntent represents the lifecycle of collecting a single
// amount, regardless of method. Methods range from first-class Venezuelan rails
// (pago móvil, transferencia, divisas en efectivo) to international cards
// (US/Panama) and crypto.
package domain

import "time"

// Method is a payment rail.
type Method string

const (
	// Local Venezuelan methods (first-class).
	MethodPagoMovil     Method = "pago_movil"     // C2P / mobile payment between VE banks
	MethodTransferencia Method = "transferencia"  // domestic bank transfer (Bs)
	MethodDivisasCash   Method = "divisas_cash"   // USD/EUR cash in person
	MethodPuntoDeVenta  Method = "punto_de_venta" // local debit/credit POS terminal

	// International.
	MethodCardIntl Method = "card_intl" // US / Panama issued cards

	// Crypto.
	MethodCrypto Method = "crypto" // USDT/USDC/BTC etc.
)

// Status follows the intent lifecycle.
type Status string

const (
	StatusRequiresConfirmation Status = "requires_confirmation"
	StatusRequiresAction       Status = "requires_action" // e.g. awaiting C2P OTP or on-chain confirmations
	StatusProcessing           Status = "processing"
	StatusSucceeded            Status = "succeeded"
	StatusCanceled             Status = "canceled"
	StatusFailed               Status = "failed"
)

// Amount mirrors libs/money on the wire: decimal string + ISO-4217 / crypto code.
type Amount struct {
	Value    string `json:"value"`
	Currency string `json:"currency"`
}

// PaymentIntent is the central object collecting one payment.
type PaymentIntent struct {
	ID             string         `json:"id"`
	Amount         Amount         `json:"amount"`
	Method         Method         `json:"method"`
	Status         Status         `json:"status"`
	MerchantID     string         `json:"merchantId"`
	OrderRef       string         `json:"orderRef,omitempty"`
	Description    string         `json:"description,omitempty"`
	IdempotencyKey string         `json:"-"`
	MethodData     map[string]any `json:"methodData,omitempty"`
	NextAction     *NextAction    `json:"nextAction,omitempty"`
	FailureReason  string         `json:"failureReason,omitempty"`
	// Settlement records what actually moved, possibly in a different currency
	// (e.g. divisas paid against a Bs-denominated order at the BCV rate).
	Settlement *Settlement `json:"settlement,omitempty"`
	CreatedAt  time.Time   `json:"createdAt"`
	UpdatedAt  time.Time   `json:"updatedAt"`
}

// NextAction tells the client what is required to advance a requires_action
// intent (display a reference, prompt an OTP, show a crypto address, etc.).
type NextAction struct {
	Type string         `json:"type"`
	Data map[string]any `json:"data,omitempty"`
}

// Settlement is the confirmed movement of funds.
type Settlement struct {
	Amount     Amount    `json:"amount"`
	Reference  string    `json:"reference,omitempty"`
	FXRate     string    `json:"fxRate,omitempty"`     // quote per base, when converted
	FXSource   string    `json:"fxSource,omitempty"`   // e.g. BCV
	NetworkTxn string    `json:"networkTxn,omitempty"` // on-chain hash for crypto
	SettledAt  time.Time `json:"settledAt"`
}

// IsTerminal reports whether the intent can no longer change.
func (s Status) IsTerminal() bool {
	return s == StatusSucceeded || s == StatusCanceled || s == StatusFailed
}
