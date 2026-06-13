// Package domain holds the canonical Venezuela fiscal invoice model and the
// reconciliation rules described in docs/venezuela-fiscal-invoice-api.md.
//
// The model intentionally mirrors the JSON contract (ve-fiscal-invoice-1.0) but
// keeps monetary fields as decimal strings on the wire; reconciliation parses
// them through libs/money so all arithmetic is exact.
package domain

const SchemaVersion = "ve-fiscal-invoice-1.0"

// Status is the fiscal lifecycle state.
type Status string

const (
	StatusDraft           Status = "draft"
	StatusPendingEmission Status = "pending_emission"
	StatusIssued          Status = "issued"
	StatusFailed          Status = "failed"
	StatusCancelled       Status = "cancelled_by_credit_note"
)

// Money is the wire representation: a decimal string plus ISO-4217 currency.
type Money struct {
	Amount   string `json:"amount"`
	Currency string `json:"currency"`
}

type Invoice struct {
	SchemaVersion   string           `json:"schemaVersion"`
	ID              string           `json:"id,omitempty"`
	Environment     string           `json:"environment"`
	Status          Status           `json:"status,omitempty"`
	Document        Document         `json:"document"`
	Issuer          Party            `json:"issuer"`
	Customer        Party            `json:"customer"`
	POS             *POS             `json:"pos,omitempty"`
	Items           []Item           `json:"items"`
	TaxSummary      []TaxSummaryLine `json:"taxSummary"`
	Totals          Totals           `json:"totals"`
	Payments        []Payment        `json:"payments"`
	ForeignExchange *ForeignExchange `json:"foreignExchange,omitempty"`
	FiscalControl   *FiscalControl   `json:"fiscalControl,omitempty"`
	Footer          *Footer          `json:"footer,omitempty"`
	Metadata        map[string]any   `json:"metadata,omitempty"`
}

type Document struct {
	Type            string `json:"type"`
	DisplayName     string `json:"displayName"`
	Number          string `json:"number,omitempty"`
	ControlNumber   string `json:"controlNumber,omitempty"`
	IssuedAt        string `json:"issuedAt,omitempty"`
	Currency        string `json:"currency"`
	Language        string `json:"language,omitempty"`
	EmissionChannel string `json:"emissionChannel"`
}

type Party struct {
	PersonType    string         `json:"personType"`
	Identifier    *Identifier    `json:"identifier,omitempty"`
	NaturalPerson *NaturalPerson `json:"naturalPerson,omitempty"`
	Company       *Company       `json:"company,omitempty"`
	Address       *Address       `json:"address,omitempty"`
	Contacts      []Contact      `json:"contacts,omitempty"`
}

type Identifier struct {
	Prefix     string `json:"prefix"`
	Number     string `json:"number"`
	CheckDigit string `json:"checkDigit,omitempty"`
	Value      string `json:"value"`
}

type NaturalPerson struct {
	FirstName      string `json:"firstName"`
	SecondName     string `json:"secondName,omitempty"`
	FirstLastName  string `json:"firstLastName"`
	SecondLastName string `json:"secondLastName,omitempty"`
	DisplayName    string `json:"displayName,omitempty"`
}

type Company struct {
	RazonSocial    string `json:"razonSocial"`
	CommercialName string `json:"commercialName,omitempty"`
	DisplayName    string `json:"displayName,omitempty"`
}

type Address struct {
	Lines      []string `json:"lines"`
	City       string   `json:"city,omitempty"`
	State      string   `json:"state,omitempty"`
	PostalCode string   `json:"postalCode,omitempty"`
	Country    string   `json:"country"`
}

type Contact struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

type POS struct {
	BranchCode      string `json:"branchCode,omitempty"`
	TerminalCode    string `json:"terminalCode,omitempty"`
	RegisterCode    string `json:"registerCode,omitempty"`
	TransactionCode string `json:"transactionCode,omitempty"`
	CashierID       string `json:"cashierId,omitempty"`
	CashierName     string `json:"cashierName,omitempty"`
}

type TaxCategory struct {
	Code string `json:"code"`
	Type string `json:"type"`
	Rate string `json:"rate"`
}

type Discount struct {
	Type        string `json:"type"`
	Description string `json:"description,omitempty"`
	Rate        string `json:"rate,omitempty"`
	Amount      Money  `json:"amount"`
}

type Item struct {
	LineNumber    int         `json:"lineNumber"`
	SKU           string      `json:"sku,omitempty"`
	Description   string      `json:"description"`
	Quantity      string      `json:"quantity"`
	UnitOfMeasure string      `json:"unitOfMeasure,omitempty"`
	UnitPrice     Money       `json:"unitPrice"`
	Discounts     []Discount  `json:"discounts,omitempty"`
	TaxCategory   TaxCategory `json:"taxCategory"`
	LineSubtotal  Money       `json:"lineSubtotal"`
	LineTax       Money       `json:"lineTax"`
	LineTotal     Money       `json:"lineTotal"`
}

type TaxSummaryLine struct {
	TaxCategory   TaxCategory `json:"taxCategory"`
	TaxableAmount Money       `json:"taxableAmount"`
	TaxAmount     Money       `json:"taxAmount"`
}

type Totals struct {
	Subtotal      Money `json:"subtotal"`
	DiscountTotal Money `json:"discountTotal"`
	TaxTotal      Money `json:"taxTotal"`
	GrandTotal    Money `json:"grandTotal"`
	AmountPayable Money `json:"amountPayable"`
	ItemCount     int   `json:"itemCount,omitempty"`
}

type Payment struct {
	Method         string `json:"method"`
	Amount         Money  `json:"amount"`
	Currency       string `json:"currency"`
	Reference      string `json:"reference,omitempty"`
	ReceivedAmount *Money `json:"receivedAmount,omitempty"`
	ChangeAmount   *Money `json:"changeAmount,omitempty"`
}

type ForeignExchange struct {
	BaseCurrency      string `json:"baseCurrency"`
	QuoteCurrency     string `json:"quoteCurrency"`
	Rate              string `json:"rate"`
	Source            string `json:"source"`
	DisplayEquivalent *Money `json:"displayEquivalent,omitempty"`
	RateEffectiveDate string `json:"rateEffectiveDate,omitempty"`
}

type FiscalControl struct {
	AuthorityName               string   `json:"authorityName"`
	FiscalPrinterRegisterNumber string   `json:"fiscalPrinterRegisterNumber,omitempty"`
	MachineSerialNumber         string   `json:"machineSerialNumber,omitempty"`
	ZReportNumber               string   `json:"zReportNumber,omitempty"`
	DailyClosureNumber          string   `json:"dailyClosureNumber,omitempty"`
	InternalTransactionNumber   string   `json:"internalTransactionNumber,omitempty"`
	Barcode                     *Barcode `json:"barcode,omitempty"`
}

type Barcode struct {
	Symbology string `json:"symbology"`
	Value     string `json:"value"`
}

type Footer struct {
	PaymentCondition string   `json:"paymentCondition,omitempty"`
	Messages         []string `json:"messages,omitempty"`
}

// FiscalAuthority returns the tax authority name printed on the receipt,
// defaulting to SENIAT when fiscalControl is absent (e.g. drafts).
func (inv Invoice) FiscalAuthority() string {
	if inv.FiscalControl != nil && inv.FiscalControl.AuthorityName != "" {
		return inv.FiscalControl.AuthorityName
	}
	return "SENIAT"
}
