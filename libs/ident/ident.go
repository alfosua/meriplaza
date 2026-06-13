// Package ident handles Venezuelan tax/identity identifiers (RIF and cédula).
//
// Venezuelan identifiers are a prefix letter plus a numeric body:
//
//	V  natural person (Venezuelan cédula)
//	E  foreign resident (cédula de extranjero)
//	J  juridical person (company RIF)
//	G  government entity
//	P  passport
//	C  (legacy comunal / special)
//
// RIF-type identifiers (V, E, J, G) carry a trailing check digit computed with
// a weighted modulo-11 algorithm. This package normalizes, validates, and
// formats identifiers for use across fiscal, payments and catalog services.
package ident

import (
	"fmt"
	"strings"
)

// Prefix is the identifier type letter.
type Prefix string

const (
	Natural    Prefix = "V"
	Foreign    Prefix = "E"
	Juridical  Prefix = "J"
	Government Prefix = "G"
	Passport   Prefix = "P"
	Comunal    Prefix = "C"
)

var validPrefixes = map[Prefix]bool{
	Natural: true, Foreign: true, Juridical: true,
	Government: true, Passport: true, Comunal: true,
}

// hasCheckDigit reports whether a prefix uses the modulo-11 RIF check digit.
// Only juridical (J) and government (G) RIFs carry one; V/E cédulas do not.
func (p Prefix) hasCheckDigit() bool {
	switch p {
	case Juridical, Government:
		return true
	default:
		return false
	}
}

// ID is a parsed, validated Venezuelan identifier.
type ID struct {
	Prefix     Prefix
	Number     string // numeric body, no check digit
	CheckDigit string // single digit, empty if the prefix has none
}

// Parse normalizes and validates an identifier string such as "J-09512461-4",
// "V28476588" or "j 09512461 4". For RIF-type prefixes the check digit is
// verified; if the input omits it, it is computed and filled in.
func Parse(s string) (ID, error) {
	cleaned := strings.Map(func(r rune) rune {
		switch r {
		case '-', ' ', '.':
			return -1
		}
		return r
	}, strings.ToUpper(strings.TrimSpace(s)))

	if cleaned == "" {
		return ID{}, fmt.Errorf("ident: empty identifier")
	}
	prefix := Prefix(cleaned[:1])
	if !validPrefixes[prefix] {
		return ID{}, fmt.Errorf("ident: unknown prefix %q", cleaned[:1])
	}
	body := cleaned[1:]
	if body == "" {
		return ID{}, fmt.Errorf("ident: missing number")
	}

	// Passport bodies are alphanumeric and have no check digit.
	if prefix == Passport || prefix == Comunal {
		return ID{Prefix: prefix, Number: body}, nil
	}

	if !isDigits(body) {
		return ID{}, fmt.Errorf("ident: non-numeric body %q", body)
	}

	if !prefix.hasCheckDigit() {
		return ID{Prefix: prefix, Number: body}, nil
	}

	// Determine number vs. supplied check digit. RIF numbers are typically 8
	// digits + 1 check digit. If the body is 9 digits we treat the last as a
	// supplied check digit and verify it; otherwise we compute one.
	var number, supplied string
	if len(body) == 9 {
		number, supplied = body[:8], body[8:]
	} else {
		number = body
	}
	if len(number) < 5 || len(number) > 9 {
		return ID{}, fmt.Errorf("ident: number length out of range: %q", number)
	}

	want := checkDigit(prefix, number)
	if supplied != "" && supplied != want {
		return ID{}, fmt.Errorf("ident: invalid check digit for %s%s: got %s want %s", prefix, number, supplied, want)
	}
	return ID{Prefix: prefix, Number: number, CheckDigit: want}, nil
}

// MustParse is like Parse but panics on error.
func MustParse(s string) ID {
	id, err := Parse(s)
	if err != nil {
		panic(err)
	}
	return id
}

// String returns the canonical display form, e.g. "J-09512461-4" or
// "V-28476588".
func (id ID) String() string {
	if id.CheckDigit == "" {
		return fmt.Sprintf("%s-%s", id.Prefix, id.Number)
	}
	return fmt.Sprintf("%s-%s-%s", id.Prefix, id.Number, id.CheckDigit)
}

// checkDigit computes the SENIAT modulo-11 RIF check digit. The prefix letter
// contributes a seed weight, then each digit is weighted by the descending
// sequence 4,3,2,7,6,5,4,3,2 (cycled).
func checkDigit(prefix Prefix, number string) string {
	prefixSeed := map[Prefix]int{Natural: 1, Foreign: 2, Juridical: 3, Government: 4}
	weights := []int{3, 2, 7, 6, 5, 4, 3, 2}

	// Left-pad number to 8 digits.
	n := number
	for len(n) < 8 {
		n = "0" + n
	}

	sum := prefixSeed[prefix] * 4
	for i := 0; i < len(n); i++ {
		sum += int(n[i]-'0') * weights[i]
	}
	r := sum % 11
	d := 11 - r
	if d == 11 {
		d = 0
	} else if d == 10 {
		d = 0
	}
	return fmt.Sprintf("%d", d)
}

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
