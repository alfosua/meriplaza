// Package domain models the Meriplaza commerce catalog: the sellers,
// products and orders behind the "Amazon for Venezuela" marketplace and the
// Shopify-like per-seller storefronts. Sellers range from supermarkets to
// independent resellers, so the model keeps the seller profile rich enough to
// drive a customizable storefront while sharing one catalog and order backend.
package domain

import "time"

// SellerKind distinguishes the storefront archetypes.
type SellerKind string

const (
	SellerSupermarket SellerKind = "supermarket"
	SellerStore       SellerKind = "store"
	SellerIndependent SellerKind = "independent"
)

// Seller is a merchant with a customizable storefront on shared infra.
type Seller struct {
	ID         string     `json:"id"`
	Handle     string     `json:"handle"` // URL slug, unique
	Name       string     `json:"name"`
	Kind       SellerKind `json:"kind"`
	TaxID      string     `json:"taxId,omitempty"` // RIF (validated via libs/ident)
	MerchantID string     `json:"merchantId"`      // payments merchant id
	// Theme captures the customizable storefront look (colors, logo, layout).
	Theme     StorefrontTheme `json:"theme"`
	Socials   Socials         `json:"socials"`
	Currency  string          `json:"currency"` // display currency, e.g. VES or USD
	CreatedAt time.Time       `json:"createdAt"`
}

// StorefrontTheme drives the personal feel of each seller's front.
type StorefrontTheme struct {
	PrimaryColor string `json:"primaryColor,omitempty"`
	AccentColor  string `json:"accentColor,omitempty"`
	LogoURL      string `json:"logoUrl,omitempty"`
	Layout       string `json:"layout,omitempty"` // grid | list | featured
	Tagline      string `json:"tagline,omitempty"`
}

// Socials links a seller to their social-commerce channels.
type Socials struct {
	Instagram string `json:"instagram,omitempty"`
	WhatsApp  string `json:"whatsapp,omitempty"`
	Facebook  string `json:"facebook,omitempty"`
}

// Product is a sellable item. Price is a decimal string in the seller currency.
type Product struct {
	ID          string   `json:"id"`
	SellerID    string   `json:"sellerId"`
	SKU         string   `json:"sku,omitempty"`
	Title       string   `json:"title"`
	Description string   `json:"description,omitempty"`
	Price       string   `json:"price"`
	Currency    string   `json:"currency"`
	TaxRate     string   `json:"taxRate"` // VAT rate, e.g. "16.00" or "0.00"
	Stock       int      `json:"stock"`
	Images      []string `json:"images,omitempty"`
	Active      bool     `json:"active"`
}

// OrderStatus tracks fulfillment + payment + fiscal state.
type OrderStatus string

const (
	OrderPending   OrderStatus = "pending"   // created, awaiting payment
	OrderPaid      OrderStatus = "paid"      // payment intent succeeded
	OrderInvoiced  OrderStatus = "invoiced"  // fiscal invoice emitted
	OrderFulfilled OrderStatus = "fulfilled" // delivered/picked up
	OrderCanceled  OrderStatus = "canceled"
)

// OrderLine is a purchased product snapshot (price captured at order time).
type OrderLine struct {
	ProductID string `json:"productId"`
	Title     string `json:"title"`
	Quantity  int    `json:"quantity"`
	UnitPrice string `json:"unitPrice"`
	TaxRate   string `json:"taxRate"`
}

// Order ties a buyer's purchase to a payment intent and a fiscal invoice.
type Order struct {
	ID              string      `json:"id"`
	SellerID        string      `json:"sellerId"`
	Channel         string      `json:"channel,omitempty"` // web | whatsapp | instagram | facebook
	Lines           []OrderLine `json:"lines"`
	Currency        string      `json:"currency"`
	Subtotal        string      `json:"subtotal"`
	TaxTotal        string      `json:"taxTotal"`
	GrandTotal      string      `json:"grandTotal"`
	Status          OrderStatus `json:"status"`
	PaymentIntentID string      `json:"paymentIntentId,omitempty"`
	InvoiceID       string      `json:"invoiceId,omitempty"`
	BuyerName       string      `json:"buyerName,omitempty"`
	BuyerTaxID      string      `json:"buyerTaxId,omitempty"`
	CreatedAt       time.Time   `json:"createdAt"`
}
