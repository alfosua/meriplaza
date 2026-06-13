package ident

import "testing"

func TestParseRIFCheckDigit(t *testing.T) {
	id, err := Parse("J-09512461")
	if err != nil {
		t.Fatal(err)
	}
	if id.CheckDigit != "4" {
		t.Errorf("check digit = %q, want 4", id.CheckDigit)
	}
	if id.String() != "J-09512461-4" {
		t.Errorf("String() = %q", id.String())
	}
}

func TestParseVerifiesSuppliedCheckDigit(t *testing.T) {
	if _, err := Parse("J-09512461-4"); err != nil {
		t.Errorf("valid id rejected: %v", err)
	}
	if _, err := Parse("J-09512461-9"); err == nil {
		t.Error("expected check digit mismatch")
	}
}

func TestParseCedulaNoCheckDigit(t *testing.T) {
	id, err := Parse("V28476588")
	if err != nil {
		t.Fatal(err)
	}
	if id.String() != "V-28476588" {
		t.Errorf("String() = %q, want V-28476588", id.String())
	}
}

func TestParseInvalidPrefix(t *testing.T) {
	if _, err := Parse("X123456"); err == nil {
		t.Error("expected unknown prefix error")
	}
}
