package processor

import (
	"fmt"
	"math/big"

	"github.com/catalinalabs/salesfactory/libs/money"
)

// convertByRate converts an amount expressed in its base currency into the
// target currency using a "quote per 1 base" rate. For a Bs order paid in USD
// at the BCV rate (Bs per USD), the rate divides: usd = bs / rate. The rate
// direction is inferred from whether the target is the quote or the base.
//
// To keep behavior unambiguous, the rate here is always interpreted as
// "1 unit of target currency = rate units of the source amount's currency"
// (i.e. the classic Bs/USD quote), so target = amount / rate.
func convertByRate(amount money.Money, rate, target string) (money.Money, error) {
	r, ok := new(big.Rat).SetString(rate)
	if !ok || r.Sign() <= 0 {
		return money.Money{}, fmt.Errorf("invalid fxRate %q", rate)
	}
	amt, ok := new(big.Rat).SetString(amount.Format(money.Scale))
	if !ok {
		return money.Money{}, fmt.Errorf("invalid amount")
	}
	conv := new(big.Rat).Quo(amt, r)
	// Round half-up to 2 places (currency minor unit).
	scaled := new(big.Rat).Mul(conv, big.NewRat(100, 1))
	q := new(big.Int).Quo(scaled.Num(), scaled.Denom())
	rem := new(big.Int).Sub(scaled.Num(), new(big.Int).Mul(q, scaled.Denom()))
	if new(big.Int).Mul(rem, big.NewInt(2)).Cmp(scaled.Denom()) >= 0 {
		q.Add(q, big.NewInt(1))
	}
	cents := q.String()
	for len(cents) <= 2 {
		cents = "0" + cents
	}
	dec := cents[:len(cents)-2] + "." + cents[len(cents)-2:]
	return money.Parse(dec, target)
}
