// Package store persists payment intents and idempotency keys. The default is
// in-memory; production swaps a durable backend implementing Store.
package store

import (
	"errors"
	"sync"

	"github.com/catalinalabs/salesfactory/services/payments/internal/domain"
)

var ErrNotFound = errors.New("payment intent not found")

type Store interface {
	Save(domain.PaymentIntent) error
	Get(id string) (domain.PaymentIntent, error)
	// FindByIdempotencyKey returns a prior intent created with the same key, so
	// a retried create over a flaky link returns the original instead of
	// charging twice.
	FindByIdempotencyKey(merchantID, key string) (domain.PaymentIntent, bool)
}

type Memory struct {
	mu     sync.Mutex
	byID   map[string]domain.PaymentIntent
	byIdem map[string]string // merchantID|key -> intent id
}

func NewMemory() *Memory {
	return &Memory{byID: map[string]domain.PaymentIntent{}, byIdem: map[string]string{}}
}

func (m *Memory) Save(pi domain.PaymentIntent) error {
	if pi.ID == "" {
		return errors.New("store: intent id required")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.byID[pi.ID] = pi
	if pi.IdempotencyKey != "" {
		m.byIdem[pi.MerchantID+"|"+pi.IdempotencyKey] = pi.ID
	}
	return nil
}

func (m *Memory) Get(id string) (domain.PaymentIntent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	pi, ok := m.byID[id]
	if !ok {
		return domain.PaymentIntent{}, ErrNotFound
	}
	return pi, nil
}

func (m *Memory) FindByIdempotencyKey(merchantID, key string) (domain.PaymentIntent, bool) {
	if key == "" {
		return domain.PaymentIntent{}, false
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.byIdem[merchantID+"|"+key]
	if !ok {
		return domain.PaymentIntent{}, false
	}
	pi, ok := m.byID[id]
	return pi, ok
}
