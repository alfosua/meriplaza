// Package money provides decimal-safe monetary values for Meriplaza.
//
// Money is stored as an integer number of minor units (e.g. cents) plus an
// ISO-4217 currency code. This avoids binary floating-point error, which is a
// hard requirement for fiscal documents (see docs/venezuela-fiscal-invoice-api.md).
//
// API payloads carry amounts as decimal strings ("600.66"); this package parses
// and formats those strings without ever going through float64.
package money

import (
	"errors"
	"fmt"
	"math/big"
	"strings"
)

// Scale is the number of decimal places kept internally. Six places matches the
// invoice schema's money pattern (up to 6 fractional digits).
const Scale = 6

// Money is an immutable decimal amount in a single currency.
type Money struct {
	// units is the amount expressed in 10^-Scale minor units.
	units    *big.Int
	currency string
}

// ErrCurrencyMismatch is returned when two amounts in different currencies are
// combined.
var ErrCurrencyMismatch = errors.New("money: currency mismatch")

// Zero returns a zero amount in the given currency.
func Zero(currency string) Money {
	return Money{units: big.NewInt(0), currency: normCurrency(currency)}
}

// Parse converts a decimal string such as "600.66" into Money. The string may
// carry a leading minus sign and up to Scale fractional digits.
func Parse(amount, currency string) (Money, error) {
	cur := normCurrency(currency)
	if len(cur) != 3 {
		return Money{}, fmt.Errorf("money: invalid currency %q", currency)
	}
	s := strings.TrimSpace(amount)
	if s == "" {
		return Money{}, errors.New("money: empty amount")
	}

	neg := false
	switch s[0] {
	case '-':
		neg = true
		s = s[1:]
	case '+':
		s = s[1:]
	}

	intPart, fracPart, hasFrac := strings.Cut(s, ".")
	if intPart == "" && fracPart == "" {
		return Money{}, fmt.Errorf("money: invalid amount %q", amount)
	}
	if intPart == "" {
		intPart = "0"
	}
	if !isDigits(intPart) || (hasFrac && !isDigits(fracPart)) {
		return Money{}, fmt.Errorf("money: invalid amount %q", amount)
	}
	if len(fracPart) > Scale {
		return Money{}, fmt.Errorf("money: amount %q exceeds %d decimal places", amount, Scale)
	}

	// Right-pad the fractional part to Scale digits.
	fracPadded := fracPart + strings.Repeat("0", Scale-len(fracPart))

	units, ok := new(big.Int).SetString(intPart+fracPadded, 10)
	if !ok {
		return Money{}, fmt.Errorf("money: invalid amount %q", amount)
	}
	if neg {
		units.Neg(units)
	}
	return Money{units: units, currency: cur}, nil
}

// MustParse is like Parse but panics on error; use only for constants/tests.
func MustParse(amount, currency string) Money {
	m, err := Parse(amount, currency)
	if err != nil {
		panic(err)
	}
	return m
}

// Currency returns the ISO-4217 code.
func (m Money) Currency() string {
	if m.currency == "" {
		return ""
	}
	return m.currency
}

// IsZero reports whether the amount is exactly zero.
func (m Money) IsZero() bool { return m.units == nil || m.units.Sign() == 0 }

// Sign returns -1, 0, or +1.
func (m Money) Sign() int {
	if m.units == nil {
		return 0
	}
	return m.units.Sign()
}

// Add returns m+other. Currencies must match.
func (m Money) Add(other Money) (Money, error) {
	if err := m.assertSameCurrency(other); err != nil {
		return Money{}, err
	}
	return Money{units: new(big.Int).Add(m.intOrZero(), other.intOrZero()), currency: m.currency}, nil
}

// Sub returns m-other. Currencies must match.
func (m Money) Sub(other Money) (Money, error) {
	if err := m.assertSameCurrency(other); err != nil {
		return Money{}, err
	}
	return Money{units: new(big.Int).Sub(m.intOrZero(), other.intOrZero()), currency: m.currency}, nil
}

// Equal reports whether two amounts are identical in value and currency.
func (m Money) Equal(other Money) bool {
	return m.currency == other.currency && m.intOrZero().Cmp(other.intOrZero()) == 0
}

// Cmp compares amounts of the same currency, returning -1, 0, or +1.
func (m Money) Cmp(other Money) (int, error) {
	if err := m.assertSameCurrency(other); err != nil {
		return 0, err
	}
	return m.intOrZero().Cmp(other.intOrZero()), nil
}

// String formats the amount as a decimal string with no trailing-zero trimming
// beyond two places (e.g. "600.66", "0.00"). It always shows at least 2 places.
func (m Money) String() string {
	return m.Format(2)
}

// Format renders the amount with the given number of fractional digits (rounded
// half-up). Use 2 for display, Scale for full precision.
func (m Money) Format(places int) string {
	if places < 0 {
		places = 0
	}
	if places > Scale {
		places = Scale
	}
	u := m.intOrZero()
	neg := u.Sign() < 0
	abs := new(big.Int).Abs(u)

	// Round from Scale places down to the requested number of places.
	if places < Scale {
		div := pow10(Scale - places)
		half := new(big.Int).Div(div, big.NewInt(2))
		q, r := new(big.Int).DivMod(abs, div, new(big.Int))
		if r.Cmp(half) >= 0 {
			q.Add(q, big.NewInt(1))
		}
		abs = q
	}

	digits := abs.String()
	if places == 0 {
		s := digits
		if neg && abs.Sign() != 0 {
			s = "-" + s
		}
		return s
	}
	for len(digits) <= places {
		digits = "0" + digits
	}
	intPart := digits[:len(digits)-places]
	fracPart := digits[len(digits)-places:]
	s := intPart + "." + fracPart
	if neg && abs.Sign() != 0 {
		s = "-" + s
	}
	return s
}

func (m Money) assertSameCurrency(other Money) error {
	if m.currency != other.currency {
		return fmt.Errorf("%w: %q vs %q", ErrCurrencyMismatch, m.currency, other.currency)
	}
	return nil
}

func (m Money) intOrZero() *big.Int {
	if m.units == nil {
		return big.NewInt(0)
	}
	return m.units
}

func normCurrency(c string) string { return strings.ToUpper(strings.TrimSpace(c)) }

func isDigits(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

func pow10(n int) *big.Int {
	return new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(n)), nil)
}
