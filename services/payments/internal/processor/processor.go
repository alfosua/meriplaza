// Package processor turns a confirmed PaymentIntent into a settlement, one
// implementation per payment rail. Processors are the seam where real bank,
// card-network, and blockchain integrations plug in; the implementations here
// model the state machine and validation, with deterministic stubs standing in
// for external calls.
package processor

import (
	"fmt"

	"github.com/catalinalabs/meriplaza/services/payments/internal/domain"
)

// Result is what a processor returns from Confirm.
type Result struct {
	Status     domain.Status
	NextAction *domain.NextAction
	Settlement *domain.Settlement
	Failure    string
}

// Processor advances an intent of a specific method.
type Processor interface {
	// Method returns the rail this processor handles.
	Method() domain.Method
	// Confirm attempts to advance the intent. It may move it to succeeded,
	// requires_action (more input needed), or failed.
	Confirm(intent domain.PaymentIntent) (Result, error)
}

// Registry maps methods to processors.
type Registry struct {
	procs map[domain.Method]Processor
}

func NewRegistry(ps ...Processor) *Registry {
	r := &Registry{procs: map[domain.Method]Processor{}}
	for _, p := range ps {
		r.procs[p.Method()] = p
	}
	return r
}

// For returns the processor for a method, or an error if unsupported.
func (r *Registry) For(m domain.Method) (Processor, error) {
	p, ok := r.procs[m]
	if !ok {
		return nil, fmt.Errorf("unsupported payment method %q", m)
	}
	return p, nil
}

// Default builds the registry with all built-in processors.
func Default() *Registry {
	return NewRegistry(
		PagoMovil{},
		Transferencia{},
		DivisasCash{},
		PuntoDeVenta{},
		CardIntl{},
		Crypto{},
	)
}
