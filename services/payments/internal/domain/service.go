package domain

import (
	"fmt"
	"strings"

	"github.com/catalinalabs/meriplaza/libs/money"
)

// ValidateCreate checks a create request and returns a normalized amount error
// if the amount is not a well-formed positive value.
func ValidateCreate(amount Amount, method Method, merchantID string) error {
	if merchantID == "" {
		return fmt.Errorf("merchantId is required")
	}
	if !knownMethod(method) {
		return fmt.Errorf("unknown method %q", method)
	}
	if strings.TrimSpace(amount.Currency) == "" {
		return fmt.Errorf("amount.currency is required")
	}
	m, err := money.Parse(amount.Value, amount.Currency)
	if err != nil {
		return fmt.Errorf("amount invalid: %w", err)
	}
	if m.Sign() <= 0 {
		return fmt.Errorf("amount must be positive")
	}
	return nil
}

func knownMethod(m Method) bool {
	switch m {
	case MethodPagoMovil, MethodTransferencia, MethodDivisasCash,
		MethodPuntoDeVenta, MethodCardIntl, MethodCrypto:
		return true
	}
	return false
}
