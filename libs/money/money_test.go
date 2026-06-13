package money

import "testing"

func TestParseAndFormat(t *testing.T) {
	cases := []struct {
		in, out2 string
	}{
		{"600.66", "600.66"},
		{"0", "0.00"},
		{".5", "0.50"},
		{"-3.4", "-3.40"},
		{"1000", "1000.00"},
		{"96.114", "96.11"}, // rounds half-up at 2 places
		{"96.115", "96.12"},
		{"577.55", "577.55"},
	}
	for _, c := range cases {
		m, err := Parse(c.in, "VES")
		if err != nil {
			t.Fatalf("Parse(%q): %v", c.in, err)
		}
		if got := m.String(); got != c.out2 {
			t.Errorf("Parse(%q).String() = %q, want %q", c.in, got, c.out2)
		}
	}
}

func TestParseInvalid(t *testing.T) {
	for _, in := range []string{"", "abc", "1.2.3", "1,2", "1.1234567"} {
		if _, err := Parse(in, "VES"); err == nil {
			t.Errorf("Parse(%q) expected error", in)
		}
	}
}

func TestAddSub(t *testing.T) {
	a := MustParse("600.66", "VES")
	b := MustParse("96.11", "VES")
	sum, err := a.Add(b)
	if err != nil {
		t.Fatal(err)
	}
	if sum.String() != "696.77" {
		t.Errorf("add = %q, want 696.77", sum.String())
	}
	if _, err := a.Add(MustParse("1", "USD")); err == nil {
		t.Error("expected currency mismatch")
	}
}

func TestEqual(t *testing.T) {
	if !MustParse("1.5", "USD").Equal(MustParse("1.50", "USD")) {
		t.Error("1.5 should equal 1.50")
	}
	if MustParse("1.5", "USD").Equal(MustParse("1.5", "VES")) {
		t.Error("different currencies must not be equal")
	}
}
